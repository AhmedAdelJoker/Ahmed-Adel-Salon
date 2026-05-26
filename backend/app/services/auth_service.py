from datetime import datetime
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.core.security import verify_password, create_access_token
from app.models.user import User
from app.services.activity_service import log_activity 

def authenticate_user(db: Session, username: str, password: str):
    user = db.query(User).filter(User.username == username.lower()).first()
    
    if not user:
        return None
        
    if not verify_password(password, user.hashed_password):
        return None
        
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="هذا الحساب معطل، يرجى مراجعة الإدارة"
        )
        
    return user

def login_user(db: Session, username: str, password: str):
    user = authenticate_user(db, username, password)
    
    if not user:
        log_activity(
            db, 
            action="failed_login_attempt",
            entity_type="auth",
            description=f"محاولة دخول فاشلة لاسم المستخدم: {username}"
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="اسم المستخدم أو كلمة المرور غير صحيحة",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_access_token(
        data={
            "sub": user.username, 
            "role": user.role,
            "user_id": user.id 
        }
    )

    log_activity(
        db,
        user_id=user.id,
        action="login_success",
        entity_type="auth",
        description=f"قام {user.username} بتسجيل الدخول للنظام"
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "username": user.username,
            "role": user.role,
            "display_name": getattr(user, 'display_name', user.username)
        },
    }


