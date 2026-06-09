from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from agents.tts_agent import TTSAgent

router = APIRouter(prefix="/api/tts", tags=["tts"])


class TTSRequest(BaseModel):
    script: str
    package_id: int | None = None
    voice: str = "en-US-JennyNeural"


@router.post("/generate")
def generate_narration(body: TTSRequest):
    if not body.script.strip():
        raise HTTPException(400, "Script text is required")

    try:
        agent = TTSAgent()
        result = agent.process({}, {
            "action": "generate_narration",
            "script": body.script,
            "package_id": body.package_id,
            "voice": body.voice,
        }, None)
    except Exception as e:
        raise HTTPException(500, f"TTS generation failed: {str(e)}")

    output = result.get("output", {})
    return {
        "mp3_path": output.get("mp3_path"),
        "srt_path": output.get("srt_path"),
        "file_size_bytes": output.get("file_size_bytes"),
        "voice_used": output.get("voice_used"),
        "word_count": output.get("word_count"),
        "status": output.get("status"),
        "error": output.get("error"),
    }


@router.get("/voices")
def list_tts_voices():
    try:
        agent = TTSAgent()
        result = agent.process({}, {"action": "list_voices"}, None)
    except Exception as e:
        raise HTTPException(500, str(e))
    return result.get("output", {})
