# UserSync backend — Hugging Face Space (Docker SDK, port 7860).
# Build the frontend, then serve API + static from one FastAPI process.
FROM node:20-slim AS frontend
WORKDIR /build
COPY UserSync/package*.json ./
RUN npm install
COPY UserSync/ .
RUN npm run build

FROM python:3.11-slim
WORKDIR /app
COPY backend/requirements.txt backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt \
 && playwright install --with-deps chromium
COPY backend/ backend/
COPY oasis/generator/ oasis/generator/
COPY --from=frontend /build/dist UserSync/dist

# HF Spaces persistent storage mounts at /data when enabled.
ENV USERSYNC_PACKS=all
EXPOSE 7860
CMD ["uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "7860"]
