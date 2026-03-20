let activeToastContainer = null;

function getToastContainer() {
    if (activeToastContainer) {
        return activeToastContainer;
    }

    const container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);

    activeToastContainer = container;
    return container;
}


export function showToast(message, type = 'info', duration = 2500) {
    const container = getToastContainer();

    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    toast.textContent = message;

    container.appendChild(toast);

    requestAnimationFrame(() => {
        toast.classList.add('is-visible');
    });

    const hide = () => {
        toast.classList.remove('is-visible');

        setTimeout(() => {
            toast.remove();

            if (container.childElementCount === 0) {
                container.remove();
                activeToastContainer = null;
            }
        }, 220);
    };

    setTimeout(hide, duration);

    return hide;
}