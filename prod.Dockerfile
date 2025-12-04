###### builder image ######
FROM node:20 as builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.1.2 --activate

COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma/

RUN pnpm install

COPY . .

RUN pnpm run build


###### prod dependancy ######
FROM node:20 as prod-dep

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.1.2 --activate

COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma/

RUN pnpm install --production


###### final image ######
FROM node:20-slim
WORKDIR /app

RUN apt update && \
    apt install -y libssl-dev libjemalloc2 && \
    rm -rf /var/cache/apt/archives /var/lib/apt/lists/*

RUN apt-get update && apt-get install -y \
    chromium \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libgdk-pixbuf2.0-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    xdg-utils \
    wget \
    ca-certificates \
    --no-install-recommends

# Set Puppeteer executable path for safety
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# libjemalloc2 fixes sharp memory leak
ENV LD_PRELOAD=/usr/lib/x86_64-linux-gnu/libjemalloc.so.2

COPY --from=builder /app/locales /app/locales
COPY --from=builder /app/dist /app/dist
COPY --from=builder /app/prisma /app/prisma
COPY --from=builder /app/prisma /app/prisma/seeders
COPY --from=prod-dep /app/node_modules /app/node_modules
COPY package.json /app/

RUN npm run prisma:generate

EXPOSE 9797

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
