FROM node:20-alpine

WORKDIR /app

COPY backend/package.json backend/package-lock.json ./backend/
COPY frontend/package.json frontend/package-lock.json ./frontend/

RUN npm ci --prefix backend && npm ci --prefix frontend

COPY backend ./backend
COPY frontend ./frontend
COPY docker-entrypoint.sh ./

RUN chmod +x docker-entrypoint.sh

EXPOSE 3001 8080

CMD ["./docker-entrypoint.sh"]
