export function navigateTo(path) {
    if (!path) {
        return;
    }

    window.location.href = path;
}

export function bindNavigation(buttonId, path) {
    const button = document.getElementById(buttonId);
    if (!button) {
        return;
    }

    button.addEventListener('click', () => {
        navigateTo(path);
    });
}