import { localAdapter } from "./adapters/localAdapter.js";
import { gasAdapter } from "./adapters/gasAdapter.js";

const adapter = import.meta.env.DEV ? localAdapter : gasAdapter;

export const api = adapter;

export const call = adapter.call;
export const helloServer = adapter.helloServer;
export const login = adapter.login;
export const getUserInfo = adapter.getUserInfo;
export const getDemoAccounts = adapter.getDemoAccounts;
export const getGlobalNotice = adapter.getGlobalNotice;
export const getNextOrderFormDefaults = adapter.getNextOrderFormDefaults;
export const getProductCatalog = adapter.getProductCatalog;
export const updateProductCatalogItem = adapter.updateProductCatalogItem;
export const createProductCatalogItem = adapter.createProductCatalogItem;
export const deleteProductCatalogItem = adapter.deleteProductCatalogItem;
export const getCustomerCatalog = adapter.getCustomerCatalog;
export const getDebtCustomers = adapter.getDebtCustomers;
export const updateDebtCustomer = adapter.updateDebtCustomer;
export const settleAllDebtCustomers = adapter.settleAllDebtCustomers;
export const getOrderHistory = adapter.getOrderHistory;
export const createOrder = adapter.createOrder;
export const updateOrder = adapter.updateOrder;
export const deleteOrder = adapter.deleteOrder;


