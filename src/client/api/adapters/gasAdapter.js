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

/* ── GAS Server Functions ── */

function doGet() {
  return HtmlService.createHtmlOutputFromFile("index")
    .setTitle("Soạn Hàng - Công Nợ")
    .addMetaTag(
      "viewport",
      "width=device-width, initial-scale=1, viewport-fit=cover",
    )
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// ===== Auth / Info (GAS) =====
function normalizeHeader_(v) {
  return String(v || "")
    .trim()
    .toLowerCase();
}

function getAccountSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var preferred = ["ACCOUNT", "account", "Account", "ACCOUNTS", "accounts"];
  for (var i = 0; i < preferred.length; i++) {
    var s = ss.getSheetByName(preferred[i]);
    if (s) return s;
  }

  var sheets = ss.getSheets();
  for (var j = 0; j < sheets.length; j++) {
    var sheet = sheets[j];
    var lastCol = sheet.getLastColumn();
    if (lastCol < 1) continue;
    var header = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    var h = header.map(normalizeHeader_);
    if (h.indexOf("email") !== -1 && h.indexOf("password") !== -1) {
      return sheet;
    }
  }
  return null;
}

function readAccounts_() {
  var sheet = getAccountSheet_();
  if (!sheet) {
    throw new Error(
      "Không tìm thấy sheet ACCOUNT (hoặc header email/password)",
    );
  }

  var values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];

  var headers = values[0].map(normalizeHeader_);
  var idxEmail = headers.indexOf("email");
  var idxPassword = headers.indexOf("password");
  var idxName = headers.indexOf("name");
  var idxRole = headers.indexOf("role");
  var idxDept = headers.indexOf("department");

  if (idxEmail < 0 || idxPassword < 0) {
    throw new Error("Sheet ACCOUNT thiếu cột email/password");
  }

  var accounts = [];
  for (var r = 1; r < values.length; r++) {
    var row = values[r];
    var email = row[idxEmail];
    if (!email) continue;
    accounts.push({
      email: String(email).trim(),
      password: String(row[idxPassword] || "").trim(),
      name: idxName >= 0 ? String(row[idxName] || "").trim() : "",
      role: idxRole >= 0 ? String(row[idxRole] || "").trim() : "",
      department: idxDept >= 0 ? String(row[idxDept] || "").trim() : "",
    });
  }
  return accounts;
}

function getDemoAccounts() {
  try {
    var accounts = readAccounts_();
    return {
      success: true,
      data: accounts.map(function (a) {
        return {
          email: a.email,
          password: a.password,
          role: a.role,
          name: a.name,
        };
      }),
    };
  } catch (e) {
    return { success: false, message: "Lỗi: " + e.message };
  }
}

function login(email, password) {
  try {
    var accounts = readAccounts_();
    var user = accounts.find(function (u) {
      return u.email === email && u.password === password;
    });
    if (user) {
      return {
        success: true,
        data: {
          email: user.email,
          name: user.name,
          role: user.role,
          department: user.department,
        },
        message: "Đăng nhập thành công!",
      };
    }
    return {
      success: false,
      data: null,
      message: "Email hoặc mật khẩu không đúng!",
    };
  } catch (e) {
    return { success: false, message: "Lỗi: " + e.message };
  }
}

function getUserInfo(email) {
  try {
    var accounts = readAccounts_();
    var user = accounts.find(function (u) {
      return u.email === email;
    });
    if (user) {
      return {
        success: true,
        data: {
          email: user.email,
          name: user.name,
          role: user.role,
          department: user.department,
        },
      };
    }
    return { success: false, message: "Không tìm thấy tài khoản" };
  } catch (e) {
    return { success: false, message: "Lỗi: " + e.message };
  }
}

var GLOBAL_NOTICE_SPREADSHEET_ID = "1BIP63sE_yEA3Asl0CyvypoWNEmLNYSPGFBqeVosIh98";

function normalizeNoticeHeader_(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "");
}

function parseBooleanCell_(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  var raw = String(value || "")
    .trim()
    .toLowerCase();
  return raw === "true" || raw === "1" || raw === "yes" || raw === "y" || raw === "x";
}

function findNoticeSheet_(ss) {
  var preferredNames = ["notify", "Notify", "NOTIFY", "SystemBroadcast"];
  for (var i = 0; i < preferredNames.length; i++) {
    var direct = ss.getSheetByName(preferredNames[i]);
    if (direct) return direct;
  }

  var sheets = ss.getSheets();
  for (var j = 0; j < sheets.length; j++) {
    var sh = sheets[j];
    var lastCol = sh.getLastColumn();
    if (lastCol < 1) continue;
    var headerRow = sh.getRange(2, 1, 1, lastCol).getDisplayValues()[0];
    var normalizedHeaders = headerRow.map(normalizeNoticeHeader_);
    if (
      normalizedHeaders.indexOf("message") !== -1 &&
      normalizedHeaders.indexOf("active") !== -1
    ) {
      return sh;
    }
  }
  return null;
}

function getGlobalNotice() {
  try {
    var ss = SpreadsheetApp.openById(GLOBAL_NOTICE_SPREADSHEET_ID);
    var sheet = findNoticeSheet_(ss);
    if (!sheet) {
      throw new Error("Không tìm thấy sheet notify/SystemBroadcast");
    }

    var lastRow = sheet.getLastRow();
    var lastCol = sheet.getLastColumn();
    if (lastRow < 3 || lastCol < 1) return [];

    var headers = sheet.getRange(2, 1, 1, lastCol).getDisplayValues()[0].map(normalizeNoticeHeader_);
    var idxBase = headers.indexOf("base");
    var idxMessage = headers.indexOf("message");
    var idxLevel = headers.indexOf("level");
    var idxActive = headers.indexOf("active");
    var idxVersion = headers.indexOf("version");
    var idxChangelog = headers.indexOf("noidungcapnhap") !== -1 ? headers.indexOf("noidungcapnhap") : headers.indexOf("changelog");

    if (idxMessage < 0) return [];

    var values = sheet.getRange(3, 1, lastRow - 2, lastCol).getValues();
    var notices = [];

    for (var r = 0; r < values.length; r++) {
      var row = values[r];
      var message = String(row[idxMessage] || "").trim();
      if (!message) continue;

      var isActive = idxActive < 0 ? true : parseBooleanCell_(row[idxActive]);
      if (!isActive) continue;

      notices.push({
        base: idxBase >= 0 ? String(row[idxBase] || "").trim() : "",
        message: message,
        level: idxLevel >= 0 ? String(row[idxLevel] || "info").trim().toLowerCase() : "info",
        version: idxVersion >= 0 ? String(row[idxVersion] || "").trim() : "",
        changelog: idxChangelog >= 0 ? String(row[idxChangelog] || "").trim() : "",
      });
    }

    return notices;
  } catch (e) {
    return [
      {
        base: "",
        message: "Không tải được thông báo hệ thống: " + e.message,
        level: "warning",
        version: "",
        changelog: "",
      },
    ];
  }
}

function helloServer() {
  return "Hello from GAS Server!";
}

function getTodayInputDate_() {
  var tz = Session.getScriptTimeZone() || "Asia/Ho_Chi_Minh";
  return Utilities.formatDate(new Date(), tz, "yyyy-MM-dd");
}

function incrementOrderCode_(value) {
  var raw = String(value == null ? "" : value).trim();
  if (!raw) return "01";

  var m = raw.match(/^(.*?)(\d+)$/);
  if (!m) return raw + "1";

  var prefix = m[1];
  var digits = m[2];
  var next = String(parseInt(digits, 10) + 1);
  while (next.length < digits.length) next = "0" + next;
  return prefix + next;
}

function getNextOrderFormDefaults() {
  var today = getTodayInputDate_();

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheetDH = ss.getSheetByName("DON_HANG");
    if (!sheetDH) {
      throw new Error("Khong tim thay sheet DON_HANG");
    }

    // Latest order is always at row 3, column C (ma phieu)
    var latestCode = sheetDH.getRange(3, 3).getDisplayValue();
    var nextCode = incrementOrderCode_(latestCode);

    return {
      success: true,
      data: {
        maPhieu: nextCode,
        ngayBan: today,
      },
    };
  } catch (e) {
    return {
      success: false,
      message: "Loi: " + e.message,
      data: {
        maPhieu: "01",
        ngayBan: today,
      },
    };
  }
}

function parseMoneyNumber_(value) {
  if (typeof value === "number") return value;
  var raw = String(value || "").trim();
  if (!raw) return 0;
  var normalized = raw
    .replace(/\s+/g, "")
    .replace(/\./g, "")
    .replace(/,/g, ".")
    .replace(/[^\d.-]/g, "");
  var n = Number(normalized);
  return isNaN(n) ? 0 : n;
}

function normalizeProductKeyPart_(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function buildProductKey_(tenSanPham, donVi) {
  return (
    normalizeProductKeyPart_(tenSanPham) + "||" + normalizeProductKeyPart_(donVi)
  );
}

function getLastDataRowByCol_(sheet, col, dataStartRow) {
  var lastRow = sheet.getLastRow();
  if (lastRow < dataStartRow) return dataStartRow - 1;
  var values = sheet.getRange(dataStartRow, col, lastRow - dataStartRow + 1, 1).getDisplayValues();
  for (var i = values.length - 1; i >= 0; i--) {
    if (String(values[i][0] || "").trim()) return dataStartRow + i;
  }
  return dataStartRow - 1;
}

function syncProductCatalog_(ss, products) {
  var sheetSP = ss.getSheetByName("SAN_PHAM");
  if (!sheetSP) throw new Error("Không tìm thấy sheet SAN_PHAM");
  if (!products || !products.length) return { inserted: 0, updated: 0 };

  var dataStartRow = 3;
  var lastDataRow = getLastDataRowByCol_(sheetSP, 2, dataStartRow);
  var existingByKey = {};

  if (lastDataRow >= dataStartRow) {
    // B:F = TEN SAN PHAM | DON VI | GIA | GIA VON | GHI CHU
    var existing = sheetSP.getRange(dataStartRow, 2, lastDataRow - dataStartRow + 1, 5).getValues();
    for (var i = 0; i < existing.length; i++) {
      var row = existing[i];
      var tenSanPham = String(row[0] || "").trim();
      var donVi = String(row[1] || "").trim();
      if (!tenSanPham || !donVi) continue;
      existingByKey[buildProductKey_(tenSanPham, donVi)] = {
        row: dataStartRow + i,
        donGiaBan: parseMoneyNumber_(row[2]),
        giaVon: parseMoneyNumber_(row[3]),
      };
    }
  }

  // Gộp các sản phẩm trùng key trong cùng đơn, lấy giá trị cuối cùng người dùng gửi.
  var incomingByKey = {};
  for (var j = 0; j < products.length; j++) {
    var p = products[j] || {};
    var ten = String(p.tenSanPham || "").trim();
    var dv = String(p.donVi || "").trim();
    if (!ten || !dv) continue;
    incomingByKey[buildProductKey_(ten, dv)] = {
      tenSanPham: ten,
      donVi: dv,
      donGiaBan: parseMoneyNumber_(p.donGiaBan),
      giaVon: parseMoneyNumber_(p.giaVon),
    };
  }

  var keys = Object.keys(incomingByKey);
  var inserts = [];
  var updated = 0;

  for (var k = 0; k < keys.length; k++) {
    var key = keys[k];
    var incomingProduct = incomingByKey[key];
    var matched = existingByKey[key];

    if (matched) {
      var changedPrice = Math.abs((matched.donGiaBan || 0) - (incomingProduct.donGiaBan || 0)) > 0.0001;
      var changedCost = Math.abs((matched.giaVon || 0) - (incomingProduct.giaVon || 0)) > 0.0001;
      if (changedPrice || changedCost) {
        sheetSP
          .getRange(matched.row, 4, 1, 2)
          .setValues([[incomingProduct.donGiaBan || 0, incomingProduct.giaVon || 0]]);
        updated++;
      }
    } else {
      // Thêm mới nếu chưa có key name+unit (bao gồm case cùng tên nhưng khác đơn vị).
      inserts.push([
        incomingProduct.tenSanPham,
        incomingProduct.donVi,
        incomingProduct.donGiaBan || 0,
        incomingProduct.giaVon || 0,
        "",
      ]);
    }
  }

  var inserted = 0;
  if (inserts.length) {
    var appendStartRow = getLastDataRowByCol_(sheetSP, 2, dataStartRow) + 1;
    if (appendStartRow < dataStartRow) appendStartRow = dataStartRow;
    var needLastRow = appendStartRow + inserts.length - 1;
    if (needLastRow > sheetSP.getMaxRows()) {
      sheetSP.insertRowsAfter(sheetSP.getMaxRows(), needLastRow - sheetSP.getMaxRows());
    }

    // New rows should inherit visual style from the previous product row.
    var templateRow = appendStartRow - 1;
    if (templateRow >= dataStartRow) {
      sheetSP
        .getRange(templateRow, 1, 1, 6)
        .copyTo(
          sheetSP.getRange(appendStartRow, 1, inserts.length, 6),
          SpreadsheetApp.CopyPasteType.PASTE_FORMAT,
          false,
        );
    }

    sheetSP.getRange(appendStartRow, 2, inserts.length, 5).setValues(inserts);
    inserted = inserts.length;
    updateSTT_(sheetSP, dataStartRow);
  }

  return { inserted: inserted, updated: updated };
}

function getProductCatalog() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("SAN_PHAM");
    if (!sheet) throw new Error("Không tìm thấy sheet SAN_PHAM");

    var lastRow = sheet.getLastRow();
    if (lastRow < 3) {
      return { success: true, data: [] };
    }

    // B:E = TEN SAN PHAM | DON VI | GIA | GIA VON
    var values = sheet.getRange(3, 2, lastRow - 2, 4).getDisplayValues();
    var data = [];
    for (var i = 0; i < values.length; i++) {
      var row = values[i];
      var tenSanPham = String(row[0] || "").trim();
      if (!tenSanPham) continue;
      data.push({
        tenSanPham: tenSanPham,
        donVi: String(row[1] || "").trim(),
        donGiaBan: parseMoneyNumber_(row[2]),
        giaVon: parseMoneyNumber_(row[3]),
      });
    }

    return { success: true, data: data };
  } catch (e) {
    return { success: false, message: "Lỗi: " + e.message, data: [] };
  }
}

function isGuestCustomerName_(name) {
  var folded = normalizeCompareText_(name);
  return folded === "khach ghe tham";
}

function getCustomerCatalog() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("KHACH");
    if (!sheet) throw new Error("Không tìm thấy sheet KHACH");

    var lastRow = sheet.getLastRow();
    if (lastRow < 3) {
      return { success: true, data: [] };
    }

    // B:D = TÊN KHÁCH | NGÀY BÁN | SỐ ĐIỆN THOẠI
    var values = sheet.getRange(3, 2, lastRow - 2, 3).getDisplayValues();
    var data = [];
    var seen = {};

    for (var i = 0; i < values.length; i++) {
      var row = values[i];
      var tenKhach = String(row[0] || "").trim();
      var soDienThoai = String(row[2] || "").trim();

      if (!tenKhach || isGuestCustomerName_(tenKhach)) continue;

      var key = normalizeCompareText_(tenKhach) + "||" + String(soDienThoai).replace(/[^\d]/g, "");
      if (seen[key]) continue;
      seen[key] = true;

      data.push({
        tenKhach: tenKhach,
        soDienThoai: soDienThoai,
      });
    }

    return { success: true, data: data };
  } catch (e) {
    return { success: false, message: "Lỗi: " + e.message, data: [] };
  }
}

/**
 * Auto cập nhật STT (cột A) cho sheet, bắt đầu từ dataStartRow.
 * STT = 1, 2, 3, ... cho mỗi dòng có dữ liệu.
 */
function updateSTT_(sheet, dataStartRow) {
  var lastRow = sheet.getLastRow();
  if (lastRow < dataStartRow) return;
  var numRows = lastRow - dataStartRow + 1;
  var sttValues = [];
  for (var i = 1; i <= numRows; i++) {
    sttValues.push([i]);
  }
  sheet.getRange(dataStartRow, 1, numRows, 1).setValues(sttValues);
}

function normalizeOrderStatus_(status) {
  var raw = String(status || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
  if (raw === "tra một phan" || raw === "trả một phần") return "Trả một phần";
  if (raw === "tra một phần" || raw === "trả một phần") return "Trả một phần";
  if (raw === "tra mot phan" || raw === "trả mot phan") return "Trả một phần";
  if (raw === "no" || raw === "nợ") return "Nợ";
  return "Đã thanh toán";
}

function normalizeOrderStatusFromInfo_(orderInfo) {
  var code = String((orderInfo && orderInfo.trangThaiCode) || "").trim().toUpperCase();
  if (code === "PARTIAL") return "Trả một phần";
  if (code === "DEBT") return "Nợ";
  if (code === "PAID") return "Đã thanh toán";
  return normalizeOrderStatus_(orderInfo && orderInfo.trangThai);
}

function getOrderStatusCode_(orderInfo) {
  var code = String((orderInfo && orderInfo.trangThaiCode) || "").trim().toUpperCase();
  if (code === "PARTIAL" || code === "DEBT" || code === "PAID") return code;
  var normalized = normalizeOrderStatusFromInfo_(orderInfo);
  if (normalized === "Trả một phần") return "PARTIAL";
  if (normalized === "Nợ") return "DEBT";
  return "PAID";
}

function normalizeCompareText_(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function getStatusKey_(status) {
  var s = normalizeCompareText_(status);
  if (!s) return "";
  if (s.indexOf("da thanh toan") !== -1) return "PAID";
  if (s.indexOf("tra mot phan") !== -1 || s.indexOf("tra một phan") !== -1)
    return "PARTIAL";
  if (s === "no" || s.indexOf(" no ") !== -1 || s.endsWith(" no")) return "DEBT";
  return "";
}

function getValidationList_(rule) {
  if (!rule) return [];
  var criteriaType = rule.getCriteriaType();
  var criteriaValues = rule.getCriteriaValues();
  if (!criteriaType || !criteriaValues || !criteriaValues.length) return [];

  if (
    criteriaType === SpreadsheetApp.DataValidationCriteria.VALUE_IN_LIST &&
    criteriaValues[0]
  ) {
    return criteriaValues[0].map(function (v) {
      return String(v || "").trim();
    });
  }

  if (
    criteriaType === SpreadsheetApp.DataValidationCriteria.VALUE_IN_RANGE &&
    criteriaValues[0]
  ) {
    var range = criteriaValues[0];
    return range
      .getValues()
      .flat()
      .map(function (v) {
        return String(v || "").trim();
      })
      .filter(function (v) {
        return v;
      });
  }

  return [];
}

function buildStatusValidationRule_() {
  var statusOptions = ["Đã thanh toán", "Trả một phần", "Nợ"];
  return SpreadsheetApp.newDataValidation()
    .requireValueInList(statusOptions, true)
    .setAllowInvalid(false)
    .build();
}

function resolveStatusForRule_(desiredStatus, rule) {
  var desired = normalizeOrderStatus_(desiredStatus);
  var options = getValidationList_(rule);
  if (!options.length) return desired;
  if (options.indexOf(desired) !== -1) return desired;

  var desiredKey = getStatusKey_(desired);
  if (desiredKey) {
    for (var i = 0; i < options.length; i++) {
      if (getStatusKey_(options[i]) === desiredKey) return options[i];
    }
  }

  for (var j = 0; j < options.length; j++) {
    if (getStatusKey_(options[j]) === "PAID") return options[j];
  }
  return options[0];
}

function normalizePhoneForSheet_(phoneValue) {
  var raw = String(phoneValue || "").trim();
  if (!raw) return "";
  if (raw.charAt(0) === "'") return raw;
  return "'" + raw;
}

function applyStatusValidation_(sheet, startRow, rowCount) {
  var statusCol = 12; // Cột L
  var templateRow = startRow + rowCount;
  if (templateRow > sheet.getMaxRows()) return;

  var rule = sheet.getRange(templateRow, statusCol).getDataValidation();
  if (!rule) return;

  sheet.getRange(startRow, statusCol, rowCount, 1).setDataValidation(rule);
}

function applyKnownStatusValidation_(sheet, startRow, rowCount, statusCol, rule) {
  if (!rule || rowCount <= 0) return;
  sheet.getRange(startRow, statusCol, rowCount, 1).setDataValidation(rule);
}

function setStatusValidationAndValue_(sheet, row, statusCol, statusValue, rule) {
  var cell = sheet.getRange(row, statusCol);
  if (rule) cell.setDataValidation(rule);
  cell.setValue(statusValue);
}

function applySingleStatusValidation_(sheet, startRow, statusCol) {
  var templateRow = startRow + 1;
  if (templateRow > sheet.getMaxRows()) return null;
  var templateRule = sheet.getRange(templateRow, statusCol).getDataValidation();
  if (!templateRule) return null;
  sheet.getRange(startRow, statusCol).setDataValidation(templateRule);
  return templateRule;
}

function mergeOrderSharedColumns_(sheet, startRow, rowCount) {
  if (!sheet || rowCount <= 1) return;
  // B: NGÀY BÁN, C: MÃ PHIẾU, J: TỔNG HÓA ĐƠN, K: GHI CHÚ, L: TRẠNG THÁI
  var colsToMerge = [2, 3, 10, 11, 12];
  for (var i = 0; i < colsToMerge.length; i++) {
    var col = colsToMerge[i];
    var range = sheet.getRange(startRow, col, rowCount, 1);
    range.breakApart();
    range.mergeVertically();
    range.setVerticalAlignment("middle");
  }
}

function createOrder(orderData) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    // === 1. Ghi vào sheet DON_HANG ===
    var sheetDH = ss.getSheetByName("DON_HANG");
    if (!sheetDH) throw new Error("Không tìm thấy sheet DON_HANG");

    var products = orderData.products || [];
    var orderInfo = orderData.orderInfo || {};
    var customer = orderData.customer || null;
    if (!products.length) throw new Error("Đơn hàng chưa có sản phẩm");

    // Đồng bộ danh mục sản phẩm theo dữ liệu người dùng vừa gửi.
    syncProductCatalog_(ss, products);

    var tongHoaDon = products.reduce(function (sum, p) {
      return sum + (p.soLuong || 0) * (p.donGiaBan || 0);
    }, 0);

    var ngayBan = orderInfo.ngayBan || "";
    var normalizedStatus = normalizeOrderStatusFromInfo_(orderInfo);
    var statusCode = getOrderStatusCode_(orderInfo);
    var statusColDH = 12;
    var statusRuleDH = buildStatusValidationRule_();
    var statusForDH = resolveStatusForRule_(normalizedStatus, statusRuleDH);

    // Chèn từ dưới lên (reverse) để giữ thứ tự sản phẩm đúng khi insert ở đầu
    var reversedProducts = products.slice().reverse();

    for (var i = 0; i < reversedProducts.length; i++) {
      var p = reversedProducts[i];
      var thanhTien = (p.soLuong || 0) * (p.donGiaBan || 0);
      var giaVon = p.giaVon || 0;
      var isFirst = i === reversedProducts.length - 1;

      // insertRowBefore(3) — kế thừa format từ dòng data bên dưới
      sheetDH.insertRowBefore(3);
      try {
        sheetDH.getRange(3, 1, 1, 12).setValues([
          [
            "", // A: STT (auto cập nhật sau)
            ngayBan, // B: NGÀY BÁN
            orderInfo.maPhieu || "", // C: MÃ PHIẾU
            p.tenSanPham || "", // D: TÊN SẢN PHẨM
            p.donVi || "", // E: ĐƠN VỊ
            p.soLuong || 0, // F: SỐ LƯỢNG
            giaVon, // G: GIÁ VỐN
            p.donGiaBan || 0, // H: ĐƠN GIÁ BÁN
            thanhTien, // I: THÀNH TIỀN
            isFirst ? tongHoaDon : "", // J: TỔNG HÓA ĐƠN
            isFirst ? orderInfo.ghiChu || "-" : "-", // K: GHI CHÚ
            statusForDH, // L: TRẠNG THÁI
          ],
        ]);
      } catch (rowWriteErr) {
        // Fallback nếu cột trạng thái bị chặn bởi data validation.
        sheetDH.getRange(3, 1, 1, 11).setValues([
          [
            "",
            ngayBan,
            orderInfo.maPhieu || "",
            p.tenSanPham || "",
            p.donVi || "",
            p.soLuong || 0,
            giaVon,
            p.donGiaBan || 0,
            thanhTien,
            isFirst ? tongHoaDon : "",
            isFirst ? orderInfo.ghiChu || "-" : "-",
          ],
        ]);
        setStatusValidationAndValue_(sheetDH, 3, 12, statusForDH, statusRuleDH);
      }
    }

    // Auto cập nhật STT cho DON_HANG (data bắt đầu từ row 3)
    updateSTT_(sheetDH, 3);

    // Best effort: format/validation không được làm fail luồng tạo đơn.
    try {
      applyKnownStatusValidation_(
        sheetDH,
        3,
        reversedProducts.length,
        statusColDH,
        statusRuleDH,
      );
      mergeOrderSharedColumns_(sheetDH, 3, reversedProducts.length);
    } catch (formatErr) {
      Logger.log("WARN createOrder format skipped: " + formatErr.message);
    }

    // === 2. Ghi vào sheet KHACH ===
    var sheetKH = ss.getSheetByName("KHACH");
    if (!sheetKH) throw new Error("Không tìm thấy sheet KHACH");

    var customerName = String((customer && customer.tenKhach) || "").trim();
    if (!customerName) customerName = "Khách ghé thăm";
    var customerPhone = normalizePhoneForSheet_((customer && customer.soDienThoai) || "");

    var soTienDaTra = parseMoneyNumber_(orderInfo.soTienDaTra);
    var tienNo = tongHoaDon;
    if (statusCode === "PAID") {
      tienNo = 0;
    } else if (statusCode === "PARTIAL") {
      tienNo = Math.max(tongHoaDon - Math.max(soTienDaTra, 0), 0);
    }
    var statusColKH = 7;
    var statusRuleKH = buildStatusValidationRule_();
    var statusForKH = resolveStatusForRule_(normalizedStatus, statusRuleKH);

    // insertRowBefore(3) — kế thừa format từ dòng data bên dưới
    sheetKH.insertRowBefore(3);
    try {
      sheetKH.getRange(3, 1, 1, 8).setValues([
        [
          "", // A: STT (auto cập nhật sau)
          customerName, // B: TÊN KHÁCH
          ngayBan, // C: NGÀY BÁN
          customerPhone, // D: SỐ ĐIỆN THOẠI
          orderInfo.maPhieu || "", // E: MÃ PHIẾU
          tienNo, // F: TIỀN NỢ
          statusForKH, // G: TRẠNG THÁI
          orderInfo.ghiChu || "-", // H: GHI CHÚ
        ],
      ]);
    } catch (khRowWriteErr) {
      // Fallback nếu status tại KHACH đang validation khác bộ giá trị.
      sheetKH.getRange(3, 1, 1, 6).setValues([
        [
          "",
          customerName,
          ngayBan,
          customerPhone,
          orderInfo.maPhieu || "",
          tienNo,
        ],
      ]);
      setStatusValidationAndValue_(sheetKH, 3, 7, statusForKH, statusRuleKH);
      sheetKH.getRange(3, 8).setValue(orderInfo.ghiChu || "-");
    }

    // best effort: kéo đúng rule dropdown cho ô trạng thái vừa thêm
    try {
      applyKnownStatusValidation_(sheetKH, 3, 1, statusColKH, statusRuleKH);
    } catch (khFormatErr) {
      Logger.log("WARN createOrder KHACH status validation skipped: " + khFormatErr.message);
    }

    // Auto cập nhật STT cho KHACH (data bắt đầu từ row 3)
    updateSTT_(sheetKH, 3);

    return { success: true, message: "Đơn hàng đã được tạo thành công!" };
  } catch (e) {
    return { success: false, message: "Lỗi: " + e.message };
  }
}

/* CLIENT_API_WRAPPERS */
const helloServerClient = () => call("helloServer");
const loginClient = (email, password) => call("login", email, password);
const getUserInfoClient = (email) => call("getUserInfo", email);
const getDemoAccountsClient = () => call("getDemoAccounts");
const getGlobalNoticeClient = () => call("getGlobalNotice");
const getNextOrderFormDefaultsClient = () => call("getNextOrderFormDefaults");
const getProductCatalogClient = () => call("getProductCatalog");
const getCustomerCatalogClient = () => call("getCustomerCatalog");

export const gasAdapter = {
  call,
  helloServer: helloServerClient,
  login: loginClient,
  getUserInfo: getUserInfoClient,
  getDemoAccounts: getDemoAccountsClient,
  getGlobalNotice: getGlobalNoticeClient,
  getNextOrderFormDefaults: getNextOrderFormDefaultsClient,
  getProductCatalog: getProductCatalogClient,
  getCustomerCatalog: getCustomerCatalogClient,
  createOrder: (orderData) => call("createOrder", orderData),
};
