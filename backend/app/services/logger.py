import json
import uuid
from datetime import datetime
from pathlib import Path
from typing import List, Optional
from app.models import LogEntry

LOGS_FILE_PATH = Path(__file__).parent.parent / "logs.json"

class LoggerService:
    def __init__(self, filepath: Path = LOGS_FILE_PATH):
        self.filepath = filepath
        self.logs: List[LogEntry] = self._load_logs()

    def _load_logs(self) -> List[LogEntry]:
        if self.filepath.exists():
            try:
                with open(self.filepath, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    return [LogEntry(**item) for item in data]
            except Exception as e:
                print(f"Error loading logs: {e}")
        return []

    def _save_logs(self):
        try:
            with open(self.filepath, "w", encoding="utf-8") as f:
                json.dump([log.model_dump() for log in self.logs], f, indent=2)
        except Exception as e:
            print(f"Error saving logs: {e}")

    def add_log(
        self,
        animal: Optional[str],
        confidence: Optional[float],
        distance: Optional[float],
        alert: bool,
        led_state: bool,
        buzzer_state: bool,
        action_taken: str,
    ) -> LogEntry:
        entry = LogEntry(
            id=str(uuid.uuid4())[:8],
            timestamp=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            animal=animal,
            confidence=round(confidence, 2) if confidence else None,
            distance=round(distance, 1) if distance is not None else None,
            alert=alert,
            led_state=led_state,
            buzzer_state=buzzer_state,
            action_taken=action_taken,
        )
        self.logs.insert(0, entry)
        if len(self.logs) > 500:
            self.logs = self.logs[:500]
        self._save_logs()
        return entry

    def get_logs(self) -> List[LogEntry]:
        return self.logs

    def clear_logs(self):
        self.logs = []
        self._save_logs()

logger_service = LoggerService()
