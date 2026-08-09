import asyncio
import math
import random
import time
import httpx
import logging
from app.config import settings_manager
from app.models import SensorStatusResponse

logger = logging.getLogger(__name__)

class ESP8266Service:
    def __init__(self):
        self.latest_distance: float | None = 35.0
        self.alert_active: bool = False
        self.is_online: bool = True
        self.running: bool = False
        self._task: asyncio.Task | None = None
        self._sim_phase: float = 0.0

    async def start_polling(self):
        if self.running:
            return
        self.running = True
        self._task = asyncio.create_task(self._poll_loop())
        logger.info("ESP8266 Polling background service started.")

    async def stop_polling(self):
        self.running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        logger.info("ESP8266 Polling service stopped.")

    async def reset_sensor(self) -> bool:
        cfg = settings_manager.settings
        self.alert_active = False
        if cfg.simulation_mode or not cfg.esp8266_ip:
            self.latest_distance = round(random.uniform(50.0, 80.0), 1)
            return True

        url = f"http://{cfg.esp8266_ip}/reset"
        try:
            async with httpx.AsyncClient(timeout=2.0) as client:
                res = await client.get(url)
                return res.status_code == 200
        except Exception as e:
            logger.warning(f"Failed to reset ESP8266 sensor ({url}): {e}")
            return False

    async def _poll_loop(self):
        while self.running:
            cfg = settings_manager.settings
            interval = cfg.polling_interval_ms / 1000.0

            if cfg.simulation_mode:
                self._update_simulation()
            else:
                await self._fetch_real_data(cfg.esp8266_ip)

            await asyncio.sleep(max(0.1, interval))

    async def _fetch_real_data(self, esp_ip: str):
        if not esp_ip:
            self.is_online = False
            self.alert_active = False
            return

        url = f"http://{esp_ip}/data"
        try:
            async with httpx.AsyncClient(timeout=1.5) as client:
                res = await client.get(url)
                if res.status_code == 200:
                    data = res.json()
                    self.latest_distance = data.get("distance")
                    self.alert_active = bool(data.get("alert", False))
                    self.is_online = True
                else:
                    self.is_online = False
        except Exception as e:
            self.is_online = False

    def _update_simulation(self):
        self.is_online = True
        self._sim_phase += 0.1
        # Oscillate distance between 15 cm and 90 cm smoothly
        sim_dist = 45.0 + 35.0 * math.sin(self._sim_phase) + random.uniform(-2.0, 2.0)
        sim_dist = round(max(5.0, sim_dist), 1)

        if not self.alert_active and sim_dist <= 45.0:
            self.alert_active = True

        self.latest_distance = sim_dist

    def get_status(self) -> SensorStatusResponse:
        return SensorStatusResponse(
            distance=self.latest_distance,
            alert=self.alert_active,
            online=self.is_online,
        )

esp8266_service = ESP8266Service()
