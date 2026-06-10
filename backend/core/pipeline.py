import json
import time
import httpx
import re
from typing import Callable
from agents.idea_agent import IdeaAgent
from agents.script_agent import ScriptAgent
from agents.visual_agent import VisualAgent
from agents.music_agent import MusicAgent
from agents.title_agent import TitleAgent
from agents.thumbnail_agent import ThumbnailAgent
from agents.qa_agent import QAAgent
from agents.visual_reference_agent import VisualReferenceAgent
from agents.script_from_reference_agent import ScriptFromReferenceAgent
from core.router import AIProviderRouter


def _extract_youtube_id(url: str) -> str:
    patterns = [
        r"(?:v=|\/)([0-9A-Za-z_-]{11})(?:[?&]|$)",
        r"youtu\.be\/([0-9A-Za-z_-]{11})",
        r"embed\/([0-9A-Za-z_-]{11})",
    ]
    for p in patterns:
        m = re.search(p, url)
        if m:
            return m.group(1)
    return ""


def _fetch_youtube_metadata(video_id: str) -> dict:
    try:
        oembed_url = f"https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={video_id}&format=json"
        r = httpx.get(oembed_url, timeout=10)
        if r.status_code == 200:
            data = r.json()
            return {
                "title": data.get("title", ""),
                "channel_name": data.get("author_name", ""),
                "thumbnail_url": data.get("thumbnail_url", ""),
            }
    except Exception:
        pass
    return {"title": "", "channel_name": "", "thumbnail_url": ""}


def _fetch_youtube_transcript(video_id: str) -> str:
    try:
        from youtube_transcript_api import YouTubeTranscriptApi
        transcript = YouTubeTranscriptApi.get_transcript(video_id)
        return " ".join([entry["text"] for entry in transcript])
    except Exception:
        return ""


class PipelineRunner:
    def __init__(self, router: AIProviderRouter = None):
        self.router = router or AIProviderRouter()
        self.agents = [
            IdeaAgent(),
            ScriptAgent(),
            VisualAgent(),
            MusicAgent(),
            TitleAgent(),
            ThumbnailAgent(),
            QAAgent(),
        ]
        self.ref_agents = [
            VisualReferenceAgent(),
            ScriptFromReferenceAgent(),
        ]

    def run(self, channel: dict, topic: str = "", skip_sections: set[str] | None = None,
            on_progress: Callable[[dict], None] | None = None,
            correction_prompts: dict[str, str] | None = None,
            reference_url: str | None = None) -> dict:
        results = []
        inputs = {"topic": topic}
        skip = skip_sections or set()
        prompts = correction_prompts or {}

        if reference_url:
            try:
                if on_progress:
                    on_progress({"agent": "reference", "status": "fetching"})
                video_id = _extract_youtube_id(reference_url)
                meta = _fetch_youtube_metadata(video_id)
                transcript = _fetch_youtube_transcript(video_id)
                inputs["reference_url"] = reference_url
                inputs["transcript"] = transcript
                inputs["reference_meta"] = meta

                if on_progress:
                    on_progress({"agent": "reference", "status": "analyzing_visuals"})
                vis_ref = VisualReferenceAgent()
                vis_result = vis_ref.process(channel, inputs, self.router)
                vis_output = vis_result.get("output", {})
                if isinstance(vis_output, dict):
                    inputs["visual_reference"] = vis_output
                results.append(vis_result)
                time.sleep(self.router.min_interval)

                if on_progress:
                    on_progress({"agent": "reference", "status": "writing_script"})
                script_ref = ScriptFromReferenceAgent()
                inputs["reference_style"] = inputs.get("reference_style", {})
                script_result = script_ref.process(channel, inputs, self.router)
                script_output = script_result.get("output", {})
                if isinstance(script_output, dict):
                    flat = self._flatten_ref_script(script_output)
                    inputs.update(flat)
                results.append(script_result)
                time.sleep(self.router.min_interval)

                skip.add("idea")
                skip.add("visual")
            except Exception as e:
                if on_progress:
                    on_progress({"agent": "reference", "status": "error", "error": str(e)})
                skip.discard("idea")
                skip.discard("visual")

        for agent in self.agents:
            if agent.name in skip:
                if on_progress:
                    on_progress({"agent": agent.name, "status": "skipped"})
                continue
            if on_progress:
                on_progress({"agent": agent.name, "status": "running"})
            try:
                if agent.name in prompts:
                    inputs["correction_prompt"] = prompts[agent.name]
                result = agent.process(channel, inputs, self.router)
                results.append(result)
                output = result.get("output", {})
                if isinstance(output, dict):
                    inputs.update(self._flatten_output(output, agent.name))
                if on_progress:
                    on_progress({"agent": agent.name, "status": "done", "section_type": result.get("section_type")})
                time.sleep(self.router.min_interval)
            except Exception as e:
                if on_progress:
                    on_progress({"agent": agent.name, "status": "error", "error": str(e)})
                raise PipelineError(agent.name, str(e))

        approval = self._evaluate_approval(results)
        return {
            "id": inputs.get("id", ""),
            "topic": topic,
            "reference_used": bool(reference_url),
            "reference_url": reference_url,
            "sections": results,
            "approval": approval,
            "created_at": inputs.get("created_at", ""),
        }

    def _flatten_ref_script(self, output: dict) -> dict:
        flat = {}
        flat["script"] = output.get("script", "")
        flat["script_json"] = output
        return flat

    def _flatten_output(self, output: dict, agent_name: str) -> dict:
        flat = {}
        if agent_name == "idea":
            ideas = output.get("ideas", [])
            if ideas:
                flat["idea"] = json.dumps(ideas[0])
            flat["ideas_json"] = output
        elif agent_name == "script":
            flat["script"] = output.get("script", "")
            flat["script_json"] = output
        elif agent_name == "visual":
            flat["scene_plan"] = json.dumps(output.get("scenes", []))
            flat["visual_json"] = output
        elif agent_name == "music":
            flat["music_json"] = output
        elif agent_name == "title":
            flat["titles"] = json.dumps(output.get("titles", []))
            flat["title"] = output.get("recommended_title", "")
            flat["title_json"] = output
        elif agent_name == "thumbnail":
            flat["thumbnail"] = json.dumps(output.get("thumbnail_concepts", []))
            flat["thumbnail_json"] = output
        elif agent_name == "qa":
            flat["qa_report"] = json.dumps(output.get("checks", []))
            flat["qa_json"] = output
        return flat

    def _evaluate_approval(self, results: list[dict]) -> dict:
        thresholds = {
            "growth_score": 85,
            "script_score": 85,
            "title_score": 85,
            "thumbnail_score": 85,
            "copyright_safety": 85,
            "factual_accuracy": 85,
            "retention": 85,
            "monetization": 85,
        }

        category_agent = {
            "growth_score": "idea",
            "script_score": "script",
            "retention": "script",
            "monetization": "qa",
            "title_score": "title",
            "thumbnail_score": "thumbnail",
            "copyright_safety": "qa",
            "factual_accuracy": "qa",
        }

        scores = self._extract_scores(results)
        failing = []
        corrections = []
        correction_prompts = {}

        for category, threshold in thresholds.items():
            actual = scores.get(category, 0)
            if actual < threshold:
                failing.append({"category": category, "score": actual, "required": threshold})
                corrections.append(f"Improve {category}: currently {actual}, need {threshold}")
                agent_name = category_agent.get(category, "")
                if agent_name:
                    existing = correction_prompts.get(agent_name, "")
                    gap = threshold - actual
                    hint = f"[FIX REQUIRED] {category} scored {actual}/100 (need {threshold}, missing {gap} points). "
                    correction_prompts[agent_name] = existing + hint

        for agent_name in correction_prompts:
            correction_prompts[agent_name] += "Regenerate this section with a stronger focus on the failing categories. Maintain all other quality dimensions."

        status = "APPROVED" if not failing else "NEEDS_IMPROVEMENT"
        return {
            "status": status,
            "scores": scores,
            "failing": failing,
            "corrections": corrections,
            "correction_prompts": correction_prompts,
        }

    def _extract_scores(self, results: list[dict]) -> dict:
        scores = {}
        for r in results:
            output = r.get("output", {})
            if not isinstance(output, dict):
                continue
            section_type = r.get("section_type", "")

            if section_type == "idea":
                ideas = output.get("ideas", [])
                if ideas:
                    idea_score = ideas[0].get("score", {})
                    scores["growth_score"] = idea_score.get("total", 0)
                    for cat, val in idea_score.items():
                        if isinstance(val, dict) and "score" in val:
                            scores[f"idea_{cat}"] = val["score"]
            elif section_type == "script":
                script_score = output.get("score", {})
                if script_score:
                    for cat, val in script_score.items():
                        if isinstance(val, dict) and "score" in val:
                            key = "script_score" if cat == "script_quality" else cat
                            scores[key] = val["score"]
            elif section_type in ("visual", "scene_plan"):
                visual_score = output.get("score", {})
                if isinstance(visual_score, dict):
                    overall = visual_score.get("overall")
                    if overall is None:
                        vals = []
                        for v in visual_score.values():
                            if isinstance(v, dict) and "score" in v:
                                vals.append(v["score"])
                        overall = sum(vals) // len(vals) if vals else 0
                    scores["visual_score"] = int(overall) if overall else 0
                elif isinstance(visual_score, (int, float)):
                    scores["visual_score"] = int(visual_score)
                else:
                    scores["visual_score"] = 0
            elif section_type == "titles":
                scores["title_score"] = output.get("title_score", {}).get("score", 0)
                scores["ctr_score"] = output.get("ctr_score", {}).get("score", 0)
            elif section_type == "thumbnail":
                scores["thumbnail_score"] = output.get("score", {}).get("thumbnail_quality", {}).get("score", 0)
            elif section_type == "music":
                music_score = output.get("score", 0)
                if isinstance(music_score, dict):
                    overall = music_score.get("overall") or music_score.get("score") or music_score.get("music_fit")
                    if isinstance(overall, dict):
                        overall = overall.get("score") or overall.get("overall")
                    if overall is None:
                        for v in music_score.values():
                            if isinstance(v, dict) and "score" in v:
                                overall = v["score"]
                                break
                    scores["music_score"] = int(overall) if overall is not None else 0
                elif isinstance(music_score, (int, float)):
                    scores["music_score"] = int(music_score)
                else:
                    scores["music_score"] = 0
            elif section_type == "qa_report":
                checks = output.get("checks", [])
                qa_scores = []
                for check in checks:
                    check_type = check.get("type", "")
                    score = check.get("score", 0)
                    if check_type in ("copyright", "monetization"):
                        scores[f"{check_type}_safety"] = score
                    elif check_type == "factual":
                        scores["factual_accuracy"] = score
                    else:
                        scores[check_type] = score
                    qa_scores.append(score)
                if qa_scores:
                    scores["qa_overall"] = sum(qa_scores) // len(qa_scores)
                elif output.get("overall_qa_score"):
                    scores["qa_overall"] = int(output["overall_qa_score"])
                else:
                    scores["qa_overall"] = 0

        return scores


class PipelineError(Exception):
    def __init__(self, agent_name: str, detail: str):
        self.agent_name = agent_name
        self.detail = detail
        super().__init__(f"Pipeline failed at {agent_name}: {detail}")
