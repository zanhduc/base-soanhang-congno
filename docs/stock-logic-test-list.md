# Stock Logic Test List

## Mục tiêu
- Đảm bảo luồng `nhập sản phẩm` cộng tồn kho đúng.
- Đảm bảo luồng `bán hàng` trừ tồn kho đúng (luồng GAS).
- Đảm bảo các nhánh `alternative/negative flow` không làm crash hoặc làm sai dữ liệu.
- Đảm bảo không còn logic/route liên quan `homestay`.

## Cách chạy smoke test tự động
```bash
npm run test:stock
```

## Thống kê test tự động
- Tổng: `22` test case
- Happy path + contract: `10` case
- Alternative/negative path: `12` case

### Danh sách auto test (tools/test-stock-logic.mjs)
1. `TC01` contract localAdapter có đủ method cần thiết.
2. `TC02` updateBankConfig fail khi thiếu account number.
3. `TC03` updateBankConfig pass với payload hợp lệ + verify read-back.
4. `TC04` getSyncVersion trả về version string.
5. `TC05` nhập sản phẩm có sẵn -> tồn kho tăng đúng + cập nhật giá vốn.
6. `TC06` nhập sản phẩm mới -> tự tạo dòng sản phẩm mới trong catalog.
7. `TC07` phiếu nhập `Trả một phần` -> phát sinh công nợ NCC đúng số tiền nợ.
8. `TC08` edge `quyDoi=0` -> fallback về 1, không phát sinh `Infinity/NaN`.
9. `TC09` createOrder happy path thành công.
10. `TC10` updateOrder fail khi thiếu `maPhieuOriginal`.
11. `TC11` updateOrder fail khi mã phiếu không tồn tại.
12. `TC12` updateOrder pass với phiếu tồn tại + verify `tienNo/trangThai`.
13. `TC13` deleteOrder fail khi mã phiếu rỗng.
14. `TC14` deleteOrder fail khi mã phiếu không tồn tại.
15. `TC15` deleteOrder pass khi mã phiếu tồn tại + verify đã bị xóa.
16. `TC16` createProductCatalogItem fail khi trùng `tenSanPham + donVi`.
17. `TC17` createProductCatalogItem fail khi thiếu đơn vị.
18. `TC18` updateSupplierDebt fail khi mã phiếu không tồn tại.
19. `TC19` getInventory trả về `tonKho` hữu hạn cho mọi dòng.
20. `TC20` scan gasAdapter còn đủ call trừ kho `-1` và cộng kho `+1`.
21. `TC21` UI wording còn `Nhập sản phẩm`, không còn `Nhập nguyên liệu`.
22. `TC22` scan source không còn token `homestay/checkin/checkout/phòng`.

## Checklist manual (nên chạy trước khi deploy)

1. Case nhập sản phẩm cộng kho
- Bước:
  - Mở màn `Nhập sản phẩm`.
  - Tạo phiếu nhập với 1 sản phẩm đã có trong danh mục (ví dụ Mì gói Hảo Hảo).
  - Điền `Số lượng chẵn`, `Quy đổi`, `Giá nhập`.
- Kỳ vọng:
  - Phiếu lưu thành công.
  - Tồn kho sản phẩm tăng đúng `soLuong * quyDoi`.
  - Giá vốn lẻ cập nhật theo `giaNhapChan / quyDoi`.

2. Case nhập sản phẩm mới chưa có trong danh mục
- Bước:
  - Tạo phiếu nhập với sản phẩm mới hoàn toàn.
- Kỳ vọng:
  - Tạo mới dòng sản phẩm trong kho.
  - Có `tonKho`, `donViLe`, `donViChan`, `quyCach`, `giaVon`.

3. Case nhập sản phẩm với `quyDoi = 0` hoặc bỏ trống
- Bước:
  - Tạo phiếu nhập với `quyDoi` không hợp lệ.
- Kỳ vọng:
  - Hệ thống không crash.
  - Không sinh `Infinity/NaN` ở giá vốn.
  - Quy đổi fallback về giá trị hợp lệ (>= 1).

4. Case bán hàng trừ kho (GAS thật)
- Bước:
  - Tạo đơn hàng có ít nhất 1 sản phẩm đang có tồn.
- Kỳ vọng:
  - Đơn lưu thành công.
  - Tồn kho bị trừ đúng theo số lượng bán.
  - Không trừ âm bất thường.

5. Case sửa/xóa đơn hàng hoàn kho (nếu bật flow hoàn kho)
- Bước:
  - Sửa đơn đổi số lượng hoặc xóa đơn.
- Kỳ vọng:
  - Tồn kho được bù/trừ lại đúng chênh lệch.
  - Không tạo duplicate dòng sản phẩm.

6. Case công nợ nhà cung cấp từ phiếu nhập
- Bước:
  - Tạo phiếu nhập trạng thái `Nợ` hoặc `Trả một phần`.
- Kỳ vọng:
  - Phát sinh dòng công nợ NCC đúng `tienNo`.

7. Case cập nhật công nợ NCC với mã phiếu sai
- Bước:
  - Sửa công nợ bằng `maPhieu` không tồn tại.
- Kỳ vọng:
  - Trả thông báo lỗi rõ ràng.
  - Không ghi đè dữ liệu công nợ khác.

8. Case cập nhật cấu hình ngân hàng thiếu dữ liệu
- Bước:
  - Lưu cấu hình thiếu `bankCode` hoặc `accountNumber`.
- Kỳ vọng:
  - Lưu thất bại có thông báo lỗi.
  - Dữ liệu cũ không bị mất.

9. Case tạo sản phẩm trùng tên + đơn vị
- Bước:
  - Tạo sản phẩm có `tenSanPham` và `donVi` đã tồn tại.
- Kỳ vọng:
  - Bị chặn, không tạo duplicate.

10. Case không còn homestay
- Bước:
  - Duyệt menu + route chính.
  - Tìm text/route liên quan phòng/lưu trú.
- Kỳ vọng:
  - Không thấy `homestay`, `checkin`, `checkout`, `maPhong`.

11. Case build an toàn
- Bước:
  - Chạy `npm run build`.
- Kỳ vọng:
  - Build client + server pass, không lỗi runtime contract adapter.
