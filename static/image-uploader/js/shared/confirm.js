export function showConfirmModal({
    title = 'Confirm',
    message = '',
    description = '',
    confirmText = 'OK',
}) {
    return new Promise((resolve) => {
        const modal = document.getElementById('confirm-modal');

        const titleEl = modal.querySelector('.confirm-modal__title');
        const filenameEl = modal.querySelector('.confirm-modal__text:not(.confirm-modal__text--secondary)');
        const descriptionEl = modal.querySelector('.confirm-modal__text--secondary');
        const confirmBtn = modal.querySelector('.confirm-modal__btn--danger');
        const cancelBtn = modal.querySelector('.confirm-modal__btn--cancel');

        titleEl.textContent = title;

        if (filenameEl) {
            filenameEl.textContent = message;
        }

        if (descriptionEl) {
            descriptionEl.textContent = description;
        }

        confirmBtn.textContent = confirmText;

        modal.classList.remove('hidden');

        const cleanup = () => {
            modal.classList.add('hidden');
            confirmBtn.onclick = null;
            cancelBtn.onclick = null;
        };

        confirmBtn.onclick = () => {
            cleanup();
            resolve(true);
        };

        cancelBtn.onclick = () => {
            cleanup();
            resolve(false);
        };
    });
}
