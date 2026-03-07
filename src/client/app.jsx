import LoginPage from "./pages/login"
import DashboardPage from "./pages/dashboard"
import CreateOrderPage from "./pages/create-order"
import HelloCard from "./components/HelloCard"
import GlobalNoticeBanner from "./components/GlobalNoticeBanner"
import { UserProvider, useUser } from "./context"

function AppRoutes() {
  const { user, setUser, logout } = useUser()

  if (!user) {
    return <LoginPage onLoginSuccess={setUser} />
  }

  if (["dev"].includes(user.role)) {
    return <DashboardPage user={user} onLogout={logout} />
  }
  if (["admin", "user"].includes(user.role)) {
    return <CreateOrderPage user={user} onLogout={logout} />
  }
  return <div>Không có quyền truy cập</div>
}

export default function App() {
  return (
    <UserProvider>
      <GlobalNoticeBanner />
      <AppRoutes />
    </UserProvider>
  )
}