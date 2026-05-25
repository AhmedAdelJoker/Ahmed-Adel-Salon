from sqlalchemy.orm import Session

from app.models.barber import Barber


def get_barbers(db: Session) -> list[Barber]:
    return db.query(Barber).order_by(Barber.id.desc()).all()


def get_barber(db: Session, barber_id: int) -> Barber | None:
    return db.query(Barber).filter(Barber.id == barber_id).first()


def create_barber(db: Session, payload) -> Barber:
    item = Barber(
        display_name=payload.display_name,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def update_barber(db: Session, item: Barber, payload) -> Barber:
    item.display_name = payload.display_name
    db.commit()
    db.refresh(item)
    return item


def delete_barber(db: Session, item: Barber) -> None:
    db.delete(item)
    db.commit()