import { useEffect, useMemo, useState } from "react"
import toast from "react-hot-toast"
import { getInventory } from "../api"

const foldText = (v) =>
  String(v || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .trim()

const fmt = (n) => Number(n || 0).toLocaleString("vi-VN")

export default function StockPage() {
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState("")
  const [rows, setRows] = useState([])

  const loadInventory = async () => {
    setLoading(true)
    try {
      const res = await getInventory()
      if (res?.success && Array.isArray(res.data)) {
        setRows(res.data)
      } else {
        setRows([])
        if (res?.message) toast.error(res.message)
      }
    } catch (e) {
      setRows([])
      toast.error("Không tải được danh sách tồn kho")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadInventory()
  }, [])

  const filteredRows = useMemo(() => {
    const q = foldText(query)
    if (!q) return rows
    return rows.filter((r) =>
      foldText(`${r.tenSanPham} ${r.nhomHang} ${r.donVi}`).includes(q),
    )
  }, [rows, query])

  const totalStockAmount = useMemo(() => {
    return filteredRows.reduce((sum, item) => sum + (Number(item.giaVon || 0) * Number(item.tonKho || 0)), 0)
  }, [filteredRows])

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-50 to-rose-50/30">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-6 md:py-8 pb-24">
        <div className="mb-6 md:mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-black text-slate-900 leading-tight">Quản lý tồn kho</h1>
            <p className="mt-2 text-sm md:text-base text-slate-500">
              Xem số lượng và giá trị hàng hóa hiện còn trong kho.
            </p>
          </div>
          <div className="rounded-2xl border border-rose-200 bg-white px-5 py-4 shadow-sm text-right">
            <p className="text-sm font-semibold text-rose-700 uppercase tracking-wider mb-1">
              Tổng giá trị tồn
            </p>
            <p className="text-2xl md:text-3xl font-black text-slate-900 leading-none">
              {fmt(totalStockAmount)}
            </p>
          </div>
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
              onClick={loadInventory}
              className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700 hover:bg-rose-100 whitespace-nowrap md:min-w-[120px]"
            >
              Tải lại
            </button>
          </div>
        </section>

        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-500 shadow-sm">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-rose-600 border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]" role="status"></div>
            <p className="mt-4 font-medium">Đang tải danh sách tồn kho...</p>
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-500 shadow-sm">
            Không có sản phẩm phù hợp.
          </div>
        ) : (
          <>
            {/* Giao diện Mobile (Card list) */}
            <div className="space-y-3 md:hidden">
              {filteredRows.map((row, index) => {
                const tonKho = Number(row.tonKho || 0)
                const isLowStock = tonKho <= 0
                return (
                  <div key={`mobile-${row.tenSanPham}-${row.donVi}`} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm flex items-center justify-between gap-3 relative overflow-hidden">
                    {/* Thanh màu bên trái để nhấn mạnh trạng thái tồn kho */}
                    <div className={`absolute left-0 top-0 bottom-0 w-1 ${isLowStock ? 'bg-rose-500' : 'bg-emerald-500'}`} />
                    
                    <div className="flex-1 min-w-0 pl-1">
                      <div className="flex items-start gap-2 mb-1.5">
                        <span className="inline-flex mt-0.5 shrink-0 items-center justify-center w-5 h-5 rounded bg-slate-100 text-[10px] font-bold text-slate-500">
                          {index + 1}
                        </span>
                        <p className="font-bold text-slate-800 text-sm leading-snug">{row.tenSanPham}</p>
                      </div>
                      <p className="text-xs text-slate-500 truncate ml-7">
                        {row.nhomHang ? `${row.nhomHang} • ` : ""}{row.donVi}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1 ml-7">
                        <span className="font-medium">Giá vốn:</span> {fmt(row.giaVon)}
                      </p>
                    </div>
                    <div className="text-right shrink-0 pl-2">
                      <p className="text-[10px] items-center gap-1 justify-end font-bold text-slate-400 mb-0.5">TỒN KHO</p>
                      <span className={`inline-block font-black text-xl leading-none ${isLowStock ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {fmt(tonKho)}
                      </span>
                      <div className="mt-1.5 pt-1.5 border-t border-slate-100">
                        <p className="text-[10px] text-slate-400 font-medium">Giá trị</p>
                        <p className="text-xs text-slate-700 font-bold mt-0.5">
                          {fmt(tonKho * Number(row.giaVon || 0))}đ
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Giao diện PC (Table) */}
            <div className="hidden md:block rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600">
                  <thead className="bg-slate-50/80 text-xs uppercase text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3 font-semibold w-12 text-center">STT</th>
                      <th className="px-4 py-3 font-semibold">Sản phẩm</th>
                      <th className="px-4 py-3 font-semibold w-32">Đơn vị</th>
                      <th className="px-4 py-3 font-semibold text-right w-32">Tồn kho</th>
                      <th className="px-4 py-3 font-semibold text-right w-36">Giá vốn</th>
                      <th className="px-4 py-3 font-semibold text-right w-40">Giá trị</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredRows.map((row, index) => {
                      const tonKho = Number(row.tonKho || 0)
                      const isLowStock = tonKho <= 0
                      
                      return (
                        <tr key={`${row.tenSanPham}-${row.donVi}`} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3 text-center text-slate-400">{index + 1}</td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <p className="font-bold text-slate-800">{row.tenSanPham}</p>
                            {row.nhomHang && <p className="text-xs text-slate-500 mt-0.5">{row.nhomHang}</p>}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-500/10">
                              {row.donVi}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            <span className={`inline-flex font-bold text-base ${isLowStock ? 'text-rose-600' : 'text-emerald-600'}`}>
                              {fmt(tonKho)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            {fmt(row.giaVon)}
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap font-bold text-slate-800">
                            {fmt(tonKho * Number(row.giaVon || 0))}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  )
}
