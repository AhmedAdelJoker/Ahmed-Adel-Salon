export type AlertPriority = "high" | "medium" | "low";

/**
 * A finding returned by `GET /owner/alerts`.
 *
 * Shared between the alerts page and the dashboard summary so the two cannot
 * drift. They read the same endpoint and render the same shape; a type declared
 * twice is a type that will disagree with itself.
 */
export interface OwnerAlert {
  key: string;
  source: string;
  title: string;
  message: string;
  priority: AlertPriority;
  occurred_at: string | null;
  destination: string;
}

export interface OwnerAlertsPayload {
  alerts: OwnerAlert[];
  counts: {
    total: number;
    high: number;
    medium: number;
    low: number;
  };
  generated_at: string;
}