import { Search, Shield, Edit3, Power, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import type { ManagedUser } from "@/types/employee";

type Props = {
  searchTerm: string;
  setSearchTerm: (v: string) => void;
  filteredUsers: ManagedUser[];
  loading: boolean;
  isActionLoading: boolean;
  onEdit: (u: ManagedUser) => void;
  onToggle: (u: ManagedUser) => void;
  onDelete: (id: string | number) => void;
};

export default function PermissionsMatrix({
  searchTerm,
  setSearchTerm,
  filteredUsers,
  loading,
  isActionLoading,
  onEdit,
  onToggle,
  onDelete,
}: Props) {
  return (
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
            {filteredUsers.map((user: any) => (
              <tr key={user.id} className="group transition-all hover:bg-accent-subtle/30">
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
                      onClick={() => onEdit(user)}
                      className="h-10 w-10 rounded-xl border border-border group-hover:border-accent/20 transition-all shadow-sm"
                      title="تحديث بيانات الصلاحيات"
                    >
                      <Edit3 size={18} strokeWidth={2} />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => onToggle(user)}
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
                        onClick={() => onDelete(user.id)}
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
                    <Shield size={80} strokeWidth={1} className="text-muted" />
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
  );
}
