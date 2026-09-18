import { Search, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TableEmptyState } from "@/components/shared/TableEmptyState";
import { formatDate, getUserName, getRole, getId } from "@/features/security/utils";
import { ROLE_LABELS } from "@/features/security/constants";

type SecurityUser = {
  id?: string | number;
  username?: string;
  email?: string;
  is_active?: boolean;
  full_name?: string;
  fullName?: string;
  display_name?: string;
  role?: string;
  role_name?: string;
  roleName?: string;
  updated_at?: string;
  created_at?: string;
  [key: string]: unknown;
};

export interface UsersPanelTabProps {
  users: SecurityUser[];
  searchTerm: string;
  setSearchTerm: (value: string) => void;
}

export default function UsersPanelTab({ users, searchTerm, setSearchTerm }: UsersPanelTabProps) {
  return (
    <Card className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm  ">
      <div className="flex flex-col gap-4 border-b border-border p-5  md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-black text-main">
            المستخدمون والأدوار
          </h2>
          <p className="mt-1 text-xs font-bold text-muted">
            مراجعة الحسابات النشطة ومستويات الوصول.
          </p>
        </div>
        <div className="relative w-full md:w-80">
          <Search
            className="absolute right-4 top-1/2 -translate-y-1/2 text-muted"
            size={18}
          />
          <Input
            value={searchTerm || ""}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="بحث عن مستخدم أو دور..."
            className="h-11 pr-11 bg-soft border-border focus:bg-card"
          />
        </div>
      </div>
      <div className="overflow-x-auto custom-scrollbar">
        <Table>
          <TableHeader>
            <TableRow className="bg-soft/50 text-[10px] font-black uppercase tracking-widest text-muted">
              <TableHead className="px-4 py-3">المستخدم</TableHead>
              <TableHead className="px-4 py-3">الدور</TableHead>
              <TableHead className="px-4 py-3">الحالة</TableHead>
              <TableHead className="px-4 py-3">آخر تحديث</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => {
              const role = getRole(user);
              return (
                <TableRow key={String(getId(user) || user.username || user.email || Math.random())} className="hover:bg-soft/30">
                  <TableCell>
                    <div>
                      <p className="font-black text-main">
                        {getUserName(user)}
                      </p>
                      <p className="text-xs font-bold text-muted">
                        {String(user?.email || user?.username || "---")}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="rounded-xl px-3 py-1">
                      {ROLE_LABELS[role] || role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {user?.is_active === false ? (
                      <Badge variant="danger" className="rounded-xl px-3 py-1">
                        موقوف
                      </Badge>
                    ) : (
                      <Badge variant="success" className="rounded-xl px-3 py-1">
                        نشط
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted">
                    {formatDate((user?.updated_at || user?.created_at) as string | null | undefined)}
                  </TableCell>
                </TableRow>
              );
            })}
            {users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4}>
                  <TableEmptyState
                    icon={Users}
                    title="لا توجد بيانات مستخدمين"
                    description="تعذر تحميل المستخدمين أو لا توجد حسابات متاحة للعرض."
                  />
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}
