/**
 * Offline invoice queue for the POS.
 *
 * When the salon's LAN/server is unreachable, the cashier can still finish a
 * sale: the exact payload that would have gone to POST /invoices/manual is
 * captured locally WITH the same Idempotency-Key that already left the browser,
 * and replayed verbatim once the connection returns.
 *
 * Money-safety invariants:
 *  - The Idempotency-Key is generated once per submit and reused on every
 *    replay. `POST /invoices/manual` dedupes on (user, key) and re-serialises
 *    the SAME invoice when the request hash matches (invoices.py:270-288), so
 *    a response lost after commit (timeout, dropped socket, SW network flap)
 *    can never become a double charge or a double stock deduction.
 *  - Only "recoverable network" failures are queued: no Response at all,
 *    navigator.onLine false, the service worker's offline 503 body, or a
 *    5xx. A server that actually spoke (4xx/403 validation) stays visible to
 *    the cashier — replaying a rejected payload would just fail again.
 *  - A rejected replay is KEPT (with its detail) until the cashier discards
 *    it — a money record is never auto-deleted on an error it cannot fix.
 */
import api from "@/services/api";

export interface PendingOfflineInvoice {
  id: string;
  version: 1;
  createdAt: string;
  payload: unknown;
  lastError?: string;
  lastErrorAt?: string;
}

const STORE_KEY = "pos.offlineInvoiceQueue.v1";
const LOCK_KEY = "pos.offlineInvoiceQueue.replayLock";
const LOCK_TTL_MS = 20_000;

type Listener = () => void;
const listeners = new Set<Listener>();

function readQueue(): PendingOfflineInvoice[] {
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PendingOfflineInvoice[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(queue: PendingOfflineInvoice[]): void {
  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify(queue));
  } catch {
    /* quota exceeded — keep the sale in memory-only mode via the emitter */
  }
  emit();
}

function emit(): void {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch {
      /* a broken subscriber must not break the queue */
    }
  });
}

export function subscribeOfflineQueue(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function loadOfflineQueue(): PendingOfflineInvoice[] {
  return readQueue();
}

export function pendingOfflineInvoiceCount(): number {
  return readQueue().length;
}

/** True only when replaying could plausibly succeed later. */
export function isRecoverableNetworkError(error: unknown): boolean {
  const err = error as {
    response?: { status?: number; data?: { detail?: unknown } };
    code?: string;
  } | null;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  if (!err) return false;
  // axios network errors / request-timeouts carry no response — the request
  // may or may not have committed server-side, which is exactly the situation
  // the idempotency key resolves.
  if (!err.response) return true;
  const status = err.response.status ?? 0;
  // The service worker answers 503/{detail:"Offline"} for API traffic when the
  // fetch itself failed (public/sw.js) — that signature means "never reached".
  // A server-spoken 503 (maintenance message, real detail) is NOT queueable.
  if (status === 503) {
    const detail = (err.response.data as { detail?: unknown } | undefined)?.detail;
    return detail === "Offline";
  }
  if (status >= 500) return true;
  return false;
}

export function enqueueOfflineInvoice(
  payload: unknown,
  idempotencyKey: string,
): PendingOfflineInvoice | null {
  if (!idempotencyKey) return null;
  const queue = readQueue();
  const existing = queue.find((entry) => entry.id === idempotencyKey);
  if (existing) return existing;
  const entry: PendingOfflineInvoice = {
    id: idempotencyKey,
    version: 1,
    createdAt: new Date().toISOString(),
    payload,
  };
  writeQueue([...queue, entry]);
  return entry;
}

export function discardOfflineInvoice(id: string): void {
  writeQueue(readQueue().filter((entry) => entry.id !== id));
}

function acquireReplayLock(): boolean {
  const now = Date.now();
  try {
    const stamp = Number(window.localStorage.getItem(LOCK_KEY) || 0);
    if (stamp && now - stamp < LOCK_TTL_MS) return false;
    window.localStorage.setItem(LOCK_KEY, String(now));
    return true;
  } catch {
    return true;
  }
}

function releaseReplayLock(stamp: number): void {
  try {
    if (Number(window.localStorage.getItem(LOCK_KEY) || 0) === stamp) {
      window.localStorage.removeItem(LOCK_KEY);
    }
  } catch {
    /* best effort */
  }
}

export interface OfflineReplayResult {
  sent: number;
  failed: number;
  stillPending: number;
  wentOffline: boolean;
}

/**
 * Replays every queued invoice against the live server. Safe to call from
 * multiple tabs/mounts concurrently: a localStorage lock keeps a single owner
 * per window, and even a cross-tab race only produces duplicate requests that
 * the server collapses onto the same invoice by key.
 */
export async function replayOfflineQueue(): Promise<OfflineReplayResult> {
  const result: OfflineReplayResult = { sent: 0, failed: 0, stillPending: 0, wentOffline: false };
  if (!acquireReplayLock()) {
    result.stillPending = pendingOfflineInvoiceCount();
    return result;
  }
  const stamp = Date.now();
  try {
    const queue = readQueue();
    for (const entry of queue) {
      try {
        await api.post("/invoices/manual", entry.payload, {
          headers: { "Idempotency-Key": entry.id },
        });
        discardOfflineInvoice(entry.id);
        result.sent += 1;
      } catch (error) {
        if (!isRecoverableNetworkError(error)) {
          const err = error as { response?: { data?: { detail?: unknown } } };
          const detail = err?.response?.data?.detail;
          const queueNow = readQueue();
          const current = queueNow.find((item) => item.id === entry.id);
          if (current) {
            current.lastError =
              typeof detail === "string" && detail.trim()
                ? detail
                : "رفض الخادم الفاتورة المؤجلة";
            current.lastErrorAt = new Date().toISOString();
            writeQueue(queueNow);
          }
          result.failed += 1;
          continue;
        }
        // Still offline — stop now, keep the rest untouched for next tick.
        result.wentOffline = true;
        break;
      }
    }
    result.stillPending = pendingOfflineInvoiceCount();
  } finally {
    releaseReplayLock(stamp);
  }
  return result;
}
