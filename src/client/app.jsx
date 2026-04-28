import { useState, useEffect, useCallback, useRef } from "react";
import { useHashRouter } from "./hooks/useHashRouter";
import LoginPage from "./pages/login";
import CreateOrderPage from "./pages/create-order";
import HistoryPage from "./pages/history";
import ReceiptPage from "./pages/receipt";
import ProductsPage from "./pages/products";
import InventoryPage from "./pages/inventory";
import StockPage from "./pages/stock";
import DebtPage from "./pages/debt";
import StatsPage from "./pages/stats";
import PrintDiagnosticPage from "./pages/print-diagnostic";
import FloatingMenu from "./components/FloatingMenu";
import GlobalNoticeBanner from "./components/GlobalNoticeBanner";
import { UserProvider, useUser } from "./context";
import { Toaster } from "react-hot-toast";
import { ensurePrintBridgeReady } from "./utils/printStrategy";
import {
  applyAppModeToDom,
  readAppMode,
  writeAppMode,
} from "./utils/appMode";
import { clearAllReadCache, getSyncVersion } from "./api";
import {
  isRealtimeSyncEnabled,
  startRealtimeSyncListener,
} from "./realtime/firebaseSync";

const REMOTE_SYNC_POLL_MS = 15000;

const toBool = (value) => {
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized === "1" || normalized === "true";
};

const getHashSearchParams = (hashValue) => {
  const hash = String(hashValue || "").replace(/^#\/?/, "").trim();
  if (!hash) return new URLSearchParams();
  const queryIndex = hash.indexOf("?");
  if (queryIndex >= 0) {
    return new URLSearchParams(hash.slice(queryIndex + 1));
  }
  return new URLSearchParams(hash);
};

const buildPrintParams = (source) => {
  const code = String(source?.code || "").trim();
  if (!code) return null;
  return {
    code,
    size: source?.size || "",
    isPreview: !!source?.isPreview,
    previewDataStr: source?.previewDataStr || "",
    previewDataKey: source?.previewDataKey || "",
    autoPrint: !!source?.autoPrint,
    autoBack: !!source?.autoBack,
    dryRun: !!source?.dryRun,
  };
};

const getPrintParamsFromLocalUrl = () => {
  const hashParams = getHashSearchParams(window.location.hash);
  const searchParams = new URLSearchParams(window.location.search);
  return buildPrintParams({
    code: hashParams.get("print") || searchParams.get("print"),
    size: hashParams.get("size") || searchParams.get("size"),
    isPreview:
      hashParams.has("preview") ||
      searchParams.has("preview") ||
      toBool(searchParams.get("preview")) ||
      toBool(hashParams.get("preview")),
    previewDataStr: hashParams.get("data") || searchParams.get("data") || "",
    previewDataKey:
      hashParams.get("datakey") || searchParams.get("datakey") || "",
    autoPrint:
      toBool(hashParams.get("autoprint")) ||
      toBool(searchParams.get("autoprint")),
    autoBack:
      toBool(hashParams.get("autoback")) || toBool(searchParams.get("autoback")),
    dryRun: toBool(hashParams.get("dryrun")) || toBool(searchParams.get("dryrun")),
  });
};

const getPrintParamsFromGasLocation = (location) => {
  const hashParams = getHashSearchParams(location?.hash || "");
  return buildPrintParams({
    code: hashParams.get("print") || location?.parameter?.print,
    size: hashParams.get("size") || location?.parameter?.size,
    isPreview:
      hashParams.has("preview") ||
      toBool(hashParams.get("preview")) ||
      toBool(location?.parameter?.preview),
    previewDataStr: hashParams.get("data") || location?.parameter?.data || "",
    previewDataKey:
      hashParams.get("datakey") || location?.parameter?.datakey || "",
    autoPrint:
      toBool(hashParams.get("autoprint")) ||
      toBool(location?.parameter?.autoprint),
    autoBack:
      toBool(hashParams.get("autoback")) ||
      toBool(location?.parameter?.autoback),
    dryRun:
      toBool(hashParams.get("dryrun")) || toBool(location?.parameter?.dryrun),
  });
};

function AppContent() {
  const { user, setUser } = useUser();
  const { currentPath, navigate } = useHashRouter();
  const [initDone, setInitDone] = useState(false);
  const [printParams, setPrintParams] = useState(null);
  const [appMode, setAppModeState] = useState(() => readAppMode());
  const [syncNonce, setSyncNonce] = useState(0);
  const [realtimeActive, setRealtimeActive] = useState(false);
  const [isPageVisible, setIsPageVisible] = useState(() => {
    if (typeof document === "undefined") return true;
    return document.visibilityState === "visible";
  });
  const lastSyncVersionRef = useRef("");
  const isPosMode = appMode === "pos";

  const setAppMode = useCallback((nextMode) => {
    const next = writeAppMode(nextMode);
    setAppModeState(next);
  }, []);

  useEffect(() => {
    applyAppModeToDom(appMode);
  }, [appMode]);

  useEffect(() => {
    const syncModeFromLocation = () => {
      const next = readAppMode();
      setAppModeState(next);
    };
    window.addEventListener("hashchange", syncModeFromLocation);
    window.addEventListener("popstate", syncModeFromLocation);
    return () => {
      window.removeEventListener("hashchange", syncModeFromLocation);
      window.removeEventListener("popstate", syncModeFromLocation);
    };
  }, []);

  useEffect(() => {
    const onVisibilityChange = () => {
      setIsPageVisible(document.visibilityState === "visible");
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    let didInit = false;

    const finishInit = () => {
      if (!didInit && mounted) {
        didInit = true;
        setInitDone(true);
      }
    };

    const applyLocalParams = () => {
      const localPrintParams = getPrintParamsFromLocalUrl();
      if (mounted) setPrintParams(localPrintParams);
      return localPrintParams;
    };

    const resolvePrintParams = ({ init = false } = {}) => {
      const localParams = applyLocalParams();
      if (localParams) {
        if (init) finishInit();
        return;
      }

      if (typeof google !== "undefined" && google?.script?.url?.getLocation) {
        google.script.url.getLocation((location) => {
          if (!mounted) return;
          const gasParams = getPrintParamsFromGasLocation(location);
          setPrintParams(gasParams);
          if (init) finishInit();
        });
        return;
      }

      if (mounted) setPrintParams(null);
      if (init) finishInit();
    };

    resolvePrintParams({ init: true });

    const onHashChanged = () => resolvePrintParams({ init: false });
    window.addEventListener("hashchange", onHashChanged);
    window.addEventListener("popstate", onHashChanged);

    return () => {
      mounted = false;
      window.removeEventListener("hashchange", onHashChanged);
      window.removeEventListener("popstate", onHashChanged);
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    ensurePrintBridgeReady().catch(() => {
      // Keep app usable; printing flow will show explicit error when user prints.
    });
  }, [user]);

  useEffect(() => {
    if (!user || !isPosMode) return;
    if (!("wakeLock" in navigator) || !window.isSecureContext) return;
    let released = false;
    let wakeLock = null;

    const requestWakeLock = async () => {
      if (released) return;
      try {
        wakeLock = await navigator.wakeLock.request("screen");
        wakeLock.addEventListener("release", () => {
          wakeLock = null;
        });
      } catch (e) {
        // Ignore unsupported/blocked wake lock.
      }
    };

    requestWakeLock();
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible" && !wakeLock) {
        requestWakeLock();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      released = true;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (wakeLock) {
        wakeLock.release().catch(() => {});
      }
    };
  }, [user, isPosMode]);

  useEffect(() => {
    if (!user) {
      lastSyncVersionRef.current = "";
      setRealtimeActive(false);
      return;
    }

    if (realtimeActive) return;

    let disposed = false;

    const pollVersion = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await getSyncVersion();
        if (disposed || !res?.success) return;
        const nextVersion = String(res?.data?.version || "").trim();
        if (!nextVersion) return;

        const prevVersion = lastSyncVersionRef.current;
        if (!prevVersion) {
          lastSyncVersionRef.current = nextVersion;
          return;
        }

        if (nextVersion !== prevVersion) {
          lastSyncVersionRef.current = nextVersion;
          clearAllReadCache();
          setSyncNonce((v) => v + 1);
        }
      } catch (_) {
        // Keep polling silent to avoid interrupting user flow.
      }
    };

    pollVersion();
    const timer = window.setInterval(pollVersion, REMOTE_SYNC_POLL_MS);
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        pollVersion();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      disposed = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [user, realtimeActive]);

  useEffect(() => {
    if (!user) {
      setRealtimeActive(false);
      return;
    }
    if (!isPageVisible) {
      setRealtimeActive(false);
      return;
    }
    if (!isRealtimeSyncEnabled()) {
      setRealtimeActive(false);
      return;
    }

    const stopListening = startRealtimeSyncListener({
      onReady: () => {
        setRealtimeActive(true);
      },
      onError: () => {
        setRealtimeActive(false);
      },
      onRemoteSignal: () => {
        clearAllReadCache();
        setSyncNonce((v) => v + 1);
      },
    });

    return () => {
      if (typeof stopListening === "function") {
        stopListening();
      }
    };
  }, [user, isPageVisible]);

  if (!initDone) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center">
          <div className="w-8 h-8 rounded-full border-4 border-slate-200 border-b-rose-600 animate-spin"></div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <LoginPage
        onLoginSuccess={setUser}
        appMode={appMode}
        onChangeAppMode={setAppMode}
      />
    );
  }

  if (printParams) {
    return (
      <ReceiptPage
        code={printParams.code}
        size={printParams.size}
        isPreview={printParams.isPreview}
        previewDataStr={printParams.previewDataStr}
        previewDataKey={printParams.previewDataKey}
        autoPrint={printParams.autoPrint}
        autoBack={printParams.autoBack}
        dryRun={printParams.dryRun}
      />
    );
  }

  if (["admin", "user"].includes(user.role)) {
    const renderPage = () => {
      switch (currentPath) {
        case "create-order":
          return <CreateOrderPage user={user} appMode={appMode} />;
        case "history":
          return <HistoryPage user={user} appMode={appMode} />;
        case "products":
          return <ProductsPage user={user} appMode={appMode} />;
        case "inventory":
          return <InventoryPage user={user} appMode={appMode} />;
        case "stock":
          return <StockPage user={user} appMode={appMode} />;
        case "debt":
          return <DebtPage user={user} appMode={appMode} />;
        case "stats":
          return <StatsPage user={user} appMode={appMode} />;
        case "print-diagnostic":
          return <PrintDiagnosticPage appMode={appMode} />;
        default:
          return <CreateOrderPage user={user} appMode={appMode} />;
      }
    };

    return (
      <div className={`min-h-screen ${isPosMode ? "bg-slate-100 pb-24" : "bg-slate-50"}`}>
        <GlobalNoticeBanner />
        <div key={`${currentPath}:${syncNonce}`} className={isPosMode ? "" : "md:pl-72"}>
          {renderPage()}
        </div>
        <FloatingMenu
          currentPath={currentPath}
          onNavigate={navigate}
          appMode={appMode}
          onChangeAppMode={setAppMode}
        />
      </div>
    );
  }

  return (
    <div className="p-8 text-center text-red-500">Không có quyền truy cập</div>
  );
}

export default function App() {
  return (
    <UserProvider>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 2500,
          style: {
            borderRadius: "12px",
            border: "1px solid #f1f5f9",
            background: "#ffffff",
            color: "#0f172a",
          },
        }}
      />
      <AppContent />
    </UserProvider>
  );
}
