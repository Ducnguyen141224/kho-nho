import { scripts } from './content/home.json';
import { initializeWebflow } from './runtime.js';

const root = document.documentElement;

if (location.pathname !== '/' && location.pathname !== '/index.html') {
  document.getElementById('root').innerHTML =
    '<main class="not-found"><h1>Không tìm thấy trang</h1><a href="/">Về trang Kho Nhỏ</a></main>';
} else {
  if ('ontouchstart' in window) root.classList.add('w-mod-touch');

  initializeWebflow({ scripts }).then(() => {
    root.dataset.runtime = 'ready';
    if (location.hash) {
      requestAnimationFrame(() => document.getElementById(location.hash.slice(1))?.scrollIntoView());
    }
  }).catch(error => {
    root.dataset.runtime = 'error';
    console.error('Cannot initialize interactions', error);
  });
}
