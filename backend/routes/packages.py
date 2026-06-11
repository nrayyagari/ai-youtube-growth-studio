import json
import asyncio
from uuid import uuid4
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from core.auth import extract_user_id
from core.router import AIProviderRouter, AllProvidersExhausted
from core.pipeline import PipelineRunner, PipelineError

router = APIRouter(prefix="/api", tags=["packages"])


class GenerateRequest(BaseModel):
    topic: str = ""
    reference_url: str = ""
    api_keys: dict = {}
    channel: dict = {}


def _require_user(request: Request) -> str:
    user_id = extract_user_id(request)
    if not user_id:
        raise HTTPException(401, "Authentication required")
    return user_id


def _compact_section(section: dict) -> dict:
    output = section.get("output", {})
    score_value = 0
    if isinstance(output, dict):
        raw_score = output.get("score", 0)
        if isinstance(raw_score, dict):
            nested_scores = [
                value.get("score")
                for value in raw_score.values()
                if isinstance(value, dict) and isinstance(value.get("score"), (int, float))
            ]
            score_value = int(sum(nested_scores) / len(nested_scores)) if nested_scores else 0
        elif isinstance(raw_score, (int, float)):
            score_value = int(raw_score)
    return {
        "id": str(uuid4()),
        "agent": section.get("agent", ""),
        "section_type": section.get("section_type", ""),
        "content": output,
        "score": score_value,
    }


def _build_response(result: dict, reference_url: str = "") -> dict:
    package_id = result.get("id") or str(uuid4())
    topic = result.get("topic", "")
    sections = [_compact_section(section) for section in result.get("sections", [])]
    return {
        "id": package_id,
        "topic": topic,
        "sections": sections,
        "approval": result["approval"],
        "reference_used": bool(reference_url),
        "reference_url": reference_url or "",
        "created_at": result.get("created_at") or "",
    }


def _ensure_keys_present(api_keys: dict) -> None:
    normalized_keys = {}
    for key, value in api_keys.items():
        normalized = key.lower().removesuffix("_api_key")
        if normalized == "grok":
            normalized = "groq"
        if value:
            normalized_keys[normalized] = value
    if not normalized_keys:
        raise HTTPException(400, "At least one API key is required. Add it in Settings.")


@router.post("/generate")
def generate_package(body: GenerateRequest, request: Request):
    _require_user(request)
    _ensure_keys_present(body.api_keys)

    channel_dict = body.channel or {"niche": "General", "audience": "General", "language": "en"}

    try:
        ai_router = AIProviderRouter()
        ai_router.set_keys(body.api_keys)

        pipeline = PipelineRunner(ai_router)
        result = pipeline.run(channel_dict, body.topic, reference_url=body.reference_url or None)
    except PipelineError as e:
        raise HTTPException(500, f"Pipeline failed at {e.agent_name}: {e.detail}")
    except AllProvidersExhausted as e:
        raise HTTPException(429, str(e))

    return _build_response(result, body.reference_url)


class StreamGenerateRequest(BaseModel):
    topic: str = ""
    reference_url: str = ""
    api_keys: dict = {}
    channel: dict = {}


@router.post("/generate/stream")
async def generate_package_stream(body: StreamGenerateRequest, request: Request):
    _require_user(request)
    _ensure_keys_present(body.api_keys)

    channel_dict = body.channel or {"niche": "General", "audience": "General", "language": "en"}

    async def event_stream():
        queue = asyncio.Queue()

        def on_progress(event: dict):
            try:
                queue.put_nowait(event)
            except asyncio.QueueFull:
                pass

        ai_router = AIProviderRouter()
        ai_router.set_keys(body.api_keys)
        pipeline = PipelineRunner(ai_router)

        try:
            import concurrent.futures
            executor = concurrent.futures.ThreadPoolExecutor(max_workers=1)
            future = executor.submit(
                pipeline.run, channel_dict, body.topic,
                reference_url=body.reference_url or None,
                on_progress=on_progress,
            )

            while not future.done() or not queue.empty():
                try:
                    event = queue.get_nowait()
                    yield f"data: {json.dumps(event)}\n\n"
                except asyncio.QueueEmpty:
                    await asyncio.sleep(0.1)

            result = future.result()
            payload = {
                "agent": "complete",
                "status": "done",
                "package": _build_response(result, body.reference_url),
            }
            yield f"data: {json.dumps(payload)}\n\n"

        except PipelineError as e:
            yield f"data: {json.dumps({'agent': e.agent_name, 'status': 'error', 'error': e.detail})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'agent': 'pipeline', 'status': 'error', 'error': str(e)})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")
