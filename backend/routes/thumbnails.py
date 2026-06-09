import json
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from core.database import get_db
from core.router import AIProviderRouter
from agents.thumbnail_generator import ThumbnailGeneratorAgent

router = APIRouter(prefix="/api/thumbnails", tags=["thumbnails"])


class ThumbnailGenerateRequest(BaseModel):
    package_id: int
    concept_index: int = 0


@router.post("/generate")
def generate_thumbnail(body: ThumbnailGenerateRequest):
    conn = get_db()
    pkg = conn.execute("SELECT * FROM video_packages WHERE id = ?", (body.package_id,)).fetchone()
    if not pkg:
        conn.close()
        raise HTTPException(404, "Package not found")

    thumb_section = conn.execute(
        "SELECT * FROM package_sections WHERE package_id = ? AND section_type = 'thumbnail'",
        (body.package_id,),
    ).fetchone()
    conn.close()

    if not thumb_section:
        raise HTTPException(404, "No thumbnail concepts for this package. Generate the package first.")

    try:
        content = json.loads(thumb_section["content"])
        concepts = content.get("thumbnail_concepts", [])
        if not concepts:
            raise HTTPException(400, "No thumbnail concepts found in package")
        if body.concept_index >= len(concepts):
            raise HTTPException(400, f"Concept index {body.concept_index} out of range (0-{len(concepts)-1})")
        concept = concepts[body.concept_index]
    except json.JSONDecodeError:
        concept = {"concept_name": "default", "description": str(thumb_section["content"])[:200]}

    try:
        router = AIProviderRouter()
        agent = ThumbnailGeneratorAgent()
        result = agent.process({}, {
            "action": "generate",
            "concept": concept,
            "package_id": body.package_id,
        }, router)
    except Exception as e:
        raise HTTPException(500, f"Thumbnail generation failed: {str(e)}")

    output = result.get("output", {})

    if output.get("status") == "success":
        conn = get_db()
        conn.execute(
            "INSERT INTO thumbnail_images (package_id, concept_name, image_path, prompt_used, file_size_bytes) VALUES (?, ?, ?, ?, ?)",
            (body.package_id, output.get("concept_name", ""), output.get("image_path", ""),
             output.get("prompt_used", ""), output.get("file_size_bytes", 0)),
        )
        conn.commit()
        conn.close()

    return output


@router.get("/{package_id}")
def list_thumbnails(package_id: int):
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM thumbnail_images WHERE package_id = ? ORDER BY created_at DESC",
        (package_id,),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


@router.delete("/{image_id}")
def delete_thumbnail(image_id: int):
    conn = get_db()
    conn.execute("DELETE FROM thumbnail_images WHERE id = ?", (image_id,))
    conn.commit()
    conn.close()
    return {"status": "deleted"}
