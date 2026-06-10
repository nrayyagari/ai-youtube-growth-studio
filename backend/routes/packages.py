import json
import asyncio
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from core.database import get_db
from core.router import AIProviderRouter, AllProvidersExhausted
from core.pipeline import PipelineRunner, PipelineError

router = APIRouter(prefix="/api", tags=["packages"])


class GenerateRequest(BaseModel):
    topic: str = ""
    reference_url: str = ""
    api_keys: dict = {}
    channel: dict = {}


@router.post("/generate")
def generate_package(body: GenerateRequest):
    if not body.api_keys:
        raise HTTPException(400, "At least one API key is required. Add it in Settings.")

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

    conn = get_db()
    conn.execute(
        "INSERT INTO usage_stats (event_type, metadata) VALUES (?, ?)",
        ("package_generated", json.dumps({"has_reference": bool(body.reference_url)})),
    )
    conn.commit()
    conn.close()

    return {
        "sections": result["sections"],
        "approval": result["approval"],
        "reference_used": bool(body.reference_url),
    }


class StreamGenerateRequest(BaseModel):
    topic: str = ""
    reference_url: str = ""
    api_keys: dict = {}
    channel: dict = {}


@router.post("/generate/stream")
async def generate_package_stream(body: StreamGenerateRequest):
    if not body.api_keys:
        raise HTTPException(400, "At least one API key is required.")

    channel_dict = body.channel or {"niche": "General", "audience": "General", "language": "en"}

    async def event_stream():
        queue = asyncio.Queue()

        def on_progress(event: dict):
            try:
                queue.put_nowait(event)
            except asyncio.QueueFull:
                pass

        pipeline = PipelineRunner(AIProviderRouter())

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

            conn = get_db()
            conn.execute(
                "INSERT INTO usage_stats (event_type, metadata) VALUES (?, ?)",
                ("package_generated", json.dumps({"has_reference": bool(body.reference_url)})),
            )
            conn.commit()
            conn.close()

            yield f"data: {json.dumps({
                'agent': 'complete', 'status': 'done',
                'sections': result['sections'],
                'approval': result['approval'],
                'reference_used': bool(body.reference_url),
            })}\n\n"

        except PipelineError as e:
            yield f"data: {json.dumps({'agent': e.agent_name, 'status': 'error', 'error': e.detail})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'agent': 'pipeline', 'status': 'error', 'error': str(e)})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")
