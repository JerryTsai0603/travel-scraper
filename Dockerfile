# syntax=docker/dockerfile:1.6
# 多階段：builder 安裝依賴；runtime 只帶必要檔案
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
ENV AUTO_PORT=false
ENV PRICES_SCHEDULER=true

# 必要的程式碼（不要把 data/、web/public/thumbs/ 帶進 image）
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src
COPY web ./web
COPY scripts ./scripts
COPY data ./data
# 雲端不應寫入 image 裡的 data/；持久化請用 volume（見下方）
VOLUME ["/app/data"]
VOLUME ["/app/web/public/thumbs"]

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -q -O- http://127.0.0.1:3000/prices >/dev/null || exit 1

CMD ["node", "web/server.js"]