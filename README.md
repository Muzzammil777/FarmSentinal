<div align="center">

# 🌱 FarmSentinal — Smart Animal Intrusion Monitoring System
### *Niral Thiruvizha Edition*

[![Python](https://img.shields.io/badge/Python-3.10%2B-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-005571?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com/)
[![React 19](https://img.shields.io/badge/React_19-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![YOLOv8](https://img.shields.io/badge/YOLOv8-Ultralytics-00FFFF?style=for-the-badge&logo=YOLO&logoColor=black)](https://ultralytics.com)
[![OpenCV](https://img.shields.io/badge/OpenCV-5C3EE8?style=for-the-badge&logo=opencv&logoColor=white)](https://opencv.org/)
[![ESP32](https://img.shields.io/badge/ESP32--CAM-Hardware-E7352C?style=for-the-badge&logo=espressif&logoColor=white)](https://espressif.com)
[![ESP8266](https://img.shields.io/badge/ESP8266-Sensor-000000?style=for-the-badge&logo=espressif&logoColor=white)](https://espressif.com)

**Real-time AI-powered wildlife & livestock intrusion monitoring system for modern farms and agricultural perimeters.**

</div>

---

## 📌 Overview

**FarmSentinal** is an end-to-end, production-quality IoT and AI monitoring dashboard designed to protect farmlands and forest perimeters from wild animal intrusions. It continuously integrates **ESP8266 Ultrasonic proximity distance sensors** and **XIAO ESP32S3 Camera streams** with a real-time **Ultralytics YOLOv8 Nano** computer vision engine via a high-performance **FastAPI bridge server**.

### 🌟 Key Highlights
- 🤖 **YOLOv8 Nano AI Engine**: Continuous CPU-optimized detection strictly filtering allowed animal species (`cow`, `dog`, `cat`, `horse`, `sheep`, `elephant`, `bear`, `zebra`, `giraffe`, `bird`).
- 📡 **Sensors & Deterrent Bridge**: Asynchronously polls ESP8266 distance telemetry (`/data` & `/status`) every 500ms and triggers ESP32-CAM active deterrents (`/flash_on`, `/buzzer_on`).
- ⚡ **Strict Architecture Control**: Frontend *never* directly talks to ESP hardware—FastAPI acts as the secure middle bridge.
- 🌿 **Bright Forest & Farm UI**: Modern Tailwind CSS & Lucide icons glassmorphism theme designed for clear visibility and rapid telemetry monitoring.
- 🚀 **Universal One-Click Launcher (`start.bat`)**: Automatically sets up virtual environments, installs dependencies, launches backend/frontend services in parallel, and opens the browser.

---

## 🌐 Render Deployment Guide (Fix "Not Found" Error)

If you see a `Not Found` error on Render, it is because Render is searching for files in the root folder `./dist` instead of `./frontend/dist`.

### Fix Option 1: Render Static Site Settings (Recommended)
On your Render Dashboard for your Static Site, go to **Settings** and configure:

| Setting Name | Correct Value |
| :--- | :--- |
| **Root Directory** | `frontend` |
| **Build Command** | `npm install && npm run build` |
| **Publish Directory** | `dist` *(or `frontend/dist` if Root Directory is left blank)* |

#### Add Single Page Application (SPA) Rewrite Rule:
Go to **Redirects/Rewrites** tab in Render and add:
- **Type**: `Rewrite`
- **Source**: `/*`
- **Destination**: `/index.html`

---

### Fix Option 2: Deploy Backend & Frontend Together (FastAPI Web Service)
If deploying a Render **Web Service**:
| Setting Name | Correct Value |
| :--- | :--- |
| **Root Directory** | `backend` |
| **Build Command** | `pip install -r requirements.txt` |
| **Start Command** | `uvicorn app.main:app --host 0.0.0.0 --port $PORT` |

---

## 🛠️ Technology Stack & Badges

### **Backend Bridge & AI Engine**
| Technology | Description | Badge |
| :--- | :--- | :--- |
| **Python 3.10+** | Core runtime environment | ![Python](https://img.shields.io/badge/Python-3776AB?style=flat-square&logo=python&logoColor=white) |
| **FastAPI** | High-performance asynchronous REST API bridge | ![FastAPI](https://img.shields.io/badge/FastAPI-005571?style=flat-square&logo=fastapi&logoColor=white) |
| **Astral uv** | Fast Python package management | ![uv](https://img.shields.io/badge/Astral_uv-DE5B43?style=flat-square&logo=astral&logoColor=white) |
| **Ultralytics YOLOv8** | Lightweight object detection model (`yolov8n.pt`) | ![YOLOv8](https://img.shields.io/badge/YOLOv8-00FFFF?style=flat-square&logo=YOLO&logoColor=black) |
| **OpenCV** | Image processing & video stream capture | ![OpenCV](https://img.shields.io/badge/OpenCV-5C3EE8?style=flat-square&logo=opencv&logoColor=white) |
| **HTTPX** | Async HTTP client for polling ESP hardware | ![HTTPX](https://img.shields.io/badge/HTTPX-111111?style=flat-square) |
| **Pydantic Settings**| Type-safe configuration management | ![Pydantic](https://img.shields.io/badge/Pydantic-E92063?style=flat-square&logo=pydantic&logoColor=white) |

### **Frontend Monitoring Dashboard**
| Technology | Description | Badge |
| :--- | :--- | :--- |
| **React 19** | Modern UI library for interactive components | ![React](https://img.shields.io/badge/React_19-20232A?style=flat-square&logo=react&logoColor=61DAFB) |
| **Vite** | Next-generation frontend build tooling | ![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat-square&logo=vite&logoColor=white) |
| **TypeScript** | Type-safe application development | ![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat-square&logo=typescript&logoColor=white) |
| **Tailwind CSS** | Utility-first glassmorphism styling | ![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=flat-square&logo=tailwind-css&logoColor=white) |
| **TanStack React Query**| Real-time API state polling & caching | ![React Query](https://img.shields.io/badge/TanStack_Query-FF4154?style=flat-square&logo=react-query&logoColor=white) |
| **Recharts** | Interactive sensor telemetry trend charts | ![Recharts](https://img.shields.io/badge/Recharts-22B5BF?style=flat-square) |
| **Lucide Icons** | Clean vector icon system | ![Lucide](https://img.shields.io/badge/Lucide_Icons-F59E0B?style=flat-square) |

---

## 📐 System Architecture

```
                               ┌────────────────────────────────┐
                               │     ESP8266 Proximity Sensor   │
                               │  GET /status  GET /data        │
                               └───────────────┬────────────────┘
                                               │ HTTP Poll 500ms
                                               ▼
┌──────────────────────────┐        ┌──────────────────────────┐        ┌──────────────────────────┐
│  React 19 Dashboard      │  HTTP  │  FastAPI Bridge Server   │  HTTP  │   XIAO ESP32S3 Camera    │
│  - Live AI Video Stream  ├───────►│  - YOLOv8 Inference      ├───────►│  - GET /flash_on, /off   │
│  - Distance Telemetry    │        │  - Auto Deterrent Logic  │        │  - GET /buzzer_on, /off  │
│  - Manual Controls       │        │  - Audit Intrusion Logs  │        │  - Camera Stream (Port 81)│
└──────────────────────────┘        └──────────────────────────┘        └──────────────────────────┘
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: v18+ ([Download](https://nodejs.org/))
- **Python**: 3.8+ ([Download](https://python.org/))
- *(Optional)* **Astral uv**: Fast Python package installer (`pip install uv`)

---

### ⚡ One-Click Start (Recommended)

Simply double-click [`start.bat`](file:///c:/Users/Abumuzzammil/OneDrive/Desktop/niral/start.bat) or execute in Windows Command Prompt:

```cmd
start.bat
```

---

## 📜 License

Distributed under the MIT License. See `LICENSE` for more information.

<div align="center">

**Developed for Niral Thiruvizha 🌱 Smart Agriculture & Wildlife Protection**

</div>
