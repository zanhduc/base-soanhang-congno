import { useState, useEffect } from "react"
import { useUser } from "../context"

export default function FloatingMenu({ currentPath, onNavigate }) {
  const { user, logout } = useUser()
  const [isOpen, setIsOpen] = useState(false)
  const [isVisible, setIsVisible] = useState(true)
  const [lastScrollY, setLastScrollY] = useState(0)

  if (!user) return null

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY

      if (currentScrollY < 50) {
        setIsVisible(true)
      } else {
        if (currentScrollY > lastScrollY) {
          setIsVisible(false)
          setIsOpen(false)
        } else {
          setIsVisible(true)
        }
      }

      setLastScrollY(currentScrollY)
    }

    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [lastScrollY])

  useEffect(() => {
    if (!isOpen) return
    const close = (e) => {
      if (!e.target.closest("#mega-menu-container")) setIsOpen(false)
    }
    window.addEventListener("click", close)
    return () => window.removeEventListener("click", close)
  }, [isOpen])

  const menuItems = [
    { id: "create-order", label: "Soạn đơn", icon: "🧾" },
    { id: "history", label: "Lịch sử hóa đơn", icon: "🕘" },
    { id: "debt", label: "Quản lý công nợ", icon: "📒" },
  ]

  const handleNav = (id) => {
    setIsOpen(false)
    onNavigate(id)
  }

  return (
    <div id="mega-menu-container" className="fixed top-4 right-4 z-[9000] flex flex-col items-end">
      <button
        onClick={(e) => {
          e.stopPropagation()
          setIsOpen(!isOpen)
        }}
        className={`w-12 h-12 rounded-full flex items-center justify-center bg-white shadow-[0_4px_20px_rgba(0,0,0,0.12)] border border-slate-100 transition-all duration-300 ${
          isVisible ? "translate-y-0 opacity-100 scale-100" : "-translate-y-16 opacity-0 scale-90 pointer-events-none"
        } ${isOpen ? "ring-4 ring-rose-500/20" : "hover:scale-105"}`}
      >
        <div className="relative w-5 h-4">
          <span className={`absolute left-0 w-full h-0.5 bg-slate-700 rounded-full transition-all duration-300 ${isOpen ? "top-1.5 rotate-45" : "top-0"}`} />
          <span className={`absolute left-0 w-full h-0.5 bg-slate-700 rounded-full transition-all duration-300 ${isOpen ? "opacity-0" : "top-1.5 opacity-100"}`} />
          <span className={`absolute left-0 w-full h-0.5 bg-slate-700 rounded-full transition-all duration-300 ${isOpen ? "top-1.5 -rotate-45" : "top-3"}`} />
        </div>
      </button>

      <div
        className={`absolute top-14 right-0 w-64 bg-white/95 backdrop-blur-xl rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] border border-white/20 overflow-hidden transition-all duration-300 origin-top-left ${
          isOpen ? "scale-100 opacity-100 translate-y-0" : "scale-90 opacity-0 -translate-y-2 pointer-events-none"
        }`}
      >
        <div className="p-4 border-b border-slate-100">
          <p className="font-bold text-slate-800 truncate">{user.name || "Tài khoản của bạn"}</p>
          <p className="text-xs text-slate-500 truncate">{user.email || user.username}</p>
          <span className="inline-block px-2 py-0.5 mt-2 text-[10px] font-bold text-rose-800 bg-rose-100 rounded-full uppercase tracking-wider">{user.role}</span>
        </div>

        <div className="p-2 max-h-[60vh] overflow-y-auto">
          {menuItems.map((item) => {
            const isActive = currentPath === item.id
            return (
              <button
                key={item.id}
                onClick={() => handleNav(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all ${
                  isActive
                    ? "bg-rose-50 text-rose-800 font-bold"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium"
                }`}
              >
                <span className={`text-xl ${isActive ? "drop-shadow-sm" : "grayscale opacity-70"}`}>{item.icon}</span>
                <span className="text-sm">{item.label}</span>
                {isActive && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-rose-700" />}
              </button>
            )
          })}
        </div>

        <div className="p-2 border-t border-slate-100 bg-slate-50/50">
          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-red-600 font-semibold hover:bg-red-50 transition-colors text-sm"
          >
            Đăng xuất
          </button>
        </div>
      </div>
    </div>
  )
}
