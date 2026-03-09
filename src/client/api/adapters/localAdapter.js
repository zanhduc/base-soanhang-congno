import { buildOrderRows, buildCustomerRow } from "../../../core/core.js";

const MOCK_ACCOUNTS = [
  {
    email: "admin@demo.com",
    password: "admin123",
    name: "Admin Demo",
    role: "admin",
    department: "IT",
  },
  {
    email: "user@demo.com",
    password: "user123",
    name: "User Demo",
    role: "user",
    department: "Sales",
  },
  {
    email: "testapi@demo.com",
    password: "testapi",
    name: "dev",
    role: "dev",
    department: "dev",
  },
];

const MOCK_PRODUCTS = [
  { tenSanPham: "Nước suối Aquafina 500ml", donVi: "Chai", donGiaBan: 10000, giaVon: 6000 },
  { tenSanPham: "Mì gói Hảo Hảo", donVi: "Gói", donGiaBan: 5000, giaVon: 3500 },
  { tenSanPham: "Bánh Oreo", donVi: "Gói", donGiaBan: 15000, giaVon: 10000 },
  { tenSanPham: "Sữa tươi Vinamilk 180ml", donVi: "Hộp", donGiaBan: 8000, giaVon: 5500 },
  { tenSanPham: "Coca Cola lon 330ml", donVi: "Lon", donGiaBan: 12000, giaVon: 8000 },
];

const MOCK_CUSTOMERS = [
  { tenKhach: "Nguyễn Văn A", soDienThoai: "0908123456" },
  { tenKhach: "Trần Thị Lan", soDienThoai: "0912345678" },
  { tenKhach: "Lê Hoàng Nam", soDienThoai: "0934567891" },
  { tenKhach: "Khách ghé thăm", soDienThoai: "" },
];

const MOCK_ORDER_HISTORY = [
  {
    maPhieu: "DH012",
    ngayBan: "2026-03-09",
    tenKhach: "Nguyễn Văn A",
    tienNo: 0,
    tongHoaDon: 45000,
    ghiChu: "Khách quen",
    trangThai: "Đã thanh toán",
    products: [
      { tenSanPham: "Mì gói Hảo Hảo", donVi: "Gói", soLuong: 3, giaVon: 3500, donGiaBan: 5000, thanhTien: 15000 },
      { tenSanPham: "Bánh Oreo", donVi: "Gói", soLuong: 2, giaVon: 10000, donGiaBan: 15000, thanhTien: 30000 },
    ],
  },
  {
    maPhieu: "DH011",
    ngayBan: "2026-03-08",
    tenKhach: "Trần Thị Lan",
    tienNo: 9000,
    tongHoaDon: 24000,
    ghiChu: "-",
    trangThai: "Trả một phần",
    products: [
      { tenSanPham: "Coca Cola lon 330ml", donVi: "Lon", soLuong: 2, giaVon: 8000, donGiaBan: 12000, thanhTien: 24000 },
    ],
  },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let mockLatestOrderCode = "DH001";
const foldText = (v) =>
  String(v || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .trim();

const getTodayInputDate = () => {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().split("T")[0];
};

const incrementOrderCode = (value) => {
  const raw = String(value ?? "").trim();
  if (!raw) return "01";

  const m = raw.match(/^(.*?)(\d+)$/);
  if (!m) return raw + "1";

  const prefix = m[1];
  const digits = m[2];
  const next = String(parseInt(digits, 10) + 1).padStart(digits.length, "0");
  return prefix + next;
};

const helloServer = async () => {
  await sleep(300);
  return "Hello from Local MOCK Server! Sheet: account";
};

const login = async (email, password) => {
  await sleep(500);
  const user = MOCK_ACCOUNTS.find(
    (u) => u.email === email && u.password === password,
  );
  if (user) {
    const { password: _, ...data } = user;
    return { success: true, data, message: "Đăng nhập thành công! (Mock)" };
  }
  return {
    success: false,
    data: null,
    message: "Email hoặc mật khẩu không đúng! (Mock)",
  };
};

const getUserInfo = async (email) => {
  await sleep(300);
  const user = MOCK_ACCOUNTS.find((u) => u.email === email);
  if (user) return { success: true, data: user };
  return { success: false, message: "Không tìm thấy tài khoản (Mock)" };
};

const getDemoAccounts = async () => {
  await sleep(300);
  return {
    success: true,
    data: MOCK_ACCOUNTS.map((a) => ({
      email: a.email,
      password: a.password,
      role: a.role,
      name: a.name,
    })),
  };
};

const getGlobalNotice = async () => {
  await sleep(200);
  return [
    {
      base: "",
      message: "Hệ thống sẽ có bản cập nhật mới 1.2",
      level: "info",
      version: "1.0",
      changelog:
        "• Thêm chức năng thông báo toàn hệ thống\n• Sửa lỗi đăng nhập\n• Cải thiện hiệu suất tải trang",
    },
  ];
};

const getNextOrderFormDefaults = async () => {
  await sleep(150);
  return {
    success: true,
    data: {
      maPhieu: incrementOrderCode(mockLatestOrderCode),
      ngayBan: getTodayInputDate(),
    },
  };
};

const getProductCatalog = async () => {
  await sleep(150);
  return {
    success: true,
    data: MOCK_PRODUCTS,
  };
};

const updateProductCatalogItem = async (payload) => {
  await sleep(180);
  const p = payload || {};
  const originalTenSanPham = String(p.originalTenSanPham || "").trim();
  const originalDonVi = String(p.originalDonVi || "").trim();
  const tenSanPham = String(p.tenSanPham || "").trim();
  const donVi = String(p.donVi || "").trim();
  const donGiaBan = Math.max(Number(p.donGiaBan || 0), 0);
  const giaVon = Math.max(Number(p.giaVon || 0), 0);

  if (!originalTenSanPham || !originalDonVi) {
    return { success: false, message: "Thiếu thông tin sản phẩm gốc (Mock)" };
  }
  if (!tenSanPham) return { success: false, message: "Tên sản phẩm không được để trống (Mock)" };
  if (!donVi) return { success: false, message: "Đơn vị không được để trống (Mock)" };
  if (donGiaBan <= 0) return { success: false, message: "Đơn giá bán phải lớn hơn 0 (Mock)" };

  const oldKey = `${foldText(originalTenSanPham)}||${foldText(originalDonVi)}`;
  const newKey = `${foldText(tenSanPham)}||${foldText(donVi)}`;
  const sourceIdx = MOCK_PRODUCTS.findIndex(
    (x) => `${foldText(x.tenSanPham)}||${foldText(x.donVi)}` === oldKey,
  );
  if (sourceIdx < 0) return { success: false, message: "Không tìm thấy sản phẩm để cập nhật (Mock)" };

  const targetIdx = MOCK_PRODUCTS.findIndex(
    (x) => `${foldText(x.tenSanPham)}||${foldText(x.donVi)}` === newKey,
  );
  if (targetIdx >= 0 && targetIdx !== sourceIdx) {
    MOCK_PRODUCTS[targetIdx] = { ...MOCK_PRODUCTS[targetIdx], tenSanPham, donVi, donGiaBan, giaVon };
    MOCK_PRODUCTS.splice(sourceIdx, 1);
  } else {
    MOCK_PRODUCTS[sourceIdx] = { ...MOCK_PRODUCTS[sourceIdx], tenSanPham, donVi, donGiaBan, giaVon };
  }
  return { success: true, message: "Cập nhật sản phẩm thành công! (Mock)" };
};

const createProductCatalogItem = async (payload) => {
  await sleep(180);
  const p = payload || {};
  const tenSanPham = String(p.tenSanPham || "").trim();
  const donVi = String(p.donVi || "").trim();
  const donGiaBan = Math.max(Number(p.donGiaBan || 0), 0);
  const giaVon = Math.max(Number(p.giaVon || 0), 0);

  if (!tenSanPham) return { success: false, message: "Tên sản phẩm không được để trống (Mock)" };
  if (!donVi) return { success: false, message: "Đơn vị không được để trống (Mock)" };
  if (donGiaBan <= 0) return { success: false, message: "Đơn giá bán phải lớn hơn 0 (Mock)" };
  const key = `${foldText(tenSanPham)}||${foldText(donVi)}`;
  const existed = MOCK_PRODUCTS.some((x) => `${foldText(x.tenSanPham)}||${foldText(x.donVi)}` === key);
  if (existed) return { success: false, message: "Sản phẩm với đơn vị này đã tồn tại (Mock)" };

  MOCK_PRODUCTS.push({ tenSanPham, donVi, donGiaBan, giaVon });
  return { success: true, message: "Đã thêm sản phẩm thành công! (Mock)" };
};

const deleteProductCatalogItem = async (payload) => {
  await sleep(180);
  const p = payload || {};
  const tenSanPham = String(p.tenSanPham || "").trim();
  const donVi = String(p.donVi || "").trim();
  if (!tenSanPham || !donVi) return { success: false, message: "Thiếu tên sản phẩm hoặc đơn vị (Mock)" };
  const key = `${foldText(tenSanPham)}||${foldText(donVi)}`;
  const before = MOCK_PRODUCTS.length;
  for (let i = MOCK_PRODUCTS.length - 1; i >= 0; i--) {
    if (`${foldText(MOCK_PRODUCTS[i].tenSanPham)}||${foldText(MOCK_PRODUCTS[i].donVi)}` === key) {
      MOCK_PRODUCTS.splice(i, 1);
      break;
    }
  }
  if (before === MOCK_PRODUCTS.length) return { success: false, message: "Không tìm thấy sản phẩm để xóa (Mock)" };
  return { success: true, message: "Đã xóa sản phẩm! (Mock)" };
};

const getCustomerCatalog = async () => {
  await sleep(150);
  return {
    success: true,
    data: MOCK_CUSTOMERS.filter(
      (c) => String(c?.tenKhach || "").trim().toLowerCase() !== "khách ghé thăm",
    ),
  };
};

const getOrderHistory = async () => {
  await sleep(180);
  return {
    success: true,
    data: MOCK_ORDER_HISTORY,
  };
};

const normalizeDebtStatus = (value) => {
  const key = foldText(value).replace(/\s+/g, " ");
  if (key.includes("tra mot phan") || key.includes("tra 1 phan")) return "Trả một phần";
  if (key === "no" || key.includes(" no ")) return "Nợ";
  return "Đã thanh toán";
};

const getPhoneByCustomerName = (tenKhach) => {
  const key = foldText(tenKhach);
  const found = MOCK_CUSTOMERS.find((c) => foldText(c.tenKhach) === key);
  return found?.soDienThoai || "";
};

const getDebtCustomers = async () => {
  await sleep(180);
  return {
    success: true,
    data: MOCK_ORDER_HISTORY.map((o, idx) => ({
      stt: idx + 1,
      tenKhach: o.tenKhach || "Khách ghé thăm",
      ngayBan: o.ngayBan || "",
      soDienThoai: o.soDienThoai || getPhoneByCustomerName(o.tenKhach),
      maPhieu: o.maPhieu,
      tienNo: Number(o.tienNo || 0),
      trangThai: o.trangThai || "Đã thanh toán",
      ghiChu: o.ghiChu || "-",
    })),
  };
};

const updateDebtCustomer = async (payload) => {
  await sleep(250);
  const p = payload || {};
  const maPhieuOriginal = String(p.maPhieuOriginal || p.maPhieu || "").trim();
  if (!maPhieuOriginal) return { success: false, message: "Thiếu mã phiếu gốc (Mock)" };

  const idx = MOCK_ORDER_HISTORY.findIndex((o) => String(o.maPhieu || "").trim() === maPhieuOriginal);
  if (idx < 0) return { success: false, message: "Không tìm thấy dữ liệu công nợ để cập nhật (Mock)" };

  const maPhieu = String(p.maPhieu || maPhieuOriginal).trim() || maPhieuOriginal;
  const tenKhach = String(p.tenKhach || "").trim() || "Khách ghé thăm";
  const soDienThoai = String(p.soDienThoai || "").trim();
  const ngayBan = String(p.ngayBan || "").trim() || MOCK_ORDER_HISTORY[idx].ngayBan;
  const tienNo = Math.max(Number(p.tienNo || 0), 0);
  const trangThai = normalizeDebtStatus(p.trangThai);
  const ghiChu = String(p.ghiChu || "-").trim() || "-";

  MOCK_ORDER_HISTORY[idx] = {
    ...MOCK_ORDER_HISTORY[idx],
    maPhieu,
    tenKhach,
    soDienThoai,
    ngayBan,
    tienNo,
    trangThai,
    ghiChu,
  };

  const cIdx = MOCK_CUSTOMERS.findIndex((c) => foldText(c.tenKhach) === foldText(tenKhach));
  if (cIdx >= 0) {
    MOCK_CUSTOMERS[cIdx] = { ...MOCK_CUSTOMERS[cIdx], soDienThoai: soDienThoai || MOCK_CUSTOMERS[cIdx].soDienThoai };
  } else if (tenKhach && foldText(tenKhach) !== "khach ghe tham") {
    MOCK_CUSTOMERS.push({ tenKhach, soDienThoai });
  }

  return { success: true, message: "Cập nhật công nợ thành công! (Mock)" };
};

const settleAllDebtCustomers = async () => {
  await sleep(260);
  let affected = 0;
  for (let i = 0; i < MOCK_ORDER_HISTORY.length; i++) {
    const row = MOCK_ORDER_HISTORY[i];
    const key = foldText(row.trangThai);
    const shouldSettle =
      key.includes("no") || key.includes("tra mot phan") || Number(row.tienNo || 0) > 0;
    if (!shouldSettle) continue;
    MOCK_ORDER_HISTORY[i] = {
      ...row,
      trangThai: "Đã thanh toán",
      tienNo: 0,
    };
    affected++;
  }
  if (!affected) {
    return { success: true, message: "Không có khách nào đang nợ để cập nhật (Mock)", data: { affected: 0 } };
  }
  return { success: true, message: "Đã cập nhật nhanh công nợ thành công! (Mock)", data: { affected } };
};

const createOrder = async (orderData) => {
  await sleep(600);
  const orderRows = buildOrderRows(orderData);
  const customerRow = orderData.customer ? buildCustomerRow(orderData) : null;

  if (orderData?.orderInfo?.maPhieu) {
    mockLatestOrderCode = String(orderData.orderInfo.maPhieu);
  }

  console.log("[Mock] DON_HANG rows:", orderRows);
  if (customerRow) console.log("[Mock] KHACH row:", customerRow);
  return { success: true, message: "Đơn hàng đã được tạo thành công! (Mock)" };
};

const updateOrder = async (payload) => {
  await sleep(450);
  const maPhieuOriginal = String(payload?.maPhieuOriginal || "").trim();
  const orderInfo = payload?.orderInfo || {};
  const products = Array.isArray(payload?.products) ? payload.products : [];
  if (!maPhieuOriginal) return { success: false, message: "Thiếu mã phiếu gốc (Mock)" };
  if (!products.length) return { success: false, message: "Đơn hàng phải có sản phẩm (Mock)" };

  const idx = MOCK_ORDER_HISTORY.findIndex((o) => o.maPhieu === maPhieuOriginal);
  if (idx < 0) return { success: false, message: "Không tìm thấy hóa đơn để sửa (Mock)" };

  const tongHoaDon = products.reduce((sum, p) => sum + Number(p.soLuong || 0) * Number(p.donGiaBan || 0), 0);
  const statusCode = String(orderInfo.trangThaiCode || "PAID").toUpperCase();
  const soTienDaTra = Number(orderInfo.soTienDaTra || 0);
  let tienNo = 0;
  if (statusCode === "DEBT") tienNo = tongHoaDon;
  if (statusCode === "PARTIAL") tienNo = Math.max(tongHoaDon - Math.max(soTienDaTra, 0), 0);

  MOCK_ORDER_HISTORY[idx] = {
    ...MOCK_ORDER_HISTORY[idx],
    maPhieu: String(orderInfo.maPhieu || maPhieuOriginal).trim() || maPhieuOriginal,
    ngayBan: String(orderInfo.ngayBan || MOCK_ORDER_HISTORY[idx].ngayBan),
    tenKhach: String(payload?.customer?.tenKhach || "").trim() || "Khách ghé thăm",
    tongHoaDon,
    tienNo,
    ghiChu: String(orderInfo.ghiChu || "-"),
    trangThai:
      statusCode === "PARTIAL"
        ? "Trả một phần"
        : statusCode === "DEBT"
          ? "Nợ"
          : "Đã thanh toán",
    products: products.map((p) => ({
      tenSanPham: p.tenSanPham,
      donVi: p.donVi,
      soLuong: Number(p.soLuong || 0),
      giaVon: Number(p.giaVon || 0),
      donGiaBan: Number(p.donGiaBan || 0),
      thanhTien: Number(p.soLuong || 0) * Number(p.donGiaBan || 0),
    })),
  };

  return { success: true, message: "Cập nhật hóa đơn thành công! (Mock)" };
};

const deleteOrder = async (maPhieu) => {
  await sleep(300);
  const key = String(maPhieu || "").trim();
  if (!key) return { success: false, message: "Thiếu mã phiếu (Mock)" };
  const before = MOCK_ORDER_HISTORY.length;
  for (let i = MOCK_ORDER_HISTORY.length - 1; i >= 0; i--) {
    if (String(MOCK_ORDER_HISTORY[i]?.maPhieu || "").trim() === key) {
      MOCK_ORDER_HISTORY.splice(i, 1);
    }
  }
  if (before === MOCK_ORDER_HISTORY.length) {
    return { success: false, message: "Không tìm thấy hóa đơn để xóa (Mock)" };
  }
  return { success: true, message: "Xóa hóa đơn thành công! (Mock)" };
};

const call = async (fnName, ...args) => {
  console.log(`[Local Mock API] call: ${fnName}`, args);
  if (fnName === "helloServer") return helloServer();
  if (fnName === "login") return login(args[0], args[1]);
  if (fnName === "getUserInfo") return getUserInfo(args[0]);
  if (fnName === "getDemoAccounts") return getDemoAccounts();
  if (fnName === "getGlobalNotice") return getGlobalNotice();
  if (fnName === "getNextOrderFormDefaults") return getNextOrderFormDefaults();
  if (fnName === "getProductCatalog") return getProductCatalog();
  if (fnName === "updateProductCatalogItem") return updateProductCatalogItem(args[0]);
  if (fnName === "createProductCatalogItem") return createProductCatalogItem(args[0]);
  if (fnName === "deleteProductCatalogItem") return deleteProductCatalogItem(args[0]);
  if (fnName === "getCustomerCatalog") return getCustomerCatalog();
  if (fnName === "getDebtCustomers") return getDebtCustomers();
  if (fnName === "updateDebtCustomer") return updateDebtCustomer(args[0]);
  if (fnName === "settleAllDebtCustomers") return settleAllDebtCustomers();
  if (fnName === "getOrderHistory") return getOrderHistory();
  if (fnName === "createOrder") return createOrder(args[0]);
  if (fnName === "updateOrder") return updateOrder(args[0]);
  if (fnName === "deleteOrder") return deleteOrder(args[0]);

  throw new Error(
    `[Local Mock API] Function ${fnName} not implemented in localAdapter`,
  );
};

export const localAdapter = {
  call,
  helloServer,
  login,
  getUserInfo,
  getDemoAccounts,
  getGlobalNotice,
  getNextOrderFormDefaults,
  getProductCatalog,
  updateProductCatalogItem,
  createProductCatalogItem,
  deleteProductCatalogItem,
  getCustomerCatalog,
  getDebtCustomers,
  updateDebtCustomer,
  settleAllDebtCustomers,
  getOrderHistory,
  createOrder,
  updateOrder,
  deleteOrder,
};

