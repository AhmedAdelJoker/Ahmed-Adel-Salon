import { ShieldCheck } from "lucide-react";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import {
  usePermissions,
  PermissionsHeader,
  PermissionsMatrix,
  PermissionsModal,
} from "@/features/permissions";

const PermissionsManagement = () => {
  const {
    loading,
    isActionLoading,
    searchTerm,
    setSearchTerm,
    isModalOpen,
    setIsModalOpen,
    editingUser,
    confirmAction,
    setConfirmAction,
    formData,
    setFormData,
    filteredUsers,
    handleEdit,
    handleConfirmAction,
    handleSubmit,
    openCreate,
  } = usePermissions();

  if (loading)
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4 text-accent">
          <ShieldCheck className="w-10 h-10 animate-pulse" />
          <p className="text-muted font-bold text-sm">جاري مراجعة مصفوفة الصلاحيات...</p>
        </div>
      </div>
    );

  return (
    <div className="space-y-8 pb-24 erp-page-container">
      <ConfirmDialog
        open={!!confirmAction}
        onOpenChange={(open) => !open && setConfirmAction(null)}
        title={confirmAction?.type === "delete" ? "سحب صلاحيات الوصول؟" : "تغيير حالة الوصول؟"}
        description={
          confirmAction?.type === "delete"
            ? "هل أنت متأكد من سحب صلاحيات الوصول لهذا الحساب؟ سيتم أرشفة البيانات تلقائياً."
            : "هل أنت متأكد من تغيير صلاحيات الدخول لهذا الحساب؟"
        }
        onConfirm={handleConfirmAction}
        loading={isActionLoading}
      />
      <PermissionsHeader onCreate={openCreate} />
      <PermissionsMatrix
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        filteredUsers={filteredUsers as any}
        loading={loading}
        isActionLoading={isActionLoading}
        onEdit={handleEdit as any}
        onToggle={(u) => setConfirmAction({ type: "toggle", payload: u as any })}
        onDelete={(id) => setConfirmAction({ type: "delete", id })}
      />
      <PermissionsModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        editingUser={editingUser as any}
        formData={formData}
        setFormData={setFormData}
        isActionLoading={isActionLoading}
        loading={loading}
        onSubmit={handleSubmit}
      />
    </div>
  );
};

export default PermissionsManagement;
