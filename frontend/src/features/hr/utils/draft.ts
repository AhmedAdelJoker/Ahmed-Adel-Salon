/**
 * A resumable draft of the employee form.
 *
 * The wizard is seven steps long and holds a name, a phone, a salary, a
 * commission and a login password. Closing the dialog threw all of it away, so
 * the practical effect was that the owner could not open the form "to check
 * something" without risking what they had already typed — and an interrupted
 * payroll setup had to be retyped from memory.
 *
 * Stored in `localStorage` rather than as a `draft` employee row on purpose. A
 * row would need a `draft` status threaded through the roster filter, POS,
 * `/active`, `/archive`, the badge map and the unique-phone check, and it would
 * still only exist in one browser: an owner filling in the form on their phone
 * and approving it on the desktop would find nothing waiting. A draft is a
 * note to self on the device it was typed on, which is what "come back to this
 * later" actually means here.
 *
 * A draft is only offered for a *new* employee. Editing someone who already
 * exists has a real row to fall back on, and a stale local copy silently
 * overwriting a colleague's later correction is a worse failure than retyping.
 */

export const EMPLOYEE_DRAFT_STORAGE_KEY = "employee-form-draft-v1";

export interface EmployeeDraft {
  formData: Record<string, unknown>;
  activeTab: string;
  customJobTitle: boolean;
  savedAt: string;
}

function hasStorage(): boolean {
  try {
    return typeof window !== "undefined" && !!window.localStorage;
  } catch {
    // Blocked by privacy settings. Not worth failing a form over.
    return false;
  }
}

export function readEmployeeDraft(): EmployeeDraft | null {
  if (!hasStorage()) return null;
  try {
    const raw = window.localStorage.getItem(EMPLOYEE_DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const draft = parsed as Partial<EmployeeDraft>;
    // A draft that cannot be restored is worse than no draft: it would show a
    // "resume?" prompt and then open an empty form.
    if (!draft.formData || typeof draft.formData !== "object") return null;
    if (typeof draft.savedAt !== "string") return null;
    return {
      formData: draft.formData as Record<string, unknown>,
      activeTab: typeof draft.activeTab === "string" ? draft.activeTab : "personal",
      customJobTitle: Boolean(draft.customJobTitle),
      savedAt: draft.savedAt,
    };
  } catch {
    // Corrupt or hand-edited value. Treat it as absent rather than throwing
    // during render, which would take the whole HR page down.
    return null;
  }
}

export function writeEmployeeDraft(draft: Omit<EmployeeDraft, "savedAt">): boolean {
  if (!hasStorage()) return false;
  try {
    window.localStorage.setItem(
      EMPLOYEE_DRAFT_STORAGE_KEY,
      JSON.stringify({ ...draft, savedAt: new Date().toISOString() }),
    );
    return true;
  } catch {
    // Quota exceeded, or storage denied. Losing a draft is an inconvenience;
    // throwing here would block the save the owner actually asked for.
    return false;
  }
}

export function clearEmployeeDraft(): void {
  if (!hasStorage()) return;
  try {
    window.localStorage.removeItem(EMPLOYEE_DRAFT_STORAGE_KEY);
  } catch {
    // Nothing to do; a stale draft is better than an exception during submit.
  }
}

/** "منذ 5 دقائق" style label for the resume prompt. */
export function describeDraftAge(savedAt: string): string {
  const then = new Date(savedAt).getTime();
  if (Number.isNaN(then)) return "";

  const minutes = Math.floor((Date.now() - then) / 60_000);
  if (minutes < 1) return "الآن";
  if (minutes < 60) return `منذ ${minutes} دقيقة`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours === 1 ? "منذ ساعة" : hours === 2 ? "منذ ساعتين" : `منذ ${hours} ساعات`;

  const days = Math.floor(hours / 24);
  if (days === 1) return "أمس";
  if (days < 30) return days === 2 ? "منذ يومين" : `منذ ${days} أيام`;

  const months = Math.floor(days / 30);
  if (months === 1) return "منذ شهر";
  return `منذ ${months} أشهر`;
}

/**
 * A draft worth offering.
 *
 * Rejects a draft holding nothing but the shape of an empty form: after any
 * "add employee" that was closed straight away, otherwise every new hire would
 * start with a resume prompt offering nothing.
 */
export function isDraftWorthResuming(draft: EmployeeDraft | null): boolean {
  if (!draft) return false;
  return formIsWorthKeeping(draft.formData, draft.customJobTitle);
}

/** The same test against form state that has not been written yet. */
export function formIsWorthKeeping(
  formData: Record<string, unknown>,
  customJobTitle?: boolean,
): boolean {
  const meaningful = [
    "fullName",
    "phonePrimary",
    "email",
    "nationalId",
    "username",
    "department",
    "walletNumber",
    "bankAccount",
  ];
  if (meaningful.some((key) => String(formData[key] ?? "").trim() !== "")) {
    return true;
  }

  const numeric = ["baseSalary", "commissionRate", "fixedBonus"];
  if (numeric.some((key) => Number(formData[key] || 0) !== 0)) return true;

  if (Array.isArray(formData.serviceIds) && formData.serviceIds.length > 0) {
    return true;
  }
  if (customJobTitle) return true;

  // A different job title from the default means the owner chose something.
  const jobTitle = String(formData.jobTitle ?? "");
  return jobTitle !== "" && jobTitle !== "barber";
}