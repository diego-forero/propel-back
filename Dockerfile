FROM node:20-alpine
WORKDIR /app

# deps
COPY package*.json ./
RUN npm ci

# código y config
COPY tsconfig.json ./
COPY drizzle.config.ts ./
COPY src ./src
COPY drizzle ./drizzle

# compilar TS -> dist
RUN npm run build

ENV NODE_ENV=production
ENV PORT=4000
EXPOSE 4000

# aplica migraciones y arranca
CMD ["sh","-c","npm run db:migrate && npm run db:seed && npm start"]