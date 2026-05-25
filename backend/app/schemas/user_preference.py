from app.schemas.preference import PreferenceRead as UserPreferenceRead
from app.schemas.preference import PreferenceUpdate as UserPreferenceUpdate

from pydantic import BaseModel, ConfigDict

class UserPreferenceRead(BaseModel):
    language: str
    theme: str
    notifications_enabled: bool

    model_config = ConfigDict(from_attributes=True)


class UserPreferenceUpdate(BaseModel):
    language: str
    theme: str
    notifications_enabled: bool
    
__all__ = ["UserPreferenceRead", "UserPreferenceUpdate"]
