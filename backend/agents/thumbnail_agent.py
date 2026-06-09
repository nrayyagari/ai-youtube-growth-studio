from agents.base import BaseAgent
from core.router import AIProviderRouter


class ThumbnailAgent(BaseAgent):
    name = "thumbnail"

    def process(self, channel: dict, inputs: dict, router: AIProviderRouter) -> dict:
        title = inputs.get("title", "")
        idea = inputs.get("idea", "")
        correction = inputs.get("correction_prompt", "")
        correction_prefix = f"IMPORTANT CORRECTION INSTRUCTION: {correction}\n\n" if correction else ""
        prompt = f"""{correction_prefix}You are a YouTube thumbnail designer for faceless channels.

Video Title: {title}
Topic: {idea}

Generate thumbnail concepts that are:
- High contrast, visually striking
- Text overlay is readable even on mobile
- Curious/hook-driven (makes people click)
- No clickbait — must represent the actual video content

Return a JSON object:
{{
  "thumbnail_concepts": [
    {{
      "concept_name": "Concept name",
      "description": "Detailed visual description of the thumbnail",
      "text_overlay": "Text to put on thumbnail (max 4 words)",
      "color_scheme": "Color palette description",
      "layout": "Layout description",
      "emotional_trigger": "curiosity/urgency/fear/desire/surprise",
      "click_potential": "high/medium/low"
    }}
  ],
  "recommended_concept": "Concept name to use",
  "score": {{
    "thumbnail_quality": {{"score": 85, "explanation": "..."}},
    "ctr_potential": {{"score": 85, "explanation": "..."}}
  }}
}}

Scores 0-100. Return ONLY valid JSON."""
        result = router.generate(prompt, temperature=0.8)
        data = self._safe_json(result)
        return {"output": data, "section_type": "thumbnail"}
