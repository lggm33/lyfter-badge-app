import { describe, expect, it } from "vitest";
import { retryWhileOffline, SCAN_RETRY_EVERY_MS, SCAN_RETRY_WINDOW_MS } from "@/app/scan/retry";

/** Each wait advances a fake clock by one retry interval. */
function fakeClock() {
  let time = 0;
  return { now: () => time, wait: async () => void (time += SCAN_RETRY_EVERY_MS) };
}

const offline = () => Promise.reject(new TypeError("Failed to fetch"));

describe("retryWhileOffline", () => {
  it("keeps retrying network failures and returns the first answer", async () => {
    const clock = fakeClock();
    let calls = 0;
    let retries = 0;
    const outcome = await retryWhileOffline(
      () => (++calls < 3 ? offline() : Promise.resolve("granted")),
      { ...clock, onRetry: () => retries++ },
    );

    expect(outcome).toEqual({ ok: true, value: "granted" });
    expect(retries).toBe(2);
  });

  it("gives up after the retry window so the person scans again", async () => {
    const clock = fakeClock();
    let calls = 0;
    const outcome = await retryWhileOffline(() => (calls++, offline()), clock);

    expect(outcome).toEqual({ ok: false });
    expect(clock.now()).toBeGreaterThanOrEqual(SCAN_RETRY_WINDOW_MS);
    expect(calls).toBe(SCAN_RETRY_WINDOW_MS / SCAN_RETRY_EVERY_MS + 1);
  });

  it("does not retry a server-side failure", async () => {
    let calls = 0;
    await expect(
      retryWhileOffline(() => (calls++, Promise.reject(new Error("boom"))), fakeClock()),
    ).rejects.toThrow("boom");
    expect(calls).toBe(1);
  });

  it("stops when the page goes away", async () => {
    const controller = new AbortController();
    const clock = fakeClock();
    const outcome = await retryWhileOffline(offline, {
      ...clock,
      signal: controller.signal,
      onRetry: () => controller.abort(),
    });

    expect(outcome).toEqual({ ok: false });
    expect(clock.now()).toBe(SCAN_RETRY_EVERY_MS);
  });
});
