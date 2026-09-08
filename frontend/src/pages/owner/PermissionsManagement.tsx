import React, { useState, useEffect } from "react";

import api from "@/services/api";
import { toast } from "react-hot-toast";
import {
  ShieldCheck,
  User,
  Phone,
  Award,
  Lock,
  Edit3,
  Trash2,
  Power,
  Search,
  Plus,
  Shield,
  Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import type { ManagedUser } from "@/types/employee";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

type ConfirmAction =
  | { type: "toggle"; payload: ManagedUser; id?: never }
  | { type: "delete"; id: string | number; payload?: never };

const PermissionsManagement = () => {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [formData, setFormData] = useState({
    fullName: "",
    username: "",
    password: "",
    role: "CASHIER",
    phone: "",
    specialty: "",
    status: "ACTIVE",
    isActive: true,
  });

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await api.get("/users");
      const data = res.data;
      const usersList = Array.isArray(data) ? data : data.items || [];
      setUsers(
        usersList.map((u) => ({
          id: u.id,
          fullName: u.full_name || u.username,
          username: u.username,
          role: String(u.role || "").toUpperCase(),
          status: u.is_active === false ? "SUSPENDED" : "ACTIVE",
          isActive: u.is_active !== false,
        })),
      );
    } catch (_err) {
      console.error("Error fetching users", _err);
      toast.error("فشل في تحميل مصفوفة البيانات الأمنية");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleEdit = (user) => {
    setEditingUser(user);
    setFormData({
      fullName: user.fullName || "",
      username: user.username || "",
      password: "",
      role: user.role || "BARBER",
      phone: user.phone || "",
      specialty: user.specialty || "",
      status: user.status || "ACTIVE",
      isActive: user.isActive ?? true,
    });
    setIsModalOpen(true);
  };

  const handleConfirmAction = async () => {
    if (!confirmAction) return;

    try {
      setIsActionLoading(true);
      if (confirmAction.type === "delete") {
        await api.delete(`/users/${confirmAction.id}`);
        toast.success("تم أرشفة الهوية بنجاح");
      } else if (confirmAction.type === "toggle") {
        const user = confirmAction.payload;
        const newStatus = user.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
        await api.put(`/users/${user.id}`, {
          is_active: newStatus === "ACTIVE",
        });
        toast.success(
          newStatus === "ACTIVE"
            ? "تم استعادة صلاحيات الدخول"
            : "تم تعليق الصلاحيات الأمنية",
        );
      }
      fetchUsers();
    } catch (_err) {
      toast.error("فشل في تنفيذ العملية");
    } finally {
      setIsActionLoading(false);
      setConfirmAction(null);
    }
  };

  const handleSubmit = async () => {
    try {
      if (
        !formData.fullName ||
        !formData.username ||
        (!editingUser && !formData.password)
      ) {
        toast.error("يرجى ملء كافة الحقول الأمنية الأساسية");
        return;
      }

      setIsActionLoading(true);
      const payload = {
        username: formData.username,
        full_name: formData.fullName,
        password: formData.password || undefined,
        role: String(formData.role || "CASHIER").toLowerCase(),
        is_active: true,
      };
      if (editingUser) {
        await api.put(`/users/${editingUser.id}`, payload);
        toast.success("تم تحديث بروتوكولات الموظف");
      } else {
        await api.post("/users", payload);
        toast.success("تم إنشاء الهوية الأمنية بنجاح");
      }
      setIsModalOpen(false);
      fetchUsers();
} catch (_err) {
      toast.error((_err as any).response?.data?.detail || "حدث خطأ أثناء حفظ التعديلات");
    } finally {
      setIsActionLoading(false);
    }
  };

  const userRows = Array.isArray(users) ? users : [];

  const filteredUsers = userRows.filter(
    (u) =>
      u.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.username?.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  if (loading)
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4 text-accent">
          <ShieldCheck className="w-10 h-10 animate-pulse" />
          <p className="text-muted font-bold text-sm">
            جاري مراجعة مصفوفة الصلاحيات...
          </p>
        </div>
      </div>
    );

  return (
    <div className="space-y-8 pb-24 erp-page-container" dir="rtl">
      <ConfirmDialog
        open={!!confirmAction}
        onOpenChange={(open) => !open && setConfirmAction(null)}
        title={
          confirmAction?.type === "delete"
            ? "سحب صلاحيات الوصول؟"
            : "تغيير حالة الوصول؟"
        }
        description={
          confirmAction?.type === "delete"
            ? "هل أنت متأكد من سحب صلاحيات الوصول لهذا الحساب؟ سيتم أرشفة البيانات تلقائياً."
            : "هل أنت متأكد من تغيير صلاحيات الدخول لهذا الحساب؟"
        }
        onConfirm={handleConfirmAction}
        loading={isActionLoading}
      />

      {/* SaaS Executive Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 bg-accent rounded-2xl flex items-center justify-center shadow-lg shadow-accent/20">
            <ShieldCheck className="text-white w-8 h-8" strokeWidth={2} />
          </div>
          <div className="space-y-1">
            <h1 className="text-4xl font-black text-main uppercase tracking-tight leading-none">
              الأمان والصلاحيات
            </h1>
            <p className="text-base font-medium text-muted">
              إدارة مصفوفة الوصول، الهويات الرقمية، والرقابة الأمنية للمنظومة
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="primary"
          title="إصدار هوية أمنية جديدة لموظف معتمد"
          onClick={() => {
            setEditingUser(null);
            setFormData({
              fullName: "",
              username: "",
              password: "",
              role: "BARBER",
              phone: "",
              specialty: "",
              status: "ACTIVE",
              isActive: true,
            });
            setIsModalOpen(true);
          }}
          className="rounded-xl font-black px-10 h-14 shadow-lg shadow-accent/20 text-lg"
        >
          <Plus className="ml-2" size={20} strokeWidth={2.5} /> إضافة مستخدم
        </Button>
      </div>

      {/* Main Matrix Table Card */}
      <Card className="rounded-premium overflow-hidden border-border/60 bg-card shadow-soft transition-all hover:shadow-premium">
        <div className="p-8 border-b border-border/40 flex flex-col md:flex-row items-center justify-between gap-8 bg-soft/30">
          <div className="space-y-1">
            <h2 className="text-2xl font-black text-main uppercase tracking-tight leading-none">
              مصفوفة الهويات والوصول
            </h2>
            <p className="text-sm font-medium text-muted">
              الرقابة الكاملة على الكوادر الفنية والإدارية المعتمدة في النظام
            </p>
          </div>

          <div className="relative w-full md:w-96 group">
            <Search
              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted group-focus-within:text-accent transition-colors"
              size={18}
            />
            <Input
              placeholder="البحث الذكي بالهوية، الاسم أو المسمى الوظيفي..."
              className="h-12 rounded-xl pr-12 bg-white border-border text-base font-medium shadow-none focus:border-accent"
              value={searchTerm || ""}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-right">
            <thead>
              <tr className="border-b border-border bg-soft/50">
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-muted">
                  المسؤول المعتمد
                </th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-muted">
                  اسم الدخول
                </th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-muted text-center">
                  المستوى الأمني
                </th>
                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-muted text-center">
                  حالة الحساب
                </th>
                <th className="px-8 py-5 text-center text-[10px] font-black uppercase tracking-widest text-muted">
                  الإجراءات
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {filteredUsers.map((user) => (
                <tr
                  key={user.id}
                  className="group transition-all hover:bg-accent-subtle/30"
                >
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-4">
                      <div className="w-11 h-11 rounded-2xl bg-accent-soft border border-accent/10 flex items-center justify-center font-black text-accent text-sm shadow-sm transition-transform group-hover:scale-110">
                        {user.fullName?.charAt(0) || "U"}
                      </div>
                      <div className="space-y-0.5">
                        <div className="text-base font-black text-main leading-none group-hover:text-accent transition-colors">
                          {user.fullName}
                        </div>
                        <div className="text-[10px] font-bold text-muted uppercase tracking-widest">
                          معرف: #SEC-{user.id}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-5 text-sm font-black text-main/80 tabular-nums uppercase tracking-tight">
                    {user.username}
                  </td>
                  <td className="px-8 py-5 text-center">
                    <Badge
                      variant={
                        user.role === "OWNER"
                          ? "primary"
                          : user.role === "MANAGER"
                            ? "info"
                            : "outline"
                      }
                      className="h-6 px-4 rounded-lg font-black text-[9px] uppercase tracking-widest shadow-sm shadow-accent/5"
                    >
                      {user.role}
                    </Badge>
                  </td>
                  <td className="px-8 py-5 text-center">
                    <Badge
                      variant={user.status === "ACTIVE" ? "success" : "danger"}
                      className="h-6 px-4 font-black text-[9px] uppercase tracking-widest"
                    >
                      {user.status === "ACTIVE" ? "نشط آمن" : "معلق إدارياً"}
                    </Badge>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex items-center justify-center gap-3">
                      <Button
                        type="button"
                        variant="secondary"
                        size="icon"
                        disabled={loading}
                        onClick={() => handleEdit(user)}
                        className="h-10 w-10 rounded-xl border border-border group-hover:border-accent/20 transition-all shadow-sm"
                        title="تحديث بيانات الصلاحيات"
                      >
                        <Edit3 size={18} strokeWidth={2} />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          setConfirmAction({ type: "toggle", payload: user })
                        }
                        disabled={isActionLoading}
                        className={`h-10 w-10 rounded-xl transition-all ${user.status === "ACTIVE" ? "text-muted hover:text-warning hover:bg-warning-soft" : "text-success hover:bg-success-soft"}`}
                        title={
                          user.status === "ACTIVE"
                            ? "تعليق الصلاحيات الأمنية"
                            : "استعادة الوصول الفوري"
                        }
                      >
                        <Power size={18} strokeWidth={2.5} />
                      </Button>
                      {user.role !== "OWNER" && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            setConfirmAction({ type: "delete", id: user.id })
                          }
                          className="h-10 w-10 rounded-xl text-danger/40 hover:text-danger hover:bg-danger-soft transition-all"
                          title="سحب الصلاحيات نهائياً"
                        >
                          <Trash2 size={18} strokeWidth={2} />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-8 py-24 text-center opacity-40">
                    <div className="flex flex-col items-center gap-4">
                      <Shield
                        size={80}
                        strokeWidth={1}
                        className="text-muted"
                      />
                      <h4 className="text-2xl font-black text-main uppercase tracking-tight">
                        لا يوجد هويات موثقة
                      </h4>
                      <p className="text-sm font-medium">
                        لم يتم رصد أي مستخدمين مسجلين في مصفوفة الوصول الحالية
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Redesigned Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent
          className="max-w-2xl rounded-[32px] border-border bg-card p-0 shadow-premium overflow-hidden"
          dir="rtl"
        >
          <DialogHeader className="p-10 pb-6 bg-[#1B1714] relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-accent/5 rounded-full blur-[80px] -mr-32 -mt-32" />
            <div className="relative z-10 space-y-2">
              <DialogTitle className="text-3xl font-black text-white uppercase tracking-tight flex items-center gap-4 leading-none">
                <div className="w-12 h-12 bg-accent rounded-xl flex items-center justify-center text-white shadow-lg">
                  <Shield size={24} />
                </div>
                {editingUser ? "تحديث الهوية الأمنية" : "إصدار اعتماد أمني"}
              </DialogTitle>
              <DialogDescription className="text-sm font-medium text-white/50 uppercase tracking-widest">
                تخصيص مستويات الوصول الرقمي وضمان النزاهة الإدارية للمنظومة
              </DialogDescription>
            </div>
          </DialogHeader>

          <div className="p-10 space-y-8 flex-1 overflow-y-auto custom-scrollbar">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-3">
                <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">
                  الاسم القانوني الموثق
                </label>
                <div className="relative group">
                  <User
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-muted opacity-50 group-focus-within:text-accent transition-all"
                    size={18}
                  />
                  <Input
                    className="h-14 rounded-xl pr-12 font-bold bg-soft border-border text-main focus:bg-white text-base"
                    value={formData.fullName || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, fullName: e.target.value })
                    }
                    placeholder="الاسم الثلاثي أو الرباعي..."
                  />
                </div>
              </div>
              <div className="space-y-3">
                <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">
                  قناة التواصل الرسمية
                </label>
                <div className="relative group">
                  <Phone
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-muted opacity-50 group-focus-within:text-accent transition-all"
                    size={18}
                  />
                  <Input
                    className="h-14 rounded-xl pr-12 font-black bg-soft border-border text-main focus:bg-white text-lg tabular-nums"
                    dir="ltr"
                    value={formData.phone || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, phone: e.target.value })
                    }
                    placeholder="01xxxxxxxxx"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-3">
                <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">
                  معرف الدخول (Username)
                </label>
                <div className="relative group">
                  <Lock
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-muted opacity-50 group-focus-within:text-accent transition-all"
                    size={18}
                  />
                  <Input
                    className="h-14 rounded-xl pr-12 font-black bg-soft border-border text-main focus:bg-white text-base uppercase"
                    dir="ltr"
                    value={formData.username || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, username: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="space-y-3">
                <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">
                  كلمة المرور (Encrypted)
                </label>
                <div className="relative group">
                  <Shield
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-muted opacity-50 group-focus-within:text-accent transition-all"
                    size={18}
                  />
                  <Input
                    type="password"
                    placeholder={
                      editingUser ? "••••••••••••" : "أدخل كلمة مرور قوية..."
                    }
                    className="h-14 rounded-xl pr-12 font-black bg-soft border-border text-main focus:bg-white text-lg tracking-tighter"
                    value={formData.password || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, password: e.target.value })
                    }
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-3">
                <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">
                  رتبة الوصول (Security Role)
                </label>
                <Select
                  value={formData.role || ""}
                  onValueChange={(val) =>
                    setFormData({ ...formData, role: val })
                  }
                >
                  <SelectTrigger className="h-14 rounded-xl bg-soft border-border font-black text-xs uppercase focus:bg-white">
                    <SelectValue placeholder="تحديد الدور..." />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-border bg-card shadow-premium">
                    <SelectItem value="BARBER" className="font-bold">
                      حلاق معتمد (Barber)
                    </SelectItem>
                    <SelectItem value="CASHIER" className="font-bold">
                      كاشير تشغيلي (Cashier)
                    </SelectItem>
                    <SelectItem value="MANAGER" className="font-bold">
                      مدير نظام (Manager)
                    </SelectItem>
                    {formData.role === "OWNER" && (
                      <SelectItem
                        value="OWNER"
                        className="font-black text-accent"
                      >
                        المالك المؤسس (Owner)
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-3">
                <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">
                  التخصص الاستراتيجي
                </label>
                <div className="relative group">
                  <Award
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-muted opacity-50 group-focus-within:text-accent transition-all"
                    size={18}
                  />
                  <Input
                    className="h-14 rounded-xl pr-12 font-bold bg-soft border-border text-main focus:bg-white text-base"
                    value={formData.specialty || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, specialty: e.target.value })
                    }
                    placeholder="المهارة الفنية الأساسية..."
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="p-10 pt-6 border-t border-border bg-soft/10 flex gap-4">
            <Button
              variant="secondary"
              disabled={loading}
              onClick={() => setIsModalOpen(false)}
              className="flex-1 rounded-xl font-black uppercase tracking-widest h-14"
            >
              إلغاء الأمر
            </Button>
            <Button
              disabled={isActionLoading}
              onClick={handleSubmit}
              variant="primary"
              className="flex-[2] rounded-xl font-black text-lg h-14 shadow-lg shadow-accent/20"
            >
              <Save size={20} className="ml-2" />
              {editingUser
                ? "اعتماد التعديلات الأمنية"
                : "إصدار الاعتماد الرقمي"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PermissionsManagement;
