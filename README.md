# Kho Nhỏ

Landing page React + Vite giới thiệu ứng dụng quản lý tồn kho và cung cấp bản cài Android.

```powershell
npm ci
npm run dev
```

Dùng `npm run build` để tạo bản production trong `dist`. Sau khi build, chạy `npm run verify` để kiểm tra nội dung, tải ảnh, các sự kiện chuyển động và đường tải APK bằng Chrome. Nếu Chrome nằm ở vị trí khác, đặt biến môi trường `CHROME_PATH`.

- `src/content/kho-nho-release.json` chứa phiên bản phát hành, URL Expo EAS, kích thước và SHA-256 của APK đã ký. Cập nhật file này khi có bản phát hành mới.
- `public/kho-nho/` chứa icon và ảnh chụp Android của Kho Nhỏ. Các màn hình dùng dữ liệu minh họa.
- `src/content/kho-nho.html` chứa nội dung trang. Màu và kiểu chữ nằm trong `src/site.css`.
- `public/assets/` chứa tài nguyên giao diện và các thư viện jQuery, Webflow IX2 dùng cho chuyển động.
