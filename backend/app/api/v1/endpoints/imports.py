from datetime import datetime
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy.orm import Session
import io
from app.db.session import get_db
from app.api.deps import require_owner_or_manager
from app.models.user import User
from app.models.customer import Customer
from app.models.product import Product
from app.services.activity_service import log_activity

router = APIRouter(prefix="/imports", tags=["Imports"])

@router.post("/customers")
async def import_customers(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner_or_manager),
):
    if not file.filename.endswith(('.csv', '.xlsx', '.xls')):
        raise HTTPException(
            status_code=400, 
            detail="ملف غير مدعوم. يرجى رفع ملف CSV أو Excel."
        )

    try:
        content = await file.read()
        if file.filename.endswith('.csv'):
            df = pd.read_csv(io.BytesIO(content))
        else:
            df = pd.read_excel(io.BytesIO(content))
        
        # Standardize column names (basic cleanup)
        df.columns = [c.strip().lower() for c in df.columns]
        
        # Mapping common Arabic/English names
        mapping = {
            'الاسم الأول': 'first_name',
            'الاسم الاخير': 'last_name',
            'الاسم الأخير': 'last_name',
            'رقم الهاتف': 'phone',
            'الهاتف': 'phone',
            'البريد': 'email',
            'البريد الالكتروني': 'email',
            'البريد الإلكتروني': 'email',
            'first name': 'first_name',
            'last name': 'last_name',
            'phone': 'phone',
            'email': 'email'
        }
        df.rename(columns=mapping, inplace=True)

        required_cols = ['first_name', 'phone']
        for col in required_cols:
            if col not in df.columns:
                raise HTTPException(
                    status_code=400, 
                    detail=f"العمود '{col}' مفقود في الملف. الأعمدة المطلوبة: الاسم الأول، الهاتف."
                )

        count = 0
        errors = []
        for index, row in df.iterrows():
            try:
                first_name = str(row['first_name']).strip()
                phone = str(row['phone']).strip()
                
                if not first_name or not phone:
                    continue
                
                # Check if customer already exists by phone
                existing = db.query(Customer).filter(Customer.phone == phone).first()
                if existing:
                    continue
                
                customer = Customer(
                    first_name=first_name,
                    last_name=str(row.get('last_name', '')).strip() if pd.notna(row.get('last_name')) else None,
                    phone=phone,
                    email=str(row.get('email', '')).strip() if pd.notna(row.get('email')) else None,
                )
                db.add(customer)
                count += 1
            except Exception as e:
                errors.append(f"خطأ في السطر {index + 2}: {str(e)}")

        db.commit()
        
        log_activity(
            db, 
            user_id=current_user.id, 
            action="import", 
            entity_type="customer", 
            description=f"استيراد {count} عميل من ملف {file.filename}"
        )
        
        return {
            "message": f"تم استيراد {count} عملاء بنجاح.",
            "errors": errors if errors else None
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"فشل معالجة الملف: {str(e)}")

@router.post("/products")
async def import_products(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner_or_manager),
):
    if not file.filename.endswith(('.csv', '.xlsx', '.xls')):
        raise HTTPException(
            status_code=400, 
            detail="ملف غير مدعوم. يرجى رفع ملف CSV أو Excel."
        )

    try:
        content = await file.read()
        if file.filename.endswith('.csv'):
            df = pd.read_csv(io.BytesIO(content))
        else:
            df = pd.read_excel(io.BytesIO(content))
        
        df.columns = [c.strip().lower() for c in df.columns]
        
        mapping = {
            'الاسم': 'name',
            'اسم المنتج': 'name',
            'الباركود': 'sku',
            'sku': 'sku',
            'الكمية': 'quantity',
            'سعر الشراء': 'cost_price',
            'سعر البيع': 'sell_price',
            'الوحدة': 'unit',
            'name': 'name',
            'quantity': 'quantity',
            'cost_price': 'cost_price',
            'sell_price': 'sell_price',
            'unit': 'unit'
        }
        df.rename(columns=mapping, inplace=True)

        if 'name' not in df.columns:
            raise HTTPException(status_code=400, detail="عمود 'الاسم' مفقود في الملف.")

        count = 0
        errors = []
        for index, row in df.iterrows():
            try:
                name = str(row['name']).strip()
                if not name:
                    continue
                
                sku = str(row.get('sku', '')).strip() if pd.notna(row.get('sku')) else None
                
                # Check if product exists by sku
                if sku:
                    existing = db.query(Product).filter(Product.sku == sku).first()
                    if existing:
                        continue
                
                product = Product(
                    name=name,
                    sku=sku,
                    quantity=float(row.get('quantity', 0)) if pd.notna(row.get('quantity')) else 0,
                    cost_price=float(row.get('cost_price', 0)) if pd.notna(row.get('cost_price')) else 0,
                    sell_price=float(row.get('sell_price', 0)) if pd.notna(row.get('sell_price')) else 0,
                    unit=str(row.get('unit', 'قطعة')).strip() if pd.notna(row.get('unit')) else 'قطعة',
                    is_active=True
                )
                db.add(product)
                count += 1
            except Exception as e:
                errors.append(f"خطأ في السطر {index + 2}: {str(e)}")

        db.commit()
        
        log_activity(
            db, 
            user_id=current_user.id, 
            action="import", 
            entity_type="product", 
            description=f"استيراد {count} منتج من ملف {file.filename}"
        )
        
        return {
            "message": f"تم استيراد {count} منتجات بنجاح.",
            "errors": errors if errors else None
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"فشل معالجة الملف: {str(e)}")



