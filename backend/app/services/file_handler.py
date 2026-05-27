"""
File handler service — reads uploaded CSV / Excel files into a pandas DataFrame
and returns dataset metadata for the preview endpoint.
"""

import io
import pandas as pd
from fastapi import UploadFile, HTTPException, status

from app.models.schemas import DatasetInfo, DatasetColumn


ALLOWED_EXTENSIONS = {".csv", ".xlsx", ".xls", ".tsv"}
MAX_FILE_SIZE_MB = 50


async def parse_upload(file: UploadFile) -> tuple[pd.DataFrame, DatasetInfo]:
    """
    Read an UploadFile, parse it into a DataFrame, and return
    (df, DatasetInfo) or raise HTTPException on error.
    """
    import os

    filename = file.filename or "upload"
    ext = os.path.splitext(filename)[1].lower()

    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file type '{ext}'. Allowed: {sorted(ALLOWED_EXTENSIONS)}",
        )

    contents: bytes = await file.read()
    await file.close()

    if not contents:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty.",
        )

    size_mb = len(contents) / (1024 * 1024)
    if size_mb > MAX_FILE_SIZE_MB:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File too large ({size_mb:.1f} MB). Max allowed: {MAX_FILE_SIZE_MB} MB.",
        )

    try:
        if ext in {".xlsx", ".xls"}:
            df = pd.read_excel(io.BytesIO(contents))
        elif ext == ".tsv":
            df = _read_csv_bytes(contents, sep="\t")
        else:
            df = _read_csv_bytes(contents)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Could not parse file: {exc}",
        ) from exc

    if df.empty:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File parsed successfully but contains no data rows.",
        )

    dataset_info = _build_dataset_info(df, filename, len(contents))
    return df, dataset_info


def _read_csv_bytes(contents: bytes, sep: str = ",") -> pd.DataFrame:
    """Try UTF-8, then latin-1 encoding."""
    for encoding in ("utf-8", "latin-1"):
        try:
            text = contents.decode(encoding)
            return pd.read_csv(io.StringIO(text), sep=sep)
        except UnicodeDecodeError:
            continue
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Could not decode file (tried utf-8 and latin-1).",
    )


def _build_dataset_info(df: pd.DataFrame, filename: str, size_bytes: int) -> DatasetInfo:
    columns = []
    for col in df.columns:
        sample = (
            df[col].dropna().astype(str).head(3).tolist()
        )
        columns.append(
            DatasetColumn(
                name=str(col),
                dtype=str(df[col].dtype),
                null_count=int(df[col].isna().sum()),
                sample_values=sample,
            )
        )

    return DatasetInfo(
        filename=filename,
        rows=len(df),
        columns=len(df.columns),
        size_bytes=size_bytes,
        column_details=columns,
    )
