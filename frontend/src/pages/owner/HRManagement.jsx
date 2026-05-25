import { useAuth } from "../../context/AuthContext";
import React, { useEffect, useMemo, useState } from "react";



import { useNavigate, useSearchParams } from "react-router-dom";
import api from "../../services/api";
import exportService from "../../services/exportService";
import { toast } from "react-hot-toast";
import salaryAdvanceService from "../../services/salaryAdvanceService";
import {
  User,
  Phone,
  Calendar,
  TrendingUp,
  Users,
  Scissors,
  Plus,
  Star,
  Pencil,
  Image as ImageIcon,
  DollarSign,
  Briefcase,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  MapPin,
  FileText,
  UserPlus,
  FileDown,
  FileSpreadsheet,
  Save,
  X,
  Activity,
  Trash2,
  Banknote,
  Search,
  Archive,
} from "lucide-react";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Badge } from "../../components/ui/badge";
import { Switch } from "../../components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { ConfirmDialog } from "../../components/shared/ConfirmDialog";
import { normalizeListResponse } from "../../services/apiAdapter";
import { motion, AnimatePresence } from "framer-motion";
import { EmployeeAvatar } from "../../components/shared/EmployeeAvatar";

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

const EMPLOYMENT_TYPES = [
  { value: "full_time", label: "دوام كامل" },
  { value: "part_time", label: "دوام جزئي" },
  { value: "temporary", label: "مؤقت" },
];

const ROLES = [
  { value: "owner", label: "Owner (المالك)" },
  { value: "manager", label: "Manager (المدير)" },
  { value: "cashier", label: "Cashier (الكاشير)" },
  { value: "barber", label: "Barber (حلاق)" },
  { value: "barber_assistant", label: "Barber Assistant (مساعد الحلاق)" },
];

const ASSISTANT_TASKS = [
  "غسيل الشعر",
  "تجهيز العميل",
  "تنظيف الأدوات",
  "تحضير الكرسي",
  "مساعدة في الخدمات الطويلة",
  "تنظيف منطقة العمل",
  "أخرى",
];

const defaultForm = {
  fullName: "",
  displayName: "",
  phonePrimary: "",
  phoneSecondary: "",
  profileImageUrl: "",
  bioAr: "",
  bioEn: "",
  nationalId: "",
  birthDate: "",
  governorate: "",
  city: "",
  detailedAddress: "",
  personalNotes: "",
  jobTitle: "barber",
  department: "",
  employmentType: "full_time",
  hireDate: new Date().toISOString().split("T")[0],
  status: "active",
  showInPos: true,
  showInBooking: true,
  displayOrder: 0,
  baseSalary: 0,
  commissionRate: 0,
  fixedBonus: 0,
  defaultDeductions: 0,
  paymentMethod: "cash",
  walletNumber: "",
  bankAccount: "",
  assistantOfBarberId: "",
  assistantTasksJson: [],
  receivesCommission: false,
  assistantCommissionRate: 0,
  hasLoginAccount: false,
  username: "",
  password: "",
  role: "employee",
};

const STATIC_URL = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace("/api/v1", "")
  : "http://localhost:8000";

const HRManagement = () => {
  const navigate = useNavigate();

  const [searchParams] = useSearchParams();
  const highlightedEmployeeId = searchParams.get("employeeId");

  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [activeView, setActiveView] = useState("cards");
  const [activeTab, setActiveTab] = useState("personal");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmp, setEditingEmp] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [formData, setFormData] = useState(defaultForm);
  const [imagePreview, setImagePreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [advanceTarget, setAdvanceTarget] = useState(null);
  const [advanceData, setAdvanceData] = useState({
    amount: "",
    description: "",
    advanceDate: new Date().toISOString().split("T")[0],
  });
  const [isAdvancing, setIsAdvancing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const filteredEmployees = useMemo(() => {
    let result = employees.filter((emp) => emp.status === "active");
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      result = result.filter(
        (emp) =>
          emp.fullName?.toLowerCase().includes(q) ||
          emp.phonePrimary?.includes(q) ||
          emp.jobTitle?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [employees, searchTerm]);

  const getEmployeeId = (employee) =>
    employee?.id || employee?.employee_id || employee?.employeeId;
  const getEmployeeName = (employee) =>
    employee?.fullName ||
    employee?.full_name ||
    employee?.displayName ||
    employee?.display_name ||
    "موظف";

  const employeeQuery = (employee) => {
    const id = getEmployeeId(employee);
    const name = encodeURIComponent(getEmployeeName(employee));
    return `employeeId=${id}&employeeName=${name}`;
  };

  const openEmployeePayroll = (employee) => {
    const employeeId = getEmployeeId(employee);
    if (!employeeId) return toast.error("لا يمكن تحديد معرف الموظف");
    navigate(`/owner/payroll?${employeeQuery(employee)}`);
  };

  const openEmployeeAttendance = (employee) => {
    const employeeId = getEmployeeId(employee);
    if (!employeeId) return toast.error("لا يمكن تحديد معرف الموظف");
    navigate(`/attendance?${employeeQuery(employee)}`);
  };

  const openEmployeeReports = (employee) => {
    const employeeId = getEmployeeId(employee);
    if (!employeeId) return toast.error("لا يمكن تحديد معرف الموظف");
    navigate(`/owner/employee-reports?${employeeQuery(employee)}`);
  };

  const handleCreateAdvance = async () => {
    if (!advanceTarget || !advanceData.amount) return;
    try {
      setIsAdvancing(true);
      await salaryAdvanceService.create({
        employee_id: advanceTarget.id,
        amount: parseFloat(advanceData.amount),
        description: advanceData.description,
        advance_date: advanceData.advanceDate,
      });
      toast.success("تم تسجيل السلفة بنجاح");
      setAdvanceTarget(null);
      setAdvanceData({ 
        amount: "", 
        description: "", 
        advanceDate: new Date().toISOString().split("T")[0] 
      });
    } catch (error) {
      toast.error("فشل تسجيل السلفة");
    } finally {
      setIsAdvancing(false);
    }
  };

  const [employeeDocs, setEmployeeDocs] = useState([]);
  const [docLoading, setDocLoading] = useState(false);

  const fetchEmployeeDocs = async (empId) => {
    try {
      setDocLoading(true);
      const res = await api.get(`/employees/${empId}/documents`);
      setEmployeeDocs(res.data || []);
    } catch (err) {
      console.error("Failed to fetch documents", err);
    } finally {
      setDocLoading(false);
    }
  };

  const handleDocUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !editingEmp) return;
    
    const formData = new FormData();
    formData.append("file", file);
    formData.append("title", file.name);
    formData.append("file_type", "other");

    try {
      toast.loading("جاري رفع المستند...", { id: "upload-doc" });
      await api.post(`/employees/${editingEmp.id}/documents`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
        params: { title: file.name, file_type: "other" }
      });
      toast.success("تم رفع المستند بنجاح", { id: "upload-doc" });
      fetchEmployeeDocs(editingEmp.id);
    } catch (err) {
      toast.error("فشل رفع المستند", { id: "upload-doc" });
    }
  };

  const handleDeleteDoc = async (docId) => {
    try {
      await api.delete(`/employees/documents/${docId}`);
      toast.success("تم حذف المستند");
      fetchEmployeeDocs(editingEmp.id);
    } catch (err) {
      toast.error("فشل حذف المستند");
    }
  };

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const res = await api.get("/employees");
      setEmployees(normalizeListResponse(res).items);
    } catch (error) {
      toast.error("فشل تحميل بيانات الموظفين");
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  useEffect(() => {
    if (editingEmp && activeTab === "documents") {
      fetchEmployeeDocs(editingEmp.id);
    }
  }, [editingEmp, activeTab]);

  const barbersList = useMemo(
    () =>
      employees.filter((e) => e.jobTitle === "barber" && e.status === "active"),
    [employees],
  );

  const stats = useMemo(() => {
    const active = employees.filter((e) => e.status === "active").length;
    const barbers = employees.filter(
      (e) => e.jobTitle === "barber" && e.status === "active",
    ).length;
    return { active, barbers, total: employees.length };
  }, [employees]);

  const handleImageChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 20 * 1024 * 1024) {
        toast.error("حجم الصورة كبير جداً (الحد الأقصى 20 ميجابايت)");
        return;
      }

      try {
        setUploading(true);
        const uploadData = new FormData();
        uploadData.append("file", file);

        const res = await api.post("/employees/upload-image", uploadData, {
          headers: { "Content-Type": "multipart/form-data" },
        });

        const imageUrl = res.data.url;
        setFormData((prev) => ({ ...prev, profileImageUrl: imageUrl }));
        setImagePreview(`${STATIC_URL}${imageUrl}`);
        toast.success("تم رفع الصورة بنجاح");
      } catch (error) {
        toast.error("فشل رفع الصورة");
      } finally {
        setUploading(false);
      }
    }
  };

  const openCreate = () => {
    setEditingEmp(null);
    setFormData(defaultForm);
    setImagePreview(null);
    setActiveTab("personal");
    setIsModalOpen(true);
  };

  const openEdit = async (emp) => {
    try {
      setIsActionLoading(true);
      const res = await api.get(`/employees/${emp.id}`);
      const data = res.data;
      setEditingEmp(data);
      setFormData({
        ...defaultForm,
        ...data,
        bioAr: data.bioAr || data.bio_ar || "",
        bioEn: data.bioEn || data.bio_en || "",
        birthDate: data.birthDate ? data.birthDate.split("T")[0] : "",
        hireDate: data.hireDate ? data.hireDate.split("T")[0] : "",
        assistantOfBarberId: data.assistantOfBarberId?.toString() || "",
      });
      setImagePreview(
        data.profileImageUrl ? `${STATIC_URL}${data.profileImageUrl}` : null,
      );
      setActiveTab("personal");
      setIsModalOpen(true);
    } catch (error) {
      toast.error("فشل تحميل بيانات الموظف التفصيلية");
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.fullName || !formData.phonePrimary) {
      toast.error("يرجى إدخال الاسم ورقم الجوال الأساسي");
      return;
    }

    if (
      formData.jobTitle === "barber_assistant" &&
      !formData.assistantOfBarberId
    ) {
      toast.error("يرجى اختيار الحلاق المسؤول عن المساعد");
      return;
    }

    try {
      setIsActionLoading(true);

      const payload = {
        ...formData,
        assistantOfBarberId: formData.assistantOfBarberId
          ? parseInt(formData.assistantOfBarberId)
          : null,
      };

      let employeeId = editingEmp?.id;
      if (editingEmp) {
        await api.put(`/employees/${editingEmp.id}`, payload);
        toast.success("تم تحديث بيانات الموظف");
      } else {
        const res = await api.post("/employees", payload);
        employeeId = res.data.id;
        toast.success("تم إضافة الموظف بنجاح");
      }

      if (formData.hasLoginAccount && formData.username && formData.password) {
        try {
          await api.post("/users", {
            username: formData.username,
            password: formData.password,
            full_name: formData.fullName,
            role: formData.role,
            employee_id: employeeId,
            is_active: true,
          });
          toast.success("تم إنشاء حساب الدخول للموظف");
        } catch (userError) {
          toast.error(
            "الموظف تم حفظه ولكن فشل إنشاء حساب الدخول: " +
              (userError.response?.data?.detail || "اسم المستخدم موجود مسبقاً"),
          );
        }
      }

      setIsModalOpen(false);
      fetchEmployees();
    } catch (error) {
      toast.error(error.response?.data?.detail || "فشل حفظ بيانات الموظف");
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!deleteTarget) return;
    try {
      setIsActionLoading(true);
      const nextStatus =
        deleteTarget.status === "active" ? "suspended" : "active";
      await api.put(`/employees/${deleteTarget.id}`, {
        status: nextStatus,
        isActive: nextStatus === "active",
      });
      toast.success(
        nextStatus === "active" ? "تم تفعيل الموظف" : "تم تعطيل الموظف",
      );
      setDeleteTarget(null);
      fetchEmployees();
    } catch (error) {
      toast.error("فشل تعديل حالة الموظف");
    } finally {
      setIsActionLoading(false);
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case "personal":
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="md:col-span-2 flex flex-col items-center gap-6 mb-4">
              <div className="relative group">
                <div className="w-36 h-36 rounded-[32px] bg-soft border-2 border-dashed border-border flex items-center justify-center overflow-hidden ring-8 ring-soft/50">
                  {imagePreview ? (
                    <img
                      src={imagePreview}
                      className="w-full h-full object-cover"
                      alt="Preview"
                    />
                  ) : (
                    <ImageIcon className="w-12 h-12 text-muted" />
                  )}
                </div>
                <label className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 rounded-[32px] cursor-pointer transition-all backdrop-blur-sm">
                  <span className="text-white text-xs font-black uppercase tracking-widest">
                    تغيير الصورة
                  </span>
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={handleImageChange}
                  />
                </label>
              </div>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted">
                الحد الأقصى 20 ميجابايت (PNG, JPG)
              </p>
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-black text-muted uppercase tracking-widest flex items-center gap-2">
                <User size={14} className="text-accent" /> الاسم الكامل للموظف
              </label>
              <Input
                value={formData.fullName || ""}
                onChange={(e) =>
                  setFormData({ ...formData, fullName: e.target.value })
                }
                className="h-14 rounded-xl bg-soft border-border font-bold text-base"
                placeholder="أدخل الاسم الثلاثي..."
              />
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-black text-muted uppercase tracking-widest flex items-center gap-2">
                <Phone size={14} className="text-accent" /> الجوال الأساسي
              </label>
              <Input
                value={formData.phonePrimary || ""}
                onChange={(e) =>
                  setFormData({ ...formData, phonePrimary: e.target.value })
                }
                className="h-14 rounded-xl bg-soft text-left font-black text-lg"
                dir="ltr"
                placeholder="01xxxxxxxxx"
              />
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-black text-muted uppercase tracking-widest flex items-center gap-2">
                <Phone size={14} className="text-muted" /> جوال الطوارئ
              </label>
              <Input
                value={formData.phoneSecondary || "" || ""}
                onChange={(e) =>
                  setFormData({ ...formData, phoneSecondary: e.target.value })
                }
                className="h-14 rounded-xl bg-soft text-left font-bold"
                dir="ltr"
              />
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-black text-muted uppercase tracking-widest flex items-center gap-2">
                <ShieldCheck size={14} className="text-muted" /> رقم الهوية
                الوطنية
              </label>
              <Input
                value={formData.nationalId || "" || ""}
                onChange={(e) =>
                  setFormData({ ...formData, nationalId: e.target.value })
                }
                className="h-14 rounded-xl bg-soft text-left font-bold"
                dir="ltr"
              />
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-black text-muted uppercase tracking-widest flex items-center gap-2">
                <Calendar size={14} className="text-muted" /> تاريخ الميلاد
              </label>
              <Input
                type="date"
                value={formData.birthDate || "" || ""}
                onChange={(e) =>
                  setFormData({ ...formData, birthDate: e.target.value })
                }
                className="h-14 rounded-xl bg-soft font-bold"
              />
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-black text-muted uppercase tracking-widest flex items-center gap-2">
                <MapPin size={14} className="text-muted" /> منطقة السكن
              </label>
              <Input
                value={formData.governorate || "" || ""}
                onChange={(e) =>
                  setFormData({ ...formData, governorate: e.target.value })
                }
                className="h-14 rounded-xl bg-soft font-bold"
                placeholder="المحافظة / المدينة"
              />
            </div>

            <div className="space-y-3 col-span-full">
              <label className="text-[10px] font-black text-muted uppercase tracking-widest flex items-center gap-2">
                <FileText size={14} className="text-accent" /> نبذة مهنية (بالعربية)
              </label>
              <textarea
                value={formData.bioAr || ""}
                onChange={(e) =>
                  setFormData({ ...formData, bioAr: e.target.value })
                }
                className="w-full h-32 rounded-2xl bg-soft border border-border p-5 text-sm font-bold focus:outline-none focus:border-accent transition-all resize-none"
                placeholder="صف خبرة الموظف ومهاراته ليظهر للعملاء في الموقع..."
              />
            </div>

            <div className="space-y-3 col-span-full">
              <label className="text-[10px] font-black text-muted uppercase tracking-widest flex items-center gap-2">
                <FileText size={14} className="text-accent" /> Professional Bio (English)
              </label>
              <textarea
                value={formData.bioEn || ""}
                onChange={(e) =>
                  setFormData({ ...formData, bioEn: e.target.value })
                }
                className="w-full h-32 rounded-2xl bg-soft border border-border p-5 text-sm font-bold focus:outline-none focus:border-accent transition-all resize-none"
                placeholder="Describe employee experience for the public site..."
                dir="ltr"
              />
            </div>
          </div>
        );
      case "work":
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="space-y-3">
              <label className="text-[10px] font-black text-muted uppercase tracking-widest flex items-center gap-2">
                <Briefcase size={14} className="text-accent" /> المسمى الوظيفي
              </label>
              <Select
                value={formData.jobTitle || ""}
                onValueChange={(v) => {
                  const isBarber = v === "barber";
                  setFormData({
                    ...formData,
                    jobTitle: v,
                    showInBooking: isBarber,
                    showInPos: true,
                  });
                }}
              >
                <SelectTrigger className="h-14 rounded-xl bg-soft border-border font-bold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl shadow-premium">
                  {JOB_TITLES.map((jt) => (
                    <SelectItem
                      key={jt.value}
                      value={jt.value || ""}
                      className="font-bold"
                    >
                      {jt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-black text-muted uppercase tracking-widest flex items-center gap-2">
                <Clock size={14} className="text-accent" /> نظام التعاقد
              </label>
              <Select
                value={formData.employmentType || ""}
                onValueChange={(v) =>
                  setFormData({ ...formData, employmentType: v })
                }
              >
                <SelectTrigger className="h-14 rounded-xl bg-soft border-border font-bold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl shadow-premium">
                  {EMPLOYMENT_TYPES.map((et) => (
                    <SelectItem
                      key={et.value}
                      value={et.value || ""}
                      className="font-bold"
                    >
                      {et.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-black text-muted uppercase tracking-widest flex items-center gap-2">
                <Calendar size={14} className="text-muted" /> تاريخ الالتحاق
                بالعمل
              </label>
              <Input
                type="date"
                value={formData.hireDate || "" || ""}
                onChange={(e) =>
                  setFormData({ ...formData, hireDate: e.target.value })
                }
                className="h-14 rounded-xl bg-soft font-bold"
              />
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-black text-muted uppercase tracking-widest flex items-center gap-2">
                <Activity size={14} className="text-accent" /> الحالة الوظيفية
              </label>
              <Select
                value={formData.status || ""}
                onValueChange={(v) =>
                  setFormData({
                    ...formData,
                    status: v,
                    isActive: v === "active",
                  })
                }
              >
                <SelectTrigger className="h-14 rounded-xl bg-soft border-border font-bold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl shadow-premium">
                  <SelectItem value="active" className="font-bold text-success">
                    نشط (Active)
                  </SelectItem>
                  <SelectItem
                    value="suspended"
                    className="font-bold text-danger"
                  >
                    موقوف (Suspended)
                  </SelectItem>
                  <SelectItem value="resigned" className="font-bold text-muted">
                    مستقيل (Resigned)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="md:col-span-2 grid grid-cols-2 gap-6 pt-6 border-t border-border/40">
              <div className="flex items-center justify-between p-5 bg-soft/50 rounded-2xl border border-border/60">
                <div className="space-y-0.5">
                  <div className="text-xs font-black text-main uppercase">
                    الظهور في نقطة البيع
                  </div>
                  <div className="text-[10px] font-bold text-muted uppercase tracking-widest">
                    إتاحة الموظف في شاشة الـ POS
                  </div>
                </div>
                <Switch
                  checked={formData.showInPos}
                  onCheckedChange={(v) =>
                    setFormData({ ...formData, showInPos: v })
                  }
                />
              </div>
              <div className="flex items-center justify-between p-5 bg-soft/50 rounded-2xl border border-border/60">
                <div className="space-y-0.5">
                  <div className="text-xs font-black text-main uppercase">
                    الظهور في الحجوزات
                  </div>
                  <div className="text-[10px] font-bold text-muted uppercase tracking-widest">
                    إتاحة الموظف لجدولة المواعيد
                  </div>
                </div>
                <Switch
                  checked={formData.showInBooking}
                  onCheckedChange={(v) =>
                    setFormData({ ...formData, showInBooking: v })
                  }
                />
              </div>
            </div>
          </div>
        );
      case "financial":
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="space-y-3">
              <label className="text-[10px] font-black text-muted uppercase tracking-widest flex items-center gap-2">
                <DollarSign size={14} className="text-success" /> الراتب الأساسي
                المعتمد
              </label>
              <div className="relative">
                <Input
                  type="number"
                  value={formData.baseSalary || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      baseSalary: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="h-14 rounded-xl bg-soft border-border font-black text-lg pr-14"
                />
                <span className="absolute right-5 top-1/2 -translate-y-1/2 text-[10px] font-black text-muted uppercase">
                  ج.م
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-black text-muted uppercase tracking-widest flex items-center gap-2">
                <TrendingUp size={14} className="text-info" /> نسبة العمولة
                التشغيلية
              </label>
              <div className="relative">
                <Input
                  type="number"
                  value={formData.commissionRate || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      commissionRate: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="h-14 rounded-xl bg-soft border-border font-black text-lg pr-14"
                />
                <span className="absolute right-5 top-1/2 -translate-y-1/2 text-[10px] font-black text-muted uppercase">
                  %
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-black text-muted uppercase tracking-widest flex items-center gap-2">
                <Plus size={14} className="text-success" /> الحوافز الشهرية
                الثابتة
              </label>
              <Input
                type="number"
                value={formData.fixedBonus || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    fixedBonus: parseFloat(e.target.value) || 0,
                  })
                }
                className="h-14 rounded-xl bg-soft font-bold text-base"
              />
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-black text-muted uppercase tracking-widest flex items-center gap-2">
                <Trash2 size={14} className="text-danger" /> الخصومات الافتراضية
              </label>
              <Input
                type="number"
                value={formData.defaultDeductions || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    defaultDeductions: parseFloat(e.target.value) || 0,
                  })
                }
                className="h-14 rounded-xl bg-soft font-bold text-base"
              />
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-black text-muted uppercase tracking-widest flex items-center gap-2">
                قناة صرف المستحقات
              </label>
              <Select
                value={formData.paymentMethod || ""}
                onValueChange={(v) =>
                  setFormData({ ...formData, paymentMethod: v })
                }
              >
                <SelectTrigger className="h-14 rounded-xl bg-soft border-border font-bold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="cash" className="font-bold">
                    نقدي (Cash)
                  </SelectItem>
                  <SelectItem value="wallet" className="font-bold">
                    محفظة إلكترونية (E-Wallet)
                  </SelectItem>
                  <SelectItem value="bank" className="font-bold">
                    تحويل بنكي (Bank Transfer)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-black text-muted uppercase tracking-widest flex items-center gap-2">
                رقم الحساب / المحفظة
              </label>
              <Input
                value={
                  formData.walletNumber || formData.bankAccount || "" || ""
                }
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    walletNumber: e.target.value,
                    bankAccount: e.target.value,
                  })
                }
                className="h-14 rounded-xl bg-soft text-left font-black tracking-tight"
                dir="ltr"
                placeholder="IBAN or Phone Number"
              />
            </div>
          </div>
        );
      case "assistant":
        return (
          <div className="grid grid-cols-1 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
            {formData.jobTitle !== "barber_assistant" && (
              <Card className="p-5 border-info/20 bg-info-soft/10 shadow-none flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-info/20 flex items-center justify-center text-info shrink-0">
                  <Activity size={20} />
                </div>
                <p className="text-xs font-bold text-info leading-relaxed">
                  هذا القسم مخصص فقط لتحديد تبعية الموظف إذا كان يعمل بصفة
                  "مساعد حلاق". المساعدين يرتبطون بخبراء محددين لضمان دقة
                  التقارير.
                </p>
              </Card>
            )}
            <div className="space-y-3">
              <label className="text-[10px] font-black text-muted uppercase tracking-widest flex items-center gap-2">
                الحلاق المسؤول (Supervisor)
              </label>
              <Select
                value={formData.assistantOfBarberId || ""}
                onValueChange={(v) =>
                  setFormData({ ...formData, assistantOfBarberId: v })
                }
              >
                <SelectTrigger className="h-14 rounded-xl bg-soft border-border font-bold text-main">
                  <SelectValue placeholder="اختر الخبير المسؤول..." />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {barbersList.map((b) => (
                    <SelectItem
                      key={b.id}
                      value={b.id.toString() || ""}
                      className="font-bold"
                    >
                      {b.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-4">
              <label className="text-[10px] font-black text-muted uppercase tracking-widest flex items-center gap-2">
                بروتوكول المهام المسندة
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {ASSISTANT_TASKS.map((task) => (
                  <button
                    type="button"
                    key={task}
                    onClick={() => {
                      const current = formData.assistantTasksJson || [];
                      const next = current.includes(task)
                        ? current.filter((t) => t !== task)
                        : [...current, task];
                      setFormData({ ...formData, assistantTasksJson: next });
                    }}
                    className={`text-right px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${formData.assistantTasksJson?.includes(task) ? "bg-accent text-white border-accent shadow-lg shadow-accent/20" : "bg-soft text-muted border-border hover:bg-card hover:text-accent"}`}
                  >
                    {task}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between p-6 bg-soft/50 rounded-2xl border border-border/60">
              <div className="space-y-0.5">
                <div className="text-xs font-black text-main uppercase">
                  عمولة المساعد
                </div>
                <div className="text-[10px] font-bold text-muted uppercase tracking-widest">
                  هل يتقاضى الموظف نسبة إضافية مقابل كل عملية مساعدة؟
                </div>
              </div>
              <Switch
                checked={formData.receivesCommission}
                onCheckedChange={(v) =>
                  setFormData({ ...formData, receivesCommission: v })
                }
              />
            </div>

            {formData.receivesCommission && (
              <div className="space-y-3 animate-in slide-in-from-top-4 duration-300">
                <label className="text-[10px] font-black text-muted uppercase tracking-widest">
                  نسبة عمولة المساعد المعتمدة %
                </label>
                <Input
                  type="number"
                  value={formData.assistantCommissionRate || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      assistantCommissionRate: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="h-14 rounded-xl bg-soft border-border font-black text-lg"
                />
              </div>
            )}
          </div>
        );
      case "documents":
        return (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="flex items-center justify-between p-6 bg-soft/50 rounded-2xl border border-border/60">
              <div className="space-y-1">
                <h4 className="text-sm font-black text-main uppercase">المرفقات والوثائق الرسمية</h4>
                <p className="text-[10px] font-bold text-muted uppercase tracking-widest">رفع الهويات، عقود العمل، والشهادات الصحية</p>
              </div>
              <label className="cursor-pointer">
                <Button variant="outline" className="h-11 px-6 rounded-xl border-accent/20 text-accent font-black text-[10px] uppercase tracking-widest hover:bg-accent hover:text-white transition-all pointer-events-none">
                  <Plus className="ml-2" size={16} /> رفع مستند جديد
                </Button>
                <input type="file" className="hidden" onChange={handleDocUpload} />
              </label>
            </div>

            {docLoading ? (
              <div className="flex flex-col items-center justify-center py-12 gap-4">
                <Activity className="w-8 h-8 text-accent animate-pulse" />
                <p className="text-[10px] font-black text-muted uppercase tracking-widest">جاري جلب المستندات المؤرشفة...</p>
              </div>
            ) : employeeDocs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-20 h-20 rounded-full bg-soft flex items-center justify-center text-muted/40 mb-4">
                  <FileText size={32} />
                </div>
                <p className="text-xs font-bold text-muted">لا يوجد مستندات مؤرشفة لهذا الموظف حالياً.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {employeeDocs.map((doc) => (
                  <div key={doc.id} className="p-4 bg-white border border-border/60 rounded-2xl flex items-center justify-between group hover:border-accent/40 transition-all">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-accent-soft flex items-center justify-center text-accent">
                        <FileText size={20} />
                      </div>
                      <div className="space-y-0.5">
                        <div className="text-xs font-black text-main line-clamp-1">{doc.title}</div>
                        <div className="text-[9px] font-bold text-muted uppercase tracking-widest">
                          {new Date(doc.created_at).toLocaleDateString('ar-EG')}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 rounded-lg text-info hover:bg-info-soft"
                        onClick={() => window.open(`${STATIC_URL}${doc.file_url}`, '_blank')}
                      >
                        <FileDown size={16} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 rounded-lg text-danger hover:bg-danger-soft"
                        onClick={() => handleDeleteDoc(doc.id)}
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      case "system":
        return (
          <div className="grid grid-cols-1 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="flex items-center justify-between p-6 bg-accent-soft/30 rounded-2xl border border-accent/20">
              <div className="flex items-center gap-5">
                <div className="w-14 h-14 rounded-2xl bg-accent flex items-center justify-center text-white shadow-lg shadow-accent/20">
                  <UserPlus size={28} strokeWidth={2} />
                </div>
                <div className="space-y-0.5">
                  <div className="text-sm font-black text-accent uppercase">
                    صلاحيات دخول النظام
                  </div>
                  <div className="text-[10px] font-bold text-main/60 uppercase tracking-widest">
                    تفعيل حساب دخول للوحة التحكم أو تطبيق الخبراء
                  </div>
                </div>
              </div>
              <Switch
                checked={formData.hasLoginAccount}
                onCheckedChange={(v) =>
                  setFormData({ ...formData, hasLoginAccount: v })
                }
              />
            </div>

            {formData.hasLoginAccount && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-8 border border-border/60 bg-soft/20 rounded-[28px] animate-in slide-in-from-top-6 duration-300 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-accent/5 rounded-full blur-3xl -mr-16 -mt-16" />
                <div className="space-y-3 relative z-10">
                  <label className="text-[10px] font-black text-muted uppercase tracking-widest">
                    اسم المستخدم (Unique ID)
                  </label>
                  <Input
                    value={formData.username || "" || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, username: e.target.value })
                    }
                    className="h-14 rounded-xl bg-white border-border text-left font-black"
                    dir="ltr"
                    placeholder="example.user"
                  />
                </div>
                <div className="space-y-3 relative z-10">
                  <label className="text-[10px] font-black text-muted uppercase tracking-widest">
                    كلمة المرور المشفرة
                  </label>
                  <Input
                    type="password"
                    value={formData.password || "" || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, password: e.target.value })
                    }
                    className="h-14 rounded-xl bg-white border-border text-left font-black"
                    dir="ltr"
                    placeholder={
                      editingEmp ? "••••••••" : "أدخل كلمة المرور..."
                    }
                  />
                  {editingEmp && (
                    <p className="text-[9px] font-bold text-muted">
                      * اتركها فارغة إذا لم ترغب في التغيير
                    </p>
                  )}
                </div>
                <div className="space-y-3 md:col-span-2 relative z-10">
                  <label className="text-[10px] font-black text-muted uppercase tracking-widest">
                    مستوى الوصول (Access Role)
                  </label>
                  <Select
                    value={formData.role || ""}
                    onValueChange={(v) => setFormData({ ...formData, role: v })}
                  >
                    <SelectTrigger className="h-14 rounded-xl bg-white border-border font-bold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {ROLES.map((r) => (
                        <SelectItem
                          key={r.value}
                          value={r.value || ""}
                          className="font-bold"
                        >
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <div className="space-y-3">
              <label className="text-[10px] font-black text-muted uppercase tracking-widest flex items-center gap-2">
                <FileText size={14} className="text-muted" /> ملاحظات الملف
                الإداري
              </label>
              <textarea
                value={formData.personalNotes || "" || ""}
                onChange={(e) =>
                  setFormData({ ...formData, personalNotes: e.target.value })
                }
                className="w-full h-32 rounded-2xl bg-soft border border-border p-5 text-sm font-medium focus:outline-none focus:border-accent transition-all resize-none"
                placeholder="سجل أي ملاحظات إدارية، سلوكية، أو فنية تخص الموظف..."
              />
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[500px] items-center justify-center erp-page-container">
        <div className="flex flex-col items-center gap-4 text-accent">
          <Activity className="w-12 h-12 animate-pulse" />
          <p className="text-[10px] font-black uppercase tracking-widest text-muted">
            مزامنة قاعدة بيانات الموظفين...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-24 erp-page-container" dir="rtl">
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={
          deleteTarget?.status === "active"
            ? "تعطيل صلاحيات الموظف؟"
            : "إعادة تفعيل الموظف؟"
        }
        description={`سيتم تعديل حالة ${deleteTarget?.fullName || "الموظف"} التشغيلية وإمكانية دخوله للنظام.`}
        onConfirm={handleToggleStatus}
        loading={isActionLoading}
      />

      <Dialog
        open={!!advanceTarget}
        onOpenChange={(open) => !open && setAdvanceTarget(null)}
      >
        <DialogContent className="sm:max-w-[450px] rounded-[32px] p-0 overflow-hidden border-none shadow-premium">
          <DialogHeader className="p-8 pb-0">
            <DialogTitle className="text-2xl font-black text-main flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-success/10 flex items-center justify-center text-success">
                <Banknote size={24} />
              </div>
              تسجيل سلفة مالية
            </DialogTitle>
            <DialogDescription className="text-sm font-bold text-muted mt-2">
              سيتم تسجيل السلفة كمصروف (بند سلف) وخصمها تلقائياً من راتب{" "}
              <span className="text-accent">{advanceTarget?.fullName}</span>{" "}
              لشهر {new Date().toLocaleString("ar-EG", { month: "long" })}.
            </DialogDescription>
          </DialogHeader>

          <div className="p-8 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <label className="text-[10px] font-black text-muted uppercase tracking-widest flex items-center gap-2">
                  <DollarSign size={14} className="text-success" /> قيمة السلفة (ج.م)
                </label>
                <Input
                  type="number"
                  value={advanceData.amount || ""}
                  onChange={(e) =>
                    setAdvanceData({ ...advanceData, amount: e.target.value })
                  }
                  placeholder="المبلغ..."
                  className="h-14 rounded-xl bg-soft border-border font-black text-lg"
                />
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black text-muted uppercase tracking-widest flex items-center gap-2">
                  <Calendar size={14} className="text-info" /> تاريخ السلفة
                </label>
                <Input
                  type="date"
                  value={advanceData.advanceDate || ""}
                  onChange={(e) =>
                    setAdvanceData({ ...advanceData, advanceDate: e.target.value })
                  }
                  className="h-14 rounded-xl bg-soft border-border font-bold"
                />
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-black text-muted uppercase tracking-widest flex items-center gap-2">
                <FileText size={14} className="text-muted" /> بيان السلفة / السبب
              </label>
              <textarea
                value={advanceData.description || ""}
                onChange={(e) =>
                  setAdvanceData({
                    ...advanceData,
                    description: e.target.value,
                  })
                }
                placeholder="اكتب تفاصيل السلفة هنا..."
                className="w-full h-24 rounded-2xl bg-soft border border-border p-4 text-sm font-bold focus:outline-none focus:border-accent transition-all resize-none"
              />
            </div>
          </div>

          <DialogFooter className="p-8 pt-0 flex gap-3">
            <Button
              variant="outline"
              disabled={loading}
              onClick={() => setAdvanceTarget(null)}
              className="h-12 flex-1 rounded-xl font-black uppercase tracking-widest"
            >
              إلغاء
            </Button>
            <Button
              variant="primary"
              disabled={loading}
              onClick={handleCreateAdvance}
              loading={isAdvancing}
              disabled={!advanceData.amount}
              className="h-12 flex-[2] rounded-xl font-black text-base shadow-lg shadow-success/20 bg-success hover:bg-success/90"
            >
              تأكيد السلفة <CheckCircle2 className="mr-2" size={18} />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
        <div className="space-y-1">
          <h1 className="text-4xl font-black text-main uppercase tracking-tight leading-none">
            إدارة الموظفين
          </h1>
          <p className="text-base font-medium text-muted">
            {stats.active} من أصل {stats.total} موظف نشط في المنظومة حالياً
          </p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-3 md:w-auto">
          <Button
            type="button"
            variant="outline"
            title="تصدير سجل الموظفين إلى Excel"
            onClick={() =>
              exportService.downloadExcel(
                "/exports/employees/excel",
                "employees_report",
              )
            }
            className="h-12 rounded-xl border-border px-6 text-xs font-black uppercase tracking-widest"
          >
            Excel <FileSpreadsheet className="mr-2 text-success" size={16} />
          </Button>
          <Button
            type="button"
            variant="outline"
            title="تصدير سجل الموظفين إلى CSV"
            onClick={() =>
              exportService.downloadCsv(
                "/exports/employees/csv",
                "employees_report",
              )
            }
            className="h-12 rounded-xl border-border px-6 text-xs font-black uppercase tracking-widest"
          >
            CSV <FileDown className="mr-2 text-info" size={16} />
          </Button>
          <Button
            type="button"
            variant="primary"
            title="إضافة ملف موظف جديد للمنظومة"
            disabled={loading}
            onClick={openCreate}
            className="h-12 flex-1 rounded-xl px-10 md:flex-none shadow-lg shadow-accent/20 font-black text-lg"
          >
            <Plus className="ml-2" size={20} strokeWidth={2.5} /> إضافة موظف
          </Button>
          <Button
            type="button"
            variant="outline"
            title="أرشيف الموظفين"
            disabled={loading}
            onClick={() => navigate("/owner/hr/archive")}
            className="h-12 flex-1 rounded-xl px-10 md:flex-none shadow-sm text-danger border-danger/30 hover:bg-danger hover:text-white transition-all font-black"
          >
            <Archive className="ml-2" size={20} /> الأرشيف
          </Button>
        </div>
      </div>

      <div className="relative w-full group">
        <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-muted group-focus-within:text-accent transition-colors" size={20} />
        <Input
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="بحث سريع باسم الموظف أو رقم الجوال..."
          className="h-14 pr-12 rounded-2xl bg-card border-border/60 focus:border-accent shadow-sm text-base font-bold"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 pt-2">
        <div className="rounded-premium border border-border/60 bg-card p-7 shadow-soft flex items-center gap-6 group hover:border-accent/20 transition-all">
          <div className="w-16 h-16 rounded-2xl bg-accent flex items-center justify-center text-white shadow-lg shadow-accent/20 transition-transform group-hover:scale-105">
            <Users size={28} strokeWidth={2} />
          </div>
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-muted mb-1">
              إجمالي الكادر
            </div>
            <div className="text-3xl font-black text-main tracking-tighter">
              {stats.total}{" "}
              <small className="text-[10px] font-bold mr-1">موظف</small>
            </div>
          </div>
        </div>

        <div className="rounded-premium border border-border/60 bg-card p-7 shadow-soft flex items-center gap-6 group hover:border-accent/20 transition-all">
          <div className="w-16 h-16 rounded-2xl bg-info flex items-center justify-center text-white shadow-lg shadow-info/20 transition-transform group-hover:scale-105">
            <Scissors size={28} strokeWidth={2} />
          </div>
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-muted mb-1">
              الحلاقون
            </div>
            <div className="text-3xl font-black text-main tracking-tighter">
              {stats.barbers}{" "}
              <small className="text-[10px] font-bold mr-1">خبير</small>
            </div>
          </div>
        </div>

        <div className="rounded-premium border border-border/60 bg-card p-7 shadow-soft flex items-center gap-6 group hover:border-accent/20 transition-all">
          <div className="w-16 h-16 rounded-2xl bg-warning flex items-center justify-center text-white shadow-lg shadow-warning/20 transition-transform group-hover:scale-105">
            <UserPlus size={28} strokeWidth={2} />
          </div>
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-muted mb-1">
              المساعدون
            </div>
            <div className="text-3xl font-black text-main tracking-tighter">
              {
                employees.filter((e) => e.jobTitle === "barber_assistant")
                  .length
              }{" "}
              <small className="text-[10px] font-bold mr-1">موظف</small>
            </div>
          </div>
        </div>
      </div>

      <Card className="p-4 border-border/60">
        <div className="flex items-center gap-2 bg-soft p-1.5 rounded-2xl border border-border w-fit mx-auto sm:mx-0">
          <button
            type="button"
            disabled={loading}
            onClick={() => setActiveView("cards")}
            className={`px-8 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeView === "cards" ? "bg-accent text-white shadow-soft" : "text-muted hover:bg-card hover:text-accent"}`}
          >
            عرض البطاقات
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => setActiveView("table")}
            className={`px-8 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeView === "table" ? "bg-accent text-white shadow-soft" : "text-muted hover:bg-card hover:text-accent"}`}
          >
            عرض الجدول
          </button>
        </div>
      </Card>

      {activeView === "cards" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
          {filteredEmployees.map((employee) => (
            <motion.div
              layout
              key={employee.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`bg-card border border-border/60 rounded-premium p-8 shadow-soft hover:shadow-premium transition-all relative group overflow-hidden ${String(getEmployeeId(employee)) === String(highlightedEmployeeId) ? "ring-2 ring-accent/40 border-accent/40" : ""} ${employee.status !== "active" ? "opacity-60" : ""}`}
            >
              {employee.status !== "active" && (
                <div className="absolute top-0 right-0 left-0 bg-danger/10 text-danger text-[10px] font-black uppercase py-1 text-center border-b border-danger/20 z-10">
                  معلق إداريًا
                </div>
              )}

              <div className="absolute top-8 left-8 flex gap-3 z-20">
                <Button
                  variant="secondary"
                  size="icon"
                  disabled={loading}
                  onClick={() => openEmployeePayroll(employee)}
                  className="w-10 h-10 rounded-xl border border-border group-hover:border-accent/20 shadow-sm text-accent"
                  title="فتح ملف الراتب"
                >
                  <DollarSign size={18} strokeWidth={2} />
                </Button>
                <Button
                  variant="secondary"
                  size="icon"
                  disabled={loading}
                  onClick={() => openEmployeeAttendance(employee)}
                  className="w-10 h-10 rounded-xl border border-border group-hover:border-accent/20 shadow-sm text-info"
                  title="فتح سجل الحضور"
                >
                  <Clock size={18} strokeWidth={2} />
                </Button>
                <Button
                  variant="secondary"
                  size="icon"
                  disabled={loading}
                  onClick={() => openEmployeeReports(employee)}
                  className="w-10 h-10 rounded-xl border border-border group-hover:border-accent/20 shadow-sm text-warning"
                  title="فتح تقرير الموظف"
                >
                  <FileText size={18} strokeWidth={2} />
                </Button>

                <Button
                  variant="secondary"
                  size="icon"
                  disabled={loading}
                  onClick={() => setAdvanceTarget(employee)}
                  className="w-10 h-10 rounded-xl border border-border group-hover:border-accent/20 shadow-sm text-success"
                  title="تسجيل سلفة"
                >
                  <Banknote size={18} strokeWidth={2} />
                </Button>
                <Button
                  variant="secondary"
                  size="icon"
                  disabled={loading}
                  onClick={() => openEdit(employee)}
                  className="w-10 h-10 rounded-xl border border-border group-hover:border-accent/20 shadow-sm"
                  title="تعديل السجل"
                >
                  <Pencil size={18} strokeWidth={2} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={loading}
                  onClick={() => setDeleteTarget(employee)}
                  className={`w-10 h-10 rounded-xl transition-all ${employee.status === "active" ? "hover:bg-danger-soft text-danger/40 hover:text-danger" : "hover:bg-success-soft text-success/40 hover:text-success"}`}
                  title={
                    employee.status === "active"
                      ? "إيقاف الصلاحيات"
                      : "تفعيل الصلاحيات"
                  }
                >
                  {employee.status === "active" ? (
                    <XCircle size={18} strokeWidth={2.5} />
                  ) : (
                    <CheckCircle2 size={18} strokeWidth={2.5} />
                  )}
                </Button>
              </div>

              <div className="flex flex-col items-center text-center">
                <EmployeeAvatar
                    imageUrl={employee.profileImageUrl || employee.profile_image_url}
                    name={employee.fullName}
                    size="xl"
                    className="mb-6 group-hover:scale-105 transition-transform"
                />

                <div className="space-y-1">
                  <h3 className="text-xl font-black text-main leading-tight tracking-tight">
                    {employee.fullName || "موظف مجهول"}
                  </h3>
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-[10px] font-black text-accent uppercase tracking-widest">
                      {JOB_TITLES.find((j) => j.value === employee.jobTitle)
                        ?.label || employee.jobTitle}
                    </span>
                    <span className="w-1 h-1 rounded-full bg-border" />
                    <span className="text-[10px] font-bold text-muted uppercase tracking-widest">
                      {EMPLOYMENT_TYPES.find(
                        (et) => et.value === employee.employmentType,
                      )?.label || "دوام كامل"}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 w-full mt-10">
                  <div className="p-4 bg-soft/50 rounded-2xl border border-border/40 text-center">
                    <div className="text-[9px] font-black text-muted uppercase tracking-widest mb-1.5 leading-none">
                      الراتب الأساسي
                    </div>
                    <div className="text-base font-black text-accent tracking-tighter leading-none">
                      {(employee.baseSalary || 0).toLocaleString()}{" "}
                      <small className="text-[10px] font-bold">ج.م</small>
                    </div>
                  </div>
                  <div className="p-4 bg-soft/50 rounded-2xl border border-border/40 text-center">
                    <div className="text-[9px] font-black text-muted uppercase tracking-widest mb-1.5 leading-none">
                      العمولة الحالية
                    </div>
                    <div className="text-base font-black text-main tracking-tighter leading-none">
                      {employee.commissionRate || 0}
                      <small className="text-[10px] font-bold mr-0.5">%</small>
                    </div>
                  </div>
                </div>

                <div className="mt-8 pt-6 border-t border-border/40 w-full flex flex-col gap-3">
                  <div className="flex items-center justify-between text-xs font-bold text-muted">
                    <span className="flex items-center gap-2">
                      <Phone
                        size={14}
                        className="text-accent"
                        strokeWidth={2.5}
                      />{" "}
                      {employee.phonePrimary || "---"}
                    </span>
                    <span className="flex items-center gap-2 uppercase tracking-tight">
                      <Calendar size={14} /> منذ{" "}
                      {new Date(employee.hireDate).getFullYear()}
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <Card className="rounded-premium border-border/60 bg-card shadow-soft overflow-hidden transition-all hover:shadow-premium">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-right">
              <thead>
                <tr className="border-b border-border bg-soft/50">
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-muted">
                    الموظف
                  </th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-muted">
                    المسمى الوظيفي
                  </th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-muted">
                    الجوال
                  </th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-muted text-center">
                    الراتب
                  </th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-muted text-center">
                    الحالة
                  </th>
                  <th className="px-8 py-5 text-center text-[10px] font-black uppercase tracking-widest text-muted">
                    الإجراءات
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {filteredEmployees.map((employee) => (
                  <tr
                    key={employee.id}
                    className="group transition-all hover:bg-accent-subtle/30"
                  >
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-4">
                        <EmployeeAvatar
                            imageUrl={employee.profileImageUrl || employee.profile_image_url}
                            name={employee.fullName}
                            size="sm"
                            className="group-hover:scale-110 transition-transform"
                        />
                        <div className="space-y-0.5">
                          <div className="text-sm font-black text-main leading-none group-hover:text-accent transition-colors">
                            {employee.fullName}
                          </div>
                          <div className="text-[9px] font-bold text-muted uppercase tracking-widest">
                            معرف: #HR-{employee.id}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <Badge
                        variant="outline"
                        className="h-6 px-3 font-black text-[9px] uppercase tracking-widest"
                      >
                        {JOB_TITLES.find((j) => j.value === employee.jobTitle)
                          ?.label || employee.jobTitle}
                      </Badge>
                    </td>
                    <td
                      className="px-8 py-5 text-sm font-bold text-muted"
                      dir="ltr"
                    >
                      {employee.phonePrimary}
                    </td>
                    <td className="px-8 py-5 text-center">
                      <span className="text-sm font-black text-accent tracking-tighter">
                        {employee.baseSalary.toLocaleString()}{" "}
                        <small className="text-[10px] font-bold">ج.م</small>
                      </span>
                    </td>
                    <td className="px-8 py-5 text-center">
                      <Badge
                        variant={
                          employee.status === "active" ? "success" : "danger"
                        }
                        className="h-6 px-4 font-black text-[9px] uppercase tracking-widest"
                      >
                        {employee.status === "active"
                          ? "نشط حالياً"
                          : "معطل إدارياً"}
                      </Badge>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex items-center justify-center gap-3">
                        <Button
                          type="button"
                          variant="secondary"
                          size="icon"
                          disabled={loading}
                          onClick={() => setAdvanceTarget(employee)}
                          className="h-9 w-9 rounded-xl border border-border group-hover:border-accent/20 transition-all shadow-sm text-success"
                          title="تسجيل سلفة"
                        >
                          <Banknote size={16} />
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          size="icon"
                          disabled={loading}
                          onClick={() => openEdit(employee)}
                          className="h-9 w-9 rounded-xl border border-border group-hover:border-accent/20 transition-all shadow-sm"
                          title="تحديث ملف الموظف"
                        >
                          <Pencil size={16} strokeWidth={2.5} />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          disabled={loading}
                          onClick={() => setDeleteTarget(employee)}
                          className={`h-9 w-9 rounded-xl transition-all ${employee.status === "active" ? "hover:bg-danger-soft text-danger/40 hover:text-danger" : "hover:bg-success-soft text-success/40 hover:text-success"}`}
                          title={
                            employee.status === "active"
                              ? "تعطيل الصلاحيات"
                              : "إعادة تفعيل الموظف"
                          }
                        >
                          {employee.status === "active" ? (
                            <Trash2 size={16} strokeWidth={2.5} />
                          ) : (
                            <CheckCircle2 size={16} strokeWidth={2.5} />
                          )}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent
          className="max-w-4xl max-h-[95vh] overflow-hidden rounded-[32px] bg-card border border-border shadow-premium p-0 flex flex-col"
          dir="rtl"
        >
          <DialogHeader className="text-right p-8 pb-4 bg-[#1B1714] relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-accent/5 rounded-full blur-[80px] -mr-32 -mt-32" />
            <div className="relative z-10">
              <DialogTitle className="text-3xl font-black text-white tracking-tight">
                {editingEmp ? "تحديث السجل الوظيفي" : "إضافة كادر وظيفي جديد"}
              </DialogTitle>
              <DialogDescription className="text-sm font-medium text-white/50 mt-2 uppercase tracking-widest">
                {editingEmp
                  ? `تعديل بيانات الموظف: ${editingEmp.fullName}`
                  : "أدخل تفاصيل الموظف والبيانات المالية بدقة"}
              </DialogDescription>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto custom-scrollbar">
            <div className="p-8">
              <div className="flex items-center gap-2 bg-soft p-1.5 rounded-2xl border border-border mb-10 overflow-x-auto custom-scrollbar shrink-0">
                {[
                  { id: "personal", label: "البيانات الشخصية", icon: User },
                  { id: "work", label: "تفاصيل العمل", icon: Briefcase },
                  {
                    id: "financial",
                    label: "الحسابات المالية",
                    icon: DollarSign,
                  },
                  { id: "assistant", label: "قسم المساعدين", icon: Scissors },
                  { id: "documents", label: "المستندات", icon: FileText },
                  { id: "system", label: "صلاحيات النظام", icon: ShieldCheck },
                ].map((tab) => (
                  <button
                    type="button"
                    key={tab.id}
                    disabled={loading}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex-1 flex items-center justify-center gap-3 py-3 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === tab.id ? "bg-accent text-white shadow-lg shadow-accent/20" : "text-muted hover:bg-white hover:text-accent"}`}
                  >
                    <tab.icon size={16} strokeWidth={2.5} />
                    <span>{tab.label}</span>
                  </button>
                ))}
              </div>

              <div className="min-h-[450px] erp-form-content">
                {renderTabContent()}
              </div>
            </div>
          </div>

          <DialogFooter className="p-8 pt-6 border-t border-border bg-card flex gap-4">
            <Button
              variant="secondary"
              disabled={loading}
              onClick={() => setIsModalOpen(false)}
              className="flex-1 rounded-xl font-black uppercase tracking-widest h-14"
            >
              إلغاء الأمر
            </Button>
            <Button
              variant="primary"
              loading={isActionLoading}
              disabled={loading}
              onClick={handleSubmit}
              className="flex-[2] rounded-xl font-black text-lg h-14 shadow-lg shadow-accent/20"
            >
              <Save size={20} className="ml-2" />
              {editingEmp ? "تحديث ملف الموظف" : "اعتماد إضافة الموظف"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default HRManagement;

