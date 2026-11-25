export const QR_WINDOW_SECONDS = 30;

// One frame back covers a scan that crosses a rotation. A forwarded screenshot dies with that frame.
export const QR_GRACE_WINDOWS = 1;

export const QR_FUTURE_WINDOWS = 1;

/** How long a request that never reached the server can be retried. Matches the token, so it cannot outlive a screenshot. */
export const SCAN_RETRY_WINDOW_MS = (QR_GRACE_WINDOWS + 1) * QR_WINDOW_SECONDS * 1000;
