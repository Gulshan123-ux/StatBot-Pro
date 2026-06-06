from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.models.schemas import AnalysisResponse, DatasetPreview
from app.services.agent import CSVAnalystAgent
from app.services.file_handler import FileHandler

router = APIRouter()
agent = CSVAnalystAgent()


@router.post("/preview", response_model=DatasetPreview)
async def preview(file: UploadFile = File(...)):
    try:
        df = FileHandler.read_table(file.file, file.filename)
        return FileHandler.dataset_info(df)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Unable to preview file: {exc}")


@router.post("/upload-and-ask", response_model=AnalysisResponse)
async def upload_and_ask(
    file: UploadFile = File(...),
    question: str = Form(...),
):
    if not question.strip():
        raise HTTPException(status_code=400, detail="Question is required.")

    try:
        df = FileHandler.read_table(file.file, file.filename)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Unable to read file: {exc}")

    return await agent.analyze(df=df, question=question.strip())
