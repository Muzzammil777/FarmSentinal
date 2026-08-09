from typing import List
from fastapi import APIRouter
from app.models import LogEntry
from app.services.logger import logger_service

router = APIRouter(prefix="/api/logs", tags=["Logs"])

@router.get("", response_model=List[LogEntry])
async def get_intrusion_logs():
    return logger_service.get_logs()

@router.post("/clear")
async def clear_logs():
    logger_service.clear_logs()
    return {"success": True, "message": "Intrusion logs cleared"}
