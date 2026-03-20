import { bindNavigation } from './shared/navigation.js';
import { updateTabStyles } from './shared/tabs.js';
import { bindPageHotkeys } from './shared/keyboard.js';
import { formatFileSize } from './shared/formatters.js';
import { createDeleteButton } from './shared/buttons.js';
import { confirmAndDeleteDbImage } from './image-actions.js';
import { formatDbGalleryDateTime } from './image-actions.js';
import { createPaginatedImageListController } from './shared/paginated-image-list.js';
import { createImageHoverPreview } from './shared/image-preview.js';
import {
    createListRow,
    createListCell,
} from './shared/list-view.js';


const DB_GALLERY_COLUMNS = [
    { label: 'Stored name', className: 'file-col-stored-name' },
    { label: 'Original name', className: 'file-col-original-name' },
    { label: 'Size', className: 'file-col-size' },
    { label: 'Created at', className: 'file-col-created-at' },
    { label: 'Extension', className: 'file-col-extension' },
    { label: 'Actions', className: 'file-col-actions' },
];


/**
 * @typedef {Object} DbGalleryImage
 * @property {number | null} id
 * @property {string | null} file_url
 * @property {string | null} stored_name
 * @property {string | null} original_name
 * @property {number | null} size_bytes
 * @property {string | null} created_at
 * @property {string | null} extension
 */
function buildDbGalleryRow(image, onDeleteSuccess) {
    const row = createListRow();

    const storedNameCell = createListCell('file-col-stored-name');
    const storedNameLink = document.createElement('a');
    storedNameLink.href = image?.file_url ?? '#';
    storedNameLink.textContent = image?.stored_name ?? '—';
    storedNameLink.target = '_blank';
    storedNameLink.rel = 'noopener noreferrer';
    storedNameCell.appendChild(storedNameLink);

    const originalNameCell = createListCell('file-col-original-name');
    originalNameCell.textContent = image?.original_name ?? '—';

    const sizeCell = createListCell('file-col-size');
    sizeCell.textContent = formatFileSize(image?.size_bytes ?? null);

    const createdAtCell = createListCell('file-col-created-at');
    createdAtCell.textContent = formatDbGalleryDateTime(image?.created_at ?? null);

    const extensionCell = createListCell('file-col-extension');
    extensionCell.textContent = image?.extension ?? '—';

    const actionsCell = createListCell('file-col-actions');
    const deleteButton = createDeleteButton({
        onClick: async () => {
            if (!image?.id) {
                return;
            }

            await confirmAndDeleteDbImage(image, onDeleteSuccess);
        },
    });

    actionsCell.appendChild(deleteButton);

    row.appendChild(storedNameCell);
    row.appendChild(originalNameCell);
    row.appendChild(sizeCell);
    row.appendChild(createdAtCell);
    row.appendChild(extensionCell);
    row.appendChild(actionsCell);

    return row;
}

document.addEventListener('DOMContentLoaded', () => {
    bindPageHotkeys({
        escapePath: '/upload',
        f5Path: '/upload',
    });

    initializeDbGallery();
});

function initializeDbGallery() {
    bindNavigation('upload-tab-btn', '/upload');
    bindNavigation('images-tab-btn', '/images');

    const wrapper = document.getElementById('file-list-wrapper');

    const controller = createPaginatedImageListController({
        wrapper,
        columns: DB_GALLERY_COLUMNS,
        bodyId: 'db-gallery-list',
        emptyMessage: 'No images in database.',
        errorMessage: 'Failed to load DB gallery.',
        buildRow: buildDbGalleryRow,
        updateTabStyles,
    });

    createImageHoverPreview({
        targetSelector: '.file-list-item .file-col-stored-name a',
        getImageUrl: (target) =>
            target instanceof HTMLAnchorElement ? target.href : null,
    });

    updateTabStyles();
    void controller.load();
}
