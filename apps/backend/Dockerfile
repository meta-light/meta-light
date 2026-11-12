FROM oven/bun:1.2.21
WORKDIR /app
COPY package.json ./
RUN bun install --production --ignore-scripts
COPY . .
ENV PORT=3000
EXPOSE 3000
CMD ["bun", "src/main.ts"]
