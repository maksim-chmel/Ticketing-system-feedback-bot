
FROM node:18-slim

RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    build-essential \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*


WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

RUN npm install -g ts-node typescript


RUN ls -la

CMD ["npx", "ts-node", "src/index.ts"]