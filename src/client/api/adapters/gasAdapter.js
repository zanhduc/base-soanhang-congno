const IS_DEV = import.meta.env.DEV;
const GAS_WEBAPP_URL = import.meta.env.VITE_GAS_WEBAPP_URL ?? "";

function gasRun(fnName, ...args) {
  return new Promise((resolve, reject) => {
    window.google.script.run
      .withSuccessHandler(resolve)
      .withFailureHandler(reject)
      [fnName](...args);
  });
}

async function gasFetch(fnName, ...args) {
  const params = new URLSearchParams({
    fn: fnName,
    args: JSON.stringify(args),
  });
  const res = await fetch(`/gas-proxy?${params}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  const text = await res.text();
  if (text.trimStart().startsWith("<")) {
    throw new Error(
      "GAS trả về HTML thay vì JSON — kiểm tra:\n" +
        "1. VITE_GAS_WEBAPP_URL trong .env phải là URL deployment (dạng AKfycb...)\n" +
        "2. Deploy → Web App → Who has access: Anyone",
    );
  }
  return JSON.parse(text);
}

const call = (fnName, ...args) => {
  return IS_DEV ? gasFetch(fnName, ...args) : gasRun(fnName, ...args);
};

const helloServer = () => call("helloServer");
const login = (email, password) => call("login", email, password);
const getUserInfo = (email) => call("getUserInfo", email);
const getDemoAccounts = () => call("getDemoAccounts");
const getGlobalNotice = () => call("getGlobalNotice");

export const gasAdapter = {
  call,
  helloServer,
  login,
  getUserInfo,
  getDemoAccounts,
  getGlobalNotice,
};
