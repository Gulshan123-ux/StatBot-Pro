from fastapi import FastAPI, UploadFile, File, HTTPException, status
import pandas as pd
import io

app = FastAPI()


@app.post("/upload/")
async def upload_csv(file: UploadFile = File(...)):
    """Read an uploaded CSV and return row/column information.

    This uses the async UploadFile API to read the bytes, decodes to text
    (tries utf-8 then falls back to latin1), and parses with pandas.
    """
    # Read file contents asynchronously
    contents = await file.read()

    if not contents:
        await file.close()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded file is empty")

    # Decode bytes to string (try utf-8, fallback to latin1)
    try:
        text = contents.decode("utf-8")
    except UnicodeDecodeError:
        try:
            text = contents.decode("latin-1")
        except Exception:
            await file.close()
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unable to decode uploaded file")

    # Use StringIO for pandas
    try:
        df = pd.read_csv(io.StringIO(text))
    except Exception as e:
        await file.close()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Failed to parse CSV: {e}")

    rows = len(df)
    columns = list(df.columns)

    await file.close()

    return {"rows": rows, "columns": columns}