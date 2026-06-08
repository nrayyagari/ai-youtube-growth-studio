from agents.base import BaseAgent
from core.router import AIProviderRouter
import json


class MasterRouterAgent(BaseAgent):
    name = "master_router"

    def analyze_reference(self, channel: dict, ref_videos: list[dict], router: AIProviderRouter) -> dict:
        videos_text = ""
        for v in ref_videos:
            videos_text += f"""
Video: {v.get('title', 'Untitled')}
Channel: {v.get('channel_name', 'Unknown')}
Duration: {v.get('duration', 'Unknown')}
Transcript excerpt: {v.get('transcript', '')[:2000]}
"""

        prompt = f"""You are a YouTube content strategy master router for faceless channels.

Channel profile:
- Niche: {channel.get('niche', 'General')}
- Audience: {channel.get('audience', 'General audience')}
- Monetization goal: {channel.get('monetization_goal', 'Ad revenue')}

Reference videos analyzed:
{videos_text}

Analyze these reference videos and extract a comprehensive style profile. Identify:
1. Visual patterns (transitions, text overlays, color schemes, stock footage vs motion graphics)
2. Editing style (pace, cuts, rhythm, scene duration patterns)
3. Tone (conversational, educational, entertaining, urgent)
4. Music preferences (genre, mood, volume relative to voice)
5. Pacing (hook length, content density, segment structure)
6. Content patterns (formula structures, recurring segments, CTA placement)
7. Hook strategies (opening patterns, curiosity triggers)
8. Thumbnail style (color palette, text placement, emotional triggers)

Return a JSON object:
{{
  "visual_style": "Description of visual patterns observed",
  "editing_style": "Description of editing approach and pacing",
  "tone": "Overall tone and voice",
  "music_preferences": "Music style recommendations",
  "pacing": "Content pacing description",
  "content_patterns": {{
    "hook_structure": "How videos typically open",
    "segment_flow": "How content is organized",
    "cta_pattern": "Call-to-action approach",
    "length_pattern": "Typical video length observations"
  }},
  "hooks": "Hook patterns and strategies used",
  "thumbnails_style": "Thumbnail design patterns",
  "score": {{
    "style_consistency": {{"score": 85, "explanation": "How consistent the style is"}},
    "audience_fit": {{"score": 85, "explanation": "How well style fits target audience"}},
    "monetization_fit": {{"score": 85, "explanation": "How advertiser-friendly the style is"}}
  }}
}}

Scores 0-100. Return ONLY valid JSON."""
        result = router.generate(prompt, temperature=0.7, max_tokens=4096)
        data = self._safe_json(result)
        return data

    def process(self, channel: dict, inputs: dict, router: AIProviderRouter) -> dict:
        action = inputs.get("action", "analyze")
        if action == "analyze":
            ref_videos = inputs.get("reference_videos", [])
            return {"output": self.analyze_reference(channel, ref_videos, router), "section_type": "style_profile"}
        return {"output": {}, "section_type": "style_profile"}
