import time
import httpx
from collections import deque
from core.config import settings


class AllProvidersExhausted(Exception):
    pass


class RateTracker:
    def __init__(self, window_seconds: int = 60):
        self.window = window_seconds
        self.calls: dict[str, deque] = {}

    def can_call(self, provider: str, max_rpm: int) -> bool:
        if max_rpm is None:
            return True
        now = time.time()
        if provider not in self.calls:
            self.calls[provider] = deque()
        q = self.calls[provider]
        while q and q[0] < now - self.window:
            q.popleft()
        return len(q) < max_rpm

    def record(self, provider: str):
        if provider not in self.calls:
            self.calls[provider] = deque()
        self.calls[provider].append(time.time())


class AIProviderRouter:
    PROVIDERS = {
        "gemini": {
            "model": "gemini-2.0-flash",
            "rpm": 15,
            "endpoint": "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
            "key_field": "gemini_api_key",
        },
        "grok": {
            "model": "grok-2-1212",
            "rpm": 60,
            "endpoint": "https://api.x.ai/v1/chat/completions",
            "key_field": "grok_api_key",
        },
        "cerebras": {
            "model": "llama3.1-8b",
            "rpm": 30,
            "endpoint": "https://api.cerebras.ai/v1/chat/completions",
            "key_field": "cerebras_api_key",
        },
    }

    def __init__(self):
        self.tracker = RateTracker()
        self.ordering = ["gemini", "grok", "cerebras"]

    def generate(self, prompt: str, system_prompt: str = "", temperature: float = 0.7, max_tokens: int = 4096) -> str:
        for name in self.ordering:
            cfg = self.PROVIDERS[name]
            api_key = getattr(settings, cfg["key_field"], "")
            if not api_key:
                continue
            if not self.tracker.can_call(name, cfg["rpm"]):
                continue
            try:
                result = self._call_provider(name, cfg, api_key, prompt, system_prompt, temperature, max_tokens)
                self.tracker.record(name)
                return result
            except Exception:
                continue
        raise AllProvidersExhausted("All AI providers are rate-limited or unavailable. Try again soon.")

    def _call_provider(self, name: str, cfg: dict, api_key: str, prompt: str, system_prompt: str, temperature: float, max_tokens: int) -> str:
        if name == "gemini":
            return self._call_gemini(cfg, api_key, prompt, system_prompt, temperature, max_tokens)
        return self._call_openai_compatible(cfg, api_key, prompt, system_prompt, temperature, max_tokens)

    def _call_gemini(self, cfg: dict, api_key: str, prompt: str, system_prompt: str, temperature: float, max_tokens: int) -> str:
        url = cfg["endpoint"].replace("{model}", cfg["model"])
        url += f"?key={api_key}"
        contents = []
        if system_prompt:
            contents.append({"parts": [{"text": system_prompt}], "role": "user"})
        contents.append({"parts": [{"text": prompt}], "role": "user"})
        body = {
            "contents": contents,
            "generationConfig": {"temperature": temperature, "maxOutputTokens": max_tokens},
        }
        r = httpx.post(url, json=body, timeout=60)
        r.raise_for_status()
        data = r.json()
        return data["candidates"][0]["content"]["parts"][0]["text"]

    def _call_openai_compatible(self, cfg: dict, api_key: str, prompt: str, system_prompt: str, temperature: float, max_tokens: int) -> str:
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})
        body = {
            "model": cfg["model"],
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
        r = httpx.post(cfg["endpoint"], json=body, headers=headers, timeout=60)
        r.raise_for_status()
        data = r.json()
        return data["choices"][0]["message"]["content"]
