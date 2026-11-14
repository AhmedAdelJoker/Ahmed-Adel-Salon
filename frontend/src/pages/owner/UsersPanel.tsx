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
import { useTranslation } from "react-i18next";

export default function UsersPanel({ embedded = false }: { embedded?: boolean }) {
  const { t } = useTranslation("owner");
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
    <div className={embedded ? "space-y-6" : "erp-page space-y-6 pb-10"}>
      <ConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
        title={t("usersPanel.deleteTitle")}
        description={t("usersPanel.deleteDesc")}
        onConfirm={handleDelete}
        loading={isActionLoading}
      />

      {!embedded && (
        <PageHeader
          title={t("usersPanel.title")}
          subtitle={t("usersPanel.subtitle")}
          badge={t("usersPanel.badge")}
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
              {t("usersPanel.issueNew")}
            </Button>
          }
        />
      )}
      {embedded && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-border">
          <div>
            <h3 className="text-sm font-black text-main flex items-center gap-2">
              <ShieldCheck size={16} className="text-primary" /> {t("usersPanel.embeddedTitle")}
            </h3>
            <p className="text-[11px] font-bold text-muted mt-1">{t("usersPanel.embeddedDesc")}</p>
          </div>
          <Button
            onClick={() => {
              resetForm();
              setIsModalOpen(true);
            }}
            className="h-10 rounded-xl px-5 font-black shrink-0"
          >
            <Plus size={16} className="ms-1.5" /> {t("usersPanel.issue")}
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label={t("usersPanel.totalIdentities")}
          value={stats.total}
          icon={Users2}
          variant="primary"
          trend={undefined}
          trendValue={undefined}
          delay={0}
        />
        <StatCard
          label={t("usersPanel.admins")}
          value={stats.admins}
          icon={ShieldCheck}
          variant="info"
          trend={undefined}
          trendValue={undefined}
          delay={0.05}
        />
        <StatCard
          label={t("usersPanel.activeIdentities")}
          value={stats.active}
          icon={CheckCircle2}
          variant="success"
          trend={undefined}
          trendValue={undefined}
          delay={0.1}
        />
        <StatCard
          label={t("usersPanel.activityRate")}
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
