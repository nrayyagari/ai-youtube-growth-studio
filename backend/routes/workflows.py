from fastapi import APIRouter

router = APIRouter(prefix="/api", tags=["workflows"])

DEFAULT_WORKFLOWS = [
    {
        "id": 1,
        "name": "AI Tool Explainer",
        "description": "Hook-driven explainers for AI tools and concepts",
    },
    {
        "id": 2,
        "name": "Facts / Curiosity",
        "description": "Surprising facts and curiosity-driven short content",
    },
    {
        "id": 3,
        "name": "Clean Faceless Productivity",
        "description": "Minimalist productivity and how-to content",
    },
]


@router.get("/workflows")
def list_workflows():
    return DEFAULT_WORKFLOWS


@router.get("/skills")
def list_skills(category: str | None = None):
    return []
