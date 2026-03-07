import { useState } from "react"
import { call } from "../api/index.js"

function callGASFunction(fnName, ...args) {
  return call(fnName, ...args)
}

function resolveStatus(status, result) {
  if (status === "error") return false
  if (result && typeof result === "object" && result.success === false) return false
  return true
}

function LogEntry({ entry }) {
  const isOk = resolveStatus(entry.status, entry.result)
  
  return (
    <div className="border-b border-slate-200 animate-[fadeUp_0.25s_ease]">
      <div className={`flex items-center gap-2.5 px-4 py-2.5 text-xs ${isOk ? 'bg-slate-50' : 'bg-red-50'}`}>
        <span>{isOk ? "✅" : "❌"}</span>
        <span className="font-mono flex-1 truncate text-slate-800">
          {entry.fn}({entry.argsStr})
        </span>
        <span className="text-slate-500">{entry.time}</span>
        <span className={`font-semibold ${isOk ? 'text-green-600' : 'text-red-600'}`}>
          {entry.duration}ms
        </span>
      </div>
      <pre className={`font-mono text-xs px-4 py-3 overflow-y-auto max-h-[200px] whitespace-pre-wrap break-words bg-white border-t border-slate-200 border-l-4 ${isOk ? 'text-green-700 border-l-green-500' : 'text-red-700 border-l-red-500'}`}>
        {JSON.stringify(entry.result, null, 2)}
      </pre>
    </div>
  )
}

function TestPopup({ test, onRun, onClose }) {
  const [args, setArgs] = useState(test.args)

  const handleRun = () => {
    onRun(test.fn, args)
    onClose()
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 bg-slate-900/60 backdrop-blur-sm"
         onClick={onClose}>
      <div className="bg-white rounded-xl p-5 w-full max-w-[420px] border border-slate-200 shadow-xl animate-[fadeUp_0.2s_ease]"
           onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-xs uppercase tracking-widest mb-1 text-slate-500">Run function</div>
            <div className="font-mono font-bold text-base text-blue-600">
              {test.fn}()
            </div>
          </div>
          <button onClick={onClose}
            className="text-lg text-slate-400 hover:text-slate-700 transition-colors">✕</button>
        </div>

        <div className="flex flex-col gap-1.5 mb-4">
          <label className="text-xs font-medium text-slate-600">
            Arguments <span className="text-slate-400 font-normal">(JSON, comma separated)</span>
          </label>
          <input
            value={args}
            onChange={e => setArgs(e.target.value)}
            placeholder="leave empty if no args"
            onKeyDown={e => e.key === "Enter" && handleRun()}
            autoFocus
            className="font-mono text-sm px-3 py-2.5 rounded-lg border border-slate-300 bg-slate-50 text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
          />
        </div>

        {args && (
          <div className="mb-4 px-3 py-2 rounded-lg font-mono text-xs bg-slate-100 text-slate-600 border border-slate-200">
            {test.fn}({args})
          </div>
        )}

        <div className="flex gap-2 justify-end">
          <button onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm border border-slate-300 text-slate-600 hover:bg-slate-50 transition-colors">
            Cancel
          </button>
          <button onClick={handleRun}
            className="px-5 py-2 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-600/20 active:translate-y-[1px] transition-all flex items-center gap-2">
            ▶ Run
          </button>
        </div>
      </div>
    </div>
  )
}

export default function DashboardPage({ user, onLogout }) {
  const [fnName, setFnName]     = useState("helloServer")
  const [argsText, setArgsText] = useState("")
  const [running, setRunning]   = useState(false)
  const [logs, setLogs]         = useState([])
  const [popup, setPopup]       = useState(null)
  
  // Quick tests dynamic list
  const [quickTests, setQuickTests] = useState([
    { label: "helloServer",     fn: "helloServer",  args: "",                                    desc: "Ping server" },
    { label: "getUserInfo",     fn: "getUserInfo",   args: `"${user?.email}"`,                  desc: "Lấy thông tin user" },
  ])

  // Load demo accounts dynamically on mount
  useState(() => {
    call("getDemoAccounts").then(res => {
      if (res?.success && Array.isArray(res.data)) {
        const loginTests = res.data.map(acc => ({
          label: `login (${acc.role || acc.name})`,
          fn: "login",
          args: `"${acc.email}", "${acc.password}"`,
          desc: `Login as ${acc.name}`
        }))
        setQuickTests(prev => {
          return [
            prev[0], 
            ...loginTests,
            { label: "login (wrong)",   fn: "login",         args: `"admin@demo.com", "wrongpass"`,      desc: "Login sai mật khẩu" },
            prev[1] 
          ]
        })
      }
    }).catch(console.error)
  }, [])

  const parseArgs = (text) => {
    if (!text.trim()) return []
    return JSON.parse(`[${text}]`)
  }

  const runFunction = async (name = fnName, args = argsText) => {
    setRunning(true)
    const start = Date.now()
    const time  = new Date().toLocaleTimeString("vi-VN")
    try {
      const parsed = parseArgs(args)
      const result = await callGASFunction(name, ...parsed)
      setLogs(prev => [{ fn: name, argsStr: args, result, status: "success", time, duration: Date.now() - start }, ...prev])
    } catch (err) {
      setLogs(prev => [{ fn: name, argsStr: args, result: { error: err?.message || String(err) }, status: "error", time, duration: Date.now() - start }, ...prev])
    } finally {
      setRunning(false)
    }
  }

  return (
    <>
      {popup && (
        <TestPopup
          test={popup}
          onRun={(fn, args) => { setFnName(fn); setArgsText(args); runFunction(fn, args) }}
          onClose={() => setPopup(null)}
        />
      )}

      <div className="flex min-h-screen font-sans bg-slate-100 text-slate-800">
        <aside className="flex flex-col px-3 py-5 sticky top-0 h-screen overflow-y-auto w-[220px] bg-slate-50 border-r border-slate-200 shrink-0">
          <div className="flex items-center gap-2 px-2 py-1.5 mb-5">
            <span className="drop-shadow-md">🛠️</span>
            <span className="font-bold text-sm bg-gradient-to-br from-blue-600 to-blue-800 bg-clip-text text-transparent">API Console</span>
          </div>

          <div className="flex items-center gap-2 p-2.5 rounded-lg mb-5 bg-white border border-slate-200 shadow-sm">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0 bg-gradient-to-br from-blue-500 to-green-500">
              {user.name?.charAt(0) ?? "?"}
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold truncate text-slate-800">{user.name}</div>
              <div className="text-[10px] font-bold uppercase tracking-wide text-green-600">
                {user.role}
              </div>
            </div>
          </div>

          <div className="flex-1">
            <div className="text-xs font-semibold uppercase tracking-widest px-2 mb-2 text-slate-500">
              APIs
            </div>
            {quickTests.map((qt, i) => (
              <button key={i} onClick={() => setPopup(qt)}
                className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left transition-colors text-slate-600 hover:bg-blue-50 hover:text-blue-700 mb-0.5">
                <span className="w-4 h-4 rounded flex items-center justify-center shrink-0 text-xs bg-blue-100 text-blue-600">
                  ⚡
                </span>
                <span className="font-mono text-xs truncate">{qt.label}</span>
              </button>
            ))}
          </div>

          <button onClick={onLogout}
            className="w-full py-2 rounded-lg text-xs font-semibold border border-slate-300 text-slate-600 transition-colors hover:bg-red-50 hover:text-red-600 hover:border-red-200 mt-3">
            🚪 Đăng xuất
          </button>
        </aside>

        <main className="flex-1 flex flex-col gap-6 p-8 overflow-y-auto max-w-[900px] mx-auto w-full">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">API Console</h1>
            <p className="text-sm mt-1 text-slate-500">
              Test trực tiếp các GAS function — kết quả realtime từ server
            </p>
          </div>

          <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-sm">
            <div className="flex gap-4 items-end flex-wrap">
              <div className="flex flex-col gap-1.5 flex-1 min-w-[130px]">
                <label className="text-xs font-medium text-slate-600">Tên hàm</label>
                <input
                  value={fnName}
                  onChange={e => setFnName(e.target.value)}
                  placeholder="helloServer"
                  className="px-3 py-2.5 rounded-lg text-sm font-mono border border-slate-300 bg-slate-50 text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                />
              </div>
              <div className="flex flex-col gap-1.5 flex-[3] min-w-[180px]">
                <label className="text-xs font-medium text-slate-600">Arguments</label>
                <input
                  value={argsText}
                  onChange={e => setArgsText(e.target.value)}
                  placeholder={`"admin@demo.com", "admin123"`}
                  className="px-3 py-2.5 rounded-lg text-sm font-mono border border-slate-300 bg-slate-50 text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                />
              </div>
              <button
                onClick={() => runFunction()}
                disabled={running || !fnName}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-600/20 disabled:opacity-60 disabled:cursor-not-allowed shrink-0 transition-all active:translate-y-[1px]">
                {running ? <span className="spinner border-t-transparent" /> : "▶"}
                {running ? "Running..." : "Run"}
              </button>
            </div>
          </div>

          <div className="flex-1 flex flex-col rounded-xl overflow-hidden bg-white border border-slate-200 shadow-sm min-h-[300px]">
            <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
              <span className="text-xs font-medium text-slate-500">
                {logs.length} calls
              </span>
              {logs.length > 0 && (
                <button
                  className="text-xs px-2.5 py-1.5 rounded bg-slate-200/50 text-slate-600 hover:bg-red-100 hover:text-red-600 transition-colors"
                  onClick={() => setLogs([])}>
                  🗑 Clear
                </button>
              )}
            </div>

            {logs.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 p-14 text-slate-400">
                <span className="text-4xl opacity-50">💡</span>
                <p className="text-sm">Chọn một API từ thanh bên hoặc nhập tên hàm</p>
              </div>
            ) : (
              <div className="overflow-y-auto">
                {logs.map((entry, i) => <LogEntry key={i} entry={entry} />)}
              </div>
            )}
          </div>
        </main>
      </div>
    </>
  )
}
