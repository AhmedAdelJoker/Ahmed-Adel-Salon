from sqlalchemy.orm import Session

from app.models.service import Service


def get_services(db: Session) -> list[Service]:
    return db.query(Service).order_by(Service.id.desc()).all()


def get_service(db: Session, service_id: int) -> Service | None:
    return db.query(Service).filter(Service.id == service_id).first()


def create_service(db: Session, payload) -> Service:
    item = Service(
        name=payload.name,
        price=float(payload.price),
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def update_service(db: Session, item: Service, payload) -> Service:
    item.name = payload.name
    item.price = float(payload.price)
    db.commit()
    db.refresh(item)
    return item


def delete_service(db: Session, item: Service) -> None:
    db.delete(item)
    db.commit()