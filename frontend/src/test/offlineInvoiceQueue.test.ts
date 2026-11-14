/**
 * Money-safety contract for the offline invoice queue.
 *
 * Every scenario here maps to a real salon failure: LAN down mid-sale, a
 * response lost after the server committed (timeout), the service worker's
 * offline 503 body, a validation rejection that replay can never fix, and the
 * cross-tab replay lock.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/services/api", () => ({
  default: { post: vi.fn() },
}));

import api from "@/services/api";
import {
  discardOfflineInvoice,
  enqueueOfflineInvoice,
  isRecoverableNetworkError,
  loadOfflineQueue,
  pendingOfflineInvoiceCount,
  replayOfflineQueue,
} from "@/lib/offline/invoiceQueue";

const postMock = vi.mocked(api.post);

/**
 * The global test setup replaces localStorage with no-op spies; the queue
 * needs real persistence semantics, so swap in an in-memory Storage for this
 * file only (localStorage in jsdom is non-writable-by-assignment, hence the
 * silent arithmetic-free Map wrapper).
 */
const memory = new Map<string, string>();
const memoryStorage: Storage = {
  get length() {
    return memory.size;
  },
  key: (index: number) => Array.from(memory.keys())[index] ?? null,
  getItem: (name: string) => (memory.has(name) ? (memory.get(name) as string) : null),
  setItem: (name: string, value: string) => {
    memory.set(name, String(value));
  },
  removeItem: (name: string) => {
    memory.delete(name);
  },
  clear: () => {
    memory.clear();
  },
};
vi.stubGlobal("localStorage", memoryStorage);
(window as unknown as { localStorage: Storage }).localStorage = memoryStorage;

const KEYS = {
  store: "pos.offlineInvoiceQueue.v1",
  lock: "pos.offlineInvoiceQueue.replayLock",
};

function clearStorages() {
  window.localStorage.clear();
  postMock.mockReset();
}

const PAYLOAD = {
  customer_id: null,
  payment_method: "cash",
  items: [{ item_type: "service", service_id: 1, unit_price: 100 }],
};

describe("isRecoverableNetworkError", () => {
  it("requires a response unless the browser itself is offline", () => {
    expect(isRecoverableNetworkError(undefined)).toBe(false);

    const noResponse = Object.assign(new Error("Network Error"), { response: undefined });
    expect(isRecoverableNetworkError(noResponse)).toBe(true);
  });

  it("treats the service worker's offline signature as queueable", () => {
    const offline = Object.assign(new Error("Request failed"), {
      response: { status: 503, data: { detail: "Offline" } },
    });
    expect(isRecoverableNetworkError(offline)).toBe(true);
  });

  it("keeps real server decisions out of the queue", () => {
    const validation = Object.assign(new Error("Request failed"), {
      response: { status: 400, data: { detail: "حدد خبير لكل بند" } },
    });
    const forbidden = Object.assign(new Error("Request failed"), {
      response: { status: 403, data: { detail: "يتطلب اعتماد مدير" } },
    });
    const maintenance = Object.assign(new Error("Request failed"), {
      response: { status: 503, data: { detail: "مهمة صيانة" } },
    });
    expect(isRecoverableNetworkError(validation)).toBe(false);
    expect(isRecoverableNetworkError(forbidden)).toBe(false);
    expect(isRecoverableNetworkError(maintenance)).toBe(false);
  });

  it("queues transient 5xx", () => {
    const boom = Object.assign(new Error("Request failed"), {
      response: { status: 502, data: { detail: "Bad Gateway" } },
    });
    expect(isRecoverableNetworkError(boom)).toBe(true);
  });
});

describe("enqueueOfflineInvoice", () => {
  beforeEach(clearStorages);

  it("stores the payload with the idempotency key it will retry under", () => {
    const entry = enqueueOfflineInvoice(PAYLOAD, "key-1");

    expect(entry?.id).toBe("key-1");
    expect(loadOfflineQueue()).toHaveLength(1);
    expect(loadOfflineQueue()[0].payload).toEqual(PAYLOAD);
    expect(loadOfflineQueue()[0].createdAt).toBeTruthy();
  });

  it("never duplicates the same idempotency key", () => {
    enqueueOfflineInvoice(PAYLOAD, "key-1");
    const again = enqueueOfflineInvoice(PAYLOAD, "key-1");

    expect(again?.id).toBe("key-1");
    expect(loadOfflineQueue()).toHaveLength(1);
  });

  it("refuses empty keys", () => {
    expect(enqueueOfflineInvoice(PAYLOAD, "")).toBeNull();
    expect(pendingOfflineInvoiceCount()).toBe(0);
  });

  it("discard removes exactly one entry", () => {
    enqueueOfflineInvoice(PAYLOAD, "key-a");
    enqueueOfflineInvoice(PAYLOAD, "key-b");
    discardOfflineInvoice("key-a");

    expect(loadOfflineQueue().map((entry) => entry.id)).toEqual(["key-b"]);
  });
});

describe("replayOfflineQueue", () => {
  beforeEach(clearStorages);

  it("sends the queued payload under its captured key and clears it on success", async () => {
    enqueueOfflineInvoice(PAYLOAD, "key-a");

    postMock.mockResolvedValueOnce({ data: { item: { invoice_no: "X-1" } } });
    const result = await replayOfflineQueue();

    expect(result.sent).toBe(1);
    expect(result.stillPending).toBe(0);
    expect(postMock).toHaveBeenCalledWith("/invoices/manual", PAYLOAD, {
      headers: { "Idempotency-Key": "key-a" },
    });
    expect(loadOfflineQueue()).toHaveLength(0);
  });

  it("keeps a rejected invoice with the server's detail instead of deleting money", async () => {
    enqueueOfflineInvoice(PAYLOAD, "key-b");

    postMock.mockRejectedValueOnce(
      Object.assign(new Error("Request failed"), {
        response: { status: 400, data: { detail: "لا يوجد مخزون كافي" } },
      }),
    );
    const result = await replayOfflineQueue();

    expect(result.failed).toBe(1);
    expect(result.stillPending).toBe(1);
    const kept = loadOfflineQueue()[0];
    expect(kept.id).toBe("key-b");
    expect(kept.lastError).toBe("لا يوجد مخزون كافي");
    expect(kept.lastErrorAt).toBeTruthy();
  });

  it("stops and keeps the rest when the network dies mid-replay", async () => {
    enqueueOfflineInvoice(PAYLOAD, "key-first");
    enqueueOfflineInvoice(PAYLOAD, "key-second");

    postMock.mockRejectedValueOnce(new Error("Network Error"));
    const result = await replayOfflineQueue();

    expect(result.wentOffline).toBe(true);
    expect(result.sent).toBe(0);
    expect(postMock).toHaveBeenCalledTimes(1);
    expect(loadOfflineQueue().map((entry) => entry.id)).toEqual(["key-first", "key-second"]);
  });

  it("respects the cross-tab replay lock", async () => {
    window.localStorage.setItem(KEYS.lock, String(Date.now()));
    enqueueOfflineInvoice(PAYLOAD, "key-locked");

    const result = await replayOfflineQueue();

    expect(result.sent).toBe(0);
    expect(result.stillPending).toBe(1);
    expect(postMock).not.toHaveBeenCalled();
    expect(loadOfflineQueue()).toHaveLength(1);
  });
});
