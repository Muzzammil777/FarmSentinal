import asyncio
import cv2
import time
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from app.services.detector import detector_service
from app.services.camera import camera_manager

router = APIRouter(prefix="/api/video", tags=["Video Stream"])

async def frame_generator():
    while True:
        jpeg_bytes = detector_service.get_annotated_jpeg()
        if not jpeg_bytes:
            # Fallback frame encoding if detector thread has not finished first inference loop
            frame = camera_manager.get_latest_frame()
            ret, buf = cv2.imencode(".jpg", frame, [int(cv2.IMWRITE_JPEG_QUALITY), 80])
            if ret:
                jpeg_bytes = buf.tobytes()

        if jpeg_bytes:
            yield (
                b"--frame\r\n"
                b"Content-Type: image/jpeg\r\n\r\n" + jpeg_bytes + b"\r\n"
            )
        await asyncio.sleep(0.04)  # ~25 FPS stream

@router.get("")
async def get_video_stream():
    return StreamingResponse(
        frame_generator(),
        media_type="multipart/x-mixed-replace; boundary=frame"
    )
