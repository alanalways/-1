/**
 * 全域錯誤處理頁面
 * 捕捉並顯示錯誤，同時回報給 Sentry
 */

"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import { motion } from "framer-motion";

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        // 回報錯誤給 Sentry
        Sentry.captureException(error);
        console.error("[GlobalError] 全域錯誤:", error);
    }, [error]);

    return (
        <html lang="zh-TW">
            <body style={{
                minHeight: "100vh",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "#0a0a0f",
                color: "#f1f5f9",
                fontFamily: "system-ui, sans-serif",
            }}>
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    style={{
                        textAlign: "center",
                        padding: "40px",
                        background: "rgba(20, 20, 30, 0.8)",
                        borderRadius: "16px",
                        border: "1px solid rgba(239, 68, 68, 0.3)",
                        maxWidth: "500px",
                    }}
                >
                    <div style={{ fontSize: "4rem", marginBottom: "16px" }}>😵</div>
                    <h1 style={{ fontSize: "1.5rem", fontWeight: 600, marginBottom: "8px" }}>
                        發生錯誤了
                    </h1>
                    <p style={{ color: "#94a3b8", marginBottom: "24px" }}>
                        應用程式遇到了一個問題，錯誤已自動回報給開發團隊。
                    </p>

                    {/* 錯誤詳情（開發模式） */}
                    {process.env.NODE_ENV === "development" && (
                        <div style={{
                            textAlign: "left",
                            padding: "12px",
                            background: "rgba(0, 0, 0, 0.3)",
                            borderRadius: "8px",
                            marginBottom: "24px",
                            fontSize: "0.875rem",
                            fontFamily: "monospace",
                            overflowX: "auto",
                        }}>
                            <div style={{ color: "#ef4444", marginBottom: "8px" }}>
                                {error.name}: {error.message}
                            </div>
                            {error.digest && (
                                <div style={{ color: "#64748b" }}>
                                    Digest: {error.digest}
                                </div>
                            )}
                        </div>
                    )}

                    <motion.button
                        onClick={reset}
                        style={{
                            padding: "12px 24px",
                            background: "#6366f1",
                            color: "white",
                            border: "none",
                            borderRadius: "8px",
                            cursor: "pointer",
                            fontSize: "1rem",
                            fontWeight: 500,
                        }}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                    >
                        🔄 重新載入
                    </motion.button>
                </motion.div>
            </body>
        </html>
    );
}
