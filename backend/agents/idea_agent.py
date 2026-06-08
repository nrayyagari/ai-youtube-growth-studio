from agents.base import BaseAgent
from core.router import AIProviderRouter


class IdeaAgent(BaseAgent):
    name = "idea"

    def process(self, channel: dict, inputs: dict, router: AIProviderRouter) -> dict:
        topic = inputs.get("topic", "")
        prompt = f"""You are a YouTube content strategist for a faceless channel.

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
- 90-100: Strong idea. Unique angle, clear audience hook, good monetization. Ready to publish.
- 80-89: Good idea but missing a sharp angle or hook. Publishable with minor improvements.
- 70-79: Decent concept, too generic. Needs a unique angle.
- 60-69: Weak. Too broad or too niche. Major rework needed.
- Below 60: Bad idea. Skip.

Score HONESTLY. Most decent ideas should score 80-85. Only truly great ideas hit 90+.
Do NOT score under 70 unless the idea is genuinely bad. Do NOT score 90+ unless it's truly excellent.

Calculate total as weighted average (must match the individual category scores mathematically). Return ONLY valid JSON, no markdown."""
        result = router.generate(prompt, temperature=0.9)
        data = self._safe_json(result)
        return {"output": data, "section_type": "idea"}
