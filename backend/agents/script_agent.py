from agents.base import BaseAgent
from core.router import AIProviderRouter


class ScriptAgent(BaseAgent):
    name = "script"

    def process(self, channel: dict, inputs: dict, router: AIProviderRouter) -> dict:
        idea = inputs.get("idea", "")
        prompt = f"""You are a professional YouTube script writer for faceless channels.

Channel: {channel.get('name', '')}, Niche: {channel.get('niche', '')}
Audience: {channel.get('audience', '')}, Language: {channel.get('language', 'en')}

Topic/Idea: {idea}

Write a complete narration script for a faceless YouTube video. The script should:
- Start with a strong hook (first 5 seconds)
- Maintain viewer retention throughout
- Be conversational and easy to narrate
- Include visual cues for scenes [VISUAL: description]
- Have clear segment breaks

Return a JSON object:
{{
  "script": "Full narration script text with [VISUAL: ...][MUSIC: ...][TEXT: ...] markers",
  "estimated_duration_seconds": 480,
  "hook": "The opening hook line",
  "segments": [
    {{"name": "segment name", "purpose": "what this segment does", "duration_estimate": 60}}
  ],
  "tone": "conversational/educational/entertaining",
  "on_screen_text": ["text to show 1", "text to show 2"],
  "cta": "Call to action text",
  "score": {{
    "script_quality": {{"score": 85, "explanation": "..."}},
    "retention": {{"score": 85, "explanation": "..."}},
    "monetization": {{"score": 85, "explanation": "..."}},
    "factual_accuracy": {{"score": 85, "explanation": "..."}}
  }}
}}

Scoring calibration:
- 90-100: Excellent, engaging script. Strong hook, good pacing, clear segments.
- 80-89: Good script, solid structure. Minor improvements needed.
- 70-79: Decent but needs better hook or clearer structure.

Score HONESTLY. Most good scripts should score 80-85. Only exceptional scripts score 90+.
Scores 0-100. Return ONLY valid JSON."""
        result = router.generate(prompt, temperature=0.8, max_tokens=4096)
        data = self._safe_json(result)
        return {"output": data, "section_type": "script"}
