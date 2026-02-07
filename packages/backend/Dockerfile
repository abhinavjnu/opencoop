FROM node:20-alpine

WORKDIR /app

COPY package.json ./
COPY packages/backend/package.json ./packages/backend/
COPY packages/shared/package.json ./packages/shared/

RUN npm install --workspace=packages/backend --workspace=packages/shared

COPY packages/shared ./packages/shared
COPY packages/backend ./packages/backend

WORKDIR /app/packages/backend

RUN cp .env.example .env 2>/dev/null || true

EXPOSE 3000

CMD ["npx", "tsx", "src/server.ts"]
