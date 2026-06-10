from agents.base import BaseAgent
from core.router import AIProviderRouter


class ScriptFromReferenceAgent(BaseAgent):
    name = "script_from_reference"

    def process(self, channel: dict, inputs: dict, router: AIProviderRouter) -> dict:
        topic = inputs.get("topic", "")
        reference_style = inputs.get("reference_style", {})
        reference_transcript = inputs.get("reference_transcript", "")
        corrections = inputs.get("correction_prompt", "")
        correction_prefix = f"IMPORTANT CORRECTION INSTRUCTION: {corrections}\n\n" if corrections else ""

        reference_profile = ""
        if isinstance(reference_style, dict):
            if reference_style.get("visual_style"):
                reference_profile += f"Visual Style: {reference_style['visual_style']}\n"
            if reference_style.get("editing_style"):
                reference_profile += f"Editing Style: {reference_style['editing_style']}\n"
            if reference_style.get("tone"):
                reference_profile += f"Tone: {reference_style['tone']}\n"
            if reference_style.get("pacing"):
                reference_profile += f"Pacing: {reference_style['pacing']}\n"
            if reference_style.get("music_preferences"):
                reference_profile += f"Music: {reference_style['music_preferences']}\n"
            if reference_style.get("hooks"):
                reference_profile += f"Hook Strategy: {reference_style['hooks']}\n"
            patterns = reference_style.get("content_patterns", {})
            if patterns:
                reference_profile += f"Content Patterns: {patterns}\n"

        prompt = f"""{correction_prefix}You are a YouTube script writer that replicates the style and structure of reference videos while writing ORIGINAL content.

Your job is to write a script that perfectly matches the STRUCTURE, PACING, TONE, and PRESENTATION STYLE of the reference video, but about a completely DIFFERENT topic. Do NOT copy any wording, facts, or content from the reference.

Reference Video Style Profile:
{reference_profile[:1500]}

Reference Transcript (for style/structure reference only):
{reference_transcript[:2000]}

New Topic: {topic}
Channel: {channel.get('name', 'Unknown')} - {channel.get('niche', 'General')}
Language: {channel.get('language', 'English')}

IMPORTANT RULES:
1. Match the reference's STRUCTURE (hook length, segment order, pacing, transitions between segments)
2. Match the reference's TONE (casual/formal/educational/entertaining/urgent)
3. Match the reference's HOOK STYLE (question/statistic/story/shock)
4. Match the reference's CTA PLACEMENT and style
5. Match the reference's pacing (fast cuts vs slow build, information density)
6. Do NOT copy any words, phrases, facts, or content from the reference
7. Write about the NEW TOPIC only
8. Estimate scene durations that match the reference's rhythm

Return a JSON object:
{{
  "hook": "Opening hook sentence",
  "tone": "Overall tone description",
  "estimated_duration_seconds": 300,
  "segments": [
    {{
      "name": "Segment name",
      "duration_estimate": 45,
      "key_point": "What this segment covers"
    }}
  ],
  "script": "Full narration script with scene breaks [SCENE: description]",
  "cta": "Call to action text",
  "on_screen_text": ["List of key text overlays"],
  "score": {{
    "script_quality": {{"score": 85, "explanation": "Overall script quality assessment"}},
    "style_match": {{"score": 85, "explanation": "How well the script matches reference style"}},
    "originality": {{"score": 90, "explanation": "How original the content is vs reference"}}
  }}
}}

Score 0-100. Return ONLY valid JSON, no markdown."""
        result = router.generate(prompt, temperature=0.8, max_tokens=4096)
        data = self._safe_json(result)
        return {"output": data, "section_type": "script"}
