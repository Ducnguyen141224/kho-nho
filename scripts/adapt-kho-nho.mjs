import { readFile, writeFile } from 'node:fs/promises';
import { load } from 'cheerio';

const template = JSON.parse(await readFile(new URL('../src/content/home.json', import.meta.url)));
const $ = load(template.body);
const assets = '/kho-nho';
const apkButton = '<a href="__APK_URL__" class="button w-button apk-button"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12m-4-4 4 4 4-4M4 17v4h16v-4"/></svg>Tải APK cho Android</a>';
const meta = '<span class="release-meta">v__APK_VERSION__ <span aria-hidden="true">·</span> __APK_ANDROID__ <span aria-hidden="true">·</span> __APK_SIZE__</span>';
const icon = (name, css = '') => `<svg class="${css}" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${{
  box: '<path d="m12 3 9 5v8l-9 5-9-5V8l9-5Zm0 10 9-5M12 13 3 8m9 5v8M7.5 5.5l9 5"/>',
  scan: '<path d="M8 4H4v4m12-4h4v4M4 16v4h4m12-4v4h-4M7 12h10"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h1m-1 6h1m-1 6h1"/>',
  alert: '<path d="M18 8a6 6 0 1 0-12 0c0 7-3 8-3 9h18c0-1-3-2-3-9m-8 12a2 2 0 0 0 4 0"/>',
  chart: '<path d="M3 3v18h18M8 17v-5m5 5V7m5 10V9"/>',
  store: '<path d="M4 10v10h16V10M3 10l2-6h14l2 6M3 10c1.5 3 4 3 6 0 2 3 4 3 6 0 2 3 4.5 3 6 0m-11 10v-5h4v5"/>',
}[name]}</svg>`;

function screenshot(selector, file, alt) {
  $(selector).removeAttr('srcset sizes').attr({ src: `${assets}/${file}.png`, alt, width: '1080', height: '2400' });
}

$('.brand').attr('aria-label', 'Kho Nhỏ – Trang chủ').append('<span class="brand-name">Kho Nhỏ</span>');
$('.brand-image, .footer-brand').attr({ src: `${assets}/icon.png`, alt: '' });
const nav = ['Giới thiệu', 'Tính năng', 'Trải nghiệm', 'Cài đặt'];
$('.nav-links a').each((i, node) => $(node).text(nav[i]));
$('.navbar-button').text('Tải APK');
$('.hero-title').html('<span class="gradient-text">Kho Nhỏ</span>');
$('.hero-paragraph-holder').html('<p>Quản lý tồn kho ngay trên điện thoại. Quét mã, kiểm kê và theo dõi hàng sắp hết để biết khi nào cần nhập thêm.</p>');
$('.animate-on-load-02').append(`<div class="hero-actions">${apkButton}<a class="hero-secondary" href="#Power">Xem tính năng <span aria-hidden="true">↓</span></a></div>${meta}`);
screenshot('.hero-section-phone-screenshot-image-2', 'overview', 'Ảnh chụp Android màn hình tổng quan kho');

$('.title-holder').first().find('p').text('Từ lên kệ đến bán hàng');
const ribbon = [
  ['box', 'Kho hàng'], ['scan', 'Quét mã'], ['list', 'Kiểm kê'], ['store', 'Bán hàng'],
  ['alert', 'Cảnh báo'], ['box', 'Nhập bù'], ['chart', 'Báo cáo'], ['list', 'Lịch sử'], ['store', 'Theo vị trí'],
];
$('.reviews-logos-holder').attr('aria-hidden', 'true');
$('.reviews-logos-container').each((_, container) => {
  $(container).find('.reviews-logos').each((i, node) => $(node).html(`<span class="workflow-chip">${icon(ribbon[i][0])}${ribbon[i][1]}</span>`));
});

$('#Power .title').text('Quản lý kho mỗi ngày');
$('#Power .fetaures-paragraph-holder p').text('Tra cứu sản phẩm, đối chiếu số đếm và biết mặt hàng nào cần chú ý.');
const features = [
  ['01 / DANH MỤC', 'Biết mình còn gì', 'Tìm theo tên, SKU hoặc mã vạch. Xem số lượng tồn theo vị trí và lịch sử biến động ngay từ hồ sơ mặt hàng.', 'products', 'Ảnh chụp Android danh sách mặt hàng và số lượng tồn'],
  ['02 / KIỂM KÊ', 'Quét mã, kiểm đếm', 'Dùng camera quét QR hoặc mã vạch để tìm mặt hàng khi bán hoặc kiểm kê. Hoàn tất phiếu kiểm kê để lưu số đếm thực tế.', 'scanner', 'Ảnh chụp Android màn hình quét mã kiểm kê'],
];
$('.collaborate-content-holder').each((i, node) => {
  const [tag, heading, text, image, alt] = features[i];
  $(node).find('.tag').text(tag);
  $(node).find('h3').text(heading);
  $(node).find('p').text(text);
  $(node).find('a').attr('href', '#Features').text('Xem trải nghiệm');
  screenshot(`.collaborante-image-holder:eq(${i}) img`, image, alt);
});

const callouts = [
  ['box', 'Theo dõi số lượng tồn theo vị trí'],
  ['scan', 'Tra cứu bằng QR, mã vạch và SKU'],
  ['list', 'Lưu phiếu kiểm kê và số đếm thực tế'],
  ['alert', 'Phát hiện hàng hết, sắp hết hoặc tồn lâu'],
  ['store', 'Nhập bù theo mức tồn mục tiêu'],
  ['chart', 'Xem xu hướng theo 7 hoặc 28 ngày'],
];
$('#Features > .container').prepend('<div class="title-holder feature-intro"><div class="fade-in-on-scroll"><h2 class="title">Nhìn rõ tình trạng kho</h2><p>Giao diện Kho Nhỏ trên Android với dữ liệu minh họa.</p></div></div>');
$('.sticky-content-container').each((i, node) => {
  $(node).find('.small-icon').replaceWith(icon(callouts[i][0], 'small-icon'));
  $(node).find('.sticky-title').text(callouts[i][1]);
});
screenshot('.sticky-phone .hero-section-phone-screenshot-image', 'alerts', 'Ảnh chụp Android cảnh báo tồn kho và đề xuất nhập bù');

$('#Pricing .pricing-header-holder .title').replaceWith('<h2 class="title">Tải Kho Nhỏ</h2>');
$('#Pricing .fetaures-paragraph-holder p').text('Cài ứng dụng trên điện thoại Android và đăng nhập vào cửa hàng của bạn.');
$('.pricing-tab-menu').attr('aria-label', 'Hướng dẫn cài đặt');
$('.w-tab-link').eq(0).find('div').text('Cài lần đầu');
$('.w-tab-link').eq(1).find('div').text('Cập nhật');
const guides = [
  [
    ['Bước 01', 'Tải tệp', 'Tải APK xuống điện thoại hoặc gửi tệp sang thiết bị Android.'],
    ['Bước 02', 'Cài ứng dụng', 'Mở tệp APK. Nếu Android hỏi, cho phép cài từ ứng dụng dùng để mở tệp rồi xác nhận.'],
    ['Bước 03', 'Bắt đầu', 'Mở Kho Nhỏ, đăng nhập hoặc đăng ký tài khoản để vào cửa hàng.'],
  ],
  [
    ['Bước 01', 'Xem phiên bản', 'Kiểm tra phiên bản đang cài. Chỉ tải khi có bản mới hơn hoặc cần cài lại.'],
    ['Bước 02', 'Cài đè', 'Mở tệp APK mới và chọn cập nhật khi Android hiển thị xác nhận.'],
    ['Bước 03', 'Mở lại app', 'Đăng nhập nếu được yêu cầu, rồi làm mới để đồng bộ dữ liệu kho.'],
  ],
];
$('.w-tab-pane').each((tab, pane) => {
  $(pane).find('.pricing-table').each((i, node) => {
    const [step, heading, text] = guides[tab][i];
    $(node).html(`<span class="pricing-tags">${step}</span><h3 class="install-card-title">${heading}</h3><p>${text}</p>`);
  });
});
$('.card-shadows').attr('id', 'apk-download');
$('.cta-paragraph-holder p').text('Ứng dụng Android');
$('.cta-heading').replaceWith('<h3 class="cta-heading">Kho Nhỏ, sẵn sàng lên kệ.</h3>');
$('.cta-container .form-block-2').replaceWith(`<div class="download-actions">${apkButton}${meta}</div>`);
screenshot('.hero-section-phone-screenshot-image-3', 'reports', 'Ảnh chụp Android báo cáo kiểm kê của Kho Nhỏ');

$('.footer-signup-holder .footer-title').text('Kho Nhỏ');
$('.footer-signup-holder .form-block').replaceWith('<p class="footer-note">Ứng dụng quản lý tồn kho dành cho cửa hàng và nhóm kiểm kho.</p>');
$('.social-media-holder').remove();
$('.footer-block').eq(0).html('<div class="title-small">Ứng dụng</div><a class="footer-link" href="#Product">Giới thiệu</a><a class="footer-link" href="#Power">Tính năng</a><a class="footer-link" href="#Features">Trải nghiệm</a>');
$('.footer-block').eq(1).html('<div class="title-small">Android</div><a class="footer-link" href="#Pricing">Hướng dẫn cài đặt</a><a class="footer-link" href="#apk-download">Tải APK</a>');
$('.footer-block').eq(2).remove();
$('.footer-divider').html('<p class="footer-copyright-center">Kho Nhỏ · Nhóm 8</p>');

const sections = $('body').children().map((_, node) => $(node).toString()).get();
await writeFile(new URL('../src/content/kho-nho.html', import.meta.url), sections.join('\n\n') + '\n');
