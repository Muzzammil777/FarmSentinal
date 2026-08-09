import json
import os
from pathlib import Path
from pydantic_settings import BaseSettings
from pydantic import BaseModel

CONFIG_FILE_PATH = Path(__file__).parent / "settings.json"

class AppSettings(BaseModel):
    esp8266_ip: str = "10.82.146.10"
    camera_ip: str = "10.82.146.44"
    polling_interval_ms: int = 500
    selected_animal: str = "cow"
    auto_mode: bool = True
    confidence_threshold: float = 0.70
    camera_source: str = "demo"  # "esp" | "webcam" | "demo"
    simulation_mode: bool = True

class SettingsManager:
    def __init__(self, filepath: Path = CONFIG_FILE_PATH):
        self.filepath = filepath
        self.settings = self.load_settings()

    def load_settings(self) -> AppSettings:
        if self.filepath.exists():
            try:
                with open(self.filepath, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    return AppSettings(**data)
            except Exception as e:
                print(f"Error loading settings file: {e}")
        settings = AppSettings()
        self.save_settings(settings)
        return settings

    def save_settings(self, new_settings: AppSettings):
        self.settings = new_settings
        with open(self.filepath, "w", encoding="utf-8") as f:
            json.dump(new_settings.model_dump(), f, indent=2)

    def update(self, **kwargs) -> AppSettings:
        current = self.settings.model_dump()
        current.update({k: v for k, v in kwargs.items() if v is not None})
        updated = AppSettings(**current)
        self.save_settings(updated)
        return updated

settings_manager = SettingsManager()
