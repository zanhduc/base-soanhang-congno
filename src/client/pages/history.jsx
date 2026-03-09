import { useEffect, useMemo, useRef, useState } from "react"
import { deleteOrder, getOrderHistory, getProductCatalog, updateOrder } from "../api"
import toast from "react-hot-toast"

const fmt = (n) => Number(n || 0).toLocaleString()
const toNum = (v) => Number(String(v ?? "").replace(/[^\d.-]/g, "")) || 0

const foldText = (v) =>
  String(v || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .trim()

const getStatusCode = (status) => {
  const key = foldText(status).replace(/\s+/g, " ")
  if (!key) return "PAID"
  if (key.includes("tra mot phan") || key.includes("tra 1 phan")) return "PARTIAL"
  if (key === "no" || key.includes(" no ")) return "DEBT"
  if (key.includes("da thanh toan")) return "PAID"
  return "PAID"
}

const toIsoDate = (v) => {
  const raw = String(v || "").trim()
  if (!raw) return ""
  const m = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (m) return `${m[3]}-${m[2]}-${m[1]}`
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
  return ""
}

const pad2 = (n) => String(n).padStart(2, "0")

const parseFlexibleDateParts = (value) => {
  const raw = String(value || "").trim()
  if (!raw) return null

  let m = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (m) return { d: Number(m[3]), m: Number(m[2]), y: Number(m[1]), hasYear: true }

  m = raw.match(/^(\d{1,2})[\/\-.](\d{1,2})(?:[\/\-.](\d{2,4}))?$/)
  if (m) {
    const d = Number(m[1])
    const mo = Number(m[2])
    const yRaw = m[3]
    if (!yRaw) return { d, m: mo, y: null, hasYear: false }
    const y = yRaw.length === 2 ? Number(`20${yRaw}`) : Number(yRaw)
    return { d, m: mo, y, hasYear: true }
  }

  const digits = raw.replace(/\D/g, "")
  if (/^\d+$/.test(raw)) {
    if (digits.length === 8) {
      if (Number(digits.slice(0, 4)) >= 1900) {
        return {
          d: Number(digits.slice(6, 8)),
          m: Number(digits.slice(4, 6)),
          y: Number(digits.slice(0, 4)),
          hasYear: true,
        }
      }
      return {
        d: Number(digits.slice(0, 2)),
        m: Number(digits.slice(2, 4)),
        y: Number(digits.slice(4, 8)),
        hasYear: true,
      }
    }
    if (digits.length === 6) {
      return {
        d: Number(digits.slice(0, 2)),
        m: Number(digits.slice(2, 4)),
        y: Number(`20${digits.slice(4, 6)}`),
        hasYear: true,
      }
    }
    if (digits.length === 4) {
      return { d: Number(digits.slice(0, 2)), m: Number(digits.slice(2, 4)), y: null, hasYear: false }
    }
  }

  return null
}

const isValidCalendarDate = (parts) => {
  if (!parts) return false
  const d = Number(parts.d)
  const m = Number(parts.m)
  if (!d || !m || m < 1 || m > 12 || d < 1 || d > 31) return false
  if (!parts.hasYear || !parts.y) return true
  const dt = new Date(parts.y, m - 1, d)
  return dt.getFullYear() === parts.y && dt.getMonth() === m - 1 && dt.getDate() === d
}

const buildDateTokens = (parts) => {
  if (!parts || !isValidCalendarDate(parts)) return new Set()
  const d = pad2(parts.d)
  const m = pad2(parts.m)
  const tokens = new Set([`${d}/${m}`, `${d}-${m}`, `${d}${m}`])
  if (!parts.hasYear || !parts.y) return tokens
  const y = String(parts.y)
  const yy = y.slice(-2)
  tokens.add(`${d}/${m}/${y}`)
  tokens.add(`${d}-${m}-${y}`)
  tokens.add(`${d}/${m}/${yy}`)
  tokens.add(`${d}-${m}-${yy}`)
  tokens.add(`${y}-${m}-${d}`)
  tokens.add(`${y}${m}${d}`)
  tokens.add(`${d}${m}${y}`)
  tokens.add(`${d}${m}${yy}`)
  return tokens
}

const getDateSearchMeta = (queryValue) => {
  const raw = String(queryValue || "").trim()
  const looksLikeDate = /[\/\-.]/.test(raw) || /^\d{4,8}$/.test(raw)
  if (!raw || !looksLikeDate) {
    return { isDateQuery: false, isValid: true, tokens: new Set() }
  }
  const parts = parseFlexibleDateParts(raw)
  const valid = isValidCalendarDate(parts)
  return {
    isDateQuery: true,
    isValid: valid,
    tokens: valid ? buildDateTokens(parts) : new Set(),
  }
}

const hasDateTokenMatch = (orderDateValue, queryTokens) => {
  if (!queryTokens || !queryTokens.size) return true
  const parts = parseFlexibleDateParts(orderDateValue)
  const tokens = buildDateTokens(parts)
  if (!tokens.size) return false
  for (const token of queryTokens) {
    if (tokens.has(token)) return true
  }
  return false
}

const moneyMeaning = (value) => {
  const n = toNum(value)
  if (!n) return "0 đồng"
  if (n >= 1_000_000) {
    return `${(n / 1_000_000).toLocaleString("vi-VN", { maximumFractionDigits: 2 })} triệu`
  }
  if (n >= 1_000) {
    return `${(n / 1_000).toLocaleString("vi-VN", { maximumFractionDigits: 2 })} nghìn`
  }
  return `${n.toLocaleString("vi-VN")} đồng`
}

function MoneyInput({ value, onChange, placeholder }) {
  const [display, setDisplay] = useState(value ? fmt(value) : "")

  useEffect(() => {
    setDisplay(value ? fmt(value) : "")
  }, [value])

  const onInput = (e) => {
    const digits = String(e.target.value || "").replace(/[^\d]/g, "")
    const n = digits ? Number(digits) : 0
    setDisplay(digits ? fmt(n) : "")
    onChange(n)
  }

  return (
    <input
      value={display}
      onChange={onInput}
      placeholder={placeholder}
      inputMode="numeric"
      className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
    />
  )
}

function StatusBadge({ status }) {
  const text = String(status || "Đã thanh toán")
  const key = getStatusCode(text)
  let cls = "bg-rose-100 text-rose-800"
  if (key === "PAID") cls = "bg-emerald-100 text-emerald-700"
  if (key === "PARTIAL") cls = "bg-violet-100 text-violet-700"
  if (key === "DEBT") cls = "bg-amber-100 text-amber-800"
  return <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${cls}`}>{text}</span>
}

function HistoryCard({ order, deleting, onEdit, onDelete }) {
  const [open, setOpen] = useState(false)
  const isPartial = getStatusCode(order.trangThai) === "PARTIAL"

  return (
    <article className="rounded-2xl border border-rose-200 bg-white p-4 md:p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-slate-500">Mã phiếu</p>
          <h3 className="text-lg font-bold text-slate-900">{order.maPhieu}</h3>
          <p className="text-sm text-slate-500 mt-1">Ngày bán: {order.ngayBan || "-"}</p>
          <p className="text-sm text-slate-500">Khách: {order.tenKhach || "Khách ghé thăm"}</p>
        </div>
        <div className="text-right">
          <StatusBadge status={order.trangThai} />
          {isPartial && Number(order.tienNo || 0) > 0 && (
            <p className="text-xs font-semibold text-amber-700 mt-2">Còn nợ: {fmt(order.tienNo)}</p>
          )}
          <p className="text-xs text-slate-500 mt-2">Tổng hóa đơn</p>
          <p className="text-lg font-bold text-rose-700">{fmt(order.tongHoaDon)}</p>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-sm text-slate-600 truncate">Ghi chú: {order.ghiChu || "-"}</p>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="shrink-0 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
        >
          {open ? "Ẩn chi tiết" : "Xem chi tiết"}
        </button>
      </div>

      {open && (
        <div className="mt-3 overflow-hidden rounded-xl border border-slate-200">
          <div className="md:hidden divide-y divide-slate-100">
            {order.products.map((p, idx) => (
              <div key={`${order.maPhieu}-m-${idx}`} className="px-3 py-2.5">
                <p className="text-sm font-semibold text-slate-800">{p.tenSanPham}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {p.donVi || "-"} | SL {fmt(p.soLuong)} | Đơn giá {fmt(p.donGiaBan)}
                </p>
                <p className="mt-1 text-sm font-bold text-slate-800">Thành tiền: {fmt(p.thanhTien)}</p>
              </div>
            ))}
          </div>

          <div className="hidden md:block overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide whitespace-nowrap">Sản phẩm</th>
                  <th className="px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide whitespace-nowrap">Đơn vị</th>
                  <th className="px-3 py-2.5 text-right text-xs font-bold uppercase tracking-wide whitespace-nowrap">SL</th>
                  <th className="px-3 py-2.5 text-right text-xs font-bold uppercase tracking-wide whitespace-nowrap">Đơn giá</th>
                  <th className="px-3 py-2.5 text-right text-xs font-bold uppercase tracking-wide whitespace-nowrap">Thành tiền</th>
                </tr>
              </thead>
              <tbody>
                {order.products.map((p, idx) => (
                  <tr key={`${order.maPhieu}-${idx}`} className="border-t border-slate-100">
                    <td className="px-3 py-2 text-slate-800 whitespace-nowrap">{p.tenSanPham}</td>
                    <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{p.donVi || "-"}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">{fmt(p.soLuong)}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">{fmt(p.donGiaBan)}</td>
                    <td className="px-3 py-2 text-right font-semibold text-slate-800 whitespace-nowrap">{fmt(p.thanhTien)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-3 py-2.5 bg-slate-50/60">
            <button
              type="button"
              onClick={onEdit}
              className="shrink-0 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 text-slate-700 hover:bg-white"
            >
              Sửa
            </button>
            <button
              type="button"
              onClick={onDelete}
              disabled={deleting}
              className="shrink-0 px-3 py-1.5 text-xs font-semibold rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50 disabled:opacity-60"
            >
              {deleting ? "Đang xóa..." : "Xóa"}
            </button>
          </div>
        </div>
      )}
    </article>
  )
}

function EditOrderModal({ order, saving, onClose, onSave, productCatalog }) {
  const [form, setForm] = useState(() => ({
    maPhieuOriginal: order.maPhieu,
    maPhieu: order.maPhieu,
    ngayBan: toIsoDate(order.ngayBan),
    tenKhach: order.tenKhach === "Khách ghé thăm" ? "" : String(order.tenKhach || ""),
    soDienThoai: String(order.soDienThoai || ""),
    ghiChu: String(order.ghiChu || "-"),
    trangThaiCode: getStatusCode(order.trangThai),
    soTienDaTra:
      getStatusCode(order.trangThai) === "PARTIAL"
        ? Math.max(toNum(order.tongHoaDon) - toNum(order.tienNo), 0)
        : 0,
    products: (order.products || []).map((p) => ({
      tenSanPham: p.tenSanPham || "",
      donVi: p.donVi || "",
      soLuong: toNum(p.soLuong) || 1,
      giaVon: toNum(p.giaVon),
      donGiaBan: toNum(p.donGiaBan),
    })),
  }))
  const [suggestIndex, setSuggestIndex] = useState(-1)

  const total = useMemo(
    () => form.products.reduce((sum, p) => sum + toNum(p.soLuong) * toNum(p.donGiaBan), 0),
    [form.products],
  )

  const updateProduct = (idx, patch) => {
    setForm((prev) => ({
      ...prev,
      products: prev.products.map((p, i) => (i === idx ? { ...p, ...patch } : p)),
    }))
  }

  const removeProduct = (idx) => {
    setForm((prev) => ({
      ...prev,
      products: prev.products.filter((_, i) => i !== idx),
    }))
  }

  const getSuggestions = (query) => {
    const q = foldText(query)
    if (!q) return (productCatalog || []).slice(0, 8)
    return (productCatalog || []).filter((p) => foldText(p.tenSanPham).includes(q)).slice(0, 8)
  }

  return (
    <div className="fixed inset-0 z-[9800] bg-slate-900/45 p-3 md:p-6" onClick={onClose}>
      <div className="mx-auto max-w-3xl rounded-2xl bg-white shadow-2xl border border-slate-200 max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-slate-200 px-4 py-3 md:px-5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-base md:text-lg font-bold text-slate-900">Sửa hóa đơn {order.maPhieu}</h3>
            <button type="button" onClick={onClose} className="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100">Đóng</button>
          </div>
        </div>

        <div className="p-4 md:p-5 space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <input value={form.maPhieu} onChange={(e) => setForm((p) => ({ ...p, maPhieu: e.target.value }))} placeholder="Mã phiếu" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />
            <input type="date" value={form.ngayBan} onChange={(e) => setForm((p) => ({ ...p, ngayBan: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />
            <input value={form.tenKhach} onChange={(e) => setForm((p) => ({ ...p, tenKhach: e.target.value }))} placeholder="Tên khách (để trống = Khách ghé thăm)" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />
            <input value={form.soDienThoai} onChange={(e) => setForm((p) => ({ ...p, soDienThoai: e.target.value }))} placeholder="Số điện thoại" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" />
          </div>

          <div className="grid grid-cols-3 gap-2">
            {[
              { code: "PAID", label: "Đã thanh toán" },
              { code: "PARTIAL", label: "Trả một phần" },
              { code: "DEBT", label: "Nợ" },
            ].map((st) => (
              <button
                key={st.code}
                type="button"
                onClick={() =>
                  setForm((p) => ({
                    ...p,
                    trangThaiCode: st.code,
                    soTienDaTra: st.code === "PARTIAL" ? p.soTienDaTra : 0,
                  }))
                }
                className={`rounded-xl px-2 py-2 text-xs font-semibold border ${
                  form.trangThaiCode === st.code
                    ? "bg-rose-700 text-white border-rose-700"
                    : "bg-white text-slate-600 border-slate-200"
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>
          {form.trangThaiCode === "PARTIAL" && (
            <div className="space-y-1">
              <MoneyInput
                value={form.soTienDaTra}
                onChange={(v) => setForm((p) => ({ ...p, soTienDaTra: v }))}
                placeholder="Số tiền đã trả trước"
              />
              <p className="text-xs font-semibold text-slate-700">
                Tiền đã trả: <span className="text-rose-700">{fmt(form.soTienDaTra)} VND</span>
              </p>
            </div>
          )}

          <textarea value={form.ghiChu} onChange={(e) => setForm((p) => ({ ...p, ghiChu: e.target.value }))} rows={2} placeholder="Ghi chú" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm resize-none" />

          <div className="space-y-3">
            {form.products.map((p, idx) => (
              <div key={`edit-p-${idx}`} className="rounded-xl border border-slate-200 p-3 space-y-2">
                <div className="grid gap-2 md:grid-cols-2">
                  <div className="relative">
                    <input
                      value={p.tenSanPham}
                      onFocus={() => setSuggestIndex(idx)}
                      onBlur={() => setTimeout(() => setSuggestIndex(-1), 120)}
                      onChange={(e) => {
                        updateProduct(idx, { tenSanPham: e.target.value })
                        setSuggestIndex(idx)
                      }}
                      placeholder="Tên sản phẩm"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    />
                    {suggestIndex === idx && getSuggestions(p.tenSanPham).length > 0 && (
                      <div className="absolute z-40 mt-1 max-h-52 w-full overflow-auto rounded-xl border border-slate-200 bg-white shadow-lg">
                        {getSuggestions(p.tenSanPham).map((sp) => (
                          <button
                            key={`${sp.tenSanPham}-${sp.donVi}`}
                            type="button"
                            onMouseDown={(ev) => ev.preventDefault()}
                            onClick={() => {
                              updateProduct(idx, {
                                tenSanPham: sp.tenSanPham || "",
                                donVi: sp.donVi || "",
                                donGiaBan: toNum(sp.donGiaBan),
                              })
                              setSuggestIndex(-1)
                            }}
                            className="block w-full border-b border-slate-100 px-3 py-2 text-left last:border-b-0 hover:bg-rose-50"
                          >
                            <p className="text-sm font-semibold text-slate-800">{sp.tenSanPham}</p>
                            <p className="text-xs text-slate-500">{sp.donVi || "-"} | Bán {fmt(sp.donGiaBan || 0)}</p>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <input value={p.donVi} onChange={(e) => updateProduct(idx, { donVi: e.target.value })} placeholder="Đơn vị" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input value={p.soLuong} onChange={(e) => updateProduct(idx, { soLuong: toNum(e.target.value) || 1 })} placeholder="SL" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                  <MoneyInput value={p.donGiaBan} onChange={(v) => updateProduct(idx, { donGiaBan: v })} placeholder="Đơn giá bán" />
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-rose-700">
                    Thành tiền: {fmt(toNum(p.soLuong) * toNum(p.donGiaBan))}
                  </p>
                  <button type="button" onClick={() => removeProduct(idx)} className="text-xs font-semibold text-rose-700">Xóa sản phẩm</button>
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={() =>
                setForm((p) => ({
                  ...p,
                  products: [...p.products, { tenSanPham: "", donVi: "", soLuong: 1, giaVon: 0, donGiaBan: 0 }],
                }))
              }
              className="w-full rounded-xl border border-dashed border-slate-300 py-2 text-sm text-slate-600"
            >
              + Thêm sản phẩm
            </button>
          </div>

          <div className="rounded-xl bg-rose-50 border border-rose-200 px-3 py-2.5 text-sm font-semibold text-slate-700">
            Tổng hóa đơn: {fmt(total)}
          </div>
        </div>

        <div className="sticky bottom-0 bg-white border-t border-slate-200 p-4 flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-700">Hủy</button>
          <button
            type="button"
            disabled={saving}
            onClick={() => onSave(form, total)}
            className={`flex-1 rounded-xl py-2.5 text-sm font-semibold text-white ${
              saving ? "bg-slate-400" : "bg-gradient-to-r from-rose-700 to-rose-500"
            }`}
          >
            {saving ? "Đang lưu..." : "Lưu thay đổi"}
          </button>
        </div>
      </div>
    </div>
  )
}

function StatusDropdown({ value, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const options = [
    { value: "ALL", label: "Tất cả trạng thái" },
    { value: "PAID", label: "Đã thanh toán" },
    { value: "PARTIAL", label: "Trả một phần" },
    { value: "DEBT", label: "Nợ" },
  ]

  useEffect(() => {
    const onDocClick = (e) => {
      if (!ref.current) return
      if (!ref.current.contains(e.target)) setOpen(false)
    }
    const onEsc = (e) => {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", onDocClick)
    document.addEventListener("touchstart", onDocClick)
    document.addEventListener("keydown", onEsc)
    return () => {
      document.removeEventListener("mousedown", onDocClick)
      document.removeEventListener("touchstart", onDocClick)
      document.removeEventListener("keydown", onEsc)
    }
  }, [])

  const selected = options.find((o) => o.value === value) || options[0]

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left text-sm font-semibold text-slate-800 shadow-sm focus:border-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-700/20 transition-all"
      >
        <span>{selected.label}</span>
        <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}>▾</span>
      </button>
      {open && (
        <div className="absolute z-40 mt-1.5 max-h-56 w-full overflow-auto rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onChange(opt.value)
                setOpen(false)
              }}
              className={`block w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                value === opt.value ? "bg-rose-50 text-rose-700 font-semibold" : "text-slate-700 hover:bg-rose-50"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function FilterFields({ filters, setFilters, statusFilter, setStatusFilter }) {
  const inputCls =
    "w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-rose-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-700/20 transition-all"

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      <div>
        <label className="mb-1 block text-xs font-semibold text-slate-500 uppercase tracking-wide">Trạng thái</label>
        <StatusDropdown value={statusFilter} onChange={setStatusFilter} />
      </div>
      <div>
        <label className="mb-1 block text-xs font-semibold text-slate-500 uppercase tracking-wide">Từ ngày</label>
        <input type="date" value={filters.fromDate} onChange={(e) => setFilters((p) => ({ ...p, fromDate: e.target.value }))} className={inputCls} />
      </div>
      <div>
        <label className="mb-1 block text-xs font-semibold text-slate-500 uppercase tracking-wide">Đến ngày</label>
        <input type="date" value={filters.toDate} onChange={(e) => setFilters((p) => ({ ...p, toDate: e.target.value }))} className={inputCls} />
      </div>
      <div>
        <label className="mb-1 block text-xs font-semibold text-slate-500 uppercase tracking-wide">Tên khách</label>
        <input value={filters.tenKhach} onChange={(e) => setFilters((p) => ({ ...p, tenKhach: e.target.value }))} placeholder="Nhập tên khách" className={inputCls} />
      </div>
      <div>
        <label className="mb-1 block text-xs font-semibold text-slate-500 uppercase tracking-wide">Mã phiếu</label>
        <input value={filters.maPhieu} onChange={(e) => setFilters((p) => ({ ...p, maPhieu: e.target.value }))} placeholder="VD: DH012" className={inputCls} />
      </div>
      <div>
        <label className="mb-1 block text-xs font-semibold text-slate-500 uppercase tracking-wide">Tên sản phẩm</label>
        <input value={filters.tenSanPham} onChange={(e) => setFilters((p) => ({ ...p, tenSanPham: e.target.value }))} placeholder="Nhập tên sản phẩm" className={inputCls} />
      </div>
    </div>
  )
}

export default function HistoryPage() {
  const [loading, setLoading] = useState(true)
  const [orders, setOrders] = useState([])
  const [productCatalog, setProductCatalog] = useState([])
  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("ALL")
  const [showMobileFilters, setShowMobileFilters] = useState(false)
  const [editingOrder, setEditingOrder] = useState(null)
  const [savingOrder, setSavingOrder] = useState(false)
  const [deletingCode, setDeletingCode] = useState("")
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [filters, setFilters] = useState({
    fromDate: "",
    toDate: "",
    tenKhach: "",
    maPhieu: "",
    tenSanPham: "",
  })

  const loadProductCatalog = async () => {
    try {
      const res = await getProductCatalog()
      if (res?.success && Array.isArray(res.data)) setProductCatalog(res.data)
      else setProductCatalog([])
    } catch (e) {
      setProductCatalog([])
    }
  }

  const loadHistory = async () => {
    setLoading(true)
    try {
      const res = await getOrderHistory()
      if (res?.success && Array.isArray(res.data)) {
        setOrders(res.data)
      } else {
        setOrders([])
        if (res?.message) toast.error(res.message)
      }
    } catch (e) {
      setOrders([])
      toast.error("Không tải được lịch sử đơn hàng")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadHistory()
    loadProductCatalog()
  }, [])

  const dateSearchMeta = useMemo(() => getDateSearchMeta(query), [query])

  const filteredOrders = useMemo(() => {
    const qAll = foldText(query)
    const qKhach = foldText(filters.tenKhach)
    const qMa = foldText(filters.maPhieu)
    const qSanPham = foldText(filters.tenSanPham)

    return orders.filter((order) => {
      const orderStatusCode = getStatusCode(order.trangThai)
      const statusOk =
        statusFilter === "ALL" ||
        (statusFilter === "PAID" && orderStatusCode === "PAID") ||
        (statusFilter === "PARTIAL" && orderStatusCode === "PARTIAL") ||
        (statusFilter === "DEBT" && orderStatusCode === "DEBT")

      if (!statusOk) return false

      const orderDate = toIsoDate(order.ngayBan)
      if ((filters.fromDate || filters.toDate) && !orderDate) return false
      if (filters.fromDate && orderDate < filters.fromDate) return false
      if (filters.toDate && orderDate > filters.toDate) return false

      if (qKhach && !foldText(order.tenKhach || "").includes(qKhach)) return false
      if (qMa && !foldText(order.maPhieu || "").includes(qMa)) return false

      if (qSanPham) {
        const productText = (order.products || []).map((p) => p.tenSanPham).join(" ")
        if (!foldText(productText).includes(qSanPham)) return false
      }

      if (qAll) {
        if (dateSearchMeta.isDateQuery) {
          if (!dateSearchMeta.isValid) return false
          if (!hasDateTokenMatch(order.ngayBan, dateSearchMeta.tokens)) return false
        } else {
          const productTextAll = (order.products || []).map((p) => p.tenSanPham).join(" ")
          const allText = [order.maPhieu, order.ngayBan, order.tenKhach, productTextAll].join(" ")
          if (!foldText(allText).includes(qAll)) return false
        }
      }

      return true
    })
  }, [orders, filters, statusFilter, query, dateSearchMeta])

  const resetFilters = () => {
    setFilters({ fromDate: "", toDate: "", tenKhach: "", maPhieu: "", tenSanPham: "" })
    setStatusFilter("ALL")
  }

  const handleDeleteOrder = async (maPhieu) => {
    const key = String(maPhieu || "").trim()
    if (!key) return
    setDeleteTarget({ maPhieu: key })
  }

  const confirmDeleteOrder = async () => {
    const key = String(deleteTarget?.maPhieu || "").trim()
    if (!key) return
    setDeletingCode(key)
    try {
      const res = await deleteOrder(key)
      if (res?.success) {
        toast.success(res.message || "Đã xóa hóa đơn")
        await loadHistory()
        setDeleteTarget(null)
      } else {
        toast.error(res?.message || "Xóa hóa đơn thất bại")
      }
    } catch (e) {
      toast.error("Xóa hóa đơn thất bại")
    } finally {
      setDeletingCode("")
    }
  }

  const handleSaveOrder = async (form, total) => {
    const maPhieu = String(form.maPhieu || "").trim()
    if (!maPhieu) return toast.error("Mã phiếu không được để trống")

    const products = (form.products || [])
      .map((p) => ({
        tenSanPham: String(p.tenSanPham || "").trim(),
        donVi: String(p.donVi || "").trim(),
        soLuong: Math.max(toNum(p.soLuong), 1),
        giaVon: Math.max(toNum(p.giaVon), 0),
        donGiaBan: Math.max(toNum(p.donGiaBan), 0),
      }))
      .filter((p) => p.tenSanPham && p.donVi && p.donGiaBan > 0)

    if (!products.length) return toast.error("Cần ít nhất 1 sản phẩm hợp lệ")

    if (form.trangThaiCode === "PARTIAL") {
      const paid = Math.max(toNum(form.soTienDaTra), 0)
      if (paid <= 0) return toast.error("Nhập số tiền đã trả trước")
      if (paid > total) return toast.error("Số tiền đã trả không được lớn hơn tổng hóa đơn")
    }

    setSavingOrder(true)
    try {
      const payload = {
        maPhieuOriginal: form.maPhieuOriginal,
        customer: {
          tenKhach: String(form.tenKhach || "").trim(),
          soDienThoai: String(form.soDienThoai || "").trim(),
        },
        orderInfo: {
          maPhieu,
          ngayBan: form.ngayBan || "",
          trangThaiCode: form.trangThaiCode || "PAID",
          soTienDaTra: form.trangThaiCode === "PARTIAL" ? Math.max(toNum(form.soTienDaTra), 0) : 0,
          ghiChu: String(form.ghiChu || "-").trim() || "-",
        },
        products,
      }
      const res = await updateOrder(payload)
      if (res?.success) {
        toast.success(res.message || "Đã cập nhật hóa đơn")
        setEditingOrder(null)
        await loadHistory()
      } else {
        toast.error(res?.message || "Cập nhật hóa đơn thất bại")
      }
    } catch (e) {
      toast.error("Cập nhật hóa đơn thất bại")
    } finally {
      setSavingOrder(false)
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-50 to-rose-50/30">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-6 md:py-8 pb-24">
        <div className="mb-6 md:mb-8">
          <h1 className="text-3xl md:text-4xl font-black text-slate-900 leading-tight">Lịch sử đơn hàng</h1>
          <p className="mt-2 text-sm md:text-base text-slate-500">Tra cứu đơn hàng theo ngày, khách, mã phiếu và sản phẩm.</p>
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5 shadow-sm mb-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm md:text-base font-bold text-slate-800">Bộ lọc đơn hàng</h2>
            <span className="text-xs text-slate-400">Lọc nhanh theo nhu cầu</span>
          </div>
          <div className="mb-3">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm kiếm nhanh theo mã phiếu, khách, ngày, sản phẩm..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-rose-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-700/20 transition-all"
            />
            {dateSearchMeta.isDateQuery && !dateSearchMeta.isValid && (
              <p className="mt-2 text-xs font-semibold text-amber-700">
                Ngày không hợp lệ. Dùng định dạng như `08/03/2026`, `8-3-2026` hoặc `2026-03-08`.
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 md:hidden mb-3">
            <button
              type="button"
              onClick={() => setShowMobileFilters(true)}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 bg-white hover:bg-slate-50"
            >
              Mở bộ lọc
            </button>
            <button
              type="button"
              onClick={loadHistory}
              className="rounded-xl bg-gradient-to-r from-rose-700 to-rose-500 px-4 py-2.5 text-sm font-semibold text-white hover:shadow-lg hover:shadow-rose-700/25"
            >
              Làm mới
            </button>
          </div>

          <div className="hidden md:block">
            <FilterFields filters={filters} setFilters={setFilters} statusFilter={statusFilter} setStatusFilter={setStatusFilter} />
            <div className="mt-3 flex items-center gap-2">
              <button type="button" onClick={resetFilters} className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">Xóa lọc</button>
              <button type="button" onClick={loadHistory} className="rounded-lg bg-gradient-to-r from-rose-700 to-rose-500 px-3 py-2 text-sm font-semibold text-white hover:shadow-lg hover:shadow-rose-700/25">Làm mới</button>
            </div>
          </div>
        </section>

        {showMobileFilters && (
          <div className="fixed inset-0 z-[9500] bg-slate-900/40 md:hidden" onClick={() => setShowMobileFilters(false)}>
            <div className="absolute bottom-0 left-0 right-0 rounded-t-3xl bg-white p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-900">Bộ lọc đơn hàng</h2>
                <button type="button" onClick={() => setShowMobileFilters(false)} className="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100">Đóng</button>
              </div>
              <FilterFields filters={filters} setFilters={setFilters} statusFilter={statusFilter} setStatusFilter={setStatusFilter} />
              <div className="mt-4 flex gap-2">
                <button type="button" onClick={resetFilters} className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700">Xóa lọc</button>
                <button
                  type="button"
                  onClick={() => setShowMobileFilters(false)}
                  className="flex-1 rounded-xl bg-gradient-to-r from-rose-700 to-rose-500 px-4 py-2.5 text-sm font-semibold text-white"
                >
                  Áp dụng
                </button>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-500">Đang tải lịch sử đơn hàng...</div>
        ) : filteredOrders.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-500">Không có đơn hàng phù hợp.</div>
        ) : (
          <div className="space-y-3">
            {filteredOrders.map((order, idx) => (
              <HistoryCard
                key={`${order.maPhieu}-${idx}`}
                order={order}
                deleting={deletingCode === order.maPhieu}
                onEdit={() => setEditingOrder(order)}
                onDelete={() => handleDeleteOrder(order.maPhieu)}
              />
            ))}
          </div>
        )}
      </div>

      {editingOrder && (
        <EditOrderModal
          order={editingOrder}
          saving={savingOrder}
          productCatalog={productCatalog}
          onClose={() => (savingOrder ? null : setEditingOrder(null))}
          onSave={handleSaveOrder}
        />
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-[9900] bg-slate-900/45 p-4" onClick={() => (deletingCode ? null : setDeleteTarget(null))}>
          <div className="mx-auto mt-[18vh] w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-bold text-slate-900">Xác nhận xóa hóa đơn</h3>
            <p className="mt-2 text-sm text-slate-600">
              Bạn sắp xóa hóa đơn <span className="font-semibold text-slate-900">{deleteTarget.maPhieu}</span>. Thao tác này sẽ cập nhật cả `DON_HANG` và `KHACH`.
            </p>
            <p className="mt-1 text-xs text-rose-600">Hành động này không thể hoàn tác.</p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                disabled={Boolean(deletingCode)}
                onClick={() => setDeleteTarget(null)}
                className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 disabled:opacity-60"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={Boolean(deletingCode)}
                onClick={confirmDeleteOrder}
                className="flex-1 rounded-xl bg-gradient-to-r from-rose-700 to-rose-500 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              >
                {deletingCode ? "Đang xóa..." : "Xóa hóa đơn"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
