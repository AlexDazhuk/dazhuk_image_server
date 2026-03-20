# dazhuk_image_server

Детальний README, зібраний **по фактичній структурі проєкту**.

---

## 1. Що це за проєкт

`dazhuk_image_server` — це веб‑додаток для завантаження, перегляду та видалення зображень.

Проєкт складається з таких частин:

- **Python HTTP backend** на `http.server`
- **PostgreSQL** для зберігання метаданих зображень
- **Nginx** як reverse proxy і віддача `/images/`
- **Frontend** на HTML/CSS/JavaScript
- **backup worker** для автоматичних резервних копій БД
- **ручні Python-скрипти** для backup і restore бази даних

Основний сценарій роботи:

1. користувач відкриває веб‑інтерфейс;
2. завантажує картинку;
3. backend перевіряє файл;
4. файл зберігається в папку `images/`;
5. метадані записуються в PostgreSQL;
6. frontend отримує список зображень через API;
7. при видаленні запис прибирається з БД, а файл видаляється з диска.

---

## 2. Технології

- **Python 3.13**
- **PostgreSQL 16**
- **Nginx Alpine**
- **Docker / Docker Compose**
- **Pillow** — перевірка, що файл є валідним зображенням
- **psycopg2-binary** — робота з PostgreSQL
- **python-dotenv** — підвантаження `.env`
- **colorlog** — кольорові логи

---

## 3. Архітектура проєкту

## 3.1. Загальна схема

```text
Browser
  -> Nginx (:8080)
      -> Python app (:8000)
          -> PostgreSQL (:5432)

Frontend upload/delete/list
  -> HTTP API backend
      -> repository layer
          -> PostgreSQL

Uploaded image files
  -> зберігаються на диску в папці images/

Automatic backups
  -> backup container
      -> pg_dump
      -> backups/
      -> logs/backup.log
```

---

## 3.2. Ролі контейнерів

### `app`
Основний Python‑додаток.

Відповідає за:

- віддачу HTML/JS/CSS;
- прийом upload;
- валідацію зображень;
- запис у БД;
- видалення зображень;
- API для списку зображень.

### `postgres`
База даних PostgreSQL.

Зберігає таблицю `images` з метаданими файлів.

### `backup`
Окремий контейнер, який циклічно виконує backup БД.

Відповідає за:

- автоматичний `pg_dump`;
- ротацію старих backup-файлів;
- cleanup за віком, кількістю і загальним розміром;
- логування у `/logs/backup.log`.

### `nginx`
Публічний вхід у систему.

Відповідає за:

- прийом трафіку на `:8080`;
- проксі на Python app;
- віддачу файлів із `/images/`.

---

## 4. Структура проєкту

```text
dazhuk_image_server/
├─ app.py
├─ config.py
├─ logger_config.py
├─ compose.yaml
├─ Dockerfile
├─ nginx.conf
├─ requirements.txt
├─ .env
├─ .env.example
├─ .gitignore
├─ db/
│  ├─ __init__.py
│  └─ connection.py
├─ repositories/
│  ├─ __init__.py
│  └─ image_repository.py
├─ services/
│  ├─ __init__.py
│  └─ upload_service.py
├─ utils/
│  ├─ __init__.py
│  └─ datetime_utils.py
├─ scripts/
│  ├─ __init__.py
│  ├─ backup_db.py
│  ├─ restore_db.py
│  └─ backup_loop.sh
├─ static/
│  ├─ home.html
│  ├─ favicon.ico
│  ├─ form/
│  │  ├─ upload.html
│  │  ├─ images.html
│  │  └─ db-gallery.html
│  └─ image-uploader/
│     ├─ css/
│     │  ├─ reset.css
│     │  ├─ base.css
│     │  ├─ components/
│     │  └─ pages/
│     ├─ img/
│     └─ js/
│        ├─ upload.js
│        ├─ images.js
│        ├─ db-gallery.js
│        ├─ home.js
│        ├─ image-actions.js
│        └─ shared/
├─ images/
│  └─ .gitkeep
├─ logs/
│  └─ .gitkeep
├─ backups/
│  └─ .gitkeep
└─ README.md
```

---

## 5. Детальний опис backend

## 5.1. `app.py`

Це головна точка входу в Python‑сервер.

Що робить файл:

- створює HTTP сервер `ThreadingHTTPServer`;
- чекає готовності БД через `wait_for_db()`;
- створює таблицю через `init_db()`;
- описує маршрути GET/POST/DELETE;
- віддає статичні файли;
- обробляє upload;
- обробляє видалення;
- пише логи;
- коректно завершує сервер по `SIGINT` і `SIGTERM`.

### Основні маршрути

#### HTML сторінки

- `/` -> `static/home.html`
- `/upload` -> `static/form/upload.html`
- `/images` -> `static/form/images.html`
- `/db-gallery` -> `static/form/db-gallery.html`

#### API

- `GET /api/images?page=1&limit=10`
- `POST /upload`
- `DELETE /api/images/<id>`

#### Статика

- `/image-uploader/...` -> frontend assets
- `/images/<stored_name>` -> фізичний файл зображення

---

## 5.2. Логіка upload у `app.py`

При `POST /upload` backend:

1. перевіряє `Content-Type`, що це `multipart/form-data`;
2. перевіряє `Content-Length`;
3. читає форму через `cgi.FieldStorage`;
4. бере файл з поля `file`;
5. передає його в `process_upload()`;
6. після збереження файлу створює запис у БД через `ImageRepository.create_image()`;
7. повертає JSON з результатом.

У відповіді повертаються:

- `id`
- `filename`
- `original_name`
- `url`
- `size_bytes`
- `created_at`

---

## 5.3. Видалення зображення

При `DELETE /api/images/<id>` backend:

1. перевіряє, що `id` є числом;
2. видаляє запис з БД через `ImageRepository.delete_by_id()`;
3. бере `file_path` із видаленого запису;
4. видаляє файл з диска через `Path.unlink()`;
5. повертає JSON `success: true`.

Тобто видалення реалізоване **і в БД, і на файловій системі**.

---

## 5.4. `config.py`

Файл конфігурації читає змінні з `.env`.

### Основні параметри

#### сервер
- `HOST`
- `PORT`

#### БД
- `DB_HOST`
- `DB_PORT`
- `DB_NAME`
- `DB_USER`
- `DB_PASSWORD`

#### backup
- `POSTGRES_CONTAINER`
- `BACKUPS_DIR`
- `BACKUP_ENABLED`
- `BACKUP_INTERVAL_MINUTES`
- `BACKUP_RETENTION_DAYS`
- `BACKUP_MAX_FILES`
- `BACKUP_MAX_TOTAL_SIZE_MB`

#### шляхи
- `IMAGES_DIR`
- `LOGS_DIR`
- `STATIC_DIR`

#### інше
- `TZ`
- `MAX_FILE_SIZE_MB = 5`
- `ALLOWED_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.gif'}`

### Важливо

`DB_PASSWORD` не має безпечного дефолта. Якщо його немає в `.env`, застосунок завершиться з помилкою.

---

## 5.5. `db/connection.py`

Файл інкапсулює доступ до PostgreSQL.

### Що тут є

- `get_connection()` — створення з'єднання через `psycopg2`
- `db_connection()` — context manager з `commit/rollback`
- `init_db()` — створення таблиці `images`
- `wait_for_db()` — цикл очікування, поки PostgreSQL стане доступним

### Таблиця `images`

```sql
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
```

---

## 5.6. `repositories/image_repository.py`

Це repository layer для таблиці `images`.

### Методи

- `create_image(...)` — створення запису
- `delete_by_id(image_id)` — видалення запису по id
- `count_images()` — кількість записів
- `list_images_paginated(limit, offset)` — список із пагінацією

Тобто `app.py` не працює з SQL напряму, а ходить через repository.

---

## 5.7. `services/upload_service.py`

Це сервісний шар для обробки upload.

### Відповідальність сервісу

- безпечне отримання імені файлу;
- перевірка extension;
- перевірка розміру файлу;
- перевірка валідності картинки через Pillow;
- генерація унікального імені через `uuid4().hex`;
- фізичне збереження файлу в `images/`.

### Основні функції

- `extract_safe_filename()`
- `extract_extension()`
- `validate_file_size()`
- `validate_image_content()`
- `generate_unique_filename()`
- `save_file()`
- `process_upload()`

### Важливий результат `process_upload()`

Повертає словник:

- `original_name`
- `stored_name`
- `extension`
- `file_size`
- `file_path`
- `url`

---

## 5.8. `logger_config.py`

Файл централізує логування.

### Особливості

- логер називається `image_server`;
- рівень логування: `INFO`;
- лог пишеться і в файл, і в консоль;
- використовується локальний часовий пояс через `format_local_log_timestamp()`;
- файл логів додатку: `logs/app.log`.

---

## 5.9. `utils/datetime_utils.py`

Містить допоміжні функції для часу:

- `format_local_log_timestamp(timestamp)` — форматування локального часу для логів;
- `generate_backup_timestamp()` — timestamp для імені backup-файлів.

---

## 6. Детальний опис frontend

Frontend повністю лежить у папці `static/`.

---

## 6.1. Сторінки

### `static/home.html`
Головна сторінка.

Містить:

- заголовок;
- hero-блок із картинками;
- кнопку переходу в галерею.

### `static/form/upload.html`
Сторінка завантаження файлів.

Містить:

- dropzone;
- вибір файлу;
- поле з URL останнього upload;
- кнопку `COPY`;
- вкладки переходу між сторінками.

### `static/form/images.html`
Сторінка галереї з таблицеподібним списком.

### `static/form/db-gallery.html`
Сторінка DB Gallery, що також працює через API списку зображень.

---

## 6.2. JS модулі

### Основні сторінки
- `home.js`
- `upload.js`
- `images.js`
- `db-gallery.js`
- `image-actions.js`

### Shared модулі
- `shared/navigation.js`
- `shared/tabs.js`
- `shared/keyboard.js`
- `shared/toast.js`
- `shared/constants.js`
- `shared/formatters.js`
- `shared/list-view.js`
- `shared/pagination.js`
- `shared/paginated-image-list.js`
- `shared/buttons.js`
- `shared/confirm.js`
- `shared/image-preview.js`

---

## 6.3. Як працює frontend upload

Файл `upload.js`:

- вішає обробники на file input і drag & drop;
- перевіряє тип і розмір файлу на клієнті;
- робить `fetch('/upload', { method: 'POST' })`;
- після успіху показує URL завантаженого файлу;
- дозволяє скопіювати повний URL у буфер обміну;
- показує toast-повідомлення.

Дозволені типи на frontend (визначаються в constants.js):

- `image/jpg`
- `image/jpeg`
- `image/png`
- `image/gif`

Ліміт: **5 MB** - визначається в constants.js.

---

## 6.4. Як працює список зображень

Для сторінок `images` і `db-gallery` використовується API:

```http
GET /api/images?page=1&limit=10
```

Backend повертає:

```json
{
  "items": [...],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total_items": 0,
    "total_pages": 1,
    "has_prev": false,
    "has_next": false,
    "allowed_limits": [10, 25, 50, 100]
  }
}
```

На frontend для цього використовується модуль `shared/paginated-image-list.js` разом з:

- `list-view.js`
- `pagination.js`
- `buttons.js`

---

## 6.5. Дії над зображенням

У списках реалізовані дії типу:

- копіювання URL;
- копіювання storage імені;
- копіювання original імені;
- копіювання;
- перегляд;
- видалення.

Для confirm-вікна використовується `shared/confirm.js`.

---

## 7. Docker-архітектура

## 7.1. `compose.yaml`

Файл піднімає 4 сервіси:

- `app`
- `postgres`
- `backup`
- `nginx`

### `app`

- build з локального `Dockerfile`
- контейнер: `image-server-app`
- порт: `8000:8000`
- монтуються код, статика, images, logs
- читає `.env`
- залежить від `postgres`

### `postgres`

- образ: `postgres:16-alpine`
- контейнер: `image-server-postgres`
- volume: `postgres_data`
- healthcheck через `pg_isready`

### `backup`

- образ: `postgres:16-alpine`
- контейнер: `image-server-backup`
- запускає `/scripts/backup_loop.sh`
- монтує:
  - `./backups:/backups`
  - `./logs:/logs`
  - `./scripts:/scripts:ro`

### `nginx`

- образ: `nginx:alpine`
- контейнер: `image-server-nginx`
- порт: `8080:80`
- монтує `nginx.conf`
- монтує `./images:/images:ro`

---

## 7.2. `Dockerfile`

Образ двоетапний:

### stage 1 — builder
- базується на `python:3.13-slim`
- встановлює залежності з `requirements.txt`

### stage 2 — final
- базується на `python:3.13-slim`
- копіює Python-залежності з builder stage
- копіює код застосунку
- створює `/app/images` і `/app/logs`
- запускає `python app.py`

---

## 7.3. `nginx.conf`

Nginx налаштований так:

- `client_max_body_size 5M` — ліміт на upload;
- `/images/` віддається напряму через `alias /images/`;
- все інше проксіюється в `http://app:8000`.

---

## 8. Файл `.env`

Робочий `.env` створюється на основі `.env.example`.

Приклад:

```env
HOST=0.0.0.0
PORT=8000

DB_HOST=postgres
DB_PORT=5432
DB_NAME=image_server
DB_USER=image_user
DB_PASSWORD=change_me

POSTGRES_CONTAINER=image-server-postgres
BACKUPS_DIR=backups

BACKUP_ENABLED=true
BACKUP_INTERVAL_MINUTES=720
BACKUP_RETENTION_DAYS=7
BACKUP_MAX_FILES=50
BACKUP_MAX_TOTAL_SIZE_MB=1024

IMAGES_DIR=/app/images
LOGS_DIR=/app/logs
STATIC_DIR=/app/static

TZ=Europe/Kyiv
```

---

## 9. Як скачати проєкт з Git репозиторію

## 9.1. Клонування

```bash
git clone <URL_ВАШОГО_РЕПОЗИТОРІЮ>
cd dazhuk_image_server
```

Якщо репозиторій уже є локально, цей крок пропускається.

---

## 9.2. Створити `.env`

```bash
cp .env.example .env
```

У Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Після цього відредагувати `.env` і задати реальний пароль у `DB_PASSWORD`.

---

## 10. Як запустити проєкт через Docker Compose

## 10.1. Перший запуск

```bash
docker compose up -d --build
```

Або без фону:

```bash
docker compose up --build
```

Після успішного запуску сторінки доступні тут:

- `http://localhost:8080/`
- `http://localhost:8080/upload`
- `http://localhost:8080/images`
- `http://localhost:8080/db-gallery`

---

## 10.2. Перевірити статус контейнерів

```bash
docker compose ps
```

---

## 10.3. Зупинка контейнерів

```bash
docker compose down
```

---

## 10.4. Перезапуск після змін коду

```bash
docker compose up -d --build
```

Це актуальний робочий сценарій для цього проєкту.

---

## 11. Логи

## 11.1. Логи контейнерів

### app
```bash
docker logs -f image-server-app
```

### postgres
```bash
docker logs -f image-server-postgres
```

### backup
```bash
docker logs -f image-server-backup
```

### nginx
```bash
docker logs -f image-server-nginx
```

---

## 11.2. Локальні файли логів у проєкті

### лог додатку
```text
logs/app.log
```

### лог автоматичних backup
```text
logs/backup.log
```

### лог ручного backup
```text
logs/backup_manual.log
```

### лог ручного restore
```text
logs/restore_manual.log
```

---

## 12. Ручний backup БД

## 12.1. Що робить скрипт `scripts/backup_db.py`

Скрипт:

1. читає налаштування з `.env`;
2. створює папку backup, якщо її ще немає;
3. формує ім'я файлу виду `backup_YYYY-MM-DD_HHMMSS.sql`;
4. запускає `docker exec -t <POSTGRES_CONTAINER> pg_dump ...`;
5. зберігає SQL dump у папку `backups/`;
6. пише лог у `logs/backup_manual.log`.

---

## 12.2. Команда ручного backup

### Linux / macOS
```bash
python -m scripts.backup_db
```

### Windows PowerShell
```powershell
python -m scripts.backup_db
```

Після успіху новий файл з'явиться в папці:

```text
backups/
```

---

## 12.3. Важливі умови для ручного backup

Перед запуском мають виконуватись умови:

- запущений Docker;
- запущений контейнер PostgreSQL;
- у `.env` правильний `POSTGRES_CONTAINER`;
- у `.env` правильні `DB_NAME` і `DB_USER`.

---

## 13. Ручне відновлення БД

## 13.1. Що робить `scripts/restore_db.py`

Скрипт:

1. приймає шлях до `.sql` backup-файлу;
2. просить підтвердження;
3. очищає поточну БД командою:

```sql
DROP SCHEMA public CASCADE; CREATE SCHEMA public;
```

4. заливає SQL dump назад у PostgreSQL через `psql`;
5. пише лог у `logs/restore_manual.log`.

### Дуже важливо

Restore **перезаписує поточну базу**.

---

## 13.2. Команда restore

### Linux / macOS
```bash
python -m scripts.restore_db ./backups/backup_YYYY-MM-DD_HHMMSS.sql
```

### Windows PowerShell
```powershell
python -m scripts.restore_db .\backups\backup_YYYY-MM-DD_HHMMSS.sql
```

Після запуску скрипт попросить ввести:

```text
yes
```

тільки після цього почнеться restore.

---

## 14. Автоматичний backup

## 14.1. Як працює `scripts/backup_loop.sh`

Скрипт запускається всередині контейнера `backup`.

При старті він:

1. читає змінні середовища;
2. створює `/backups` і `/logs`;
3. одразу виконує backup;
4. виконує cleanup старих backup-файлів;
5. далі засинає на `BACKUP_INTERVAL_MINUTES * 60` секунд;
6. знову робить backup і cleanup по колу.

---

## 14.2. Cleanup політики

Автоматичне очищення працює за трьома правилами:

### за віком
Видаляються backup-файли старші за `BACKUP_RETENTION_DAYS`.

### за кількістю
Якщо backup-файлів більше ніж `BACKUP_MAX_FILES`, найстаріші видаляються.

### за сумарним розміром
Якщо загальний розмір перевищує `BACKUP_MAX_TOTAL_SIZE_MB`, найстаріші файли видаляються, поки розмір не стане в межах ліміту.

---

## 14.3. Як увімкнути/вимкнути автоматичний backup

У `.env`:

```env
BACKUP_ENABLED=true
```

або

```env
BACKUP_ENABLED=false
```

Якщо `false`, backup worker не виконує backup і просто залишається запущеним.

---

## 15. Корисні команди Docker

## 15.1. Підняти проєкт

```bash
docker compose up -d --build
```

## 15.2. Зупинити проєкт

```bash
docker compose down
```

## 15.3. Перезапустити проєкт

```bash
docker compose restart
```

## 15.4. Подивитися статус

```bash
docker compose ps
```

## 15.5. Перезапустити один контейнер

```bash
docker restart image-server-app
```

або

```bash
docker restart image-server-backup
```

## 15.6. Відкрити shell у PostgreSQL контейнері

```bash
docker exec -it image-server-postgres sh
```

## 15.7. Підключитися до PostgreSQL вручну

```bash
docker exec -it image-server-postgres psql -U image_user -d image_server
```

---

## 16. Робочі URL проєкту

### головна
```text
http://localhost:8080/
```

### upload
```text
http://localhost:8080/upload
```

### images
```text
http://localhost:8080/images
```

### db gallery
```text
http://localhost:8080/db-gallery
```

### api список
```text
http://localhost:8080/api/images?page=1&limit=10
```

---

## 17. Потік даних у проєкті

## 17.1. Upload

```text
Browser
  -> POST /upload
    -> app.py
      -> services/upload_service.py
        -> save file in images/
      -> repositories/image_repository.py
        -> INSERT INTO images
      -> JSON response
```

## 17.2. Список зображень

```text
Browser
  -> GET /api/images?page=...&limit=...
    -> app.py
      -> ImageRepository.count_images()
      -> ImageRepository.list_images_paginated()
      -> JSON response
```

## 17.3. Видалення

```text
Browser
  -> DELETE /api/images/<id>
    -> app.py
      -> ImageRepository.delete_by_id(id)
      -> unlink(file_path)
      -> JSON response
```

## 17.4. Backup

```text
backup_loop.sh
  -> pg_dump
    -> backups/backup_*.sql
    -> logs/backup.log
```

---

## 18. Що потрібно для розробки

Мінімально:

- Docker Desktop / Docker Engine
- Git
- Python 3.13
- доступ до термінала або PowerShell

---

## 19. Що важливо знати перед роботою з проєктом

1. Зображення зберігаються **не в БД**, а на диску в папці `images/`.
2. У БД лежать **метадані**, а не binary-файл.
3. Nginx віддає `/images/` напряму.
4. Backup і restore стосуються **БД**, а не папки `images/`.
5. Якщо потрібно повне резервування проєкту, треба зберігати окремо:
   - SQL backup з `backups/`
   - папку `images/`
   - за потреби `.env`
6. Restore БД не повертає фізичні файли з `images/`, якщо вони втрачені.

---

## 20. Рекомендований базовий сценарій роботи

### Перший запуск

```bash
git clone <URL_ВАШОГО_РЕПОЗИТОРІЮ>
cd dazhuk_image_server
cp .env.example .env
docker compose up -d --build
```

### Створити ручний backup

```bash
python -m scripts.backup_db
```

### Відновити БД з backup

```bash
python -m scripts.restore_db ./backups/backup_YYYY-MM-DD_HHMMSS.sql
```

### Переглянути логи backup worker

```bash
docker logs -f image-server-backup
```

### Переглянути логи додатку

```bash
docker logs -f image-server-app
```

---

## 21. Короткий технічний висновок по архіву

По фактичній структурі архіву проєкт побудований як невеликий monolith з чітким розділенням на шари:

- **entrypoint / routing** -> `app.py`
- **config** -> `config.py`
- **database layer** -> `db/`
- **repository layer** -> `repositories/`
- **service layer** -> `services/`
- **utility layer** -> `utils/`
- **manual ops scripts** -> `scripts/`
- **frontend assets** -> `static/`
- **runtime data** -> `images/`, `logs/`, `backups/`
