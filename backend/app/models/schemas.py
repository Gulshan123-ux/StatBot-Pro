"""
Pydantic models for StatBot Pro API request/response schemas.
"""

from enum import Enum
from typing import List, Optional
from pydantic import BaseModel


class AnalysisStatus(str, Enum):
    SUCCESS = "success"
    ERROR = "error"
    PROCESSING = "processing"


class ChartInfo(BaseModel):
    filename: str
    url: str
    title: str = "Chart"


class DatasetColumn(BaseModel):
    name: str
    dtype: str
    null_count: int
    sample_values: List[str] = []


class DatasetInfo(BaseModel):
    filename: str
    rows: int
    columns: int
    size_bytes: int
    column_details: List[DatasetColumn] = []


class AnalysisRequest(BaseModel):
    question: str
    session_id: Optional[str] = None


class AnalysisResponse(BaseModel):
    session_id: str
    status: AnalysisStatus
    question: str
    answer: Optional[str] = None
    charts: List[ChartInfo] = []
    code_executed: Optional[str] = None
    iterations: int = 0
    execution_time_ms: int = 0
    error: Optional[str] = None
