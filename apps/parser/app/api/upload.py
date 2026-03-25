"""Upload endpoint for log file parsing."""

import os
import tempfile
import zipfile

from fastapi import APIRouter, UploadFile, File, HTTPException

from ..parser.engine import parse_log_file
from ..db.connection import get_pool
from ..db.repository import store_parse_results

router = APIRouter()


@router.post("/api/parse")
async def upload_and_parse(file: UploadFile = File(...)):
    """
    Accept uploaded .txt or .zip file.
    If .zip: extract the .txt file inside.
    Parse and store in PostgreSQL.
    Return device summary + anomaly count.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")

    filename = file.filename
    ext = os.path.splitext(filename)[1].lower()

    if ext not in ('.txt', '.zip'):
        raise HTTPException(status_code=400, detail="Only .txt and .zip files are supported")

    with tempfile.TemporaryDirectory() as tmpdir:
        # Save uploaded file
        upload_path = os.path.join(tmpdir, filename)
        content = await file.read()
        file_size = len(content)

        with open(upload_path, 'wb') as f:
            f.write(content)

        # If zip, extract the txt file
        parse_path = upload_path
        if ext == '.zip':
            with zipfile.ZipFile(upload_path, 'r') as zf:
                txt_files = [n for n in zf.namelist() if n.endswith('.txt')]
                if not txt_files:
                    raise HTTPException(status_code=400, detail="No .txt file found in zip archive")
                zf.extract(txt_files[0], tmpdir)
                parse_path = os.path.join(tmpdir, txt_files[0])
                filename = txt_files[0]

        # Parse the log file
        try:
            parsed = parse_log_file(parse_path)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Parse error: {str(e)}")

        # Store in database
        pool = await get_pool()
        try:
            result = await store_parse_results(pool, filename, file_size, parsed)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

        if result.get("status") == "duplicate":
            raise HTTPException(status_code=409, detail=result["message"])

        return result
