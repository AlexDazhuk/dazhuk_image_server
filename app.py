"""
Сервер зображень — Python HTTP бекенд.
Обробляє завантаження зображень, валідацію та логування.
"""

import cgi
import json
import mimetypes
import signal
import threading
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
from pathlib import Path

from config import (
    STATIC_DIR,
    IMAGES_DIR,
    MAX_FILE_SIZE,
    MAX_FILE_SIZE_MB,
    HOST,
    PORT
)

from logger_config import setup_logger

from db.connection import wait_for_db, init_db
from repositories.image_repository import ImageRepository
from services.upload_service import (
    InvalidUploadError,
    StorageError,
    process_upload,
)

IMAGES_DIR.mkdir(parents=True, exist_ok=True)
logger = setup_logger()


class ImageServerHandler(BaseHTTPRequestHandler):
    """HTTP обробник запитів для сервера зображень."""

    def do_GET(self):
        """Обробка GET-запитів."""
        if self.path == '/favicon.ico':
            favicon_path = STATIC_DIR / 'favicon.ico'

            if favicon_path.exists():
                self.send_response(200)
                self.send_header('Content-type', 'image/x-icon')
                self.send_header('Cache-Control', 'public, max-age=86400')
                self.end_headers()

                with open(favicon_path, 'rb') as f:
                    self.wfile.write(f.read())
            else:
                self.send_response(204)
                self.end_headers()

            return

        path = self.path.split('?', 1)[0]

        if path in ('', '/'):
            self._serve_file(STATIC_DIR / 'home.html', 'text/html')
            return

        if path == '/upload':
            self._serve_file(STATIC_DIR / 'form' / 'upload.html', 'text/html')
            return

        if path == '/images':
            self._serve_file(STATIC_DIR / 'form' / 'images.html', 'text/html')
            return

        if path == '/db-gallery':
            self._serve_file(STATIC_DIR / 'form' / 'db-gallery.html', 'text/html')
            return

        if path == '/api/images':
            parsed_url = urlparse(self.path)
            query_params = parse_qs(parsed_url.query)

            try:
                page = int(query_params.get('page', ['1'])[0])
            except (ValueError, TypeError):
                page = 1

            try:
                limit = int(query_params.get('limit', ['10'])[0])
            except (ValueError, TypeError):
                limit = 10

            if page < 1:
                page = 1

            allowed_limits = {10, 25, 50, 100}
            if limit not in allowed_limits:
                limit = 10

            try:
                total_items = ImageRepository.count_images()
                total_pages = max(1, (total_items + limit - 1) // limit)
                offset = (page - 1) * limit

                images = ImageRepository.list_images_paginated(limit=limit, offset=offset)

                items = []
                for image in images:
                    row = dict(image)

                    if row.get('created_at'):
                        row['created_at'] = row['created_at'].isoformat()

                    items.append(row)

            except Exception as exc:
                logger.error(
                    'Помилка: отримання списку зображень, page=%d, limit=%d (%s).',
                    page,
                    limit,
                    exc
                )

                self._send_json(500, {
                    'success': False,
                    'error': 'Не вдалося отримати список зображень'
                })
                return

            # logger.info(
            #     'Успіх: список зображень отримано, page=%d, limit=%d, total_items=%d.',
            #     page,
            #     limit,
            #     total_items
            # )

            self._send_json(200, {
                'items': items,
                'pagination': {
                    'page': page,
                    'limit': limit,
                    'total_items': total_items,
                    'total_pages': total_pages,
                    'has_prev': page > 1,
                    'has_next': page < total_pages,
                    'allowed_limits': [10, 25, 50, 100],
                }
            })
            return

        if path.startswith('/image-uploader/') or path.startswith('/form/'):
            file_path = STATIC_DIR / path.lstrip('/')
            self._serve_static(file_path)
            return

        if path.startswith('/images/'):
            file_path = IMAGES_DIR / Path(path).name
            self._serve_static(file_path)
            return

        self._send_error(404, 'Сторінку не знайдено')

    def do_POST(self):
        """Обробка POST запитів."""
        path = self.path.split('?')[0]

        if path == '/upload':
            self._handle_upload()
        else:
            self._send_error(404, 'Маршрут не знайдено')

    def do_DELETE(self):
        """Обробка DELETE запитів."""
        path = self.path.split('?')[0]

        if path.startswith('/api/images/'):
            self._handle_delete_image(path)
        else:
            self._send_error(404, 'Маршрут не знайдено')

    def _handle_upload(self):
        """Обробка завантаження зображення."""
        content_type = self.headers.get('Content-Type', '')

        if 'multipart/form-data' not in content_type:
            logger.warning(
                'Помилка: завантаження зображення, невірний Content-Type (%s).',
                content_type
            )

            self._send_json(400, {
                'success': False,
                'error': 'Content-Type повинен бути multipart/form-data'
            })
            return

        content_length = int(self.headers.get('Content-Length', 0))
        if content_length > MAX_FILE_SIZE:
            logger.warning(
                'Помилка: завантаження зображення, файл занадто великий (%d байт).',
                content_length
            )

            self._send_json(400, {
                'success': False,
                'error': f'Файл занадто великий. Максимальний розмір: {MAX_FILE_SIZE_MB} МБ'
            })
            return

        try:
            form = cgi.FieldStorage(
                fp=self.rfile,
                headers=self.headers,
                environ={
                    'REQUEST_METHOD': 'POST',
                    'CONTENT_TYPE': content_type,
                }
            )
        except Exception as exc:
            logger.warning(
                'Помилка: завантаження зображення, не вдалося розібрати форму (%s).',
                exc
            )

            self._send_json(400, {
                'success': False,
                'error': 'Не вдалося розібрати дані форми'
            })
            return

        file_item = form['file'] if 'file' in form else None

        if file_item is None or not getattr(file_item, 'filename', None):
            logger.warning(
                'Помилка: upload без файлу, Content-Type=%s.',
                content_type
            )

            self._send_json(400, {
                'success': False,
                'error': 'Файл не передано'
            })
            return

        try:
            upload_result = process_upload(file_item)

            image_row = ImageRepository.create_image(
                original_name=upload_result['original_name'],
                stored_name=upload_result['stored_name'],
                file_path=str(upload_result['file_path']),
                file_url=upload_result['url'],
                extension=upload_result['extension'],
                size_bytes=upload_result['file_size'],
            )

        except InvalidUploadError as exc:
            logger.warning(
                'Помилка: завантаження зображення (%s).',
                exc
            )

            self._send_json(400, {
                'success': False,
                'error': str(exc)
            })
            return

        except StorageError as exc:
            logger.error(
                'Помилка: збереження зображення (%s).',
                exc
            )

            self._send_json(500, {
                'success': False,
                'error': str(exc)
            })
            return

        except Exception as exc:
            logger.error(
                'Помилка: запис у БД або upload-обробка: %s',
                exc
            )

            self._send_json(500, {
                'success': False,
                'error': 'Внутрішня помилка сервера'
            })
            return

        logger.info(
            'Успіх: зображення завантажено, id=%d, original_name="%s", stored_name="%s".',
            image_row['id'],
            upload_result['original_name'],
            upload_result['stored_name'],
        )

        self._send_json(200, {
            'success': True,
            'id': image_row['id'],
            'filename': upload_result['stored_name'],
            'original_name': upload_result['original_name'],
            'url': upload_result['url'],
            'size_bytes': upload_result['file_size'],
            'created_at': image_row['created_at'].isoformat(),
        })

    def _handle_delete_image(self, path):
        """Видалення зображення з БД і диска."""
        image_id_part = path.removeprefix('/api/images/').strip()

        if not image_id_part.isdigit():
            logger.warning(
                'Помилка: видалення зображення, некоректний id (%s).',
                image_id_part
            )

            self._send_json(400, {
                'success': False,
                'error': 'Некоректний ID зображення'
            })
            return

        image_id = int(image_id_part)

        try:
            deleted_row = ImageRepository.delete_by_id(image_id)

            if not deleted_row:
                logger.warning(
                    'Помилка: видалення зображення id=%d, не знайдено.',
                    image_id
                )

                self._send_json(404, {
                    'success': False,
                    'error': 'Зображення не знайдено'
                })
                return

            file_path = Path(deleted_row['file_path'])
            if file_path.is_file():
                file_path.unlink()
            else:
                logger.warning(
                    'Попередження: файл зображення відсутній на диску id=%d, original_name="%s", stored_name="%s".',
                    deleted_row['id'],
                    deleted_row['original_name'],
                    deleted_row['stored_name']
                )

            logger.info(
                'Успіх: зображення видалено, id=%d, original_name="%s", stored_name="%s".',
                deleted_row['id'],
                deleted_row['original_name'],
                deleted_row['stored_name']
            )

        except Exception as exc:
            logger.error(
                'Помилка: видалення зображення id=%d (%s).',
                image_id,
                exc
            )

            self._send_json(500, {
                'success': False,
                'error': 'Не вдалося видалити зображення'
            })
            return

        self._send_json(200, {
            'success': True,
            'id': image_id
        })

    def _serve_file(self, file_path, content_type):
        """Віддати файл з вказаним Content-Type."""
        real_path = Path(file_path).resolve()
        if not real_path.is_file():
            self._send_error(404, 'Файл не знайдено')
            return

        with open(real_path, 'rb') as f:
            data = f.read()

        self.send_response(200)
        self.send_header('Content-Type', f'{content_type}; charset=utf-8')
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _serve_static(self, file_path):
        """Віддати статичний файл з автоматичним визначенням MIME-типу."""
        real_path = Path(file_path).resolve()

        # Захист від path traversal
        allowed_dirs = [STATIC_DIR.resolve(), IMAGES_DIR.resolve()]
        if not any(
            real_path == allowed_dir or allowed_dir in real_path.parents
            for allowed_dir in allowed_dirs
        ):
            self._send_error(403, 'Доступ заборонено')
            return

        if not real_path.is_file():
            self._send_error(404, 'Файл не знайдено')
            return

        mime_type, _ = mimetypes.guess_type(str(real_path))
        if mime_type is None:
            mime_type = 'application/octet-stream'

        with open(real_path, 'rb') as f:
            data = f.read()

        self.send_response(200)
        self.send_header('Content-Type', mime_type)
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _send_json(self, status_code, data):
        """Відправити JSON відповідь."""
        response = json.dumps(data, ensure_ascii=False).encode('utf-8')
        self.send_response(status_code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(response)))
        self.end_headers()
        self.wfile.write(response)

    def _send_error(self, status_code, message):
        """Відправити помилку."""
        logger.warning(
            'Помилка: HTTP %d, path=%s, message=%s.',
            status_code,
            self.path,
            message
        )

        response = f'<html><body><h1>{status_code}</h1><p>{message}</p></body></html>'
        data = response.encode('utf-8')
        self.send_response(status_code)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, message_format, *args):
        """Перевизначення стандартного логування."""
        pass


def main():
    """Запуск сервера."""
    wait_for_db()
    init_db()

    # noinspection PyTypeChecker
    server = ThreadingHTTPServer((HOST, PORT), ImageServerHandler)
    is_shutting_down = False

    def shutdown_handler(signum, _frame):
        nonlocal is_shutting_down

        if is_shutting_down:
            return

        is_shutting_down = True
        logger.info(
            'Отримано сигнал зупинки сервера (%s=%d).',
            signal.Signals(signum).name,
            signum
        )

        threading.Thread(
            target=server.shutdown,
            name='server-shutdown',
            daemon=True,
        ).start()

    signal.signal(signal.SIGINT, shutdown_handler)
    signal.signal(signal.SIGTERM, shutdown_handler)

    logger.info(
        'Сервер запущено на host=%s, port=%d.',
        HOST,
        PORT
    )

    print(f'Сервер запущено на http://{HOST}:{PORT}')

    try:
        server.serve_forever()
    except Exception:
        logger.exception(
            'Критична помилка під час роботи сервера: host=%s, port=%d',
            HOST,
            PORT
        )

        raise
    finally:
        logger.info('Закриваємо HTTP сервер.')

        server.server_close()
        logger.info('Сервер зупинено.')
        print('\nСервер зупинено.')


if __name__ == '__main__':
    main()
