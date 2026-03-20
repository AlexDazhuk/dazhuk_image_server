import time
from contextlib import contextmanager

import psycopg2
from psycopg2.extras import RealDictCursor

import config


def get_connection():
    return psycopg2.connect(
        host=config.DB_HOST,
        port=config.DB_PORT,
        dbname=config.DB_NAME,
        user=config.DB_USER,
        password=config.DB_PASSWORD,
        cursor_factory=RealDictCursor,
    )


@contextmanager
def db_connection():
    connection = get_connection()
    try:
        yield connection
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def init_db() -> None:
    query = """
    CREATE TABLE IF NOT EXISTS images (
        id BIGSERIAL PRIMARY KEY,
        original_name TEXT NOT NULL,
        stored_name TEXT NOT NULL UNIQUE,
        file_path TEXT NOT NULL,
        file_url TEXT NOT NULL,
        extension VARCHAR(16) NOT NULL,
        size_bytes BIGINT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    """

    with db_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(query)


def wait_for_db() -> None:
    for attempt in range(10):
        try:
            conn = get_connection()
            conn.close()
            print('DB ready')
            return
        except Exception:
            print(f'DB not ready (attempt {attempt + 1})...')
            time.sleep(2)

    raise RuntimeError('DB not available')