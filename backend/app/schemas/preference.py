from pydantic import BaseModel, ConfigDict


class PreferenceRead(BaseModel):
    id: int | None = None
    language: str = "ar"
    theme: str = "dark"
    notifications_enabled: bool = True

    model_config = ConfigDict(from_attributes=True)


class PreferenceUpdate(BaseModel):
    language: str | None = None
    theme: str | None = None
    notifications_enabled: bool | None = None