from fastapi import APIRouter
from app.models import DetectionResponse
from app.services.detector import detector_service

router = APIRouter(prefix="/api/detections", tags=["Detections"])

@router.get("", response_model=DetectionResponse)
async def get_detections():
    return detector_service.get_detection_status()
