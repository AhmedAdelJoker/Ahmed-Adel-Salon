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
    <Card className="overflow-hidden rounded-3xl border border-black/5 bg-white shadow-sm dark:border-white/10 dark:bg-[#171717]">
      <div className="flex flex-col gap-4 border-b border-black/5 p-5 dark:border-white/10 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-black text-gray-950 dark:text-gray-50">
            المستخدمون والأدوار
          </h2>
          <p className="mt-1 text-xs font-bold text-gray-500 dark:text-gray-400">
            مراجعة الحسابات النشطة ومستويات الوصول.
          </p>
        </div>
        <div className="relative w-full md:w-80">
          <Search
            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400"
            size={18}
          />
          <Input
            value={searchTerm || ""}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="بحث عن مستخدم أو دور..."
            className="h-11 pr-11"
          />
        </div>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>المستخدم</TableHead>
              <TableHead>الدور</TableHead>
              <TableHead>الحالة</TableHead>
              <TableHead>آخر تحديث</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => {
              const role = getRole(user);
              return (
                <TableRow key={String(getId(user) || user.username || user.email || Math.random())}>
                  <TableCell>
                    <div>
                      <p className="font-black text-gray-950 dark:text-gray-50">
                        {getUserName(user)}
                      </p>
                      <p className="text-xs font-bold text-gray-500 dark:text-gray-400">
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
                  <TableCell className="text-xs text-gray-500 dark:text-gray-400">
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
