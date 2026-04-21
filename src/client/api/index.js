import { localAdapter } from "./adapters/localAdapter.js";
import { gasAdapter } from "./adapters/gasAdapter.js";
import {
  createLocalFirstReader,
  createMutationWithInvalidation,
  clearCacheByKeys,
} from "./localCache.js";

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

export const call = adapter.call;
export const helloServer = adapter.helloServer;
export const login = adapter.login;
export const getUserInfo = adapter.getUserInfo;
export const getDemoAccounts = adapter.getDemoAccounts;
export const getGlobalNotice = adapter.getGlobalNotice;
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
export const updateProductCatalogItem = createMutationWithInvalidation(
  adapter.updateProductCatalogItem,
  [CACHE_KEYS.productCatalog, CACHE_KEYS.inventory],
);
export const createProductCatalogItem = createMutationWithInvalidation(
  adapter.createProductCatalogItem,
  [CACHE_KEYS.productCatalog, CACHE_KEYS.inventory],
);
export const deleteProductCatalogItem = createMutationWithInvalidation(
  adapter.deleteProductCatalogItem,
  [CACHE_KEYS.productCatalog, CACHE_KEYS.inventory],
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
  [CACHE_KEYS.debtCustomers, CACHE_KEYS.orderHistory],
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
]);
export const createInventoryReceipt = createMutationWithInvalidation(
  adapter.createInventoryReceipt,
  [CACHE_KEYS.inventory, CACHE_KEYS.receiptHistory, CACHE_KEYS.supplierDebts],
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
]);
export const deleteOrder = createMutationWithInvalidation(adapter.deleteOrder, [
  CACHE_KEYS.orderHistory,
  CACHE_KEYS.inventory,
  CACHE_KEYS.debtCustomers,
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
export const setAppSetting = adapter.setAppSetting;
export const getSupplierDebts = createLocalFirstReader(
  CACHE_KEYS.supplierDebts,
  adapter.getSupplierDebts,
  BG_SPARSE_15M,
);
export const updateSupplierDebt = createMutationWithInvalidation(
  adapter.updateSupplierDebt,
  [CACHE_KEYS.supplierDebts],
);
export const formatAllSheets = adapter.formatAllSheets;
export const uploadImageToImgBB = adapter.uploadImageToImgBB;
export const issueEasyInvoice = adapter.issueEasyInvoice;
export const cancelEasyInvoice = adapter.cancelEasyInvoice;
export const replaceEasyInvoice = adapter.replaceEasyInvoice;
export const downloadInvoicePDF = adapter.downloadInvoicePDF;
export const logAction = adapter.logAction;
export const clearAllReadCache = () => {
  clearCacheByKeys(READ_KEYS);
};
