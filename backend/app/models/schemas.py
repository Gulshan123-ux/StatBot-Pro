from enum import Enum
from pydantic import BaseModel, Field
from typing import List, Optional


class AnalysisStatus(str, Enum):
    SUCCESS = "success"
    ERROR = "error"


class ChartInfo(BaseModel):
    filename: str
    url: str
    title: str


class AnalysisResponse(BaseModel):
    session_id: str
    status: AnalysisStatus
    question: str
    answer: Optional[str] = None
    charts: List[ChartInfo] = Field(default_factory=list)
    iterations: int = 0
    error: Optional[str] = None
    code_executed: Optional[str] = None
    execution_time_ms: Optional[int] = None
    rows: Optional[int] = None
    columns: Optional[int] = None


class DatasetPreview(BaseModel):
    rows: int
    columns: int
    column_names: List[str]
