from __future__ import annotations

import json
import os
import shutil
import subprocess
import time
import urllib.parse
import urllib.request
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


class Esp32FlashRequest(BaseModel):
    port: str
    fqbn: str | None = None
    stream_url: str | None = None


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


def _arduino_cli_path() -> str:
    override = os.getenv("ARDUINO_CLI_PATH")
    if override:
        return override

    resolved = shutil.which("arduino-cli")
    if not resolved:
        raise HTTPException(status_code=500, detail="arduino-cli not found on PATH. Set ARDUINO_CLI_PATH.")
    return resolved


def _run_arduino_cli(args: list[str], timeout: int = 90) -> subprocess.CompletedProcess:
    cli_path = _arduino_cli_path()
    try:
        return subprocess.run(
            [cli_path, *args],
            check=False,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
    except subprocess.TimeoutExpired as exc:
        raise HTTPException(status_code=504, detail=f"arduino-cli timed out after {timeout}s") from exc


def _truncate_log(value: str, limit: int = 2000) -> str:
    if not value:
        return ""
    return value[-limit:]


def _backend_root() -> str:
    return os.path.dirname(os.path.dirname(__file__))


def _esp32_sketch_dir() -> str:
    return os.path.join(_backend_root(), "esp32_cam")


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
        self._process_delay = float(os.getenv("CAMERA_FRAME_DELAY", "0.0"))
        self._esp32_control_url = self._resolve_esp32_control_url(self._source.url)
        self._alert_active = False
        self._alert_last_sent = 0.0
        self._alert_started_at = 0.0
        self._alert_min_interval = float(os.getenv("ESP32_ALERT_MIN_INTERVAL", "1.0"))
        # ESP8266 sensor node — triggered when elephant is detected by camera
        sensor_raw = os.getenv("SENSOR_BASE_URL", "").strip().rstrip("/")
        self._sensor_node_url: str | None = sensor_raw if sensor_raw else None

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
            self._esp32_control_url = self._resolve_esp32_control_url(self._source.url)
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
            # Yield frames to the client as fast as they are generated by the processing loop.
            # Small 5ms sleep prevents 100% CPU lock in the generator thread if frames aren't updating quickly.
            time.sleep(0.005)

    def _processing_loop(self) -> None:
        retry_count = 0
        capture: cv2.VideoCapture | None = None

        while not self._stop_event.is_set():
            if not self.is_detection_enabled():
                self._release_capture()
                capture = None
                retry_count = 0
                self._set_status([], None, online=False, status="stopped")
                self._update_alert_outputs(False)
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

            elephant_detected = detection_enabled and any(
                d.label.lower() == "elephant" for d in detections
            )
            self._update_alert_outputs(elephant_detected)

            encoded_frame = self._encode_frame(annotated)
            self._set_status(detections, encoded_frame, online=True, status=stream_status, frame_shape=annotated.shape)
            
            if self._process_delay > 0:
                time.sleep(self._process_delay)
            else:
                # Minimum sleep to yield thread
                time.sleep(0.001)

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

        # Log only what we care about (the filtered detections)
        if detections:
            summary = ", ".join(f"{d.label}({d.confidence:.2f})" for d in detections)
            print(f"[detection] 🐘 {summary}", flush=True)
        else:
            print("[detection] no elephant found", flush=True)

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

    def _resolve_esp32_control_url(self, stream_url: str | None) -> str | None:
        raw = os.getenv("ESP32_CONTROL_URL") or stream_url or os.getenv("ESP32_STREAM_URL")
        if not raw:
            return None

        cleaned = raw.strip()
        if not cleaned:
            return None

        if "://" not in cleaned:
            cleaned = f"http://{cleaned}"

        parsed = urllib.parse.urlparse(cleaned)
        if not parsed.scheme or not parsed.netloc:
            return None

        return f"{parsed.scheme}://{parsed.netloc}"

    def _update_alert_outputs(self, elephant_detected: bool) -> None:
        if self._esp32_control_url is None:
            return

        now = time.time()
        
        # If an elephant is detected, start or extend the alarm
        if elephant_detected:
            self._alert_started_at = now
            if not self._alert_active:
                self._alert_active = True
                self._schedule_esp32_command("/flash_on")
                self._schedule_esp32_command("/buzzer_on")
                self._schedule_sensor_node_command("/buzzer_on")
                self._schedule_sensor_node_command("/led_on")
                print(f"[elephant] ALERT — turning ON for 20 seconds", flush=True)

        # If no elephant is currently seen, check if 20 seconds have passed
        elif self._alert_active:
            if now - self._alert_started_at >= 20.0:
                self._alert_active = False
                self._schedule_esp32_command("/flash_off")
                self._schedule_esp32_command("/buzzer_off")
                self._schedule_sensor_node_command("/buzzer_off")
                self._schedule_sensor_node_command("/led_off")
                print(f"[elephant] ALERT — 20 seconds elapsed, turning OFF", flush=True)

    def _schedule_esp32_command(self, path: str) -> None:
        thread = Thread(target=self._send_esp32_command, args=(path,), daemon=True)
        thread.start()

    def _schedule_sensor_node_command(self, path: str) -> None:
        """Send a fire-and-forget HTTP command to the ESP8266 sensor node."""
        if not self._sensor_node_url:
            return
        thread = Thread(target=self._send_sensor_node_command, args=(path,), daemon=True)
        thread.start()

    def _send_sensor_node_command(self, path: str) -> None:
        if not self._sensor_node_url:
            return
        url = f"{self._sensor_node_url}{path}"
        try:
            with urllib.request.urlopen(url, timeout=0.8):
                return
        except Exception:
            return

    def _send_esp32_command(self, path: str) -> None:
        base = self._esp32_control_url
        if not base:
            print(f"[esp32-cam] failed to send {path} — NO CONTROL URL CONFIGURED", flush=True)
            return

        url = f"{base}{path}?ts={int(time.time() * 1000)}"
        try:
            with urllib.request.urlopen(url, timeout=1.0) as response:
                print(f"[esp32-cam] ✅ successfully sent {path} -> {response.status}", flush=True)
                return
        except Exception as e:
            print(f"[esp32-cam] ❌ failed to send {path}: {e}", flush=True)
            return

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


class SensorService:
    def __init__(self, camera: CameraService) -> None:
        self._camera = camera
        self._stop_event = Event()
        self._thread: Thread | None = None
        self._sensor_base_url = os.getenv("SENSOR_BASE_URL")
        self._threshold_cm = float(os.getenv("SENSOR_THRESHOLD_CM", "45"))
        self._poll_interval = float(os.getenv("SENSOR_POLL_INTERVAL", "0.8"))
        self._enabled = _env_bool("SENSOR_POLL_ENABLED", default=bool(self._sensor_base_url))
        self._last_in_range: bool | None = None

    def start(self) -> None:
        if not self._enabled or not self._sensor_base_url:
            return
        if self._thread and self._thread.is_alive():
            return
        self._stop_event.clear()
        self._thread = Thread(target=self._poll_loop, name="sensor-service", daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._stop_event.set()
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=2.0)

    def _poll_loop(self) -> None:
        while not self._stop_event.is_set():
            distance = self._fetch_distance_cm()
            if distance is not None:
                in_range = distance <= self._threshold_cm
                if in_range != self._last_in_range:
                    self._last_in_range = in_range
                    self._camera.set_detection_enabled(in_range)

            time.sleep(self._poll_interval)

    def _fetch_distance_cm(self) -> float | None:
        if not self._sensor_base_url:
            return None

        base = self._sensor_base_url.rstrip("/") + "/"
        url = urllib.parse.urljoin(base, "data")
        try:
            with urllib.request.urlopen(url, timeout=1.5) as response:
                payload = json.loads(response.read().decode("utf-8"))
        except Exception:
            return None

        raw = (
            payload.get("distanceCm")
            or payload.get("distance_cm")
            or payload.get("distance")
        )
        if raw is None or raw == "":
            return None

        try:
            return float(raw)
        except (TypeError, ValueError):
            return None



camera_service = CameraService()
sensor_service = SensorService(camera_service)

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
    sensor_service.start()


@app.on_event("shutdown")
def shutdown_event() -> None:
    sensor_service.stop()
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


@app.get("/esp32/ports")
def list_esp32_ports() -> dict[str, Any]:
    result = _run_arduino_cli(["board", "list", "--format", "json"], timeout=20)
    if result.returncode != 0:
        return {
            "ok": False,
            "stderr": _truncate_log(result.stderr),
            "stdout": _truncate_log(result.stdout),
        }

    try:
        payload = json.loads(result.stdout or "{}")
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=500, detail="Unable to parse arduino-cli JSON output.") from exc

    detected_ports = payload.get("detected_ports", [])
    esp32_candidates = []
    for entry in detected_ports:
        boards = entry.get("matching_boards") or []
        if any("esp32" in (board.get("fqbn") or "").lower() for board in boards):
            esp32_candidates.append(entry)

    return {
        "ok": True,
        "detectedPorts": detected_ports,
        "esp32Ports": esp32_candidates,
        "defaultFqbn": os.getenv("ESP32_FQBN", "esp32:esp32:XIAO_ESP32S3:PSRAM=opi"),
    }


@app.post("/esp32/flash")
def flash_esp32(payload: Esp32FlashRequest) -> dict[str, Any]:
    sketch_dir = _esp32_sketch_dir()
    if not os.path.isdir(sketch_dir):
        raise HTTPException(status_code=500, detail="ESP32 sketch directory is missing.")

    fqbn = payload.fqbn or os.getenv("ESP32_FQBN", "esp32:esp32:XIAO_ESP32S3:PSRAM=opi")
    compile_result = _run_arduino_cli(["compile", "--fqbn", fqbn, sketch_dir], timeout=180)
    if compile_result.returncode != 0:
        return {
            "ok": False,
            "stage": "compile",
            "stderr": _truncate_log(compile_result.stderr),
            "stdout": _truncate_log(compile_result.stdout),
            "fqbn": fqbn,
        }

    upload_result = _run_arduino_cli(["upload", "-p", payload.port, "--fqbn", fqbn, sketch_dir], timeout=180)
    if upload_result.returncode != 0:
        return {
            "ok": False,
            "stage": "upload",
            "stderr": _truncate_log(upload_result.stderr),
            "stdout": _truncate_log(upload_result.stdout),
            "fqbn": fqbn,
        }

    if payload.stream_url:
        camera_service.set_source(
            SourceUpdate(type=SourceType.esp32_cam, url=payload.stream_url, index=0)
        )

    return {
        "ok": True,
        "stage": "done",
        "fqbn": fqbn,
        "stdout": _truncate_log(upload_result.stdout),
    }


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
