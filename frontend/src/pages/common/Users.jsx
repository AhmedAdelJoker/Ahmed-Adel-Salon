import { useAuth } from "../../context/AuthContext";
import { useEffect, useMemo, useState } from "react";
import {
  ShieldCheck,
  RefreshCcw,
  Save,
  UserPlus,
  Search,
  UserCog,
} from "lucide-react";
import CardShell from "../../components/common/CardShell";
import PanelHeader from "../../components/common/PanelHeader";
import Button from "../../components/common/Button";
import { userService } from "../../services/userService";
import { barbersService } from "../../services/barbersService";

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
  const [users, setUsers] = useState([]);
  const [barbers, setBarbers] = useState([]);
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
        barbersService.list(),
      ]);
      setUsers(Array.isArray(usersData) ? usersData : []);
      setBarbers(Array.isArray(barbersData) ? barbersData : []);
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
      (user) =>
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

  async function handleCreateUser(e) {
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
      const detail = err?.response?.data?.detail;
      const msg = Array.isArray(detail) ? detail[0]?.msg : detail;
      setError(typeof msg === 'string' ? msg : "تعذر إنشاء المستخدم");
    } finally {
      setSaving(false);
    }
  }

  async function handleRoleChange(userId, nextRole) {
    setError("");
    setMessage("");
    try {
      const updated = await userService.updateRole(userId, nextRole);
      setUsers((prev) =>
        prev.map((user) => (user.id === userId ? updated : user)),
      );
      setMessage("تم تحديث دور المستخدم");
    } catch (err) {
      console.error(err);
      const detail = err?.response?.data?.detail;
      const msg = Array.isArray(detail) ? detail[0]?.msg : detail;
      setError(typeof msg === 'string' ? msg : "تعذر تحديث الدور");
    }
  }

  async function handleActiveToggle(userId, currentValue) {
    setError("");
    setMessage("");
    try {
      const updated = await userService.updateActive(userId, !currentValue);
      setUsers((prev) =>
        prev.map((user) => (user.id === userId ? updated : user)),
      );
      setMessage("تم تحديث حالة المستخدم");
    } catch (err) {
      console.error(err);
      const detail = err?.response?.data?.detail;
      const msg = Array.isArray(detail) ? detail[0]?.msg : detail;
      setError(typeof msg === 'string' ? msg : "تعذر تحديث حالة المستخدم");
    }
  }

  return (
    <div className="app-limit space-y-4">
      <CardShell strong>
        <PanelHeader
          icon={<ShieldCheck size={22} />}
          title="إدارة المستخدمين والصلاحيات"
          subtitle="إنشاء مستخدمين جدد وتعديل الدور وتفعيل/تعطيل الحسابات."
        />
        <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[1fr,1.2fr]">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
            <div className="mb-4 flex items-center gap-2 text-lg font-black">
              <UserPlus size={18} />
              <span>إضافة مستخدم جديد</span>
            </div>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <Field label="اسم المستخدم">
                <input
                  className="field-control w-full"
                  value={form.username || ""}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, username: e.target.value }))
                  }
                  placeholder="مثال: cashier1"
                />
              </Field>
              <Field label="كلمة المرور">
                <input
                  type="password"
                  className="field-control w-full"
                  value={form.password || ""}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, password: e.target.value }))
                  }
                  placeholder="••••••••"
                />
              </Field>
              <Field label="الاسم الكامل">
                <input
                  className="field-control w-full"
                  value={form.full_name || ""}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, full_name: e.target.value }))
                  }
                  placeholder="الاسم الكامل"
                />
              </Field>
              <Field label="البريد الإلكتروني">
                <input
                  className="field-control w-full"
                  value={form.email || ""}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, email: e.target.value }))
                  }
                  placeholder="email@example.com"
                />
              </Field>
              <Field label="الدور">
                <select
                  className="field-control w-full"
                  value={form.role || ""}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      role: e.target.value,
                      barber_id: e.target.value === "barber" ? p.barber_id : "",
                    }))
                  }
                >
                  {ROLE_OPTIONS.map((role) => (
                    <option key={role.value} value={role.value || ""}>
                      {role.label}
                    </option>
                  ))}
                </select>
              </Field>
              {form.role === "barber" ? (
                <Field label="ربط المستخدم بالحلاق">
                  <select
                    className="field-control w-full"
                    value={form.barber_id || ""}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, barber_id: e.target.value }))
                    }
                  >
                    <option value="">اختر الحلاق</option>
                    {barbers.map((barber) => (
                      <option key={barber.id} value={barber.id || ""}>
                        {barber.display_name}
                      </option>
                    ))}
                  </select>
                </Field>
              ) : null}
              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <input
                  id="is_active_user"
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, is_active: e.target.checked }))
                  }
                />
                <label
                  htmlFor="is_active_user"
                  className="text-sm font-bold text-slate-200"
                >
                  الحساب نشط
                </label>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button type="submit" variant="primary" disabled={saving}>
                  <Save size={16} />
                  {saving ? "جارٍ الحفظ..." : "إنشاء المستخدم"}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={loading}
                  onClick={resetForm}
                >
                  إعادة ضبط
                </Button>
              </div>
            </form>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-2 text-lg font-black">
                <UserCog size={18} />
                <span>المستخدمون الحاليون</span>
              </div>
              <div className="flex flex-col gap-3 md:flex-row">
                <div className="relative min-w-[260px]">
                  <Search
                    size={16}
                    className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    className="field-control w-full pr-11"
                    value={search || ""}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="ابحث باسم المستخدم أو الدور..."
                  />
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={loading}
                  onClick={handleRefresh}
                  disabled={refreshing}
                >
                  <RefreshCcw size={16} />
                  {refreshing ? "جارٍ التحديث..." : "تحديث"}
                </Button>
              </div>
            </div>
            {loading ? (
              <div className="empty-state">جارٍ تحميل المستخدمين...</div>
            ) : filteredUsers.length === 0 ? (
              <div className="empty-state">لا يوجد مستخدمون</div>
            ) : (
              <div className="overflow-x-auto scrollbar-soft">
                <table className="min-w-full text-right">
                  <thead className="table-head">
                    <tr>
                      <th className="px-5 py-4 font-bold">#</th>
                      <th className="px-5 py-4 font-bold">اسم المستخدم</th>
                      <th className="px-5 py-4 font-bold">الاسم</th>
                      <th className="px-5 py-4 font-bold">الدور</th>
                      <th className="px-5 py-4 font-bold">الحالة</th>
                      <th className="px-5 py-4 font-bold">ربط الحلاق</th>
                      <th className="px-5 py-4 font-bold">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="table-body">
                    {filteredUsers.map((user, index) => (
                      <tr key={user.id}>
                        <td className="px-5 py-4">{index + 1}</td>
                        <td className="px-5 py-4 font-semibold">
                          {user.username}
                        </td>
                        <td className="px-5 py-4">{user.full_name || "-"}</td>
                        <td className="px-5 py-4">
                          <select
                            className="field-control min-w-[140px]"
                            value={user.role || ""}
                            onChange={(e) =>
                              handleRoleChange(user.id, e.target.value)
                            }
                          >
                            {ROLE_OPTIONS.map((role) => (
                              <option key={role.value} value={role.value || ""}>
                                {role.label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${user.is_active ? "bg-emerald-500/15 text-emerald-300" : "bg-red-500/15 text-red-300"}`}
                          >
                            {user.is_active ? "نشط" : "موقوف"}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          {user.barber_id ? `#${user.barber_id}` : "-"}
                        </td>
                        <td className="px-5 py-4">
                          <Button
                            type="button"
                            variant="secondary"
                            disabled={loading}
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
              </div>
            )}
            {message ? (
              <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
                {message}
              </div>
            ) : null}
            {error ? (
              <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {error}
              </div>
            ) : null}
          </div>
        </div>
      </CardShell>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="mb-2 block text-sm font-bold text-slate-300">
        {label}
      </label>
      {children}
    </div>
  );
}

