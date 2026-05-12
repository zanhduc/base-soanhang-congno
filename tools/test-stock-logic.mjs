import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

class MemoryStorage {
  constructor() {
    this.map = new Map();
  }
  getItem(key) {
    return this.map.has(key) ? this.map.get(key) : null;
  }
  setItem(key, value) {
    this.map.set(key, String(value));
  }
  removeItem(key) {
    this.map.delete(key);
  }
  clear() {
    this.map.clear();
  }
}

function ensureBrowserLikeGlobals() {
  const localStorage = new MemoryStorage();
  const sessionStorage = new MemoryStorage();
  globalThis.localStorage = localStorage;
  globalThis.sessionStorage = sessionStorage;
  globalThis.window = {
    localStorage,
    sessionStorage,
  };
}

function scanFile(filePath, shouldContain = [], shouldNotContain = []) {
  const content = fs.readFileSync(filePath, "utf8");
  for (const token of shouldContain) {
    assert.ok(
      content.includes(token),
      `Expected "${path.basename(filePath)}" to contain: ${token}`,
    );
  }
  for (const token of shouldNotContain) {
    assert.ok(
      !content.includes(token),
      `Expected "${path.basename(filePath)}" to NOT contain: ${token}`,
    );
  }
}

async function main() {
  ensureBrowserLikeGlobals();

  const { localAdapter } = await import(
    "../src/client/api/adapters/localAdapter.js"
  );

  const results = [];

  async function runCase(name, fn) {
    try {
      await fn();
      results.push({ name, ok: true });
      console.log(`✓ ${name}`);
    } catch (err) {
      results.push({ name, ok: false, err });
      console.error(`✗ ${name}`);
      console.error(err?.stack || err);
    }
  }

  await runCase("TC01: localAdapter contract exposes required methods", async () => {
    const requiredMethods = [
      "getProductCatalog",
      "createInventoryReceipt",
      "createOrder",
      "getInventory",
      "getSyncVersion",
      "updateBankConfig",
      "formatAllSheets",
    ];
    for (const name of requiredMethods) {
      assert.equal(
        typeof localAdapter[name],
        "function",
        `localAdapter is missing method: ${name}`,
      );
    }
  });

  await runCase("TC02: updateBankConfig rejects missing accountNumber", async () => {
    const res = await localAdapter.updateBankConfig({
      bankCode: "mbbank",
      accountNumber: "",
      accountName: "Test",
    });
    assert.equal(res?.success, false);
  });

  await runCase("TC03: updateBankConfig valid payload updates values", async () => {
    const updated = await localAdapter.updateBankConfig({
      bankCode: "vcb",
      accountNumber: "0123456789",
      accountName: "Unit Test",
    });
    assert.equal(updated?.success, true);

    const readBack = await localAdapter.getBankConfig();
    assert.equal(readBack?.success, true);
    assert.equal(readBack?.data?.bankCode, "vcb");
    assert.equal(readBack?.data?.accountNumber, "0123456789");
    assert.equal(readBack?.data?.accountName, "Unit Test");
  });

  await runCase("TC04: getSyncVersion returns version string", async () => {
    const syncRes = await localAdapter.getSyncVersion();
    assert.equal(syncRes?.success, true);
    assert.equal(typeof syncRes?.data?.version, "string");
    assert.ok(syncRes?.data?.version.length > 0);
  });

  await runCase("TC05: createInventoryReceipt increases existing stock correctly", async () => {
    const beforeCatalogRes = await localAdapter.getProductCatalog();
    assert.equal(beforeCatalogRes?.success, true, "getProductCatalog failed");

    const beforeItem = beforeCatalogRes.data.find(
      (x) => x.tenSanPham === "Mì gói Hảo Hảo" && x.donVi === "Gói",
    );
    assert.ok(beforeItem, "Seed product not found in mock catalog");
    const beforeTonKho = Number(beforeItem.tonKho || 0);

    const receiptRes = await localAdapter.createInventoryReceipt({
      receiptInfo: {
        maPhieu: "PNTEST001",
        ngayNhap: "2026-05-09",
        nhaCungCap: "NCC Test",
        soDienThoai: "0900000000",
        tongTienPhieu: 180000,
        trangThai: "Đã thanh toán",
        ghiChu: "smoke test",
        soTienDaTra: 180000,
      },
      products: [
        {
          tenSanPham: "Mì gói Hảo Hảo",
          nhomHang: "Đồ đóng gói",
          soLuong: 2,
          donViChan: "Thùng",
          donViLe: "Gói",
          quyDoi: 30,
          giaNhapChan: 90000,
        },
      ],
    });
    assert.equal(receiptRes?.success, true, "createInventoryReceipt failed");

    const afterCatalogRes = await localAdapter.getProductCatalog();
    const afterItem = afterCatalogRes.data.find(
      (x) => x.tenSanPham === "Mì gói Hảo Hảo" && x.donVi === "Gói",
    );
    assert.ok(afterItem, "Product disappeared after createInventoryReceipt");

    const expectedIncrease = 2 * 30;
    assert.equal(
      Number(afterItem.tonKho || 0),
      beforeTonKho + expectedIncrease,
      "Inventory tonKho did not increase as expected after createInventoryReceipt",
    );
    assert.equal(Number(afterItem.giaVon || 0), 3000);
  });

  await runCase("TC06: createInventoryReceipt auto-creates missing product", async () => {
    const newProductName = "SP Test Moi";
    const unit = "Chai";

    const receiptRes = await localAdapter.createInventoryReceipt({
      receiptInfo: {
        maPhieu: "PNTEST002",
        ngayNhap: "2026-05-09",
        nhaCungCap: "NCC Test",
        tongTienPhieu: 50000,
        trangThai: "Đã thanh toán",
      },
      products: [
        {
          tenSanPham: newProductName,
          nhomHang: "Test",
          soLuong: 5,
          donViChan: "Thùng",
          donViLe: unit,
          quyDoi: 10,
          giaNhapChan: 10000,
        },
      ],
    });
    assert.equal(receiptRes?.success, true);

    const catalogRes = await localAdapter.getProductCatalog();
    const created = catalogRes.data.find(
      (x) => x.tenSanPham === newProductName && x.donVi === unit,
    );
    assert.ok(created, "New inventory product was not created");
    assert.equal(Number(created.tonKho || 0), 50);
    assert.equal(Number(created.giaVon || 0), 1000);
  });

  await runCase("TC07: partial supplier debt is created for receipt status 'Trả một phần'", async () => {
    const beforeDebtRes = await localAdapter.getSupplierDebts();
    assert.equal(beforeDebtRes?.success, true);
    const beforeCount = beforeDebtRes.data.length;

    const receiptRes = await localAdapter.createInventoryReceipt({
      receiptInfo: {
        maPhieu: "PNTEST003",
        ngayNhap: "2026-05-09",
        nhaCungCap: "NCC Debt",
        soDienThoai: "0900111222",
        tongTienPhieu: 100000,
        soTienDaTra: 40000,
        trangThai: "Trả một phần",
      },
      products: [
        {
          tenSanPham: "Bánh Oreo",
          nhomHang: "Bánh kẹo",
          soLuong: 1,
          donViChan: "Hộp",
          donViLe: "Gói",
          quyDoi: 12,
          giaNhapChan: 120000,
        },
      ],
    });
    assert.equal(receiptRes?.success, true);

    const afterDebtRes = await localAdapter.getSupplierDebts();
    assert.equal(afterDebtRes.data.length, beforeCount + 1);

    const added = afterDebtRes.data.find((d) => d.maPhieu === "PNTEST003");
    assert.ok(added, "Expected supplier debt entry for PNTEST003");
    assert.equal(Number(added.tienNo || 0), 60000);
    assert.equal(added.trangThai, "Trả một phần");
  });

  await runCase("TC08: alternative flow quyDoi=0 falls back to 1 (no Infinity/NaN)", async () => {
    const name = "SP QuyDoi 0";
    const unit = "Lon";

    const receiptRes = await localAdapter.createInventoryReceipt({
      receiptInfo: {
        maPhieu: "PNTEST004",
        ngayNhap: "2026-05-09",
        nhaCungCap: "NCC Zero",
        tongTienPhieu: 50000,
        trangThai: "Đã thanh toán",
      },
      products: [
        {
          tenSanPham: name,
          nhomHang: "Test",
          soLuong: 2,
          donViChan: "Thùng",
          donViLe: unit,
          quyDoi: 0,
          giaNhapChan: 50000,
        },
      ],
    });
    assert.equal(receiptRes?.success, true);

    const catalogRes = await localAdapter.getProductCatalog();
    const item = catalogRes.data.find(
      (x) => x.tenSanPham === name && x.donVi === unit,
    );
    assert.ok(item, "Product should still be created for invalid quyDoi flow");
    assert.equal(Number(item.quyCach || 0), 1);
    assert.equal(Number(item.tonKho || 0), 2);
    assert.ok(Number.isFinite(Number(item.giaVon)));
    assert.equal(Number(item.giaVon || 0), 50000);
  });

  await runCase("TC09: createOrder happy path returns success", async () => {
    const orderRes = await localAdapter.createOrder({
      customer: { tenKhach: "Khách test", soDienThoai: "0900000001" },
      orderInfo: { maPhieu: "DHTEST001", ngayBan: "2026-05-09" },
      products: [
        {
          tenSanPham: "Mì gói Hảo Hảo",
          donVi: "Gói",
          soLuong: 1,
          donGiaBan: 5000,
          giaVon: 3000,
        },
      ],
    });
    assert.equal(orderRes?.success, true, "createOrder failed");
  });

  await runCase("TC10: updateOrder rejects missing original code", async () => {
    const res = await localAdapter.updateOrder({
      maPhieuOriginal: "",
      orderInfo: { maPhieu: "DHA" },
      products: [{ tenSanPham: "x", donVi: "c", soLuong: 1, donGiaBan: 1 }],
    });
    assert.equal(res?.success, false);
  });

  await runCase("TC11: updateOrder rejects unknown bill", async () => {
    const res = await localAdapter.updateOrder({
      maPhieuOriginal: "DH_NOT_FOUND",
      orderInfo: { maPhieu: "DH_NOT_FOUND" },
      products: [{ tenSanPham: "x", donVi: "c", soLuong: 1, donGiaBan: 1 }],
    });
    assert.equal(res?.success, false);
  });

  await runCase("TC12: updateOrder accepts valid existing bill", async () => {
    const res = await localAdapter.updateOrder({
      maPhieuOriginal: "DH012",
      orderInfo: {
        maPhieu: "DH012",
        ngayBan: "2026-05-09",
        ghiChu: "updated by smoke test",
        trangThaiCode: "PARTIAL",
        soTienDaTra: 5000,
      },
      customer: { tenKhach: "Khách test alt", soDienThoai: "0900111000" },
      products: [
        {
          tenSanPham: "Mì gói Hảo Hảo",
          donVi: "Gói",
          soLuong: 2,
          donGiaBan: 5000,
          giaVon: 3000,
        },
      ],
    });
    assert.equal(res?.success, true);

    const historyRes = await localAdapter.getOrderHistory();
    const row = historyRes.data.find((x) => x.maPhieu === "DH012");
    assert.ok(row, "DH012 should exist after update");
    assert.equal(row.trangThai, "Trả một phần");
    assert.equal(Number(row.tienNo || 0), 5000);
  });

  await runCase("TC13: deleteOrder rejects empty code", async () => {
    const res = await localAdapter.deleteOrder("");
    assert.equal(res?.success, false);
  });

  await runCase("TC14: deleteOrder rejects unknown code", async () => {
    const res = await localAdapter.deleteOrder("DH_UNKNOWN_999");
    assert.equal(res?.success, false);
  });

  await runCase("TC15: deleteOrder removes existing bill", async () => {
    const res = await localAdapter.deleteOrder("DH000");
    assert.equal(res?.success, true);

    const historyRes = await localAdapter.getOrderHistory();
    const stillExists = historyRes.data.some((x) => x.maPhieu === "DH000");
    assert.equal(stillExists, false);
  });

  await runCase("TC16: createProductCatalogItem rejects duplicate product+unit", async () => {
    const res = await localAdapter.createProductCatalogItem({
      tenSanPham: "Mì gói Hảo Hảo",
      nhomHang: "Đồ đóng gói",
      donVi: "Gói",
      donGiaBan: 5000,
      giaVon: 3000,
      donViLon: "Thùng",
      quyCach: 30,
    });
    assert.equal(res?.success, false);
  });

  await runCase("TC17: createProductCatalogItem rejects missing unit", async () => {
    const res = await localAdapter.createProductCatalogItem({
      tenSanPham: "SP Missing Unit",
      nhomHang: "Test",
      donVi: "",
      donGiaBan: 5000,
    });
    assert.equal(res?.success, false);
  });

  await runCase("TC18: updateSupplierDebt rejects unknown receipt", async () => {
    const res = await localAdapter.updateSupplierDebt({
      maPhieuOriginal: "NH_NOT_FOUND",
      maPhieu: "NH_NOT_FOUND",
      trangThai: "Đã thanh toán",
      tienNo: 0,
    });
    assert.equal(res?.success, false);
  });

  await runCase("TC19: getInventory returns finite tonKho values", async () => {
    const inv = await localAdapter.getInventory();
    assert.equal(inv?.success, true);
    assert.ok(Array.isArray(inv?.data));
    for (const item of inv.data) {
      assert.ok(Number.isFinite(Number(item.tonKho || 0)));
    }
  });

  await runCase("TC20: gasAdapter still has stock delta calls for order/receipt", async () => {
    const gasAdapterPath = path.resolve(
      process.cwd(),
      "src/client/api/adapters/gasAdapter.js",
    );
    const gasContent = fs.readFileSync(gasAdapterPath, "utf8");

    assert.ok(
      /applyInventoryDeltaByProducts_\(khoValues,\s*products,\s*-1\)/.test(
        gasContent,
      ),
      "gasAdapter is missing stock deduction call (-1) in order flow",
    );
    assert.ok(
      /applyInventoryDeltaByProducts_\(khoValues,\s*products,\s*1,\s*\{/.test(
        gasContent,
      ),
      "gasAdapter is missing stock increment call (+1) in receipt flow",
    );
  });

  await runCase("TC21: UI text keeps 'Nhập sản phẩm' and removes 'Nhập nguyên liệu'", async () => {
    scanFile(
      path.resolve(process.cwd(), "src/client/components/FloatingMenu.jsx"),
      ["Nhập sản phẩm"],
      ["Nhập nguyên liệu"],
    );
    scanFile(
      path.resolve(process.cwd(), "src/client/pages/history.jsx"),
      ["Nhập sản phẩm"],
      ["Nhập nguyên liệu"],
    );
    scanFile(
      path.resolve(process.cwd(), "src/client/pages/inventory.jsx"),
      ["Nhập Sản Phẩm"],
      ["Nhập Nguyên Liệu", "nguyên liệu"],
    );
  });

  await runCase("TC22: source cleanup has no homestay/stay-room tokens", async () => {
    const srcRoot = path.resolve(process.cwd(), "src");
    const files = [];

    (function walk(dir) {
      for (const name of fs.readdirSync(dir)) {
        const full = path.join(dir, name);
        const st = fs.statSync(full);
        if (st.isDirectory()) walk(full);
        else if (st.isFile() && /\.(js|jsx|ts|tsx|html)$/.test(name)) {
          files.push(full);
        }
      }
    })(srcRoot);

    const forbiddenTokens = [
      "homestay",
      "checkInRoom",
      "checkoutRoom",
      "getRooms",
      "getStayHistory",
      "addStayServiceItem",
      "updateRoomStatus",
      "bootstrapHomestaySheets",
      "maPhong",
      "LUU_TRU",
      "HOMESTAY",
    ];

    for (const file of files) {
      const content = fs.readFileSync(file, "utf8");
      for (const token of forbiddenTokens) {
        assert.ok(
          !content.includes(token),
          `Forbidden token "${token}" found in ${path.relative(process.cwd(), file)}`,
        );
      }
    }
  });

  const failed = results.filter((r) => !r.ok);
  const passed = results.length - failed.length;

  console.log("----------------------------------------");
  console.log(`Total: ${results.length} | Passed: ${passed} | Failed: ${failed.length}`);

  if (failed.length) {
    console.error("Failed cases:");
    for (const f of failed) console.error(`- ${f.name}`);
    throw new Error(`Smoke test failed with ${failed.length} failed case(s).`);
  }

  console.log("Smoke tests passed: stock logic, contract, and alternative flows.");
}

main().catch((err) => {
  console.error("Smoke tests failed.");
  console.error(err?.stack || err);
  process.exit(1);
});
