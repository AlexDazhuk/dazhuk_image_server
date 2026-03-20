export function createListContainer() {
    const container = document.createElement('div');
    container.className = 'file-list-container';
    return container;
}


export function createListHeader(columns) {
    const header = document.createElement('div');
    header.className = 'file-list-header';

    columns.forEach((column) => {
        const cell = document.createElement('div');
        cell.className = `file-col ${column.className}`;
        cell.textContent = column.label;
        header.appendChild(cell);
    });

    return header;
}


export function createListBody(id = 'file-list') {
    const list = document.createElement('div');
    list.id = id;
    return list;
}


export function createListRow() {
    const row = document.createElement('div');
    row.className = 'file-list-item';
    return row;
}


export function createListCell(className) {
    const cell = document.createElement('div');
    cell.className = `file-col ${className}`;
    return cell;
}


export function createListMessage(message, className = 'upload__prompt') {
    const emptyMsg = document.createElement('p');
    emptyMsg.className = className;
    emptyMsg.style.textAlign = 'center';
    emptyMsg.style.marginTop = '50px';
    emptyMsg.textContent = message;
    return emptyMsg;
}


export function mountList({ wrapper, columns, bodyId = 'file-list' }) {
    wrapper.textContent = '';

    const container = createListContainer();

    const inner = document.createElement('div');
    inner.className = 'file-list-inner';

    const header = createListHeader(columns);
    const body = createListBody(bodyId);

    inner.appendChild(header);
    inner.appendChild(body);

    container.appendChild(inner);
    wrapper.appendChild(container);

    return {
        container,
        header,
        body,
    };
}