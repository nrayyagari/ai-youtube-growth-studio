from abc import ABC, abstractmethod
from core.router import AIProviderRouter


class BaseAgent(ABC):
    name: str = "base"

    @abstractmethod
    def process(self, channel: dict, inputs: dict, router: AIProviderRouter) -> dict:
        pass

    def _safe_json(self, text: str) -> dict:
        import json

        text = text.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            return {"raw_output": text}
