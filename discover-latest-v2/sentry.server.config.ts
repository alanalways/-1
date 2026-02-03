/**
 * Sentry 伺服器端初始化（Node.js Runtime）
 */

import * as Sentry from "@sentry/nextjs";

Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN || "",
    environment: process.env.NODE_ENV,
    tracesSampleRate: 1.0,
    debug: process.env.NODE_ENV === "development",

    // 在發送前修改錯誤
    beforeSend(event) {
        if (process.env.NODE_ENV === "development") {
            console.error("[Sentry Server 捕捉到錯誤]", event);
        }
        return event;
    },
});
