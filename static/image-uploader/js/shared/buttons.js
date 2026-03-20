let activeActionsMenu = null;
let activeActionsButton = null;
let activeOutsideClickHandler = null;
let activeScrollHandler = null;
let activeResizeHandler = null;


function closeActiveActionsMenu() {
    if (activeActionsMenu) {
        activeActionsMenu.remove();
        activeActionsMenu = null;
    }

    if (activeActionsButton) {
        activeActionsButton.classList.remove('is-open');
        activeActionsButton = null;
    }

    if (activeOutsideClickHandler) {
        document.removeEventListener('click', activeOutsideClickHandler);
        activeOutsideClickHandler = null;
    }

    if (activeScrollHandler) {
        window.removeEventListener('scroll', activeScrollHandler, true);
        activeScrollHandler = null;
    }

    if (activeResizeHandler) {
        window.removeEventListener('resize', activeResizeHandler);
        activeResizeHandler = null;
    }
}


export function createDeleteButton({
    onClick,
    iconSrc = '/image-uploader/img/icon/delete.png',
    iconAlt = 'delete icon',
    title = 'Delete',
} = {}) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'delete-btn';
    button.title = title;
    button.setAttribute('aria-label', title);

    const image = document.createElement('img');
    image.className = 'delete-img';
    image.src = iconSrc;
    image.alt = iconAlt;

    button.appendChild(image);

    if (typeof onClick === 'function') {
        button.addEventListener('click', onClick);
    }

    return button;
}


export function createActionsButton({
    title = 'Actions',
    actions = [],
} = {}) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'actions-btn';
    button.title = title;
    button.setAttribute('aria-label', title);

    const dots = document.createElement('span');
    dots.className = 'actions-btn__dots';
    dots.textContent = '⋯';

    button.appendChild(dots);

    button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();

        if (activeActionsButton === button) {
            closeActiveActionsMenu();
            return;
        }

        closeActiveActionsMenu();

        const menu = document.createElement('div');
        menu.className = 'actions-menu';

        actions.forEach((action) => {
            const item = document.createElement('button');
            item.type = 'button';
            item.className = `actions-item${action?.danger ? ' actions-item--danger' : ''}`;
            item.textContent = action?.label ?? 'Action';

            item.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                closeActiveActionsMenu();

                if (typeof action?.onClick === 'function') {
                    await action.onClick();
                }
            });

            menu.appendChild(item);
        });

        document.body.appendChild(menu);

        const buttonRect = button.getBoundingClientRect();
        const menuRect = menu.getBoundingClientRect();

        let top = buttonRect.bottom + 8;
        let left = buttonRect.right - menuRect.width;

        const viewportPadding = 8;

        if (left < viewportPadding) {
            left = viewportPadding;
        }

        if (left + menuRect.width > window.innerWidth - viewportPadding) {
            left = window.innerWidth - menuRect.width - viewportPadding;
        }

        if (top + menuRect.height > window.innerHeight - viewportPadding) {
            top = buttonRect.top - menuRect.height - 8;
        }

        if (top < viewportPadding) {
            top = viewportPadding;
        }

        menu.style.position = 'fixed';
        menu.style.top = `${top}px`;
        menu.style.left = `${left}px`;

        button.classList.add('is-open');

        activeActionsMenu = menu;
        activeActionsButton = button;

        activeOutsideClickHandler = (e) => {
            if (!menu.contains(e.target) && e.target !== button && !button.contains(e.target)) {
                closeActiveActionsMenu();
            }
        };

        activeScrollHandler = () => {
            closeActiveActionsMenu();
        };

        activeResizeHandler = () => {
            closeActiveActionsMenu();
        };

        setTimeout(() => {
            if (activeOutsideClickHandler) {
                document.addEventListener('click', activeOutsideClickHandler);
            }

            if (activeScrollHandler) {
                window.addEventListener('scroll', activeScrollHandler, true);
            }

            if (activeResizeHandler) {
                window.addEventListener('resize', activeResizeHandler);
            }
        }, 0);
    });

    return button;
}