# Built from the repo root (see wrangler.jsonc build_context) so the
# @meta-light/utils workspace package ships with the backend.
FROM oven/bun:1.2.21
WORKDIR /app
COPY package.json bun.lock ./
COPY apps/web/package.json apps/web/
COPY apps/backend/package.json apps/backend/
COPY packages/utils/package.json packages/utils/
RUN bun install --production --ignore-scripts --filter backend
COPY packages/utils packages/utils
COPY apps/backend apps/backend
WORKDIR /app/apps/backend
ENV PORT=3000
EXPOSE 3000
CMD ["bun", "src/main.ts"]
