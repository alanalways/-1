/**
 * 應用程式層級錯誤處理
 */

"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import { motion } from "framer-motion";
import Link from "next/link";

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        // 回報錯誤給 Sentry
        Sentry.captureException(error);
        console.error("[Error] 頁面錯誤:", error);
    }, [error]);

    return (
        <div style={{
            minHeight: "calc(100vh - 64px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
        }}>
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                    textAlign: "center",
                    padding: "40px",
                    background: "var(--bg-card)",
                    borderRadius: "var(--radius-lg)",
                    border: "1px solid var(--border-color)",
                    maxWidth: "500px",
                }}
            >
                <div style={{ fontSize: "3rem", marginBottom: "16px" }}>⚠️</div>
                <h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: "8px" }}>
                    頁面載入失敗
                </h2>
                <p style={{ color: "var(--text-secondary)", marginBottom: "24px" }}>
                    載入此頁面時發生錯誤，請嘗試重新載入或返回首頁。
                </p>

                {/* 開發模式顯示錯誤詳情 */}
                {process.env.NODE_ENV === "development" && (
                    <div style={{
                        textAlign: "left",
                        padding: "12px",
                        background: "var(--bg-tertiary)",
                        borderRadius: "var(--radius-sm)",
                        marginBottom: "24px",
                        fontSize: "0.75rem",
                        fontFamily: "var(--font-mono)",
                        overflowX: "auto",
                        color: "var(--error)",
                    }}>
                        <div>{error.name}: {error.message}</div>
                        {error.stack && (
                            <pre style={{ marginTop: "8px", color: "var(--text-muted)", whiteSpace: "pre-wrap" }}>
                                {error.stack.split("\n").slice(0, 5).join("\n")}
                            </pre>
                        )}
                    </div>
                )}

                <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
                    <motion.button
                        onClick={reset}
                        style={{
                            padding: "10px 20px",
                            background: "var(--primary)",
                            color: "white",
                            border: "none",
                            borderRadius: "var(--radius-md)",
                            cursor: "pointer",
                            fontWeight: 500,
                        }}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                    >
                        重新載入
                    </motion.button>

                    <Link href="/">
                        <motion.button
                            style={{
                                padding: "10px 20px",
                                background: "var(--bg-input)",
                                color: "var(--text-secondary)",
                                border: "1px solid var(--border-color)",
                                borderRadius: "var(--radius-md)",
                                cursor: "pointer",
                                fontWeight: 500,
                            }}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                        >
                            返回首頁
                        </motion.button>
                    </Link>
                </div>
            </motion.div>
        </div>
    );
}
