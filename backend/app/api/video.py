import asyncio
import time
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from app.services.detector import detector_service

router = APIRouter(prefix="/api/video", tags=["Video Stream"])

async def frame_generator():
    while True:
        jpeg_bytes = detector_service.get_annotated_jpeg()
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
