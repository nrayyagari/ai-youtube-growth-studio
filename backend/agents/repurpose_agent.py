from agents.base import BaseAgent
from core.router import AIProviderRouter
import json


class RepurposeAgent(BaseAgent):
    name = "repurpose"

    def process(self, channel: dict, inputs: dict, router: AIProviderRouter) -> dict:
        script = inputs.get("script", "")
        topic = inputs.get("topic", "")
        existing_hooks = inputs.get("hooks", "")
        titles = inputs.get("titles", "")

        if not script:
            return {"output": {"error": "No script provided"}, "section_type": "repurpose"}

        return self._extract_shorts(channel, script, topic, existing_hooks, titles, router)

    def _extract_shorts(self, channel: dict, script: str, topic: str, hooks: str, titles: str, router: AIProviderRouter) -> dict:
        prompt = f"""You are a YouTube Shorts content strategist for faceless channels. Extract 3-5 self-contained Shorts from this long-form script.

Channel: {channel.get('name', 'Unknown')}
Niche: {channel.get('niche', 'General')}
Original topic: {topic}
Original hooks: {hooks[:500]}
Original titles: {titles[:500]}

Full script:
{script[:4000]}

For each Short, extract a self-contained segment (60s / 100-180 words). Prioritize:
- Strong hooks that grab attention in 1 second
- Surprising facts or revelations
- Clear takeaways or actionable insights
- Emotional moments
- Highly shareable content

Return JSON:
{{
  "shorts": [
    {{
      "hook": "Short-form hook (max 10 words, must create curiosity)",
      "script": "100-180 word condensed script for this Short",
      "title": "YouTube Shorts title (max 40 chars)",
      "thumb_concept": {{
        "concept_name": "Name for this Short thumbnail",
        "description": "Visual thumbnail description",
        "text_overlay": "2-3 words overlay",
        "color_scheme": "Color palette",
        "emotional_trigger": "curiosity/urgency/surprise",
        "click_potential": "high/medium/low"
      }},
      "estimated_duration_seconds": 45,
      "source_timestamp": "Approximate position in original script",
      "viral_potential": 85
    }}
  ],
  "repurposing_insight": "Why these segments work as Shorts"
}}

Scores 0-100. Return ONLY valid JSON, no markdown."""
        result = router.generate(prompt, temperature=0.7, max_tokens=4096)
        data = self._safe_json(result)
        return {"output": data, "section_type": "repurpose"}
