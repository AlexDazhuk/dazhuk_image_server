# Збірка залежностей
FROM python:3.13-slim AS builder

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /build

COPY requirements.txt .
RUN python -m pip install --upgrade pip && \
    python -m pip install --no-cache-dir --prefix=/install -r requirements.txt

# Фінальний образ
FROM python:3.13-slim

WORKDIR /app

# Копіюємо встановлені пакети
COPY --from=builder /install /usr/local

# Копіюємо код додатку
COPY app.py /app/
COPY config.py /app/
COPY logger_config.py /app/
COPY db /app/db
COPY repositories /app/repositories
COPY services /app/services
COPY static /app/static

# Створюємо директорії для даних
RUN mkdir -p /app/images /app/logs && \
    useradd --create-home --shell /usr/sbin/nologin appuser && \
    chown -R appuser:appuser /app

EXPOSE 8000

CMD ["python", "app.py"]
