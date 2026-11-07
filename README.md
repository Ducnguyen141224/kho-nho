# Kho Nhỏ

Landing page React + Vite giới thiệu ứng dụng quản lý tồn kho và cung cấp bản cài Android.

```powershell
npm ci
npm run dev
```

Dùng `npm run build` để tạo bản production trong `dist`. Sau khi build, chạy `npm run verify` để kiểm tra nội dung, tải ảnh, các sự kiện chuyển động và đường tải APK bằng Chrome. Nếu Chrome nằm ở vị trí khác, đặt biến môi trường `CHROME_PATH`.

- `src/content/kho-nho-release.json` chứa phiên bản phát hành, URL Expo EAS, kích thước và SHA-256 của APK đã ký. Cập nhật file này khi có bản phát hành mới.
- `public/kho-nho/` chứa icon của dự án Kho Nhỏ và ảnh chụp Android lấy từ `.local/inventory-layout-check` trong repo ứng dụng. Các màn hình dùng dữ liệu minh họa.
- `src/site.css` áp dụng bảng màu tím mận, vàng và nền kem từ `frontend/src/constants/theme.ts` của Kho Nhỏ.
- `scripts/adapt-kho-nho.mjs` tạo nội dung `src/content/kho-nho.html` dựa trên markup Webflow đã lưu. Các selector, ID và bundle IX2 gốc được dùng cho hiệu ứng khi tải, cuộn, mở menu và chuyển tab.

Để đối chiếu với template ban đầu, build riêng bằng `npm run build -- --mode reference` rồi chạy `npm run verify:reference -- --compare` hoặc `node scripts/compare-motion.mjs`.
