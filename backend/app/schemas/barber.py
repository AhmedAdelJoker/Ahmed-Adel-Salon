from pydantic import BaseModel, ConfigDict


class BarberBase(BaseModel):
    display_name: str


class BarberCreate(BarberBase):
    pass


class BarberUpdate(BaseModel):
    display_name: str | None = None


class BarberRead(BarberBase):
    id: int

    model_config = ConfigDict(from_attributes=True)


class PaginatedBarbersRead(BaseModel):
    items: list[BarberRead] = []
    total: int = 0
    page: int = 1
    page_size: int = 20
    total_pages: int = 1