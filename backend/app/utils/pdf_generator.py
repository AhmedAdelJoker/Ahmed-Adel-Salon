from datetime import datetime
from fastapi.middleware.cors import CORSMiddleware
from xhtml2pdf import pisa
from io import BytesIO
from fastapi import Response

def render_pdf(html_content: str):
    result = BytesIO()
    pdf = pisa.pisaDocument(BytesIO(html_content.encode("utf-8")), result)
    if not pdf.err:
        return Response(content=result.getvalue(), media_type="application/pdf")
    return None

import pandas as pd
from io import BytesIO
from fastapi.responses import StreamingResponse

@router.get("/export/excel")
def export_to_excel(data_from_db):
    # تحويل البيانات إلى DataFrame
    df = pd.DataFrame(data_from_db)
    
    output = BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name='التقارير')
    
    output.seek(0)
    return StreamingResponse(
        output, 
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=report.xlsx"}
    )


