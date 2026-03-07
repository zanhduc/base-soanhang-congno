/**
 * Core business logic used by local mock adapter.
 */

/**
 * Build rows for DON_HANG sheet.
 * Columns:
 * A STT
 * B NGAY BAN
 * C MA PHIEU
 * D TEN SAN PHAM
 * E DON VI
 * F SO LUONG
 * G GIA VON
 * H DON GIA BAN
 * I THANH TIEN
 * J TONG HOA DON
 * K GHI CHU
 * L TRANG THAI
 */
export function buildOrderRows(orderData) {
  const { orderInfo, products } = orderData;

  const tongHoaDon = products.reduce(
    (sum, p) => sum + (p.soLuong || 0) * (p.donGiaBan || 0),
    0,
  );

  const ngayBan = formatDate(orderInfo.ngayBan);

  return products.map((p, i) => {
    const thanhTien = (p.soLuong || 0) * (p.donGiaBan || 0);
    return [
      "",
      ngayBan,
      orderInfo.maPhieu || "",
      p.tenSanPham || "",
      p.donVi || "",
      p.soLuong || 0,
      p.giaVon || 0,
      p.donGiaBan || 0,
      thanhTien,
      i === 0 ? tongHoaDon : "",
      i === 0 ? orderInfo.ghiChu || "-" : "-",
      orderInfo.trangThai || "Đã thanh toán",
    ];
  });
}

/**
 * Build one row for KHACH sheet.
 * Columns:
 * A STT | B TEN KHACH | C NGAY BAN | D SO DIEN THOAI |
 * E MA PHIEU | F TIEN NO | G TRANG THAI | H GHI CHU
 */
export function buildCustomerRow(orderData) {
  const { orderInfo, products, customer } = orderData;

  const tongHoaDon = products.reduce(
    (sum, p) => sum + (p.soLuong || 0) * (p.donGiaBan || 0),
    0,
  );

  const soTienDaTra = Number(orderInfo.soTienDaTra || 0);
  let tienNo = tongHoaDon;
  if (orderInfo.trangThai === "Đã thanh toán") tienNo = 0;
  if (orderInfo.trangThai === "Trả một phần") {
    tienNo = Math.max(tongHoaDon - Math.max(soTienDaTra, 0), 0);
  }

  const ngayBan = formatDate(orderInfo.ngayBan);

  return [
    "",
    customer?.tenKhach || "",
    ngayBan,
    customer?.soDienThoai || "",
    orderInfo.maPhieu || "",
    tienNo,
    orderInfo.trangThai || "Đã thanh toán",
    orderInfo.ghiChu || "-",
  ];
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}
