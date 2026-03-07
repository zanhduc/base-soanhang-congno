# GAS React Base – Development Rules

Tài liệu này là quy chuẩn bắt buộc cho mọi dev sử dụng base này.

---

## 1. Nguyên tắc môi trường

Base có 2 môi trường:

- DEV (npm run dev) → dùng local adapter
- PROD (npm run build + clasp push) → dùng GAS adapter

Tuyệt đối không:
- Hardcode URL GAS trong component
- Gọi fetch trực tiếp trong page/component

Mọi API phải đi qua:
src/client/api

---

## 2. Kiến trúc bắt buộc

Flow chuẩn:

React (UI)
→ api wrapper
→ adapter (local / gas)
→ data source

Component không được:
- Gọi SpreadsheetApp
- Viết logic GAS
- Xử lý business logic phức tạp

---

## 3. Business Logic

Business logic phải:
- Viết thuần JavaScript

Ví dụ:
- Tính tổng đơn
- Validate trạng thái nợ
- Chuẩn hóa dữ liệu

Không viết logic tính toán trực tiếp trong Code.js nếu có thể tách ra.

---

## 4. UI / CSS Rule
UI phải ưu tiên mobile-first để thuận tiện cho khách khi dùng trên mobile.

**Tailwind First

✔ Ưu tiên dùng Tailwind CSS.
❌ Không viết CSS tay nếu Tailwind có thể dùng được.

**Layout

Luôn dùng fluid layout:
- w-full
- max-w-*
- mx-auto

Không hardcode width bằng px.

**Responsive

Áp dụng
- Mobile-First Design
- Default = mobile
- Chỉ thêm breakpoint khi cần
- đa số các trường hợp chỉ nên thêm breakpoint cho md(tablet)

Ví dụ:
grid-cols-1 md:grid-cols-2
text-sm md:text-base

- Không tạo file CSS riêng cho từng component/file.

---

## 5. State & Loading

Mọi API call phải có:
- loading state
- error handling

Không được gọi API trực tiếp trong useEffect mà không xử lý lỗi.

---

## 6. Cấu trúc thư mục

client/      → UI
  components/ → component tái sử dụng/chia nhỏ page ra để dễ debug
  pages/      → page-level component
api/         → gọi API
core/        → logic tính toán(các function)

Không để lẫn file lung tung.

---

## 7. Không được làm

- Không viết toàn bộ logic trong Code.js
- Không chỉnh trực tiếp file trong dist/
- Không push base gốc lên GitHub project
- Không commit node_modules
- Không sửa cấu trúc base nếu chưa thống nhất

---

## 8. Tư duy bắt buộc

GAS chỉ là adapter kết nối Google Sheet.
React + Business Logic mới là sản phẩm thật sự.