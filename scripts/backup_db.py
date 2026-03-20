from __future__ import annotations

import time
from datetime import datetime

# IMPORTANT: force timezone initialization
datetime.fromtimestamp(time.time()).astimezone()

import logging
import subprocess
from pathlib import Path

from config import (
    BACKUPS_DIR,
    DB_NAME,
    DB_USER,
    POSTGRES_CONTAINER,
)
from logger_config import setup_logger
from utils.datetime_utils import generate_backup_timestamp

logger = setup_logger()

project_root = Path(__file__).resolve().parents[1]
manual_logs_dir = project_root / 'logs'
manual_logs_dir.mkdir(parents=True, exist_ok=True)

manual_log_file = manual_logs_dir / 'backup_manual.log'

file_handler = logging.FileHandler(manual_log_file, encoding='utf-8')
file_handler.setFormatter(logger.handlers[0].formatter)

logger.addHandler(file_handler)

def create_backup() -> Path:
    BACKUPS_DIR.mkdir(parents=True, exist_ok=True)

    timestamp = generate_backup_timestamp()
    backup_file = BACKUPS_DIR / f'backup_{timestamp}.sql'

    logger.info(
        'Почато: резервне копіювання БД "%s".',
        DB_NAME
    )

    command = [
        'docker',
        'exec',
        '-t',
        POSTGRES_CONTAINER,
        'pg_dump',
        '-U',
        DB_USER,
        DB_NAME,
    ]

    with open(backup_file, 'wb') as output_file:
        result = subprocess.run(
            command,
            stdout=output_file,
            stderr=subprocess.PIPE,
            check=False,
            timeout=300,  # 5 хв
        )

    if result.returncode != 0:
        backup_file.unlink(missing_ok=True)
        error_text = result.stderr.decode('utf-8', errors='replace').strip()

        logger.error(
            'Помилка: резервне копіювання БД "%s" не виконано (%s).',
            DB_NAME,
            error_text
        )

        raise RuntimeError(
            f'Не вдалося створити backup БД. '
            f'container={POSTGRES_CONTAINER}, db={DB_NAME}. {error_text}'
        )

    logger.info(
        'Успіх: резервну копію БД "%s" створено, file="%s".',
        DB_NAME,
        backup_file.name
    )

    return backup_file


def main() -> int:
    try:
        backup_file = create_backup()

        logger.info(
            'Завершено: ручне резервне копіювання БД "%s".',
            DB_NAME
        )

        return 0

    except Exception as exc:
        logger.error(
            'Помилка: ручне резервне копіювання БД "%s" (%s).',
            DB_NAME,
            exc
        )

        return 1


if __name__ == '__main__':
    raise SystemExit(main())