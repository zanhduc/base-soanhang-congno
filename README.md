# 🔒 Quy định sử dụng Base Template

## ❗ Không được push trực tiếp Base này lên Git chung

Base này chỉ dùng làm **template khởi tạo dự án mới**.

Không được:

- Push trực tiếp base này lên Git production
- Sử dụng chung 1 repository cho nhiều dự án
- Đẩy code khách hàng vào repository base
- Chỉnh sửa base gốc để làm dự án khách hàng

---

## ✅ Cách sử dụng đúng

### 1️⃣ Clone base về máy

```bash
git clone <base-repo>
```

### 2️⃣ Xoá git history của base

```bash
rm -rf .git
```

### 3️⃣ Tạo repository mới cho dự án

```bash
git init
git remote add origin <new-project-repo>
```

### 4️⃣ Commit và push lên repo riêng

```bash
git add .
git commit -m "Initial commit from base"
git push -u origin main
```

---

# 📦 Mỗi dự án bắt buộc phải có

- Repository Git riêng
- ScriptId riêng (`.clasp.json`)
- Google Apps Script project riêng
- Spreadsheet riêng (nếu có sử dụng)
- Deployment riêng

---

# 🚨 Tuyệt đối không

- Dùng chung 1 Apps Script project cho nhiều khách hàng
- Dùng chung 1 Spreadsheet cho nhiều hệ thống
- Push nhầm `scriptId` của dự án khác
- Push file `.clasp.json` chứa `scriptId` production của dự án khác

---

# 🎯 Lý do

- Tránh rò rỉ dữ liệu khách hàng
- Tránh ghi đè nhầm project production
- Tránh xung đột scriptId khi deploy
- Giữ mỗi dự án độc lập và dễ bảo trì

---

# 🧠 Nguyên tắc công ty

Base = Template  
Project = Repository riêng  
Client = GAS project riêng  

Không bao giờ dùng chung tài nguyên giữa các dự án.
