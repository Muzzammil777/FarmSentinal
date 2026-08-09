import asyncio
import cv2
import time
import threading
import logging
import numpy as np
from typing import Optional, Dict, Any, List
from ultralytics import YOLO

from app.config import settings_manager
from app.models import DetectionResponse
from app.services.camera import camera_manager
from app.services.esp32 import esp32_service
from app.services.esp8266 import esp8266_service
from app.services.logger import logger_service

logger = logging.getLogger(__name__)

ALLOWED_ANIMALS = {
    "dog", "cat", "cow", "horse", "sheep",
    "elephant", "bear", "zebra", "giraffe", "bird"
}

class DetectorService:
    def __init__(self):
        self.model: Optional[YOLO] = None
        self.is_running = False
        self.lock = threading.Lock()
        self.latest_detection: DetectionResponse = DetectionResponse(detected=False)
        self.latest_annotated_jpeg: Optional[bytes] = None
        self.thread: Optional[threading.Thread] = None
        self._last_alert_time: float = 0.0
        self.auto_intrusion_active: bool = False

    def start(self):
        if self.is_running:
            return
        self.is_running = True
        self.thread = threading.Thread(target=self._detection_loop, daemon=True)
        self.thread.start()
        logger.info("YOLOv8 Detection thread started.")

    def stop(self):
        self.is_running = False
        if self.thread and self.thread.is_alive():
            self.thread.join(timeout=2.0)
        logger.info("YOLOv8 Detection thread stopped.")

    def _init_model(self):
        if self.model is None:
            logger.info("Loading YOLOv8 Nano model (yolov8n.pt)...")
            self.model = YOLO("yolov8n.pt")
            logger.info("YOLOv8 Nano loaded successfully.")

    def _detection_loop(self):
        try:
            self._init_model()
        except Exception as e:
            logger.error(f"Failed to initialize YOLO model: {e}")

        while self.is_running:
            frame = camera_manager.get_latest_frame()
            if frame is None:
                time.sleep(0.05)
                continue

            cfg = settings_manager.settings
            target_animal = cfg.selected_animal.lower()
            conf_threshold = cfg.confidence_threshold
            auto_mode = cfg.auto_mode

            annotated_frame = frame.copy()
            detected_any = False
            best_animal: Optional[str] = None
            best_conf: float = 0.0

            if self.model is not None:
                try:
                    results = self.model.predict(
                        source=frame,
                        conf=0.35,
                        verbose=False
                    )
                    
                    if len(results) > 0 and results[0].boxes is not None:
                        boxes = results[0].boxes
                        for box in boxes:
                            cls_id = int(box.cls[0].item())
                            class_name = self.model.names[cls_id].lower()
                            conf = float(box.conf[0].item())

                            if class_name in ALLOWED_ANIMALS:
                                detected_any = True
                                if conf > best_conf:
                                    best_conf = conf
                                    best_animal = class_name

                                x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())
                                is_target = (class_name == target_animal and conf >= conf_threshold)

                                box_color = (0, 0, 255) if is_target else (0, 220, 100)
                                thickness = 3 if is_target else 2

                                cv2.rectangle(annotated_frame, (x1, y1), (x2, y2), box_color, thickness)

                                label_text = f"{class_name.upper()} {int(conf * 100)}%"
                                (w, h), _ = cv2.getTextSize(label_text, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 2)
                                cv2.rectangle(annotated_frame, (x1, y1 - h - 10), (x1 + w + 10, y1), box_color, -1)
                                cv2.putText(annotated_frame, label_text, (x1 + 5, y1 - 5), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
                except Exception as e:
                    logger.error(f"Error during YOLO inference: {e}")

            h_img, w_img, _ = annotated_frame.shape
            cv2.rectangle(annotated_frame, (0, 0), (w_img, 45), (15, 20, 30), -1)
            cv2.line(annotated_frame, (0, 45), (w_img, 45), (50, 60, 80), 1)

            status_text = f"TARGET: {target_animal.upper()} | CONF MIN: {int(conf_threshold * 100)}% | AUTO: {'ON' if auto_mode else 'OFF'}"
            cv2.putText(annotated_frame, status_text, (15, 28), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (200, 220, 255), 1)

            # Automated Intrusion Logic Evaluation
            is_intrusion = (
                auto_mode
                and best_animal == target_animal
                and best_conf >= conf_threshold
            )

            if is_intrusion:
                cv2.rectangle(annotated_frame, (0, h_img - 45), (w_img, h_img), (0, 0, 220), -1)
                cv2.putText(
                    annotated_frame,
                    f"🚨 INTRUSION ALERT: {target_animal.upper()} DETECTED ({int(best_conf * 100)}%) - DETERRENTS ACTIVE",
                    (15, h_img - 15),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.6,
                    (255, 255, 255),
                    2,
                )
                
                # Trigger LED & Buzzer ON if not already active in auto mode
                if not self.auto_intrusion_active:
                    self.auto_intrusion_active = True
                    esp32_service.set_led_sync(True)
                    esp32_service.set_buzzer_sync(True)

                now = time.time()
                if now - self._last_alert_time >= 3.0:
                    self._last_alert_time = now
                    sensor_info = esp8266_service.get_status()
                    logger_service.add_log(
                        animal=best_animal,
                        confidence=best_conf,
                        distance=sensor_info.distance,
                        alert=sensor_info.alert,
                        led_state=True,
                        buzzer_state=True,
                        action_taken="AUTOMATIC LED & BUZZER ACTIVATED",
                    )
            else:
                # Turn OFF LED & Buzzer only if they were turned ON by auto intrusion trigger
                if self.auto_intrusion_active:
                    self.auto_intrusion_active = False
                    esp32_service.set_led_sync(False)
                    esp32_service.set_buzzer_sync(False)


            ret, jpeg_bytes = cv2.imencode(".jpg", annotated_frame, [int(cv2.IMWRITE_JPEG_QUALITY), 85])
            if ret:
                with self.lock:
                    self.latest_annotated_jpeg = jpeg_bytes.tobytes()
                    self.latest_detection = DetectionResponse(
                        detected=best_animal is not None and best_conf >= 0.50,
                        animal=best_animal,
                        confidence=round(best_conf, 2) if best_conf > 0 else None,
                        timestamp=time.strftime("%Y-%m-%d %H:%M:%S"),
                    )

            time.sleep(0.04)

    def get_detection_status(self) -> DetectionResponse:
        with self.lock:
            return self.latest_detection

    def get_annotated_jpeg(self) -> Optional[bytes]:
        with self.lock:
            return self.latest_annotated_jpeg

detector_service = DetectorService()
