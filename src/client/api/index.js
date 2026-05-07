import { localAdapter } from "./adapters/localAdapter.js";
import { gasAdapter } from "./adapters/gasAdapter.js";
import {
  createLocalFirstReader,
  createMutationWithInvalidation,
  clearCacheByKeys,
  setMutationSuccessHook,
} from "./localCache.js";
import { publishRealtimeMutationSignal } from "../realtime/firebaseSync.js";

const adapter = import.meta.env.DEV ? localAdapter : gasAdapter;

export const api = adapter;

const CACHE_KEYS = {
  productCatalog: "product_catalog",
  bankConfig: "bank_config",
  customerCatalog: "customer_catalog",
  supplierCatalog: "supplier_catalog",
  debtCustomers: "debt_customers",
  orderHistory: "order_history",
  inventory: "inventory",
  receiptHistory: "receipt_history",
  inventorySuggestions: "inventory_suggestions",
  supplierDebts: "supplier_debts",
};

const READ_KEYS = Object.values(CACHE_KEYS);
const INVALIDATION_KEYS = Object.freeze({
  updateBankConfig: [CACHE_KEYS.bankConfig],
  updateProductCatalogItem: [
    CACHE_KEYS.productCatalog,
    CACHE_KEYS.inventory,
    CACHE_KEYS.inventorySuggestions,
  ],
  createProductCatalogItem: [
    CACHE_KEYS.productCatalog,
    CACHE_KEYS.inventory,
    CACHE_KEYS.inventorySuggestions,
  ],
  deleteProductCatalogItem: [
    CACHE_KEYS.productCatalog,
    CACHE_KEYS.inventory,
    CACHE_KEYS.inventorySuggestions,
  ],
  updateDebtCustomer: [
    CACHE_KEYS.debtCustomers,
    CACHE_KEYS.orderHistory,
    CACHE_KEYS.customerCatalog,
  ],
  settleAllDebtCustomers: [CACHE_KEYS.debtCustomers, CACHE_KEYS.orderHistory],
  createOrder: [
    CACHE_KEYS.orderHistory,
    CACHE_KEYS.inventory,
    CACHE_KEYS.debtCustomers,
    CACHE_KEYS.productCatalog,
    CACHE_KEYS.inventorySuggestions,
    CACHE_KEYS.customerCatalog,
  ],
  createInventoryReceipt: [
    CACHE_KEYS.inventory,
    CACHE_KEYS.receiptHistory,
    CACHE_KEYS.supplierDebts,
    CACHE_KEYS.supplierCatalog,
    CACHE_KEYS.productCatalog,
    CACHE_KEYS.inventorySuggestions,
  ],
  updateOrder: [
    CACHE_KEYS.orderHistory,
    CACHE_KEYS.inventory,
    CACHE_KEYS.debtCustomers,
    CACHE_KEYS.productCatalog,
    CACHE_KEYS.inventorySuggestions,
    CACHE_KEYS.customerCatalog,
  ],
  deleteOrder: [
    CACHE_KEYS.orderHistory,
    CACHE_KEYS.inventory,
    CACHE_KEYS.debtCustomers,
    CACHE_KEYS.customerCatalog,
  ],
  updateSupplierDebt: [CACHE_KEYS.supplierDebts, CACHE_KEYS.supplierCatalog],
});

export function getInvalidationKeysForMutation(mutationName) {
  const key = String(mutationName || "").trim();
  const keys = INVALIDATION_KEYS[key];
  return Array.isArray(keys) ? [...keys] : [];
}
const BG_SPARSE_15M = {
  backgroundMode: "stale-only",
  refreshAfterMs: 15 * 60 * 1000,
  refreshCooldownMs: 15 * 60 * 1000,
};
const BG_SPARSE_30M = {
  backgroundMode: "stale-only",
  refreshAfterMs: 30 * 60 * 1000,
  refreshCooldownMs: 30 * 60 * 1000,
};
const BG_SPARSE_60M = {
  backgroundMode: "stale-only",
  refreshAfterMs: 60 * 60 * 1000,
  refreshCooldownMs: 60 * 60 * 1000,
};

const withRealtimeSignal = (fn, mutationName) => {
  return async (...args) => {
    const result = await fn(...args);
    if (result?.success) {
      publishRealtimeMutationSignal({ mutation: mutationName }).catch(() => {
        // Silent publish failure so mutation UX stays smooth.
      });
    }
    return result;
  };
};

setMutationSuccessHook(({ mutationName }) => {
  return publishRealtimeMutationSignal({ mutation: mutationName });
});

export const call = adapter.call;
export const helloServer = adapter.helloServer;
export const login = adapter.login;
export const loginWithDeviceToken = (deviceToken, appScope = "") =>
  typeof adapter.loginWithDeviceToken === "function"
    ? adapter.loginWithDeviceToken(deviceToken, appScope)
    : Promise.resolve({ success: false, message: "not_supported" });
export const revokeDeviceToken = (deviceToken, appScope = "") =>
  typeof adapter.revokeDeviceToken === "function"
    ? adapter.revokeDeviceToken(deviceToken, appScope)
    : Promise.resolve({ success: true });
export const getUserInfo = adapter.getUserInfo;
export const getDemoAccounts = adapter.getDemoAccounts;
export const getGlobalNotice = adapter.getGlobalNotice;
export const getSyncVersion =
  adapter.getSyncVersion ||
  (async () => ({ success: true, data: { version: "1" } }));
export const getNextOrderFormDefaults = adapter.getNextOrderFormDefaults;
export const getNextInventoryReceiptDefaults =
  adapter.getNextInventoryReceiptDefaults;
export const getProductCatalog = createLocalFirstReader(
  CACHE_KEYS.productCatalog,
  adapter.getProductCatalog,
  BG_SPARSE_30M,
);
export const getBankConfig = createLocalFirstReader(
  CACHE_KEYS.bankConfig,
  adapter.getBankConfig,
  BG_SPARSE_60M,
);
export const updateBankConfig = createMutationWithInvalidation(
  adapter.updateBankConfig,
  [CACHE_KEYS.bankConfig],
);
export const updateProductCatalogItem = createMutationWithInvalidation(
  adapter.updateProductCatalogItem,
  [
    CACHE_KEYS.productCatalog,
    CACHE_KEYS.inventory,
    CACHE_KEYS.inventorySuggestions,
  ],
);
export const createProductCatalogItem = createMutationWithInvalidation(
  adapter.createProductCatalogItem,
  [
    CACHE_KEYS.productCatalog,
    CACHE_KEYS.inventory,
    CACHE_KEYS.inventorySuggestions,
  ],
);
export const deleteProductCatalogItem = createMutationWithInvalidation(
  adapter.deleteProductCatalogItem,
  [
    CACHE_KEYS.productCatalog,
    CACHE_KEYS.inventory,
    CACHE_KEYS.inventorySuggestions,
  ],
);
export const getCustomerCatalog = createLocalFirstReader(
  CACHE_KEYS.customerCatalog,
  adapter.getCustomerCatalog,
  BG_SPARSE_30M,
);
export const getSupplierCatalog = createLocalFirstReader(
  CACHE_KEYS.supplierCatalog,
  adapter.getSupplierCatalog,
  BG_SPARSE_30M,
);
export const getDebtCustomers = createLocalFirstReader(
  CACHE_KEYS.debtCustomers,
  adapter.getDebtCustomers,
  BG_SPARSE_15M,
);
export const updateDebtCustomer = createMutationWithInvalidation(
  adapter.updateDebtCustomer,
  [
    CACHE_KEYS.debtCustomers,
    CACHE_KEYS.orderHistory,
    CACHE_KEYS.customerCatalog,
  ],
);
export const settleAllDebtCustomers = createMutationWithInvalidation(
  adapter.settleAllDebtCustomers,
  [CACHE_KEYS.debtCustomers, CACHE_KEYS.orderHistory],
);
export const getOrderHistory = createLocalFirstReader(
  CACHE_KEYS.orderHistory,
  adapter.getOrderHistory,
  BG_SPARSE_15M,
);
export const createReceiptPdf = adapter.createReceiptPdf;
export const createOrder = createMutationWithInvalidation(adapter.createOrder, [
  CACHE_KEYS.orderHistory,
  CACHE_KEYS.inventory,
  CACHE_KEYS.debtCustomers,
  CACHE_KEYS.productCatalog,
  CACHE_KEYS.inventorySuggestions,
  CACHE_KEYS.customerCatalog,
]);
export const createInventoryReceipt = createMutationWithInvalidation(
  adapter.createInventoryReceipt,
  [
    CACHE_KEYS.inventory,
    CACHE_KEYS.receiptHistory,
    CACHE_KEYS.supplierDebts,
    CACHE_KEYS.supplierCatalog,
    CACHE_KEYS.productCatalog,
    CACHE_KEYS.inventorySuggestions,
  ],
);
export const getInventorySuggestions = createLocalFirstReader(
  CACHE_KEYS.inventorySuggestions,
  adapter.getInventorySuggestions,
  BG_SPARSE_30M,
);
export const updateOrder = createMutationWithInvalidation(adapter.updateOrder, [
  CACHE_KEYS.orderHistory,
  CACHE_KEYS.inventory,
  CACHE_KEYS.debtCustomers,
  CACHE_KEYS.productCatalog,
  CACHE_KEYS.inventorySuggestions,
  CACHE_KEYS.customerCatalog,
]);
export const deleteOrder = createMutationWithInvalidation(adapter.deleteOrder, [
  CACHE_KEYS.orderHistory,
  CACHE_KEYS.inventory,
  CACHE_KEYS.debtCustomers,
  CACHE_KEYS.customerCatalog,
]);
export const getInventory = createLocalFirstReader(
  CACHE_KEYS.inventory,
  adapter.getInventory,
  BG_SPARSE_15M,
);
export const getReceiptHistory = createLocalFirstReader(
  CACHE_KEYS.receiptHistory,
  adapter.getReceiptHistory,
  BG_SPARSE_15M,
);
export const getAppSetting = adapter.getAppSetting;
export const setAppSetting = withRealtimeSignal(
  adapter.setAppSetting,
  "setAppSetting",
);
export const getSupplierDebts = createLocalFirstReader(
  CACHE_KEYS.supplierDebts,
  adapter.getSupplierDebts,
  BG_SPARSE_15M,
);
export const updateSupplierDebt = createMutationWithInvalidation(
  adapter.updateSupplierDebt,
  [CACHE_KEYS.supplierDebts, CACHE_KEYS.supplierCatalog],
);
export const formatAllSheets = adapter.formatAllSheets;
export const uploadImageToImgBB = adapter.uploadImageToImgBB;
export const issueEasyInvoice = withRealtimeSignal(
  adapter.issueEasyInvoice,
  "issueEasyInvoice",
);
export const cancelEasyInvoice = withRealtimeSignal(
  adapter.cancelEasyInvoice,
  "cancelEasyInvoice",
);
export const replaceEasyInvoice = withRealtimeSignal(
  adapter.replaceEasyInvoice,
  "replaceEasyInvoice",
);
export const downloadInvoicePDF = adapter.downloadInvoicePDF;
export const logAction = adapter.logAction;
export const clearAllReadCache = () => {
  clearCacheByKeys(READ_KEYS);
};
export const clearReadCacheByKeys = (keys = []) => {
  clearCacheByKeys(keys);
};
