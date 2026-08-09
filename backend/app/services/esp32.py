import httpx
import logging
from app.config import settings_manager

logger = logging.getLogger(__name__)

def get_host_ip(raw_ip: str) -> str:
    if not raw_ip:
        return ""
    clean = raw_ip.replace("http://", "").replace("https://", "").strip()
    # Extract IP before colon or slash
    host = clean.split(":")[0].split("/")[0].strip()
    return host

class ESP32Service:
    def __init__(self):
        self.led_state: bool = False
        self.buzzer_state: bool = False

    async def set_led(self, state: bool, force: bool = False) -> bool:
        if not force and self.led_state == state:
            return True  # State already set

        self.led_state = state
        cfg = settings_manager.settings
        host_ip = get_host_ip(cfg.camera_ip)

        if not host_ip:
            logger.info(f"[SIMULATION] ESP32 Camera LED set to: {state}")
            return True

        endpoint = "/flash_on" if state else "/flash_off"
        url = f"http://{host_ip}{endpoint}"
        logger.info(f"Sending ESP32 LED request -> {url}")

        try:
            async with httpx.AsyncClient(timeout=4.0) as client:
                res = await client.get(url)
                logger.info(f"ESP32 LED response ({url}): {res.status_code} {res.text}")
                return res.status_code == 200
        except Exception as e:
            logger.warning(f"ESP32 Camera LED request failed ({url}): {e}")
            # If physical device unreachable, allow simulation state update
            return True

    async def set_buzzer(self, state: bool, force: bool = False) -> bool:
        if not force and self.buzzer_state == state:
            return True  # State already set

        self.buzzer_state = state
        cfg = settings_manager.settings
        host_ip = get_host_ip(cfg.camera_ip)

        if not host_ip:
            logger.info(f"[SIMULATION] ESP32 Camera Buzzer set to: {state}")
            return True

        endpoint = "/buzzer_on" if state else "/buzzer_off"
        url = f"http://{host_ip}{endpoint}"
        logger.info(f"Sending ESP32 Buzzer request -> {url}")

        try:
            async with httpx.AsyncClient(timeout=4.0) as client:
                res = await client.get(url)
                logger.info(f"ESP32 Buzzer response ({url}): {res.status_code} {res.text}")
                return res.status_code == 200
        except Exception as e:
            logger.warning(f"ESP32 Camera Buzzer request failed ({url}): {e}")
            # If physical device unreachable, allow simulation state update
            return True

    def set_led_sync(self, state: bool, force: bool = False) -> bool:
        if not force and self.led_state == state:
            return True

        self.led_state = state
        cfg = settings_manager.settings
        host_ip = get_host_ip(cfg.camera_ip)

        if not host_ip:
            return True

        endpoint = "/flash_on" if state else "/flash_off"
        url = f"http://{host_ip}{endpoint}"

        try:
            with httpx.Client(timeout=3.0) as client:
                res = client.get(url)
                return res.status_code == 200
        except Exception as e:
            logger.warning(f"ESP32 Camera LED sync request failed ({url}): {e}")
            return True

    def set_buzzer_sync(self, state: bool, force: bool = False) -> bool:
        if not force and self.buzzer_state == state:
            return True

        self.buzzer_state = state
        cfg = settings_manager.settings
        host_ip = get_host_ip(cfg.camera_ip)

        if not host_ip:
            return True

        endpoint = "/buzzer_on" if state else "/buzzer_off"
        url = f"http://{host_ip}{endpoint}"

        try:
            with httpx.Client(timeout=3.0) as client:
                res = client.get(url)
                return res.status_code == 200
        except Exception as e:
            logger.warning(f"ESP32 Camera Buzzer sync request failed ({url}): {e}")
            return True

esp32_service = ESP32Service()
