const fs = require("fs");

// 1. Update create-order.jsx
const coPath = "src/client/pages/create-order.jsx";
let co = fs.readFileSync(coPath, "utf8");
if (!co.includes("formatMoney as fmt")) {
  co = co.replace(
    /import { buildVietQrUrl } from "\.\.\/utils\/vietqr";/,
    `import { buildVietQrUrl } from "../utils/vietqr";
import { formatMoney as fmt, normalizeText as foldText, toTitleCase, getTodayInputDate } from "../../core/core";`
  );
  co = co.replace(/const fmt =[\s\S]*?const getTodayInputDate[\s\S]*?};\n/, "");
  fs.writeFileSync(coPath, co);
}

// 2. Update debt.jsx
const dbPath = "src/client/pages/debt.jsx";
let db = fs.readFileSync(dbPath, "utf8");
if (!db.includes("formatMoney as fmt")) {
  db = db.replace(
    /import { deleteOrder, getCustomerCatalog, getDebtCustomers, updateDebtCustomer } from "\.\.\/api"\n/,
    `import { deleteOrder, getCustomerCatalog, getDebtCustomers, updateDebtCustomer } from "../api"\nimport { formatMoney as fmt, parseNumber as toNum, normalizeText as foldText, isGuestCustomer, toIsoDate } from "../../core/core"\n`
  );
  db = db.replace(/const fmt =[\s\S]*?const toIsoDate[\s\S]*?}\n/, "");
  fs.writeFileSync(dbPath, db);
}

// 3. Update history.jsx
const hsPath = "src/client/pages/history.jsx";
let hs = fs.readFileSync(hsPath, "utf8");
if (!hs.includes("formatMoney as fmt")) {
  hs = hs.replace(
    /import { buildVietQrUrl } from "\.\.\/utils\/vietqr";/,
    `import { buildVietQrUrl } from "../utils/vietqr";
import { formatMoney as fmt, parseNumber as toNum, normalizeText as foldText, isGuestCustomer, getStatusCode, toIsoDate, pad2, parseFlexibleDateParts, isValidCalendarDate, buildDateTokens, getDateSearchMeta, hasDateTokenMatch, moneyMeaning } from "../../core/core";`
  );
  hs = hs.replace(/const fmt =[\s\S]*?const moneyMeaning[\s\S]*?};\n/, "");
  fs.writeFileSync(hsPath, hs);
}

// 4. Update stats.jsx
const stPath = "src/client/pages/stats.jsx";
let st = fs.readFileSync(stPath, "utf8");
if (!st.includes("formatMoney as fmt")) {
  st = st.replace(
    /import toast from "react-hot-toast";/,
    `import toast from "react-hot-toast";
import { formatMoney as fmt, parseNumber as toNum, normalizeText as foldText, toLocalIso, getStatusCode, toIsoDate, getScaleConfig, formatScaled, startOfWeek, formatShortDate, calculateStats } from "../../core/core";`
  );
  st = st.replace(/const fmt =[\s\S]*?const formatShortDate[\s\S]*?};\n/, "");
  
  st = st.replace(
    /const stats = useMemo\(\(\) => \{[\s\S]*?(?=\],\n)\],/,
    `const stats = useMemo(() => calculateStats({
    sourceOrders,
    trendMode,
    trendWeekPreset,
    trendQuarter,
    trendYear,
    customFrom,
    customTo,
    isDesktop,
  }), [
    sourceOrders,
    trendMode,
    trendWeekPreset,
    trendQuarter,
    trendYear,
    customFrom,
    customTo,
    isDesktop,
  ],`
  );
  fs.writeFileSync(stPath, st);
}

console.log("Done refactoring components");
