from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from agents.whisper_agent import WhisperAgent

router = APIRouter(prefix="/api/whisper", tags=["whisper"])


class WhisperRequest(BaseModel):
    audio_path: str = ""
    video_url: str = ""
    language: str = "en"


@router.post("/transcribe")
def transcribe_audio(body: WhisperRequest):
    try:
        agent = WhisperAgent()
        result = agent.process({}, {
            "action": "transcribe",
            "audio_path": body.audio_path,
            "video_url": body.video_url,
            "language": body.language,
        }, None)
    except Exception as e:
        raise HTTPException(500, f"Transcription failed: {str(e)}")
    return result.get("output", {})


@router.get("/status")
def whisper_status():
    try:
        agent = WhisperAgent()
        result = agent.process({}, {"action": "check_available"}, None)
    except Exception as e:
        raise HTTPException(500, str(e))
    return result.get("output", {})
