import React, { useState } from "react";
import { usePOS } from "../POSContext";
import { Card } from "../../../../components/ui/card";
import { Button } from "../../../../components/ui/button";
import { Badge } from "../../../../components/ui/badge";
import { Input } from "../../../../components/ui/input";
import { 
  Zap, 
  Wallet, 
  Clock, 
  CheckCircle2, 
  Activity, 
  RefreshCw,
  LogOut,
  Printer,
  FileText,
  AlertCircle
} from "lucide-react";
import { formatCurrency, cn } from "../../../../lib/utils";
import { posShiftService } from "../../../../services/posShiftService";
import { toast } from "react-hot-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../../components/ui/dialog";

const ShiftSidebar = () => {
  const { 
    currentShift, 
    setCurrentShift, 
    fetchShift, 
    readyAppointments, 
  } = usePOS();
  
  const [openingCash, setOpeningCash] = useState("0");
  const [isOpeningShift, setIsOpeningShift] = useState(false);
  const [showCloseShift, setShowCloseShift] = useState(false);
  const [closingCash, setClosingCash] = useState("0");
  const [isClosingShift, setIsClosingShift] = useState(false);

  const hasOpenShift = Boolean(
    currentShift && ["open", "opened", "OPEN", "OPENED"].includes(String(currentShift.status || "open"))
  );

  const handleOpenShift = async () => {
    try {
      setIsOpeningShift(true);
      const shift = await posShiftService.open({ openingCash });
      setCurrentShift(shift);
      toast.success("تم فتح الوردية بنجاح");
    } catch (error) {
      toast.error("فشل فتح الوردية");
    } finally {
      setIsOpeningShift(false);
    }
  };

  const handleCloseShift = async () => {
    try {
      setIsClosingShift(true);
      const shiftId = currentShift?.id || currentShift?.shift_id;
      const closed = await posShiftService.close(shiftId, { closingCash });
      setCurrentShift(null);
      setShowCloseShift(false);
      toast.success("تم إنهاء الوردية بنجاح");
      
      // Print report logic from legacy
      printShiftReport(closed || currentShift);
    } catch (error) {
      toast.error("فشل إنهاء الوردية");
    } finally {
      setIsClosingShift(false);
    }
  };

  const expectedAmount = currentShift?.total_sales || 0;
  const difference = Number(closingCash) - expectedAmount;

  const printShiftReport = (shift) => {
    const reportHtml = `
      <html dir="rtl" lang="ar">
        <head>
          <meta charset="UTF-8">
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap');
            body { font-family: 'Cairo', sans-serif; padding: 30px; color: #1f2937; background: #fff; }
            .header { text-align: center; border-bottom: 3px solid #D4AF37; padding-bottom: 15px; margin-bottom: 25px; }
            .header h1 { margin: 0; font-size: 24px; font-weight: 900; color: #4A4A4A; }
            .header-meta { font-size: 13px; color: #6b7280; margin-top: 5px; font-weight: 700; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-top: 20px; }
            .item { padding: 15px; border: 1px solid #e5e7eb; border-radius: 16px; background: #f9fafb; }
            .label { font-size: 11px; color: #6b7280; font-weight: 900; text-transform: uppercase; }
            .value { font-size: 20px; font-weight: 900; margin-top: 5px; color: #111827; }
            .footer { text-align: center; margin-top: 40px; font-size: 11px; color: #9ca3af; border-top: 1px dashed #e5e7eb; padding-top: 15px; }
            @media print { body { padding: 0; } }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>تقرير إغلاق الوردية</h1>
            <div class="header-meta">رقم الوردية: #${shift.id} • بتاريخ: ${new Date().toLocaleString('ar-EG')}</div>
          </div>
          <div class="grid">
            <div class="item">
              <div class="label">إجمالي المبيعات</div>
              <div class="value" style="color: #059669">${formatCurrency(shift.total_sales || 0)}</div>
            </div>
            <div class="item">
              <div class="label">عدد الفواتير</div>
              <div class="value">${shift.invoice_count || 0}</div>
            </div>
            <div class="item">
              <div class="label">الخصومات الممنوحة</div>
              <div class="value" style="color: #dc2626">${formatCurrency(shift.discount_total || 0)}</div>
            </div>
            <div class="item">
              <div class="label">الرصيد الافتتاحي</div>
              <div class="value">${formatCurrency(shift.opening_cash || 0)}</div>
            </div>
            <div class="item" style="grid-column: span 2; background: #f3f4f6; border-color: #D4AF37;">
              <div class="label">الرصيد الفعلي عند الإغلاق</div>
              <div class="value" style="font-size: 24px;">${formatCurrency(closingCash)}</div>
            </div>
          </div>
          <div class="footer">
            تم إنشاء التقرير آلياً عبر نظام صالون برو لإدارة المحترفين
          </div>
          <script>window.onload = () => { window.focus(); setTimeout(() => { window.print(); window.close(); }, 500); };</script>
        </body>
      </html>
    `;
    const win = window.open("", "_blank", "width=800,height=600");
    win.document.write(reportHtml);
    win.document.close();
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Shift Control Card */}
      <Card className="p-6 glass-panel border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5 shadow-soft">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Activity className="text-primary" size={20} />
            <h2 className="text-lg font-black text-main">حالة الوردية</h2>
          </div>
          <Badge variant={hasOpenShift ? "success" : "warning"} className="rounded-full px-3 shadow-sm">
            {hasOpenShift ? "مفتوحة" : "مغلقة"}
          </Badge>
        </div>

        {!hasOpenShift ? (
          <div className="space-y-4">
            <p className="text-xs font-bold text-muted">يرجى فتح وردية جديدة لبدء البيع</p>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-muted">الرصيد الافتتاحي</label>
              <Input 
                type="number" 
                value={openingCash}
                onChange={(e) => setOpeningCash(e.target.value)}
                className="h-12 rounded-xl bg-soft/50 border-none font-black text-lg focus:ring-2 ring-primary/20 transition-all"
              />
            </div>
            <Button 
              className="w-full h-12 premium-button" 
              onClick={handleOpenShift}
              loading={isOpeningShift}
            >
              <Zap size={18} className="ml-2" />
              فتح وردية عمل
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex justify-between items-center p-4 rounded-2xl bg-success/10 border border-success/20 shadow-inner">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-full bg-success/20">
                  <Clock size={16} className="text-success" />
                </div>
                <span className="text-xs font-bold text-success">بدأت في:</span>
              </div>
              <span className="text-sm font-black">{new Date(currentShift.opened_at).toLocaleTimeString('ar-EG')}</span>
            </div>
            <Button 
              variant="outline" 
              className="w-full h-12 border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 rounded-xl font-black transition-all"
              onClick={() => setShowCloseShift(true)}
            >
              <LogOut size={18} className="ml-2" />
              إنهاء الوردية
            </Button>
          </div>
        )}
      </Card>

      {/* Quick Summary Tiles */}
      <div className="grid grid-cols-1 gap-4">
        {[
          { label: "جلسات جاهزة", value: readyAppointments.length, icon: Clock, color: "accent" },
          { label: "مبيعات الوردية", value: formatCurrency(currentShift?.total_sales || 0), icon: Wallet, color: "success" },
          { label: "عدد الفواتير", value: currentShift?.invoice_count || 0, icon: CheckCircle2, color: "primary" },
        ].map((tile, i) => (
          <Card key={i} className="p-5 premium-card flex items-center justify-between group hover:shadow-xl transition-all border-none bg-white dark:bg-white/5 shadow-soft">
            <div>
              <p className="text-[10px] font-black text-muted uppercase tracking-wider">{tile.label}</p>
              <p className={`text-2xl font-black text-${tile.color}`}>{tile.value}</p>
            </div>
            <div className={`h-14 w-14 rounded-2xl bg-${tile.color}/10 flex items-center justify-center text-${tile.color} group-hover:scale-110 group-hover:rotate-3 transition-all duration-300`}>
              <tile.icon size={28} />
            </div>
          </Card>
        ))}
      </div>

      {/* Close Shift Dialog */}
      <Dialog open={showCloseShift} onOpenChange={setShowCloseShift}>
        <DialogContent className="max-w-md rounded-[2.5rem] p-8 border-none shadow-2xl" dir="rtl">
          <DialogHeader className="mb-6">
            <DialogTitle className="text-3xl font-black tracking-tight">إنهاء جلسة الكاشير</DialogTitle>
            <DialogDescription className="font-bold text-muted text-base">
              يرجى جرد الصندوق وإدخال المبلغ الفعلي المتوفر الآن.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4">
              <div className="p-5 rounded-[1.5rem] bg-soft/50 border border-border/50 backdrop-blur-sm">
                <div className="flex justify-between items-center text-sm font-bold">
                  <span className="text-muted">المتوقع بالنظام:</span>
                  <span className="text-xl font-black text-main">{formatCurrency(expectedAmount)}</span>
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-xs font-black text-main uppercase tracking-widest mr-1">رصيد الإغلاق الفعلي</label>
                <div className="relative">
                  <Input
                    type="number"
                    value={closingCash}
                    onChange={(e) => setClosingCash(e.target.value)}
                    placeholder="0.00"
                    className="h-16 rounded-2xl font-black text-2xl border-2 border-primary/10 focus:border-primary/40 bg-white dark:bg-white/5 pr-4 pl-12 transition-all shadow-sm"
                  />
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted font-bold text-sm">
                    ريال
                  </div>
                </div>
              </div>

              {/* Difference Indicator - The "Red Line" logic */}
              <div className={cn(
                "p-5 rounded-[1.5rem] border-2 transition-all duration-500 flex justify-between items-center",
                difference === 0 
                  ? "bg-success/5 border-success/20 text-success" 
                  : difference > 0
                    ? "bg-blue-50 border-blue-100 text-blue-600"
                    : "bg-red-50 border-red-200 text-red-600 shadow-[0_0_15px_rgba(220,38,38,0.1)]"
              )}>
                <div className="flex items-center gap-2">
                  {difference < 0 ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}
                  <span className="text-sm font-black uppercase">العجز / الزيادة:</span>
                </div>
                <span className="text-xl font-black tabular-nums">
                  {difference > 0 ? "+" : ""}{formatCurrency(difference)}
                </span>
              </div>
            </div>
          </div>

          <DialogFooter className="mt-8 gap-3 flex-row-reverse">
            <Button
              className="rounded-2xl h-14 font-black text-lg bg-red-600 hover:bg-red-700 text-white flex-1 shadow-lg shadow-red-600/20 transition-all hover:-translate-y-0.5"
              onClick={handleCloseShift}
              loading={isClosingShift}
            >
              <Printer size={20} className="ml-2" />
              إنهاء الوردية والطباعة
            </Button>
            <Button
              variant="ghost"
              onClick={() => setShowCloseShift(false)}
              className="rounded-2xl h-14 px-8 font-black text-muted hover:bg-soft transition-all"
            >
              إلغاء
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ShiftSidebar;
