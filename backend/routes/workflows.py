import json
from fastapi import APIRouter

from core.database import get_db

router = APIRouter(prefix="/api", tags=["workflows"])


@router.get("/workflows")
def list_workflows():
    conn = get_db()
    workflows = conn.execute("SELECT * FROM workflows ORDER BY id").fetchall()
    result = []
    for w in workflows:
        wd = dict(w)
        skills = conn.execute(
            """SELECT s.*, ws.execution_order FROM skills s
               JOIN workflow_skills ws ON ws.skill_id = s.id
               WHERE ws.workflow_id = ?
               ORDER BY ws.execution_order""",
            (w["id"],),
        ).fetchall()
        wd["skills"] = [dict(s) for s in skills]
        wd["qa_checklist"] = json.loads(wd["qa_checklist"]) if wd.get("qa_checklist") else []
        wd["scoring_rules"] = json.loads(wd["scoring_rules"]) if wd.get("scoring_rules") else {}
        result.append(wd)
    conn.close()
    return result


@router.get("/skills")
def list_skills(category: str | None = None):
    conn = get_db()
    if category:
        rows = conn.execute("SELECT * FROM skills WHERE category = ? ORDER BY name", (category,)).fetchall()
    else:
        rows = conn.execute("SELECT * FROM skills ORDER BY category, name").fetchall()
    conn.close()
    return [dict(r) for r in rows]
