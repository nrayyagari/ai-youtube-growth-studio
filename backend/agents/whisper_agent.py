import os
import json
import tempfile
from pathlib import Path
from agents.base import BaseAgent
from core.router import AIProviderRouter


class WhisperAgent(BaseAgent):
    name = "whisper"

    def process(self, channel: dict, inputs: dict, router: AIProviderRouter) -> dict:
        action = inputs.get("action", "transcribe")
        audio_path = inputs.get("audio_path", "")
        video_url = inputs.get("video_url", "")
        language = inputs.get("language", "en")

        if action == "check_available":
            return self._check_availability()

        if audio_path:
            return self._transcribe_file(audio_path, language)

        if video_url:
            return self._transcribe_youtube(video_url, language)

        return {"output": {"error": "No audio_path or video_url provided"}, "section_type": "whisper_transcription"}

    def _check_availability(self) -> dict:
        methods = []
        try:
            import whisper
            methods.append("local_whisper")
        except ImportError:
            pass

        try:
            from openai import OpenAI
            methods.append("openai_api")
        except ImportError:
            pass

        return {
            "output": {
                "available_methods": methods,
                "local_whisper_available": "local_whisper" in methods,
                "openai_api_available": "openai_api" in methods,
                "recommended": methods[0] if methods else "none",
            },
            "section_type": "whisper_check",
        }

    def _transcribe_file(self, audio_path: str, language: str) -> dict:
        if not os.path.exists(audio_path):
            return {"output": {"error": f"Audio file not found: {audio_path}"}, "section_type": "whisper_transcription"}

        result = None
        method_used = ""

        try:
            import whisper
            model = whisper.load_model("tiny")
            transcribe_result = model.transcribe(audio_path, language=language if language != "auto" else None)
            result = {
                "text": transcribe_result.get("text", ""),
                "segments": [
                    {
                        "start": s.get("start", 0),
                        "end": s.get("end", 0),
                        "text": s.get("text", ""),
                    }
                    for s in transcribe_result.get("segments", [])
                ],
                "language": transcribe_result.get("language", language),
                "duration": transcribe_result.get("segments", [{}])[-1].get("end", 0) if transcribe_result.get("segments") else 0,
            }
            method_used = "local_whisper"
        except ImportError:
            try:
                from openai import OpenAI
                api_key = os.environ.get("OPENAI_API_KEY", "")
                if not api_key:
                    return {"output": {"error": "OPENAI_API_KEY not set. Set it in environment or use local whisper: pip install openai-whisper"}, "section_type": "whisper_transcription"}

                client = OpenAI(api_key=api_key)
                with open(audio_path, "rb") as f:
                    resp = client.audio.transcriptions.create(
                        model="whisper-1",
                        file=f,
                        language=language if language != "auto" else None,
                        response_format="verbose_json",
                    )
                result = {
                    "text": resp.text,
                    "segments": [
                        {"start": s.start, "end": s.end, "text": s.text}
                        for s in (resp.segments or [])
                    ],
                    "language": resp.language,
                    "duration": resp.duration if hasattr(resp, "duration") else 0,
                }
                method_used = "openai_api"
            except ImportError:
                return {"output": {"error": "No transcription method available. Install: pip install openai-whisper OR pip install openai"}, "section_type": "whisper_transcription"}

        if result:
            result["method_used"] = method_used
            result["word_count"] = len(result.get("text", "").split())
            result["status"] = "success"
            return {"output": result, "section_type": "whisper_transcription"}

        return {"output": {"error": "Transcription failed"}, "section_type": "whisper_transcription"}

    def _transcribe_youtube(self, video_url: str, language: str) -> dict:
        try:
            import yt_dlp
            import subprocess

            with tempfile.TemporaryDirectory() as tmpdir:
                audio_path = os.path.join(tmpdir, "audio.mp3")
                subprocess.run([
                    "yt-dlp", "-x", "--audio-format", "mp3",
                    "-o", audio_path, video_url,
                    "--quiet", "--no-warnings",
                ], check=True, timeout=120)

                if os.path.exists(audio_path):
                    return self._transcribe_file(audio_path, language)
                return {"output": {"error": "Failed to download audio"}, "section_type": "whisper_transcription"}
        except ImportError:
            return {
                "output": {
                    "error": "yt-dlp not installed. Run: pip install yt-dlp",
                    "text": "",
                    "method_used": "none",
                },
                "section_type": "whisper_transcription",
            }
        except Exception as e:
            return {"output": {"error": str(e)}, "section_type": "whisper_transcription"}
