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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let mockLatestOrderCode = "DH001";

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

const getCustomerCatalog = async () => {
  await sleep(150);
  return {
    success: true,
    data: MOCK_CUSTOMERS.filter(
      (c) => String(c?.tenKhach || "").trim().toLowerCase() !== "khách ghé thăm",
    ),
  };
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

const call = async (fnName, ...args) => {
  console.log(`[Local Mock API] call: ${fnName}`, args);
  if (fnName === "helloServer") return helloServer();
  if (fnName === "login") return login(args[0], args[1]);
  if (fnName === "getUserInfo") return getUserInfo(args[0]);
  if (fnName === "getDemoAccounts") return getDemoAccounts();
  if (fnName === "getGlobalNotice") return getGlobalNotice();
  if (fnName === "getNextOrderFormDefaults") return getNextOrderFormDefaults();
  if (fnName === "getProductCatalog") return getProductCatalog();
  if (fnName === "getCustomerCatalog") return getCustomerCatalog();
  if (fnName === "createOrder") return createOrder(args[0]);

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
  getCustomerCatalog,
  createOrder,
};

