from typing import List, Dict


JOB_TITLES: List[Dict[str, str]] = [
    {
        "id": "barber_beard_specialist",
        "title_ar": "أخصائي حلاقة وتصفيف الشعر وعناية باللحية",
        "title_en": "Master Barber & Beard Specialist",
        "system_role": "barber"
    },
    {
        "id": "hair_colorist",
        "title_ar": "أخصائي تلوين ومعالجة الشعر",
        "title_en": "Hair Coloring & Treatment Specialist",
        "system_role": "barber"
    },
    {
        "id": "esthetician",
        "title_ar": "أخصائي عناية بالبشرة والوجه",
        "title_en": "Skin & Facial Care Specialist",
        "system_role": "barber"
    },
    {
        "id": "technical_assistant",
        "title_ar": "مساعد فني / مسؤول تحضير",
        "title_en": "Technical Assistant / Prep Specialist",
        "system_role": "barber"
    },
    {
        "id": "cashier",
        "title_ar": "كاشير ومسؤول صندوق",
        "title_en": "Cashier & Point of Sale Officer",
        "system_role": "cashier"
    },
    {
        "id": "receptionist",
        "title_ar": "مسؤول خدمة واستقبال العملاء",
        "title_en": "Guest Relations & Front Desk Officer",
        "system_role": "cashier"
    },
    {
        "id": "shop_manager",
        "title_ar": "مدير عمليات التشغيل",
        "title_en": "Operations Manager",
        "system_role": "manager"
    },
    {
        "id": "cleaner",
        "title_ar": "مسؤول مرافق وصيانة ونظافة",
        "title_en": "Facilities & Sanitation Specialist",
        "system_role": "barber"  # Default low-level role
    },
    {
        "id": "accountant",
        "title_ar": "محاسب مالي وإداري",
        "title_en": "Financial & Administrative Accountant",
        "system_role": "accountant"
    }
]


def get_job_title_by_id(title_id: str) -> Dict[str, str] | None:
    return next((item for item in JOB_TITLES if item["id"] == title_id), None)
