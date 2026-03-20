export const IMAGE_ALLOWED_TYPES = ['image/jpg','image/jpeg', 'image/png', 'image/gif'];

export const IMAGE_ALLOWED_EXTENSIONS = IMAGE_ALLOWED_TYPES
    .map(type => type.split('/')[1])
    .join(', ');

export const MAX_UPLOAD_SIZE_MB = 5;

export const MAX_UPLOAD_SIZE_BYTES = MAX_UPLOAD_SIZE_MB * 1024 * 1024;