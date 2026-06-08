from datetime import datetime
from pathlib import Path
from uuid import uuid4

import cv2
import numpy as np


class CameraService:
    def __init__(self):
        self.output_dir = Path(__file__).resolve().parents[1] / "captures"
        self.output_dir.mkdir(exist_ok=True)

    def capture_image(self):
        camera = cv2.VideoCapture(0)
        if not camera.isOpened():
            return self._placeholder_capture()

        try:
            ok, frame = camera.read()
            if not ok:
                return self._placeholder_capture()

            filename = f"{datetime.utcnow().strftime('%Y%m%d%H%M%S')}-{uuid4().hex[:8]}.jpg"
            path = self.output_dir / filename
            cv2.imwrite(str(path), frame)
            return {"imageUrl": f"/captures/{filename}", "source": "camera"}
        finally:
            camera.release()

    def _placeholder_capture(self):
        filename = f"placeholder-{uuid4().hex[:8]}.jpg"
        path = self.output_dir / filename
        image = np.full((480, 640, 3), 255, dtype=np.uint8)
        cv2.putText(image, "Camera unavailable", (120, 230), cv2.FONT_HERSHEY_SIMPLEX, 1, (40, 40, 40), 2)
        cv2.imwrite(str(path), image)
        return {"imageUrl": f"/captures/{filename}", "source": "placeholder"}
