/**
 * HR domain types.
 */
export type HrStats = {
  total: number;
  active: number;
  suspended: number;
  /** People who left. The team list hides them; the archive page is them. */
  resigned: number;
  barbers: number;
  assistants: number;
};

/**
 * The board's one filter. `all` is "everyone still on the roster", which is
 * not the same as "no filter": leavers are never part of the team list.
 */
export type HrStatusFilter = "all" | "active" | "suspended";

export type HrViewMode = "cards" | "table";

/** The two things the archive dialog asks, before it writes a departure. */
export type ArchiveForm = {
  reason: string;
  /** Last working day, `YYYY-MM-DD`. Empty means "as of now". */
  effectiveDate: string;
};

/**
 * What archiving this person would touch, read before the owner decides.
 * Mirrors `GET /employees/{id}/archive-impact`.
 */
export type EmployeeArchiveImpact = {
  id: number;
  fullName: string;
  status: string;
  futureAppointments: number;
  hasLoginAccount: boolean;
  linkedUserRole: string | null;
  showInPos: boolean;
  showInBooking: boolean;
};
