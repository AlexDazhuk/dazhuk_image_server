#!/bin/sh
set -eu

BACKUP_ENABLED="${BACKUP_ENABLED:-true}"
BACKUP_INTERVAL_MINUTES="${BACKUP_INTERVAL_MINUTES:-60}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-7}"
BACKUP_MAX_FILES="${BACKUP_MAX_FILES:-50}"
BACKUP_MAX_TOTAL_SIZE_MB="${BACKUP_MAX_TOTAL_SIZE_MB:-1024}"

DB_HOST="${DB_HOST:-postgres}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:?DB_NAME is required}"
DB_USER="${DB_USER:?DB_USER is required}"
DB_PASSWORD="${DB_PASSWORD:?DB_PASSWORD is required}"

BACKUPS_DIR="/backups"

mkdir -p "${BACKUPS_DIR}"
mkdir -p /logs

log() {
  offset="$(date '+%z')"
  offset_formatted="$(printf '%s:%s' "${offset%??}" "${offset#???}")"

  msg="[$(date '+%Y-%m-%d %H:%M:%S') ${offset_formatted}] $1"
  echo "$msg"

  if [ -f /logs/backup.log ]; then
    size=$(stat -c %s /logs/backup.log 2>/dev/null || stat -f %z /logs/backup.log)
    if [ "$size" -gt 10485760 ]; then
      mv /logs/backup.log /logs/backup.log.1
    fi
  fi

  echo "$msg" >> /logs/backup.log
}

trap 'log "[INFO] Backup worker зупинено."; exit 0' TERM INT

create_backup() {
  timestamp="$(date '+%Y-%m-%d_%H%M%S')"
  backup_file="${BACKUPS_DIR}/backup_${timestamp}.sql"

  log "[INFO] Почато backup БД: db=${DB_NAME}."

  start_ts="$(date +%s)"

  if ! PGPASSWORD="${DB_PASSWORD}" pg_dump \
    -h "${DB_HOST}" \
    -p "${DB_PORT}" \
    -U "${DB_USER}" \
    -d "${DB_NAME}" \
    > "${backup_file}"; then

    log "[ERROR] Помилка backup БД: db=${DB_NAME}"
    rm -f "${backup_file}"
    return 1
  fi

  end_ts="$(date +%s)"
  duration=$((end_ts - start_ts))

  log "[INFO] Завершено backup БД: db=${DB_NAME}, file=$(basename "${backup_file}"), duration=${duration} сек."
}

cleanup_backups() {
  now_ts="$(date +%s)"

  log "[INFO] Почато cleanup backup."

  if ! ls "${BACKUPS_DIR}"/backup_*.sql >/dev/null 2>&1; then
    return
  fi

  find "${BACKUPS_DIR}" -maxdepth 1 -type f -name 'backup_*.sql' | while read -r file; do
    file_ts="$(stat -c %Y "$file" 2>/dev/null || stat -f %m "$file")"
    age_days=$(( (now_ts - file_ts) / 86400 ))

    if [ "${age_days}" -gt "${BACKUP_RETENTION_DAYS}" ]; then
      if rm -f "$file"; then
        log "[INFO] Видалено старий backup (age): file=$(basename "$file")"
      else
        log "[ERROR] Не вдалося видалити backup: file=$(basename "$file")"
      fi
    fi
  done

  count="$(find "${BACKUPS_DIR}" -maxdepth 1 -type f -name 'backup_*.sql' | wc -l | tr -d ' ')"
  if [ "${BACKUP_MAX_FILES}" -gt 0 ] && [ "${count}" -gt "${BACKUP_MAX_FILES}" ]; then
    ls -1t "${BACKUPS_DIR}"/backup_*.sql 2>/dev/null | tail -n +"$((BACKUP_MAX_FILES + 1))" \
      | while read -r old_file; do
          if rm -f "$old_file"; then
            log "[INFO] Видалено старий backup (count): file=$(basename "$old_file")"
          else
            log "[ERROR] Не вдалося видалити backup: file=$(basename "$old_file")"
          fi
        done
  fi

  max_bytes=$((BACKUP_MAX_TOTAL_SIZE_MB * 1024 * 1024))
  if [ "${max_bytes}" -gt 0 ]; then
    total_size=0

    for file in "${BACKUPS_DIR}"/backup_*.sql; do
      [ -f "$file" ] || continue
      size=$(stat -c %s "$file" 2>/dev/null || stat -f %z "$file")
      total_size=$((total_size + size))
    done

    if [ "${total_size}" -gt "${max_bytes}" ]; then
      for file in $(ls -1tr "${BACKUPS_DIR}"/backup_*.sql 2>/dev/null); do
        [ -f "$file" ] || continue

        if [ "${total_size}" -le "${max_bytes}" ]; then
          break
        fi

        size=$(stat -c %s "$file" 2>/dev/null || stat -f %z "$file")

        if rm -f "$file"; then
          log "[INFO] Видалено старий backup (size): file=$(basename "$file")"
          total_size=$((total_size - size))
        else
          log "[ERROR] Не вдалося видалити backup: file=$(basename "$file")"
        fi
      done
    fi
  fi

  log "[INFO] Завершено cleanup backup."
}

if [ "${BACKUP_ENABLED}" != "true" ]; then
  log "[INFO] Автоматичні backup вимкнені."
  tail -f /dev/null
fi

log "[INFO] Backup worker запущено: interval_minutes=${BACKUP_INTERVAL_MINUTES}, retention_days=${BACKUP_RETENTION_DAYS}, max_files=${BACKUP_MAX_FILES}, max_total_size_mb=${BACKUP_MAX_TOTAL_SIZE_MB}."

create_backup
cleanup_backups

while true; do
  sleep "$((BACKUP_INTERVAL_MINUTES * 60))"
  create_backup
  cleanup_backups
done