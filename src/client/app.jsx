import { useState } from "react"
import LoginPage from "./pages/login"
import DashboardPage from "./pages/dashboard"
import CreateOrderPage from "./pages/create-order"
import FloatingMenu from "./components/FloatingMenu"
import GlobalNoticeBanner from "./components/GlobalNoticeBanner"
import { UserProvider, useUser } from "./context"

function AppContent() {
  const { user, setUser, logout } = useUser()
  const [currentPath, setCurrentPath] = useState("create-order")

  if (!user) {
    return <LoginPage onLoginSuccess={setUser} />
  }

  if (["dev"].includes(user.role)) {
    return <DashboardPage user={user} onLogout={logout} />
  }

  if (["admin", "user"].includes(user.role)) {
    const renderPage = () => {
      switch (currentPath) {
        case "create-order":
          return <CreateOrderPage user={user} />
        case "history":
          return <div className="p-8 text-center text-slate-500 mt-20">Lịch sử đơn hàng (Sắp có)</div>
        case "debt":
          return <div className="p-8 text-center text-slate-500 mt-20">Công nợ khách hàng (Sắp có)</div>
        case "dashboard":
          return (
            <div className="p-8 text-center mt-20">
              <h2 className="text-xl font-bold mb-4">Tài khoản</h2>
              <p className="text-slate-500 mb-6">Xin chào, {user.name || user.email}</p>
              <button
                onClick={logout}
                className="px-6 py-2 bg-red-100 text-red-600 rounded-xl font-semibold hover:bg-red-200"
              >
                Đăng xuất
              </button>
            </div>
          )
        default:
          return <CreateOrderPage user={user} />
      }
    }

    return (
      <div className="min-h-screen bg-slate-50">
        <GlobalNoticeBanner />
        <div>{renderPage()}</div>
        <FloatingMenu currentPath={currentPath} onNavigate={setCurrentPath} />
      </div>
    )
  }

  return <div className="p-8 text-center text-red-500">Không có quyền truy cập</div>
}

export default function App() {
  return (
    <UserProvider>
      <AppContent />
    </UserProvider>
  )
}
