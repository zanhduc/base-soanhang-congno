const CACHE_PREFIX = "soanhang_api_cache_v1:";
const AUTH_USER_STORAGE_KEY = "soanhang.auth.user";
const inflightRefresh = new Map();

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function nowMs() {
  return Date.now();
}

function buildStorageKey(cacheKey) {
  return `${CACHE_PREFIX}${readUserScope()}:${cacheKey}`;
}

function readUserScope() {
  if (!canUseStorage()) return "guest";
  try {
    const raw = window.localStorage.getItem(AUTH_USER_STORAGE_KEY);
    if (!raw) return "guest";
    const parsed = JSON.parse(raw);
    const email = String(parsed?.user?.email || "").trim().toLowerCase();
    return email || "guest";
  } catch (_) {
    return "guest";
  }
}

function safeParse(raw) {
  try {
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
}

export function readCache(cacheKey) {
  if (!canUseStorage()) return null;
  const raw = window.localStorage.getItem(buildStorageKey(cacheKey));
  if (!raw) return null;
  const parsed = safeParse(raw);
  if (!parsed || typeof parsed !== "object") return null;
  if (!Object.prototype.hasOwnProperty.call(parsed, "response")) return null;
  return parsed;
}

export function writeCache(cacheKey, response) {
  if (!canUseStorage()) return;
  const payload = {
    response,
    updatedAt: nowMs(),
  };
  try {
    window.localStorage.setItem(buildStorageKey(cacheKey), JSON.stringify(payload));
  } catch (_) {
    // Ignore storage quota/write issues to keep business flow stable.
  }
}

export function clearCacheByKeys(cacheKeys = []) {
  if (!canUseStorage()) return;
  cacheKeys.forEach((cacheKey) => {
    try {
      window.localStorage.removeItem(buildStorageKey(cacheKey));
    } catch (_) {
      // Ignore remove failures.
    }
  });
}

function isSuccessResponse(response) {
  return Boolean(response?.success);
}

function isSameResponse(a, b) {
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch (_) {
    return false;
  }
}

function dispatchCacheUpdated(cacheKey, response) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("soanhang_api_cache_updated", {
      detail: {
        cacheKey,
        response,
      },
    }),
  );
}

function refreshInBackground(cacheKey, fn, args) {
  if (inflightRefresh.has(cacheKey)) return;
  const runner = (async () => {
    try {
      const fresh = await fn(...args);
      if (!isSuccessResponse(fresh)) return;
      const cached = readCache(cacheKey)?.response;
      if (!isSameResponse(cached, fresh)) {
        writeCache(cacheKey, fresh);
        dispatchCacheUpdated(cacheKey, fresh);
      }
    } catch (_) {
      // Silent background refresh failure.
    }
  })();
  inflightRefresh.set(cacheKey, runner);
  runner.finally(() => {
    inflightRefresh.delete(cacheKey);
  });
}

export function createLocalFirstReader(cacheKey, fn) {
  return async (...args) => {
    const cached = readCache(cacheKey);
    if (cached && cached.response) {
      refreshInBackground(cacheKey, fn, args);
      return cached.response;
    }
    const fresh = await fn(...args);
    if (isSuccessResponse(fresh)) {
      writeCache(cacheKey, fresh);
    }
    return fresh;
  };
}

export function createMutationWithInvalidation(fn, invalidateKeys = []) {
  return async (...args) => {
    const result = await fn(...args);
    if (isSuccessResponse(result)) {
      clearCacheByKeys(invalidateKeys);
    }
    return result;
  };
}
