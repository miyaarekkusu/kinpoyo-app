import uuid
from pathlib import Path
from typing import Iterable

from fastapi import HTTPException, UploadFile, status

# backend-core/uploads/{posts,avatars}/ に保存し、main.pyで /uploads として静的配信する
UPLOAD_ROOT = Path(__file__).resolve().parent.parent.parent / "uploads"
POST_IMAGES_DIR = UPLOAD_ROOT / "posts"
AVATAR_IMAGES_DIR = UPLOAD_ROOT / "avatars"

_ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
_MAX_IMAGE_BYTES = 8 * 1024 * 1024
_MAX_IMAGES_PER_REQUEST = 5


def _save_image(file: UploadFile, dest_dir: Path) -> str:
    if file.content_type not in _ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"対応していない画像形式です: {file.content_type}",
        )
    data = file.file.read()
    if len(data) > _MAX_IMAGE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="画像サイズは8MB以下にしてください",
        )
    dest_dir.mkdir(parents=True, exist_ok=True)
    suffix = Path(file.filename or "").suffix or ".jpg"
    filename = f"{uuid.uuid4().hex}{suffix}"
    (dest_dir / filename).write_bytes(data)
    return f"/uploads/{dest_dir.name}/{filename}"


def save_post_images(files: Iterable[UploadFile]) -> list[str]:
    files = list(files)
    if len(files) > _MAX_IMAGES_PER_REQUEST:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"画像は一度に{_MAX_IMAGES_PER_REQUEST}枚までです",
        )
    return [_save_image(file, POST_IMAGES_DIR) for file in files]


def save_avatar_image(file: UploadFile) -> str:
    return _save_image(file, AVATAR_IMAGES_DIR)
