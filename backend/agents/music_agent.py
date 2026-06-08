from agents.base import BaseAgent
from core.router import AIProviderRouter


class MusicAgent(BaseAgent):
    name = "music"

    def process(self, channel: dict, inputs: dict, router: AIProviderRouter) -> dict:
        scene_plan = str(inputs.get("scene_plan", ""))
        prompt = f"""You are a music director for faceless YouTube videos.

Channel style: {channel.get('music_style', 'Modern background music')}
Scene plan excerpt: {scene_plan[:2000] if len(scene_plan) > 2000 else scene_plan}

Suggest royalty-free background music. All suggestions must be from royalty-free sources
(Epidemic Sound, Artlist, YouTube Audio Library, Pixabay Music, Uppbeat).

Return a JSON object:
{{
  "music_suggestions": [
    {{
      "scene_range": "scenes 1-3",
      "mood": "upbeat/calm/tension/inspirational",
      "genre": "electronic/lofi/cinematic/corporate/ambient",
      "tempo": "fast/medium/slow",
      "source": "YouTube Audio Library / Epidemic Sound / etc.",
      "search_keywords": ["keyword1", "keyword2"]
    }}
  ],
  "overall_music_direction": "Description of music journey through the video",
  "score": {{
    "music_fit": {{"score": 85, "explanation": "..."}}
  }}
}}

IMPORTANT: All music sources must be royalty-free. Never suggest copyrighted music.
Scores 0-100. Return ONLY valid JSON."""
        result = router.generate(prompt, temperature=0.7)
        data = self._safe_json(result)
        return {"output": data, "section_type": "music"}
