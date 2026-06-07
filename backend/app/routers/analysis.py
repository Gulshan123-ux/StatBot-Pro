"""
Analysis router — handles file upload + question → agent response.
"""

from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from typing import Optional

from app.services.file_handler import parse_upload
from app.services.agent import CSVAnalystAgent
from app.models.schemas import AnalysisResponse, DatasetInfo
from app.services.session_store import get_history, clear_session


#rate limiting 
from slowapi import Limiter
from slowapi.util import get_remote_address
from fastapi import Request

limiter = Limiter(key_func=get_remote_address)

SUPPORTED_EXTENSIONS = {".csv", ".xlsx", ".xls", ".tsv"}
MAX_QUESTION_LENGTH = 500

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

    if len(question) > 500:
        raise HTTPException(
            status_code=400,
            detail=f"Question too long ({len(question)} chars). Max 500 characters."
    )

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


@router.get("/session/{session_id}/history")
async def get_session_history(session_id: str):
    """
    Get conversation history for a session.
    Useful for showing previous questions in the frontend.
    """
    history = get_history(session_id)
    return {
        "session_id": session_id,
        "count": len(history),
        "history": history,
    }


@router.delete("/session/{session_id}")
async def delete_session(session_id: str):
    """Clear conversation history for a session."""
    clear_session(session_id)
    return {"session_id": session_id, "cleared": True}

@router.post("/upload-and-ask", response_model=AnalysisResponse)
@limiter.limit("10/minute")
async def upload_and_ask(
    request: Request,
    file: UploadFile = File(...),
    question: str = Form(...),
    session_id: Optional[str] = Form(None),
):
    """
    Upload a CSV file and ask question.
    The agent will write and execute Python and pandas, self-correct on errors,
    and return the answer plus any generated charts.
    """
    if not question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty.")

    if len(question) > MAX_QUESTION_LENGTH:
        raise HTTPException(
            status_code=400,
            detail=f"Question too long ({len(question)} chars). Max {MAX_QUESTION_LENGTH} characters."
        )

    df, _ = await parse_upload(file)
    response = await _agent.analyze(df, question.strip(), session_id)
    return response