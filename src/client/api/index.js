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
