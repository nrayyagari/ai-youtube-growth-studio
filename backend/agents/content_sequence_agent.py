from agents.base import BaseAgent
from core.router import AIProviderRouter
import json


class ContentSequenceAgent(BaseAgent):
    name = "content_sequence"

    def process(self, channel: dict, inputs: dict, router: AIProviderRouter) -> dict:
        videos = inputs.get("videos", [])
        channel_stats = inputs.get("channel_stats", {})
        analytics = inputs.get("analytics", {})
        niche = channel.get("niche", "General")
        audience = channel.get("audience", "General")
        language = channel.get("language", "en")

        top_videos_text = ""
        for v in videos[:10]:
            top_videos_text += (
                f"- {v.get('title', 'Untitled')} | "
                f"Views: {v.get('views', 0)} | "
                f"Watch min: {v.get('watch_minutes', 0)} | "
                f"Avg duration: {v.get('avg_duration', 0)}s\n"
            )

        prompt = f"""You are a YouTube content strategist. Analyze the channel's performance data and suggest the next 5 video topics that would perform best.

Channel Profile:
- Niche: {niche}
- Audience: {audience}
- Language: {language}

Channel Stats:
- Subscribers: {channel_stats.get('subscribers', 'N/A')}
- Total views: {channel_stats.get('total_views', 'N/A')}
- Video count: {channel_stats.get('video_count', 'N/A')}

Analytics (last 30 days):
- Total views: {analytics.get('total_views', 'N/A')}
- Total watch minutes: {analytics.get('total_watch_minutes', 'N/A')}
- Avg view duration: {analytics.get('avg_view_duration_seconds', 'N/A')}s
- Avg view percentage: {analytics.get('avg_view_percentage', 'N/A')}%
- Net subscribers: {analytics.get('subscribers_net', 'N/A')}

Top Performing Videos (last 30 days):
{top_videos_text if top_videos_text else 'No video data available'}

Analyze which topics, formats, and angles are working. Then suggest 5 next topics that:
1. Double down on what's already working (similar topics, formats)
2. Fill gaps the audience wants but you haven't covered
3. Have high search volume potential in this niche
4. Match the channel's best-performing style and length

Return a JSON object:
{{
  "suggestions": [
    {{
      "topic": "Video topic idea",
      "reasoning": "Why this will perform well based on analytics",
      "estimated_views": 5000,
      "estimated_ctr": 8.5,
      "estimated_retention": 65,
      "suggested_length_seconds": 480,
      "format": "tutorial/opinion/listicle/case-study",
      "urgency": "high/medium/low",
      "source_insight": "What data point drove this suggestion (e.g. 'Your 'how-to' videos get 2x more retention')"
    }}
  ],
  "overall_strategy": "Summary of content strategy direction",
  "gap_analysis": "Topics or formats the channel is missing",
  "risk_factors": "What could go wrong with these suggestions",
  "score": {{
    "data_quality": {{"score": 85, "explanation": "How reliable the analytics data is"}},
    "strategy_coherence": {{"score": 85, "explanation": "How well suggestions align with channel strengths"}}
  }}
}}

Scores 0-100. Return ONLY valid JSON, no markdown."""
        result = router.generate(prompt, temperature=0.8, max_tokens=4096)
        data = self._safe_json(result)
        return {"output": data, "section_type": "content_sequence"}
