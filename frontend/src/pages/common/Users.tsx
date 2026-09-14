import { useEffect, useMemo, useState } from "react";
import {
  ShieldCheck,
  RefreshCcw,
  Save,
  UserPlus,
  Search,
  UserCog,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { userService } from "@/features/users/services/userService";
import { barberService } from "@/services/barberService";
import { cn } from "@/lib/core/utils";
import { PageHeader, PremiumCard } from "@/components/shared/PremiumUI";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

const ROLE_OPTIONS = [
  { value: "owner", label: "مالك" },
  { value: "manager", label: "مدير" },
  { value: "cashier", label: "كاشير" },
  { value: "barber", label: "حلاق" },
];

const INITIAL_FORM = {
  username: "",
  password: "",
  full_name: "",
  email: "",
  role: "cashier",
  barber_id: "",
  is_active: true,
};

export default function UsersPage() {
   
  const [users, setUsers] = useState<any[]>([]);
   
  const [barbers, setBarbers] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [form, setForm] = useState(INITIAL_FORM);

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const [usersData, barbersData] = await Promise.all([
        userService.list(),
        barberService.list(),
      ]);
      setUsers(Array.isArray(usersData) ? usersData : []);
      setBarbers(
        Array.isArray(barbersData)
          ? barbersData
          : Array.isArray((barbersData as { items?: unknown })?.items)
            ? (barbersData as { items: unknown[] }).items
            : [],
      );
    } catch (err) {
      console.error(err);
      setError("تعذر تحميل المستخدمين");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
       
      (user: any) =>
        String(user.username || "")
          .toLowerCase()
          .includes(q) ||
        String(user.full_name || "")
          .toLowerCase()
          .includes(q) ||
        String(user.email || "")
          .toLowerCase()
          .includes(q) ||
        String(user.role || "")
          .toLowerCase()
          .includes(q),
    );
  }, [users, search]);

  function resetForm() {
    setForm(INITIAL_FORM);
  }

  async function handleRefresh() {
    setRefreshing(true);
    setError("");
    setMessage("");
    try {
      const usersData = await userService.list();
      setUsers(Array.isArray(usersData) ? usersData : []);
      setMessage("تم تحديث قائمة المستخدمين");
    } catch (err) {
      console.error(err);
      setError("تعذر تحديث قائمة المستخدمين");
    } finally {
      setRefreshing(false);
    }
  }

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const payload = {
        username: form.username.trim(),
        password: form.password,
        full_name: form.full_name.trim() || null,
        email: form.email.trim() || null,
        role: form.role,
        barber_id:
          form.role === "barber" && form.barber_id
            ? Number(form.barber_id)
            : null,
        is_active: form.is_active,
      };
      const created = await userService.create(payload);
      setUsers((prev) => [created, ...prev]);
      resetForm();
      setMessage("تم إنشاء المستخدم بنجاح");
    } catch (err) {
      console.error(err);
      const apiErr = err as { response?: { data?: { detail?: unknown } } };
      const detail = apiErr?.response?.data?.detail;
       
      const msg = Array.isArray(detail) ? (detail[0] as any)?.msg : detail;
      setError(typeof msg === "string" ? msg : "تعذر إنشاء المستخدم");
    } finally {
      setSaving(false);
    }
  }

  async function handleRoleChange(userId: string | number, nextRole: string) {
    setError("");
    setMessage("");
    try {
      const updated = await userService.updateRole(userId, nextRole);
      setUsers((prev) =>
         
        prev.map((user: any) => (user.id === userId ? updated : user)),
      );
      setMessage("تم تحديث دور المستخدم");
    } catch (err) {
      console.error(err);
      const apiErr = err as { response?: { data?: { detail?: unknown } } };
      const detail = apiErr?.response?.data?.detail;
       
      const msg = Array.isArray(detail) ? (detail[0] as any)?.msg : detail;
      setError(typeof msg === "string" ? msg : "تعذر تحديث الدور");
    }
  }

  async function handleActiveToggle(userId: string | number, currentValue: boolean) {
    setError("");
    setMessage("");
    try {
      const updated = await userService.updateActive(userId, !currentValue);
      setUsers((prev) =>
         
        prev.map((user: any) => (user.id === userId ? updated : user)),
      );
      setMessage("تم تحديث حالة المستخدم");
    } catch (err) {
      console.error(err);
      const apiErr = err as { response?: { data?: { detail?: unknown } } };
      const detail = apiErr?.response?.data?.detail;
       
      const msg = Array.isArray(detail) ? (detail[0] as any)?.msg : detail;
      setError(typeof msg === "string" ? msg : "تعذر تحديث حالة المستخدم");
    }
  }

  return (
    <div className="erp-page space-y-8 pb-12" dir="rtl">
      <PageHeader
        title="إدارة المستخدمين والصلاحيات"
        subtitle="إنشاء مستخدمين جدد وتعديل الدور وتفعيل/تعطيل الحسابات"
        badge="الأمن والوصول"
        icon={ShieldCheck}
        className={undefined}
        actions={
          <Button
            onClick={handleRefresh}
            disabled={refreshing}
            variant="outline"
            className="h-10 rounded-xl"
          >
            <RefreshCcw
              size={16}
              className={cn("ml-2", refreshing && "animate-spin")}
            />
            {refreshing ? "جارٍ التحديث..." : "تحديث القائمة"}
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-8 xl:grid-cols-[1fr,1.5fr]">
        <PremiumCard className="h-fit">
          <div className="mb-6 flex items-center gap-3 text-lg font-black text-main">
            <UserPlus size={20} className="text-primary" />
            <span>إضافة مستخدم جديد</span>
          </div>
          <form onSubmit={handleCreateUser} className="space-y-5">
            <Field label="اسم المستخدم">
              <Input
                value={form.username || ""}
                onChange={(e) =>
                  setForm((p) => ({ ...p, username: e.target.value }))
                }
                placeholder="مثال: cashier1"
              />
            </Field>
            <Field label="كلمة المرور">
              <Input
                type="password"
                value={form.password || ""}
                onChange={(e) =>
                  setForm((p) => ({ ...p, password: e.target.value }))
                }
                placeholder="••••••••"
              />
            </Field>
            <Field label="الاسم الكامل">
              <Input
                value={form.full_name || ""}
                onChange={(e) =>
                  setForm((p) => ({ ...p, full_name: e.target.value }))
                }
                placeholder="الاسم الكامل للموظف"
              />
            </Field>
            <Field label="البريد الإلكتروني">
              <Input
                type="email"
                value={form.email || ""}
                onChange={(e) =>
                  setForm((p) => ({ ...p, email: e.target.value }))
                }
                placeholder="email@example.com"
              />
            </Field>
            <Field label="الدور الوظيفي">
              <Select
                value={form.role || ""}
                onValueChange={(v) =>
                  setForm((p) => ({
                    ...p,
                    role: v,
                    barber_id: v === "barber" ? p.barber_id : "",
                  }))
                }
              >
                <SelectTrigger className="font-bold h-11 rounded-xl">
                  <SelectValue placeholder="اختر الدور" />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((role) => (
                    <SelectItem
                      key={role.value}
                      value={role.value}
                      className="font-bold"
                    >
                      {role.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            {form.role === "barber" && (
              <Field label="ربط المستخدم بالحلاق">
                <Select
                  value={form.barber_id || ""}
                  onValueChange={(v) =>
                    setForm((p) => ({ ...p, barber_id: v }))
                  }
                >
                  <SelectTrigger className="font-bold h-11 rounded-xl">
                    <SelectValue placeholder="اختر الحلاق" />
                  </SelectTrigger>
                  <SelectContent>
                    {barbers.map((barber) => (
                      <SelectItem
                        key={barber.id}
                        value={String(barber.id)}
                        className="font-bold"
                      >
                        {barber.display_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}

            <div className="flex items-center gap-3 rounded-xl border border-border bg-soft/50 px-4 py-3">
              <input
                id="is_active_user"
                type="checkbox"
                className="h-4 w-4 rounded border-border text-primary focus:ring-primary/20"
                checked={form.is_active}
                onChange={(e) =>
                  setForm((p) => ({ ...p, is_active: e.target.checked }))
                }
              />
              <label
                htmlFor="is_active_user"
                className="text-sm font-bold text-main"
              >
                تفعيل الحساب فوراً
              </label>
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <Button
                type="submit"
                disabled={saving}
                className="h-11 px-8 rounded-xl premium-button"
              >
                <Save size={18} className="ml-2" />
                {saving ? "جارٍ الحفظ..." : "إنشاء الحساب"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={resetForm}
                className="h-11 rounded-xl"
              >
                إعادة ضبط
              </Button>
            </div>
          </form>
        </PremiumCard>

        <PremiumCard className="h-fit" noPadding>
          <div className="p-6 border-b border-border flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3 text-lg font-black text-main">
              <UserCog size={20} className="text-primary" />
              <span>المستخدمون النشطون</span>
            </div>
            <div className="relative w-full sm:w-64">
              <Search
                size={16}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted"
              />
              <Input
                className="pr-11 h-10 rounded-xl"
                value={search || ""}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="بحث سريع..."
              />
            </div>
          </div>

          <div className="p-0 overflow-x-auto">
            {loading ? (
              <div className="py-20 text-center flex flex-col items-center gap-3">
                <RefreshCcw className="animate-spin text-primary" size={24} />
                <p className="text-[10px] font-black uppercase tracking-widest text-muted">
                  جاري تحميل البيانات...
                </p>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="py-20 text-center opacity-40">
                <UserCog size={48} className="mx-auto mb-4 text-muted" />
                <p className="text-sm font-black uppercase tracking-widest">
                  لا يوجد مستخدمون مطابقون
                </p>
              </div>
            ) : (
              <table className="w-full text-right">
                <thead className="bg-soft/50 border-b border-border">
                  <tr>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted">
                      المستخدم
                    </th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted">
                      الدور الوظيفي
                    </th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted text-center">
                      الحالة
                    </th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted text-center">
                      إجراءات
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  { }
                  {filteredUsers.map((user: any) => (
                    <tr
                      key={user.id}
                      className="group hover:bg-soft/30 transition-all"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-xl bg-primary-soft flex items-center justify-center text-primary font-black text-xs border border-primary/10">
                            {user.username?.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-black text-main">
                              {user.full_name || user.username}
                            </p>
                            <p className="text-[10px] font-bold text-muted uppercase">
                              {user.email || user.username}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <select
                          className="bg-transparent border-none text-xs font-black text-primary focus:ring-0 cursor-pointer"
                          value={user.role || ""}
                          onChange={(e) =>
                            handleRoleChange(user.id, e.target.value)
                          }
                        >
                          {ROLE_OPTIONS.map((role) => (
                            <option key={role.value} value={role.value}>
                              {role.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <Badge
                          variant={user.is_active ? "success" : "secondary"}
                          className="h-5 px-2 font-black text-[8px] uppercase tracking-wider"
                        >
                          {user.is_active ? "نشط" : "معطل"}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          className={cn(
                            "text-[10px] font-black uppercase rounded-lg h-8",
                            user.is_active
                              ? "text-danger hover:bg-danger-soft"
                              : "text-success hover:bg-success-soft",
                          )}
                          onClick={() =>
                            handleActiveToggle(user.id, user.is_active)
                          }
                        >
                          {user.is_active ? "تعطيل" : "تفعيل"}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {(message || error) && (
            <div className="p-6 border-t border-border">
              {message && (
                <div className="rounded-xl bg-success-soft p-3 text-xs font-bold text-success-strong border border-success/10">
                  {message}
                </div>
              )}
              {error && (
                <div className="rounded-xl bg-danger-soft p-3 text-xs font-bold text-danger-strong border border-danger/10">
                  {error}
                </div>
              )}
            </div>
          )}
        </PremiumCard>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-2 block text-sm font-bold text-slate-300">
        {label}
      </label>
      {children}
    </div>
  );
}
