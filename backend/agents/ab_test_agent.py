from agents.base import BaseAgent
from core.router import AIProviderRouter
import json


class ABTestAgent(BaseAgent):
    name = "ab_test"

    def process(self, channel: dict, inputs: dict, router: AIProviderRouter) -> dict:
        action = inputs.get("action", "generate_variants")
        script = inputs.get("script", "")
        topic = inputs.get("topic", "")

        if action == "score_variants":
            return self._score_variants(channel, inputs, router)
        return self._generate_variants(channel, topic, script, router)

    def _generate_variants(self, channel: dict, topic: str, script: str, router: AIProviderRouter) -> dict:
        script_excerpt = script[:2000] if script else topic[:500]
        prompt = f"""You are an A/B testing specialist for YouTube faceless channels. Generate multiple title and thumbnail concept variants optimized for CTR.

Channel: {channel.get('name', 'Unknown')}
Niche: {channel.get('niche', 'General')}
Audience: {channel.get('audience', 'General audience')}

Content: {script_excerpt}

Generate:
- 3 title variants with different angles (curiosity, urgency, value-driven, emotional, listicle)
- 3 thumbnail concept descriptions (color scheme, text placement, emotional trigger, key visual element)
- For each variant, predict CTR score (0-100) and explain why

Return JSON:
{{
  "titles": [
    {{
      "variant": "A",
      "title": "The actual title text",
      "angle": "curiosity/urgency/value/list/emotional",
      "predicted_ctr": 85,
      "ctr_rationale": "Why this title would get clicks"
    }}
  ],
  "thumbnails": [
    {{
      "variant": "A",
      "concept": "Description of the thumbnail visual concept",
      "color_palette": ["#hex1", "#hex2"],
      "text_overlay": "Any text on thumbnail",
      "emotional_trigger": "surprise/curiosity/fomo/aspiration",
      "predicted_ctr": 82,
      "ctr_rationale": "Why this thumbnail would get clicks"
    }}
  ],
  "recommended_combination": {{
    "title_variant": "B",
    "thumbnail_variant": "A",
    "combined_ctr_prediction": 88,
    "rationale": "Why this combination works best"
  }},
  "testing_schedule": {{
    "recommended_duration_hours": 24,
    "confidence_threshold": 0.95,
    "min_impressions": 1000
  }}
}}

Return ONLY valid JSON, no markdown."""
        result = router.generate(prompt, temperature=0.9, max_tokens=4096)
        data = self._safe_json(result)
        return {"output": data, "section_type": "ab_test_variants"}

    def _score_variants(self, channel: dict, inputs: dict, router: AIProviderRouter) -> dict:
        titles = inputs.get("titles", [])
        thumbnails = inputs.get("thumbnails", [])
        performance_data = inputs.get("performance_data", {})

        prompt = f"""You are an A/B test scoring AI for YouTube. Given performance data from live tests, score the variants.

Channel: {channel.get('name', 'Unknown')}
Niche: {channel.get('niche', 'General')}

Tested titles: {json.dumps(titles)}
Tested thumbnails: {json.dumps(thumbnails)}
Performance data: {json.dumps(performance_data)}

For each variant, calculate:
- Actual CTR (if data available)
- Predicted vs actual gap
- Whether variant "won" or "lost"
- Recommendations for next test

Return JSON:
{{
  "results": [
    {{
      "variant": "A",
      "type": "title/thumbnail",
      "content": "The tested content",
      "actual_ctr": 8.5,
      "predicted_ctr": 85,
      "impressions": 1250,
      "clicks": 106,
      "outcome": "won/lost/draw",
      "confidence": 0.87,
      "learnings": "What we learned from this variant"
    }}
  ],
  "winner": {{
    "title_variant": "B",
    "thumbnail_variant": "A",
    "improvement_pct": 12.5
  }},
  "next_test_recommendation": "What to test next based on these results",
  "pattern_insight": "Pattern discovered about this audience's preferences"
}}

Return ONLY valid JSON, no markdown."""
        result = router.generate(prompt, temperature=0.5, max_tokens=4096)
        data = self._safe_json(result)
        return {"output": data, "section_type": "ab_test_results"}
