FROM node:20-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM python:3.12-slim
WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    DATA_DIR=/data/usersync \
    PORT=7860

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY --from=build /app/dist ./dist
COPY backend ./backend
COPY README.md ./README.md

EXPOSE 7860
CMD ["sh", "-c", "uvicorn backend.main:app --host 0.0.0.0 --port ${PORT:-7860}"]
