from agents.base import BaseAgent
from core.router import AIProviderRouter


class VisualReferenceAgent(BaseAgent):
    name = "visual_reference"

    def process(self, channel: dict, inputs: dict, router: AIProviderRouter) -> dict:
        transcript = inputs.get("transcript", "")
        meta = inputs.get("reference_meta", {})
        title = meta.get("title", "")
        channel_name = meta.get("channel_name", "")

        prompt = f"""You are a video visual analyst. Given a transcript and metadata for a reference YouTube video, extract detailed visual patterns and produce a scene-by-scene visual description of what the viewer would see.

Reference Video: {title}
Channel: {channel_name}

Transcript:
{transcript[:4000]}

Analyze the visual style and produce:
1. Visual style summary (color palette, lighting, graphics approach)
2. Editing style (pacing, cuts per minute, transitions, text overlay patterns)
3. Scene-by-scene visual descriptions — for each logical segment of the video, describe what would appear on screen in a faceless format (stock footage, animations, text overlays, motion graphics)
4. Estimated duration per scene
5. Transition types between scenes
6. On-screen text patterns

Return a JSON object:
{{
  "visual_style_summary": "Comprehensive description of the visual approach",
  "editing_style": {{
    "pacing": "slow/moderate/fast",
    "cuts_per_minute": 12,
    "transition_preference": "cuts/fades/zooms",
    "text_pattern": "minimal/moderate/heavy text overlays"
  }},
  "color_palette": ["#hex1", "#hex2", "#hex3", "#hex4"],
  "scenes": [
    {{
      "scene_number": 1,
      "duration_seconds": 15,
      "visual_description": "Detailed description of what appears on screen",
      "on_screen_text": "Any text that would appear",
      "style": "stock-footage/motion-graphics/text-only/animation",
      "transition": "cut/fade/wipe/zoom",
      "narration_snippet": "corresponding narration segment",
      "image_description": "Detailed prompt for an AI image generator describing this scene's key frame"
    }}
  ],
  "overall_template": "documentary/tutorial/storytelling/listicle",
  "score": {{
    "visual_quality": {{"score": 85, "explanation": "How polished the visuals appear"}},
    "consistency": {{"score": 85, "explanation": "Visual consistency across the video"}}
  }}
}}

Scores 0-100. Return ONLY valid JSON, no markdown."""
        result = router.generate(prompt, temperature=0.7, max_tokens=4096)
        data = self._safe_json(result)
        return {"output": data, "section_type": "scene_plan"}
