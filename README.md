
# FarmSentinal

Precision perimeter monitoring dashboard that blends IoT sensors with real-time vision alerts.

[![Vite](https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/) [![React](https://img.shields.io/badge/React-61DAFB?logo=react&logoColor=0B1F2A)](https://react.dev/) [![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/) [![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/) [![FastAPI](https://img.shields.io/badge/FastAPI-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/) [![Python](https://img.shields.io/badge/Python-3776AB?logo=python&logoColor=white)](https://www.python.org/)

## Highlights

- Live camera feed with detection overlays and alerts.
- Sensor telemetry panels for perimeter status and activity.
- FastAPI backend for MJPEG streaming and detection APIs.

## Stack (Logos)

![Vite](https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white)
![React](https://img.shields.io/badge/React-61DAFB?logo=react&logoColor=0B1F2A)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-06B6D4?logo=tailwindcss&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?logo=fastapi&logoColor=white)
![Python](https://img.shields.io/badge/Python-3776AB?logo=python&logoColor=white)

## Quick start

Frontend (Vite):

```bash
cd frontend
npm ci
npm run dev
```

Backend (FastAPI + uv):

```bash
uv sync --project backend
uv run --project backend uvicorn app.main:app --reload
```

Windows launcher:

```bat
start.bat
```

## API surface

Camera:

- `GET /video_feed` annotated MJPEG stream
- `GET /detections` latest detections
- `PUT /source` select `webcam` or `esp32_cam`
- `POST /source/toggle` switch active source

ESP:

- `GET /data` sensor data
- `GET /reset` sensor reset
- `GET /animal` camera detection

## App routes

- `/dashboard`
- `/camera`
- `/settings`

## Project structure

```
backend/    FastAPI service and model assets
frontend/   Vite React app
start.bat   Local Windows launcher
```
  