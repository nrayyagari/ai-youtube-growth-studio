from agents.base import BaseAgent
from core.router import AIProviderRouter
import json


class ReferenceIntelligenceAgent(BaseAgent):
    name = "reference_intelligence"

    def process(self, channel: dict, inputs: dict, router: AIProviderRouter) -> dict:
        action = inputs.get("action", "analyze_patterns")
        if action == "detect_trends":
            return self._detect_trends(channel, inputs, router)
        return self._analyze_patterns(channel, inputs, router)

    def _detect_trends(self, channel: dict, inputs: dict, router: AIProviderRouter) -> dict:
        niche = channel.get("niche", "General")
        prompt = f"""You are a YouTube trend detection specialist for faceless channels.

Channel niche: {niche}
Target audience: {channel.get('audience', 'General')}

Identify 5 trending topics in this niche that would perform well as YouTube Shorts or medium-form content. For each trend:
- Explain why it's trending NOW
- Suggest an angle for faceless video format
- Estimate potential CTR and retention

Return JSON:
{{
  "trends": [
    {{
      "topic": "Trending topic name",
      "why_trending": "Explanation of the trend",
      "video_angle": "How to cover it faceless",
      "estimated_ctr": 85,
      "estimated_retention": 80,
      "urgency_score": 85,
      "content_format": "shorts/medium/long"
    }}
  ],
  "niche_insights": "Overall insight about current trends in this niche",
  "recommended_workflow": "Which workflow would work best for these trends"
}}

Scores 0-100. Return ONLY valid JSON, no markdown."""
        result = router.generate(prompt, temperature=0.8, max_tokens=4096)
        data = self._safe_json(result)
        return {"output": data, "section_type": "trending_topics"}

    def _analyze_patterns(self, channel: dict, inputs: dict, router: AIProviderRouter) -> dict:
        ref_videos = inputs.get("reference_videos", [])
        competitor_findings = inputs.get("competitor_findings", [])
        existing_patterns = inputs.get("existing_patterns", [])

        videos_text = ""
        for v in ref_videos[:5]:
            videos_text += f"- {v.get('title', '')}: {v.get('transcript', '')[:500]}\n"

        findings_text = json.dumps(competitor_findings[:3], default=str) if competitor_findings else "None"
        patterns_text = json.dumps(existing_patterns[:5], default=str) if existing_patterns else "None"

        prompt = f"""You are a YouTube pattern analysis AI for faceless content channels.

Channel: {channel.get('name', 'Unknown')}
Niche: {channel.get('niche', 'General')}
Audience: {channel.get('audience', 'General audience')}

Reference videos analyzed:
{videos_text if videos_text else 'No reference videos available'}

Competitor findings:
{findings_text}

Existing patterns:
{patterns_text}

Analyze the patterns and return new, actionable content patterns. For each pattern:
- Name the pattern (e.g., "Problem-Solution Hook", "Listicle Countdown", "Surprise Fact Opener")
- Describe the pattern structure step by step
- Estimate effectiveness score (0-100)
- Suggest when to use it (beginner/intermediate/advanced channel stage)

Return JSON:
{{
  "detected_patterns": [
    {{
      "pattern_name": "Name of pattern",
      "pattern_type": "hook/structure/visual/audio/engagement",
      "description": "Step-by-step description",
      "effectiveness_score": 85,
      "best_for_channel_stage": "beginner/intermediate/advanced",
      "example_application": "How to apply to {channel.get('niche', 'this')} channel",
      "estimated_ctr_impact": "+5%",
      "estimated_retention_impact": "+10%"
    }}
  ],
  "style_insights": "Key insights about content patterns that work",
  "gaps_identified": "Patterns competitors use that this channel doesn't",
  "recommended_next_patterns": ["pattern_name_1", "pattern_name_2"]
}}

Return ONLY valid JSON, no markdown."""
        result = router.generate(prompt, temperature=0.7, max_tokens=4096)
        data = self._safe_json(result)
        return {"output": data, "section_type": "pattern_analysis"}
