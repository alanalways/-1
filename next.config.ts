import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 圖片優化設定
  images: {
    unoptimized: true, // Hugging Face Spaces 不支援 Next.js 圖片優化
  },

  // 環境變數
  env: {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  },
};

export default nextConfig;
