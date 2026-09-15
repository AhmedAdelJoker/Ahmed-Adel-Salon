import { ShieldCheck, Plus, Users2, CheckCircle2, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { PageHeader, StatCard } from "@/components/shared/PremiumUI";
import {
  useUsersData,
  UsersToolbar,
  UsersViewContent,
  UserFormModal,
  UserPermissionsDialog,
} from "@/features/users";

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

      <UsersToolbar
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        viewMode={viewMode}
        setViewMode={setViewMode}
      />

      <UsersViewContent
        loading={loading}
        viewMode={viewMode}
        filteredUsers={filteredUsers}
        onEdit={handleEdit}
        onOpenPerms={handleOpenPerms}
        onDeleteRequest={(id) => setConfirmDelete(id)}
      />

      <UserFormModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        editingUser={editingUser}
        formData={formData}
        setFormData={setFormData}
        onSubmit={handleSubmit}
        isActionLoading={isActionLoading}
      />

      <UserPermissionsDialog
        open={isPermsOpen}
        onOpenChange={setIsPermsOpen}
        formData={formData}
        permissionPages={PERMISSION_PAGES}
        getRolePermission={getRolePermission}
        onTogglePermission={togglePermission}
        onSubmit={handleSubmit}
        isActionLoading={isActionLoading}
      />
    </div>
  );
}
