from agents.base import BaseAgent
from core.router import AIProviderRouter


class VisualAgent(BaseAgent):
    name = "visual"

    def process(self, channel: dict, inputs: dict, router: AIProviderRouter) -> dict:
        script = inputs.get("script", "")
        correction = inputs.get("correction_prompt", "")
        correction_prefix = f"IMPORTANT CORRECTION INSTRUCTION: {correction}\n\n" if correction else ""
        prompt = f"""{correction_prefix}You are a visual director for faceless YouTube videos.

Channel visual style: {channel.get('visual_style', 'Clean and modern')}

Script:
{script[:3000] if len(script) > 3000 else script}

Create a scene-by-scene visual plan. Each scene should describe what appears on screen.
For faceless content, use stock footage, screen recordings, motion graphics, text overlays.

Return a JSON object:
{{
  "scenes": [
    {{
      "scene_number": 1,
      "duration_seconds": 10,
      "narration_snippet": "part of the script for this scene",
      "visual_description": "What the viewer sees",
      "on_screen_text": "Text to overlay",
      "style": "motion-graphics/stock-footage/screen-recording/text-only",
      "transition": "cut/fade/wipe"
    }}
  ],
  "visual_style_summary": "Overall visual direction",
  "aspect_ratio": "16:9",
  "template": "minimalist/bold/documentary/tech",
  "color_palette": ["#primary", "#secondary", "#accent"],
  "score": {{
    "visual_quality": {{"score": 85, "explanation": "..."}},
    "consistency": {{"score": 85, "explanation": "..."}}
  }}
}}

Scores 0-100. Return ONLY valid JSON."""
        result = router.generate(prompt, temperature=0.7, max_tokens=4096)
        data = self._safe_json(result)
        return {"output": data, "section_type": "visual"}
