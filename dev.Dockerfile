FROM node:20

RUN npm install -g pnpm

# fix sharp memory leak
RUN apt-get update && apt-get install -y libjemalloc2

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

ENV LD_PRELOAD=/usr/lib/x86_64-linux-gnu/libjemalloc.so.2

ENV CI=true  


WORKDIR /app

USER node