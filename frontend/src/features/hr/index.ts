/**
 * HR feature barrel.
 */
export {
  JOB_TITLES,
  JOB_TITLE_BLUEPRINTS,
  EMPLOYMENT_TYPES,
  ROLES,
  ASSISTANT_TASKS,
  FORM_TABS,
  defaultForm,
  FIELD_LABEL_CLASS,
  FIELD_INPUT_CLASS,
  FIELD_TEXTAREA_CLASS,
  FIELD_SELECT_CLASS,
} from "@/features/hr/utils/constants";
export {
  getJobTitleLabel,
  isCustomJobTitleValue,
  deriveDateOnly,
  normalizeEmployeeRecord,
} from "@/features/hr/utils/helpers";
export type { HrStats, HrViewMode } from "@/features/hr/types";
export { useHrData } from "@/features/hr/hooks/useHrData";
export { useEmployeeForm } from "@/features/hr/hooks/useEmployeeForm";
export { useEmployeeDocuments } from "@/features/hr/hooks/useEmployeeDocuments";
