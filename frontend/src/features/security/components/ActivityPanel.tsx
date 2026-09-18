import { ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TableEmptyState } from "@/components/shared/TableEmptyState";
import { riskKeywords, formatDate } from "@/features/security/utils";

type SecurityLog = {
  id?: string | number;
  action?: string;
  description?: string;
  entity_type?: string;
  created_at?: string;
  createdAt?: string;
  [key: string]: unknown;
};

export interface ActivityPanelProps {
  logs: SecurityLog[];
}

export default function ActivityPanel({ logs }: ActivityPanelProps) {
  const sensitiveLogs = logs.filter((log) =>
    riskKeywords.test(
      `${String(log?.action ?? "")} ${String(log?.entity_type ?? "")} ${String(log?.description ?? "")}`,
    ),
  );

  return (
    <Card className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm  ">
      <div className="border-b border-border p-5 ">
        <h2 className="text-xl font-black text-main">
          سجل المخاطر والعمليات الحساسة
        </h2>
        <p className="mt-1 text-xs font-bold text-muted">
          آخر العمليات المرتبطة بالحذف، الخصومات، التصدير، الصلاحيات، وتسجيل
          الدخول.
        </p>
      </div>
      <div className="overflow-x-auto custom-scrollbar">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="px-4 py-3">الإجراء</TableHead>
              <TableHead className="px-4 py-3">الوصف</TableHead>
              <TableHead className="px-4 py-3">الكيان</TableHead>
              <TableHead className="px-4 py-3">التوقيت</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sensitiveLogs.map((log) => (
              <TableRow key={String(log.id || `${log.action}-${log.created_at}`)} className="hover:bg-soft/30">
                <TableCell>
                  <Badge variant="warning" className="rounded-xl px-3 py-1">
                    {log.action || "عملية"}
                  </Badge>
                </TableCell>
                <TableCell className="max-w-105 truncate font-bold text-main">
                  {log.description || "لا يوجد وصف"}
                </TableCell>
                <TableCell className="text-xs text-muted">
                  {log.entity_type || "عام"}
                </TableCell>
                <TableCell className="text-xs text-muted">
                  {formatDate((log.created_at || log.createdAt) as string | null | undefined)}
                </TableCell>
              </TableRow>
            ))}
            {sensitiveLogs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4}>
                  <TableEmptyState
                    icon={ShieldCheck}
                    title="لا توجد عمليات حساسة"
                    description="لم يتم العثور على أحداث عالية المخاطر ضمن آخر السجلات."
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
