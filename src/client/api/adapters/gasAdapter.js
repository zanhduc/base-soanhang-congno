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

function doGet(e) {
  var params = (e && e.parameter) ? e.parameter : {};
  if (params.printPdf) {
    return buildReceiptPdf_(String(params.printPdf || "").trim());
  }
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

function formatMoneyNumber_(value) {
  var num = parseMoneyNumber_(value);
  var n = Math.round(num);
  var str = String(n);
  return str.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
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
  // B:F = TEN SAN PHAM | NHOM HANG | DON VI | GIA | GIA VON
    var existing = sheetSP.getRange(dataStartRow, 2, lastDataRow - dataStartRow + 1, 5).getValues();
    for (var i = 0; i < existing.length; i++) {
      var row = existing[i];
      var tenSanPham = String(row[0] || "").trim();
      var nhomHang = String(row[1] || "").trim();
      var donVi = String(row[2] || "").trim();
      if (!tenSanPham || !donVi) continue;
      existingByKey[buildProductKey_(tenSanPham, donVi)] = {
        row: dataStartRow + i,
        nhomHang: nhomHang,
        donGiaBan: parseMoneyNumber_(row[3]),
        giaVon: parseMoneyNumber_(row[4]),
      };
    }
  }

  // Gộp các sản phẩm trùng key trong cùng đơn, lấy giá trị cuối cùng người dùng gửi.
  var incomingByKey = {};
  for (var j = 0; j < products.length; j++) {
    var p = products[j] || {};
    var ten = String(p.tenSanPham || "").trim();
    var nhom = String(p.nhomHang || "").trim();
    var dv = String(p.donVi || "").trim();
    if (!ten || !dv) continue;
    incomingByKey[buildProductKey_(ten, dv)] = {
      tenSanPham: ten,
      nhomHang: nhom,
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
      if (!incomingProduct.nhomHang && matched.nhomHang) {
        incomingProduct.nhomHang = matched.nhomHang;
      }
      var changedPrice = Math.abs((matched.donGiaBan || 0) - (incomingProduct.donGiaBan || 0)) > 0.0001;
      var changedCost = Math.abs((matched.giaVon || 0) - (incomingProduct.giaVon || 0)) > 0.0001;
      var changedGroup = normalizeProductKeyPart_(matched.nhomHang || "") !== normalizeProductKeyPart_(incomingProduct.nhomHang || "");
      if (changedPrice || changedCost || changedGroup) {
        sheetSP
          .getRange(matched.row, 3, 1, 4)
          .setValues([[incomingProduct.nhomHang || "", incomingProduct.donVi || "", incomingProduct.donGiaBan || 0, incomingProduct.giaVon || 0]]);
        updated++;
      }
    } else {
      // Thêm mới nếu chưa có key name+unit (bao gồm case cùng tên nhưng khác đơn vị).
      inserts.push([
        incomingProduct.tenSanPham,
        incomingProduct.nhomHang || "",
        incomingProduct.donVi,
        incomingProduct.donGiaBan || 0,
        incomingProduct.giaVon || 0,
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
      var templateCols = Math.max(6, sheetSP.getLastColumn());
      sheetSP
        .getRange(templateRow, 1, 1, templateCols)
        .copyTo(
          sheetSP.getRange(appendStartRow, 1, inserts.length, templateCols),
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

    // B:F = TEN SAN PHAM | NHOM HANG | DON VI | GIA | GIA VON
    var values = sheet.getRange(3, 2, lastRow - 2, 5).getDisplayValues();
    var data = [];
    for (var i = 0; i < values.length; i++) {
      var row = values[i];
      var tenSanPham = String(row[0] || "").trim();
      if (!tenSanPham) continue;
      data.push({
        tenSanPham: tenSanPham,
        nhomHang: String(row[1] || "").trim(),
        donVi: String(row[2] || "").trim(),
        donGiaBan: parseMoneyNumber_(row[3]),
        giaVon: parseMoneyNumber_(row[4]),
      });
    }

    return { success: true, data: data };
  } catch (e) {
    return { success: false, message: "Lỗi: " + e.message, data: [] };
  }
}

function normalizeBankKey_(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "");
}

function getBankConfig() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("BANK");
    if (!sheet) throw new Error("Không tìm thấy sheet BANK");

    var lastRow = sheet.getLastRow();
    if (lastRow < 1) throw new Error("Sheet BANK trống");

    var values = sheet.getRange(1, 1, lastRow, 2).getDisplayValues();
    var bankCode = "";
    var accountNumber = "";
    var accountName = "";

    for (var i = 0; i < values.length; i++) {
      var key = normalizeBankKey_(values[i][0]);
      var val = String(values[i][1] || "").trim();
      if (!key || !val) continue;

      if (!bankCode && (key === "nganhang" || key === "bank" || key === "bankcode" || key === "manganhang")) {
        bankCode = val;
      }
      if (!accountNumber && (key === "stk" || key === "sotaikhoan" || key === "accountnumber" || key === "sotk")) {
        accountNumber = val;
      }
      if (!accountName && (key === "tenchutk" || key === "chutk" || key === "tentaikhoan" || key === "accountname" || key === "tenchutaikhoan")) {
        accountName = val;
      }
    }

    if (!bankCode || !accountNumber) {
      throw new Error("Thiếu thông tin ngân hàng hoặc số tài khoản trong sheet BANK");
    }

    return {
      success: true,
      data: {
        bankCode: bankCode,
        accountNumber: accountNumber,
        accountName: accountName,
      },
    };
  } catch (e) {
    return { success: false, message: "Lỗi: " + e.message, data: null };
  }
}

function findProductRowByKey_(sheet, dataStartRow, tenSanPham, donVi) {
  var lastDataRow = getLastDataRowByCol_(sheet, 2, dataStartRow);
  if (lastDataRow < dataStartRow) return 0;
  var key = buildProductKey_(tenSanPham, donVi);
  var values = sheet.getRange(dataStartRow, 2, lastDataRow - dataStartRow + 1, 3).getDisplayValues();
  for (var i = 0; i < values.length; i++) {
    if (buildProductKey_(values[i][0], values[i][2]) === key) {
      return dataStartRow + i;
    }
  }
  return 0;
}

function updateProductCatalogItem(payload) {
  return runWithLockOrQueue_("UPDATE_PRODUCT", { payload: payload }, function() {
    return updateProductCatalogItemInternal_(payload);
  });
}

function updateProductCatalogItemInternal_(payload) {
  try {
    var p = payload || {};
    var originalTenSanPham = String(p.originalTenSanPham || "").trim();
    var originalDonVi = String(p.originalDonVi || "").trim();
    var tenSanPham = String(p.tenSanPham || "").trim();
    var nhomHang = String(p.nhomHang || "").trim();
    var donVi = String(p.donVi || "").trim();
    var donGiaBan = Math.max(parseMoneyNumber_(p.donGiaBan), 0);
    var giaVon = Math.max(parseMoneyNumber_(p.giaVon), 0);

    if (!originalTenSanPham || !originalDonVi) {
      throw new Error("Thiếu thông tin sản phẩm gốc");
    }
    if (!tenSanPham) throw new Error("Tên sản phẩm không được để trống");
    if (!donVi) throw new Error("Đơn vị không được để trống");
    if (donGiaBan <= 0) throw new Error("Đơn giá bán phải lớn hơn 0");

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("SAN_PHAM");
    if (!sheet) throw new Error("Không tìm thấy sheet SAN_PHAM");

    var dataStartRow = 3;
    var sourceRow = findProductRowByKey_(sheet, dataStartRow, originalTenSanPham, originalDonVi);
    if (!sourceRow) throw new Error("Không tìm thấy sản phẩm để cập nhật");

    var targetRow = sourceRow;
    var oldKey = buildProductKey_(originalTenSanPham, originalDonVi);
    var newKey = buildProductKey_(tenSanPham, donVi);
    if (newKey !== oldKey) {
      var matchedRow = findProductRowByKey_(sheet, dataStartRow, tenSanPham, donVi);
      if (matchedRow && matchedRow !== sourceRow) {
        targetRow = matchedRow;
      }
    }

    sheet.getRange(targetRow, 2, 1, 5).setValues([[tenSanPham, nhomHang, donVi, donGiaBan, giaVon]]);
    if (targetRow !== sourceRow) {
      sheet.deleteRow(sourceRow);
      if (targetRow > sourceRow) targetRow = targetRow - 1;
    }
    updateSTT_(sheet, dataStartRow);
    return { success: true, message: "Cập nhật sản phẩm thành công" };
  } catch (e) {
    return { success: false, message: "Lỗi: " + e.message };
  }
}

function createProductCatalogItem(payload) {
  return runWithLockOrQueue_("CREATE_PRODUCT", { payload: payload }, function() {
    return createProductCatalogItemInternal_(payload);
  });
}

function createProductCatalogItemInternal_(payload) {
  try {
    var p = payload || {};
    var tenSanPham = String(p.tenSanPham || "").trim();
    var nhomHang = String(p.nhomHang || "").trim();
    var donVi = String(p.donVi || "").trim();
    var donGiaBan = Math.max(parseMoneyNumber_(p.donGiaBan), 0);
    var giaVon = Math.max(parseMoneyNumber_(p.giaVon), 0);

    if (!tenSanPham) throw new Error("Tên sản phẩm không được để trống");
    if (!donVi) throw new Error("Đơn vị không được để trống");
    if (donGiaBan <= 0) throw new Error("Đơn giá bán phải lớn hơn 0");

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("SAN_PHAM");
    if (!sheet) throw new Error("Không tìm thấy sheet SAN_PHAM");

    var dataStartRow = 3;
    var existed = findProductRowByKey_(sheet, dataStartRow, tenSanPham, donVi);
    if (existed) throw new Error("Sản phẩm với đơn vị này đã tồn tại");

    var appendStartRow = getLastDataRowByCol_(sheet, 2, dataStartRow) + 1;
    if (appendStartRow < dataStartRow) appendStartRow = dataStartRow;
    if (appendStartRow > sheet.getMaxRows()) {
      sheet.insertRowsAfter(sheet.getMaxRows(), appendStartRow - sheet.getMaxRows());
    }

    var templateRow = appendStartRow - 1;
    if (templateRow >= dataStartRow) {
      var templateCols = Math.max(6, sheet.getLastColumn());
      sheet
        .getRange(templateRow, 1, 1, templateCols)
        .copyTo(
          sheet.getRange(appendStartRow, 1, 1, templateCols),
          SpreadsheetApp.CopyPasteType.PASTE_FORMAT,
          false,
        );
    }

    sheet.getRange(appendStartRow, 2, 1, 5).setValues([[tenSanPham, nhomHang, donVi, donGiaBan, giaVon]]);
    updateSTT_(sheet, dataStartRow);
    return { success: true, message: "Đã thêm sản phẩm thành công" };
  } catch (e) {
    return { success: false, message: "Lỗi: " + e.message };
  }
}

function deleteProductCatalogItem(payload) {
  return runWithLockOrQueue_("DELETE_PRODUCT", { payload: payload }, function() {
    return deleteProductCatalogItemInternal_(payload);
  });
}

function deleteProductCatalogItemInternal_(payload) {
  try {
    var p = payload || {};
    var tenSanPham = String(p.tenSanPham || "").trim();
    var donVi = String(p.donVi || "").trim();
    if (!tenSanPham || !donVi) throw new Error("Thiếu tên sản phẩm hoặc đơn vị");

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("SAN_PHAM");
    if (!sheet) throw new Error("Không tìm thấy sheet SAN_PHAM");

    var dataStartRow = 3;
    var row = findProductRowByKey_(sheet, dataStartRow, tenSanPham, donVi);
    if (!row) throw new Error("Không tìm thấy sản phẩm để xóa");

    sheet.deleteRow(row);
    if (sheet.getLastRow() >= dataStartRow) updateSTT_(sheet, dataStartRow);
    return { success: true, message: "Đã xóa sản phẩm" };
  } catch (e) {
    return { success: false, message: "Lỗi: " + e.message };
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

function getDebtCustomers() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("KHACH");
    if (!sheet) throw new Error("Không tìm thấy sheet KHACH");

    var lastRow = sheet.getLastRow();
    if (lastRow < 3) return { success: true, data: [] };

    // A:H = STT | TÊN KHÁCH | NGÀY BÁN | SĐT | MÃ PHIẾU | TIỀN NỢ | TRẠNG THÁI | GHI CHÚ
    var rows = sheet.getRange(3, 1, lastRow - 2, 8).getDisplayValues();
    var out = [];
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      var maPhieu = String(row[4] || "").trim();
      if (!maPhieu) continue;
      out.push({
        stt: parseMoneyNumber_(row[0]),
        tenKhach: String(row[1] || "").trim() || "Khách ghé thăm",
        ngayBan: String(row[2] || "").trim(),
        soDienThoai: String(row[3] || "").trim(),
        maPhieu: maPhieu,
        tienNo: parseMoneyNumber_(row[5]),
        trangThai: String(row[6] || "").trim() || "Đã thanh toán",
        ghiChu: String(row[7] || "").trim() || "-",
      });
    }
    return { success: true, data: out };
  } catch (e) {
    return { success: false, message: "Lỗi: " + e.message, data: [] };
  }
}

function findCustomerRowByOrderCode_(sheetKH, maPhieu) {
  var key = String(maPhieu || "").trim();
  if (!key) return 0;
  var lastRow = sheetKH.getLastRow();
  if (lastRow < 3) return 0;
  var values = sheetKH.getRange(3, 5, lastRow - 2, 1).getDisplayValues();
  for (var i = 0; i < values.length; i++) {
    if (String(values[i][0] || "").trim() === key) return i + 3;
  }
  return 0;
}

function updateDebtCustomer(payload) {
  return runWithLockOrQueue_("UPDATE_DEBT", { payload: payload }, function() {
    return updateDebtCustomerInternal_(payload);
  });
}

function updateDebtCustomerInternal_(payload) {
  try {
    var input = payload || {};
    var maPhieuOriginal = String(input.maPhieuOriginal || input.maPhieu || "").trim();
    if (!maPhieuOriginal) throw new Error("Thiếu mã phiếu gốc");

    var tenKhach = String(input.tenKhach || "").trim() || "Khách ghé thăm";
    var ngayBan = String(input.ngayBan || "").trim();
    var soDienThoai = normalizePhoneForSheet_(input.soDienThoai || "");
    var maPhieu = String(input.maPhieu || "").trim() || maPhieuOriginal;
    var tienNo = Math.max(parseMoneyNumber_(input.tienNo), 0);
    var ghiChu = String(input.ghiChu || "-").trim() || "-";
    var normalizedStatus = normalizeOrderStatus_(input.trangThai);
    var statusRule = buildStatusValidationRule_();
    var statusValue = resolveStatusForRule_(normalizedStatus, statusRule);

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheetKH = ss.getSheetByName("KHACH");
    var sheetDH = ss.getSheetByName("DON_HANG");
    if (!sheetKH) throw new Error("Không tìm thấy sheet KHACH");
    if (!sheetDH) throw new Error("Không tìm thấy sheet DON_HANG");

    var rowKH = findCustomerRowByOrderCode_(sheetKH, maPhieuOriginal);
    if (!rowKH) throw new Error("Không tìm thấy dữ liệu khách hàng để cập nhật");

    sheetKH.getRange(rowKH, 2, 1, 6).setValues([
      [tenKhach, ngayBan, soDienThoai, maPhieu, tienNo, statusValue],
    ]);
    sheetKH.getRange(rowKH, 7).setDataValidation(statusRule);
    sheetKH.getRange(rowKH, 8).setValue(ghiChu);

    clearOrderMerges_(sheetDH);
    var mapped = getEffectiveOrderRows_(sheetDH, 3);
    var targetRows = [];
    for (var i = 0; i < mapped.length; i++) {
      if (mapped[i].effectiveMaPhieu === maPhieuOriginal) targetRows.push(mapped[i].row);
    }
    for (var j = 0; j < targetRows.length; j++) {
      var r = targetRows[j];
      // B: NGÀY BÁN, C: MÃ PHIẾU, K: GHI CHÚ, L: TRẠNG THÁI
      sheetDH.getRange(r, 2, 1, 2).setValues([[ngayBan, maPhieu]]);
      sheetDH.getRange(r, 11).setValue(ghiChu);
      sheetDH.getRange(r, 12).setDataValidation(statusRule).setValue(statusValue);
    }
    if (sheetDH.getLastRow() >= 3) rebuildOrderMerges_(sheetDH);
    updateSTT_(sheetKH, 3);

    return { success: true, message: "Cập nhật công nợ thành công" };
  } catch (e) {
    return { success: false, message: "Lỗi: " + e.message };
  }
}

function settleAllDebtCustomers() {
  return runWithLockOrQueue_("SETTLE_DEBT", {}, function() {
    return settleAllDebtCustomersInternal_();
  });
}

function settleAllDebtCustomersInternal_() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheetKH = ss.getSheetByName("KHACH");
    var sheetDH = ss.getSheetByName("DON_HANG");
    if (!sheetKH) throw new Error("Không tìm thấy sheet KHACH");
    if (!sheetDH) throw new Error("Không tìm thấy sheet DON_HANG");

    var lastRowKH = sheetKH.getLastRow();
    if (lastRowKH < 3) {
      return { success: true, message: "Không có dữ liệu công nợ để cập nhật", data: { affected: 0 } };
    }

    var rows = sheetKH.getRange(3, 1, lastRowKH - 2, 8).getDisplayValues();
    var statusRule = buildStatusValidationRule_();
    var paidStatus = resolveStatusForRule_("Đã thanh toán", statusRule);
    var changedOrderCodes = {};
    var affected = 0;

    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      var rowNum = i + 3;
      var maPhieu = String(row[4] || "").trim();
      if (!maPhieu) continue;
      var tienNo = parseMoneyNumber_(row[5]);
      var statusKey = getStatusKey_(row[6]);
      if (statusKey === "DEBT" || statusKey === "PARTIAL" || tienNo > 0) {
        sheetKH.getRange(rowNum, 6, 1, 2).setValues([[0, paidStatus]]);
        sheetKH.getRange(rowNum, 7).setDataValidation(statusRule);
        changedOrderCodes[maPhieu] = true;
        affected++;
      }
    }

    if (!affected) {
      return { success: true, message: "Không có khách nào đang nợ để cập nhật", data: { affected: 0 } };
    }

    clearOrderMerges_(sheetDH);
    var mappedRows = getEffectiveOrderRows_(sheetDH, 3);
    for (var j = 0; j < mappedRows.length; j++) {
      var info = mappedRows[j];
      if (!changedOrderCodes[info.effectiveMaPhieu]) continue;
      sheetDH.getRange(info.row, 12).setDataValidation(statusRule).setValue(paidStatus);
    }
    if (sheetDH.getLastRow() >= 3) rebuildOrderMerges_(sheetDH);
    updateSTT_(sheetKH, 3);

    return {
      success: true,
      message: "Đã cập nhật nhanh công nợ thành công",
      data: { affected: affected },
    };
  } catch (e) {
    return { success: false, message: "Lỗi: " + e.message };
  }
}

function getOrderHistory() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("DON_HANG");
    if (!sheet) throw new Error("Không tìm thấy sheet DON_HANG");

    var lastRow = sheet.getLastRow();
    if (lastRow < 3) return { success: true, data: [] };

    // A:L = STT, NGÀY BÁN, MÃ PHIẾU, TÊN SẢN PHẨM, ĐƠN VỊ, SỐ LƯỢNG, GIÁ VỐN, ĐƠN GIÁ BÁN, THÀNH TIỀN, TỔNG HÓA ĐƠN, GHI CHÚ, TRẠNG THÁI
    var rows = sheet.getRange(3, 1, lastRow - 2, 12).getDisplayValues();

    var customerByMaPhieu = {};
    var phoneByMaPhieu = {};
    var debtByMaPhieu = {};
    var sheetKH = ss.getSheetByName("KHACH");
    if (sheetKH) {
      var lastRowKH = sheetKH.getLastRow();
      if (lastRowKH >= 3) {
        // B:F = TÊN KHÁCH, NGÀY BÁN, SĐT, MÃ PHIẾU, TIỀN NỢ
        var khRows = sheetKH.getRange(3, 2, lastRowKH - 2, 5).getDisplayValues();
        for (var c = 0; c < khRows.length; c++) {
          var tenKhach = String(khRows[c][0] || "").trim();
          var maPhieuKH = String(khRows[c][3] || "").trim();
          var tienNoKH = parseMoneyNumber_(khRows[c][4]);
          if (!maPhieuKH || !tenKhach) continue;
          if (!customerByMaPhieu[maPhieuKH]) {
            customerByMaPhieu[maPhieuKH] = tenKhach;
          }
          if (!phoneByMaPhieu[maPhieuKH]) {
            phoneByMaPhieu[maPhieuKH] = String(khRows[c][2] || "").trim();
          }
          if (debtByMaPhieu[maPhieuKH] == null) {
            debtByMaPhieu[maPhieuKH] = tienNoKH;
          }
        }
      }
    }
    var orderMap = {};
    var orderList = [];

    var carryNgayBan = "";
    var carryMaPhieu = "";
    var carryTongHoaDon = "";
    var carryGhiChu = "";
    var carryTrangThai = "";

    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      var ngayBan = String(row[1] || "").trim() || carryNgayBan;
      var maPhieu = String(row[2] || "").trim() || carryMaPhieu;
      var tenSanPham = String(row[3] || "").trim();
      var donVi = String(row[4] || "").trim();
      var soLuong = parseMoneyNumber_(row[5]);
      var giaVon = parseMoneyNumber_(row[6]);
      var donGiaBan = parseMoneyNumber_(row[7]);
      var thanhTien = parseMoneyNumber_(row[8]);
      var tongHoaDonCell = String(row[9] || "").trim() || carryTongHoaDon;
      var ghiChu = String(row[10] || "").trim() || carryGhiChu;
      var trangThai = String(row[11] || "").trim() || carryTrangThai;

      if (ngayBan) carryNgayBan = ngayBan;
      if (maPhieu) carryMaPhieu = maPhieu;
      if (tongHoaDonCell) carryTongHoaDon = tongHoaDonCell;
      if (ghiChu) carryGhiChu = ghiChu;
      if (trangThai) carryTrangThai = trangThai;

      if (!maPhieu || !tenSanPham) continue;

      var key = maPhieu;
      if (!orderMap[key]) {
        orderMap[key] = {
          maPhieu: maPhieu,
          ngayBan: ngayBan,
          tenKhach: customerByMaPhieu[maPhieu] || "Khách ghé thăm",
          soDienThoai: phoneByMaPhieu[maPhieu] || "",
          tienNo: debtByMaPhieu[maPhieu] == null ? 0 : debtByMaPhieu[maPhieu],
          tongHoaDon: parseMoneyNumber_(tongHoaDonCell),
          ghiChu: ghiChu || "-",
          trangThai: trangThai || "Đã thanh toán",
          products: [],
          _index: i,
        };
        orderList.push(orderMap[key]);
      }

      orderMap[key].products.push({
        tenSanPham: tenSanPham,
        donVi: donVi,
        soLuong: soLuong,
        giaVon: giaVon,
        donGiaBan: donGiaBan,
        thanhTien: thanhTien,
      });
    }

    for (var j = 0; j < orderList.length; j++) {
      if (!orderList[j].tongHoaDon || orderList[j].tongHoaDon <= 0) {
        orderList[j].tongHoaDon = orderList[j].products.reduce(function(sum, p) {
          return sum + (p.thanhTien || 0);
        }, 0);
      }
      delete orderList[j]._index;
    }

    return { success: true, data: orderList };
  } catch (e) {
    return { success: false, message: "Lỗi: " + e.message, data: [] };
  }
}

function escapeHtml_(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDisplayDate_(value) {
  var raw = String(value || "").trim();
  if (!raw) return "-";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return raw.slice(8, 10) + "/" + raw.slice(5, 7) + "/" + raw.slice(0, 4);
  }
  return raw;
}

function buildReceiptPdfHtml_(order) {
  var totalFromItems = (order.products || []).reduce(function(sum, p) {
    return sum + (p.soLuong || 0) * (p.donGiaBan || 0);
  }, 0);
  var total = order.tongHoaDon || totalFromItems;
  var tienNo = Math.max(Number(order.tienNo || 0), 0);
  var daTra = Math.max(total - tienNo, 0);
  var createdAt = formatDisplayDate_(order.ngayBan);
  var customerName = order.tenKhach || "Khách ghé thăm";
  var phone = order.soDienThoai || "";
  var note = order.ghiChu || "-";
  var statusText = order.trangThai || "Đã thanh toán";

  var rows = (order.products || []).map(function(p) {
    var thanhTien = (p.soLuong || 0) * (p.donGiaBan || 0);
    return (
      "<tr>" +
      "<td>" + escapeHtml_(p.tenSanPham || "") + "</td>" +
      "<td>" + escapeHtml_(p.donVi || "-") + "</td>" +
      "<td style=\"text-align:right;\">" + formatMoneyNumber_(p.soLuong || 0) + "</td>" +
      "<td style=\"text-align:right;\">" + formatMoneyNumber_(p.donGiaBan || 0) + "</td>" +
      "<td style=\"text-align:right; font-weight:700; color:#be123c;\">" + formatMoneyNumber_(thanhTien) + "</td>" +
      "</tr>"
    );
  }).join("");

  if (!rows) rows = "<tr><td colspan=\"5\" style=\"text-align:center; color:#64748b; padding:16px;\">Không có sản phẩm</td></tr>";

  return (
    "<!doctype html>" +
    "<html lang=\"vi\">" +
    "<head><meta charset=\"utf-8\" />" +
    "<style>" +
    "@page { size: A4; margin: 18mm; }" +
    "body { font-family: Arial, sans-serif; color:#0f172a; }" +
    ".sheet { background:#ffffff; }" +
    ".header { border:1px solid #fecdd3; background: linear-gradient(90deg,#fff1f2, #ffffff); padding:16px; border-radius:14px; }" +
    ".brand { font-weight:800; font-size:22px; color:#be123c; letter-spacing:1px; }" +
    ".muted { color:#64748b; font-size:12px; }" +
    ".box { border:1px solid #e2e8f0; border-radius:12px; padding:14px; }" +
    "table { width:100%; border-collapse: collapse; margin-top:16px; }" +
    "thead th { background:#ffe4e6; color:#be123c; text-transform:uppercase; font-size:11px; letter-spacing:.5px; padding:10px; text-align:left; border-bottom:1px solid #fecdd3; }" +
    "tbody td { border-top:1px solid #f1f5f9; padding:10px; font-size:12px; }" +
    ".summary { border:1px solid #fecdd3; background:#fff1f2; padding:12px; border-radius:12px; width:280px; }" +
    ".summary .row { display:flex; justify-content:space-between; font-size:12px; margin-top:6px; }" +
    ".summary .total { font-weight:800; color:#be123c; }" +
    ".footer { margin-top:24px; font-size:11px; color:#94a3b8; display:flex; justify-content:space-between; }" +
    "</style></head><body>" +
    "<div class=\"sheet\">" +
    "<div class=\"header\">" +
    "<div style=\"display:flex; justify-content:space-between; align-items:flex-start;\">" +
    "<div>" +
    "<div class=\"brand\">DULIA</div>" +
    "<div class=\"muted\">Hóa đơn bán lẻ chuyên nghiệp</div>" +
    "</div>" +
    "<div style=\"text-align:right;\">" +
    "<div class=\"muted\" style=\"text-transform:uppercase; letter-spacing:.6px; color:#f43f5e;\">Mã phiếu</div>" +
    "<div style=\"font-size:22px; font-weight:800;\">" + escapeHtml_(order.maPhieu || "") + "</div>" +
    "<div class=\"muted\">Ngày bán: " + escapeHtml_(createdAt) + "</div>" +
    "</div>" +
    "</div></div>" +
    "<div style=\"display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-top:16px;\">" +
    "<div class=\"box\">" +
    "<div class=\"muted\" style=\"text-transform:uppercase; font-weight:700; color:#be123c;\">Thông tin khách hàng</div>" +
    "<div style=\"margin-top:8px; font-size:13px;\">" +
    "<div style=\"display:flex; justify-content:space-between;\"><span class=\"muted\">Tên</span><strong>" + escapeHtml_(customerName) + "</strong></div>" +
    (phone ? "<div style=\"display:flex; justify-content:space-between; margin-top:6px;\"><span class=\"muted\">SĐT</span><strong>" + escapeHtml_(phone) + "</strong></div>" : "") +
    "<div style=\"display:flex; justify-content:space-between; margin-top:6px;\"><span class=\"muted\">Trạng thái</span><strong>" + escapeHtml_(statusText) + "</strong></div>" +
    "</div></div>" +
    "<div class=\"box\">" +
    "<div class=\"muted\" style=\"text-transform:uppercase; font-weight:700; color:#be123c;\">Ghi chú đơn hàng</div>" +
    "<div style=\"margin-top:8px; font-size:13px; min-height:70px;\">" + escapeHtml_(note) + "</div>" +
    "</div></div>" +
    "<table><colgroup>" +
    "<col style=\"width:40%\" />" +
    "<col style=\"width:14%\" />" +
    "<col style=\"width:10%\" />" +
    "<col style=\"width:18%\" />" +
    "<col style=\"width:18%\" />" +
    "</colgroup><thead><tr>" +
    "<th>Sản phẩm</th><th>Đơn vị</th><th style=\"text-align:right;\">SL</th><th style=\"text-align:right;\">Đơn giá</th><th style=\"text-align:right;\">Thành tiền</th>" +
    "</tr></thead><tbody>" + rows + "</tbody></table>" +
    "<div style=\"display:flex; justify-content:flex-end; margin-top:16px;\">" +
    "<div class=\"summary\">" +
    "<div class=\"row\"><span class=\"muted\">Tổng cộng</span><span class=\"total\">" + formatMoneyNumber_(total) + "</span></div>" +
    "<div class=\"row\"><span class=\"muted\">Đã trả</span><strong>" + formatMoneyNumber_(daTra) + "</strong></div>" +
    (tienNo > 0 ? "<div class=\"row\"><span class=\"muted\">Còn nợ</span><strong>" + formatMoneyNumber_(tienNo) + "</strong></div>" : "") +
    "</div></div>" +
    "<div class=\"footer\"><div>Hóa đơn được tạo bởi <strong style=\"color:#be123c;\">DULIA</strong></div><div>In từ hệ thống bán hàng</div></div>" +
    "</div></body></html>"
  );
}

function buildReceiptPdf_(maPhieu) {
  if (!maPhieu) {
    return HtmlService.createHtmlOutput("Thiếu mã phiếu để in.");
  }
  var res = getOrderHistory();
  if (!res || !res.success) {
    return HtmlService.createHtmlOutput("Không tải được dữ liệu hóa đơn.");
  }
  var order = null;
  for (var i = 0; i < res.data.length; i++) {
    if (String(res.data[i].maPhieu || "").trim() === maPhieu) {
      order = res.data[i];
      break;
    }
  }
  if (!order) {
    return HtmlService.createHtmlOutput("Không tìm thấy hóa đơn cần in.");
  }
  var html = buildReceiptPdfHtml_(order);
  var blob = HtmlService.createHtmlOutput(html).getAs("application/pdf");
  blob.setName("Hoa-don-" + maPhieu + ".pdf");
  return blob;
}

function getOrderByMaPhieu_(maPhieu) {
  var res = getOrderHistory();
  if (!res || !res.success || !res.data) return null;
  for (var i = 0; i < res.data.length; i++) {
    if (String(res.data[i].maPhieu || "").trim() === maPhieu) {
      return res.data[i];
    }
  }
  return null;
}

function ensureReceiptFolder_() {
  var name = "DULIA_HOA_DON_PDF";
  var folders = DriveApp.getFoldersByName(name);
  if (folders.hasNext()) return folders.next();
  return DriveApp.createFolder(name);
}

function createReceiptPdf(maPhieu) {
  try {
    var key = String(maPhieu || "").trim();
    if (!key) return { success: false, message: "Thiếu mã phiếu." };
    var order = getOrderByMaPhieu_(key);
    if (!order) return { success: false, message: "Không tìm thấy hóa đơn." };
    var html = buildReceiptPdfHtml_(order);
    var blob = HtmlService.createHtmlOutput(html).getAs("application/pdf");
    blob.setName("Hoa-don-" + key + ".pdf");
    var folder = ensureReceiptFolder_();
    var file = folder.createFile(blob);
    return {
      success: true,
      url: file.getUrl(),
      downloadUrl: file.getDownloadUrl(),
      name: file.getName(),
    };
  } catch (e) {
    return { success: false, message: "Lỗi: " + e.message };
  }
}

function authorizeDrive() {
  ensureReceiptFolder_();
  return { success: true, message: "Drive permission granted." };
}

function getEffectiveOrderRows_(sheet, dataStartRow) {
  var lastRow = sheet.getLastRow();
  if (lastRow < dataStartRow) return [];
  var rows = sheet.getRange(dataStartRow, 1, lastRow - dataStartRow + 1, 12).getDisplayValues();
  var out = [];
  var carryMaPhieu = "";
  for (var i = 0; i < rows.length; i++) {
    var maPhieu = String(rows[i][2] || "").trim() || carryMaPhieu;
    if (String(rows[i][2] || "").trim()) carryMaPhieu = String(rows[i][2] || "").trim();
    out.push({
      row: dataStartRow + i,
      effectiveMaPhieu: maPhieu,
    });
  }
  return out;
}

function clearOrderMerges_(sheet) {
  var dataStartRow = 3;
  var lastRow = sheet.getLastRow();
  if (lastRow < dataStartRow) return;
  var lastCol = sheet.getLastColumn();
  if (lastCol < 1) return;
  // Break all merged ranges in data area to avoid partial-merge write errors.
  var merged = sheet
    .getRange(dataStartRow, 1, lastRow - dataStartRow + 1, lastCol)
    .getMergedRanges();
  for (var i = 0; i < merged.length; i++) {
    merged[i].breakApart();
  }
}

function rebuildOrderMerges_(sheet) {
  var dataStartRow = 3;
  var rows = getEffectiveOrderRows_(sheet, dataStartRow);
  if (!rows.length) return;
  var mergeCols = [2, 3, 10, 11, 12];
  var start = 0;
  while (start < rows.length) {
    var end = start;
    while (end + 1 < rows.length && rows[end + 1].effectiveMaPhieu === rows[start].effectiveMaPhieu) {
      end++;
    }
    var rowCount = end - start + 1;
    if (rowCount > 1 && rows[start].effectiveMaPhieu) {
      for (var c = 0; c < mergeCols.length; c++) {
        var range = sheet.getRange(rows[start].row, mergeCols[c], rowCount, 1);
        range.mergeVertically();
        range.setVerticalAlignment("middle");
      }
    }
    start = end + 1;
  }
}

function deleteRowsByOrderCode_(sheetDH, maPhieu, options) {
  options = options || {};
  var key = String(maPhieu || "").trim();
  if (!key) return 0;
  clearOrderMerges_(sheetDH);
  var mappedRows = getEffectiveOrderRows_(sheetDH, 3);
  var targetRows = [];
  for (var i = 0; i < mappedRows.length; i++) {
    if (mappedRows[i].effectiveMaPhieu === key) targetRows.push(mappedRows[i].row);
  }
  for (var j = targetRows.length - 1; j >= 0; j--) {
    sheetDH.deleteRow(targetRows[j]);
  }
  if (sheetDH.getLastRow() >= 3) {
    updateSTT_(sheetDH, 3);
    if (!options.skipRebuildMerges) rebuildOrderMerges_(sheetDH);
  }
  return targetRows.length;
}

function deleteCustomerRowsByOrderCode_(sheetKH, maPhieu) {
  var key = String(maPhieu || "").trim();
  if (!key) return 0;
  var lastRow = sheetKH.getLastRow();
  if (lastRow < 3) return 0;
  var values = sheetKH.getRange(3, 5, lastRow - 2, 1).getDisplayValues();
  var rows = [];
  for (var i = 0; i < values.length; i++) {
    if (String(values[i][0] || "").trim() === key) rows.push(i + 3);
  }
  for (var j = rows.length - 1; j >= 0; j--) {
    sheetKH.deleteRow(rows[j]);
  }
  if (sheetKH.getLastRow() >= 3) updateSTT_(sheetKH, 3);
  return rows.length;
}

function deleteOrder(maPhieu) {
  return runWithLockOrQueue_("DELETE_ORDER", { maPhieu: maPhieu }, function() {
    return deleteOrderInternal_(maPhieu);
  });
}

function deleteOrderInternal_(maPhieu) {
  try {
    var key = String(maPhieu || "").trim();
    if (!key) throw new Error("Thiếu mã phiếu");
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheetDH = ss.getSheetByName("DON_HANG");
    var sheetKH = ss.getSheetByName("KHACH");
    if (!sheetDH) throw new Error("Không tìm thấy sheet DON_HANG");
    if (!sheetKH) throw new Error("Không tìm thấy sheet KHACH");

    var deletedDH = deleteRowsByOrderCode_(sheetDH, key);
    var deletedKH = deleteCustomerRowsByOrderCode_(sheetKH, key);
    if (deletedDH === 0 && deletedKH === 0) {
      return { success: false, message: "Không tìm thấy hóa đơn để xóa" };
    }
    return { success: true, message: "Đã xóa hóa đơn thành công" };
  } catch (e) {
    return { success: false, message: "Lỗi: " + e.message };
  }
}

function updateOrder(payload) {
  return runWithLockOrQueue_("UPDATE_ORDER", { payload: payload }, function() {
    return updateOrderInternal_(payload);
  });
}

function updateOrderInternal_(payload) {
  try {
    var maPhieuOriginal = String((payload && payload.maPhieuOriginal) || "").trim();
    if (!maPhieuOriginal) throw new Error("Thiếu mã phiếu gốc");
    var orderInfo = (payload && payload.orderInfo) || {};
    var products = (payload && payload.products) || [];
    if (!products.length) throw new Error("Đơn hàng phải có ít nhất một sản phẩm");

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheetDH = ss.getSheetByName("DON_HANG");
    var sheetKH = ss.getSheetByName("KHACH");
    if (!sheetDH) throw new Error("Không tìm thấy sheet DON_HANG");
    if (!sheetKH) throw new Error("Không tìm thấy sheet KHACH");

    var existedRows = getEffectiveOrderRows_(sheetDH, 3).filter(function (r) {
      return r.effectiveMaPhieu === maPhieuOriginal;
    }).length;
    if (!existedRows) throw new Error("Không tìm thấy hóa đơn để cập nhật");

    deleteRowsByOrderCode_(sheetDH, maPhieuOriginal, { skipRebuildMerges: true });
    deleteCustomerRowsByOrderCode_(sheetKH, maPhieuOriginal);

    var orderData = {
      customer: payload.customer || null,
      orderInfo: orderInfo,
      products: products,
    };
    var createResult = createOrder(orderData, { skipClearMerges: true });
    if (!createResult || !createResult.success) return createResult;
    return { success: true, message: "Cập nhật hóa đơn thành công!" };
  } catch (e) {
    return { success: false, message: "Lỗi: " + e.message };
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
  var rowValues = sheet.getRange(dataStartRow, 1, numRows, sheet.getLastColumn()).getDisplayValues();
  var sttValues = new Array(numRows);
  var stt = 0;
  for (var i = 0; i < numRows; i++) {
    var row = rowValues[i];
    // A is STT itself, so detect actual data from column B onward.
    var hasData = false;
    for (var c = 1; c < row.length; c++) {
      if (String(row[c] || "").trim()) {
        hasData = true;
        break;
      }
    }
    if (hasData) {
      stt++;
      sttValues[i] = [stt];
    } else {
      sttValues[i] = [""];
    }
  }
  sheet.getRange(dataStartRow, 1, numRows, 1).setValues(sttValues);
}

function normalizeOrderStatus_(status) {
  var raw = String(status || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
  if (raw.indexOf("da thanh toan qr") !== -1 || raw.indexOf("đã thanh toán qr") !== -1)
    return "Đã thanh toán QR";
  if (raw.indexOf("tra một phan qr") !== -1 || raw.indexOf("trả một phần qr") !== -1 || raw.indexOf("tra mot phan qr") !== -1)
    return "Trả một phần QR";
  if (raw === "tra một phan" || raw === "trả một phần") return "Trả một phần";
  if (raw === "tra một phần" || raw === "trả một phần") return "Trả một phần";
  if (raw === "tra mot phan" || raw === "trả mot phan") return "Trả một phần";
  if (raw === "no" || raw === "nợ") return "Nợ";
  return "Đã thanh toán";
}

function normalizeOrderStatusFromInfo_(orderInfo) {
  var code = String((orderInfo && orderInfo.trangThaiCode) || "").trim().toUpperCase();
  var label = String((orderInfo && orderInfo.trangThai) || "").trim();
  if (code === "PAID") {
    if (normalizeCompareText_(label).indexOf("da thanh toan qr") !== -1) return "Đã thanh toán QR";
    return "Đã thanh toán";
  }
  if (code === "PARTIAL") {
    if (normalizeCompareText_(label).indexOf("tra mot phan qr") !== -1) return "Trả một phần QR";
    return "Trả một phần";
  }
  if (code === "DEBT") return "Nợ";
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
    .replace(/đ/g, "d")
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
  var statusOptions = [
    "Đã thanh toán",
    "Đã thanh toán QR",
    "Trả một phần",
    "Trả một phần QR",
    "Nợ",
  ];
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

function ensureQueueSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("QUEUE");
  if (!sheet) {
    sheet = ss.insertSheet("QUEUE");
    sheet.getRange(1, 1, 1, 7).setValues([[
      "createdAt",
      "status",
      "action",
      "payload",
      "result",
      "error",
      "updatedAt",
    ]]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function ensureQueueTrigger_() {
  try {
    var triggers = ScriptApp.getProjectTriggers();
    var hasQueueTrigger = triggers.some(function(t) {
      return t.getHandlerFunction && t.getHandlerFunction() === "processQueue";
    });
    if (!hasQueueTrigger) {
      // Ensure authorization is prompted when needed.
      ScriptApp.newTrigger("processQueue")
        .timeBased()
        .everyMinutes(1)
        .create();
    }
    return true;
  } catch (e) {
    Logger.log("WARN ensureQueueTrigger_: " + e.message);
    return false;
  }
}

function setupQueueInfrastructure() {
  ensureQueueSheet_();
  var ok = ensureQueueTrigger_();
  return {
    success: ok,
    message: ok
      ? "Queue đã sẵn sàng."
      : "Không tạo được trigger. Hãy cấp quyền script.scriptapp và chạy lại."
  };
}

function enqueueOperation_(action, payload) {
  var sheet = ensureQueueSheet_();
  var now = new Date();
  var row = [now, "PENDING", action, JSON.stringify(payload || {}), "", "", now];
  sheet.appendRow(row);
  ensureQueueTrigger_();
  return sheet.getLastRow();
}

function runWithLockOrQueue_(action, payload, fn) {
  var lock = LockService.getDocumentLock();
  var locked = false;
  try {
    lock.waitLock(5000);
    locked = true;
  } catch (e) {
    var jobId = enqueueOperation_(action, payload);
    return {
      success: true,
      queued: true,
      jobId: jobId,
      message: "Hệ thống đang bận, yêu cầu đã được đưa vào hàng đợi."
    };
  }
  try {
    return fn();
  } finally {
    if (locked) lock.releaseLock();
  }
}

function processQueue() {
  var lock = LockService.getDocumentLock();
  lock.waitLock(30000);
  try {
    var sheet = ensureQueueSheet_();
    var data = sheet.getDataRange().getValues();
    if (data.length <= 1) return { success: true, processed: 0 };
    var header = data[0];
    var idxStatus = 1;
    var idxAction = 2;
    var idxPayload = 3;
    var idxResult = 4;
    var idxError = 5;
    var idxUpdated = 6;
    var processed = 0;
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      if (row[idxStatus] !== "PENDING") continue;
      sheet.getRange(i + 1, idxStatus + 1).setValue("PROCESSING");
      sheet.getRange(i + 1, idxUpdated + 1).setValue(new Date());
      var action = row[idxAction];
      var payload = {};
      try {
        payload = JSON.parse(row[idxPayload] || "{}");
      } catch (e) {
        payload = {};
      }
      try {
        var result = dispatchQueueAction_(action, payload);
        sheet.getRange(i + 1, idxStatus + 1).setValue("SUCCESS");
        sheet.getRange(i + 1, idxResult + 1).setValue(JSON.stringify(result || {}));
      } catch (err) {
        sheet.getRange(i + 1, idxStatus + 1).setValue("FAILED");
        sheet.getRange(i + 1, idxError + 1).setValue(String(err && err.message ? err.message : err));
      }
      sheet.getRange(i + 1, idxUpdated + 1).setValue(new Date());
      processed++;
    }
    return { success: true, processed: processed };
  } finally {
    lock.releaseLock();
  }
}

function dispatchQueueAction_(action, payload) {
  if (action === "CREATE_ORDER") return createOrderInternal_(payload.orderData, payload.options || {});
  if (action === "UPDATE_ORDER") return updateOrderInternal_(payload.payload);
  if (action === "DELETE_ORDER") return deleteOrderInternal_(payload.maPhieu);
  if (action === "UPDATE_DEBT") return updateDebtCustomerInternal_(payload.payload);
  if (action === "SETTLE_DEBT") return settleAllDebtCustomersInternal_();
  if (action === "UPDATE_PRODUCT") return updateProductCatalogItemInternal_(payload.payload);
  if (action === "CREATE_PRODUCT") return createProductCatalogItemInternal_(payload.payload);
  if (action === "DELETE_PRODUCT") return deleteProductCatalogItemInternal_(payload.payload);
  throw new Error("Unknown queue action: " + action);
}

function createOrder(orderData, options) {
  return runWithLockOrQueue_("CREATE_ORDER", { orderData: orderData, options: options || {} }, function() {
    return createOrderInternal_(orderData, options || {});
  });
}

function createOrderInternal_(orderData, options) {
  try {
    options = options || {};
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

    if (!options.skipClearMerges) {
      // Always unmerge existing data area before inserting/writing new rows.
      clearOrderMerges_(sheetDH);
    }

    // Batch insert/write rows to reduce API calls and speed up updates.
    var rowCount = products.length;
    sheetDH.insertRowsBefore(3, rowCount);
    var orderRows = [];
    var statusRows = [];
    for (var i = 0; i < products.length; i++) {
      var p = products[i];
      var thanhTien = (p.soLuong || 0) * (p.donGiaBan || 0);
      var giaVon = p.giaVon || 0;
      var isFirst = i === 0;
      orderRows.push([
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
        statusForDH,
      ]);
      statusRows.push([statusForDH]);
    }
    try {
      sheetDH.getRange(3, 1, rowCount, 12).setValues(orderRows);
    } catch (rowWriteErr) {
      // Fallback nếu cột trạng thái bị chặn bởi data validation.
      sheetDH.getRange(3, 1, rowCount, 11).setValues(
        orderRows.map(function(r) {
          return r.slice(0, 11);
        })
      );
      applyKnownStatusValidation_(sheetDH, 3, rowCount, 12, statusRuleDH);
      sheetDH.getRange(3, 12, rowCount, 1).setValues(statusRows);
    }

    // Auto cập nhật STT cho DON_HANG (data bắt đầu từ row 3)
    updateSTT_(sheetDH, 3);

    // Best effort: format/validation không được làm fail luồng tạo đơn.
    try {
      applyKnownStatusValidation_(
        sheetDH,
        3,
        rowCount,
        statusColDH,
        statusRuleDH,
      );
      // Rebuild merge blocks for all orders by maPhieu (preserves grouping logic).
      rebuildOrderMerges_(sheetDH);
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
const getBankConfigClient = () => call("getBankConfig");
const updateProductCatalogItemClient = (payload) => call("updateProductCatalogItem", payload);
const createProductCatalogItemClient = (payload) => call("createProductCatalogItem", payload);
const deleteProductCatalogItemClient = (payload) => call("deleteProductCatalogItem", payload);
const getCustomerCatalogClient = () => call("getCustomerCatalog");
const getDebtCustomersClient = () => call("getDebtCustomers");
const updateDebtCustomerClient = (payload) => call("updateDebtCustomer", payload);
const settleAllDebtCustomersClient = () => call("settleAllDebtCustomers");
const getOrderHistoryClient = () => call("getOrderHistory");
const createReceiptPdfClient = (maPhieu) => call("createReceiptPdf", maPhieu);
const updateOrderClient = (payload) => call("updateOrder", payload);
const deleteOrderClient = (maPhieu) => call("deleteOrder", maPhieu);

export const gasAdapter = {
  call,
  helloServer: helloServerClient,
  login: loginClient,
  getUserInfo: getUserInfoClient,
  getDemoAccounts: getDemoAccountsClient,
  getGlobalNotice: getGlobalNoticeClient,
  getNextOrderFormDefaults: getNextOrderFormDefaultsClient,
  getProductCatalog: getProductCatalogClient,
  getBankConfig: getBankConfigClient,
  updateProductCatalogItem: updateProductCatalogItemClient,
  createProductCatalogItem: createProductCatalogItemClient,
  deleteProductCatalogItem: deleteProductCatalogItemClient,
  getCustomerCatalog: getCustomerCatalogClient,
  getDebtCustomers: getDebtCustomersClient,
  updateDebtCustomer: updateDebtCustomerClient,
  settleAllDebtCustomers: settleAllDebtCustomersClient,
  getOrderHistory: getOrderHistoryClient,
  createReceiptPdf: createReceiptPdfClient,
  createOrder: (orderData) => call("createOrder", orderData),
  createInventoryReceipt: (payload) => call("createInventoryReceipt", payload),
  updateOrder: updateOrderClient,
  deleteOrder: deleteOrderClient,
};
