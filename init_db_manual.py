from app.db.session import engine
from app.db.base import Base

def init_db():
    Base.metadata.create_all(bind=engine)
    print("Database tables created.")

if __name__ == "__main__":
    import sys
    import os
    sys.path.append(os.path.join(os.getcwd(), "backend"))
    init_db()
