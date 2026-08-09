from fastapi import APIRouter
from app.models import SensorStatusResponse
from app.services.esp8266 import esp8266_service

router = APIRouter(prefix="/api/sensors", tags=["Sensors"])

@router.get("", response_model=SensorStatusResponse)
async def get_sensor_data():
    return esp8266_service.get_status()

@router.post("/reset")
async def reset_sensor():
    success = await esp8266_service.reset_sensor()
    return {"success": success, "message": "ESP8266 sensor alert reset"}
