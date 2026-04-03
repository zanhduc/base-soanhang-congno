import { useState } from "react";
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
  const [currentPath, setCurrentPath] = useState("create-order");
  const searchParams = new URLSearchParams(window.location.search);
  const isPrintView = searchParams.has("print");
  const printCode = searchParams.get("print");
  const printSize = searchParams.get("size");

  if (!user) {
    return <LoginPage onLoginSuccess={setUser} />;
  }

  if (isPrintView) {
    return <ReceiptPage code={printCode} size={printSize} />;
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
        <FloatingMenu currentPath={currentPath} onNavigate={setCurrentPath} />
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
