from __future__ import annotations

import os
import time
from dataclasses import asdict, dataclass
from enum import Enum
from itertools import chain
from threading import Event, Lock, Thread
from typing import Any

os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = "timeout;5000000|rw_timeout;5000000|stimeout;5000000"

import cv2
import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel
from ultralytics import YOLO


ALLOWED_ANIMAL_CLASSES = {
    "elephant",
}

BOUNDARY = "frame"
RECONNECT_DELAYS = [1, 2, 4, 8, 8]


class SourceType(str, Enum):
    webcam = "webcam"
    esp32_cam = "esp32_cam"


class SourceUpdate(BaseModel):
    type: SourceType
    url: str | None = None
    index: int = 0


class DetectionControl(BaseModel):
    enabled: bool


@dataclass(slots=True)
class SourceConfig:
    type: SourceType = SourceType.webcam
    url: str | None = None
    index: int = 0


@dataclass(slots=True)
class DetectionRecord:
    label: str
    confidence: float
    bounding_box: dict[str, int]


@dataclass(slots=True)
class Snapshot:
    source: SourceConfig
    detections: list[DetectionRecord]
    frame_bytes: bytes | None
    annotated_width: int
    annotated_height: int
    processed_at: float
    frame_index: int
    online: bool
    status: str
    detection_enabled: bool


def _env_bool(name: str, default: bool) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


class CameraService:
    def __init__(self) -> None:
        self._lock = Lock()
        self._stop_event = Event()
        self._capture: cv2.VideoCapture | None = None
        self._capture_signature: tuple[SourceType, str | int | None] | None = None
        self._thread: Thread | None = None
        self._last_capture_attempt = 0.0
        self._capture_retry_interval = float(os.getenv("CAMERA_RETRY_INTERVAL", "1.5"))
        self._read_failures = 0
        self._frame_index = 0
        self._source = SourceConfig(
            type=SourceType(os.getenv("CAMERA_SOURCE_TYPE", SourceType.webcam.value)),
            url=os.getenv("ESP32_STREAM_URL") or None,
            index=int(os.getenv("WEBCAM_INDEX", "0")),
        )
        self._detection_enabled = _env_bool("CAMERA_START_ENABLED", default=False)
        initial_status = "offline" if self._detection_enabled else "stopped"
        self._snapshot = Snapshot(
            source=self._source,
            detections=[],
            frame_bytes=None,
            annotated_width=0,
            annotated_height=0,
            processed_at=0.0,
            frame_index=0,
            online=False,
            status=initial_status,
            detection_enabled=self._detection_enabled,
        )
        self._model = YOLO(os.getenv("YOLO_MODEL_PATH", "yolov8n.pt"))
        self._confidence_threshold = float(os.getenv("YOLO_CONFIDENCE", "0.2"))
        self._allowed_labels = self._load_allowed_labels()
        self._process_delay = float(os.getenv("CAMERA_FRAME_DELAY", "0.03"))

    def _load_allowed_labels(self) -> set[str] | None:
        raw = os.getenv("ALLOWED_CLASSES")
        if raw is None:
            return {label.lower() for label in ALLOWED_ANIMAL_CLASSES}

        cleaned = raw.strip().lower()
        if cleaned in {"", "all", "*"}:
            return None

        return {item.strip() for item in cleaned.split(",") if item.strip()}

    def start(self) -> None:
        if self._thread and self._thread.is_alive():
            return

        self._stop_event.clear()
        self._thread = Thread(target=self._processing_loop, name="camera-service", daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._stop_event.set()
        self._release_capture()
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=2.0)

    def get_snapshot(self) -> Snapshot:
        with self._lock:
            return self._copy_snapshot()

    def get_source(self) -> SourceConfig:
        with self._lock:
            return SourceConfig(type=self._source.type, url=self._source.url, index=self._source.index)

    def set_source(self, source_update: SourceUpdate) -> Snapshot:
        with self._lock:
            if source_update.type == SourceType.esp32_cam and not source_update.url:
                raise HTTPException(status_code=400, detail="ESP32-CAM source requires a stream URL.")

            self._source = SourceConfig(type=source_update.type, url=source_update.url, index=source_update.index)
            self._frame_index = 0
            self._release_capture()
            self._snapshot = Snapshot(
                source=self._source,
                detections=self._snapshot.detections,
                frame_bytes=self._snapshot.frame_bytes,
                annotated_width=self._snapshot.annotated_width,
                annotated_height=self._snapshot.annotated_height,
                processed_at=time.time(),
                frame_index=self._frame_index,
                online=False,
                status="reconnecting",
                detection_enabled=self._detection_enabled,
            )
            return self._copy_snapshot()

    def is_detection_enabled(self) -> bool:
        with self._lock:
            return self._detection_enabled

    def set_detection_enabled(self, enabled: bool) -> Snapshot:
        with self._lock:
            self._detection_enabled = enabled
            status = "stopped" if not enabled else "streaming"
            frame_bytes = None if not enabled else self._snapshot.frame_bytes
            self._snapshot = Snapshot(
                source=SourceConfig(type=self._source.type, url=self._source.url, index=self._source.index),
                detections=[] if not enabled else self._snapshot.detections,
                frame_bytes=frame_bytes,
                annotated_width=self._snapshot.annotated_width,
                annotated_height=self._snapshot.annotated_height,
                processed_at=time.time(),
                frame_index=self._snapshot.frame_index,
                online=False if not enabled else self._snapshot.online,
                status=status,
                detection_enabled=self._detection_enabled,
            )
            return self._copy_snapshot()

    def toggle_source(self, esp32_url: str | None = None) -> Snapshot:
        with self._lock:
            if self._source.type == SourceType.webcam:
                target_url = esp32_url or self._source.url or os.getenv("ESP32_STREAM_URL")
                if not target_url:
                    raise HTTPException(status_code=400, detail="No ESP32-CAM stream URL is configured.")
                update = SourceUpdate(type=SourceType.esp32_cam, url=target_url, index=self._source.index)
            else:
                update = SourceUpdate(type=SourceType.webcam, url=None, index=self._source.index)

        return self.set_source(update)

    def stream(self):
        boundary = BOUNDARY.encode("ascii")
        while not self._stop_event.is_set():
            snapshot = self.get_snapshot()
            frame_bytes = snapshot.frame_bytes
            if frame_bytes is None:
                placeholder_message = "Camera stopped" if not snapshot.detection_enabled else "Waiting for camera frames"
                frame_bytes = self._encode_frame(self._build_placeholder_frame(placeholder_message))

            if frame_bytes is None:
                time.sleep(0.08)
                continue

            yield (
                b"--" + boundary + b"\r\n"
                b"Content-Type: image/jpeg\r\n"
                b"Content-Length: " + str(len(frame_bytes)).encode("ascii") + b"\r\n\r\n" + frame_bytes + b"\r\n"
            )
            time.sleep(0.08)

    def _processing_loop(self) -> None:
        retry_count = 0
        capture: cv2.VideoCapture | None = None

        while not self._stop_event.is_set():
            if not self.is_detection_enabled():
                self._release_capture()
                capture = None
                retry_count = 0
                self._set_status([], None, online=False, status="stopped")
                time.sleep(0.5)
                continue

            if capture is None or not capture.isOpened():
                self._release_capture()
                capture = self._open_capture(self._source_signature())
                if capture is None or not capture.isOpened():
                    self._set_status([], None, online=False, status="retrying")
                    delay = RECONNECT_DELAYS[min(retry_count, len(RECONNECT_DELAYS) - 1)]
                    retry_count += 1
                    time.sleep(delay)
                    continue

                self._capture = capture
                self._capture_signature = self._source_signature()
                retry_count = 0
                self._set_status([], None, online=True, status="streaming")

            ok, frame = capture.read()
            if not ok or frame is None:
                self._release_capture()
                capture = None
                self._set_status([], None, online=False, status="retrying")
                delay = RECONNECT_DELAYS[min(retry_count, len(RECONNECT_DELAYS) - 1)]
                retry_count += 1
                time.sleep(delay)
                continue

            retry_count = 0

            detection_enabled = self.is_detection_enabled()
            if detection_enabled:
                detections, annotated = self._run_detection(frame)
                stream_status = "streaming"
            else:
                detections, annotated = [], self._annotate_paused_frame(frame)
                stream_status = "paused"

            encoded_frame = self._encode_frame(annotated)
            self._set_status(detections, encoded_frame, online=True, status=stream_status, frame_shape=annotated.shape)
            time.sleep(self._process_delay)

    def _ensure_capture(self) -> cv2.VideoCapture | None:
        signature = self._source_signature()
        if self._capture is not None and self._capture_signature == signature and self._capture.isOpened():
            return self._capture

        now = time.time()
        if now - self._last_capture_attempt < self._capture_retry_interval:
            return None

        self._last_capture_attempt = now

        self._release_capture()
        capture = self._open_capture(signature)
        if capture is None or not capture.isOpened():
            return None

        self._capture = capture
        self._capture_signature = signature
        self._read_failures = 0
        return capture

    def _open_capture(self, signature: tuple[SourceType, str | int | None]) -> cv2.VideoCapture | None:
        source_type, value = signature
        if source_type == SourceType.webcam:
            camera_index = int(value or 0)
            backend_flags = []
            if os.name == "nt":
                backend_flags = [cv2.CAP_DSHOW, cv2.CAP_MSMF]
            index_candidates = [camera_index]
            for fallback_index in range(4):
                if fallback_index != camera_index:
                    index_candidates.append(fallback_index)

            capture_specs = [
                (candidate_index, backend_flag)
                for candidate_index in index_candidates
                for backend_flag in chain(backend_flags, [None])
            ]
        else:
            # Ensure the HTTP MJPEG stream does not block for ~30s on timeouts.
            os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = "timeout;5000000|rw_timeout;5000000|stimeout;5000000"
            capture = cv2.VideoCapture(str(value or ""), cv2.CAP_FFMPEG)

        if source_type == SourceType.webcam:
            capture = None
            for candidate_index, backend_flag in capture_specs:
                candidate = (
                    cv2.VideoCapture(candidate_index, backend_flag)
                    if backend_flag is not None
                    else cv2.VideoCapture(candidate_index)
                )
                if not candidate.isOpened():
                    candidate.release()
                    continue

                candidate.set(cv2.CAP_PROP_BUFFERSIZE, 1)
                candidate.set(cv2.CAP_PROP_FPS, 30)

                got_frame = False
                for _ in range(5):
                    ok, frame = candidate.read()
                    if ok and frame is not None and frame.size > 0:
                        got_frame = True
                        break

                if got_frame:
                    capture = candidate
                    break

                candidate.release()

            if capture is None:
                return None

        if capture is not None and capture.isOpened():
            # Best-effort timeouts (not supported on all OpenCV builds).
            capture.set(getattr(cv2, "CAP_PROP_OPEN_TIMEOUT_MSEC", 0), 5000)
            capture.set(getattr(cv2, "CAP_PROP_READ_TIMEOUT_MSEC", 0), 5000)
            capture.set(cv2.CAP_PROP_BUFFERSIZE, 1)
            capture.set(cv2.CAP_PROP_FPS, 30)
            for _ in range(3):
                capture.read()
            return capture

        if capture is not None:
            capture.release()
        return None

    def _release_capture(self) -> None:
        if self._capture is not None:
            self._capture.release()
            self._capture = None
            self._capture_signature = None
        self._read_failures = 0

    def _source_signature(self) -> tuple[SourceType, str | int | None]:
        if self._source.type == SourceType.webcam:
            return self._source.type, self._source.index
        return self._source.type, self._source.url

    def _run_detection(self, frame: np.ndarray) -> tuple[list[DetectionRecord], np.ndarray]:
        result = self._model.predict(frame, conf=self._confidence_threshold, verbose=False, imgsz=640)[0]
        annotated = frame.copy()
        detections: list[DetectionRecord] = []
        candidates: list[DetectionRecord] = []

        names = result.names if isinstance(result.names, dict) else self._model.names
        for box in result.boxes:
            class_id = int(box.cls.item())
            label = str(names.get(class_id, class_id))
            confidence = float(box.conf.item())
            x1, y1, x2, y2 = (int(value) for value in box.xyxy[0].tolist())
            record = DetectionRecord(
                label=label,
                confidence=confidence,
                bounding_box={"x1": x1, "y1": y1, "x2": x2, "y2": y2},
            )
            candidates.append(record)
            if self._allowed_labels is None or label.lower() in self._allowed_labels:
                detections.append(record)

        if not detections and candidates:
            detections = [max(candidates, key=lambda item: item.confidence)]

        for detection in detections:
            x1 = detection.bounding_box["x1"]
            y1 = detection.bounding_box["y1"]
            x2 = detection.bounding_box["x2"]
            y2 = detection.bounding_box["y2"]
            color = (34, 197, 94)
            cv2.rectangle(annotated, (x1, y1), (x2, y2), color, 2)
            caption = f"{detection.label} {detection.confidence:.2f}"
            (text_width, text_height), baseline = cv2.getTextSize(caption, cv2.FONT_HERSHEY_SIMPLEX, 0.55, 2)
            text_top = max(18, y1 - text_height - baseline - 8)
            cv2.rectangle(annotated, (x1, text_top), (x1 + text_width + 10, text_top + text_height + baseline + 8), color, -1)
            cv2.putText(
                annotated,
                caption,
                (x1 + 5, text_top + text_height + 2),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.55,
                (0, 0, 0),
                2,
                cv2.LINE_AA,
            )

        if not detections:
            overlay = "No animal detected"
            cv2.rectangle(annotated, (12, 12), (300, 58), (15, 23, 42), -1)
            cv2.putText(annotated, overlay, (24, 42), cv2.FONT_HERSHEY_SIMPLEX, 0.75, (255, 255, 255), 2, cv2.LINE_AA)

        return detections, annotated

    def _encode_frame(self, frame: np.ndarray | None) -> bytes | None:
        if frame is None:
            return None

        success, encoded = cv2.imencode(".jpg", frame, [int(cv2.IMWRITE_JPEG_QUALITY), 85])
        if not success:
            return None

        return encoded.tobytes()

    def _annotate_paused_frame(self, frame: np.ndarray) -> np.ndarray:
        annotated = frame.copy()
        cv2.rectangle(annotated, (12, 12), (330, 58), (30, 30, 30), -1)
        cv2.putText(annotated, "Detection paused", (24, 42), cv2.FONT_HERSHEY_SIMPLEX, 0.75, (255, 255, 255), 2, cv2.LINE_AA)
        return annotated

    def _build_placeholder_frame(self, message: str) -> np.ndarray:
        frame = np.zeros((480, 640, 3), dtype=np.uint8)
        cv2.rectangle(frame, (0, 0), (639, 479), (38, 99, 235), 2)
        cv2.putText(frame, message, (36, 238), cv2.FONT_HERSHEY_SIMPLEX, 0.95, (255, 255, 255), 2, cv2.LINE_AA)
        return frame

    def _set_status(
        self,
        detections: list[DetectionRecord],
        frame_bytes: bytes | None,
        *,
        online: bool,
        status: str,
        frame_shape: tuple[int, int, int] | None = None,
    ) -> None:
        with self._lock:
            if frame_shape is None:
                width = self._snapshot.annotated_width
                height = self._snapshot.annotated_height
            else:
                height, width = frame_shape[:2]

            self._frame_index += 1
            self._snapshot = Snapshot(
                source=SourceConfig(type=self._source.type, url=self._source.url, index=self._source.index),
                detections=detections,
                frame_bytes=frame_bytes,
                annotated_width=width,
                annotated_height=height,
                processed_at=time.time(),
                frame_index=self._frame_index,
                online=online,
                status=status,
                detection_enabled=self._detection_enabled,
            )

    def _copy_snapshot(self) -> Snapshot:
        return Snapshot(
            source=SourceConfig(
                type=self._snapshot.source.type,
                url=self._snapshot.source.url,
                index=self._snapshot.source.index,
            ),
            detections=[DetectionRecord(label=item.label, confidence=item.confidence, bounding_box=dict(item.bounding_box)) for item in self._snapshot.detections],
            frame_bytes=self._snapshot.frame_bytes,
            annotated_width=self._snapshot.annotated_width,
            annotated_height=self._snapshot.annotated_height,
            processed_at=self._snapshot.processed_at,
            frame_index=self._snapshot.frame_index,
            online=self._snapshot.online,
            status=self._snapshot.status,
            detection_enabled=self._snapshot.detection_enabled,
        )


camera_service = CameraService()

app = FastAPI(title="FarmSentinalAPI", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in os.getenv("CORS_ORIGINS", "*").split(",") if origin.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup_event() -> None:
    camera_service.start()


@app.on_event("shutdown")
def shutdown_event() -> None:
    camera_service.stop()


@app.get("/health")
def health() -> dict[str, Any]:
    snapshot = camera_service.get_snapshot()
    return {
        "status": "ok",
        "model": os.getenv("YOLO_MODEL_PATH", "yolov8n.pt"),
        "source": asdict(snapshot.source),
        "online": snapshot.online,
        "detectionEnabled": snapshot.detection_enabled,
        "frameIndex": snapshot.frame_index,
        "lastProcessedAt": snapshot.processed_at,
    }


@app.get("/detection")
def get_detection_state() -> dict[str, Any]:
    snapshot = camera_service.get_snapshot()
    return {
        "enabled": snapshot.detection_enabled,
        "status": snapshot.status,
        "online": snapshot.online,
    }


@app.put("/detection")
def set_detection_state(payload: DetectionControl) -> dict[str, Any]:
    snapshot = camera_service.set_detection_enabled(payload.enabled)
    return {
        "enabled": snapshot.detection_enabled,
        "status": snapshot.status,
        "online": snapshot.online,
    }


@app.get("/source")
def get_source() -> dict[str, Any]:
    return asdict(camera_service.get_source())


@app.put("/source")
def update_source(source_update: SourceUpdate) -> dict[str, Any]:
    snapshot = camera_service.set_source(source_update)
    return {
        "source": asdict(snapshot.source),
        "status": snapshot.status,
        "online": snapshot.online,
    }


@app.post("/source/toggle")
def toggle_source(payload: dict[str, Any] | None = None) -> dict[str, Any]:
    esp32_url = None if payload is None else payload.get("url")
    snapshot = camera_service.toggle_source(esp32_url=esp32_url)
    return {
        "source": asdict(snapshot.source),
        "status": snapshot.status,
        "online": snapshot.online,
    }


@app.get("/detections")
def get_detections() -> dict[str, Any]:
    snapshot = camera_service.get_snapshot()
    return {
        "source": asdict(snapshot.source),
        "status": snapshot.status,
        "online": snapshot.online,
        "detectionEnabled": snapshot.detection_enabled,
        "frameIndex": snapshot.frame_index,
        "processedAt": snapshot.processed_at,
        "frameSize": {"width": snapshot.annotated_width, "height": snapshot.annotated_height},
        "detectionCount": len(snapshot.detections),
        "detections": [
            {
                "label": detection.label,
                "confidence": detection.confidence,
                "boundingBox": detection.bounding_box,
            }
            for detection in snapshot.detections
        ],
        "latestDetection": (
            {
                "label": snapshot.detections[0].label,
                "confidence": snapshot.detections[0].confidence,
                "boundingBox": snapshot.detections[0].bounding_box,
            }
            if snapshot.detections
            else None
        ),
    }


@app.get("/video_feed")
def video_feed() -> StreamingResponse:
    return StreamingResponse(camera_service.stream(), media_type=f"multipart/x-mixed-replace; boundary={BOUNDARY}")


@app.exception_handler(HTTPException)
def http_exception_handler(_: Any, exc: HTTPException) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=int(os.getenv("PORT", "8000")), reload=False)
