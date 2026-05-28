from pathlib import Path

ALLOWED_EXTENSIONS = [".csv", ".xlsx"]
MAX_FILE_SIZE_MB = 10


def validate_file_type(filename: str):
    ext = Path(filename).suffix.lower()
    return ext in ALLOWED_EXTENSIONS


def validate_file_size(size_bytes: int):
    size_mb = size_bytes / (1024 * 1024)
    return size_mb <= MAX_FILE_SIZE_MB