import React from "react";
import {
  ShieldCheck,
  Plus,
  Search,
  LayoutGrid,
  List,
  Edit3,
  Trash2,
  Lock,
  User as UserIcon,
  Shield,
  Check,
  X,
  RefreshCw,
  Zap,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Settings as SettingsIcon,
  Clock,
  History,
  Package,
  Archive,
  UserCheck,
  UserCircle,
  Users2,
  Banknote,
  CalendarDays,
  Receipt,
  Scissors,
  Globe,
  Trophy,
  FileBarChart2,
  TrendingUp,
  Wallet,
  Fingerprint,
} from "lucide-react";
import api from "@/services/api";
import { toast } from "react-hot-toast";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { motion } from "framer-motion";
import { cn } from "@/lib/core/utils";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import {
  PageHeader,
  PremiumCard,
  StatCard,
} from "@/components/shared/PremiumUI";
import { EmployeeAvatar } from "@/components/shared/EmployeeAvatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { AnimatePresence } from "framer-motion";
import { useUsersData } from "@/features/users";

export default function UsersPanel() {
  const {
    users,
    loading,
    viewMode,
    setViewMode,
    searchTerm,
    setSearchTerm,
    filteredUsers,
    stats,
    isModalOpen,
    setIsModalOpen,
    isPermsOpen,
    setIsPermsOpen,
    editingUser,
    isActionLoading,
    confirmDelete,
    setConfirmDelete,
    formData,
    setFormData,
    handleEdit,
    handleOpenPerms,
    handleSubmit,
    handleDelete,
    togglePermission,
    resetForm,
    getRolePermission,
    PERMISSION_PAGES,
  } = useUsersData();

  return (
    <div className="erp-page-container space-y-8 pb-16" dir="rtl">
      <ConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
        title="حذف المستخدم نهائياً؟"
        description="هذا الإجراء سيقوم بإلغاء وصول المستخدم لكافة الأنظمة والموارد المخصصة."
        onConfirm={handleDelete}
        loading={isActionLoading}
      />

      <PageHeader
        title="إدارة هويات الوصول"
        subtitle="تحكم كامل في مصفوفة الصلاحيات وبروتوكولات الأمان للكوادر التشغيلية."
        badge="الأمان والوصول"
        icon={ShieldCheck}
        className={undefined}
        actions={
          <Button
            onClick={() => {
              resetForm();
              setIsModalOpen(true);
            }}
            className="h-11 px-6 rounded-xl bg-primary text-white font-black shadow-lg shadow-primary/20 hover:scale-[1.02] transition-all flex items-center gap-2"
          >
            <Plus size={18} />
            إصدار هوية وصول جديدة
          </Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="إجمالي الهويات"
          value={stats.total}
          icon={Users2}
          variant="primary"
          trend={undefined}
          trendValue={undefined}
          delay={0}
        />
        <StatCard
          label="المسؤولين"
          value={stats.admins}
          icon={ShieldCheck}
          variant="info"
          trend={undefined}
          trendValue={undefined}
          delay={0.05}
        />
        <StatCard
          label="الهويات النشطة"
          value={stats.active}
          icon={CheckCircle2}
          variant="success"
          trend={undefined}
          trendValue={undefined}
          delay={0.1}
        />
        <StatCard
          label="معدل النشاط"
          value={`${stats.percActive}%`}
          icon={Activity}
          variant="warning"
          trend={undefined}
          trendValue={undefined}
          delay={0.15}
        />
      </div>

      {/* Elegant Toolbar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
        <div className="relative flex-1 max-w-md group">
          <Search
            className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary"
            size={18}
          />
          <Input
            placeholder="البحث بالاسم أو معرف الدخول..."
            className="h-12 pl-4 pr-12 rounded-xl bg-white border-border focus:border-primary shadow-sm transition-all font-bold text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex bg-white p-1 rounded-xl border border-border shadow-sm">
          <button
            onClick={() => setViewMode("grid")}
            className={cn(
              "px-6 py-2 rounded-lg transition-all font-black text-[10px] uppercase tracking-widest flex items-center gap-2",
              viewMode === "grid"
                ? "bg-primary text-white shadow-md"
                : "text-muted hover:bg-soft",
            )}
          >
            <LayoutGrid size={14} /> شبكة
          </button>
          <button
            onClick={() => setViewMode("table")}
            className={cn(
              "px-6 py-2 rounded-lg transition-all font-black text-[10px] uppercase tracking-widest flex items-center gap-2",
              viewMode === "table"
                ? "bg-primary text-white shadow-md"
                : "text-muted hover:bg-soft",
            )}
          >
            <List size={14} /> قائمة
          </button>
        </div>
      </div>

      {/* View Content */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-64 rounded-3xl bg-soft animate-pulse border border-border"
            />
          ))}
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence mode="popLayout">
            {filteredUsers.map((user) => (
              <motion.div
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                key={user.id}
              >
                <PremiumCard
                  className="h-full flex flex-col group overflow-hidden"
                  noPadding
                  hoverable
                >
                  <div className="p-6 space-y-6 flex-1">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-4 min-w-0">
                        <EmployeeAvatar
                          imageUrl={
                            user.profileImageUrl || user.profile_image_url
                          }
                          name={user.full_name || user.username}
                          role={undefined}
                          size="xl"
                          className="border-2 border-soft group-hover:border-primary/20 transition-colors shrink-0"
                        />
                        <div className="min-w-0">
                          <h3 className="text-lg font-black text-main leading-tight mb-1 group-hover:text-primary transition-colors truncate">
                            {user.full_name || user.username}
                          </h3>
                          <p
                            className="text-[10px] font-black text-muted uppercase tracking-widest truncate"
                            dir="ltr"
                          >
                            @{user.username}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleEdit(user)}
                          className="h-8 w-8 rounded-lg bg-soft text-muted hover:text-primary hover:bg-primary/10 flex items-center justify-center transition-all"
                        >
                          <Edit3 size={14} />
                        </button>
                        {user.role !== "OWNER" && (
                          <button
                            onClick={() => setConfirmDelete(user.id)}
                            className="h-8 w-8 rounded-lg bg-soft text-muted hover:text-red-600 hover:bg-red-50 flex items-center justify-center transition-all"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 rounded-xl bg-soft/50 border border-border/40">
                        <span className="text-[10px] font-black text-muted uppercase tracking-tighter">
                          الرتبة الوظيفية
                        </span>
                        <Badge
                          variant="secondary"
                          className="bg-primary/10 text-primary border-none font-black text-[10px] px-2 py-0.5 rounded-lg"
                        >
                          {user.role}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-xl bg-soft/50 border border-border/40">
                        <span className="text-[10px] font-black text-muted uppercase tracking-tighter">
                          حالة الوصول
                        </span>
                        <div className="flex items-center gap-2">
                          {user.is_active ? (
                            <span className="flex items-center gap-1.5 text-[10px] font-black text-emerald-600 uppercase">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />{" "}
                              مصرح له
                            </span>
                          ) : (
                            <span className="flex items-center gap-1.5 text-[10px] font-black text-rose-600 uppercase">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />{" "}
                              معلق
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-soft/30 border-t border-border/40 mt-auto">
                    <Button
                      onClick={() => handleOpenPerms(user)}
                      className="w-full h-10 rounded-xl font-black text-[10px] uppercase tracking-widest bg-white border border-border hover:bg-primary hover:text-white hover:border-primary transition-all shadow-sm"
                    >
                      <Shield size={14} className="ml-2" /> تعديل بروتوكول
                      الصلاحيات
                    </Button>
                  </div>
                </PremiumCard>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      ) : (
        <PremiumCard className="overflow-hidden" noPadding>
          <div className="overflow-x-auto">
            <table className="w-full text-right">
              <thead>
                <tr className="bg-soft/30">
                  <th className="px-8 py-5 text-[10px] font-black text-muted uppercase tracking-widest border-b border-border/50">
                    الموظف
                  </th>
                  <th className="px-8 py-5 text-[10px] font-black text-muted uppercase tracking-widest border-b border-border/50 text-center">
                    اسم المستخدم
                  </th>
                  <th className="px-8 py-5 text-[10px] font-black text-muted uppercase tracking-widest border-b border-border/50 text-center">
                    الرتبة
                  </th>
                  <th className="px-8 py-5 text-[10px] font-black text-muted uppercase tracking-widest border-b border-border/50 text-center">
                    حالة النظام
                  </th>
                  <th className="px-8 py-5 text-[10px] font-black text-muted uppercase tracking-widest border-b border-border/50 text-center">
                    الإجراءات
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {filteredUsers.map((user) => (
                  <tr
                    key={user.id}
                    className="hover:bg-soft/20 transition-colors group"
                  >
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-4">
                        <EmployeeAvatar
                          imageUrl={
                            user.profileImageUrl || user.profile_image_url
                          }
                          name={user.full_name || user.username}
                          role={undefined}
                          size="sm"
                          className="rounded-lg"
                        />
                        <div className="font-black text-main text-sm">
                          {user.full_name || user.username}
                        </div>
                      </div>
                    </td>
                    <td
                      className="px-8 py-5 text-xs text-muted font-bold"
                      dir="ltr"
                    >
                      @{user.username}
                    </td>
                    <td className="px-8 py-5 text-center">
                      <Badge
                        variant="outline"
                        className="font-black text-[10px] uppercase border-border bg-white shadow-sm px-2"
                      >
                        {user.role}
                      </Badge>
                    </td>
                    <td className="px-8 py-5 text-center">
                      <div className="inline-flex items-center justify-center">
                        {user.is_active ? (
                          <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-emerald-50 text-emerald-600 font-black text-[9px] border border-emerald-100">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />{" "}
                            نشط
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-rose-50 text-rose-600 font-black text-[9px] border border-rose-100">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />{" "}
                            موقوف
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleEdit(user)}
                          className="h-9 w-9 rounded-xl bg-white border border-border text-muted hover:text-primary hover:border-primary transition-all flex items-center justify-center shadow-sm"
                        >
                          <Edit3 size={16} />
                        </button>
                        <button
                          onClick={() => handleOpenPerms(user)}
                          className="h-9 w-9 rounded-xl bg-white border border-border text-muted hover:text-primary hover:border-primary transition-all flex items-center justify-center shadow-sm"
                        >
                          <Shield size={16} />
                        </button>
                        {user.role !== "OWNER" && (
                          <button
                            onClick={() => setConfirmDelete(user.id)}
                            className="h-9 w-9 rounded-xl bg-white border border-border text-muted hover:text-rose-600 hover:border-rose-600 transition-all flex items-center justify-center shadow-sm"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </PremiumCard>
      )}

      {/* Premium Modal: Edit/Add User */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent
          className="max-w-[600px] p-0 overflow-hidden border-none bg-card shadow-premium rounded-[2.5rem]"
          dir="rtl"
        >
          <div className="px-10 py-8 border-b border-border/40 bg-[#020617] relative overflow-hidden text-white">
            <div className="absolute top-0 right-0 w-full h-full bg-primary/10 blur-[100px] pointer-events-none" />
            <div className="relative z-10 flex items-center gap-6">
              <div className="h-16 w-16 rounded-2xl bg-white/10 backdrop-blur-xl border border-white/10 flex items-center justify-center text-primary shadow-2xl">
                <UserIcon size={32} />
              </div>
              <div>
                <DialogTitle className="text-2xl font-black tracking-tight">
                  {editingUser
                    ? "تخصيص الهوية الأمنية"
                    : "إصدار هوية وصول جديدة"}
                </DialogTitle>
                <p className="text-xs text-white/50 mt-1 font-bold">
                  إدارة بيانات الوصول والبيانات الأساسية للموظف بدقة.
                </p>
              </div>
            </div>
          </div>

          <div className="p-10 space-y-8 bg-card">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2.5">
                <label className="text-[10px] font-black text-muted uppercase tracking-widest mr-2">
                  معرف الدخول
                </label>
                <div className="relative group">
                  <Fingerprint
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-muted group-focus-within:text-primary transition-colors"
                    size={16}
                  />
                  <Input
                    value={formData.username}
                    onChange={(e) =>
                      setFormData({ ...formData, username: e.target.value })
                    }
                    className="h-12 pl-4 pr-12 rounded-xl bg-soft border-border focus:bg-white focus:border-primary font-black shadow-sm"
                    dir="ltr"
                  />
                </div>
              </div>
              <div className="space-y-2.5">
                <label className="text-[10px] font-black text-muted uppercase tracking-widest mr-2">
                  كلمة المرور
                </label>
                <div className="relative group">
                  <Lock
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-muted group-focus-within:text-primary transition-colors"
                    size={16}
                  />
                  <Input
                    type="password"
                    value={formData.password}
                    onChange={(e) =>
                      setFormData({ ...formData, password: e.target.value })
                    }
                    className="h-12 pl-4 pr-12 rounded-xl bg-soft border-border focus:bg-white focus:border-primary font-black shadow-sm"
                    placeholder={
                      editingUser
                        ? "اتركه فارغاً للاحتفاظ بالقديمة"
                        : "••••••••"
                    }
                    dir="ltr"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2.5">
              <label className="text-[10px] font-black text-muted uppercase tracking-widest mr-2">
                الاسم الكامل للموظف
              </label>
              <div className="relative group">
                <UserIcon
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted group-focus-within:text-primary transition-colors"
                  size={16}
                />
                <Input
                  value={formData.full_name}
                  onChange={(e) =>
                    setFormData({ ...formData, full_name: e.target.value })
                  }
                  placeholder="الاسم كما يظهر في النظام"
                  className="h-12 pl-4 pr-12 rounded-xl bg-soft border-border focus:bg-white focus:border-primary font-black shadow-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2.5">
                <label className="text-[10px] font-black text-muted uppercase tracking-widest mr-2">
                  الرتبة الوظيفية
                </label>
                <select
                  value={formData.role}
                  onChange={(e) =>
                    setFormData({ ...formData, role: e.target.value })
                  }
                  className="premium-native-select w-full h-12 bg-soft border border-border rounded-xl px-5 text-sm font-black focus:border-primary focus:bg-white outline-none appearance-none text-right cursor-pointer shadow-sm transition-all"
                >
                  <option value="OWNER">المالك (Owner)</option>
                  <option value="ADMIN">مسؤول (Admin)</option>
                  <option value="MANAGER">مدير (Manager)</option>
                  <option value="CASHIER">كاشير (Cashier)</option>
                  <option value="ACCOUNTANT">محاسب (Accountant)</option>
                  <option value="BARBER">حلاق (Barber)</option>
                </select>
              </div>
              <div className="space-y-2.5">
                <label className="text-[10px] font-black text-muted uppercase tracking-widest mr-2">
                  حالة الوصول
                </label>
                <div className="h-12 flex items-center justify-between px-5 border border-border rounded-xl bg-soft shadow-sm">
                  <span
                    className={cn(
                      "text-xs font-black uppercase tracking-tighter",
                      formData.is_active ? "text-emerald-600" : "text-rose-500",
                    )}
                  >
                    {formData.is_active ? "نشط الآن" : "موقوف مؤقتاً"}
                  </span>
                  <Switch
                    checked={formData.is_active}
                    onCheckedChange={(val) =>
                      setFormData({ ...formData, is_active: val })
                    }
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="px-10 py-6 bg-soft/30 border-t border-border/40 gap-3 flex-row justify-end">
            <Button
              variant="ghost"
              onClick={() => setIsModalOpen(false)}
              className="rounded-xl h-11 px-8 font-black text-muted hover:text-main transition-all"
            >
              إلغاء
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isActionLoading}
              className="rounded-xl h-11 px-10 bg-primary text-white hover:scale-[1.02] font-black shadow-lg shadow-primary/20 transition-all"
            >
              {isActionLoading ? "جاري الحفظ..." : "اعتماد الهوية"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Premium Permissions Dialog */}
      <Dialog open={isPermsOpen} onOpenChange={setIsPermsOpen}>
        <DialogContent
          className="max-w-[950px] p-0 overflow-hidden border-none bg-card shadow-premium rounded-[3rem]"
          dir="rtl"
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-10 py-10 bg-[#020617] text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-primary/10 rounded-full blur-[100px] -mr-[200px] -mt-[200px] pointer-events-none" />
            <div className="relative z-10 flex items-center gap-6">
              <div className="h-16 w-16 rounded-2xl bg-white/10 backdrop-blur-xl border border-white/10 flex items-center justify-center text-primary shadow-2xl">
                <ShieldCheck size={32} />
              </div>
              <div>
                <DialogTitle className="text-3xl font-black tracking-tight">
                  بروتوكولات الوصول المشفرة
                </DialogTitle>
                <DialogDescription className="text-sm font-bold text-white/40 mt-1">
                  تخصيص مصفوفة الصلاحيات لـ:{" "}
                  {formData.full_name || formData.username}
                </DialogDescription>
              </div>
            </div>
            <Badge
              variant="outline"
              className="relative z-10 border-white/10 bg-white/5 text-white backdrop-blur-md px-5 py-2.5 font-black tracking-[0.2em] uppercase rounded-2xl shadow-inner"
            >
              LEVEL: {formData.role}
            </Badge>
          </div>

          <div className="p-10 max-h-[65vh] overflow-y-auto bg-card relative custom-scrollbar">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-12">
              {["نظام", "تشغيل", "مالية", "إدارة", "تقارير", "لوحات"].map(
                (cat) => {
                  const pages = PERMISSION_PAGES.filter(
                    (p) => p.category === cat,
                  );
                  if (pages.length === 0) return null;
                  return (
                    <div key={cat} className="space-y-6">
                      <div className="flex items-center gap-4 border-b border-border/40 pb-4">
                        <div className="h-2 w-8 rounded-full bg-primary shadow-lg shadow-primary/20" />
                        <h4 className="text-[11px] font-black uppercase tracking-[0.4em] text-muted">
                          {cat}
                        </h4>
                      </div>
                      <div className="grid gap-3">
                        {pages.map((page) => {
                          const state = formData.permissions[page.id];
                          const Icon = page.icon || Shield;
                          const role = formData.role?.toUpperCase();
                          const isDefaultAllowed =
                            getRolePermission(role, page.id);

                          return (
                            <button
                              key={page.id}
                              onClick={() => togglePermission(page.id)}
                              className={cn(
                                "w-full flex items-center justify-between p-4 rounded-2xl border-2 transition-all duration-300 text-right group",
                                state === true
                                  ? "bg-emerald-500/5 border-emerald-500/20 shadow-soft"
                                  : state === false
                                    ? "bg-rose-500/5 border-rose-500/20 shadow-soft"
                                    : isDefaultAllowed
                                      ? "bg-primary/5 border-primary/10 border-dashed"
                                      : "bg-soft/40 border-transparent hover:border-border hover:bg-soft",
                              )}
                            >
                              <div className="flex items-center gap-4 min-w-0">
                                <div
                                  className={cn(
                                    "h-11 w-11 rounded-xl flex items-center justify-center transition-all duration-500 shadow-sm shrink-0",
                                    state === true
                                      ? "text-emerald-600 bg-white border border-emerald-100 scale-110"
                                      : state === false
                                        ? "text-rose-600 bg-white border border-rose-100 scale-110"
                                        : isDefaultAllowed
                                          ? "text-primary bg-white border border-primary/20"
                                          : "text-muted bg-white border border-border group-hover:scale-105",
                                  )}
                                >
                                  <Icon size={20} />
                                </div>
                                <div className="flex flex-col min-w-0">
                                  <span
                                    className={cn(
                                      "text-sm font-black transition-colors leading-tight truncate",
                                      state !== undefined
                                        ? "text-main"
                                        : isDefaultAllowed
                                          ? "text-primary"
                                          : "text-muted group-hover:text-main",
                                    )}
                                  >
                                    {page.label}
                                  </span>
                                  <span
                                    className="text-[9px] font-bold text-muted/40 tracking-wider mt-1 uppercase truncate"
                                    dir="ltr"
                                  >
                                    {page.id}
                                  </span>
                                </div>
                              </div>
                              <div className="pl-2">
                                {state === true ? (
                                  <div className="h-7 w-7 rounded-full bg-emerald-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/30 animate-in zoom-in-50 duration-500">
                                    <Check size={14} strokeWidth={4} />
                                  </div>
                                ) : state === false ? (
                                  <div className="h-7 w-7 rounded-full bg-rose-500 flex items-center justify-center text-white shadow-lg shadow-rose-500/30 animate-in zoom-in-50 duration-500">
                                    <X size={14} strokeWidth={4} />
                                  </div>
                                ) : isDefaultAllowed ? (
                                  <div className="flex flex-col items-center gap-1">
                                    <div className="h-7 w-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                                      <Zap size={14} fill="currentColor" />
                                    </div>
                                    <span className="text-[8px] font-black text-primary/60 uppercase tracking-tighter">
                                      تلقائي
                                    </span>
                                  </div>
                                ) : (
                                  <div className="h-7 w-7 rounded-full border-2 border-dashed border-border group-hover:border-primary/40 group-hover:bg-primary/5 transition-all" />
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                },
              )}
            </div>
          </div>

          <DialogFooter className="px-10 py-8 bg-soft/30 border-t border-border/40 gap-4 flex-row justify-end">
            <Button
              variant="ghost"
              onClick={() => setIsPermsOpen(false)}
              className="rounded-xl h-12 px-8 font-black text-muted hover:text-main transition-all"
            >
              إلغاء التعديلات
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isActionLoading}
              className="rounded-xl h-12 px-12 bg-[#020617] text-white hover:scale-[1.02] font-black shadow-2xl transition-all flex items-center gap-3"
            >
              {isActionLoading ? (
                <RefreshCw className="animate-spin" size={18} />
              ) : (
                <ShieldCheck size={20} />
              )}
              <span>حفظ البروتوكول الأمني</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
