export function formatFileSize(sizeBytes) {
    if (typeof sizeBytes !== 'number' || Number.isNaN(sizeBytes)) {
        return '—';
    }

    if (sizeBytes < 1024) {
        return `${sizeBytes} B`;
    }

    if (sizeBytes < 1024 * 1024) {
        return `${(sizeBytes / 1024).toFixed(2)} KB`;
    }

    return `${(sizeBytes / (1024 * 1024)).toFixed(2)} MB`;
}


export function shortenUrlToFit(url, maxLength = 40) {
    if (!url) {
        return '';
    }

    if (url.length <= maxLength) {
        return url;
    }

    return `...${url.slice(-(maxLength - 3))}`;
}
