import io
import uuid
from pathlib import Path

from PIL import Image

from config import (
    ALLOWED_EXTENSIONS,
    IMAGES_DIR,
    MAX_FILE_SIZE,
    MAX_FILE_SIZE_MB
)


class UploadError(Exception):
    """Базова помилка upload-сервісу."""


class InvalidUploadError(UploadError):
    """Помилка валідації завантаженого файлу."""


class StorageError(UploadError):
    """Помилка збереження файлу."""


def extract_safe_filename(filename: str) -> str:
    safe_name = Path(filename).name.strip()
    if not safe_name:
        raise InvalidUploadError('Файл не надано')
    return safe_name


def extract_extension(filename: str) -> str:
    ext = Path(filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        allowed = ', '.join(sorted(ALLOWED_EXTENSIONS))
        raise InvalidUploadError(
            f'Непідтримуваний формат файлу. Дозволені: {allowed}'
        )
    return ext


def validate_file_size(file_data: bytes) -> None:
    if len(file_data) > MAX_FILE_SIZE:
        raise InvalidUploadError(f'Файл занадто великий. Максимальний розмір: {MAX_FILE_SIZE_MB} МБ')


def validate_image_content(file_data: bytes) -> None:
    try:
        with Image.open(io.BytesIO(file_data)) as image:
            image.verify()
    except Exception as exc:
        raise InvalidUploadError('Файл не є дійсним зображенням') from exc


def generate_unique_filename(extension: str) -> str:
    return f'{uuid.uuid4().hex}{extension}'


def save_file(file_data: bytes, stored_name: str) -> Path:
    save_path = IMAGES_DIR / stored_name

    try:
        with open(save_path, 'wb') as file_obj:
            file_obj.write(file_data)
    except OSError as exc:
        raise StorageError('Не вдалося зберегти файл') from exc

    return save_path


def process_upload(file_item) -> dict:
    """
    Повний цикл обробки upload:
    - безпечне ім'я
    - перевірка extension
    - читання bytes
    - перевірка розміру
    - перевірка Pillow
    - генерація імені
    - збереження на диск
    """
    if file_item is None or not getattr(file_item, 'filename', None):
        raise InvalidUploadError('Файл не надано')

    original_name = extract_safe_filename(file_item.filename)
    extension = extract_extension(original_name)

    file_data = file_item.file.read()
    validate_file_size(file_data)
    validate_image_content(file_data)

    stored_name = generate_unique_filename(extension)
    saved_path = save_file(file_data, stored_name)

    return {
        'original_name': original_name,
        'stored_name': stored_name,
        'extension': extension,
        'file_size': len(file_data),
        'file_path': saved_path,
        'url': f'/images/{stored_name}',
    }
