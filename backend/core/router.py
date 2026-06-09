import time
import httpx
from collections import deque


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
            "db_key": "gemini_api_key",
        },
        "groq": {
            "model": "llama-3.3-70b-versatile",
            "rpm": 30,
            "endpoint": "https://api.groq.com/openai/v1/chat/completions",
            "db_key": "grok_api_key",
        },
        "cerebras": {
            "model": "llama3.3-70b",
            "rpm": 30,
            "endpoint": "https://api.cerebras.ai/v1/chat/completions",
            "db_key": "cerebras_api_key",
        },
    }

    def __init__(self):
        self.tracker = RateTracker()
        self.ordering = ["gemini", "groq", "cerebras"]

    @property
    def min_interval(self) -> float:
        lowest_rpm = min(
            (cfg["rpm"] for cfg in self.PROVIDERS.values() if cfg["rpm"] is not None),
            default=30,
        )
        return 60.0 / lowest_rpm

    def _get_db_keys(self, key_name: str) -> list[str]:
        from core.database import get_db

        conn = get_db()
        row = conn.execute("SELECT value FROM settings WHERE key = ?", (key_name,)).fetchone()
        conn.close()
        if not row or not row["value"]:
            return []
        return [k.strip() for k in row["value"].split(",") if k.strip()]

    def generate(self, prompt: str, system_prompt: str = "", temperature: float = 0.7, max_tokens: int = 4096, **kwargs) -> str:
        format_type = kwargs.get("format", "text")
        failures = []
        for name in self.ordering:
            cfg = self.PROVIDERS[name]
            api_keys = self._get_db_keys(cfg["db_key"])
            if not api_keys:
                failures.append(f"{name}: no API key configured")
                continue
            for api_key in api_keys:
                if not self.tracker.can_call(name, cfg["rpm"]):
                    continue
                try:
                    if format_type == "image" and name == "gemini":
                        result = self._call_gemini_image(cfg, api_key, prompt)
                    else:
                        result = self._call_provider(name, cfg, api_key, prompt, system_prompt, temperature, max_tokens)
                    self.tracker.record(name)
                    return result
                except Exception as e:
                    failures.append(f"{name}(key {api_key[:8]}...): {e}")
                    time.sleep(1)
                    continue
            failures.append(f"{name}: all {len(api_keys)} keys exhausted")
        raise AllProvidersExhausted(
            "All AI providers failed. Details: " + "; ".join(failures)
        )

    def _call_gemini_image(self, cfg: dict, api_key: str, prompt: str) -> str:
        url = cfg["endpoint"].replace("{model}", cfg["model"]).replace("generateContent", "generateContent")
        url += f"?key={api_key}"
        body = {
            "contents": [{"parts": [{"text": prompt}], "role": "user"}],
            "generationConfig": {
                "responseModalities": ["Text", "Image"],
                "temperature": 0.9,
            },
        }
        r = httpx.post(url, json=body, timeout=120)
        if not r.is_success:
            err = r.json().get("error", {}).get("message", r.text[:200])
            raise Exception(f"HTTP {r.status_code}: {err}")

        data = r.json()
        candidates = data.get("candidates", [])
        if not candidates:
            return ""

        content = candidates[0].get("content", {})
        parts = content.get("parts", [])

        for part in parts:
            if "inlineData" in part:
                inline = part["inlineData"]
                if inline.get("mimeType", "").startswith("image/"):
                    b64 = inline.get("data", "")
                    return f"data:{inline['mimeType']};base64,{b64}"
            if "text" in part and not part.get("text", "").strip():
                continue

        text_parts = [p.get("text", "") for p in parts if "text" in p]
        return "\n".join(text_parts) if text_parts else ""

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
        if not r.is_success:
            err = r.json().get("error", {}).get("message", r.text[:200])
            raise Exception(f"HTTP {r.status_code}: {err}")
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
        if not r.is_success:
            err = r.json().get("message", r.json().get("error", r.text[:200]))
            if isinstance(err, dict):
                err = err.get("message", str(err))
            raise Exception(f"HTTP {r.status_code}: {err}")
        data = r.json()
        return data["choices"][0]["message"]["content"]
