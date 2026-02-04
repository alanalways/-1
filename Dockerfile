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

# 接收建置時的環境變數（Hugging Face 會透過 --build-arg 傳入）
# 這些變數會在 npm run build 時被 Next.js 編譯進前端代碼
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}

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
