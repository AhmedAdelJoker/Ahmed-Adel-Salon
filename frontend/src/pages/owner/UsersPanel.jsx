import React, { useState, useEffect, useMemo } from "react";
import {
  Users, Plus, Search, Shield, ShieldCheck, Edit3, Trash2, Save,
  Lock, User as UserIcon, Mail, Eye, EyeOff, LayoutGrid, List,
  CheckCircle2, AlertTriangle, Fingerprint, Settings as SettingsIcon,
  LayoutDashboard, Receipt, Scissors, Package, TrendingUp, Wallet, Clock,
  History, Zap, Sparkles, ChevronLeft
} from "lucide-react";
import api from "../../services/api";
import { toast } from "react-hot-toast";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Badge } from "../../components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogTitle } from "../../components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Switch } from "../../components/ui/switch";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "../../lib/utils";
import { ConfirmDialog } from "../../components/shared/ConfirmDialog";
import { EmployeeAvatar } from "../../components/shared/EmployeeAvatar";

const PERMISSION_PAGES = [
  // نظام
  { id: "/owner", label: "لوحة القيادة الرئيسية", category: "نظام", icon: LayoutDashboard },
  { id: "/owner/settings", label: "إعدادات النظام المتكاملة", category: "نظام", icon: SettingsIcon },
  { id: "/owner/security-access", label: "الأمان والوصول المشفر", category: "نظام", icon: Lock },
  { id: "/owner/alerts", label: "مركز التنبيهات الذكية", category: "نظام", icon: Zap },
  { id: "/activity-logs", label: "سجلات الرقابة والنشاط", category: "نظام", icon: History },
  
  // تشغيل
  { id: "/pos", label: "نقطة البيع الذكية (POS)", category: "تشغيل", icon: Zap },
  { id: "/bookings", label: "نظام الحجوزات والمواعيد", category: "تشغيل", icon: Clock },
  { id: "/reception-board", label: "شاشة الاستقبال والمتابعة", category: "تشغيل", icon: List },
  { id: "/customers", label: "قاعدة بيانات العملاء", category: "تشغيل", icon: Users },
  { id: "/inventory", label: "إدارة المخزن والمستودع", category: "تشغيل", icon: Package },
  
  // مالية
  { id: "/invoices", label: "الفواتير والمبيعات", category: "مالية", icon: Receipt },
  { id: "/expenses", label: "إدارة المصروفات التشغيلية", category: "مالية", icon: TrendingUp },
  { id: "/expenses/archive", label: "أرشيف المصروفات", category: "مالية", icon: History },
  { id: "/owner/cashbox", label: "خزينة المحل والتدفق النقدي", category: "مالية", icon: Wallet },
  { id: "/owner/payroll", label: "مسيرات الرواتب", category: "مالية", icon: Wallet },
  { id: "/owner/payroll/archive", label: "أرشيف الرواتب", category: "مالية", icon: History },
  { id: "/owner/financial-rules", label: "القواعد والسياسات المالية", category: "مالية", icon: ShieldCheck },
  { id: "/owner/adjustment-requests", label: "طلبات تعديل الفواتير", category: "مالية", icon: AlertTriangle },
  
  // إدارة و تقارير
  { id: "/owner/hr", label: "إدارة الموارد البشرية", category: "إدارة", icon: Users },
  { id: "/attendance", label: "الحضور والانضباط", category: "إدارة", icon: CheckCircle2 },
  { id: "/approvals", label: "مركز الاعتمادات والإشعارات", category: "إدارة", icon: ShieldCheck },
  { id: "/owner/services", label: "إدارة الخدمات والقائمة", category: "إدارة", icon: Scissors },
  { id: "/owner/reports", label: "التقارير التشغيلية", category: "تقارير", icon: TrendingUp },
  { id: "/owner/financial", label: "تقارير الأداء المالي", category: "تقارير", icon: TrendingUp },
  { id: "/owner/employee-reports", label: "تقارير أداء الموظفين", category: "تقارير", icon: Users },
  
  // لوحات خاصة
  { id: "/manager", label: "لوحة تحكم المدير", category: "لوحات", icon: LayoutDashboard },
  { id: "/cashier", label: "لوحة تحكم الكاشير", category: "لوحات", icon: LayoutDashboard },
  { id: "/barber", label: "لوحة تحكم الحلاق", category: "لوحات", icon: LayoutDashboard },
];

export default function UsersPanel() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState("grid");
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPermsOpen, setIsPermsOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const [formData, setFormData] = useState({
    username: "",
    password: "",
    full_name: "",
    email: "",
    role: "CASHIER",
    is_active: true,
    permissions: {},
  });

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await api.get("/users");
      setUsers(res.data || []);
    } catch (err) {
      toast.error("فشل في مزامنة الهويات الرقمية");
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
      username: user.username,
      password: "",
      full_name: user.full_name || "",
      email: user.email || "",
      role: String(user.role).toUpperCase(),
      is_active: user.is_active,
      permissions: user.permissions || {},
    });
    setIsModalOpen(true);
  };

  const handleOpenPerms = (user) => {
    setEditingUser(user);
    setFormData({
      ...user,
      role: String(user.role).toUpperCase(),
      permissions: user.permissions || {},
    });
    setIsPermsOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.username || (!editingUser && !formData.password)) {
      toast.error("يرجى إدخال البيانات الأساسية للهوية");
      return;
    }

    try {
      setIsActionLoading(true);
      const payload = {
        ...formData,
        role: formData.role.toLowerCase()
      };
      if (editingUser) {
        await api.put(`/users/${editingUser.id}`, payload);
        toast.success("تم تحديث بروتوكول الوصول بنجاح");
      } else {
        await api.post("/users", payload);
        toast.success("تم إصدار هوية رقمية جديدة");
      }
      setIsModalOpen(false);
      setIsPermsOpen(false);
      fetchUsers();
    } catch (err) {
      const detail = err.response?.data?.detail;
      const errorMessage = Array.isArray(detail) ? detail[0]?.msg : detail;
      toast.error(typeof errorMessage === "string" ? errorMessage : "فشل في حفظ التعديلات");
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      setIsActionLoading(true);
      await api.delete(`/users/${confirmDelete}`);
      toast.success("تم سحب الصلاحيات وأرشفة الهوية");
      fetchUsers();
    } catch (err) {
      toast.error("فشل في حذف المستخدم");
    } finally {
      setIsActionLoading(false);
      setConfirmDelete(null);
    }
  };

  const togglePermission = (pageId) => {
    setFormData((prev) => {
      const perms = { ...prev.permissions };
      if (perms[pageId] === true) perms[pageId] = false;
      else if (perms[pageId] === false) delete perms[pageId];
      else perms[pageId] = true;
      return { ...prev, permissions: perms };
    });
  };

  const filteredUsers = useMemo(() => 
    users.filter(u => 
      u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.full_name && u.full_name.toLowerCase().includes(searchTerm.toLowerCase()))
    ), [users, searchTerm]
  );

  const stats = useMemo(() => {
    return {
      total: users.length,
      active: users.filter(u => u.is_active).length,
      admins: users.filter(u => ["OWNER", "ADMIN"].includes(String(u.role).toUpperCase())).length,
      staff: users.filter(u => !["OWNER", "ADMIN"].includes(String(u.role).toUpperCase())).length,
      percActive: users.length > 0 ? Math.round((users.filter(u => u.is_active).length / users.length) * 100) : 0,
    };
  }, [users]);

  return (
    <div className="space-y-10 animate-fade-in pb-16" dir="rtl">
      <ConfirmDialog 
        open={!!confirmDelete} 
        onOpenChange={open => !open && setConfirmDelete(null)}
        title="حذف المستخدم نهائياً؟"
        description="هذا الإجراء سيقوم بإلغاء وصول المستخدم لكافة الأنظمة والموارد المخصصة."
        onConfirm={handleDelete}
        loading={isActionLoading}
      />

      {/* Premium Dashboard Header Section */}
      <div className="relative overflow-hidden rounded-[32px] bg-zinc-950 text-white p-8 lg:p-10 shadow-2xl shadow-black/20 border border-white/5">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-accent/20 rounded-full blur-[120px] -mr-[250px] -mt-[250px] opacity-60 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-purple-600/10 rounded-full blur-[100px] -ml-[200px] -mb-[200px] pointer-events-none" />
        
        <div className="relative z-10 flex flex-col lg:flex-row gap-10 items-stretch justify-between">
          <div className="flex flex-col justify-between max-w-xl">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 mb-6 backdrop-blur-md">
                <Sparkles size={14} className="text-accent" />
                <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-white/80">لوحة الإدارة المتقدمة</span>
              </div>
              <h1 className="text-4xl lg:text-5xl font-black mb-4 leading-tight">
                مركز <span className="bg-gradient-to-l from-white to-white/40 bg-clip-text text-transparent">تأمين الهويات</span>
              </h1>
              <p className="text-sm text-white/50 leading-relaxed font-medium">
                تحكم كامل بمصفوفة الوصول وبروتوكولات الأمان. يمكنك إدارة الكوادر التشغيلية، ومراجعة سجلات النشاط، وضبط التراخيص بكل دقة.
              </p>
            </div>
            
            <div className="mt-10 flex items-center gap-4">
              <Button
                onClick={() => {
                  setEditingUser(null);
                  setFormData({ username: "", password: "", full_name: "", email: "", role: "CASHIER", is_active: true, permissions: {} });
                  setIsModalOpen(true);
                }}
                className="h-14 px-8 rounded-2xl bg-accent hover:bg-accent/90 text-white font-bold text-sm shadow-[0_0_40px_-10px_rgba(var(--accent),0.6)] transition-all hover:scale-[1.02]"
              >
                <Plus size={18} className="ml-2" />
                إصدار هوية وصول جديدة
              </Button>
            </div>
          </div>

          <div className="flex-1 grid grid-cols-2 gap-4 lg:max-w-md">
            <div className="bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-md hover:bg-white/10 transition-colors flex flex-col justify-between">
              <div className="flex items-center justify-between mb-8">
                <div className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center">
                  <Users size={18} className="text-white" />
                </div>
                <Badge variant="outline" className="border-white/10 text-white/60 bg-transparent text-[10px]">إجمالي</Badge>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-white/50 mb-1 font-bold">الهويات النشطة</p>
                <h3 className="text-4xl font-black">{stats.total}</h3>
              </div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-md hover:bg-white/10 transition-colors flex flex-col justify-between">
              <div className="flex items-center justify-between mb-8">
                <div className="h-10 w-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                  <ShieldCheck size={18} className="text-purple-400" />
                </div>
                <Badge variant="outline" className="border-purple-500/20 text-purple-400 bg-transparent text-[10px]">إدارة</Badge>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-white/50 mb-1 font-bold">المسؤولين</p>
                <h3 className="text-4xl font-black">{stats.admins}</h3>
              </div>
            </div>
            <div className="col-span-2 bg-gradient-to-r from-accent/20 to-transparent border border-accent/20 rounded-3xl p-6 backdrop-blur-md flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-accent mb-1 font-bold">معدل الاستجابة والنشاط</p>
                <h3 className="text-3xl font-black text-white">{stats.percActive}%</h3>
              </div>
              <div className="h-12 w-24 bg-white/5 rounded-full overflow-hidden p-1">
                <motion.div initial={{ width: 0 }} animate={{ width: `${stats.percActive}%` }} className="h-full bg-accent rounded-full shadow-[0_0_20px_rgba(var(--accent),0.5)]" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Elegant Toolbar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
        <div className="relative flex-1 max-w-md group">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-accent" size={18} />
          <Input
            placeholder="البحث الفوري بالاسم أو المعرف..."
            className="h-14 pl-4 pr-12 rounded-2xl bg-card border-border/60 focus:border-accent shadow-sm focus:shadow-md transition-all font-medium text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex bg-card p-1.5 rounded-2xl border border-border/60 shadow-sm">
          <button 
            onClick={() => setViewMode("grid")}
            className={cn("px-6 py-2.5 rounded-xl transition-all font-bold text-xs flex items-center gap-2", viewMode === "grid" ? "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 shadow-md" : "text-muted-foreground hover:bg-soft")}
          >
            <LayoutGrid size={16} /> شبكة
          </button>
          <button 
            onClick={() => setViewMode("table")}
            className={cn("px-6 py-2.5 rounded-xl transition-all font-bold text-xs flex items-center gap-2", viewMode === "table" ? "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 shadow-md" : "text-muted-foreground hover:bg-soft")}
          >
            <List size={16} /> قائمة
          </button>
        </div>
      </div>

      {/* View Content */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[1, 2, 3].map(i => <div key={i} className="h-64 rounded-3xl bg-soft animate-pulse" />)}
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <AnimatePresence mode="popLayout">
            {filteredUsers.map((user) => (
              <motion.div
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                key={user.id}
              >
                <div className="group relative bg-card rounded-[32px] p-8 border border-border/40 shadow-sm hover:shadow-2xl hover:shadow-accent/5 hover:border-accent/20 transition-all duration-500 flex flex-col h-full">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-accent/5 rounded-full blur-3xl -mr-10 -mt-10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  
                  <div className="flex justify-between items-start mb-8 relative z-10">
                    <div className="flex items-center gap-4">
                      <EmployeeAvatar
                        imageUrl={user.profileImageUrl || user.profile_image_url}
                        name={user.full_name || user.username}
                        size="xl"
                        status={user.is_active ? 'active' : 'inactive'}
                      />
                      <div>
                        <h3 className="text-lg font-black text-main leading-tight mb-1">{user.full_name || user.username}</h3>
                        <p className="text-xs font-semibold text-muted-foreground" dir="ltr">{user.username}</p>
                      </div>
                    </div>
                    {user.role !== "OWNER" && (
                      <button onClick={() => setConfirmDelete(user.id)} className="h-8 w-8 rounded-full bg-soft/50 text-muted-foreground hover:bg-red-50 hover:text-red-600 flex items-center justify-center transition-colors">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>

                  <div className="space-y-4 mb-8 flex-1 relative z-10">
                    <div className="flex items-center justify-between bg-soft/30 rounded-2xl p-4 border border-border/50">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">الرتبة الوظيفية</span>
                      <Badge variant="outline" className="bg-white dark:bg-zinc-900 border-border shadow-sm text-[10px] font-black uppercase">{user.role}</Badge>
                    </div>
                    <div className="flex items-center justify-between bg-soft/30 rounded-2xl p-4 border border-border/50">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">حالة الحساب</span>
                      <div className="flex items-center gap-2">
                        {user.is_active ? (
                          <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-600"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> مصرح له</span>
                        ) : (
                          <span className="flex items-center gap-1.5 text-xs font-bold text-red-600"><span className="w-1.5 h-1.5 rounded-full bg-red-500" /> معلق</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 relative z-10 mt-auto">
                    <Button onClick={() => handleEdit(user)} variant="outline" className="flex-1 h-12 rounded-2xl font-bold text-xs border-border/60 hover:bg-soft">
                      <Edit3 size={16} className="ml-2" /> تخصيص
                    </Button>
                    <Button onClick={() => handleOpenPerms(user)} className="flex-1 h-12 rounded-2xl font-bold text-xs bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:scale-[1.02] shadow-md transition-all">
                      <Shield size={16} className="ml-2" /> بروتوكول
                    </Button>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      ) : (
        <div className="bg-card rounded-[32px] p-2 border border-border/50 shadow-xl shadow-black/5 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr>
                  <th className="px-8 py-6 text-[10px] font-black text-muted-foreground uppercase tracking-widest border-b border-border/50 bg-soft/20 rounded-tr-3xl">المعرف الشخصي</th>
                  <th className="px-8 py-6 text-[10px] font-black text-muted-foreground uppercase tracking-widest border-b border-border/50 bg-soft/20">اسم المستخدم</th>
                  <th className="px-8 py-6 text-[10px] font-black text-muted-foreground uppercase tracking-widest border-b border-border/50 bg-soft/20 text-center">الرتبة</th>
                  <th className="px-8 py-6 text-[10px] font-black text-muted-foreground uppercase tracking-widest border-b border-border/50 bg-soft/20 text-center">حالة النظام</th>
                  <th className="px-8 py-6 text-[10px] font-black text-muted-foreground uppercase tracking-widest border-b border-border/50 bg-soft/20 text-center rounded-tl-3xl">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {filteredUsers.map(user => (
                  <tr key={user.id} className="hover:bg-soft/30 transition-colors group">
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <EmployeeAvatar
                          imageUrl={user.profileImageUrl || user.profile_image_url}
                          name={user.full_name || user.username}
                          size="sm"
                          status={user.is_active ? 'active' : 'inactive'}
                        />
                        <div className="font-bold text-main text-sm">{user.full_name || user.username}</div>
                      </div>
                    </td>
                    <td className="px-8 py-6 text-sm text-muted-foreground font-semibold tracking-wide" dir="ltr">{user.username}</td>
                    <td className="px-8 py-6 text-center">
                      <Badge variant="outline" className="font-bold text-[10px] uppercase tracking-widest border-border bg-card shadow-sm py-1 px-3">{user.role}</Badge>
                    </td>
                    <td className="px-8 py-6 text-center">
                      <div className="inline-flex items-center justify-center">
                        {user.is_active ? (
                          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 font-bold text-[10px]">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> نشط
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-600 font-bold text-[10px]">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500" /> موقوف
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => handleEdit(user)} className="h-9 w-9 rounded-xl bg-card border border-border/50 text-muted-foreground hover:text-main hover:border-main transition-colors flex items-center justify-center shadow-sm"><Edit3 size={16} /></button>
                        <button onClick={() => handleOpenPerms(user)} className="h-9 w-9 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 transition-colors flex items-center justify-center shadow-md"><Shield size={16} /></button>
                        {user.role !== "OWNER" && (
                          <button onClick={() => setConfirmDelete(user.id)} className="h-9 w-9 rounded-xl bg-card border border-border/50 text-red-400 hover:text-white hover:bg-red-500 hover:border-red-500 transition-colors flex items-center justify-center shadow-sm"><Trash2 size={16} /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Premium Modal: Edit/Add User */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-[600px] p-0 overflow-hidden border-border bg-card shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] rounded-[32px]" dir="rtl">
          <div className="px-10 py-8 border-b border-border/50 bg-soft/20 flex flex-col items-center text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-accent to-transparent opacity-50" />
            <div className="h-16 w-16 rounded-2xl bg-white dark:bg-zinc-900 border border-border shadow-xl flex items-center justify-center text-accent mb-4">
              <UserIcon size={28} strokeWidth={2} />
            </div>
            <DialogTitle className="text-2xl font-black text-main">{editingUser ? "تخصيص الهوية الأمنية" : "إصدار هوية جديدة"}</DialogTitle>
            <p className="text-xs text-muted-foreground mt-2 font-medium">قم بإعداد بيانات الوصول والبيانات الأساسية بدقة</p>
          </div>

          <div className="p-10 space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">معرف الدخول</label>
                <div className="relative group">
                  <Fingerprint className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-accent transition-colors" size={16} />
                  <Input
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    className="h-12 pl-4 pr-12 rounded-xl bg-soft/50 border-border/60 focus:border-accent font-bold shadow-sm"
                    dir="ltr"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">مفتاح التشفير</label>
                <div className="relative group">
                  <Lock className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-accent transition-colors" size={16} />
                  <Input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="h-12 pl-4 pr-12 rounded-xl bg-soft/50 border-border/60 focus:border-accent font-bold shadow-sm"
                    placeholder={editingUser ? "اتركه فارغاً للاحتفاظ بالمفتاح" : ""}
                    dir="ltr"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">الاسم القانوني الكامل</label>
              <div className="relative group">
                <UserIcon className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-accent transition-colors" size={16} />
                <Input
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  className="h-12 pl-4 pr-12 rounded-xl bg-soft/50 border-border/60 focus:border-accent font-bold shadow-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6 pt-2">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">الرتبة الوظيفية</label>
                <Select value={formData.role} onValueChange={(val) => setFormData({ ...formData, role: val })}>
                  <SelectTrigger className="h-12 rounded-xl bg-soft/50 border-border/60 focus:border-accent shadow-sm font-bold text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-border/50 shadow-2xl">
                    <SelectItem value="OWNER" className="font-bold">المالك (Owner)</SelectItem>
                    <SelectItem value="ADMIN" className="font-bold">مسؤول (Admin)</SelectItem>
                    <SelectItem value="MANAGER" className="font-bold">مدير (Manager)</SelectItem>
                    <SelectItem value="CASHIER" className="font-bold">كاشير (Cashier)</SelectItem>
                    <SelectItem value="BARBER" className="font-bold">حلاق (Barber)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">صلاحية الدخول</label>
                <div className="h-12 flex items-center justify-between px-5 border border-border/60 rounded-xl bg-soft/50 shadow-sm">
                  <span className={cn("text-xs font-bold uppercase tracking-widest", formData.is_active ? "text-emerald-600" : "text-red-500")}>
                    {formData.is_active ? "مفعل" : "معلق"}
                  </span>
                  <Switch
                    checked={formData.is_active}
                    onCheckedChange={(val) => setFormData({ ...formData, is_active: val })}
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="px-10 py-6 bg-card border-t border-border/50 gap-4 flex-row justify-end">
            <Button variant="ghost" onClick={() => setIsModalOpen(false)} className="rounded-xl h-12 px-8 font-bold hover:bg-soft">إلغاء</Button>
            <Button 
              onClick={handleSubmit} 
              disabled={isActionLoading} 
              className="rounded-xl h-12 px-10 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:scale-[1.02] font-bold shadow-lg transition-all"
            >
              {isActionLoading ? "جاري الاعتماد..." : "اعتماد الهوية"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Premium Permissions Dialog */}
      <Dialog open={isPermsOpen} onOpenChange={setIsPermsOpen}>
        <DialogContent className="max-w-[900px] p-0 overflow-hidden border-border bg-card shadow-[0_30px_80px_-20px_rgba(0,0,0,0.5)] rounded-[32px]" dir="rtl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-10 py-8 bg-zinc-950 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-accent/20 rounded-full blur-[80px] -mr-[150px] -mt-[150px] pointer-events-none" />
            <div className="relative z-10 flex items-center gap-5">
              <div className="h-14 w-14 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-accent shadow-xl">
                <ShieldCheck size={28} />
              </div>
              <div>
                <DialogTitle className="text-2xl font-black mb-1">مصفوفة البروتوكولات الأمنية</DialogTitle>
                <p className="text-xs font-semibold text-white/50 tracking-wide">تخصيص الصلاحيات المستقلة لـ {formData.full_name || formData.username}</p>
              </div>
            </div>
            <Badge variant="outline" className="relative z-10 border-white/20 bg-white/5 text-white backdrop-blur-md px-4 py-2 font-black tracking-widest uppercase rounded-xl">
              {formData.role} LEVEL
            </Badge>
          </div>

          <div className="p-10 max-h-[60vh] overflow-y-auto bg-soft/10 relative">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10">
              {["نظام", "تشغيل", "مالية", "إدارة", "تقارير", "لوحات"].map((cat) => {
                const pages = PERMISSION_PAGES.filter(p => p.category === cat);
                if (pages.length === 0) return null;
                return (
                  <div key={cat} className="space-y-5 relative">
                    <div className="flex items-center gap-3 border-b border-border/50 pb-3">
                      <div className="h-1.5 w-6 rounded-full bg-accent" />
                      <h4 className="text-xs font-black uppercase tracking-[0.3em] text-muted-foreground">{cat}</h4>
                    </div>
                    <div className="space-y-3">
                      {pages.map((page) => {
                        const state = formData.permissions[page.id];
                        const Icon = page.icon || Shield;
                        return (
                          <button
                            key={page.id}
                            onClick={() => togglePermission(page.id)}
                            className={cn(
                              "w-full flex items-center justify-between p-4 rounded-2xl border transition-all duration-300 text-right group",
                              state === true ? "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30 shadow-[0_4px_20px_-10px_rgba(16,185,129,0.3)]" :
                              state === false ? "bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/30 shadow-[0_4px_20px_-10px_rgba(239,68,68,0.3)]" :
                              "bg-card border-border/60 hover:border-accent/40 hover:shadow-md"
                            )}
                          >
                            <div className="flex items-center gap-4">
                              <div className={cn(
                                "h-10 w-10 rounded-xl flex items-center justify-center transition-colors shadow-sm",
                                state === true ? "text-emerald-600 bg-emerald-100 dark:bg-emerald-500/20" :
                                state === false ? "text-red-600 bg-red-100 dark:bg-red-500/20" :
                                "text-muted-foreground bg-soft group-hover:text-main group-hover:bg-accent/10"
                              )}>
                                <Icon size={18} />
                              </div>
                              <div className="flex flex-col">
                                <span className={cn("text-sm font-bold transition-colors", state !== undefined ? "text-main" : "text-muted-foreground group-hover:text-main")}>{page.label}</span>
                                <span className="text-[9px] font-semibold text-muted-foreground/50 tracking-wider" dir="ltr">{page.id}</span>
                              </div>
                            </div>
                            <div className="pl-2">
                              {state === true ? (
                                <div className="h-6 w-6 rounded-full bg-emerald-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/30"><Eye size={12} strokeWidth={3} /></div>
                              ) : state === false ? (
                                <div className="h-6 w-6 rounded-full bg-red-500 flex items-center justify-center text-white shadow-lg shadow-red-500/30"><EyeOff size={12} strokeWidth={3} /></div>
                              ) : (
                                <div className="h-6 w-6 rounded-full border-2 border-dashed border-border group-hover:border-accent/50 transition-colors" />
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <DialogFooter className="px-10 py-6 bg-card border-t border-border/50 gap-4 flex-row justify-end">
            <Button variant="ghost" onClick={() => setIsPermsOpen(false)} className="rounded-xl h-12 px-8 font-bold hover:bg-soft">تجاهل</Button>
            <Button 
              onClick={handleSubmit} 
              disabled={isActionLoading} 
              className="rounded-xl h-12 px-10 bg-accent hover:bg-accent/90 text-white hover:scale-[1.02] font-bold shadow-lg shadow-accent/20 transition-all"
            >
              توثيق المصفوفة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
