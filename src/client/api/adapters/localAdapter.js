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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
      message: "Hệ thống sẽ có bản cập nhập mới 1.2",
      level: "info",
      version: "1.0",
      changelog:
        "• Thêm chức năng thông báo toàn hệ thống\n• Sửa lỗi đăng nhập\n• Cải thiện hiệu suất tải trang",
    },
  ];
};

const call = async (fnName, ...args) => {
  console.log(`[Local Mock API] call: ${fnName}`, args);
  if (fnName === "helloServer") return helloServer();
  if (fnName === "login") return login(args[0], args[1]);
  if (fnName === "getUserInfo") return getUserInfo(args[0]);
  if (fnName === "getDemoAccounts") return getDemoAccounts();
  if (fnName === "getGlobalNotice") return getGlobalNotice();

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
};
