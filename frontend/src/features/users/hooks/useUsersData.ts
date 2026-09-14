import { useState, useEffect, useMemo, useCallback } from "react";
import api from "@/services/api";
import { toast } from "react-hot-toast";
import { getApiErrorMessage } from "@/lib/core/utils";
import { PERMISSION_PAGES, DEFAULT_ROLE_PERMISSIONS } from "../constants";

interface UserFormData {
  username: string;
  password: string;
  full_name: string;
  email: string;
  role: string;
  is_active: boolean;
  permissions: Record<string, boolean>;
}

export function useUsersData() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState("grid");
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPermsOpen, setIsPermsOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<any | null>(null);
  const [formData, setFormData] = useState<UserFormData>({
    username: "",
    password: "",
    full_name: "",
    email: "",
    role: "CASHIER",
    is_active: true,
    permissions: {},
  });

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get("/users");
      setUsers(res.data || []);
    } catch (_err) {
      toast.error("فشل في مزامنة الهويات الرقمية");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleEdit = useCallback((user: any) => {
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
  }, []);

  const handleOpenPerms = useCallback((user: any) => {
    setEditingUser(user);
    setFormData({
      ...user,
      role: String(user.role).toUpperCase(),
      permissions: user.permissions || {},
    });
    setIsPermsOpen(true);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!formData.username || (!editingUser && !formData.password)) {
      toast.error("يرجى إدخال البيانات الأساسية للهوية");
      return;
    }
    try {
      setIsActionLoading(true);
      const payload = { ...formData, email: formData.email?.trim() || null, role: formData.role.toLowerCase() };
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
    } catch (_err) {
      const detail = (_err as any).response?.data?.detail;
      const errorMessage = Array.isArray(detail) ? detail[0]?.msg : detail;
      toast.error(typeof errorMessage === "string" ? errorMessage : "فشل في حفظ التعديلات");
    } finally {
      setIsActionLoading(false);
    }
  }, [formData, editingUser, fetchUsers]);

  const handleDelete = useCallback(async () => {
    if (!confirmDelete) return;
    try {
      setIsActionLoading(true);
      await api.delete(`/users/${confirmDelete}`);
      toast.success("تم سحب الصلاحيات وأرشفة الهوية");
      fetchUsers();
    } catch (_err) {
      toast.error("فشل في حذف المستخدم");
    } finally {
      setIsActionLoading(false);
      setConfirmDelete(null);
    }
  }, [confirmDelete, fetchUsers]);

  const togglePermission = useCallback((pageId: string) => {
    setFormData((prev) => {
      const perms = { ...prev.permissions };
      if (perms[pageId] === true) perms[pageId] = false;
      else if (perms[pageId] === false) delete perms[pageId];
      else perms[pageId] = true;
      return { ...prev, permissions: perms };
    });
  }, []);

  const filteredUsers = useMemo(
    () =>
      users.filter(
        (u) =>
          u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (u.full_name && u.full_name.toLowerCase().includes(searchTerm.toLowerCase())),
      ),
    [users, searchTerm],
  );

  const stats = useMemo(
    () => ({
      total: users.length,
      active: users.filter((u) => u.is_active).length,
      admins: users.filter((u) => ["OWNER", "ADMIN"].includes(String(u.role).toUpperCase())).length,
      staff: users.filter((u) => !["OWNER", "ADMIN"].includes(String(u.role).toUpperCase())).length,
      percActive: users.length > 0 ? Math.round((users.filter((u) => u.is_active).length / users.length) * 100) : 0,
    }),
    [users],
  );

  const resetForm = useCallback(() => {
    setEditingUser(null);
    setFormData({ username: "", password: "", full_name: "", email: "", role: "CASHIER", is_active: true, permissions: {} });
  }, []);

  const getRolePermission = useCallback(
    (role: string, pageId: string) => {
      const r = role?.toUpperCase();
      return DEFAULT_ROLE_PERMISSIONS[r]?.(pageId) || false;
    },
    [],
  );

  return {
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
    setEditingUser,
    isActionLoading,
    confirmDelete,
    setConfirmDelete,
    formData,
    setFormData,
    fetchUsers,
    handleEdit,
    handleOpenPerms,
    handleSubmit,
    handleDelete,
    togglePermission,
    resetForm,
    getRolePermission,
    PERMISSION_PAGES,
  };
}
