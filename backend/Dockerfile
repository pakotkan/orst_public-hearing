FROM oven/bun:1-debian

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json bun.lock ./
# Runtime dependencies only; the Prisma CLI is one of them because migrations run on start.
RUN bun install --frozen-lockfile --production

COPY prisma ./prisma
RUN bunx prisma generate

COPY tsconfig.json ./
COPY src ./src

ENV NODE_ENV=production \
    PORT=3001 \
    UPLOAD_DIR=/app/uploads
RUN mkdir -p /app/uploads

EXPOSE 3001
CMD ["sh", "-c", "bunx prisma migrate deploy && bun src/index.ts"]
