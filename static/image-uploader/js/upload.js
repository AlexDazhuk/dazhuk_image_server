import { showToast } from './shared/toast.js';
import { bindNavigation } from './shared/navigation.js';
import { updateTabStyles } from './shared/tabs.js';
import { bindPageHotkeys } from './shared/keyboard.js';
import { shortenUrlToFit } from './shared/formatters.js';
import {
    IMAGE_ALLOWED_TYPES,
    IMAGE_ALLOWED_EXTENSIONS,
    MAX_UPLOAD_SIZE_MB,
    MAX_UPLOAD_SIZE_BYTES
} from './shared/constants.js';


function getUploadFieldMaxLength(container, copyButton) {
    if (!container) {
        return 40;
    }

    const containerWidth = container.clientWidth || 540;
    const buttonWidth = copyButton?.offsetWidth || 88;

    // запас під padding, gap, border
    const availableWidth = containerWidth - buttonWidth - 56;

    // середня ширина 1 символу для Inter 14px
    const approxChars = Math.floor(availableWidth / 8);

    return Math.max(12, approxChars);
}


let uploadErrorTimer = null;

function setUploadErrorState(message = 'Upload failed') {
    const dropzone = document.querySelector('.upload__dropzone');
    const prompt = document.querySelector('.upload__prompt');

    if (!dropzone || !prompt) return;

    dropzone.classList.add('is-error');
    prompt.textContent = message || 'Upload failed';

    if (uploadErrorTimer) {
        clearTimeout(uploadErrorTimer);
    }

    uploadErrorTimer = setTimeout(() => {
        resetUploadState();
    }, 2500);
}


function resetUploadState() {
    const dropzone = document.querySelector('.upload__dropzone');
    const prompt = document.querySelector('.upload__prompt');

    if (!dropzone || !prompt) return;

    dropzone.classList.remove('is-error');
    prompt.textContent = 'Select a file or drag and drop here';

    if (uploadErrorTimer) {
        clearTimeout(uploadErrorTimer);
        uploadErrorTimer = null;
    }
}


document.addEventListener('DOMContentLoaded', () => {
    const fileUpload = document.getElementById('file-upload');
    const dropzone = document.querySelector('.upload__dropzone');
    const currentUploadInput = document.getElementById('current-upload-input');
    const copyButton = document.querySelector('.upload__copy');
    const uploadPrompt = document.getElementById('upload-prompt');
    const uploadInfo = document.getElementById('upload-info');

    if (uploadPrompt) {
        uploadPrompt.textContent = 'Select a file or drag and drop here';
    }

    if (uploadInfo) {
        uploadInfo.innerHTML = '';
        uploadInfo.append(
            `Only support ${IMAGE_ALLOWED_EXTENSIONS}`,
            document.createElement('br'),
            `Maximum file size is ${MAX_UPLOAD_SIZE_MB} MB`
        );
    }

    bindPageHotkeys({
        escapePath: '/',
        f5Path: '/',
    });

    bindNavigation('images-tab-btn', '/images');
    bindNavigation('db-gallery-tab-btn', '/db-gallery');

    if (copyButton && currentUploadInput) {
        copyButton.addEventListener('click', () => {
            const textToCopy =
                currentUploadInput.dataset.fullUrl || currentUploadInput.value;

            if (textToCopy && textToCopy !== 'https://') {
                navigator.clipboard.writeText(textToCopy)
                    .then(() => {
                        copyButton.textContent = 'COPIED!';
                        showToast('URL copied', 'success');

                        setTimeout(() => {
                            copyButton.textContent = 'COPY';
                        }, 2000);
                    })
                    .catch((error) => {
                        console.error('Failed to copy text:', error);
                    });
            }
        });
    }

    if (!fileUpload || !dropzone) {
        updateTabStyles();
        return;
    }

    const uploadFileToServer = async (file) => {
        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch('/upload', {
                method: 'POST',
                body: formData,
            });

            const result = await response.json();

            if (result.success) {
                resetUploadState();

                if (currentUploadInput) {
                    const fullUrl = window.location.origin + result.url;
                    const fieldContainer = currentUploadInput.closest('.upload__label');
                    const maxLength = getUploadFieldMaxLength(fieldContainer, copyButton);

                    currentUploadInput.value = shortenUrlToFit(fullUrl, maxLength);
                    currentUploadInput.dataset.fullUrl = fullUrl;
                    currentUploadInput.title = fullUrl;
                }

                updateTabStyles();
                return true;
            }

            setUploadErrorState(result.error || 'Upload failed');
            showToast(result.error || 'Upload failed', 'error');
            return false;

        } catch (error) {
            setUploadErrorState('Upload error');
            showToast('Upload error: ' + error.message, 'error');
            return false;
        }
    };

    const handleFiles = async (files) => {
        if (!files || files.length === 0) {
            return;
        }

        resetUploadState();

        let filesUploaded = false;
        let errorShown = false;

        for (const file of files) {
            if (!IMAGE_ALLOWED_TYPES.includes(file.type)) {
                if (!errorShown) {
                    setUploadErrorState('Unsupported file type');
                    errorShown = true;
                }
                showToast(
                    `File "${file.name}" has unsupported format. Only ${IMAGE_ALLOWED_EXTENSIONS} are allowed.`,
                    'error'
                );
                continue;
            }
            if (file.size > MAX_UPLOAD_SIZE_BYTES) {
                if (!errorShown) {
                    setUploadErrorState('File too large');
                    errorShown = true;
                }

                showToast(
                    `File "${file.name}" is too large. Maximum size is ${MAX_UPLOAD_SIZE_MB} MB.`,
                    'error'
                );
                continue;
            }

            const success = await uploadFileToServer(file);
            if (success) {
                filesUploaded = true;
            }
        }

        if (filesUploaded) {
            showToast('Upload successful', 'success');
        }
    };

    fileUpload.addEventListener('change', async (event) => {
        await handleFiles(event.target.files);
        event.target.value = '';
    });

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach((eventName) => {
        dropzone.addEventListener(eventName, (event) => {
            event.preventDefault();
            event.stopPropagation();
        });
    });

    dropzone.addEventListener('drop', async (event) => {
        event.preventDefault();
        event.stopPropagation();

        dropzone.classList.remove('is-dragover');

        await handleFiles(event.dataTransfer.files);
    });

    dropzone.addEventListener('dragover', () => {
        dropzone.classList.add('is-dragover');
    });

    dropzone.addEventListener('dragleave', (event) => {
        if (!event.relatedTarget || !dropzone.contains(event.relatedTarget)) {
            dropzone.classList.remove('is-dragover');
        }
    });

    updateTabStyles();
});
