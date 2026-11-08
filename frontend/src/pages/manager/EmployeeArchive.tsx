import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Archive,
  CalendarClock,
  Eye,
  HelpCircle,
  RefreshCw,
  RotateCcw,
  Search,
  Users,
  X,
} from "lucide-react";
import { toast } from "react-hot-toast";
import api from "@/services/api";
import {
  useEmployeeStats,
  useEmployeesArchive,
  useInvalidateEmployees,
} from "@/hooks/useApi";
import {
  archiveReasonLabel,
  formatEmployeeDate,
  jobTitleLabel,
  normalizeEmployeeRecord,
  tenureBetween,
} from "@/features/hr/utils/helpers";
import {
  ARCHIVE_REASON_VALUES,
  HrStatStrip,
  type HrStatCell,
} from "@/features/hr";
import { getIntlLocale } from "@/lib/format/locale";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PremiumUI";
import { Pagination, createPaginationState } from "@/components/shared/Pagination";
import { EmployeePhoto } from "@/components/shared/EmployeePhoto";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/core/utils";
import { useUI } from "@/context/UIContext";

const PAGE_SIZE = 25;
const ANY_REASON = "any";

/**
 * The archive, read the way it is actually used: who left, when, why, how long
 * they were here, and one control that brings them back.
 *
 * Three things this replaced. The page used to load up to a thousand rows and
 * search them in the browser, so a roster of leavers past that limit became
 * unsearchable and the owner had no way to know the list was cut short. It
 * printed a hire date and no departure date, because the API never sent the
 * departure date — there was no column to read it from. And "restore" was a
 * field write that set the employee active again while leaving the POS and
 * booking switches switched off by the archive, so a returned barber showed up
 * on the team list invisible at the till.
 */
export default function EmployeeArchive() {
  const { t, i18n } = useTranslation("owner");
  const locale = getIntlLocale(i18n.resolvedLanguage || i18n.language || "ar");
  const navigate = useNavigate();
  const invalidateEmployees = useInvalidateEmployees();
  const { openEmployeeQuickView } = useUI();

  const [searchTerm, setSearchTerm] = useState("");
  const [query, setQuery] = useState("");
  const [reasonFilter, setReasonFilter] = useState<string>(ANY_REASON);
  const [page, setPage] = useState(1);
  const [confirmTarget, setConfirmTarget] = useState<any | null>(null);
  const [isActionLoading, setIsActionLoading] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setQuery(searchTerm.trim()), 350);
    return () => clearTimeout(id);
  }, [searchTerm]);

  useEffect(() => {
    setPage(1);
  }, [query, reasonFilter]);

  const params = useMemo(
    () => ({
      ...(query ? { q: query } : {}),
      ...(reasonFilter !== ANY_REASON ? { reason: reasonFilter } : {}),
      skip: (page - 1) * PAGE_SIZE,
      limit: PAGE_SIZE,
    }),
    [query, reasonFilter, page],
  );

  const { data, isLoading, isFetching, refetch } = useEmployeesArchive(params);
  const rows = useMemo(
    () => (data?.items ?? []).map((row) => normalizeEmployeeRecord(row)),
    [data],
  );
  const resultTotal = data?.total ?? 0;

  const { data: roster, isLoading: statsLoading } = useEmployeeStats<{
    resigned?: number;
  }>();
  const archivedTotal = roster?.resigned ?? 0;
  const undatedInResults = rows.filter((row: any) => !row.archivedOn).length;

  const filtersActive =
    Boolean(searchTerm.trim()) || reasonFilter !== ANY_REASON;
  const searchPending = searchTerm.trim() !== query;
  const rangeStart =
    resultTotal === 0 || rows.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min((page - 1) * PAGE_SIZE + rows.length, resultTotal);

  const handleRestore = async () => {
    if (!confirmTarget) return;
    try {
      setIsActionLoading(true);
      await api.post(`/employees/${confirmTarget.id}/restore`);
      toast.success(t("empArch.restoreSuccess"));
      setConfirmTarget(null);
      invalidateEmployees();
    } catch (error) {
      const detail = (error as { response?: { data?: { detail?: unknown } } })
        ?.response?.data?.detail;
      toast.error(
        typeof detail === "string" ? detail : t("empArch.restoreFailed"),
      );
    } finally {
      setIsActionLoading(false);
    }
  };

  const clearFilters = () => {
    setSearchTerm("");
    setReasonFilter(ANY_REASON);
  };

  const tenureText = (hireDate?: string, archivedOn?: string) => {
    const tenure = tenureBetween(hireDate, archivedOn);
    if (!tenure) return null;
    return tenure.years > 0
      ? t("empArch.tenureYears", { years: tenure.years, months: tenure.months })
      : t("empArch.tenureMonths", { months: tenure.months });
  };

  const cells: HrStatCell[] = [
    {
      key: "archived",
      label: t("empArch.statArchived"),
      value: statsLoading ? "—" : archivedTotal,
      hint: t("empArch.statArchivedHint"),
      icon: Archive,
    },
    {
      key: "results",
      label: t("empArch.statResults"),
      value: isLoading ? "—" : resultTotal,
      hint: t("empArch.statResultsHint"),
      icon: Search,
    },
    {
      key: "undated",
      label: t("empArch.statUndated"),
      value: isLoading ? "—" : undatedInResults,
      // The hint is explicit that this counts this page, not the whole archive:
      // the API has no aggregate for a column that predates the column itself.
      hint: t("empArch.statUndatedHint"),
      icon: CalendarClock,
      tone: undatedInResults > 0 ? "warning" : "default",
    },
  ];

  return (
    <div className="erp-page space-y-5 pb-16">
      <ConfirmDialog
        open={!!confirmTarget}
        onOpenChange={(open) => !open && setConfirmTarget(null)}
        variant="info"
        title={t("empArch.restoreTitle")}
        confirmText={t("empArch.restoreConfirm")}
        description={t("empArch.restoreDescription", {
          name: confirmTarget?.fullName ?? "",
        })}
        onConfirm={handleRestore}
        loading={isActionLoading}
      />

      <PageHeader
        title={t("empArch.title")}
        subtitle={t("empArch.subtitle")}
        badge={t("empArch.badge")}
        icon={Archive}
        actions={
          <Button
            variant="outline"
            onClick={() => navigate("/manager/hr")}
            className="h-10 rounded-lg border-line bg-raised px-4 text-xs font-semibold text-content-secondary hover:border-accent hover:text-content"
          >
            <Users size={15} className="ms-1.5" />
            {t("empArch.backToTeam")}
          </Button>
        }
      />

      <HrStatStrip cells={cells} />

      <div className="flex flex-col gap-3 rounded-xl border border-line bg-raised p-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1 sm:max-w-sm">
            <Search
              size={16}
              aria-hidden="true"
              className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-content-tertiary"
            />
            <Input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder={t("empArch.searchPlaceholder")}
              aria-label={t("empArch.searchAria")}
              className="h-10 rounded-lg border-line bg-sunken ps-10 pe-10 text-sm font-semibold text-content placeholder:text-content-tertiary focus:border-accent focus:bg-raised"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                aria-label={t("empArch.clearSearch")}
                className="absolute end-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-content-tertiary hover:bg-sunken hover:text-content focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="archive-reason-filter" className="sr-only">
              {t("empArch.filterReason")}
            </label>
            <Select
              value={reasonFilter}
              onValueChange={(value) => setReasonFilter(String(value))}
            >
              <SelectTrigger
                id="archive-reason-filter"
                className="h-10 w-full rounded-lg border-line bg-sunken text-xs font-semibold text-content sm:w-44"
              >
                <SelectValue placeholder={t("empArch.filterReason")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY_REASON}>
                  {t("empArch.filterReasonAny")}
                </SelectItem>
                {ARCHIVE_REASON_VALUES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {archiveReasonLabel(value, t)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {filtersActive && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="h-10 rounded-lg px-3 text-xs font-semibold text-content-secondary hover:text-content"
            >
              <X size={14} className="ms-1.5" aria-hidden="true" />
              {t("hr.clearFilters")}
            </Button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span
            className="font-mono text-[11px] tabular-nums text-content-tertiary"
            aria-live="polite"
          >
            {searchPending
              ? t("hr.searchPending")
              : t("hr.showingRange", {
                  from: rangeStart,
                  to: rangeEnd,
                  total: resultTotal,
                })}
          </span>
          <Button
            variant="outline"
            size="icon"
            onClick={() => void refetch()}
            disabled={isFetching}
            title={t("hr.refresh")}
            aria-label={t("hr.refresh")}
            className="h-9 w-9 rounded-lg border-line bg-raised text-content-secondary hover:text-content"
          >
            <RefreshCw
              size={15}
              className={cn(isFetching && "animate-spin")}
              aria-hidden="true"
            />
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2" role="status" aria-busy="true">
          {[1, 2, 3, 4].map((row) => (
            <div
              key={row}
              className="h-14 animate-pulse rounded-lg border border-line bg-sunken"
            />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          variant="page"
          icon={Archive}
          title={
            filtersActive
              ? t("empArch.noResults")
              : t("empArch.emptyTitle")
          }
          message={
            filtersActive
              ? t("empArch.noResultsHint")
              : t("empArch.emptyMessage")
          }
          action={
            filtersActive ? (
              <Button
                variant="outline"
                onClick={clearFilters}
                className="rounded-lg font-semibold"
              >
                {t("hr.clearFilters")}
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border border-line bg-raised">
            <div className="hidden overflow-x-auto custom-scrollbar lg:block">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="border-b border-line bg-sunken text-[10px] font-semibold uppercase tracking-[0.12em] text-content-tertiary">
                    <th scope="col" className="px-4 py-2.5 text-start">
                      {t("empArch.colDeparted")}
                    </th>
                    <th scope="col" className="px-4 py-2.5 text-start">
                      {t("hr.employeeName")}
                    </th>
                    <th scope="col" className="px-4 py-2.5 text-start">
                      {t("hr.phoneLabel")}
                    </th>
                    <th scope="col" className="px-4 py-2.5 text-start">
                      {t("empArch.colReason")}
                    </th>
                    <th scope="col" className="px-4 py-2.5 text-start">
                      {t("empArch.colTenure")}
                    </th>
                    <th scope="col" className="px-4 py-2.5 text-center">
                      {t("hr.actions")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-subtle">
                  {rows.map((emp: any) => {
                    const departed = formatEmployeeDate(
                      emp.archivedOn,
                      locale,
                    );
                    const tenure = tenureText(emp.hireDate, emp.archivedOn);
                    const reason = archiveReasonLabel(emp.archiveReason, t);
                    return (
                      <tr
                        key={emp.id}
                        className="transition-colors hover:bg-sunken/60"
                      >
                        <td className="px-4 py-2.5">
                          {departed ? (
                            <span className="font-mono text-xs tabular-nums text-content">
                              {departed}
                            </span>
                          ) : (
                            <span
                              title={t("empArch.undatedTooltip")}
                              className="inline-flex items-center gap-1 rounded-md border border-warning-line bg-warning-bg px-1.5 py-0.5 text-[10px] font-semibold text-warning-content"
                            >
                              <HelpCircle size={11} aria-hidden="true" />
                              {t("empArch.undated")}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2.5">
                            <EmployeePhoto
                              imageUrl={
                                emp.profileImageUrl || emp.profile_image_url
                              }
                              name={emp.fullName}
                              role={jobTitleLabel(emp.jobTitle, t)}
                              size="sm"
                              shape="circle"
                              hintMissing={false}
                            />
                            <div className="min-w-0">
                              <div className="truncate text-sm font-semibold text-content">
                                {emp.fullName}
                              </div>
                              <div className="text-[10px] font-medium text-content-tertiary">
                                {jobTitleLabel(emp.jobTitle, t)}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td
                          className="px-4 py-2.5 font-mono text-xs tabular-nums text-content-secondary"
                          dir="ltr"
                        >
                          {emp.phonePrimary || "—"}
                        </td>
                        <td className="px-4 py-2.5">
                          {reason ? (
                            <span
                              title={reason}
                              className="inline-flex max-w-[220px] truncate rounded-md border border-line bg-sunken px-2 py-0.5 text-[10px] font-semibold text-content-secondary"
                            >
                              {reason}
                            </span>
                          ) : (
                            <span className="text-[10px] font-medium text-content-disabled">
                              {t("empArch.reasonUnrecorded")}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="font-mono text-xs tabular-nums text-content-secondary">
                            {tenure ?? t("empArch.tenureUnknown")}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() =>
                                emp.id != null &&
                                openEmployeeQuickView(emp.id as string | number)
                              }
                              className="h-8 w-8 rounded-lg text-content-tertiary hover:bg-sunken hover:text-accent"
                              title={t("hr.openFile")}
                              aria-label={t("hr.openFile")}
                            >
                              <Eye size={15} />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setConfirmTarget(emp)}
                              className="h-8 rounded-lg border-line px-3 text-[11px] font-semibold text-content-secondary hover:border-accent hover:text-content"
                            >
                              <RotateCcw size={14} className="ms-1.5" />
                              {t("empArch.restoreButton")}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile — the same facts, stacked */}
            <div className="divide-y divide-line-subtle lg:hidden">
              {rows.map((emp: any) => {
                const departed = formatEmployeeDate(emp.archivedOn, locale);
                const tenure = tenureText(emp.hireDate, emp.archivedOn);
                const reason = archiveReasonLabel(emp.archiveReason, t);
                return (
                  <div key={emp.id} className="p-4">
                    <div className="flex items-start gap-3">
                      <EmployeePhoto
                        imageUrl={emp.profileImageUrl || emp.profile_image_url}
                        name={emp.fullName}
                        role={jobTitleLabel(emp.jobTitle, t)}
                        size="sm"
                        shape="circle"
                        hintMissing={false}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-content">
                          {emp.fullName}
                        </div>
                        <div className="text-[10px] font-medium text-content-tertiary">
                          {jobTitleLabel(emp.jobTitle, t)}
                        </div>
                      </div>
                      <div className="text-end">
                        {departed ? (
                          <div className="font-mono text-[11px] tabular-nums text-content">
                            {departed}
                          </div>
                        ) : (
                          <div className="text-[10px] font-semibold text-warning">
                            {t("empArch.undated")}
                          </div>
                        )}
                        {tenure && (
                          <div className="text-[10px] font-medium text-content-tertiary">
                            {tenure}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span
                        title={reason || t("empArch.reasonUnrecorded")}
                        className="min-w-0 truncate text-[10px] font-medium text-content-secondary"
                      >
                        {reason || t("empArch.reasonUnrecorded")}
                      </span>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            emp.id != null &&
                            openEmployeeQuickView(emp.id as string | number)
                          }
                          className="h-8 w-8 rounded-lg text-content-tertiary hover:bg-sunken hover:text-accent"
                          title={t("hr.openFile")}
                          aria-label={t("hr.openFile")}
                        >
                          <Eye size={14} />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setConfirmTarget(emp)}
                          className="h-8 rounded-lg text-[11px] font-semibold"
                        >
                          <RotateCcw size={13} className="ms-1" />
                          {t("empArch.restoreButton")}
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {resultTotal > PAGE_SIZE && (
            <div className="rounded-xl border border-line bg-raised px-2 py-2">
              <Pagination
                paginator={createPaginationState({
                  page,
                  size: PAGE_SIZE,
                  total: resultTotal,
                })}
                onPageChange={setPage}
                showSizeChanger={false}
                locale={locale.startsWith("ar") ? "ar" : "en"}
              />
            </div>
          )}
        </>
      )}

      {/* Why the rows are still here at all. The archive is the record of who
          worked in this salon; removing a person from it would take their
          invoices, payroll and attendance history with them. */}
      <div className="flex items-start gap-2 rounded-xl border border-line bg-sunken px-4 py-3 text-[11px] font-medium leading-relaxed text-content-tertiary">
        <CalendarClock size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
        <p>{t("empArch.archiveNeverDeletes")}</p>
      </div>
    </div>
  );
}
