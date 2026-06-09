from agents.base import BaseAgent
from core.router import AIProviderRouter


class QAAgent(BaseAgent):
    name = "qa"

    def process(self, channel: dict, inputs: dict, router: AIProviderRouter) -> dict:
        script = str(inputs.get("script", ""))
        titles = str(inputs.get("titles", ""))
        thumbnail = str(inputs.get("thumbnail", ""))
        idea = str(inputs.get("idea", ""))
        correction = inputs.get("correction_prompt", "")
        correction_prefix = f"IMPORTANT CORRECTION INSTRUCTION: {correction}\n\n" if correction else ""
        banned_topics = channel.get("banned_topics", "[]")

        prompt = f"""{correction_prefix}You are a QA auditor for YouTube content. Check for copyright, monetization, factual, and quality issues.

Channel banned topics: {banned_topics}

Content to audit:
IDEA: {idea[:1000] if len(idea) > 1000 else idea}
SCRIPT: {script[:3000] if len(script) > 3000 else script}
TITLES: {titles[:1000] if len(titles) > 1000 else titles}
THUMBNAIL: {thumbnail[:1000] if len(thumbnail) > 1000 else thumbnail}

Checks to perform:
1. COPYRIGHT: Does any content copy existing YouTube videos? Does it quote copyrighted material excessively? Check script, titles, descriptions.
2. MONETIZATION: Is the content advertiser-friendly? Are there restricted/banned topics? Profanity, controversial topics, hate speech check.
3. FACTUAL ACCURACY: Are there any clearly false claims? Unsupported statistics?
4. SCRIPT QUALITY: Is the script cohesive, engaging, well-structured?
5. VISUAL CONSISTENCY: Do the visual suggestions make sense? Are they achievable for faceless content?

Return a JSON object:
{{
  "checks": [
    {{
      "type": "copyright",
      "score": 85,
      "status": "PASS",
      "details": "No copyright issues found. Content appears original.",
      "issues": []
    }},
    {{
      "type": "monetization",
      "score": 85,
      "status": "PASS",
      "details": "Content is advertiser-friendly.",
      "issues": []
    }},
    {{
      "type": "factual",
      "score": 85,
      "status": "PASS",
      "details": "No factual errors detected.",
      "issues": []
    }},
    {{
      "type": "script_quality",
      "score": 85,
      "status": "PASS",
      "details": "Script is well-structured and engaging.",
      "issues": []
    }},
    {{
      "type": "visual_consistency",
      "score": 85,
      "status": "PASS",
      "details": "Visual plan is coherent.",
      "issues": []
    }}
  ],
  "overall_qa_score": 85,
  "corrections_needed": [],
  "is_safe_to_publish": true
}}

IMPORTANT: 
- If copyright issues found: status="FAIL", score below 90
- If monetization issues: status="FAIL", score below 90  
- If factual errors: status="WARN" or "FAIL"
- Be strict about copyright — flag ANY potential issues
- Be strict about monetization — flag ANY restricted content
- Scores 0-100. Return ONLY valid JSON."""
        result = router.generate(prompt, temperature=0.3, max_tokens=4096)
        data = self._safe_json(result)
        return {"output": data, "section_type": "qa_report"}
