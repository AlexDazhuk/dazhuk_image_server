import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent

# підвантажуємо .env (для локальної розробки)
load_dotenv(BASE_DIR / '.env')

HOST = os.getenv('HOST', '0.0.0.0')
PORT = int(os.getenv('PORT', '8000'))


# 🔐 БД (БЕЗ дефолтного пароля!)
DB_HOST = os.getenv('DB_HOST', 'postgres')
DB_PORT = int(os.getenv('DB_PORT', '5432'))
DB_NAME = os.getenv('DB_NAME', 'image_server')
DB_USER = os.getenv('DB_USER', 'image_user')
DB_PASSWORD = os.getenv('DB_PASSWORD')

if not DB_NAME:
    raise RuntimeError('DB_NAME не заданий у .env')

if not DB_USER:
    raise RuntimeError('DB_USER не заданий у .env')

if not DB_PASSWORD:
    raise RuntimeError('DB_PASSWORD не заданий у .env')

BACKUPS_DIR = Path(os.getenv('BACKUPS_DIR', BASE_DIR / 'backups'))
POSTGRES_CONTAINER = os.getenv('POSTGRES_CONTAINER', 'image-server-postgres')

BACKUP_ENABLED = os.getenv('BACKUP_ENABLED', 'true').lower() == 'true'
BACKUP_INTERVAL_MINUTES = int(os.getenv('BACKUP_INTERVAL_MINUTES', '60'))
BACKUP_RETENTION_DAYS = int(os.getenv('BACKUP_RETENTION_DAYS', '7'))
BACKUP_MAX_FILES = int(os.getenv('BACKUP_MAX_FILES', '50'))
BACKUP_MAX_TOTAL_SIZE_MB = int(os.getenv('BACKUP_MAX_TOTAL_SIZE_MB', '1024'))
BACKUP_MAX_TOTAL_SIZE_BYTES = BACKUP_MAX_TOTAL_SIZE_MB * 1024 * 1024


# 📁 шляхи
IMAGES_DIR = Path(os.getenv('IMAGES_DIR', BASE_DIR / 'images'))
LOGS_DIR = Path(os.getenv('LOGS_DIR', BASE_DIR / 'logs'))
STATIC_DIR = Path(os.getenv('STATIC_DIR', BASE_DIR / 'static'))


# ⚙️ константи
MAX_FILE_SIZE_MB = 5  # МБ
MAX_FILE_SIZE = MAX_FILE_SIZE_MB * 1024 * 1024
ALLOWED_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.gif'}
