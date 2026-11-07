import { readFile } from 'node:fs/promises';
import { defineConfig } from 'vite';

function renderLanding() {
  return {
    name: 'render-landing',
    transformIndexHtml: {
      order: 'pre',
      async handler(html) {
        const [markup, releaseJson, pageJson] = await Promise.all([
          readFile(new URL('./src/content/kho-nho.html', import.meta.url), 'utf8'),
          readFile(new URL('./src/content/kho-nho-release.json', import.meta.url), 'utf8'),
          readFile(new URL('./src/content/home.json', import.meta.url), 'utf8'),
        ]);
        const release = JSON.parse(releaseJson);
        const page = JSON.parse(pageJson);
        const body = markup.replace(/__APK_(URL|VERSION|ANDROID|SIZE)__/g, (_, field) => release[field.toLowerCase()]);
        const { 'data-wf-page': pageId, 'data-wf-site': siteId } = page.htmlAttributes;
        const scriptPreloads = page.scripts
          .map(({ src }) => `<link rel="preload" as="script" href="${src}" fetchpriority="low" />`)
          .join('\n    ');

        return html
          .replace('<html lang="vi" class="w-mod-js">', `<html lang="vi" class="w-mod-js wf-active" data-wf-page="${pageId}" data-wf-site="${siteId}">`)
          .replace('</head>', `<link rel="stylesheet" href="/src/landing.css" />
    <link rel="stylesheet" href="${page.stylesheets[0]}" />
    ${scriptPreloads}
    <noscript><style>
      .animate-on-load-01, .animate-on-load-02, .hero-section-phone-holder-2, [data-w-id], .fade-in-on-scroll {
        transform: none !important; opacity: 1 !important; filter: none !important;
      }
    </style></noscript>
  </head>`)
          .replace('<body>', '<body class="kho-nho">')
          .replace('<div id="root"></div>', () => `<div id="root"><div class="captured-page">${body}</div></div>`)
          .replace('/src/main.jsx', '/src/landing.js');
      },
    },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: mode === 'reference' ? [] : [renderLanding()],
  server: { watch: { ignored: ['**/.browser-profile/**', '**/evidence/**'] } },
}));
