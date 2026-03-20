export function bindPageHotkeys(options = {}) {
    const {
        escapePath = '/',
        f5Path = escapePath,
    } = options;

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            event.preventDefault();
            window.location.href = escapePath;
            return;
        }

        if (event.key === 'F5') {
            event.preventDefault();
            window.location.href = f5Path;
        }
    });
}