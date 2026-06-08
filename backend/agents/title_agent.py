from agents.base import BaseAgent
from core.router import AIProviderRouter


class TitleAgent(BaseAgent):
    name = "title"

    def process(self, channel: dict, inputs: dict, router: AIProviderRouter) -> dict:
        idea = inputs.get("idea", "")
        script = str(inputs.get("script", ""))
        prompt = f"""You are a YouTube title and SEO expert for faceless channels.

Idea: {idea}
Script excerpt: {script[:2000] if len(script) > 2000 else script}

Generate click-worthy titles (no clickbait lies — titles must match content), SEO description, tags, and hashtags.

Return a JSON object:
{{
  "titles": [
    {{
      "title": "Title text",
      "strategy": "curiosity/list/number/how-to/controversial/question",
      "ctr_estimate": "high/medium/low",
      "reason": "Why this title works"
    }}
  ],
  "recommended_title": "The best title from the list",
  "description": "YouTube description text with timestamps and links",
  "tags": ["tag1", "tag2", "tag3", "..."],
  "hashtags": ["#tag1", "#tag2", "#tag3"],
  "pinned_comment": "Suggested pinned comment text",
  "seo_keywords": ["keyword1", "keyword2"],
  "title_score": {{"score": 85, "explanation": "..."}},
  "ctr_score": {{"score": 85, "explanation": "..."}},
  "seo_score": {{"score": 85, "explanation": "..."}}
}}

Scoring calibration:
- 90-100: Excellent titles with high CTR potential. Clever, curiosity-driven, keyword-rich.
- 80-89: Good titles, solid SEO, decent click potential.
- 70-79: OK but generic or overly clickbaity. Needs refinement.

Score HONESTLY. Most good titles should score 80-85. Only truly standout titles score 90+.
Scores 0-100. Return ONLY valid JSON."""
        result = router.generate(prompt, temperature=0.8)
        data = self._safe_json(result)
        return {"output": data, "section_type": "titles"}
