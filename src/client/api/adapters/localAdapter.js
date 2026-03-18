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
  {
    tenSanPham: "Nước suối Aquafina 500ml",
    nhomHang: "Nước",
    donVi: "Chai",
    donGiaBan: 10000,
    giaVon: 6000,
  },
  {
    tenSanPham: "Mì gói Hảo Hảo",
    nhomHang: "Đồ đóng gói",
    donVi: "Gói",
    donGiaBan: 5000,
    giaVon: 3500,
  },
  {
    tenSanPham: "Bánh Oreo",
    nhomHang: "Bánh kẹo",
    donVi: "Gói",
    donGiaBan: 15000,
    giaVon: 10000,
  },
  {
    tenSanPham: "Sữa tươi Vinamilk 180ml",
    nhomHang: "Nước",
    donVi: "Hộp",
    donGiaBan: 8000,
    giaVon: 5500,
  },
  {
    tenSanPham: "Coca Cola lon 330ml",
    nhomHang: "Nước",
    donVi: "Lon",
    donGiaBan: 12000,
    giaVon: 8000,
  },
];

const MOCK_CUSTOMERS = [
  { tenKhach: "Nguyễn Văn A", soDienThoai: "0908123456" },
  { tenKhach: "Trần Thị Lan", soDienThoai: "0912345678" },
  { tenKhach: "Lê Hoàng Nam", soDienThoai: "0934567891" },
  { tenKhach: "Khách ghé thăm", soDienThoai: "" },
];

const MOCK_BANK_CONFIG = {
  bankCode: "mbbank",
  accountNumber: "201130122003",
  accountName: "Nguyễn Anh Đức",
};

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
      {
        tenSanPham: "Mì gói Hảo Hảo",
        donVi: "Gói",
        soLuong: 3,
        giaVon: 3500,
        donGiaBan: 5000,
        thanhTien: 15000,
      },
      {
        tenSanPham: "Bánh Oreo",
        donVi: "Gói",
        soLuong: 2,
        giaVon: 10000,
        donGiaBan: 15000,
        thanhTien: 30000,
      },
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
      {
        tenSanPham: "Coca Cola lon 330ml",
        donVi: "Lon",
        soLuong: 2,
        giaVon: 8000,
        donGiaBan: 12000,
        thanhTien: 24000,
      },
    ],
  },
  {
    maPhieu: "DH010",
    ngayBan: "2026-03-07",
    tenKhach: "Lê Hoàng Nam",
    tienNo: 0,
    tongHoaDon: 30000,
    ghiChu: "Bán sỉ",
    trangThai: "Đã thanh toán",
    products: [
      {
        tenSanPham: "Nước suối Aquafina 500ml",
        donVi: "Chai",
        soLuong: 3,
        giaVon: 6000,
        donGiaBan: 10000,
        thanhTien: 30000,
      },
    ],
  },
  {
    maPhieu: "DH009",
    ngayBan: "2026-03-06",
    tenKhach: "Nguyễn Thị Hoa",
    tienNo: 5000,
    tongHoaDon: 20000,
    ghiChu: "-",
    trangThai: "Trả một phần",
    products: [
      {
        tenSanPham: "Mì gói Hảo Hảo",
        donVi: "Gói",
        soLuong: 4,
        giaVon: 3500,
        donGiaBan: 5000,
        thanhTien: 20000,
      },
    ],
  },
  {
    maPhieu: "DH008",
    ngayBan: "2026-03-05",
    tenKhach: "Phạm Thị Mai",
    tienNo: 0,
    tongHoaDon: 12000,
    ghiChu: "Khách quen",
    trangThai: "Đã thanh toán",
    products: [
      {
        tenSanPham: "Coca Cola lon 330ml",
        donVi: "Lon",
        soLuong: 1,
        giaVon: 8000,
        donGiaBan: 12000,
        thanhTien: 12000,
      },
    ],
  },
  {
    maPhieu: "DH007",
    ngayBan: "2026-03-04",
    tenKhach: "Bùi Văn Khánh",
    tienNo: 0,
    tongHoaDon: 45000,
    ghiChu: "-",
    trangThai: "Đã thanh toán",
    products: [
      {
        tenSanPham: "Bánh Oreo",
        donVi: "Gói",
        soLuong: 3,
        giaVon: 10000,
        donGiaBan: 15000,
        thanhTien: 45000,
      },
    ],
  },
  {
    maPhieu: "DH006",
    ngayBan: "2026-03-03",
    tenKhach: "Vũ Thị Hạnh",
    tienNo: 0,
    tongHoaDon: 36000,
    ghiChu: "-",
    trangThai: "Đã thanh toán",
    products: [
      {
        tenSanPham: "Coca Cola lon 330ml",
        donVi: "Lon",
        soLuong: 3,
        giaVon: 8000,
        donGiaBan: 12000,
        thanhTien: 36000,
      },
    ],
  },
  {
    maPhieu: "DH005",
    ngayBan: "2026-03-02",
    tenKhach: "Nguyễn Minh Tuấn",
    tienNo: 0,
    tongHoaDon: 20000,
    ghiChu: "Bán lẻ",
    trangThai: "Đã thanh toán",
    products: [
      {
        tenSanPham: "Nước suối Aquafina 500ml",
        donVi: "Chai",
        soLuong: 2,
        giaVon: 6000,
        donGiaBan: 10000,
        thanhTien: 20000,
      },
    ],
  },
  {
    maPhieu: "DH004",
    ngayBan: "2026-03-01",
    tenKhach: "Trần Quốc Bảo",
    tienNo: 10000,
    tongHoaDon: 30000,
    ghiChu: "Khách mới",
    trangThai: "Trả một phần",
    products: [
      {
        tenSanPham: "Bánh Oreo",
        donVi: "Gói",
        soLuong: 2,
        giaVon: 10000,
        donGiaBan: 15000,
        thanhTien: 30000,
      },
    ],
  },
  {
    maPhieu: "DH003",
    ngayBan: "2026-02-28",
    tenKhach: "Phạm Thị Mai",
    tienNo: 0,
    tongHoaDon: 55000,
    ghiChu: "-",
    trangThai: "Đã thanh toán",
    products: [
      {
        tenSanPham: "Sữa tươi Vinamilk 180ml",
        donVi: "Hộp",
        soLuong: 5,
        giaVon: 5500,
        donGiaBan: 8000,
        thanhTien: 40000,
      },
      {
        tenSanPham: "Mì gói Hảo Hảo",
        donVi: "Gói",
        soLuong: 3,
        giaVon: 3500,
        donGiaBan: 5000,
        thanhTien: 15000,
      },
    ],
  },
  {
    maPhieu: "DH002",
    ngayBan: "2026-02-27",
    tenKhach: "Lê Hoàng Nam",
    tienNo: 0,
    tongHoaDon: 12000,
    ghiChu: "Bán nhanh",
    trangThai: "Đã thanh toán",
    products: [
      {
        tenSanPham: "Mì gói Hảo Hảo",
        donVi: "Gói",
        soLuong: 2,
        giaVon: 3500,
        donGiaBan: 5000,
        thanhTien: 10000,
      },
      {
        tenSanPham: "Nước suối Aquafina 500ml",
        donVi: "Chai",
        soLuong: 1,
        giaVon: 6000,
        donGiaBan: 10000,
        thanhTien: 10000,
      },
    ],
  },
  {
    maPhieu: "DH001",
    ngayBan: "2026-02-26",
    tenKhach: "Nguyễn Thị Hoa",
    tienNo: 0,
    tongHoaDon: 18000,
    ghiChu: "-",
    trangThai: "Đã thanh toán",
    products: [
      {
        tenSanPham: "Coca Cola lon 330ml",
        donVi: "Lon",
        soLuong: 1,
        giaVon: 8000,
        donGiaBan: 12000,
        thanhTien: 12000,
      },
      {
        tenSanPham: "Mì gói Hảo Hảo",
        donVi: "Gói",
        soLuong: 2,
        giaVon: 3500,
        donGiaBan: 5000,
        thanhTien: 10000,
      },
    ],
  },
  {
    maPhieu: "DH000",
    ngayBan: "2026-02-15",
    tenKhach: "Trần Thị Lan",
    tienNo: 0,
    tongHoaDon: 30000,
    ghiChu: "-",
    trangThai: "Đã thanh toán",
    products: [
      {
        tenSanPham: "Bánh Oreo",
        donVi: "Gói",
        soLuong: 2,
        giaVon: 10000,
        donGiaBan: 15000,
        thanhTien: 30000,
      },
    ],
  },
  {
    maPhieu: "DH-2026-01",
    ngayBan: "2026-01-20",
    tenKhach: "Nguyễn Văn A",
    tienNo: 0,
    tongHoaDon: 40000,
    ghiChu: "Đầu năm",
    trangThai: "Đã thanh toán",
    products: [
      {
        tenSanPham: "Sữa tươi Vinamilk 180ml",
        donVi: "Hộp",
        soLuong: 5,
        giaVon: 5500,
        donGiaBan: 8000,
        thanhTien: 40000,
      },
    ],
  },
  {
    maPhieu: "DH-2025-12",
    ngayBan: "2025-12-18",
    tenKhach: "Bùi Văn Khánh",
    tienNo: 0,
    tongHoaDon: 36000,
    ghiChu: "-",
    trangThai: "Đã thanh toán",
    products: [
      {
        tenSanPham: "Coca Cola lon 330ml",
        donVi: "Lon",
        soLuong: 3,
        giaVon: 8000,
        donGiaBan: 12000,
        thanhTien: 36000,
      },
    ],
  },
  {
    maPhieu: "DH-2025-11",
    ngayBan: "2025-11-22",
    tenKhach: "Phạm Thị Mai",
    tienNo: 0,
    tongHoaDon: 25000,
    ghiChu: "-",
    trangThai: "Đã thanh toán",
    products: [
      {
        tenSanPham: "Mì gói Hảo Hảo",
        donVi: "Gói",
        soLuong: 5,
        giaVon: 3500,
        donGiaBan: 5000,
        thanhTien: 25000,
      },
    ],
  },
  {
    maPhieu: "DH-2025-10",
    ngayBan: "2025-10-14",
    tenKhach: "Vũ Thị Hạnh",
    tienNo: 0,
    tongHoaDon: 20000,
    ghiChu: "Tháng 10",
    trangThai: "Đã thanh toán",
    products: [
      {
        tenSanPham: "Nước suối Aquafina 500ml",
        donVi: "Chai",
        soLuong: 2,
        giaVon: 6000,
        donGiaBan: 10000,
        thanhTien: 20000,
      },
    ],
  },
  {
    maPhieu: "DH-2025-09",
    ngayBan: "2025-09-05",
    tenKhach: "Nguyễn Thị Hoa",
    tienNo: 0,
    tongHoaDon: 60000,
    ghiChu: "Tháng 9",
    trangThai: "Đã thanh toán",
    products: [
      {
        tenSanPham: "Bánh Oreo",
        donVi: "Gói",
        soLuong: 4,
        giaVon: 10000,
        donGiaBan: 15000,
        thanhTien: 60000,
      },
    ],
  },
  {
    maPhieu: "DH-2025-08",
    ngayBan: "2025-08-19",
    tenKhach: "Lê Hoàng Nam",
    tienNo: 0,
    tongHoaDon: 28000,
    ghiChu: "-",
    trangThai: "Đã thanh toán",
    products: [
      {
        tenSanPham: "Coca Cola lon 330ml",
        donVi: "Lon",
        soLuong: 2,
        giaVon: 8000,
        donGiaBan: 12000,
        thanhTien: 24000,
      },
      {
        tenSanPham: "Mì gói Hảo Hảo",
        donVi: "Gói",
        soLuong: 1,
        giaVon: 3500,
        donGiaBan: 5000,
        thanhTien: 5000,
      },
    ],
  },
  {
    maPhieu: "DH-2025-07",
    ngayBan: "2025-07-11",
    tenKhach: "Trần Quốc Bảo",
    tienNo: 0,
    tongHoaDon: 32000,
    ghiChu: "-",
    trangThai: "Đã thanh toán",
    products: [
      {
        tenSanPham: "Sữa tươi Vinamilk 180ml",
        donVi: "Hộp",
        soLuong: 4,
        giaVon: 5500,
        donGiaBan: 8000,
        thanhTien: 32000,
      },
    ],
  },
  {
    maPhieu: "DH-2025-06",
    ngayBan: "2025-06-27",
    tenKhach: "Nguyễn Minh Tuấn",
    tienNo: 0,
    tongHoaDon: 18000,
    ghiChu: "-",
    trangThai: "Đã thanh toán",
    products: [
      {
        tenSanPham: "Nước suối Aquafina 500ml",
        donVi: "Chai",
        soLuong: 1,
        giaVon: 6000,
        donGiaBan: 10000,
        thanhTien: 10000,
      },
      {
        tenSanPham: "Mì gói Hảo Hảo",
        donVi: "Gói",
        soLuong: 2,
        giaVon: 3500,
        donGiaBan: 5000,
        thanhTien: 10000,
      },
    ],
  },
  {
    maPhieu: "DH-2025-05",
    ngayBan: "2025-05-16",
    tenKhach: "Phạm Thị Mai",
    tienNo: 0,
    tongHoaDon: 24000,
    ghiChu: "-",
    trangThai: "Đã thanh toán",
    products: [
      {
        tenSanPham: "Coca Cola lon 330ml",
        donVi: "Lon",
        soLuong: 2,
        giaVon: 8000,
        donGiaBan: 12000,
        thanhTien: 24000,
      },
    ],
  },
  {
    maPhieu: "DH-2025-04",
    ngayBan: "2025-04-09",
    tenKhach: "Trần Thị Lan",
    tienNo: 0,
    tongHoaDon: 15000,
    ghiChu: "-",
    trangThai: "Đã thanh toán",
    products: [
      {
        tenSanPham: "Mì gói Hảo Hảo",
        donVi: "Gói",
        soLuong: 3,
        giaVon: 3500,
        donGiaBan: 5000,
        thanhTien: 15000,
      },
    ],
  },
  {
    maPhieu: "DH-2025-03",
    ngayBan: "2025-03-02",
    tenKhach: "Nguyễn Văn A",
    tienNo: 0,
    tongHoaDon: 20000,
    ghiChu: "-",
    trangThai: "Đã thanh toán",
    products: [
      {
        tenSanPham: "Nước suối Aquafina 500ml",
        donVi: "Chai",
        soLuong: 2,
        giaVon: 6000,
        donGiaBan: 10000,
        thanhTien: 20000,
      },
    ],
  },
  {
    maPhieu: "DH-2025-02",
    ngayBan: "2025-02-08",
    tenKhach: "Vũ Thị Hạnh",
    tienNo: 0,
    tongHoaDon: 10000,
    ghiChu: "-",
    trangThai: "Đã thanh toán",
    products: [
      {
        tenSanPham: "Mì gói Hảo Hảo",
        donVi: "Gói",
        soLuong: 2,
        giaVon: 3500,
        donGiaBan: 5000,
        thanhTien: 10000,
      },
    ],
  },
  {
    maPhieu: "DH-2025-01",
    ngayBan: "2025-01-12",
    tenKhach: "Lê Hoàng Nam",
    tienNo: 0,
    tongHoaDon: 30000,
    ghiChu: "-",
    trangThai: "Đã thanh toán",
    products: [
      {
        tenSanPham: "Bánh Oreo",
        donVi: "Gói",
        soLuong: 2,
        giaVon: 10000,
        donGiaBan: 15000,
        thanhTien: 30000,
      },
    ],
  },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let mockLatestOrderCode = "DH001";
let mockLatestReceiptCode = "NK001";
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
    return {
      success: true,
      data,
      message: "Đăng nhập thành công! (Mock)",
    };
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

const getNextInventoryReceiptDefaults = async () => {
  await sleep(150);
  return {
    success: true,
    data: {
      maPhieu: incrementOrderCode(mockLatestReceiptCode),
      ngayNhap: getTodayInputDate(),
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

const getBankConfig = async () => {
  await sleep(120);
  return {
    success: true,
    data: MOCK_BANK_CONFIG,
  };
};

const updateProductCatalogItem = async (payload) => {
  await sleep(180);
  const p = payload || {};
  const originalTenSanPham = String(p.originalTenSanPham || "").trim();
  const originalDonVi = String(p.originalDonVi || "").trim();
  const tenSanPham = String(p.tenSanPham || "").trim();
  const nhomHang = String(p.nhomHang || "").trim();
  const donVi = String(p.donVi || "").trim();
  const donGiaBan = Math.max(Number(p.donGiaBan || 0), 0);
  const giaVon = Math.max(Number(p.giaVon || 0), 0);

  if (!originalTenSanPham || !originalDonVi) {
    return {
      success: false,
      message: "Thiếu thông tin sản phẩm gốc (Mock)",
    };
  }
  if (!tenSanPham)
    return {
      success: false,
      message: "Tên sản phẩm không được để trống (Mock)",
    };
  if (!donVi)
    return {
      success: false,
      message: "Đơn vị không được để trống (Mock)",
    };
  if (donGiaBan <= 0)
    return {
      success: false,
      message: "Đơn giá bán phải lớn hơn 0 (Mock)",
    };

  const oldKey = `${foldText(originalTenSanPham)}||${foldText(originalDonVi)}`;
  const newKey = `${foldText(tenSanPham)}||${foldText(donVi)}`;
  const sourceIdx = MOCK_PRODUCTS.findIndex(
    (x) => `${foldText(x.tenSanPham)}||${foldText(x.donVi)}` === oldKey,
  );
  if (sourceIdx < 0)
    return {
      success: false,
      message: "Không tìm thấy sản phẩm để cập nhật (Mock)",
    };

  const targetIdx = MOCK_PRODUCTS.findIndex(
    (x) => `${foldText(x.tenSanPham)}||${foldText(x.donVi)}` === newKey,
  );
  if (targetIdx >= 0 && targetIdx !== sourceIdx) {
    MOCK_PRODUCTS[targetIdx] = {
      ...MOCK_PRODUCTS[targetIdx],
      tenSanPham,
      nhomHang,
      donVi,
      donGiaBan,
      giaVon,
    };
    MOCK_PRODUCTS.splice(sourceIdx, 1);
  } else {
    MOCK_PRODUCTS[sourceIdx] = {
      ...MOCK_PRODUCTS[sourceIdx],
      tenSanPham,
      nhomHang,
      donVi,
      donGiaBan,
      giaVon,
    };
  }
  return {
    success: true,
    message: "Cập nhật sản phẩm thành công! (Mock)",
  };
};

const createProductCatalogItem = async (payload) => {
  await sleep(180);
  const p = payload || {};
  const tenSanPham = String(p.tenSanPham || "").trim();
  const nhomHang = String(p.nhomHang || "").trim();
  const donVi = String(p.donVi || "").trim();
  const donGiaBan = Math.max(Number(p.donGiaBan || 0), 0);
  const giaVon = Math.max(Number(p.giaVon || 0), 0);

  if (!tenSanPham)
    return {
      success: false,
      message: "Tên sản phẩm không được để trống (Mock)",
    };
  if (!donVi)
    return {
      success: false,
      message: "Đơn vị không được để trống (Mock)",
    };
  if (donGiaBan <= 0)
    return {
      success: false,
      message: "Đơn giá bán phải lớn hơn 0 (Mock)",
    };
  const key = `${foldText(tenSanPham)}||${foldText(donVi)}`;
  const existed = MOCK_PRODUCTS.some(
    (x) => `${foldText(x.tenSanPham)}||${foldText(x.donVi)}` === key,
  );
  if (existed)
    return {
      success: false,
      message: "Sản phẩm với đơn vị này đã tồn tại (Mock)",
    };

  MOCK_PRODUCTS.push({ tenSanPham, nhomHang, donVi, donGiaBan, giaVon });
  return {
    success: true,
    message: "Đã thêm sản phẩm thành công! (Mock)",
  };
};

const deleteProductCatalogItem = async (payload) => {
  await sleep(180);
  const p = payload || {};
  const tenSanPham = String(p.tenSanPham || "").trim();
  const donVi = String(p.donVi || "").trim();
  if (!tenSanPham || !donVi)
    return {
      success: false,
      message: "Thiếu tên sản phẩm hoặc đơn vị (Mock)",
    };
  const key = `${foldText(tenSanPham)}||${foldText(donVi)}`;
  const before = MOCK_PRODUCTS.length;
  for (let i = MOCK_PRODUCTS.length - 1; i >= 0; i--) {
    if (
      `${foldText(MOCK_PRODUCTS[i].tenSanPham)}||${foldText(MOCK_PRODUCTS[i].donVi)}` ===
      key
    ) {
      MOCK_PRODUCTS.splice(i, 1);
      break;
    }
  }
  if (before === MOCK_PRODUCTS.length)
    return {
      success: false,
      message: "Không tìm thấy sản phẩm để xóa (Mock)",
    };
  return { success: true, message: "Đã xóa sản phẩm! (Mock)" };
};

const getCustomerCatalog = async () => {
  await sleep(150);
  return {
    success: true,
    data: MOCK_CUSTOMERS.filter(
      (c) =>
        String(c?.tenKhach || "")
          .trim()
          .toLowerCase() !== "khách ghé thăm",
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
  if (key.includes("tra mot phan") || key.includes("tra 1 phan"))
    return "Trả một phần";
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
  if (!maPhieuOriginal)
    return { success: false, message: "Thiếu mã phiếu gốc (Mock)" };

  const idx = MOCK_ORDER_HISTORY.findIndex(
    (o) => String(o.maPhieu || "").trim() === maPhieuOriginal,
  );
  if (idx < 0)
    return {
      success: false,
      message: "Không tìm thấy dữ liệu công nợ để cập nhật (Mock)",
    };

  const maPhieu =
    String(p.maPhieu || maPhieuOriginal).trim() || maPhieuOriginal;
  const tenKhach = String(p.tenKhach || "").trim() || "Khách ghé thăm";
  const soDienThoai = String(p.soDienThoai || "").trim();
  const ngayBan =
    String(p.ngayBan || "").trim() || MOCK_ORDER_HISTORY[idx].ngayBan;
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

  const cIdx = MOCK_CUSTOMERS.findIndex(
    (c) => foldText(c.tenKhach) === foldText(tenKhach),
  );
  if (cIdx >= 0) {
    MOCK_CUSTOMERS[cIdx] = {
      ...MOCK_CUSTOMERS[cIdx],
      soDienThoai: soDienThoai || MOCK_CUSTOMERS[cIdx].soDienThoai,
    };
  } else if (tenKhach && foldText(tenKhach) !== "khach ghe tham") {
    MOCK_CUSTOMERS.push({ tenKhach, soDienThoai });
  }

  return {
    success: true,
    message: "Cập nhật công nợ thành công! (Mock)",
  };
};

const settleAllDebtCustomers = async () => {
  await sleep(260);
  let affected = 0;
  for (let i = 0; i < MOCK_ORDER_HISTORY.length; i++) {
    const row = MOCK_ORDER_HISTORY[i];
    const key = foldText(row.trangThai);
    const shouldSettle =
      key.includes("no") ||
      key.includes("tra mot phan") ||
      Number(row.tienNo || 0) > 0;
    if (!shouldSettle) continue;
    MOCK_ORDER_HISTORY[i] = {
      ...row,
      trangThai: "Đã thanh toán",
      tienNo: 0,
    };
    affected++;
  }
  if (!affected) {
    return {
      success: true,
      message: "Không có khách nào đang nợ để cập nhật (Mock)",
      data: { affected: 0 },
    };
  }
  return {
    success: true,
    message: "Đã cập nhật nhanh công nợ thành công! (Mock)",
    data: { affected },
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
  return {
    success: true,
    message: "Đơn hàng đã được tạo thành công! (Mock)",
  };
};

const createInventoryReceipt = async (payload) => {
  await sleep(600);
  console.log("[Mock] Nhập Kho Payload:", payload);

  if (payload?.receiptInfo?.maPhieu) {
    mockLatestReceiptCode = String(payload.receiptInfo.maPhieu).trim();
  }

  if (payload && payload.products && payload.receiptInfo) {
    payload.products.forEach((p) => {
      MOCK_RECEIPT_HISTORY.unshift({
        maPhieu: payload.receiptInfo.maPhieu,
        ngayNhap: payload.receiptInfo.ngayNhap,
        nhaCungCap: payload.receiptInfo.nhaCungCap,
        maSanPham: p.maSanPham || "",
        tenSanPham: p.tenSanPham,
        nhomHang: p.nhomHang || "",
        hanSuDung: p.hanSuDung || "",
        donVi: p.donVi,
        soLuong: Number(p.soLuong || 0),
        donGiaNhap: Number(p.giaNhap ?? p.donGiaNhap ?? 0),
        thanhTien:
          Number(p.soLuong || 0) * Number(p.giaNhap ?? p.donGiaNhap ?? 0),
        tongTienPhieu: payload.receiptInfo.tongTienPhieu || 0,
        ghiChu: payload.receiptInfo.ghiChu || "",
        trangThai: payload.receiptInfo.trangThai || "",
      });

      const prodIdx = MOCK_PRODUCTS.findIndex(
        (mp) => mp.tenSanPham === p.tenSanPham && mp.donVi === p.donVi,
      );
      if (prodIdx >= 0) {
        MOCK_PRODUCTS[prodIdx].tonKho =
          (MOCK_PRODUCTS[prodIdx].tonKho || 0) + Number(p.soLuong || 0);
      }
    });
  }

  return { success: true, message: "Nhập kho thành công! (Mock)" };
};

const updateOrder = async (payload) => {
  await sleep(450);
  const maPhieuOriginal = String(payload?.maPhieuOriginal || "").trim();
  const orderInfo = payload?.orderInfo || {};
  const products = Array.isArray(payload?.products) ? payload.products : [];
  if (!maPhieuOriginal)
    return { success: false, message: "Thiếu mã phiếu gốc (Mock)" };
  if (!products.length)
    return {
      success: false,
      message: "Đơn hàng phải có sản phẩm (Mock)",
    };

  const idx = MOCK_ORDER_HISTORY.findIndex(
    (o) => o.maPhieu === maPhieuOriginal,
  );
  if (idx < 0)
    return {
      success: false,
      message: "Không tìm thấy hóa đơn để sửa (Mock)",
    };

  const tongHoaDon = products.reduce(
    (sum, p) => sum + Number(p.soLuong || 0) * Number(p.donGiaBan || 0),
    0,
  );
  const statusCode = String(orderInfo.trangThaiCode || "PAID").toUpperCase();
  const soTienDaTra = Number(orderInfo.soTienDaTra || 0);
  let tienNo = 0;
  if (statusCode === "DEBT") tienNo = tongHoaDon;
  if (statusCode === "PARTIAL")
    tienNo = Math.max(tongHoaDon - Math.max(soTienDaTra, 0), 0);

  MOCK_ORDER_HISTORY[idx] = {
    ...MOCK_ORDER_HISTORY[idx],
    maPhieu:
      String(orderInfo.maPhieu || maPhieuOriginal).trim() || maPhieuOriginal,
    ngayBan: String(orderInfo.ngayBan || MOCK_ORDER_HISTORY[idx].ngayBan),
    tenKhach:
      String(payload?.customer?.tenKhach || "").trim() || "Khách ghé thăm",
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

  return {
    success: true,
    message: "Cập nhật hóa đơn thành công! (Mock)",
  };
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
    return {
      success: false,
      message: "Không tìm thấy hóa đơn để xóa (Mock)",
    };
  }
  return { success: true, message: "Xóa hóa đơn thành công! (Mock)" };
};

const createReceiptPdf = async (maPhieu) => {
  await sleep(400);
  const key = String(maPhieu || "").trim();
  if (!key) return { success: false, message: "Thiếu mã phiếu. (Mock)" };
  return {
    success: true,
    url: "#",
    downloadUrl: "#",
    name: `Hoa-don-${key}.pdf`,
  };
};

const getInventory = async () => {
  await sleep(150);
  // Merge MOCK_PRODUCTS with some random tonKho for testing
  return {
    success: true,
    data: MOCK_PRODUCTS.map((p) => ({
      ...p,
      tonKho:
        p.tonKho !== undefined ? p.tonKho : Math.floor(Math.random() * 50) + 10,
    })),
  };
};

const MOCK_RECEIPT_HISTORY = [
  {
    maPhieu: "NH001",
    ngayNhap: "2023-10-01",
    nhaCungCap: "NCC A",
    tenSanPham: "Sản phẩm 1",
    donVi: "Cái",
    soLuong: 100,
    donGiaNhap: 50000,
    thanhTien: 5000000,
    tongTienPhieu: 15000000,
    ghiChu: "",
  },
  {
    maPhieu: "NH001",
    ngayNhap: "2023-10-01",
    nhaCungCap: "NCC A",
    tenSanPham: "Sản phẩm 2",
    donVi: "Hộp",
    soLuong: 50,
    donGiaNhap: 200000,
    thanhTien: 10000000,
    tongTienPhieu: 15000000,
    ghiChu: "",
  },
];

const getReceiptHistory = async () => {
  await sleep(150);
  return {
    success: true,
    data: MOCK_RECEIPT_HISTORY,
  };
};

const getAppSetting = async (key) => {
  await sleep(150);
  const val = localStorage.getItem("app_setting_" + key);
  return { success: true, data: val };
};

const setAppSetting = async (payload) => {
  await sleep(150);
  if (!payload || !payload.key)
    return { success: false, message: "Missing key" };
  localStorage.setItem("app_setting_" + payload.key, String(payload.value));
  return { success: true, message: "Đã lưu cài đặt (Mock)" };
};

const call = async (fnName, ...args) => {
  console.log(`[Local Mock API] call: ${fnName}`, args);
  if (fnName === "helloServer") return helloServer();
  if (fnName === "login") return login(args[0], args[1]);
  if (fnName === "getUserInfo") return getUserInfo(args[0]);
  if (fnName === "getDemoAccounts") return getDemoAccounts();
  if (fnName === "getGlobalNotice") return getGlobalNotice();
  if (fnName === "getNextOrderFormDefaults") return getNextOrderFormDefaults();
  if (fnName === "getNextInventoryReceiptDefaults")
    return getNextInventoryReceiptDefaults();
  if (fnName === "getProductCatalog") return getProductCatalog();
  if (fnName === "getBankConfig") return getBankConfig();
  if (fnName === "updateProductCatalogItem")
    return updateProductCatalogItem(args[0]);
  if (fnName === "createProductCatalogItem")
    return createProductCatalogItem(args[0]);
  if (fnName === "deleteProductCatalogItem")
    return deleteProductCatalogItem(args[0]);
  if (fnName === "getCustomerCatalog") return getCustomerCatalog();
  if (fnName === "getDebtCustomers") return getDebtCustomers();
  if (fnName === "updateDebtCustomer") return updateDebtCustomer(args[0]);
  if (fnName === "settleAllDebtCustomers") return settleAllDebtCustomers();
  if (fnName === "getOrderHistory") return getOrderHistory();
  if (fnName === "createReceiptPdf") return createReceiptPdf(args[0]);
  if (fnName === "createOrder") return createOrder(args[0]);
  if (fnName === "createInventoryReceipt")
    return createInventoryReceipt(args[0]);
  if (fnName === "updateOrder") return updateOrder(args[0]);
  if (fnName === "deleteOrder") return deleteOrder(args[0]);
  if (fnName === "getInventory") return getInventory();
  if (fnName === "getReceiptHistory") return getReceiptHistory();
  if (fnName === "getAppSetting") return getAppSetting(args[0]);
  if (fnName === "setAppSetting") return setAppSetting(args[0]);

  return { success: false, message: `Hàm ${fnName} chưa được mock.` };
};

export const localAdapter = {
  call,
  helloServer,
  login,
  getUserInfo,
  getDemoAccounts,
  getGlobalNotice,
  getNextOrderFormDefaults,
  getNextInventoryReceiptDefaults,
  getProductCatalog,
  getBankConfig,
  updateProductCatalogItem,
  createProductCatalogItem,
  deleteProductCatalogItem,
  getCustomerCatalog,
  getDebtCustomers,
  updateDebtCustomer,
  settleAllDebtCustomers,
  getOrderHistory,
  createReceiptPdf,
  createOrder,
  createInventoryReceipt,
  updateOrder,
  deleteOrder,
  getInventory,
  getReceiptHistory,
  getAppSetting,
  setAppSetting,
};
