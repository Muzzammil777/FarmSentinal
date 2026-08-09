import asyncio
import cv2
import numpy as np
import time
import threading
import logging
import math
import httpx
from typing import Optional
from app.config import settings_manager

logger = logging.getLogger(__name__)

class CameraManager:
    def __init__(self):
        self.latest_frame: Optional[np.ndarray] = None
        self.lock = threading.Lock()
        self.is_running = False
        self.is_connected = False
        self.fps = 0.0
        self.thread: Optional[threading.Thread] = None
        self.source = "demo"
        self._demo_tick = 0.0

    def start(self):
        if self.is_running:
            return
        self.is_running = True
        self.thread = threading.Thread(target=self._capture_loop, daemon=True)
        self.thread.start()
        logger.info("Camera Manager thread started.")

    def stop(self):
        self.is_running = False
        if self.thread and self.thread.is_alive():
            self.thread.join(timeout=2.0)
        logger.info("Camera Manager thread stopped.")

    def _capture_loop(self):
        cap = None
        last_time = time.time()
        frame_count = 0

        while self.is_running:
            cfg = settings_manager.settings
            desired_source = cfg.camera_source

            if desired_source == "webcam":
                if cap is None or not cap.isOpened():
                    logger.info("Attempting connection to local webcam...")
                    cap = cv2.VideoCapture(0)
                    if not cap.isOpened():
                        self.is_connected = False
                        logger.warning("Local webcam unavailable. Retrying in 5 seconds...")
                        self.latest_frame = self._generate_error_frame("Webcam Unavailable (Retrying...)")
                        time.sleep(5)
                        continue

                ret, frame = cap.read()
                if ret and frame is not None:
                    with self.lock:
                        self.latest_frame = frame
                        self.is_connected = True
                else:
                    self.is_connected = False
                    if cap:
                        cap.release()
                        cap = None
                    time.sleep(1)

            elif desired_source == "esp":
                if cap is not None and cap.isOpened():
                    cap.release()
                    cap = None
                
                # Fetch frame from ESP32 camera stream on port 81 or http stream
                esp_stream_url = f"http://{cfg.camera_ip}:81"
                try:
                    cap_esp = cv2.VideoCapture(esp_stream_url)
                    if cap_esp.isOpened():
                        ret, frame = cap_esp.read()
                        if ret and frame is not None:
                            with self.lock:
                                self.latest_frame = frame
                                self.is_connected = True
                            cap_esp.release()
                        else:
                            cap_esp.release()
                            raise ValueError("Could not read frame from ESP stream")
                    else:
                        raise ValueError("Could not open ESP stream")
                except Exception as e:
                    self.is_connected = False
                    with self.lock:
                        self.latest_frame = self._generate_error_frame(f"ESP32 Cam Unavailable ({cfg.camera_ip}:81)")
                    time.sleep(5)

            else:  # "demo" / simulation feed
                if cap is not None and cap.isOpened():
                    cap.release()
                    cap = None
                
                demo_frame = self._generate_demo_frame()
                with self.lock:
                    self.latest_frame = demo_frame
                    self.is_connected = True
                time.sleep(0.04)  # ~25 FPS

            # Calculate FPS
            frame_count += 1
            now = time.time()
            if now - last_time >= 1.0:
                self.fps = round(frame_count / (now - last_time), 1)
                frame_count = 0
                last_time = now

        if cap and cap.isOpened():
            cap.release()

    def _generate_demo_frame(self) -> np.ndarray:
        self._demo_tick += 0.05
        # Create a 640x480 realistic digital farm field frame
        img = np.zeros((480, 640, 3), dtype=np.uint8)
        
        # Sky gradient (Deep blue to soft sky blue)
        for y in range(200):
            r = int(135 - y * 0.3)
            g = int(206 - y * 0.4)
            b = int(235 - y * 0.2)
            img[y, :] = (b, g, r)

        # Sun
        cv2.circle(img, (540, 60), 30, (100, 240, 255), -1)

        # Mountains
        pts1 = np.array([[0, 200], [150, 100], [300, 200]], np.int32)
        pts2 = np.array([[200, 200], [420, 80], [640, 200]], np.int32)
        cv2.fillPoly(img, [pts1], (100, 110, 90))
        cv2.fillPoly(img, [pts2], (80, 95, 75))

        # Grass field (gradient emerald green)
        for y in range(200, 480):
            r = int(30 + (y - 200) * 0.1)
            g = int(120 + (y - 200) * 0.3)
            b = int(40 + (y - 200) * 0.1)
            img[y, :] = (b, g, r)

        # Wooden fence posts
        for x in range(20, 640, 80):
            cv2.rectangle(img, (x, 230), (x + 12, 310), (34, 55, 100), -1)
        cv2.line(img, (0, 250), (640, 250), (45, 70, 120), 4)
        cv2.line(img, (0, 280), (640, 280), (45, 70, 120), 4)

        # Animated Simulated Intruder (Cow / Dog walking across farm field)
        pos_x = int((math.sin(self._demo_tick * 0.5) + 1.0) * 220 + 80)
        pos_y = 310

        # Draw realistic Cow silhouette shape
        # Body
        cv2.ellipse(img, (pos_x + 60, pos_y + 40), (55, 35), 0, 0, 360, (240, 240, 240), -1)
        # Black spots on cow
        cv2.circle(img, (pos_x + 45, pos_y + 35), 18, (20, 20, 20), -1)
        cv2.circle(img, (pos_x + 75, pos_y + 48), 14, (20, 20, 20), -1)
        # Cow Head & Ears
        cv2.circle(img, (pos_x + 125, pos_y + 20), 22, (240, 240, 240), -1)
        cv2.circle(img, (pos_x + 130, pos_y + 15), 8, (20, 20, 20), -1)
        cv2.ellipse(img, (pos_x + 120, pos_y + 5), (14, 6), -30, 0, 360, (220, 220, 220), -1)
        # Legs
        leg_offset = int(math.sin(self._demo_tick * 4) * 8)
        cv2.rectangle(img, (pos_x + 25, pos_y + 70), (pos_x + 35, pos_y + 110 + leg_offset), (200, 200, 200), -1)
        cv2.rectangle(img, (pos_x + 45, pos_y + 70), (pos_x + 55, pos_y + 110 - leg_offset), (200, 200, 200), -1)
        cv2.rectangle(img, (pos_x + 75, pos_y + 70), (pos_x + 85, pos_y + 110 + leg_offset), (200, 200, 200), -1)
        cv2.rectangle(img, (pos_x + 95, pos_y + 70), (pos_x + 105, pos_y + 110 - leg_offset), (200, 200, 200), -1)

        # Label graphic overlay
        cv2.putText(img, "SIMULATED FARM FIELD DEMO STREAM", (15, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
        
        return img

    def _generate_error_frame(self, message: str) -> np.ndarray:
        img = np.zeros((480, 640, 3), dtype=np.uint8)
        cv2.putText(img, message, (40, 240), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 255), 2)
        cv2.putText(img, "Check Camera IP in Settings", (40, 280), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (200, 200, 200), 1)
        return img

    def get_latest_frame(self) -> Optional[np.ndarray]:
        with self.lock:
            if self.latest_frame is not None:
                return self.latest_frame.copy()
            return None


camera_manager = CameraManager()
