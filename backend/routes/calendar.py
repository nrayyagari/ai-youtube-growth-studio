import json
from datetime import date, timedelta
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from core.database import get_db
from core.router import AIProviderRouter, AllProvidersExhausted
from core.pipeline import PipelineRunner, PipelineError

router = APIRouter(prefix="/api", tags=["calendar"])


class CalendarEntryCreate(BaseModel):
    channel_id: int | None = None
    package_id: int | None = None
    scheduled_date: str
    slot_name: str = ""
    notes: str = ""


class SlotCreate(BaseModel):
    day_of_week: int
    hour: int
    label: str = ""


class BatchGenerateRequest(BaseModel):
    channel_id: int
    workflow_id: int
    topics: list[str]
    schedule_days: int = 7


@router.post("/calendar")
def add_calendar_entry(body: CalendarEntryCreate):
    conn = get_db()
    if body.channel_id:
        channel = conn.execute("SELECT id FROM channels WHERE id = ?", (body.channel_id,)).fetchone()
        if not channel:
            conn.close()
            raise HTTPException(404, "Channel not found")
        channel_id = channel["id"]
    else:
        channel = conn.execute("SELECT id FROM channels LIMIT 1").fetchone()
        if not channel:
            conn.close()
            raise HTTPException(400, "No channels exist")
        channel_id = channel["id"]

    cursor = conn.execute(
        "INSERT INTO content_calendar (channel_id, package_id, scheduled_date, slot_name, notes) VALUES (?, ?, ?, ?, ?)",
        (channel_id, body.package_id, body.scheduled_date, body.slot_name, body.notes),
    )
    conn.commit()
    eid = cursor.lastrowid
    conn.close()
    return {"id": eid, "channel_id": channel_id, "scheduled_date": body.scheduled_date}


@router.get("/calendar")
def list_calendar(channel_id: int | None = None, from_date: str | None = None, to_date: str | None = None):
    conn = get_db()
    query = "SELECT cc.*, vp.status as package_status FROM content_calendar cc LEFT JOIN video_packages vp ON vp.id = cc.package_id"
    params = []
    conditions = []
    if channel_id:
        conditions.append("cc.channel_id = ?")
        params.append(channel_id)
    if from_date:
        conditions.append("cc.scheduled_date >= ?")
        params.append(from_date)
    if to_date:
        conditions.append("cc.scheduled_date <= ?")
        params.append(to_date)
    if conditions:
        query += " WHERE " + " AND ".join(conditions)
    query += " ORDER BY cc.scheduled_date ASC"
    rows = conn.execute(query, params).fetchall()
    conn.close()
    return [dict(r) for r in rows]


@router.delete("/calendar/{entry_id}")
def delete_calendar_entry(entry_id: int):
    conn = get_db()
    conn.execute("DELETE FROM content_calendar WHERE id = ?", (entry_id,))
    conn.commit()
    conn.close()
    return {"status": "deleted"}


@router.post("/publishing-slots")
def add_publishing_slot(body: SlotCreate):
    conn = get_db()
    channel = conn.execute("SELECT id FROM channels LIMIT 1").fetchone()
    if not channel:
        conn.close()
        raise HTTPException(400, "No channels configured")
    cursor = conn.execute(
        "INSERT INTO publishing_slots (channel_id, day_of_week, hour, label) VALUES (?, ?, ?, ?)",
        (channel["id"], body.day_of_week, body.hour, body.label),
    )
    conn.commit()
    sid = cursor.lastrowid
    conn.close()
    return {"id": sid}


@router.get("/publishing-slots")
def list_publishing_slots(channel_id: int | None = None):
    conn = get_db()
    if channel_id:
        rows = conn.execute(
            "SELECT * FROM publishing_slots WHERE channel_id = ? ORDER BY day_of_week, hour",
            (channel_id,),
        ).fetchall()
    else:
        rows = conn.execute("SELECT * FROM publishing_slots ORDER BY day_of_week, hour").fetchall()
    conn.close()
    return [dict(r) for r in rows]


@router.delete("/publishing-slots/{slot_id}")
def delete_publishing_slot(slot_id: int):
    conn = get_db()
    conn.execute("DELETE FROM publishing_slots WHERE id = ?", (slot_id,))
    conn.commit()
    conn.close()
    return {"status": "deleted"}


@router.post("/generate/batch")
def batch_generate(body: BatchGenerateRequest):
    conn = get_db()
    channel = conn.execute("SELECT * FROM channels WHERE id = ?", (body.channel_id,)).fetchone()
    if not channel:
        conn.close()
        raise HTTPException(404, "Channel not found")
    workflow = conn.execute("SELECT * FROM workflows WHERE id = ?", (body.workflow_id,)).fetchone()
    if not workflow:
        conn.close()
        raise HTTPException(404, "Workflow not found")
    slots = conn.execute(
        "SELECT * FROM publishing_slots WHERE channel_id = ? ORDER BY day_of_week, hour",
        (body.channel_id,),
    ).fetchall()
    conn.close()

    channel_dict = dict(channel)
    results = []

    for i, topic in enumerate(body.topics):
        try:
            router = AIProviderRouter()
            pipeline = PipelineRunner(router)
            result = pipeline.run(channel_dict, topic)
        except AllProvidersExhausted as e:
            result = {"error": str(e), "sections": []}

        status = result.get("approval", {}).get("status", "ERROR")
        conn2 = get_db()
        cursor = conn2.execute(
            "INSERT INTO video_packages (channel_id, workflow_id, status) VALUES (?, ?, ?)",
            (body.channel_id, body.workflow_id, status),
        )
        package_id = cursor.lastrowid

        if "sections" in result:
            for section in result["sections"]:
                section_type = section.get("section_type", "")
                content = json.dumps(section.get("output", {}))
                scores = result["approval"].get("scores", {})
                score = 0
                if section_type == "idea":
                    score = scores.get("growth_score", 0)
                elif section_type == "script":
                    score = scores.get("script_score", 0)
                elif section_type == "titles":
                    score = scores.get("title_score", 0)
                elif section_type == "thumbnail":
                    score = scores.get("thumbnail_score", 0)
                elif section_type == "music":
                    score = scores.get("music_score", 0)
                elif section_type == "qa_report":
                    score = scores.get("qa_overall", 0)
                conn2.execute(
                    "INSERT INTO package_sections (package_id, section_type, content, score) VALUES (?, ?, ?, ?)",
                    (package_id, section_type, content, score),
                )

        if i < len(slots) and body.schedule_days > 0:
            slot = slots[i % len(slots)]
            target_date = date.today() + timedelta(days=body.schedule_days + slot["day_of_week"])
            target_date = target_date + timedelta(days=(slot["day_of_week"] - target_date.weekday()) % 7)
            conn2.execute(
                "INSERT INTO content_calendar (channel_id, package_id, scheduled_date, slot_name, notes) VALUES (?, ?, ?, ?, ?)",
                (body.channel_id, package_id, target_date.isoformat(), slot["label"], f"Batch generated: {topic}"),
            )

        conn2.commit()
        conn2.close()
        results.append({"package_id": package_id, "topic": topic, "status": status})

    return {"generated": len(results), "results": results}
