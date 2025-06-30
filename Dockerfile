FROM oven/bun:1 AS base
WORKDIR /app
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile
COPY . .
RUN mkdir -p private
EXPOSE 3000
ENV NODE_ENV=production
ENV SQLITE_FILE_LOCATION=/app/db/server.db
ENV PORT=3000
CMD ["bun", "run", "src/index.ts"]
