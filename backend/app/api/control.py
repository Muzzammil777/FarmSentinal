from fastapi import APIRouter
from app.models import ControlStateRequest, ControlResponse
from app.services.esp32 import esp32_service
from app.services.detector import detector_service
from app.config import settings_manager

router = APIRouter(prefix="/api/control", tags=["Controls"])

@router.post("/led", response_model=ControlResponse)
async def control_led(req: ControlStateRequest):
    if not req.state:
        detector_service.auto_intrusion_active = False
    success = await esp32_service.set_led(req.state, force=True)
    return ControlResponse(
        success=success,
        device="LED Flash",
        state=req.state,
        message=f"LED Flash turned {'ON' if req.state else 'OFF'}"
    )

@router.post("/buzzer", response_model=ControlResponse)
async def control_buzzer(req: ControlStateRequest):
    if not req.state:
        detector_service.auto_intrusion_active = False
    success = await esp32_service.set_buzzer(req.state, force=True)
    return ControlResponse(
        success=success,
        device="Acoustic Buzzer",
        state=req.state,
        message=f"Buzzer turned {'ON' if req.state else 'OFF'}"
    )

@router.get("/status")
async def get_control_status():
    return {
        "led": esp32_service.led_state,
        "buzzer": esp32_service.buzzer_state,
    }
