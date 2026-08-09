from typing import Optional, List
from pydantic import BaseModel, Field

class SensorStatusResponse(BaseModel):
    distance: Optional[float] = Field(None, description="Distance in cm, or null if out of range/error")
    alert: bool = Field(False, description="True if distance <= threshold alert triggered")
    online: bool = Field(True, description="True if ESP8266 is reachable")

class DetectionResponse(BaseModel):
    detected: bool = Field(False, description="True if target or animal is currently detected")
    animal: Optional[str] = Field(None, description="Name of detected animal class")
    confidence: Optional[float] = Field(None, description="Detection confidence score between 0.0 and 1.0")
    timestamp: Optional[str] = Field(None, description="ISO timestamp of last detection frame")

class ControlStateRequest(BaseModel):
    state: bool = Field(..., description="Target hardware state: True for ON, False for OFF")

class ControlResponse(BaseModel):
    success: bool
    device: str
    state: bool
    message: str

class SettingsDTO(BaseModel):
    esp8266_ip: str
    camera_ip: str
    polling_interval_ms: int = Field(500, ge=100, le=5000)
    selected_animal: str
    auto_mode: bool
    confidence_threshold: float = Field(0.70, ge=0.50, le=0.90)
    camera_source: str = Field("demo", description="esp | webcam | demo")
    simulation_mode: bool = True

class LogEntry(BaseModel):
    id: str
    timestamp: str
    animal: Optional[str]
    confidence: Optional[float]
    distance: Optional[float]
    alert: bool
    led_state: bool
    buzzer_state: bool
    action_taken: str
