import { useState, useEffect } from "react"
import { login, call } from "../api/index.js"

export default function LoginPage({ onLoginSuccess }) {
  const [email, setEmail]       = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState("")
  const [showPass, setShowPass] = useState(false)
  
  // Dynamic demo accounts
  const [demoAccounts, setDemoAccounts] = useState([])

  useEffect(() => {
    call("getDemoAccounts").then(res => {
      if (res?.success && Array.isArray(res.data)) {
        setDemoAccounts(res.data)
      }
    }).catch(console.error)
  }, [])

  const handleLogin = async (e) => {
    e.preventDefault()
    if (!email || !password) { setError("Vui lòng điền đầy đủ thông tin"); return }
    setError("")
    setLoading(true)
    try {
      const res = await login(email, password)
      if (res.success) onLoginSuccess(res.data)
      else setError(res.message)
    } catch (err) {
      setError("Có lỗi xảy ra: " + (err?.message || String(err)))
    } finally {
      setLoading(false)
    }
  }

  const fillDemo = (acc) => {
    setEmail(acc.email)
    setPassword(acc.password)
    setError("")
  }

  return (
    <div className="min-h-screen flex items-start md:items-center justify-center p-4 md:p-6 pb-20 bg-slate-100 font-sans text-slate-800">

      <div className="w-full max-w-md rounded-2xl px-9 py-10 bg-white border border-slate-200 shadow-xl shadow-slate-200/50 animate-[fadeUp_0.4s_ease]">

        {/* Header */}
        <div className="text-center mb-8">
          <span className="text-5xl block mb-3 animate-[pulseglow_3s_ease-in-out_infinite]">⚡</span>
          <h1 className="text-3xl font-bold bg-gradient-to-br from-blue-600 to-blue-800 bg-clip-text text-transparent">GAS Demo</h1>
          <p className="text-sm mt-1 text-slate-500">
            Script Testing Environment
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="flex flex-col gap-5">
          {/* Email */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Email
            </label>
            <div className="relative flex items-center">
              <span className="absolute left-3 text-sm text-slate-400">✉</span>
              <input
                id="email" type="email" value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="w-full pl-9 pr-4 py-3 rounded-lg text-sm bg-slate-50 border border-slate-300 text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
              />
            </div>
          </div>

          {/* Password */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Mật khẩu
            </label>
            <div className="relative flex items-center">
              <span className="absolute left-3 text-sm text-slate-400">🔒</span>
              <input
                id="password" type={showPass ? "text" : "password"} value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-9 pr-10 py-3 rounded-lg text-sm bg-slate-50 border border-slate-300 text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
              />
              <button type="button" onClick={() => setShowPass(v => !v)}
                className="absolute right-3 text-sm text-slate-400 hover:text-slate-600 transition-colors focus:outline-none">
                {showPass ? "🙈" : "👁"}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-lg text-sm bg-red-50 border border-red-200 text-red-600">
              <span className="shrink-0 text-red-500">⚠️</span> {error}
            </div>
          )}

          {/* Submit */}
          <button type="submit" disabled={loading}
            className="mt-2 py-3.5 rounded-lg text-white font-semibold text-base flex items-center justify-center gap-2 transition-all disabled:opacity-70 disabled:cursor-not-allowed bg-gradient-to-br from-blue-600 to-blue-800 hover:shadow-lg hover:shadow-blue-600/30 hover:-translate-y-0.5 active:translate-y-0">
            {loading && <span className="spinner border-t-transparent w-4 h-4 border-2" />}
            {loading ? "Đang đăng nhập..." : "Đăng nhập"}
          </button>
        </form>

        {/* Demo chips */}
        {demoAccounts.length > 0 && (
          <div className="mt-8 pt-6 text-center border-t border-slate-200">
            <p className="text-xs font-medium mb-3 text-slate-400 uppercase tracking-wider">Demo accounts</p>
            <div className="flex flex-wrap gap-2.5 justify-center">
              {demoAccounts.map((acc, i) => {
                let icon = "👤"
                if (acc.role === "admin") icon = "👑"
                else if (acc.role === "testapi") icon = "🛠️"
                
                return (
                  <button key={i} type="button" onClick={() => fillDemo(acc)}
                    className="px-4 py-2 rounded-full text-xs font-medium bg-slate-50 border border-slate-200 text-slate-600 transition-colors hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200">
                    {icon} {acc.name || acc.role}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
