import os
import uuid
import shutil
from typing import Optional
from fastapi import UploadFile, Request
import httpx
import boto3

from app.core.config import settings


def get_s3_client():
    """Returns a configured boto3 client if S3 settings are provided."""
    if (
        not settings.S3_BUCKET_NAME
        or not settings.AWS_ACCESS_KEY_ID
        or not settings.AWS_SECRET_ACCESS_KEY
    ):
        return None

    client_kwargs = {
        "aws_access_key_id": settings.AWS_ACCESS_KEY_ID,
        "aws_secret_access_key": settings.AWS_SECRET_ACCESS_KEY,
        "region_name": settings.AWS_REGION or "us-east-1",
    }

    if settings.AWS_ENDPOINT_URL_S3:
        client_kwargs["endpoint_url"] = settings.AWS_ENDPOINT_URL_S3

    return boto3.client("s3", **client_kwargs)


async def upload_file(
    file: UploadFile, request: Request = None, folder: str = "avatars"
) -> Optional[str]:
    """
    Unified function to upload a file to the active Storage Provider.
    Returns the public URL of the uploaded asset or None on failure.
    """
    provider = settings.STORAGE_PROVIDER.lower()

    # Generate unique filename
    ext = os.path.splitext(file.filename or "")[1]
    unique_filename = f"{folder}/{uuid.uuid4().hex[:8]}{ext}"

    if provider == "vercel_blob":
        return await _upload_vercel_blob(file, unique_filename)

    elif provider == "s3":
        return await _upload_s3(file, unique_filename)

    else:
        # Default to local storage
        return _upload_local(file, request, unique_filename)


def _upload_local(file: UploadFile, request: Request, unique_filename: str) -> str:
    """Save file to the local disk and return the local URL."""
    filepath = f"uploads/{unique_filename}"
    # Ensure directory exists
    os.makedirs(os.path.dirname(filepath), exist_ok=True)

    # Reset file cursor just in case it was read
    file.file.seek(0)
    with open(filepath, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # Generate the public URL (requires the Request object for the base URL)
    base_url = str(request.base_url).rstrip("/") if request else "http://localhost:8000"
    return f"{base_url}/uploads/{unique_filename}"


async def _upload_vercel_blob(file: UploadFile, unique_filename: str) -> Optional[str]:
    """Upload directly to Vercel Blob via its internal REST API."""
    if not settings.BLOB_READ_WRITE_TOKEN:
        print("Error: BLOB_READ_WRITE_TOKEN is missing")
        return None

    # Vercel Blob REST API url
    url = f"https://blob.vercel-storage.com/{unique_filename}"

    headers = {
        "authorization": f"Bearer {settings.BLOB_READ_WRITE_TOKEN}",
        "x-api-version": "7",
    }

    if file.content_type:
        headers["x-content-type"] = file.content_type

    # Reset file cursor
    file.file.seek(0)
    content = file.file.read()

    async with httpx.AsyncClient() as client:
        response = await client.put(url, headers=headers, content=content)

        if response.status_code == 200:
            data = response.json()
            return data.get("url")  # The public Vercel CDN url
        else:
            print(f"Vercel Blob Upload Failed: {response.text}")
            return None


async def _upload_s3(file: UploadFile, unique_filename: str) -> Optional[str]:
    """Upload to standard S3 bucket."""
    s3 = get_s3_client()
    if not s3 or not settings.S3_BUCKET_NAME:
        return None

    # Reset file cursor
    file.file.seek(0)

    try:
        s3.upload_fileobj(
            file.file,
            settings.S3_BUCKET_NAME,
            unique_filename,
            ExtraArgs={"ContentType": file.content_type or "application/octet-stream"},
        )

        if settings.AWS_ENDPOINT_URL_S3:
            # Custom S3-compatible provider URL formulation
            base_endpoint = settings.AWS_ENDPOINT_URL_S3.rstrip("/")
            return f"{base_endpoint}/{settings.S3_BUCKET_NAME}/{unique_filename}"
        else:
            # Standard AWS S3 URL
            region = settings.AWS_REGION or "us-east-1"
            return f"https://{settings.S3_BUCKET_NAME}.s3.{region}.amazonaws.com/{unique_filename}"
    except Exception as e:
        print(f"S3 Upload Error: {e}")
        return None
