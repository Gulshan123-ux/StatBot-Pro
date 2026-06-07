# Frontend

This folder contains the Next.js app for StatBot Pro.

## Structure

```text
frontend/
├── app/
├── components/
├── lib/
├── public/
├── types/
├── package.json
└── .env.local.example
```

## Local Run

```powershell
cd frontend
npm install
npm run dev
```

## Environment

Create `.env.local` with:

```text
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## Notes

- The live UI code is in this folder.
- Older mockups were moved to `archive/legacy-prototypes/frontend-mockups/`.
