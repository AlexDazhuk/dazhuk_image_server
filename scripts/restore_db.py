from __future__ import annotations

import time
from datetime import datetime

# IMPORTANT: force timezone initialization
datetime.fromtimestamp(time.time()).astimezone()

import logging
import subprocess
import sys
from pathlib import Path

from config import DB_NAME, DB_USER, POSTGRES_CONTAINER
from logger_config import setup_logger

logger = setup_logger()

project_root = Path(__file__).resolve().parents[1]
logs_dir = project_root / 'logs'
logs_dir.mkdir(parents=True, exist_ok=True)

restore_log_file = logs_dir / 'restore_manual.log'

file_handler = logging.FileHandler(restore_log_file, encoding='utf-8')
file_handler.setFormatter(logger.handlers[0].formatter)

logger.addHandler(file_handler)


def restore_backup(backup_path: Path) -> None:
    if not backup_path.exists() or not backup_path.is_file():
        raise FileNotFoundError(f'Файл резервної копії не знайдено: {backup_path}')

    logger.info(
        'Почато: відновлення БД "%s" з резервної копії "%s".',
        DB_NAME,
        backup_path.name
    )

    # Очистка БД перед restore
    reset_command = [
        'docker',
        'exec',
        '-i',
        POSTGRES_CONTAINER,
        'psql',
        '-v',
        'ON_ERROR_STOP=1',
        '-U',
        DB_USER,
        '-d',
        DB_NAME,
        '-c',
        'DROP SCHEMA public CASCADE; CREATE SCHEMA public;',
    ]

    reset_result = subprocess.run(
        reset_command,
        stderr=subprocess.PIPE,
        check=False,
    )

    if reset_result.returncode != 0:
        error_text = reset_result.stderr.decode('utf-8', errors='replace').strip()
        raise RuntimeError(
            f'Не вдалося очистити БД перед restore. '
            f'Container={POSTGRES_CONTAINER}, DB={DB_NAME}. {error_text}'
        )

    command = [
        'docker',
        'exec',
        '-i',
        POSTGRES_CONTAINER,
        'psql',
        '-v',
        'ON_ERROR_STOP=1',
        '-U',
        DB_USER,
        '-d',
        DB_NAME,
    ]

    with open(backup_path, 'rb') as input_file:
        result = subprocess.run(
            command,
            stdin=input_file,
            stderr=subprocess.PIPE,
            check=False,
        )

    if result.returncode != 0:
        error_text = result.stderr.decode('utf-8', errors='replace').strip()
        raise RuntimeError(
            f'Не вдалося відновити БД з резервної копії. '
            f'Container={POSTGRES_CONTAINER}, DB={DB_NAME}. {error_text}'
        )

    logger.info(
        'Успіх: БД "%s" відновлено з резервної копії "%s".',
        DB_NAME,
        backup_path.name
    )


def main() -> int:
    if len(sys.argv) != 2:
        print('Використання: python scripts/restore_db.py backups/backup_YYYY-MM-DD_HHMMSS.sql')
        return 1

    backup_path = Path(sys.argv[1]).resolve()

    confirm = input(
        f'УВАГА! Ви перезапишете БД "{DB_NAME}" '
        f'даними з "{backup_path.name}". Введіть "yes" для підтвердження: '
    )
    if confirm.lower() != 'yes':
        print('Скасовано')
        return 1

    try:
        restore_backup(backup_path)
        logger.info(
            'Завершено: ручне відновлення БД "%s" з резервної копії "%s".',
            DB_NAME,
            backup_path.name
        )

        return 0

    except Exception as exc:
        logger.error(
            'Помилка: відновлення БД "%s" з резервної копії "%s" (%s).',
            DB_NAME,
            backup_path.name,
            exc
        )

        return 1


if __name__ == '__main__':
    raise SystemExit(main())