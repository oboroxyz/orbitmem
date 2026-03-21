FROM oven/bun:1
WORKDIR /app

# Install native module build dependencies
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

# Copy all workspace package.json files for lockfile resolution
COPY package.json bun.lock ./
COPY packages/relay/package.json packages/relay/
COPY packages/sdk/package.json packages/sdk/
COPY packages/contracts/package.json packages/contracts/
COPY packages/cli/package.json packages/cli/
COPY apps/web/package.json apps/web/
COPY examples/memo/package.json examples/memo/

RUN bun install --frozen-lockfile

# Copy source and build
COPY tsconfig.build.json ./
COPY packages/sdk/ packages/sdk/
COPY packages/contracts/abi/ packages/contracts/abi/
COPY packages/contracts/package.json packages/contracts/
COPY packages/contracts/tsconfig.build.json packages/contracts/
COPY packages/relay/ packages/relay/

RUN cd packages/contracts && bun run build:abi

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

CMD ["bun", "run", "packages/relay/src/index.ts"]
