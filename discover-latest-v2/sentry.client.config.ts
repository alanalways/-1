/**
 * Sentry 客戶端初始化
 * 用於追蹤瀏覽器端錯誤
 */

import * as Sentry from "@sentry/nextjs";

Sentry.init({
    // Sentry DSN - 從環境變數取得（可選，本地開發時可不設定）
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN || "",

    // 環境標記
    environment: process.env.NODE_ENV,

    // 錯誤取樣率（1.0 = 100% 捕捉）
    tracesSampleRate: 1.0,

    // 本地開發時的 debug 模式
    debug: process.env.NODE_ENV === "development",

    // 錯誤回放功能（協助重現使用者操作）
    replaysOnErrorSampleRate: 1.0,
    replaysSessionSampleRate: 0.1,

    // 整合設定
    integrations: [
        Sentry.replayIntegration({
            // 遮罩敏感資訊
            maskAllText: false,
            blockAllMedia: false,
        }),
    ],

    // 忽略特定錯誤
    ignoreErrors: [
        // 忽略瀏覽器擴充套件造成的錯誤
        /ResizeObserver loop/,
        /Non-Error promise rejection/,
    ],

    // 在發送前修改錯誤
    beforeSend(event) {
        // 本地開發時，在 console 輸出錯誤
        if (process.env.NODE_ENV === "development") {
            console.error("[Sentry 捕捉到錯誤]", event);
        }
        return event;
    },
});
