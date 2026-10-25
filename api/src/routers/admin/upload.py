import io
import logging
import os
import uuid
from pathlib import Path

import aiofiles
import asyncpg
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status

try:
    from PIL import Image, ImageOps

    HAS_PILLOW = True
except ImportError:
    HAS_PILLOW = False

from src.auth.deps import get_current_staff

logger = logging.getLogger(__name__)

router = APIRouter()

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg", ".heic", ".heif"}
ALLOWED_CONTENT_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "image/svg+xml",
    "image/heic",
    "image/heif",
    "application/octet-stream",
}
MAX_FILE_SIZE = 25 * 1024 * 1024  # 25 MB


def _get_uploads_dir() -> Path:
    env_dir = os.environ.get("UPLOADS_DIR", "/app/uploads")
    path = Path(env_dir)
    if not path.is_dir():
        path = Path(__file__).resolve().parent.parent.parent.parent / "uploads"
    path.mkdir(parents=True, exist_ok=True)
    return path


@router.post("/upload")
async def upload_image(
    file: UploadFile = File(...),
    staff: asyncpg.Record = Depends(get_current_staff),
):
    """
    Завантажує зображення страви або банера безпосередньо з адмін-панелі.
    Зберігає локально у сховище та повертає публічний відносний URL (/api/uploads/...).
    """
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Файл не має назви",
        )

    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        allowed = ", ".join(sorted(ALLOWED_EXTENSIONS))
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Непідтримуваний формат файлу ({ext}). Дозволено: {allowed}",
        )

    if file.content_type and file.content_type.lower() not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Непідтримуваний MIME-тип ({file.content_type})",
        )

    # Читаємо вміст файлу та перевіряємо розмір
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Розмір файлу перевищує ліміт {MAX_FILE_SIZE // (1024 * 1024)} МБ",
        )

    uploads_dir = _get_uploads_dir()

    final_width: int | None = None
    final_height: int | None = None

    # Якщо це векторна графіка, GIF-анімація або відсутній модуль Pillow — зберігаємо як є
    if ext in {".svg", ".gif"} or not HAS_PILLOW:
        unique_name = f"{uuid.uuid4().hex[:16]}{ext}"
        file_path = uploads_dir / unique_name
        async with aiofiles.open(file_path, "wb") as out_file:
            await out_file.write(content)
        saved_size = len(content)
    else:
        # Авто-стиснення та конвертація растрових зображень у сучасний WebP (до 1200x1200px Retina)
        unique_name = f"{uuid.uuid4().hex[:16]}.webp"
        file_path = uploads_dir / unique_name

        try:
            img = Image.open(io.BytesIO(content))
            img = ImageOps.exif_transpose(img)

            if img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info):
                img = img.convert("RGBA")
            else:
                img = img.convert("RGB")

            # Зменшуємо до макс. 1200x1200 px зі збереженням пропорцій (ідеально для Retina та вебу)
            img.thumbnail((1200, 1200), Image.Resampling.LANCZOS)
            final_width, final_height = img.size

            out_buf = io.BytesIO()
            # method=6 забезпечує найвищу якість оптимізації алгоритму libwebp
            img.save(out_buf, format="WEBP", quality=84, method=6)
            optimized_bytes = out_buf.getvalue()

            async with aiofiles.open(file_path, "wb") as out_file:
                await out_file.write(optimized_bytes)
            saved_size = len(optimized_bytes)
        except Exception as exc:
            logger.warning("Не вдалося конвертувати у WebP, зберігаємо оригінал: %s", exc)
            unique_name = f"{uuid.uuid4().hex[:16]}{ext}"
            file_path = uploads_dir / unique_name
            async with aiofiles.open(file_path, "wb") as out_file:
                await out_file.write(content)
            saved_size = len(content)

    public_url = f"/api/uploads/{unique_name}"
    logger.info(
        "Адміністратор %s успішно завантажив зображення: %s (було: %d б, стало: %d б, %sx%s)",
        staff["full_name"],
        public_url,
        len(content),
        saved_size,
        final_width or "?",
        final_height or "?",
    )

    return {
        "url": public_url,
        "filename": unique_name,
        "size": saved_size,
        "original_size": len(content),
        "width": final_width,
        "height": final_height,
    }
