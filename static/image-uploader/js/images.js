import { confirmAndDeleteDbImage } from './image-actions.js';
import { bindNavigation } from './shared/navigation.js';
import { updateTabStyles } from './shared/tabs.js';
import { bindPageHotkeys } from './shared/keyboard.js';
import { createActionsButton } from './shared/buttons.js';
import { showToast } from './shared/toast.js';
import { createPaginatedImageListController } from './shared/paginated-image-list.js';
import { createImageHoverPreview } from './shared/image-preview.js';
import { formatFileSize } from './shared/formatters.js';
import {
    createListRow,
    createListCell,
} from './shared/list-view.js';


const IMAGES_COLUMNS = [
    { label: 'Name', className: 'file-col-name' },
    { label: 'Url', className: 'file-col-url' },
    { label: 'Size', className: 'file-col-size' },
    { label: 'Actions', className: 'file-col-actions' },
];


function buildImageRow(image, onDeleteSuccess) {
    const fileItem = createListRow();

    const nameCol = createListCell('file-col-name');

    const iconSpan = document.createElement('span');
    iconSpan.className = 'file-icon';

    const iconImg = document.createElement('img');
    iconImg.src = '/image-uploader/img/icon/Group.png';
    iconImg.alt = 'file icon';
    iconSpan.appendChild(iconImg);

    const nameSpan = document.createElement('span');
    nameSpan.className = 'file-name';
    nameSpan.textContent = image?.stored_name ?? image?.original_name ?? '—';

    nameCol.appendChild(iconSpan);
    nameCol.appendChild(nameSpan);

    const urlCol = createListCell('file-col-url');
    const urlLink = document.createElement('a');
    urlLink.href = image?.file_url ?? '#';
    urlLink.target = '_blank';
    urlLink.rel = 'noopener noreferrer';
    urlLink.textContent = image?.file_url ?? '—';
    urlCol.appendChild(urlLink);

    const sizeCol = createListCell('file-col-size');
    sizeCol.textContent = formatFileSize(image?.size_bytes ?? null);

    const actionsCol = createListCell('file-col-actions');
    const optionsBtn = createActionsButton({
        actions: [
            {
                label: 'Copy URL',
                onClick: async () => {
                    const fullUrl = image?.file_url
                        ? `${window.location.origin}${image.file_url}`
                        : '';

                    await navigator.clipboard.writeText(fullUrl);
                    showToast('URL copied', 'success');
                },
            },
            {
                label: 'Copy original name',
                onClick: async () => {
                    await navigator.clipboard.writeText(
                        image.original_name ?? image.stored_name ?? ''
                    );
                    showToast('Original name copied', 'success');
                },
            },
            {
                label: 'Copy stored name',
                onClick: async () => {
                    await navigator.clipboard.writeText(
                        image.stored_name ?? ''
                    );
                    showToast('Stored name copied', 'success');
                },
            },
            {
                label: 'Copy image',
                onClick: async () => {
                    try {
                        const response = await fetch(image.file_url);
                        const blob = await response.blob();

                        await navigator.clipboard.write([
                            new ClipboardItem({
                                [blob.type]: blob,
                            }),
                        ]);
                        showToast('Image copied', 'success');
                    } catch (e) {
                        showToast('Failed to copy image', 'error');
                    }
                },
            },
            {
                label: 'Delete image',
                danger: true,
                onClick: async () => {
                    if (!image?.id) {
                        return;
                    }

                    await confirmAndDeleteDbImage(image, onDeleteSuccess);
                },
            },
        ],
    });
    actionsCol.appendChild(optionsBtn);

    fileItem.appendChild(nameCol);
    fileItem.appendChild(urlCol);
    fileItem.appendChild(sizeCol);
    fileItem.appendChild(actionsCol);

    return fileItem;
}


document.addEventListener('DOMContentLoaded', () => {
    bindPageHotkeys({
        escapePath: '/upload',
        f5Path: '/upload',
    });

    const fileListWrapper = document.getElementById('file-list-wrapper');

    bindNavigation('upload-tab-btn', '/upload');
    bindNavigation('db-gallery-tab-btn', '/db-gallery');

    if (!fileListWrapper) {
        updateTabStyles();
        return;
    }

    const controller = createPaginatedImageListController({
        wrapper: fileListWrapper,
        columns: IMAGES_COLUMNS,
        bodyId: 'file-list',
        emptyMessage: 'No images uploaded yet.',
        errorMessage: 'Failed to load images.',
        buildRow: buildImageRow,
        updateTabStyles,
    });

    createImageHoverPreview({
        targetSelector: '.file-list-item .file-col-url a',
        getImageUrl: (target) =>
            target instanceof HTMLAnchorElement ? target.href : null,
    });

    void controller.load();
});