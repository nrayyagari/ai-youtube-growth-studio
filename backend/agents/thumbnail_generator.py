from agents.base import BaseAgent
from core.router import AIProviderRouter
import os
import json
import base64
from datetime import datetime


class ThumbnailGeneratorAgent(BaseAgent):
    name = "thumbnail_generator"

    def process(self, channel: dict, inputs: dict, router: AIProviderRouter) -> dict:
        action = inputs.get("action", "generate")
        concept = inputs.get("concept", {})
        package_id = inputs.get("package_id", 0)
        output_dir = inputs.get("output_dir", "data/thumbnails")

        if action == "generate" and concept:
            return self._generate_thumbnail(concept, package_id, output_dir, router)

        return {"output": {"error": "No concept provided"}, "section_type": "thumbnail_generation"}

    def _generate_thumbnail(self, concept: dict, package_id, output_dir: str, router: AIProviderRouter) -> dict:
        os.makedirs(output_dir, exist_ok=True)

        prompt = f"""Create a professional YouTube thumbnail image in 16:9 aspect ratio (1280x720).
Style: faceless YouTube channel, high contrast, visually striking, modern design.
DO NOT include any text or words in the image.
Color scheme: {concept.get('color_scheme', 'vibrant high contrast')}
Layout: {concept.get('layout', 'center-focused')}
Visual description: {concept.get('description', 'Eye-catching YouTube thumbnail')}
Emotional tone: {concept.get('emotional_trigger', 'curiosity')}"""

        result = router.generate(prompt, temperature=0.9, max_tokens=256, format="image")

        if not result or (isinstance(result, str) and len(result) < 100):
            return {
                "output": {
                    "error": "Image generation returned no data. Gemini Imagen may not be available.",
                    "status": "failure",
                    "concept_name": concept.get("concept_name", "unknown"),
                },
                "section_type": "thumbnail_generation",
            }

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"pkg{package_id}_{concept.get('concept_name', 'thumb').replace(' ', '_')}_{timestamp}.png"
        filepath = os.path.join(output_dir, filename)

        try:
            if isinstance(result, str) and result.startswith("data:image"):
                header, encoded = result.split(",", 1)
                with open(filepath, "wb") as f:
                    f.write(base64.b64decode(encoded))
            elif isinstance(result, bytes):
                with open(filepath, "wb") as f:
                    f.write(result)
            elif isinstance(result, str) and len(result) > 100:
                with open(filepath, "w") as f:
                    f.write(result)
            else:
                return {
                    "output": {
                        "error": f"Unrecognized image format: {str(result)[:100]}",
                        "status": "failure",
                    },
                    "section_type": "thumbnail_generation",
                }

            size = os.path.getsize(filepath)
            return {
                "output": {
                    "image_path": filepath,
                    "file_size_bytes": size,
                    "concept_name": concept.get("concept_name", "unknown"),
                    "prompt_used": prompt[:500],
                    "status": "success" if size > 100 else "failure",
                },
                "section_type": "thumbnail_generation",
            }
        except Exception as e:
            return {
                "output": {
                    "error": str(e),
                    "status": "failure",
                },
                "section_type": "thumbnail_generation",
            }
