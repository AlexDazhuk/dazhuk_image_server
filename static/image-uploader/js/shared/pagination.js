function buildPaginationItems(currentPage, totalPages) {
    const pages = new Set([
        1,
        totalPages,
        currentPage,
        currentPage - 1,
        currentPage + 1,
    ]);

    const valid = [...pages]
        .filter(p => p >= 1 && p <= totalPages)
        .sort((a, b) => a - b);

    const result = [];

    for (let i = 0; i < valid.length; i++) {
        const page = valid[i];
        const prev = valid[i - 1];

        if (i > 0 && page - prev > 1) {
            result.push('ellipsis');
        }

        result.push(page);
    }

    return result;
}


export function renderPagination({
    wrapper,
    pagination,
    currentPage,
    pageSize,
    onPageChange,
} = {}) {
    if (!wrapper || !pagination || typeof onPageChange !== 'function') {
        return;
    }

    const {
        page,
        limit,
        total_items,
        total_pages,
        has_prev,
        has_next,
        allowed_limits = [10, 25, 50, 100],
    } = pagination;

    const shouldShowLimitSelector = total_items > Math.min(...allowed_limits);
    const shouldShowPager = total_pages > 1;

    if (!pagination) {
        return;
    }

    const container = document.createElement('div');
    container.className = 'pagination';

    const left = document.createElement('div');
    left.className = 'pagination__left';

    const center = document.createElement('div');
    center.className = 'pagination__center';

    const right = document.createElement('div');
    right.className = 'pagination__right';

    if (shouldShowLimitSelector) {
        const label = document.createElement('label');
        label.className = 'pagination__label';
        label.textContent = 'Rows:';

        const selectWrapper = document.createElement('div');
        selectWrapper.className = 'pagination__select-wrapper';

        const select = document.createElement('select');
        select.className = 'pagination__select';

        allowed_limits.forEach((itemLimit) => {
            const option = document.createElement('option');
            option.value = String(itemLimit);
            option.textContent = String(itemLimit);

            if (itemLimit === limit || itemLimit === pageSize) {
                option.selected = true;
            }

            select.appendChild(option);
        });

        select.addEventListener('change', () => {
            const nextLimit = Number(select.value);

            if (Number.isNaN(nextLimit) || nextLimit <= 0) {
                return;
            }

            onPageChange({
                page: 1,
                limit: nextLimit,
            });
        });

        selectWrapper.appendChild(select);

        const arrow = document.createElement('img');
        arrow.className = 'pagination__select-arrow';
        arrow.src = '/image-uploader/img/icon/select-arrow.png';
        arrow.alt = '';

        selectWrapper.appendChild(arrow);

        right.appendChild(label);
        right.appendChild(selectWrapper);
    }

    const info = document.createElement('span');
    info.className = 'pagination__info';
    info.textContent = `Page ${page} of ${total_pages}`;

    const prevBtn = document.createElement('button');
    prevBtn.type = 'button';
    prevBtn.className = 'pagination__button';
    prevBtn.textContent = 'Prev';
    prevBtn.disabled = !has_prev;

    prevBtn.addEventListener('click', () => {
        if (!has_prev) {
            return;
        }

        onPageChange({
            page: currentPage - 1,
            limit: pageSize,
        });
    });

    const nextBtn = document.createElement('button');
    nextBtn.type = 'button';
    nextBtn.className = 'pagination__button';
    nextBtn.textContent = 'Next';
    nextBtn.disabled = !has_next;

    nextBtn.addEventListener('click', () => {
        if (!has_next) {
            return;
        }

        onPageChange({
            page: currentPage + 1,
            limit: pageSize,
        });
    });

    if (shouldShowPager) {
        center.appendChild(prevBtn);

        const items = buildPaginationItems(page, total_pages);

        items.forEach(item => {
            if (item === 'ellipsis') {
                const el = document.createElement('span');
                el.className = 'pagination__ellipsis';
                el.textContent = '…';
                center.appendChild(el);
                return;
            }

            const btn = document.createElement('button');
            btn.className = 'pagination__page';
            btn.textContent = String(item);

            if (item === page) {
                btn.classList.add('is-active');
            }

            btn.addEventListener('click', () => {
                if (item !== page) {
                    onPageChange({
                        page: item,
                        limit: pageSize,
                    });
                }
            });

            center.appendChild(btn);
        });

        center.appendChild(nextBtn);
    } else {
        center.appendChild(info);
    }

    container.appendChild(left);
    container.appendChild(center);
    container.appendChild(right);
    wrapper.appendChild(container);
}