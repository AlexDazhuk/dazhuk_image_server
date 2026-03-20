import { bindNavigation } from './shared/navigation.js';
import { bindPageHotkeys } from './shared/keyboard.js';


function showRandomHeroImage() {
    const images = document.querySelectorAll('.hero__img');

    if (!images.length) {
        return;
    }

    const randomIndex = Math.floor(Math.random() * images.length);
    const randomBlock = images[randomIndex];

    randomBlock.classList.add('is-visible');
}


document.addEventListener('DOMContentLoaded', () => {

    bindPageHotkeys({
        escapePath: '/',
        f5Path: '/',
    });

    showRandomHeroImage();

    bindNavigation('header__button-btn', '/images');

});