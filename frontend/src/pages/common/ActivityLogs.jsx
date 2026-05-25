import { useAuth } from "../../context/AuthContext";
import React, { useEffect, useMemo, useState } from "react";



import { toast } from "react-hot-toast";
import {
  Activity,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  RefreshCw,
  Search,
  ShieldCheck,
} from "lucide-react";

import { activityLogService } from "../../services/activityLogService";
import { Card } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Input } from "../../components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import { TableEmptyState } from "../../components/shared/TableEmptyState";

const PAGE_SIZE = 15;

function formatDate(value) {
  if (!value) return "---";

  try {
    return new Date(value).toLocaleString("ar-EG", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return value;
  }
}

function formatAction(value) {
  if (!value) return "غير محدد";
  return String(value).replace(/_/g, " ");
}

function formatEntity(value) {
  if (!value) return "عام";
  return String(value).replace(/_/g, " ");
}

const ActivityLogs = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {

    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm.trim());
      setPage(1);
    }, 400);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  const fetchLogs = async ({ background = false } = {}) => {
    try {
      if (background) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const response = await activityLogService.list({
        page,
        page_size: PAGE_SIZE,
        q: debouncedSearch || undefined,
      });

      setLogs(response.items || []);
      setTotalCount(response.total || 0);
    } catch (error) {
      console.error("Activity logs load error:", error);
      toast.error("تعذر تحميل سجل النشاط");
      setLogs([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [page, debouncedSearch]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const suspiciousCount = useMemo(
    () =>
      logs.filter((row) =>
        /delete|cancel|refund|discount|login|permission/i.test(
          `${row.action || ""} ${row.entity_type || ""}`,
        ),
      ).length,
    [logs],
  );

  return (
    <div className="space-y-8 pb-24" dir="rtl">
      <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary shadow-soft">
            <ClipboardList className="h-7 w-7 text-inverse" />
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tight text-main">
              سجل الرقابة
            </h1>
            <p className="text-sm text-muted">
              مراجعة العمليات الحساسة والتغييرات المالية والإدارية المسجلة داخل
              النظام
            </p>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          disabled={loading}
          onClick={() => fetchLogs({ background: true })}
          loading={refreshing}
          className="h-11 rounded-xl border-border px-6 text-[10px] font-black uppercase tracking-widest"
        >
          تحديث السجل <RefreshCw className="mr-2" size={16} />
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          title="إجمالي السجلات"
          value={totalCount || ""}
          icon={ClipboardList}
        />
        <SummaryCard
          title="نتائج الصفحة"
          value={logs.length || ""}
          icon={Activity}
          accent
        />
        <SummaryCard
          title="عمليات حساسة"
          value={suspiciousCount || ""}
          icon={ShieldCheck}
          success={suspiciousCount === 0}
        />
        <SummaryCard
          title="الحالة"
          value={loading ? "تحميل" : "جاهز"}
          icon={RefreshCw}
        />
      </div>

      <Card className="flex flex-col gap-4 rounded-2xl border-border bg-card p-4 shadow-soft lg:flex-row">
        <div className="relative flex-1">
          <Search
            className="absolute right-4 top-1/2 -translate-y-1/2 text-muted"
            size={20}
          />
          <Input
            value={searchTerm || ""}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="ابحث بالإجراء، الكيان، أو الوصف..."
            className="h-11 rounded-xl pr-12"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setSearchTerm("");
            setDebouncedSearch("");
            setPage(1);
          }}
          className="h-11 rounded-xl border-border px-6 text-[10px] font-black uppercase tracking-widest"
        >
          إعادة ضبط
        </Button>
      </Card>

      <Card className="overflow-hidden rounded-[26px] border-border bg-card shadow-soft">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-soft/50">
              <TableRow>
                <TableHead>المستخدم</TableHead>
                <TableHead>الإجراء</TableHead>
                <TableHead className="hidden md:table-cell">الكيان</TableHead>
                <TableHead>الوصف</TableHead>
                <TableHead className="hidden lg:table-cell">
                  الجهاز / IP
                </TableHead>
                <TableHead>التوقيت</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="font-bold text-main">
                    {log.user_name || "مستخدم النظام"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{formatAction(log.action)}</Badge>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-muted">
                    {formatEntity(log.entity_type)}
                  </TableCell>
                  <TableCell className="max-w-[340px] truncate text-main">
                    {log.description || "لا يوجد وصف إضافي"}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-xs text-muted">
                    {log.device_label || log.ip_address || "---"}
                  </TableCell>
                  <TableCell className="text-xs text-muted">
                    {formatDate(log.created_at)}
                  </TableCell>
                </TableRow>
              ))}
              {logs.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={6}>
                    <TableEmptyState
                      icon={ClipboardList}
                      title="لا توجد سجلات"
                      description="لم يتم العثور على عمليات مطابقة للفلاتر الحالية."
                    />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-border bg-soft/30 p-4">
            <div className="text-xs font-bold uppercase tracking-widest text-muted">
              عرض {logs.length} من أصل {totalCount} سجل
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8 rounded-lg"
                title={page === 1 ? "أنت في الصفحة الأولى" : "الصفحة السابقة"}
                aria-label="الصفحة السابقة"
                disabled={loading}
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                disabled={page === 1}
              >
                <ChevronRight size={16} />
              </Button>
              <span className="text-xs font-black text-main">
                {page} / {totalPages}
              </span>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8 rounded-lg"
                title={
                  page === totalPages
                    ? "أنت في الصفحة الأخيرة"
                    : "الصفحة التالية"
                }
                aria-label="الصفحة التالية"
                onClick={() =>
                  setPage((prev) => Math.min(totalPages, prev + 1))
                }
                disabled={page === totalPages}
              >
                <ChevronLeft size={16} />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};

function SummaryCard({
  title,
  value,
  icon: Icon,
  accent = false,
  success = false,
}) {
  const color = success ? "text-success" : accent ? "text-accent" : "text-main";

  return (
    <Card className="rounded-[26px] border-border bg-card p-6 shadow-soft">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="text-[10px] font-black uppercase tracking-widest text-muted">
          {title}
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-border bg-soft">
          <Icon className="h-5 w-5 text-accent" />
        </div>
      </div>
      <h3 className={`text-2xl font-black tracking-tight ${color}`}>{value}</h3>
    </Card>
  );
}

export default ActivityLogs;

