import { useEffect, useState, useRef, useCallback } from "react";
import { baseURL } from "../services/api";

/**
 * useRealtimeBooking — Subscribe to real-time booking updates.
 *
 * Uses Server-Sent Events (SSE) by default — works on Cloudflare Workers
 * and most modern hosts. Falls back to polling if SSE fails.
 * If both fail (404 / network error), the hook stops trying after a
 * small retry budget so the console stays clean in dev / when the
 * backend route isn't implemented yet.
 *
 * In dev mode, the subscription is disabled by default (it just
 * returns `status: "dev-disabled"`) so the console isn't spammed
 * with 404s when the backend isn't running. To force-enable in dev,
 * set VITE_ENABLE_REALTIME=true in your .env.local.
 *
 * Events:
 * - "booking.created"  → { bookingId, status: "pending" }
 * - "booking.confirmed" → { bookingId, status: "confirmed", scheduledAt }
 * - "booking.cancelled" → { bookingId, status: "cancelled", reason }
 * - "slot.taken"        → { slot, message }
 */

const POLL_INTERVAL_MS = 5000;
const MAX_RETRY_ATTEMPTS = 1; // Just one attempt — fail fast

// Allow forcing realtime in dev for testing the backend route
const REALTIME_ENABLED =
  import.meta.env.PROD || import.meta.env.VITE_ENABLE_REALTIME === "true";

export interface RealtimeEvent {
  type?: string;
  timestamp?: number;
  [key: string]: unknown;
}

export function useRealtimeBooking({
  salonSlug,
  onEvent,
}: {
  salonSlug?: string;
  onEvent?: (event: RealtimeEvent) => void;
} = {}) {
  const [status, setStatus] = useState(
    REALTIME_ENABLED ? "idle" : "dev-disabled",
  );
  const [lastEvent, setLastEvent] = useState<RealtimeEvent | null>(null);
  const stoppedRef = useRef(false);

  const emit = useCallback(
    (event: RealtimeEvent) => {
      setLastEvent({ ...event, timestamp: Date.now() });
      if (onEvent) onEvent(event);
    },
    [onEvent],
  );

  useEffect(() => {
    if (!REALTIME_ENABLED) return; // Don't even try in dev
    if (!salonSlug || typeof window === "undefined") return;
    if (stoppedRef.current) return;

    stoppedRef.current = false;
    let eventSource: EventSource | null = null;
    let pollInterval: ReturnType<typeof setInterval> | null = null;
    let retryCount = 0;

    const stop = (reason: string) => {
      stoppedRef.current = true;
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }
      if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
      }
      setStatus(reason);
    };

    const startPolling = () => {
      setStatus("polling");
      const poll = async () => {
        if (stoppedRef.current) return;
        if (retryCount >= MAX_RETRY_ATTEMPTS) {
          stop("unavailable");
          return;
        }
        try {
          const res = await fetch(
            `${baseURL}/public/realtime/booking/${encodeURIComponent(salonSlug)}/poll`,
          );
          if (!res.ok) {
            // 404 or 5xx — give up silently
            retryCount += 1;
            if (retryCount >= MAX_RETRY_ATTEMPTS) {
              stop("unavailable");
            }
            return;
          }
          retryCount = 0;
          const data = await res.json();
          if (data?.event) {
            emit(data.event);
          }
        } catch {
          retryCount += 1;
          if (retryCount >= MAX_RETRY_ATTEMPTS) {
            stop("unavailable");
          }
        }
      };
      pollInterval = setInterval(poll, POLL_INTERVAL_MS);
    };

    setStatus("connecting");
    const url = `${baseURL}/public/realtime/booking/${encodeURIComponent(salonSlug)}`;

    if (typeof EventSource !== "undefined") {
      try {
        eventSource = new EventSource(url);
        const source: EventSource = eventSource;

        source.addEventListener("open", () => {
          retryCount = 0;
          setStatus("open");
        });

        source.addEventListener("error", () => {
          // SSE not supported or endpoint missing — try one poll
          if (eventSource) {
            eventSource.close();
            eventSource = null;
          }
          startPolling();
        });

        ["booking.created", "booking.confirmed", "booking.cancelled", "slot.taken"].forEach(
          (eventName) => {
            source.addEventListener(eventName, (e) => {
              try {
                const data = JSON.parse(e.data);
                emit({ type: eventName, data });
              } catch {
                // ignore parse errors
              }
            });
          },
        );
      } catch {
        startPolling();
      }
    } else {
      startPolling();
    }

    return () => stop("idle");
  }, [salonSlug, emit]);

  return { status, lastEvent };
}

export default useRealtimeBooking;
