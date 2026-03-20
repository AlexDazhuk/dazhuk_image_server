export function updateTabStyles() {
    /** @type {HTMLButtonElement|null} */
    const uploadTab = document.getElementById('upload-tab-btn');
    /** @type {HTMLButtonElement|null} */
    const imagesTab = document.getElementById('images-tab-btn');
    /** @type {HTMLButtonElement|null} */
    const dbGalleryTab = document.getElementById('db-gallery-tab-btn');

    const path = window.location.pathname;
    const isDbGalleryPage = path.includes('/db-gallery');
    const isImagesPage = path.includes('/images') && !isDbGalleryPage;

    uploadTab?.classList.remove('upload__tab--active');
    imagesTab?.classList.remove('upload__tab--active');
    dbGalleryTab?.classList.remove('upload__tab--active');

    if (isDbGalleryPage) {
        dbGalleryTab?.classList.add('upload__tab--active');
        return;
    }

    if (isImagesPage) {
        imagesTab?.classList.add('upload__tab--active');
        return;
    }

    uploadTab?.classList.add('upload__tab--active');
}