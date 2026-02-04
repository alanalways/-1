# ==========================================
# Dockerfile for Hugging Face Spaces
# Next.js 16 + Node.js 20 (標準建置模式)
# ==========================================

# 階段 1: 依賴安裝
FROM node:20-alpine AS deps
WORKDIR /app

# 安裝依賴所需的套件
RUN apk add --no-cache libc6-compat

# 複製 package 檔案
COPY package.json package-lock.json ./

# 安裝依賴
RUN npm ci --legacy-peer-deps

# ==========================================
# 階段 2: 建置
FROM node:20-alpine AS builder
WORKDIR /app

# 複製依賴
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# 設定環境變數（建置時）
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# 接收 Hugging Face Secrets 作為建構參數
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_APP_URL

# 將 ARG 轉換為 ENV（Next.js 建構時需要）
# 注意：Supabase anon key 是公開的，可安全硬編碼
ENV NEXT_PUBLIC_SUPABASE_URL=https://xxsntufxfcvrqvweimyg.supabase.co
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh4c250dWZ4ZmN2cnF2d2VpbXlnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAxNDIzMjYsImV4cCI6MjA4NTcxODMyNn0.EHE6-DSKM9iPrvttLC_GAxYRDSwYJ6mFDvESUamUZ4Q
ENV NEXT_PUBLIC_APP_URL=https://alanalways-discover-latest.hf.space

# 建置應用程式（標準模式，非 standalone）
RUN npm run build

# ==========================================
# 階段 3: 運行
FROM node:20-alpine AS runner
WORKDIR /app

# 設定環境變數
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=7860
ENV HOSTNAME="0.0.0.0"

# 建立 nextjs 使用者（非 root）
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# 複製必要檔案
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# 設定正確的權限
RUN chown -R nextjs:nodejs .next

# 切換到非 root 使用者
USER nextjs

# 暴露端口（Hugging Face Spaces 使用 7860）
EXPOSE 7860

# 啟動應用程式
CMD ["npm", "start"]
