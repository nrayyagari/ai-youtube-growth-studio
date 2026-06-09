from agents.base import BaseAgent
from core.router import AIProviderRouter


class IdeaAgent(BaseAgent):
    name = "idea"

    def process(self, channel: dict, inputs: dict, router: AIProviderRouter) -> dict:
        topic = inputs.get("topic", "")
        correction = inputs.get("correction_prompt", "")
        correction_prefix = f"IMPORTANT CORRECTION INSTRUCTION: {correction}\n\n" if correction else ""
        prompt = f"""{correction_prefix}You are a YouTube content strategist for a faceless channel.

Channel profile:
- Niche: {channel.get('niche', 'General')}
- Audience: {channel.get('audience', 'General audience')}
- Language: {channel.get('language', 'English')}
- Monetization goal: {channel.get('monetization_goal', 'Ad revenue')}

{f'User topic idea: {topic}' if topic else 'Generate 3 unique video topic ideas.'}

Return a JSON object with:
{{
  "ideas": [
    {{
      "title": "Video title idea",
      "topic": "Core topic",
      "angle": "Unique angle or hook",
      "audience_relevance": "Why target audience cares",
      "score": {{
        "total": 85,
        "topic_demand": {{"score": 85, "explanation": "..."}},
        "pain_point": {{"score": 85, "explanation": "..."}},
        "ctr": {{"score": 85, "explanation": "..."}},
        "retention": {{"score": 85, "explanation": "..."}},
        "monetization": {{"score": 85, "explanation": "..."}},
        "competition": {{"score": 85, "explanation": "..."}},
        "series": {{"score": 85, "explanation": "..."}},
        "channel_fit": {{"score": 85, "explanation": "..."}}
      }}
    }}
  ]
}}

Important scoring calibration (CRITICAL - follow this exactly):
- 90-100: Truly excellent, viral potential, unique angle. Immediate publish.
- 85-89: Strong idea. Good hook, clear audience, solid monetization. Ready to publish.
- 80-84: Decent concept but could be sharper. Publishable with minor tweaks.
- 70-79: Generic or too niche. Needs a better angle.
- Below 70: Weak idea. Skip.

Score HONESTLY but GENEROUSLY. Most decent topics should score 85-90. Only bad ideas score below 80.

Calculate total as weighted average (must match the individual category scores mathematically). Return ONLY valid JSON, no markdown."""
        result = router.generate(prompt, temperature=0.9)
        data = self._safe_json(result)
        return {"output": data, "section_type": "idea"}
