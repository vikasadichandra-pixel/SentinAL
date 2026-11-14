# SentinAL: Automated IP Protection & Anti-Piracy Enforcement System 

SentinAL is an autonomous intellectual property (IP) protection and automated digital rights management (DRM) platform. It monitors web locations for unauthorized streaming distribution, automatically checks findings against legal distribution contracts using Generative AI, and generates legally compliant DMCA cease-and-desist notifications.

---

## 🌟 Core Features

- **Interactive 3D WebGL Globe Dashboard:** Visually maps active territorial breaches, server source-to-target paths, and active threat streams in real-time. Built with **React Three Fiber** and custom particle simulations.
- **Intelligent Contract Ingest (Gemini AI):** Zero-shot parsing of legal licensing contracts to extract distribution rules, geographic windows, expiration dates, and exclusivity terms.
- **Autonomous Crawler Drones:** Multi-site Selenium crawler scripts that dynamically scan pirate video players, grab network requests, and compile violation reports.
- **Legal Notice Generator:** Automatically compiles enterprise-grade, court-admissible PDF cease-and-desist notices using ReportLab Platypus and Gemini LLM.
- **Real-Time Alert Feed:** Fast polling system that feeds active violations from the crawlers straight to the Operations Center (SOC) dashboard.

---

## 📂 Project Structure

```text
SentinAL/
│
├── SentinAL_Backend/         # Django REST API Backend
│   ├── api/                  # Core API views, serializers, models (Contract, Violation)
│   ├── ai_engine/            # Google Gemini client for parsing contracts and drafting notices
│   ├── utils/                # PDF Generation utilities using ReportLab Platypus
│   └── sentinal_core/        # Django settings, middleware, and routing configurations
│
├── sentinal-frontend/        # Vite + React Dashboard
│   ├── src/components/       # UI elements (Interactive 3D Globe, threat logs, action console)
│   ├── src/hooks/            # Custom React hooks (real-time REST updates)
│   └── src/utils/            # Spherical coordinate converter (polar2Cartesian)
│
├── SentinAL_Crawler/         # Selenium Scanners & Mock Targets
│   ├── sentinel.py           # Main crawler drone engine
│   └── multi_pirate_sites/   # Mock pirate streaming websites (Netflix, Prime, Hulu replicas)
│
├── run_demo.py               # Auto-startup pipeline orchestration script
└── threaded_server.py        # Mock HTTP streaming server for target sites
```

---

## 🛠️ Technology Stack

- **Frontend:** React, Vite, Three.js, React Three Fiber (R3F), `@react-three/drei`, Tailwind CSS
- **Backend:** Django, Django REST Framework (DRF), Python 3.10+
- **Database:** SQLite (development default)
- **AI Integrations:** Google Gemini API (`google-generativeai`)
- **Document Generation:** ReportLab (Platypus flowables)
- **Web Automation:** Selenium WebDriver, Chrome Web Engine

---

## 🚀 Setup & Installation

### 1. Prerequisites
Ensure you have the following installed on your local machine:
- **Python 3.10 or higher**
- **Node.js 18 or higher**
- **Google Chrome** (with standard WebDriver dependencies for crawler automation)

### 2. Environment Configuration
Create a `.env` file in the `SentinAL_Backend/` directory and add your Google Gemini API Key:
```env
GEMINI_API_KEY=your_gemini_api_key_here
```

### 3. Step-by-Step Installation

#### A. Backend Setup
1. Open a terminal and navigate to the backend directory:
   ```bash
   cd SentinAL_Backend
   ```
2. Create and activate a Python virtual environment:
   ```bash
   python -m venv venv
   # On Windows:
   .\venv\Scripts\activate
   # On macOS/Linux:
   source venv/bin/activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Run migrations and initialize database:
   ```bash
   python manage.py migrate
   ```

#### B. Frontend Setup
1. In a new terminal, navigate to the frontend directory:
   ```bash
   cd sentinal-frontend
   ```
2. Install npm dependencies:
   ```bash
   npm install
   ```

---

## 🎮 Running the Demo Pipeline

SentinAL includes an automated orchestrator script (`run_demo.py`) that boots up the entire environment (Django server, React dashboard, mock streaming sites) and triggers the crawler drones sequentially.

To run the automated demo:
1. Ensure your virtual environment is active in the root folder.
2. Run the pipeline script:
   ```bash
   python run_demo.py
   ```
3. Open your browser and navigate to:
   - **React Dashboard:** `http://localhost:5173/` or `http://localhost:5174/`
   - **Mock Netflix Node:** `http://127.0.0.1:8081/`
   - **Mock Prime Video Node:** `http://127.0.0.1:8082/`
   - **Mock Hulu Node:** `http://127.0.0.1:8083/`

To shut down all background servers, simply press `Ctrl+C` in the terminal executing `run_demo.py`.

---

## 📄 License & Legal Notice
SentinAL is developed for digital rights management verification and intellectual property scanning demonstration. Ensure compliance with terms of service agreements before targeting crawler drones on public domains.
