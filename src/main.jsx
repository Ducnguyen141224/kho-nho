import React, { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import './site.css';
import { initializeWebflow, installLocalForms } from './runtime.js';
import home from './content/home.json';
import landingHtml from './content/kho-nho.html?raw';
import release from './content/kho-nho-release.json';

// Captured documents retain original classes, SVGs, data-w-id values and
// data-wf-page IDs. The original interaction engine targets these exact IDs.
const referenceMode = import.meta.env.MODE === 'reference';
const route = window.location.pathname.replace(/\/$/, '') || '/';
const landing = {
  ...home,
  title: 'Kho Nhỏ | Quản lý tồn kho trên Android',
  description: 'Theo dõi hàng hóa, quét mã vạch, kiểm kê và nhận cảnh báo tồn kho với Kho Nhỏ. Tải APK cho điện thoại Android.',
  htmlAttributes: { ...home.htmlAttributes, lang: 'vi' },
  bodyAttributes: { ...home.bodyAttributes, class: 'kho-nho' },
  body: landingHtml.replace(/__APK_(URL|VERSION|ANDROID|SIZE)__/g, (_, field) => release[field.toLowerCase()]),
};
let page = route === '/' ? landing : undefined;
if (referenceMode) {
  const documents = import.meta.glob('./content/*.json', { eager: true, import: 'default' });
  page = Object.values(documents).find(value => value.route === route);
}

function prepareDocument(document) {
  for (const [key, value] of Object.entries(document.htmlAttributes || {})) {
    if (key !== 'class') window.document.documentElement.setAttribute(key, value);
  }
  // Local copy does not use Webflow's hosted badge, analytics or form service.
  window.document.documentElement.removeAttribute('data-wf-domain');
  window.document.documentElement.classList.add('w-mod-js', 'wf-active');
  if ('ontouchstart' in window) window.document.documentElement.classList.add('w-mod-touch');
  for (const [key, value] of Object.entries(document.bodyAttributes || {})) window.document.body.setAttribute(key, value);
  window.document.title = document.title;
  window.document.querySelector('meta[name="description"]').content = document.description;
  for (const href of document.stylesheets) {
    const link = window.document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    window.document.head.append(link);
  }
}

function CapturedPage({ document }) {
  useEffect(() => {
    let cancelled = false;
    const removeFormHandlers = referenceMode ? installLocalForms() : undefined;
    initializeWebflow(document).then(() => {
      if (cancelled) return;
      window.document.documentElement.dataset.runtime = 'ready';
      if (location.hash) requestAnimationFrame(() => {
        const target = window.document.getElementById(decodeURIComponent(location.hash.slice(1)));
        target?.scrollIntoView();
      });
    }).catch(error => {
      window.document.documentElement.dataset.runtime = 'error';
      console.error('Cannot initialize local interactions', error);
    });
    return () => { cancelled = true; removeFormHandlers?.(); };
  }, [document]);

  return <div className="captured-page" dangerouslySetInnerHTML={{ __html: document.body }} />;
}

function NotFound() {
  return <main className="not-found"><h1>Không tìm thấy trang</h1><a href="/">Về trang Kho Nhỏ</a></main>;
}

if (page) prepareDocument(page);
createRoot(document.getElementById('root')).render(page ? <CapturedPage document={page} /> : <NotFound />);
