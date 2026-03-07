import { useState, useEffect } from "react"
import { getGlobalNotice } from "../api/index.js"

const LEVEL_CONFIG = {
  info:    { bg: "bg-blue-500/50", text: "text-white", icon: "ℹ️" },
  warning: { bg: "bg-amber-500/55", text: "text-amber-900", icon: "⚠️" },
  error:   { bg: "bg-red-500/60", text: "text-white", icon: "🚨" },
}

// sessionStorage: hiện 1 lần mỗi khi mở trang mới.
// Nếu đang ở trang rồi thì không hiện lại.
const NOTICE_SESSION_KEY = "global_notice_dismissed"

export default function GlobalNoticeBanner() {
  const [notice, setNotice] = useState(null)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    // Nếu đã dismiss trong session này → không hiện nữa
    if (sessionStorage.getItem(NOTICE_SESSION_KEY)) return

    getGlobalNotice()
      .then((res) => {
        if (!res) return

        let items = []
        if (Array.isArray(res)) items = res
        else if (typeof res === "string" && res) items = [{ message: res, level: "warning", version: "" }]
        else if (res.message) items = [res]

        const active = items.find(n => n.message)
        if (active) setNotice(active)
      })
      .catch(() => {})
  }, [])

  const dismiss = () => {
    sessionStorage.setItem(NOTICE_SESSION_KEY, "1")
    setNotice(null)
  }

  if (!notice) return null

  const cfg = LEVEL_CONFIG[notice.level] || LEVEL_CONFIG.info
  const hasChangelog = !!notice.changelog

  return (
    <div
      className={`
        fixed bottom-0 left-0 right-0 z-[9999]
        ${cfg.bg} ${cfg.text}
        backdrop-blur-xl
        shadow-[0_-2px_12px_rgba(0,0,0,0.15)]
        border-t border-white/20
        transition-all duration-300
        px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]
      `}
    >
      <div className="max-w-xl mx-auto">
        {/* Main row */}
        <div className="flex items-center gap-3">
          <span className="text-base shrink-0">{cfg.icon}</span>

          {/* Message – tap to expand changelog */}
          <div
            className="flex-1 min-w-0 cursor-pointer"
            onClick={() => hasChangelog && setExpanded(e => !e)}
          >
            <p className="text-[13px] leading-snug font-medium">
              {notice.message}
              {hasChangelog && (
                <span className={`inline-block ml-1 text-[10px] opacity-60 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}>▾</span>
              )}
            </p>
          </div>

          {/* Buttons */}
          <div className="flex gap-2 shrink-0">
            <button
              onClick={dismiss}
              className="border-none rounded-lg px-3 py-1.5 text-xs font-semibold cursor-pointer transition-all bg-white/20 hover:bg-white/35 active:scale-95"
            >Từ chối</button>
            <button
              onClick={dismiss}
              className="border-none rounded-lg px-3 py-1.5 text-xs font-semibold cursor-pointer transition-all bg-white/90 text-slate-800 hover:bg-white active:scale-95"
            >Đồng ý</button>
          </div>
        </div>

        {/* Changelog – expand on tap/hover */}
        {hasChangelog && (
          <div
            className={`overflow-hidden transition-all duration-300 ${
              expanded
                ? "max-h-[200px] opacity-100 mt-2.5 pt-2.5 border-t border-white/20"
                : "max-h-0 opacity-0 mt-0 pt-0 border-t border-transparent"
            }`}
          >
            <div className="text-[10px] font-bold uppercase opacity-70 mb-1 tracking-wide">
              Nội dung cập nhật
            </div>
            <div className="text-xs leading-relaxed opacity-90 whitespace-pre-line">
              {notice.changelog}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
