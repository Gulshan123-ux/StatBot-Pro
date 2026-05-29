# 🤖 StatBot Pro — Autonomous CSV Data Analyst Agent

> Upload any CSV/Excel file → ask complex analytical questions in plain English → get answers + charts, powered by LangChain + GPT-4.

**Internship Project — Infotact Solutions**

---

## 🏗️ Architecture

```
statbot-pro/
├── backend/                  # FastAPI + LangChain Agent
│   ├── main.py               # FastAPI app entrypoint
│   ├── app/
│   │   ├── routers/
│   │   │   ├── analysis.py   # POST /api/analysis/upload-and-ask
│   │   │   └── health.py     # GET  /api/health
│   │   ├── services/
│   │   │   ├── agent.py      # LangChain autonomous agent
│   │   │   └── file_handler.py  # CSV/Excel parsing
│   │   ├── models/
│   │   │   └── schemas.py    # Pydantic models
│   │   └── utils/
│   │       └── sandbox.py    # Sandboxed Python REPL
│   ├── static/charts/        # Generated chart PNGs (auto-created)
│   ├── requirements.txt
│   └── Dockerfile
│
├── frontend/                 # Next.js 14 + Tailwind
│   └── src/
│       ├── app/
│       │   ├── page.tsx      # Main UI
│       │   ├── layout.tsx
│       │   └── globals.css
│       ├── components/
│       │   ├── FileDropzone.tsx     # Drag-and-drop CSV upload
│       │   ├── AgentThinking.tsx    # Animated loading indicator
│       │   ├── AnalysisResult.tsx   # Answer + charts + code
│       │   └── DataPreview.tsx      # Dataset metadata table
│       ├── lib/
│       │   └── api.ts        # Axios API client
│       └── types/
│           └── index.ts      # TypeScript interfaces
│
└── docker-compose.yml        # Full stack in one command
```

---

## ⚙️ Week 1 Progress (What's Built)

| Feature | Status |
|---|---|
| FastAPI backend with CORS | ✅ |
| CSV/Excel file upload & parsing | ✅ |
| Dataset preview endpoint | ✅ |
| LangChain OpenAI Tools Agent | ✅ |
| Sandboxed Python REPL (blocks os/subprocess) | ✅ |
| Self-correction (retries on code errors) | ✅ |
| Matplotlib chart generation + PNG saving | ✅ |
| Chart served via static URL | ✅ |
| Next.js 14 frontend | ✅ |
| Drag-and-drop file upload | ✅ |
| Animated agent thinking indicator | ✅ |
| Conversation history | ✅ |
| Syntax-highlighted code viewer | ✅ |
| Docker + Docker Compose | ✅ |

---

## 🚀 Quick Start

### Option A: Docker Compose (Recommended)

```bash
# 1. Clone and enter project
cd statbot-pro

# 2. Set your OpenAI API key
echo "OPENAI_API_KEY=sk-..." > .env

# 3. Run everything
docker-compose up --build
```

Visit: http://localhost:3000

---

### Option B: Local Development

**Backend**
```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate       # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env and add your OPENAI_API_KEY

# Run server
uvicorn main:app --reload --port 8000
```

**Frontend**
```bash
cd frontend

# Install dependencies
npm install

# Configure environment
cp .env.local.example .env.local

# Run dev server
npm run dev
```

Visit: http://localhost:3000 | API Docs: http://localhost:8000/docs

---

## 🔑 Environment Variables

### Backend (`backend/.env`)
| Variable | Default | Description |
|---|---|---|
| `OPENAI_API_KEY` | **required** | Your OpenAI API key |
| `OPENAI_MODEL` | `gpt-4o` | Model to use |
| `MAX_ITERATIONS` | `10` | Max agent self-correction retries |
| `CHARTS_DIR` | `static/charts` | Where PNGs are saved |
| `CHARTS_BASE_URL` | `http://localhost:8000/static/charts` | Public URL prefix for charts |
| `ALLOWED_ORIGINS` | `http://localhost:3000` | CORS allowed origins |

### Frontend (`frontend/.env.local`)
| Variable | Default | Description |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | Backend API URL |

---

## 📡 API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/health` | Health check |
| `POST` | `/api/analysis/preview` | Upload file → get metadata |
| `POST` | `/api/analysis/upload-and-ask` | Upload file + question → get answer + charts |

### Example cURL
```bash
curl -X POST http://localhost:8000/api/analysis/upload-and-ask \
  -F "file=@sales.csv" \
  -F "question=What is the sales trend by region?"
```

---

## 🛡️ Security (Sandboxing)

The agent executes code in a restricted Python environment:
- **Blocked**: `os`, `subprocess`, `shutil`, `open()`, `socket`, `requests`, `urllib`
- **Blocked builtins**: `__import__`, `eval`, `exec` (raw), `compile`, `input`
- **Allowed**: `pandas`, `numpy`, `matplotlib`, `seaborn`, `save_chart()`
- Static pattern analysis runs before every code execution

---

## 📅 Week 2 Plan (Next Steps)

- [ ] Add Redis job queue for async long-running analyses
- [ ] WebSocket progress streaming
- [ ] Session persistence (follow-up questions remember context)
- [ ] Support for multi-file joins
- [ ] Export results as PDF report

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Backend | FastAPI, Python 3.11 |
| AI Agent | LangChain, GPT-4o |
| Data | Pandas, NumPy |
| Charts | Matplotlib, Seaborn |
| Frontend | Next.js 14, TypeScript, Tailwind CSS |
| Container | Docker, Docker Compose |
