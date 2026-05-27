"""
Analysis router — handles file upload + question → agent response.
"""

from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from typing import Optional

from app.services.file_handler import parse_upload
from app.services.agent import CSVAnalystAgent
from app.models.schemas import AnalysisResponse, DatasetInfo

router = APIRouter()
_agent = CSVAnalystAgent()


@router.post("/upload-and-ask", response_model=AnalysisResponse)
async def upload_and_ask(
    file: UploadFile = File(...),
    question: str = Form(...),
    session_id: Optional[str] = Form(None),
):
    """
    Upload a CSV/Excel file and ask an analytical question.
    The agent will write and execute Python/pandas code, self-correct on errors,
    and return the answer plus any generated charts.
    """
    if not question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty.")

    df, _ = await parse_upload(file)
    response = await _agent.analyze(df, question.strip(), session_id)
    return response


@router.post("/preview", response_model=DatasetInfo)
async def preview_dataset(file: UploadFile = File(...)):
    """
    Upload a file and get dataset metadata (shape, columns, dtypes, sample values).
    No AI call is made — this is fast and cheap.
    """
    _, dataset_info = await parse_upload(file)
    return dataset_info
