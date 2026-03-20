import { renderPagination } from './pagination.js';
import {
    mountList,
    createListMessage,
} from './list-view.js';


export function createPaginatedImageListController({
    wrapper,
    columns,
    bodyId,
    emptyMessage,
    errorMessage,
    buildRow,
    updateTabStyles,
} = {}) {
    let currentPage = 1;
    let pageSize = 10;

    async function load() {
        if (!wrapper) {
            if (typeof updateTabStyles === 'function') {
                updateTabStyles();
            }
            return;
        }

        wrapper.textContent = '';
        wrapper.appendChild(createListMessage('Loading...'));

        try {
            const response = await fetch(`/api/images?page=${currentPage}&limit=${pageSize}`);

            if (!response.ok) {
                wrapper.textContent = '';
                wrapper.appendChild(createListMessage(errorMessage));

                if (typeof updateTabStyles === 'function') {
                    updateTabStyles();
                }
                return;
            }

            const data = await response.json();
            const images = data.items;
            const pagination = data.pagination;

            wrapper.textContent = '';

            if (!Array.isArray(images)) {
                wrapper.appendChild(createListMessage(errorMessage));

                if (typeof updateTabStyles === 'function') {
                    updateTabStyles();
                }
                return;
            }

            if (images.length === 0) {
                if (pagination && pagination.page > 1) {
                    currentPage = Math.max(1, pagination.page - 1);
                    await load();
                    return;
                }

                wrapper.appendChild(createListMessage(emptyMessage));

                if (typeof updateTabStyles === 'function') {
                    updateTabStyles();
                }
                return;
            }

            const { body } = mountList({
                wrapper,
                columns,
                bodyId,
            });

            images.forEach((image) => {
                if (!image) {
                    return;
                }

                body.appendChild(buildRow(image, load));
            });

            renderPagination({
                wrapper,
                pagination,
                currentPage,
                pageSize,
                onPageChange: ({ page, limit }) => {
                    currentPage = page;
                    pageSize = limit;
                    void load();
                },
            });

            if (typeof updateTabStyles === 'function') {
                updateTabStyles();
            }
        } catch (_) {
            wrapper.textContent = '';
            wrapper.appendChild(createListMessage(errorMessage));

            if (typeof updateTabStyles === 'function') {
                updateTabStyles();
            }
        }
    }

    return {
        load,
    };
}