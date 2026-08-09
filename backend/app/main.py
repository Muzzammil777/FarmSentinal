import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import sensors, detections, video, control, settings, logs
from app.services.camera import camera_manager
from app.services.esp8266 import esp8266_service
from app.services.detector import detector_service

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("FarmSentinal")

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("FarmSentinal Backend starting up...")
    camera_manager.start()
    await esp8266_service.start_polling()
    detector_service.start()
    yield
    logger.info("FarmSentinal Backend shutting down...")
    detector_service.stop()
    await esp8266_service.stop_polling()
    camera_manager.stop()

app = FastAPI(
    title="FarmSentinal AI Intrusion Monitoring API",
    description="Bridge backend between ESP hardware sensors, YOLOv8 AI inference, and React Dashboard.",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(sensors.router)
app.include_router(detections.router)
app.include_router(video.router)
app.include_router(control.router)
app.include_router(settings.router)
app.include_router(logs.router)

@app.get("/")
async def root():
    return {
        "system": "FarmSentinal Bridge Server",
        "status": "online",
        "version": "1.0.0",
        "docs_url": "/docs"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
