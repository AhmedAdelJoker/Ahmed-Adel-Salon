import { useNavigate } from "react-router-dom";
import { Archive, CalendarOff, CheckCircle2, Scissors, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import HrStatStrip, { type HrStatCell } from "@/features/hr/components/HrStatStrip";
import type { HrStats } from "@/features/hr/types";

/**
 * The roster's one readout.
 *
 * The numbers are account states, not attendance: `active` means the login can
 * work today, and `suspended` means the person is on leave but still on the
 * team. The labels say exactly that, because "نشطون اليوم" on a page with no
 * clock-in data was a sentence the owner could only misread.
 *
 * Archived people are not a number to read but a page to open, so their cell is
 * the only button in the strip.
 */
export default function HrStatsGrid({
  stats,
  loading = false,
}: {
  stats: HrStats;
  loading?: boolean;
}) {
  const { t } = useTranslation("owner");
  const navigate = useNavigate();

  // "On the team" = everyone except leavers. People on leave stay in it.
  const teamSize = Math.max(stats.total - stats.resigned, 0);

  const cells: HrStatCell[] = [
    {
      key: "team",
      label: t("hr.statOnTeam"),
      value: teamSize,
      icon: Users,
      hint: t("hr.statOnTeamHint"),
      tone: "default",
    },
    {
      key: "active",
      label: t("hr.activeNow"),
      value: stats.active,
      icon: CheckCircle2,
      hint: t("hr.statActiveHint"),
      tone: "success",
    },
    {
      key: "suspended",
      label: t("hr.statusSuspended"),
      value: stats.suspended,
      icon: CalendarOff,
      hint: t("hr.statSuspendedHint"),
      tone: "warning",
    },
    {
      key: "experts",
      label: t("hr.barberExperts"),
      value: stats.barbers,
      icon: Scissors,
      hint: t("hr.statExpertsHint"),
      tone: "default",
    },
    {
      key: "archive",
      label: t("hr.statArchive"),
      value: stats.resigned,
      icon: Archive,
      hint: t("hr.statArchiveHint"),
      tone: "default",
      onClick: () => navigate("/manager/hr/archive"),
      actionLabel: t("hr.open"),
    },
  ];

  return <HrStatStrip cells={cells} loading={loading} />;
}
