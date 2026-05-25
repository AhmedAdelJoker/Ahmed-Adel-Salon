import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import api from "../../services/api";
import { normalizeListResponse } from "../../services/apiAdapter";
import { toast } from "react-hot-toast";
import { Link, useNavigate } from "react-router-dom";
import {
  Archive,
  Search,
  UserX,
  History,
  RotateCcw,
  CheckCircle2,
  Trash2,
  Phone,
  Calendar,
  Briefcase,
  ChevronRight,
  ShieldCheck,
  Building2,
  ArrowLeft
} from "lucide-react";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Badge } from "../../components/ui/badge";
import { ConfirmDialog } from "../../components/shared/ConfirmDialog";
import { TableEmptyState } from "../../components/shared/TableEmptyState";

const JOB_TITLES = [
  { value: "owner", label: "مالك" },
  { value: "manager", label: "مدير" },
  { value: "barber", label: "حلاق" },
  { value: "barber_assistant", label: "مساعد حلاق" },
  { value: "cashier", label: "كاشير" },
  { value: "receptionist", label: "استقبال" },
  { value: "inventory_staff", label: "مسؤول مخزن" },
  { value: "accountant", label: "محاسب" },
  { value: "cleaner", label: "عامل نظافة" },
  { value: "other", label: "أخرى" },
];

const STATIC_URL = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace("/api/v1", "")
  : "http://localhost:8000";

const EmployeeArchive = () => {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [confirmTarget, setConfirmTarget] = useState(null);

  const fetchArchive = async () => {
    try {
      setLoading(true);
      const res = await api.get("/employees");
      const allEmployees = normalizeListResponse(res).items;
      const archived = allEmployees.filter(
        (emp) => emp.status === "suspended" || emp.status === "resigned"
      );
      setEmployees(archived);
    } catch (error) {
      toast.error("فشل تحميل أرشيف الموظفين");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchArchive();
  }, []);

  const handleRestore = async () => {
    if (!confirmTarget) return;
    try {
      setIsActionLoading(true);
      await api.put(`/employees/${confirmTarget.id}`, {
        status: "active",
        isActive: true,
      });
      toast.success("تم استعادة الموظف بنجاح");
      setConfirmTarget(null);
      fetchArchive();
    } catch (error) {
      toast.error("فشل استعادة الموظف");
    } finally {
      setIsActionLoading(false);
    }
  };

  const filteredEmployees = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return employees;
    return employees.filter(
      (emp) =>
        emp.fullName?.toLowerCase().includes(query) ||
        emp.phonePrimary?.includes(query) ||
        emp.jobTitle?.toLowerCase().includes(query)
    );
  }, [employees, searchTerm]);

  return (
    <div className="space-y-8 animate-fade-in" dir="rtl">
      <ConfirmDialog
        open={!!confirmTarget}
        onOpenChange={(open) => !open && setConfirmTarget(null)}
        title="استعادة الموظف؟"
        description="هل أنت متأكد من رغبتك في استعادة هذا الموظف للعمل؟ سيتم إرجاع كافة صلاحياته وحسابه كـ نشط."
        onConfirm={handleRestore}
        loading={isActionLoading}
      />

      {/* Header */}
      <div className="relative overflow-hidden rounded-[32px] bg-zinc-950 text-white p-8 lg:p-10 shadow-2xl shadow-black/20 border border-white/5">
        <div className="absolute top-0 left-0 w-[400px] h-[400px] bg-red-600/10 rounded-full blur-[100px] -ml-[200px] -mt-[200px] opacity-60 pointer-events-none" />
        
        <div className="relative z-10 flex flex-col lg:flex-row gap-8 items-start lg:items-center justify-between">
          <div className="flex items-center gap-6">
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigate("/owner/hr")}
              className="w-12 h-12 rounded-2xl bg-white/5 border-white/10 hover:bg-white/10 text-white shadow-sm"
            >
              <ChevronRight size={24} />
            </Button>
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-red-400 to-red-600 flex items-center justify-center text-white shadow-xl shadow-red-500/20 border border-red-400/30">
              <Archive size={32} />
            </div>
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 mb-3 backdrop-blur-md">
                <History size={12} className="text-red-400" />
                <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-red-100">سجل الانقطاعات</span>
              </div>
              <h1 className="text-3xl lg:text-4xl font-black mb-2 leading-tight">
                أرشيف <span className="bg-gradient-to-l from-white to-white/40 bg-clip-text text-transparent">الموظفين</span>
              </h1>
              <p className="text-sm text-white/50 leading-relaxed font-medium">
                سجل الموظفين السابقين، المستقيلين، والموقوفين عن العمل.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4 md:flex-row md:items-center justify-between">
        <div className="relative w-full md:w-96 group">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-accent transition-colors" size={18} />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="بحث بالاسم أو رقم الجوال..."
            className="h-14 pr-12 rounded-2xl bg-card border-border/60 focus:border-accent shadow-sm text-base font-bold"
          />
        </div>
        <div className="flex gap-2">
          <Badge className="h-14 px-6 rounded-2xl bg-card border border-border/60 text-muted-foreground text-sm font-black flex items-center gap-2 shadow-sm">
            <UserX size={18} className="text-danger" />
            الإجمالي: {filteredEmployees.length}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
        {loading ? (
          <div className="col-span-full h-64 flex items-center justify-center">
            <div className="animate-spin text-accent">
              <History size={32} />
            </div>
          </div>
        ) : filteredEmployees.length === 0 ? (
          <div className="col-span-full">
            <Card className="p-12 rounded-[32px] border-dashed border-2 border-border/60 bg-card/50 flex flex-col items-center justify-center text-center">
              <div className="w-20 h-20 bg-soft rounded-full flex items-center justify-center mb-4 text-muted-foreground shadow-inner">
                <Archive size={40} strokeWidth={1.5} />
              </div>
              <h3 className="text-xl font-black text-main mb-2">الأرشيف فارغ</h3>
              <p className="text-sm font-bold text-muted-foreground max-w-md">لا يوجد موظفون موقوفون أو مستقيلون في الأرشيف حالياً، أو لا توجد نتائج تطابق بحثك.</p>
            </Card>
          </div>
        ) : (
          filteredEmployees.map((employee) => (
            <Card key={employee.id} className="rounded-[32px] border-border/60 bg-card p-6 shadow-sm hover:shadow-lg transition-all flex flex-col group">
              <div className="flex justify-between items-start mb-6">
                <Badge variant={employee.status === "resigned" ? "outline" : "destructive"} className="rounded-xl px-4 py-1.5 font-black uppercase tracking-widest text-[10px]">
                  {employee.status === "resigned" ? "مستقيل" : "موقوف إدارياً"}
                </Badge>
                <div className="w-16 h-16 rounded-[20px] bg-soft border border-border flex items-center justify-center overflow-hidden shadow-sm">
                  {employee.profileImageUrl ? (
                    <img src={`${STATIC_URL}${employee.profileImageUrl}`} className="w-full h-full object-cover grayscale opacity-80" alt={employee.fullName} />
                  ) : (
                    <UserX size={24} className="text-muted-foreground/50" />
                  )}
                </div>
              </div>
              
              <div className="mb-6">
                <h3 className="text-xl font-black text-main tracking-tight mb-1">{employee.fullName}</h3>
                <p className="text-sm font-bold text-muted-foreground flex items-center gap-2">
                  <Briefcase size={14} className="text-muted-foreground/70" />
                  {JOB_TITLES.find((j) => j.value === employee.jobTitle)?.label || employee.jobTitle}
                </p>
              </div>

              <div className="space-y-3 mb-8 bg-soft/40 p-4 rounded-2xl border border-border/40 flex-1">
                <div className="flex items-center gap-3 text-sm font-bold text-muted-foreground">
                  <Phone size={16} className="text-main" /> <span dir="ltr">{employee.phonePrimary || "---"}</span>
                </div>
                <div className="flex items-center gap-3 text-sm font-bold text-muted-foreground">
                  <Calendar size={16} className="text-main" /> تاريخ التعيين: <span dir="ltr">{employee.hireDate ? employee.hireDate.split('T')[0] : "---"}</span>
                </div>
              </div>

              <Button
                variant="outline"
                onClick={() => setConfirmTarget(employee)}
                className="w-full h-14 rounded-2xl border-accent/20 text-accent hover:bg-accent hover:text-white font-black text-base shadow-sm transition-all group-hover:border-accent"
              >
                <RotateCcw size={18} className="ml-2" /> إستعادة للعمل
              </Button>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default EmployeeArchive;
