import { SCAN_RETRY_WINDOW_MS as TOKEN_RETRY_WINDOW_MS } from "@/app/lib/qr-window";

/** Matches the QR lifetime. Past it the token has expired, so the person scans the screen again. */
export const SCAN_RETRY_WINDOW_MS = TOKEN_RETRY_WINDOW_MS;
export const SCAN_RETRY_EVERY_MS = 5_000;

/** The request never got an answer (fetch throws TypeError offline); a server-side failure is not retried. */
export function isNetworkError(error: unknown) {
  return error instanceof TypeError || (typeof navigator !== "undefined" && navigator.onLine === false);
}

/** Resolves when the connection comes back or after `ms`, whichever is first. */
export function waitForOnline(ms = SCAN_RETRY_EVERY_MS) {
  return new Promise<void>((resolve) => {
    const done = () => {
      window.clearTimeout(timer);
      window.removeEventListener("online", done);
      resolve();
    };
    const timer = window.setTimeout(done, ms);
    window.addEventListener("online", done);
  });
}

/**
 * Sends until the server answers. Only network failures are retried, and only for `windowMs`;
 * the redemption is idempotent server-side, so a retry after a lost response cannot grant twice.
 */
export async function retryWhileOffline<T>(
  send: () => Promise<T>,
  {
    wait,
    onRetry,
    signal,
    windowMs = SCAN_RETRY_WINDOW_MS,
    now = Date.now,
    isRetryable = isNetworkError,
  }: {
    wait: () => Promise<void>;
    onRetry?: () => void;
    signal?: AbortSignal;
    windowMs?: number;
    now?: () => number;
    isRetryable?: (error: unknown) => boolean;
  },
): Promise<{ ok: true; value: T } | { ok: false }> {
  const giveUpAt = now() + windowMs;

  for (;;) {
    try {
      return { ok: true, value: await send() };
    } catch (error) {
      if (!isRetryable(error)) throw error;
      if (signal?.aborted || now() >= giveUpAt) return { ok: false };
      onRetry?.();
      await wait();
      if (signal?.aborted) return { ok: false };
    }
  }
}
