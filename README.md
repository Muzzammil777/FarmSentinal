
# FarmSentinal Dashboard

Production-ready IoT dashboard for ESP8266 perimeter monitoring and camera detection.

## Running the project

The frontend app now lives in `frontend/`.

Install the frontend dependencies:

```bash
cd frontend
npm ci
```

Start the development server:

```bash
cd frontend
npm run dev
```

## Camera backend

Run the FastAPI service from the `backend` folder with `uv`:

```bash
uv sync --project backend
uv run --project backend uvicorn app.main:app --reload
```

Or run the root launcher on Windows:

```bat
start.bat
```

Camera endpoints:

- `GET /video_feed` for the annotated MJPEG stream
- `GET /detections` for the latest animal detections
- `PUT /source` to select `webcam` or `esp32_cam`
- `POST /source/toggle` to switch the active source

## Routes

- `/dashboard`
- `/camera`
- `/settings`

## ESP endpoints

- Sensor data: `GET /data`
- Sensor reset: `GET /reset`
- Camera detection: `GET /animal`
  