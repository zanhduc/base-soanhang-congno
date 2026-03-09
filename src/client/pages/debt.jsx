import { useEffect, useMemo, useRef, useState } from "react"
import toast from "react-hot-toast"
import { deleteOrder, getDebtCustomers, updateDebtCustomer } from "../api"

const fmt = (n) => Number(n || 0).toLocaleString("vi-VN")
const toNum = (v) => Number(String(v ?? "").replace(/[^\d.-]/g, "")) || 0

const foldText = (v) =>
  String(v || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .trim()

const isGuestCustomer = (name) => foldText(name) === "khach ghe tham"

const toIsoDate = (v) => {
  const raw = String(v || "").trim()
  if (!raw) return ""
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
  const m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!m) return ""
  return `${m[3]}-${String(m[2]).padStart(2, "0")}-${String(m[1]).padStart(2, "0")}`
}

function MoneyInput({ value, onChange }) {
  const [display, setDisplay] = useState(value ? fmt(value) : "")

  useEffect(() => {
    setDisplay(value ? fmt(value) : "")
  }, [value])

  return (
    <input
      value={display}
      onChange={(e) => {
        const digits = String(e.target.value || "").replace(/[^\d]/g, "")
        const n = digits ? Number(digits) : 0
        setDisplay(digits ? fmt(n) : "")
        onChange(n)
      }}
      inputMode="numeric"
      className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-1.5 text-sm text-slate-800 focus:border-rose-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-700/20 transition-all"
    />
  )
}

function StatusBadge({ status }) {
  const s = foldText(status)
  if (s.includes("da thanh toan")) {
    return (
      <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
        Đã thanh toán
      </span>
    )
  }
  if (s.includes("tra mot phan") || s.includes("tra 1 phan")) {
    return (
      <span className="inline-flex rounded-full bg-violet-100 px-2.5 py-1 text-xs font-semibold text-violet-700">
        Trả một phần
      </span>
    )
  }
  return (
    <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
      Nợ
    </span>
  )
}

function StatusSelect({ value, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const options = ["Đã thanh toán", "Trả một phần", "Nợ"]
  const current = options.find((x) => foldText(x) === foldText(value)) || options[0]

  useEffect(() => {
    const onDocClick = (e) => {
      if (!ref.current) return
      if (!ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener("mousedown", onDocClick)
    document.addEventListener("touchstart", onDocClick)
    return () => {
      document.removeEventListener("mousedown", onDocClick)
      document.removeEventListener("touchstart", onDocClick)
    }
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50/60 px-3 pr-10 text-left text-sm text-slate-800 focus:border-rose-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-700/20 transition-all"
      >
        {current}
        <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}>▾</span>
      </button>
      {open && (
        <div className="absolute z-30 mt-1.5 w-full rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
          {options.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => {
                onChange(opt)
                setOpen(false)
              }}
              className={`block w-full rounded-lg px-3 py-2 text-left text-sm ${
                foldText(opt) === foldText(current)
                  ? "bg-rose-50 text-rose-700 font-semibold"
                  : "text-slate-700 hover:bg-rose-50"
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function EditDebtModal({ row, saving, deleting, settling, onClose, onSave, onDelete, onSettle }) {
  const [form, setForm] = useState(() => ({
    maPhieuOriginal: row.maPhieu,
    tenKhach: row.tenKhach || "",
    soDienThoai: String(row.soDienThoai || ""),
    maPhieu: row.maPhieu || "",
    ngayBan: toIsoDate(row.ngayBan),
    tienNo: toNum(row.tienNo),
    trangThai: String(row.trangThai || "Nợ"),
    ghiChu: String(row.ghiChu || "-"),
  }))

  return (
    <div className="fixed inset-0 z-[9800] bg-slate-900/45 p-3 md:p-6" onClick={onClose}>
      <div
        className="mx-auto max-w-2xl rounded-2xl bg-white shadow-2xl border border-slate-200 max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-slate-200 px-4 py-3 md:px-5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-base md:text-lg font-bold text-slate-900">Sửa công nợ khách hàng</h3>
            <button type="button" onClick={onClose} className="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100">
              Đóng
            </button>
          </div>
        </div>

        <div className="p-4 md:p-5 space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Tên khách hàng</label>
              <input
                value={form.tenKhach}
                onChange={(e) => setForm((p) => ({ ...p, tenKhach: e.target.value }))}
                placeholder="Tên khách hàng"
                className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-1.5 text-sm text-slate-800 focus:border-rose-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-700/20 transition-all"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Số điện thoại</label>
              <input
                value={form.soDienThoai}
                onChange={(e) => setForm((p) => ({ ...p, soDienThoai: e.target.value }))}
                placeholder="Số điện thoại"
                className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-1.5 text-sm text-slate-800 focus:border-rose-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-700/20 transition-all"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Mã phiếu</label>
              <input
                value={form.maPhieu}
                onChange={(e) => setForm((p) => ({ ...p, maPhieu: e.target.value }))}
                placeholder="Mã phiếu"
                className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-1.5 text-sm text-slate-800 focus:border-rose-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-700/20 transition-all"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Ngày bán</label>
              <input
                type="date"
                value={form.ngayBan}
                onChange={(e) => setForm((p) => ({ ...p, ngayBan: e.target.value }))}
                className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50/60 px-3 pr-10 py-1.5 text-sm text-slate-800 focus:border-rose-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-700/20 transition-all"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Tiền nợ</label>
              <MoneyInput value={form.tienNo} onChange={(v) => setForm((p) => ({ ...p, tienNo: v }))} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Trạng thái</label>
              <StatusSelect
                value={form.trangThai}
                onChange={(next) =>
                  setForm((p) => ({ ...p, trangThai: next, tienNo: foldText(next).includes("da thanh toan") ? 0 : p.tienNo }))
                }
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Ghi chú</label>
            <textarea
              rows={3}
              value={form.ghiChu}
              onChange={(e) => setForm((p) => ({ ...p, ghiChu: e.target.value }))}
              placeholder="Ghi chú"
              className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2 text-sm text-slate-800 resize-none focus:border-rose-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-700/20 transition-all"
            />
          </div>
        </div>

        <div className="sticky bottom-0 bg-white border-t border-slate-200 p-4 flex gap-2">
          <button
            type="button"
            disabled={saving || deleting || settling}
            onClick={onDelete}
            className="rounded-xl border border-rose-200 px-4 py-2.5 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60"
          >
            {deleting ? "Đang xóa..." : "Xóa"}
          </button>
          <button
            type="button"
            disabled={saving || deleting || settling || foldText(form.trangThai).includes("da thanh toan")}
            onClick={() => onSettle(form)}
            className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700 disabled:opacity-60"
          >
            {settling ? "Đang thu..." : "Thu công nợ"}
          </button>
          <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-700">
            Hủy
          </button>
          <button
            type="button"
            disabled={saving || deleting || settling}
            onClick={() => onSave(form)}
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

export default function DebtPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [settlingKey, setSettlingKey] = useState("")
  const [rows, setRows] = useState([])
  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("ALL")
  const [editing, setEditing] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)

  const loadDebts = async () => {
    setLoading(true)
    try {
      const res = await getDebtCustomers()
      if (res?.success && Array.isArray(res.data)) {
        setRows(res.data.filter((r) => !isGuestCustomer(r.tenKhach)))
      } else {
        setRows([])
        if (res?.message) toast.error(res.message)
      }
    } catch (e) {
      setRows([])
      toast.error("Không tải được dữ liệu công nợ")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDebts()
  }, [])

  const filteredRows = useMemo(() => {
    const q = foldText(query)
    return rows.filter((r) => {
      if (isGuestCustomer(r.tenKhach)) return false
      if (statusFilter !== "ALL" && foldText(r.trangThai) !== foldText(statusFilter)) return false
      if (!q) return true
      const text = `${r.tenKhach} ${r.soDienThoai} ${r.maPhieu} ${r.ngayBan} ${r.ghiChu}`
      return foldText(text).includes(q)
    })
  }, [rows, query, statusFilter])

  const totalDebt = useMemo(
    () => filteredRows.reduce((sum, r) => sum + Math.max(toNum(r.tienNo), 0), 0),
    [filteredRows],
  )

  const debtCustomerCount = useMemo(() => {
    const seen = new Set()
    for (let i = 0; i < filteredRows.length; i++) {
      const r = filteredRows[i]
      if (toNum(r.tienNo) <= 0) continue
      const key = `${foldText(r.tenKhach)}||${String(r.soDienThoai || "").replace(/[^\d]/g, "")}`
      seen.add(key)
    }
    return seen.size
  }, [filteredRows])

  const canSettleRow = (r) => {
    const key = foldText(r.trangThai)
    return key.includes("no") || key.includes("tra mot phan") || toNum(r.tienNo) > 0
  }

  const handleSave = async (form) => {
    const maPhieu = String(form.maPhieu || "").trim()
    if (!maPhieu) return toast.error("Mã phiếu không được để trống")
    const tenKhach = String(form.tenKhach || "").trim()
    if (!tenKhach) return toast.error("Tên khách không được để trống")

    setSaving(true)
    try {
      const res = await updateDebtCustomer({
        maPhieuOriginal: form.maPhieuOriginal,
        tenKhach,
        soDienThoai: String(form.soDienThoai || "").trim(),
        maPhieu,
        ngayBan: form.ngayBan || "",
        tienNo: Math.max(toNum(form.tienNo), 0),
        trangThai: form.trangThai,
        ghiChu: String(form.ghiChu || "-").trim() || "-",
      })
      if (!res?.success) {
        toast.error(res?.message || "Cập nhật công nợ thất bại")
        return
      }
      toast.success(res.message || "Cập nhật công nợ thành công")
      setEditing(null)
      await loadDebts()
    } catch (e) {
      toast.error("Cập nhật công nợ thất bại")
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteRequest = () => {
    if (!editing?.maPhieu) return
    setDeleteTarget(editing)
  }

  const confirmDeleteOrder = async () => {
    const key = String(deleteTarget?.maPhieu || "").trim()
    if (!key) return
    setDeleting(true)
    try {
      const res = await deleteOrder(key)
      if (res?.success) {
        toast.success(res.message || "Đã xóa hóa đơn")
        setDeleteTarget(null)
        setEditing(null)
        await loadDebts()
      } else {
        toast.error(res?.message || "Xóa thất bại")
      }
    } catch (e) {
      toast.error("Xóa thất bại")
    } finally {
      setDeleting(false)
    }
  }

  const handleQuickSettle = async (target) => {
    const maPhieuKey = String(target?.maPhieuOriginal || target?.maPhieu || "").trim()
    if (!maPhieuKey) return toast.error("Thiếu mã phiếu")
    setSettlingKey(maPhieuKey)
    try {
      const res = await updateDebtCustomer({
        maPhieuOriginal: maPhieuKey,
        tenKhach: String(target.tenKhach || "").trim(),
        soDienThoai: String(target.soDienThoai || "").trim(),
        maPhieu: String(target.maPhieu || maPhieuKey).trim() || maPhieuKey,
        ngayBan: target.ngayBan || "",
        tienNo: 0,
        trangThai: "Đã thanh toán",
        ghiChu: String(target.ghiChu || "-").trim() || "-",
      })
      if (res?.success) {
        toast.success(res.message || "Đã thu công nợ thành công")
        if (editing && String(editing.maPhieu || "").trim() === maPhieuKey) setEditing(null)
        await loadDebts()
      } else {
        toast.error(res?.message || "Thu công nợ thất bại")
      }
    } catch (e) {
      toast.error("Thu công nợ thất bại")
    } finally {
      setSettlingKey("")
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-50 to-rose-50/30">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-6 md:py-8 pb-24">
        <div className="mb-6 md:mb-8">
          <h1 className="text-3xl md:text-4xl font-black text-slate-900 leading-tight">Quản lý công nợ</h1>
          <p className="mt-2 text-sm md:text-base text-slate-500">Theo dõi tiền nợ và chỉnh sửa thông tin khách hàng trực tiếp.</p>
        </div>

        <section className="grid gap-3 md:grid-cols-2 mb-4">
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tổng khách/đơn</p>
            <p className="mt-1 text-2xl font-black text-slate-900">{filteredRows.length}</p>
            <p className="mt-1 text-xs font-semibold text-rose-700">Số khách nợ: {debtCustomerCount}</p>
          </div>
          <div className="rounded-2xl border border-rose-200 bg-rose-50/50 px-4 py-3 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-rose-700">Tổng tiền nợ</p>
            <p className="mt-1 text-2xl font-black text-rose-700">{fmt(totalDebt)}</p>
            {statusFilter !== "ALL" && (
              <p className="mt-1 text-xs font-semibold text-rose-700">Trạng thái: {statusFilter}</p>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5 shadow-sm mb-4">
          <div className="grid gap-2 md:grid-cols-[1fr,220px,120px]">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm theo khách, số điện thoại, mã phiếu..."
              className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-1.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-rose-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-700/20 transition-all"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-1.5 text-sm text-slate-800 focus:border-rose-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-700/20 transition-all"
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="Đã thanh toán">Đã thanh toán</option>
              <option value="Trả một phần">Trả một phần</option>
              <option value="Nợ">Nợ</option>
            </select>
            <button
              type="button"
              onClick={loadDebts}
              className="h-11 rounded-xl bg-gradient-to-r from-rose-700 to-rose-500 px-3 text-sm font-semibold text-white hover:shadow-lg hover:shadow-rose-700/25"
            >
              Làm mới
            </button>
          </div>
        </section>

        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-500">Đang tải dữ liệu công nợ...</div>
        ) : filteredRows.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-500">Không có dữ liệu phù hợp.</div>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full min-w-[920px] text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide">Khách hàng</th>
                    <th className="px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide">SĐT</th>
                    <th className="px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide">Ngày bán</th>
                    <th className="px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide">Mã phiếu</th>
                    <th className="px-3 py-2.5 text-right text-xs font-bold uppercase tracking-wide">Tiền nợ</th>
                    <th className="px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide">Trạng thái</th>
                    <th className="px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide">Ghi chú</th>
                    <th className="px-3 py-2.5 text-right text-xs font-bold uppercase tracking-wide">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((r, idx) => (
                    <tr key={`${r.maPhieu}-${idx}`} className="border-t border-slate-100">
                      <td className="px-3 py-2 text-slate-800 font-semibold">{r.tenKhach || "-"}</td>
                      <td className="px-3 py-2 text-slate-600">{r.soDienThoai || "-"}</td>
                      <td className="px-3 py-2 text-slate-600">{r.ngayBan || "-"}</td>
                      <td className="px-3 py-2 text-slate-800 font-semibold">{r.maPhieu || "-"}</td>
                      <td className="px-3 py-2 text-right font-bold text-rose-700">{fmt(r.tienNo || 0)}</td>
                      <td className="px-3 py-2">
                        <StatusBadge status={r.trangThai} />
                      </td>
                      <td className="px-3 py-2 text-slate-600">{r.ghiChu || "-"}</td>
                      <td className="px-3 py-2 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleQuickSettle(r)}
                            disabled={!canSettleRow(r) || settlingKey === String(r.maPhieu || "").trim()}
                            className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 disabled:opacity-50"
                          >
                            {settlingKey === String(r.maPhieu || "").trim() ? "Đang thu..." : "Thu nợ"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditing(r)}
                            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            Sửa
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="md:hidden divide-y divide-slate-100">
              {filteredRows.map((r, idx) => (
                <article key={`${r.maPhieu}-m-${idx}`} className="p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-bold text-slate-900">{r.tenKhach || "-"}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {r.maPhieu || "-"} | {r.ngayBan || "-"}
                      </p>
                    </div>
                    <StatusBadge status={r.trangThai} />
                  </div>
                  <p className="text-xs text-slate-500 mt-2">SĐT: {r.soDienThoai || "-"}</p>
                  <p className="text-sm font-bold text-rose-700 mt-1">Nợ: {fmt(r.tienNo || 0)}</p>
                  <p className="text-xs text-slate-600 mt-1">Ghi chú: {r.ghiChu || "-"}</p>
                  <div className="mt-2 flex justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleQuickSettle(r)}
                      disabled={!canSettleRow(r) || settlingKey === String(r.maPhieu || "").trim()}
                      className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 disabled:opacity-50"
                    >
                      {settlingKey === String(r.maPhieu || "").trim() ? "Đang thu..." : "Thu nợ"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditing(r)}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Sửa
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}
      </div>

      {editing && (
        <EditDebtModal
          row={editing}
          saving={saving}
          deleting={deleting}
          settling={settlingKey === String(editing?.maPhieu || "").trim()}
          onClose={() => (saving || deleting ? null : setEditing(null))}
          onSave={handleSave}
          onDelete={handleDeleteRequest}
          onSettle={handleQuickSettle}
        />
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-[9900] bg-slate-900/45 p-4" onClick={() => (deleting ? null : setDeleteTarget(null))}>
          <div className="mx-auto mt-[18vh] w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-bold text-slate-900">Xác nhận xóa hóa đơn</h3>
            <p className="mt-2 text-sm text-slate-600">
              Bạn sắp xóa hóa đơn <span className="font-semibold text-slate-900">{deleteTarget.maPhieu}</span>. Thao tác này sẽ cập nhật cả
              `DON_HANG` và `KHACH`.
            </p>
            <p className="mt-1 text-xs text-rose-600">Hành động này không thể hoàn tác.</p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                disabled={Boolean(deleting)}
                onClick={() => setDeleteTarget(null)}
                className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 disabled:opacity-60"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={Boolean(deleting)}
                onClick={confirmDeleteOrder}
                className="flex-1 rounded-xl bg-gradient-to-r from-rose-700 to-rose-500 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              >
                {deleting ? "Đang xóa..." : "Xóa hóa đơn"}
              </button>
            </div>
          </div>
        </div>
      )}

    </main>
  )
}
