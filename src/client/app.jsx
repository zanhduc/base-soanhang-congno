import { useState, useEffect } from "react";
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
import FloatingMenu from "./components/FloatingMenu";
import GlobalNoticeBanner from "./components/GlobalNoticeBanner";
import { UserProvider, useUser } from "./context";
import { Toaster } from "react-hot-toast";

function AppContent() {
  const { user, setUser, logout } = useUser();
  const { currentPath, navigate } = useHashRouter();
  const [initDone, setInitDone] = useState(false);
  const [printParams, setPrintParams] = useState(null);

  useEffect(() => {
    // 1. Lọc `print` từ dev mode (trình duyệt thông thường)
    const localHashStr = window.location.hash.replace(/^#\/?/, "");
    const localHashParams = new URLSearchParams(localHashStr);
    const localSearch = new URLSearchParams(window.location.search);
    
    let pendingCode = localHashParams.get("print") || localSearch.get("print");
    let pendingSize = localHashParams.get("size") || localSearch.get("size");
    let pendingPreview = localHashParams.has("preview") || localSearch.has("preview");

    // 2. Chờ API của GAS để lấy thông số bị chặn bởi iframe (Bắt buộc cho Production)
    if (typeof google !== "undefined" && google?.script?.url) {
      google.script.url.getLocation(function (location) {
        // Phân tích cả hash lẫn parameter của parent window
        const gasHashParams = new URLSearchParams((location?.hash || "").replace(/^#\/?/, ""));
        const gasCode = gasHashParams.get("print") || location?.parameter?.print;
        const gasSize = gasHashParams.get("size") || location?.parameter?.size;
        const gasPreview = gasHashParams.has("preview") || location?.parameter?.preview === "true";
        const gasData = gasHashParams.get("data") || location?.parameter?.data;
        
        if (gasCode) {
          pendingCode = gasCode;
          pendingSize = gasSize;
          pendingPreview = gasPreview;
          localHashParams.set("data", gasData); // just to reuse scoping logic
        }
        
        if (pendingCode) {
           setPrintParams({ 
             code: pendingCode, 
             size: pendingSize, 
             isPreview: pendingPreview, 
             previewDataStr: localHashParams.get("data") 
           });
        }
        setInitDone(true);
      });
    } else {
      // DEV (không có google API)
      if (pendingCode) {
         setPrintParams({ 
           code: pendingCode, 
           size: pendingSize, 
           isPreview: pendingPreview, 
           previewDataStr: localHashParams.get("data") 
         });
      }
      setInitDone(true);
    }
  }, []);

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
    return <LoginPage onLoginSuccess={setUser} />;
  }

  if (printParams) {
    return <ReceiptPage 
      code={printParams.code} 
      size={printParams.size} 
      isPreview={printParams.isPreview} 
      previewDataStr={printParams.previewDataStr} 
    />;
  }

  if (["admin", "user"].includes(user.role)) {
    const renderPage = () => {
      switch (currentPath) {
        case "create-order":
          return <CreateOrderPage user={user} />;
        case "history":
          return <HistoryPage user={user} />;
        case "products":
          return <ProductsPage user={user} />;
        case "inventory":
          return <InventoryPage user={user} />;
        case "stock":
          return <StockPage user={user} />;
        case "debt":
          return <DebtPage user={user} />;
        case "stats":
          return <StatsPage user={user} />;
        default:
          return <CreateOrderPage user={user} />;
      }
    };

    return (
      <div className="min-h-screen bg-slate-50">
        <GlobalNoticeBanner />
        <div className="md:pl-72">{renderPage()}</div>
        <FloatingMenu currentPath={currentPath} onNavigate={navigate} />
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
