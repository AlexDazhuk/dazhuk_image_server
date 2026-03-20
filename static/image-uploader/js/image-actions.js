import { showToast } from './shared/toast.js';
import { showConfirmModal } from './shared/confirm.js';


export async function deleteDbImageById(imageId) {
    const response = await fetch(`/api/images/${imageId}`, {
        method: 'DELETE',
    });

    if (!response.ok) {
        let errorMessage = 'Не вдалося видалити зображення';

        try {
            const errorData = await response.json();
            if (errorData && errorData.error) {
                errorMessage = errorData.error;
            }
        } catch (_) {
            // ignore
        }

        throw new Error(errorMessage);
    }
}


export function formatDbGalleryDateTime(value) {
    if (!value) {
        return '—';
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return value;
    }

    const userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    const datePart = date.toLocaleDateString('uk-UA', {
        timeZone: userTimeZone,
    });

    const timePart = date.toLocaleTimeString('uk-UA', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZone: userTimeZone,
    });

    return `${datePart}\n${timePart}`;
}


export async function confirmAndDeleteDbImage(image, onSuccess) {
    if (!image || typeof image !== 'object' || !image.id) {
        showToast('Invalid image id', 'error');
        return;
    }

    const confirmed = await showConfirmModal({
        title: 'Delete this image?',
        message: image.stored_name,
        description: 'This action cannot be undone.',
        confirmText: 'Delete',
    });

    if (!confirmed) return;

    try {
        await deleteDbImageById(image.id);
        showToast('Image deleted successfully', 'success');

        if (typeof onSuccess === 'function') {
            await onSuccess();
        }
    } catch (error) {
        showToast(error.message || 'Failed to delete image', 'error');
    }
}
