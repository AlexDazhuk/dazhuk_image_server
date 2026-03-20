/**
 * ============================================================================
 * Image Preview - Premium Hover Component
 * ============================================================================
 * Призначення:
 * - показує preview картинки при наведенні;
 * - працює із затримкою hover, preload та плавною анімацією;
 * - не мерехтить при дрібних рухах миші;
 * - не вилазить за межі viewport.
 * ============================================================================
 */

/**
 * @typedef {Object} ImagePreviewOptions
 * @property {string} targetSelector
 * @property {(target: HTMLElement) => string | null | undefined} getImageUrl
 * @property {number} [showDelay]
 * @property {number} [offset]
 * @property {number} [viewportPadding]
 */

/**
 * @param {ImagePreviewOptions} options
 * @returns {{ destroy: () => void }}
 */
export function createImageHoverPreview(options) {
    const {
        targetSelector,
        getImageUrl,
        showDelay = 140,
        offset = 18,
        viewportPadding = 12,
    } = options;

    /** @type {HTMLDivElement} */
    const root = document.createElement('div');
    root.className = 'image-preview';

    /** @type {HTMLDivElement} */
    const card = document.createElement('div');
    card.className = 'image-preview__card';

    /** @type {HTMLImageElement} */
    const image = document.createElement('img');
    image.className = 'image-preview__image is-hidden';
    image.alt = 'Image preview';

    card.appendChild(image);
    root.appendChild(card);
    document.body.appendChild(root);

    /** @type {HTMLElement | null} */
    let activeTarget = null;

    /** @type {string | null} */
    let activeUrl = null;

    /** @type {number | null} */
    let showTimer = null;

    let lastMouseX = 0;
    let lastMouseY = 0;
    let isVisible = false;

    /**
     * Simple in-memory preload cache.
     * key: image url, value: preload promise
     * @type {Map<string, Promise<void>>}
     */
    const preloadCache = new Map();

    /**
     * @param {string} url
     * @returns {Promise<void>}
     */
    function preloadImage(url) {
        if (preloadCache.has(url)) {
            return preloadCache.get(url);
        }

        const promise = new Promise((resolve, reject) => {
            const preloadImg = new Image();

            preloadImg.onload = () => resolve();
            preloadImg.onerror = () =>
                reject(new Error(`Failed to preload image: ${url}`));

            preloadImg.src = url;
        });

        preloadCache.set(url, promise);
        return promise;
    }

    function clearShowTimer() {
        if (showTimer !== null) {
            window.clearTimeout(showTimer);
            showTimer = null;
        }
    }

    function hidePreview() {
        clearShowTimer();
        activeTarget = null;
        activeUrl = null;
        isVisible = false;
        root.classList.remove('is-visible');
    }

    function updatePosition() {
        if (!isVisible) {
            return;
        }

        const rootRect = root.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        let left = lastMouseX + offset;
        let top = lastMouseY + offset;

        if (left + rootRect.width + viewportPadding > viewportWidth) {
            left = lastMouseX - rootRect.width - offset;
        }

        if (top + rootRect.height + viewportPadding > viewportHeight) {
            top = lastMouseY - rootRect.height - offset;
        }

        left = Math.max(viewportPadding, left);
        top = Math.max(viewportPadding, top);

        root.style.left = `${left}px`;
        root.style.top = `${top}px`;
    }

    /**
     * @param {string} url
     */
    async function showPreview(url) {
        try {
            card.classList.add('is-loading');
            image.classList.add('is-hidden');

            await preloadImage(url);

            if (!activeUrl || activeUrl !== url) {
                return;
            }

            image.src = url;
            image.classList.remove('is-hidden');
            card.classList.remove('is-loading');

            isVisible = true;
            root.classList.add('is-visible');
            updatePosition();
        } catch {
            hidePreview();
        }
    }

    /**
     * @param {MouseEvent} event
     */
    function onMouseOver(event) {
        const target = event.target instanceof Element
            ? event.target.closest(targetSelector)
            : null;

        if (!(target instanceof HTMLElement)) {
            return;
        }

        const imageUrl = getImageUrl(target);

        if (!imageUrl) {
            return;
        }

        activeTarget = target;
        activeUrl = imageUrl;
        lastMouseX = event.clientX;
        lastMouseY = event.clientY;

        clearShowTimer();
        showTimer = window.setTimeout(() => {
            void showPreview(imageUrl);
        }, showDelay);
    }

    /**
     * @param {MouseEvent} event
     */
    function onMouseMove(event) {
        lastMouseX = event.clientX;
        lastMouseY = event.clientY;
        updatePosition();
    }

    /**
     * @param {MouseEvent} event
     */
    function onMouseOut(event) {
        const fromTarget = event.target instanceof Element
            ? event.target.closest(targetSelector)
            : null;

        if (!fromTarget) {
            return;
        }

        const related = event.relatedTarget instanceof Element
            ? event.relatedTarget.closest(targetSelector)
            : null;

        if (related && related === fromTarget) {
            return;
        }

        hidePreview();
    }

    function onScrollOrResize() {
        updatePosition();
    }

    document.addEventListener('mouseover', onMouseOver);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseout', onMouseOut);
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);

    return {
        destroy() {
            clearShowTimer();
            document.removeEventListener('mouseover', onMouseOver);
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseout', onMouseOut);
            window.removeEventListener('scroll', onScrollOrResize, true);
            window.removeEventListener('resize', onScrollOrResize);
            root.remove();
        },
    };
}