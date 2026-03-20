from __future__ import annotations

import time
from datetime import datetime


def format_local_log_timestamp(timestamp: float) -> str:
    dt = datetime.fromtimestamp(timestamp).astimezone()
    s = dt.strftime('%Y-%m-%d %H:%M:%S %z')
    return f'{s[:-2]}:{s[-2:]}'


def generate_backup_timestamp() -> str:
    dt = datetime.fromtimestamp(time.time()).astimezone()
    return dt.strftime('%Y-%m-%d_%H%M%S')
