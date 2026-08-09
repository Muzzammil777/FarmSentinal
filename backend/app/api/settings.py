from fastapi import APIRouter
from app.models import SettingsDTO
from app.config import settings_manager

router = APIRouter(prefix="/api/settings", tags=["Settings"])

@router.get("", response_model=SettingsDTO)
async def get_settings():
    return settings_manager.settings

@router.post("", response_model=SettingsDTO)
async def update_settings(new_settings: SettingsDTO):
    updated = settings_manager.update(**new_settings.model_dump())
    return updated
