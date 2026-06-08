from abc import ABC, abstractmethod
from core.router import AIProviderRouter


class BaseAgent(ABC):
    name: str = "base"

    @abstractmethod
    def process(self, channel: dict, inputs: dict, router: AIProviderRouter) -> dict:
        pass

    def _safe_json(self, text: str) -> dict:
        import json
        import re

        text = text.strip()

        # Fix common LLM JSON mistakes
        # 1. \' (unescaped apostrophe) → '
        text = text.replace("\\'", "'")

        # Try lenient parse first (handles literal newlines in strings)
        try:
            decoder = json.JSONDecoder(strict=False)
            result, _ = decoder.raw_decode(text)
            return result
        except json.JSONDecodeError:
            pass

        # Aggressive markdown fence removal
        cleaned = text
        for fence in ["```json", "```javascript", "```"]:
            if cleaned.startswith(fence):
                cleaned = cleaned[len(fence):]
                break
        cleaned = cleaned.strip()
        for fence in ["```json", "```javascript", "```"]:
            if cleaned.endswith(fence):
                cleaned = cleaned[:-len(fence)]
                break
        cleaned = cleaned.strip()

        try:
            decoder = json.JSONDecoder(strict=False)
            result, _ = decoder.raw_decode(cleaned)
            return result
        except json.JSONDecodeError:
            pass

        # Try extracting JSON object from the text (find first { to last })
        match = re.search(r'\{.*\}', text, re.DOTALL)
        if match:
            try:
                decoder = json.JSONDecoder(strict=False)
                result, _ = decoder.raw_decode(match.group(0))
                return result
            except json.JSONDecodeError:
                pass

        return {"raw_output": text}
