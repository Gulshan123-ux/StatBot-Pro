# Backend

This folder contains the FastAPI service for StatBot Pro.

## Structure

```text
backend/
├── app/
│   ├── models/
│   │   └── schemas.py
│   ├── routers/
│   │   ├── analysis.py
│   │   └── health.py
│   ├── services/
│   │   ├── agent.py
│   │   └── file_handler.py
│   └── utils/
│       └── sandbox.py
├── static/
│   └── charts/
├── main.py
├── requirements.txt
└── .env.example
```

## Endpoints

- `GET /api/health`
- `POST /api/analysis/preview`
- `POST /api/analysis/upload-and-ask`

## Local Run

```powershell
cd backend
venv\Scripts\activate
uvicorn main:app --reload --port 8000
```

## Required Config

Set `OPENAI_API_KEY` in `backend/.env` for real model-backed analysis.

## Notes

- Chart generation expects `matplotlib` and `seaborn`.
- Legacy scratch files were moved to `archive/legacy-prototypes/`.
