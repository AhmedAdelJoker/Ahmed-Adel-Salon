import { useState, useEffect, useCallback, useMemo } from "react";
import api from "@/services/api";
import { toast } from "react-hot-toast";
import type { ManagedUser } from "@/types/employee";

export type ConfirmAction =
  | { type: "toggle"; payload: ManagedUser; id?: never }
  | { type: "delete"; id: string | number; payload?: never };

export type PermissionsFormData = {
  fullName: string;
  username: string;
  password: string;
  role: string;
  phone: string;
  specialty: string;
  status: string;
  isActive: boolean;
};

const DEFAULT_FORM: PermissionsFormData = {
  fullName: "",
  username: "",
  password: "",
  role: "CASHIER",
  phone: "",
  specialty: "",
  status: "ACTIVE",
  isActive: true,
};

export function usePermissions() {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [formData, setFormData] = useState<PermissionsFormData>({ ...DEFAULT_FORM });

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get("/users");
      const data = res.data;
      const usersList = Array.isArray(data) ? data : data.items || [];
      setUsers(
        usersList.map((u: any) => ({
          id: u.id,
          fullName: u.full_name || u.username,
          username: u.username,
          role: String(u.role || "").toUpperCase(),
          status: u.is_active === false ? "SUSPENDED" : "ACTIVE",
          isActive: u.is_active !== false,
        })),
      );
    } catch (_err) {
      toast.error("فشل في تحميل مصفوفة البيانات الأمنية");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleEdit = useCallback((user: ManagedUser) => {
    setEditingUser(user);
    setFormData({
      fullName: (user as any).fullName || "",
      username: (user as any).username || "",
      password: "",
      role: (user as any).role || "BARBER",
      phone: (user as any).phone || "",
      specialty: (user as any).specialty || "",
      status: (user as any).status || "ACTIVE",
      isActive: (user as any).isActive ?? true,
    });
    setIsModalOpen(true);
  }, []);

  const handleConfirmAction = useCallback(async () => {
    if (!confirmAction) return;
    try {
      setIsActionLoading(true);
      if (confirmAction.type === "delete") {
        await api.delete(`/users/${confirmAction.id}`);
        toast.success("تم أرشفة الهوية بنجاح");
      } else if (confirmAction.type === "toggle") {
        const user = confirmAction.payload;
        const newStatus = (user as any).status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
        await api.put(`/users/${(user as any).id}`, {
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
  }, [confirmAction, fetchUsers]);

  const handleSubmit = useCallback(async () => {
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
        await api.put(`/users/${(editingUser as any).id}`, payload);
        toast.success("تم تحديث بروتوكولات الموظف");
      } else {
        await api.post("/users", payload);
        toast.success("تم إنشاء الهوية الأمنية بنجاح");
      }
      setIsModalOpen(false);
      fetchUsers();
    } catch (_err) {
      toast.error(((_err as any).response?.data?.detail as string) || "حدث خطأ أثناء حفظ التعديلات");
    } finally {
      setIsActionLoading(false);
    }
  }, [editingUser, fetchUsers, formData]);

  const filteredUsers = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return (Array.isArray(users) ? users : []).filter(
      (u: any) =>
        (u.fullName?.toLowerCase().includes(term) ||
          u.username?.toLowerCase().includes(term)),
    );
  }, [searchTerm, users]);

  const openCreate = useCallback(() => {
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
  }, []);

  return {
    users,
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
    fetchUsers,
    handleEdit,
    handleConfirmAction,
    handleSubmit,
    openCreate,
  };
}
