import json
import time
from typing import Callable
from agents.idea_agent import IdeaAgent
from agents.script_agent import ScriptAgent
from agents.visual_agent import VisualAgent
from agents.music_agent import MusicAgent
from agents.title_agent import TitleAgent
from agents.thumbnail_agent import ThumbnailAgent
from agents.qa_agent import QAAgent
from core.router import AIProviderRouter


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

    def run(self, channel: dict, topic: str = "", skip_sections: set[str] | None = None,
            on_progress: Callable[[dict], None] | None = None) -> dict:
        results = []
        inputs = {"topic": topic}
        skip = skip_sections or set()

        for agent in self.agents:
            if agent.name in skip:
                if on_progress:
                    on_progress({"agent": agent.name, "status": "skipped"})
                continue
            if on_progress:
                on_progress({"agent": agent.name, "status": "running"})
            try:
                result = agent.process(channel, inputs, self.router)
                results.append(result)
                output = result.get("output", {})
                if isinstance(output, dict):
                    inputs.update(self._flatten_output(output, agent.name))
                if on_progress:
                    on_progress({"agent": agent.name, "status": "done", "section_type": result.get("section_type")})
                time.sleep(2)
            except Exception as e:
                if on_progress:
                    on_progress({"agent": agent.name, "status": "error", "error": str(e)})
                raise PipelineError(agent.name, str(e))

        approval = self._evaluate_approval(results)
        return {
            "sections": results,
            "approval": approval,
        }

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

        scores = self._extract_scores(results)
        failing = []
        corrections = []

        for category, threshold in thresholds.items():
            actual = scores.get(category, 0)
            if actual < threshold:
                failing.append({"category": category, "score": actual, "required": threshold})
                corrections.append(f"Improve {category}: currently {actual}, need {threshold}")

        status = "APPROVED" if not failing else "NEEDS_IMPROVEMENT"
        return {
            "status": status,
            "scores": scores,
            "failing": failing,
            "corrections": corrections,
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
                for cat, val in script_score.items():
                    if isinstance(val, dict) and "score" in val:
                        key = "script_score" if cat == "script_quality" else cat
                        scores[key] = val["score"]
            elif section_type == "titles":
                scores["title_score"] = output.get("title_score", {}).get("score", 0)
                scores["ctr_score"] = output.get("ctr_score", {}).get("score", 0)
            elif section_type == "thumbnail":
                scores["thumbnail_score"] = output.get("score", {}).get("thumbnail_quality", {}).get("score", 0)
            elif section_type == "music":
                music_score = output.get("score", {})
                if isinstance(music_score, dict):
                    overall = music_score.get("overall") or music_score.get("score")
                    if overall is None:
                        for v in music_score.values():
                            if isinstance(v, dict) and "score" in v:
                                overall = v["score"]
                                break
                    scores["music_score"] = overall if overall is not None else 0
            elif section_type == "qa_report":
                checks = output.get("checks", [])
                qa_scores = []
                for check in checks:
                    check_type = check.get("type", "")
                    if check_type in ("copyright", "monetization"):
                        scores[f"{check_type}_safety"] = check.get("score", 0)
                    elif check_type == "factual":
                        scores["factual_accuracy"] = check.get("score", 0)
                    else:
                        scores[check_type] = check.get("score", 0)
                    qa_scores.append(check.get("score", 0))
                if qa_scores:
                    scores["qa_overall"] = sum(qa_scores) // len(qa_scores)

        return scores


class PipelineError(Exception):
    def __init__(self, agent_name: str, detail: str):
        self.agent_name = agent_name
        self.detail = detail
        super().__init__(f"Pipeline failed at {agent_name}: {detail}")
