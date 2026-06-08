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

Important: Scores must be 0-100. Be honest and critical. High scores only for truly excellent ideas.
Use the scoring categories:
- topic_demand (20%): Is this topic searched for?
- pain_point (15%): Does it solve a real problem?
- ctr (15%): Will the title/hook make people click?
- retention (15%): Will people watch till the end?
- monetization (15%): Is this advertiser-friendly?
- competition (10%): Is there space to compete?
- series (5%): Can this be part of a series?
- channel_fit (5%): Does it match the channel?

Calculate total as weighted average. Return ONLY valid JSON, no markdown."""
        result = router.generate(prompt, temperature=0.9)
        data = self._safe_json(result)
        return {"output": data, "section_type": "idea"}
