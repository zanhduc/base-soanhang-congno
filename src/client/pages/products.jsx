import { useEffect, useMemo, useState } from "react"
import toast from "react-hot-toast"
import {
  createProductCatalogItem,
  deleteProductCatalogItem,
  getProductCatalog,
  updateProductCatalogItem,
} from "../api"

const toNum = (v) => Number(String(v ?? "").replace(/[^\d.-]/g, "")) || 0
const fmt = (n) => Number(n || 0).toLocaleString("vi-VN")

const foldText = (v) =>
  String(v || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .trim()

function MoneyInput({ value, onChange, placeholder, className = "" }) {
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
      placeholder={placeholder}
      className={`w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 pt-2 pb-1.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-rose-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-700/20 transition-all ${className}`}
    />
  )
}

function LabeledMoneyInput({ label, tone = "rose", value, onChange, placeholder }) {
  const toneCls =
    tone === "emerald"
      ? "border-emerald-200 bg-emerald-50/60 text-emerald-800"
      : "border-rose-200 bg-rose-50/60 text-rose-800"
  return (
    <div className={`h-11 rounded-xl border px-2.5 py-1.5 ${toneCls} grid grid-cols-[auto,1fr] items-stretch gap-2`}>
      <span className="inline-flex self-center pt-0.5 min-w-[56px] items-center justify-start text-[11px] font-bold uppercase tracking-wide leading-none whitespace-nowrap">
        {label}
      </span>
      <MoneyInput
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="h-full py-0.5 leading-none bg-white"
      />
    </div>
  )
}

const toViewRow = (p, idx) => ({
  id: `sp-${idx}-${Date.now()}`,
  isNew: false,
  originalTenSanPham: String(p.tenSanPham || ""),
  originalDonVi: String(p.donVi || ""),
  tenSanPham: String(p.tenSanPham || ""),
  donVi: String(p.donVi || ""),
  donGiaBan: toNum(p.donGiaBan),
  giaVon: toNum(p.giaVon),
})

export default function ProductsPage() {
  const [loading, setLoading] = useState(true)
  const [savingKey, setSavingKey] = useState("")
  const [deletingKey, setDeletingKey] = useState("")
  const [query, setQuery] = useState("")
  const [openId, setOpenId] = useState("")
  const [rows, setRows] = useState([])
  const [deleteTarget, setDeleteTarget] = useState(null)

  const loadProducts = async () => {
    setLoading(true)
    try {
      const res = await getProductCatalog()
      if (res?.success && Array.isArray(res.data)) {
        setRows(res.data.map((p, idx) => toViewRow(p, idx)))
      } else {
        setRows([])
        if (res?.message) toast.error(res.message)
      }
    } catch (e) {
      setRows([])
      toast.error("Không tải được danh sách sản phẩm")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadProducts()
  }, [])

  const filteredRows = useMemo(() => {
    const q = foldText(query)
    if (!q) return rows
    return rows.filter((r) => foldText(`${r.tenSanPham} ${r.donVi}`).includes(q))
  }, [rows, query])

  const patchRow = (id, patch) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }

  const addProductDraft = () => {
    const id = `new-${Date.now()}`
    setRows((prev) => [
      {
        id,
        isNew: true,
        originalTenSanPham: "",
        originalDonVi: "",
        tenSanPham: "",
        donVi: "",
        donGiaBan: 0,
        giaVon: 0,
      },
      ...prev,
    ])
    setOpenId(id)
  }

  const removeDraft = (id) => {
    setRows((prev) => prev.filter((r) => r.id !== id))
    if (openId === id) setOpenId("")
  }

  const validateRow = (row) => {
    const tenSanPham = String(row.tenSanPham || "").trim()
    const donVi = String(row.donVi || "").trim()
    const donGiaBan = Math.max(toNum(row.donGiaBan), 0)
    const giaVon = Math.max(toNum(row.giaVon), 0)

    if (!tenSanPham) return { ok: false, message: "Tên sản phẩm không được để trống" }
    if (!donVi) return { ok: false, message: "Đơn vị không được để trống" }
    if (donGiaBan <= 0) return { ok: false, message: "Đơn giá bán phải lớn hơn 0" }
    return { ok: true, data: { tenSanPham, donVi, donGiaBan, giaVon } }
  }

  const handleSaveRow = async (row) => {
    const validated = validateRow(row)
    if (!validated.ok) return toast.error(validated.message)
    const data = validated.data

    setSavingKey(row.id)
    try {
      let res
      if (row.isNew) {
        res = await createProductCatalogItem(data)
      } else {
        res = await updateProductCatalogItem({
          originalTenSanPham: row.originalTenSanPham,
          originalDonVi: row.originalDonVi,
          ...data,
        })
      }

      if (!res?.success) {
        toast.error(res?.message || "Lưu sản phẩm thất bại")
        return
      }

      toast.success(res.message || "Đã lưu sản phẩm")
      await loadProducts()
      setOpenId("")
    } catch (e) {
      toast.error("Lưu sản phẩm thất bại")
    } finally {
      setSavingKey("")
    }
  }

  const handleDeleteRow = (row) => {
    if (row.isNew) {
      removeDraft(row.id)
      return
    }
    setDeleteTarget(row)
  }

  const confirmDeleteRow = async () => {
    const row = deleteTarget
    if (!row) return
    setDeletingKey(row.id)
    try {
      const res = await deleteProductCatalogItem({
        tenSanPham: row.originalTenSanPham || row.tenSanPham,
        donVi: row.originalDonVi || row.donVi,
      })
      if (!res?.success) {
        toast.error(res?.message || "Xóa sản phẩm thất bại")
        return
      }
      toast.success(res.message || "Đã xóa sản phẩm")
      await loadProducts()
      setOpenId("")
      setDeleteTarget(null)
    } catch (e) {
      toast.error("Xóa sản phẩm thất bại")
    } finally {
      setDeletingKey("")
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-50 to-rose-50/30">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-6 md:py-8 pb-24">
        <div className="mb-6 md:mb-8">
          <h1 className="text-3xl md:text-4xl font-black text-slate-900 leading-tight">Danh sách sản phẩm</h1>
          <p className="mt-2 text-sm md:text-base text-slate-500">
            Bấm vào icon bên phải để mở chi tiết, lưu hoặc xóa sản phẩm.
          </p>
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5 shadow-sm mb-4">
          <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-3">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm theo tên sản phẩm hoặc đơn vị..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-rose-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-700/20 transition-all"
            />
            <button
              type="button"
              onClick={addProductDraft}
              className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700 hover:bg-rose-100 whitespace-nowrap md:min-w-[170px]"
            >
              + Thêm sản phẩm
            </button>
            <button
              type="button"
              onClick={loadProducts}
              className="rounded-xl bg-gradient-to-r from-rose-700 to-rose-500 px-4 py-2.5 text-sm font-semibold text-white hover:shadow-lg hover:shadow-rose-700/25 whitespace-nowrap md:min-w-[120px]"
            >
              Tải lại
            </button>
          </div>
        </section>

        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-500">
            Đang tải danh sách sản phẩm...
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-500">
            Không có sản phẩm phù hợp.
          </div>
        ) : (
          <div className="space-y-2">
            {filteredRows.map((row) => {
              const open = openId === row.id
              return (
                <article
                  key={row.id}
                  className={`rounded-2xl border bg-white shadow-sm overflow-hidden transition-colors ${
                    open ? "border-rose-200" : "border-slate-200"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setOpenId(open ? "" : row.id)}
                    className={`w-full flex items-center gap-3 px-4 py-2 transition-colors ${
                      open ? "bg-rose-50/60 hover:bg-rose-50" : "hover:bg-slate-50"
                    }`}
                  >
                    <span className={`h-6 w-1.5 rounded-full ${open ? "bg-rose-300" : "bg-rose-100"}`} />
                    <div className="min-w-0 flex-1 text-left">
                      <p className="text-sm md:text-base font-bold text-slate-900 truncate">
                        {row.tenSanPham || "Sản phẩm mới"}
                      </p>
                      <p className="text-xs text-slate-500 truncate leading-tight">{row.donVi || "-"}</p>
                    </div>
                    <span
                      className={`inline-flex h-7 w-7 items-center justify-center rounded-full border transition-all duration-300 ease-out ${
                        open
                          ? "border-rose-300 bg-rose-100 text-rose-700 -rotate-180"
                          : "border-slate-200 bg-white text-slate-500 rotate-0"
                      }`}
                      aria-hidden="true"
                    >
                      <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                        <path
                          fillRule="evenodd"
                          d="M5.23 7.21a.75.75 0 011.06.02L10 11.18l3.71-3.95a.75.75 0 111.1 1.02l-4.25 4.52a.75.75 0 01-1.1 0L5.21 8.25a.75.75 0 01.02-1.04z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </span>
                  </button>

                  {open && (
                    <div className="border-t border-rose-100 bg-rose-50/30 p-4 space-y-3">
                      <div className="grid gap-2 md:gap-3 md:grid-cols-2 lg:grid-cols-4">
                        <input
                          value={row.tenSanPham}
                          onChange={(e) => patchRow(row.id, { tenSanPham: e.target.value })}
                          placeholder="Tên sản phẩm"
                          className="w-full h-11 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-700/20 transition-all"
                        />
                        <input
                          value={row.donVi}
                          onChange={(e) => patchRow(row.id, { donVi: e.target.value })}
                          placeholder="Đơn vị"
                          className="w-full h-11 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-700/20 transition-all"
                        />
                        <LabeledMoneyInput
                          label="Giá bán"
                          tone="emerald"
                          value={row.donGiaBan}
                          onChange={(v) => patchRow(row.id, { donGiaBan: v })}
                          placeholder="Đơn giá bán"
                        />
                        <LabeledMoneyInput
                          label="Giá vốn"
                          tone="rose"
                          value={row.giaVon}
                          onChange={(v) => patchRow(row.id, { giaVon: v })}
                          placeholder="Giá vốn"
                        />
                      </div>

                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleDeleteRow(row)}
                          disabled={deletingKey === row.id || savingKey === row.id}
                          className="rounded-xl border border-rose-200 bg-white px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60"
                        >
                          {deletingKey === row.id ? "Đang xóa..." : "Xóa"}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSaveRow(row)}
                          disabled={savingKey === row.id || deletingKey === row.id}
                          className={`rounded-xl px-4 py-2 text-sm font-semibold text-white ${
                            savingKey === row.id
                              ? "bg-slate-400"
                              : "bg-gradient-to-r from-rose-700 to-rose-500 hover:shadow-lg hover:shadow-rose-700/25"
                          }`}
                        >
                          {savingKey === row.id ? "Đang lưu..." : "Lưu sản phẩm"}
                        </button>
                      </div>
                    </div>
                  )}
                </article>
              )
            })}
          </div>
        )}
      </div>

      {deleteTarget && (
        <div
          className="fixed inset-0 z-[9900] bg-slate-900/45 p-4"
          onClick={() => (deletingKey ? null : setDeleteTarget(null))}
        >
          <div
            className="mx-auto mt-[18vh] w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-slate-900">Xác nhận xóa sản phẩm</h3>
            <p className="mt-2 text-sm text-slate-600">
              Bạn sắp xóa sản phẩm{" "}
              <span className="font-semibold text-slate-900">
                {deleteTarget.tenSanPham} ({deleteTarget.donVi || "-"})
              </span>
              .
            </p>
            <p className="mt-1 text-xs text-rose-600">Hành động này không thể hoàn tác.</p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                disabled={Boolean(deletingKey)}
                onClick={() => setDeleteTarget(null)}
                className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 disabled:opacity-60"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={Boolean(deletingKey)}
                onClick={confirmDeleteRow}
                className="flex-1 rounded-xl bg-gradient-to-r from-rose-700 to-rose-500 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              >
                {deletingKey ? "Đang xóa..." : "Xóa sản phẩm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
