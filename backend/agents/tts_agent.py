import os
import json
import asyncio
import tempfile
from pathlib import Path
from agents.base import BaseAgent
from core.router import AIProviderRouter


class TTSAgent(BaseAgent):
    name = "tts"

    def process(self, channel: dict, inputs: dict, router: AIProviderRouter) -> dict:
        action = inputs.get("action", "generate_narration")
        script = inputs.get("script", "")
        package_id = inputs.get("package_id")
        voice = inputs.get("voice", "en-US-JennyNeural")
        output_dir = inputs.get("output_dir", "data/audio")

        if not script:
            return {"output": {"error": "No script provided"}, "section_type": "tts_narration"}

        if action == "list_voices":
            return self._list_voices()

        return self._generate_narration(script, voice, output_dir, package_id)

    def _list_voices(self) -> dict:
        try:
            import edge_tts
            voices = asyncio.run(edge_tts.list_voices())
            english = [v for v in voices if v.get("Locale", "").startswith("en-")]
            return {
                "output": {
                    "voices": [{"name": v["ShortName"], "locale": v["Locale"], "gender": v.get("Gender", "Unknown")} for v in english[:20]],
                    "total_english_voices": len(english),
                },
                "section_type": "tts_voices",
            }
        except ImportError:
            return {"output": {"error": "edge_tts not installed. Run: pip install edge-tts"}, "section_type": "tts_voices"}

    def _generate_narration(self, script: str, voice: str, output_dir: str, package_id) -> dict:
        try:
            import edge_tts
            from edge_tts import Communicate
        except ImportError:
            return {"output": {"error": "edge_tts not installed"}, "section_type": "tts_narration"}

        os.makedirs(output_dir, exist_ok=True)
        suffix = f"_{package_id}" if package_id else ""
        mp3_path = os.path.join(output_dir, f"narration{suffix}.mp3")
        srt_path = os.path.join(output_dir, f"narration{suffix}.srt")

        async def _generate():
            communicate = Communicate(script, voice)
            submaker = edge_tts.SubMaker()
            with open(mp3_path, "wb") as mp3_file:
                async for chunk in communicate.stream():
                    if chunk["type"] == "audio":
                        mp3_file.write(chunk["data"])
                    elif chunk["type"] == "WordBoundary":
                        submaker.create_sub((chunk["offset"], chunk["duration"]), chunk["text"])

            with open(srt_path, "w", encoding="utf-8") as srt_file:
                srt_file.write(submaker.generate_subs())

        try:
            asyncio.run(_generate())
            file_size = os.path.getsize(mp3_path)

            return {
                "output": {
                    "mp3_path": mp3_path,
                    "srt_path": srt_path,
                    "file_size_bytes": file_size,
                    "voice_used": voice,
                    "word_count": len(script.split()),
                    "status": "success",
                },
                "section_type": "tts_narration",
            }
        except Exception as e:
            return {
                "output": {
                    "error": str(e),
                    "status": "failure",
                },
                "section_type": "tts_narration",
            }
