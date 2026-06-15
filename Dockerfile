FROM node:18-slim AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
COPY updates.txt ./updates.txt

RUN npm run build
RUN npm prune --omit=dev

FROM node:18-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production

COPY --from=build /app/package*.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/updates.txt ./updates.txt

CMD ["node", "dist/index.js"]
