import { useEffect, useState } from "react"
import {
  createOrder,
  getCustomerCatalog,
  getNextOrderFormDefaults,
  getProductCatalog,
} from "../api"
import toast from "react-hot-toast"

const fmt = (n) => Number(n).toLocaleString()
const foldText = (v) =>
  String(v || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")

const toTitleCase = (v) =>
  String(v || "")
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .map((word) => {
      if (!word) return word
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    })
    .join(" ")

const getTodayInputDate = () => {
  const now = new Date()
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
  return local.toISOString().split("T")[0]
}

const DEFAULT_ORDER_CODE = "01"
const ORDER_DEFAULTS_CACHE_KEY = "soanhang.orderDefaults"

const readCachedOrderDefaults = () => {
  try {
    const raw = sessionStorage.getItem(ORDER_DEFAULTS_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    const maPhieu = String(parsed?.maPhieu || "").trim()
    const ngayBan = String(parsed?.ngayBan || "").trim()
    if (!maPhieu || !ngayBan) return null
    return { maPhieu, ngayBan }
  } catch (e) {
    return null
  }
}

const writeCachedOrderDefaults = (defaults) => {
  try {
    if (!defaults?.maPhieu || !defaults?.ngayBan) return
    sessionStorage.setItem(
      ORDER_DEFAULTS_CACHE_KEY,
      JSON.stringify({
        maPhieu: String(defaults.maPhieu).trim(),
        ngayBan: String(defaults.ngayBan).trim(),
        updatedAt: Date.now(),
      }),
    )
  } catch (e) {
    // noop
  }
}

const createInitialOrderInfo = () => ({
  maPhieu: "",
  ngayBan: getTodayInputDate(),
  trangThai: "Đã thanh toán",
  trangThaiCode: "PAID",
  soTienDaTra: 0,
  ghiChu: "",
})

function CurrencyInput({ value, onChange, className }) {
  const [display, setDisplay] = useState(value ? fmt(value) : "")

  useEffect(() => {
    setDisplay(value ? fmt(value) : "")
  }, [value])

  const handleChange = (e) => {
    const el = e.target
    const cursorPos = el.selectionStart
    const oldLen = el.value.length

    // Chỉ giữ số
    const digits = e.target.value.replace(/[^0-9]/g, "")
    const num = parseInt(digits) || 0

    onChange(num)
    const formatted = num > 0 ? fmt(num) : digits
    setDisplay(formatted)

    // Fix cursor position sau khi format
    requestAnimationFrame(() => {
      const newLen = formatted.length
      const diff = newLen - oldLen
      const newPos = Math.max(0, cursorPos + diff)
      el.setSelectionRange(newPos, newPos)
    })
  }

  const handleBlur = () => {
    if (!value) setDisplay("")
    else setDisplay(fmt(value))
  }

  return (
    <div className="relative">
      <input
        type="text"
        inputMode="numeric"
        value={display}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder="0"
        className={className}
      />
      {value > 0 && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-medium pointer-events-none">đ</span>
      )}
    </div>
  )
}

function CustomerInfoSection({
  customerInfo,
  onUpdate,
  showCustomerSuggestions,
  onShowSuggestions,
  onHideSuggestions,
  customerSuggestions,
  onSelectCustomerSuggestion,
}) {
  const inputCls =
    "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-700/20 transition-all"

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-semibold text-slate-800 mb-2">Tên khách hàng</label>
        <div className="relative">
          <input
            type="text"
            placeholder="Nhập tên khách hàng"
            value={customerInfo.tenKhach}
            onFocus={onShowSuggestions}
            onBlur={() => setTimeout(onHideSuggestions, 120)}
            onChange={(e) => onUpdate({ ...customerInfo, tenKhach: e.target.value })}
            className={inputCls}
          />
          {showCustomerSuggestions && customerSuggestions.length > 0 && (
            <div className="absolute z-30 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-slate-200 bg-white shadow-lg">
              {customerSuggestions.map((c) => (
                <button
                  key={`${c.tenKhach}-${c.soDienThoai || ""}`}
                  type="button"
                  className="block w-full border-b border-slate-100 px-3 py-2 text-left last:border-b-0 hover:bg-rose-50"
                  onMouseDown={(ev) => ev.preventDefault()}
                  onClick={() => onSelectCustomerSuggestion(c)}
                >
                  <p className="text-sm font-semibold text-slate-800">{c.tenKhach}</p>
                  <p className="text-xs text-slate-500">{c.soDienThoai || "-"}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <div>
        <label className="block text-sm font-semibold text-slate-800 mb-2">Số điện thoại</label>
        <input type="tel" placeholder="Nhập số điện thoại" value={customerInfo.soDienThoai}
          onChange={(e) => onUpdate({ ...customerInfo, soDienThoai: e.target.value })} className={inputCls} />
      </div>
    </div>
  )
}

function OrderInfoSection({ orderInfo, onUpdate, isLoadingDefaults }) {
  const inputCls =
    "w-full min-w-0 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-700/20 transition-all"

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] gap-2 sm:gap-4">
        <div className="min-w-0">
          <label className="block text-sm font-semibold text-slate-800 mb-2">Mã phiếu</label>
          <input
            type="text"
            placeholder={isLoadingDefaults ? "Đang tạo mã phiếu..." : "Nhập mã phiếu"}
            value={orderInfo.maPhieu}
            onChange={(e) => onUpdate({ ...orderInfo, maPhieu: e.target.value })}
            className={`${inputCls} px-3 sm:px-4 text-[13px] sm:text-sm`}
            disabled={isLoadingDefaults}
          />
        </div>
        <div className="min-w-0">
          <label className="block text-sm font-semibold text-slate-800 mb-2">Ngày bán</label>
          <input
            type="date"
            value={orderInfo.ngayBan}
            onChange={(e) => onUpdate({ ...orderInfo, ngayBan: e.target.value })}
            className={`${inputCls} px-2 sm:px-4 text-[13px] sm:text-sm`}
            disabled={isLoadingDefaults}
          />
        </div>
      </div>
      {isLoadingDefaults && (
        <p className="text-xs text-slate-500">Đang lấy mã phiếu và ngày bán mới...</p>
      )}
      
      <div>
        <label className="block text-sm font-semibold text-slate-800 mb-2">Trạng thái thanh toán</label>
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
                 onUpdate({
                   ...orderInfo,
                   trangThai: st.label,
                   trangThaiCode: st.code,
                   soTienDaTra: st.code === "PARTIAL" ? orderInfo.soTienDaTra || 0 : 0,
                 })
               }
               className={`py-2 px-1 sm:px-3 text-[11px] sm:text-xs font-semibold rounded-xl transition-all border ${
                 (orderInfo.trangThaiCode || "PAID") === st.code
                 ? "bg-rose-700 border-rose-700 text-white shadow-md shadow-rose-700/20" 
                 : "bg-white border-slate-200 text-slate-600 hover:border-rose-300 hover:bg-rose-50"
               }`}
             >
               {st.label}
             </button>
          ))}
        </div>
      </div>

      {(orderInfo.trangThaiCode || "") === "PARTIAL" && (
        <div>
          <label className="block text-sm font-semibold text-slate-800 mb-2">Số tiền đã trả trước</label>
          <CurrencyInput
            value={orderInfo.soTienDaTra || 0}
            onChange={(v) => onUpdate({ ...orderInfo, soTienDaTra: v })}
            className={inputCls}
          />
          <p className="mt-1 text-xs text-slate-500">Không được lớn hơn tổng hóa đơn.</p>
        </div>
      )}

      <div>
        <label className="block text-sm font-semibold text-slate-800 mb-2">Ghi chú đơn hàng</label>
        <textarea placeholder="Thêm ghi chú cho đơn hàng..." value={orderInfo.ghiChu}
          onChange={(e) => onUpdate({ ...orderInfo, ghiChu: e.target.value })}
          className={`${inputCls} resize-none`} rows={2} />
      </div>
    </div>
  )
}

function ProductListItem({ product, onUpdate, onRemove }) {
  const thanhTien = product.soLuong * product.donGiaBan

  return (
    <div className="rounded-2xl border border-slate-200/50 bg-gradient-to-br from-white to-white/80 p-4 md:p-5 shadow-sm hover:shadow-md transition-all duration-300 hover:border-slate-200 group">
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1 min-w-0">
          <p className="font-bold text-slate-800 text-base md:text-lg truncate">{product.tenSanPham}</p>
          <p className="text-sm text-slate-500 mt-0.5">{product.donVi || "Không xác định"}</p>
        </div>
        <button type="button" onClick={onRemove}
          className="text-red-400 hover:text-red-500 hover:bg-red-50 p-2 rounded-lg transition-all ml-2 shrink-0 md:opacity-0 md:group-hover:opacity-100">
          x
        </button>
      </div>
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2 md:gap-3">
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Số lượng</label>
            <input type="number" min="0" value={product.soLuong}
              onChange={(e) => onUpdate({ soLuong: e.target.value === "" ? "" : parseInt(e.target.value) || 0 })}
              onBlur={(e) => {
                if (product.soLuong === "" || product.soLuong < 1) onUpdate({ soLuong: 1 })
              }}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 focus:border-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-700/20 transition-all" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Thành tiền</label>
            <div className="rounded-lg border border-rose-700/20 bg-gradient-to-br from-rose-50 to-rose-100/60 px-3 py-2 text-sm font-bold text-rose-700">
            {thanhTien.toLocaleString()}
            </div>  
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Đơn giá bán</label>
          <CurrencyInput value={product.donGiaBan}
            onChange={(v) => onUpdate({ donGiaBan: v })}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 focus:border-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-700/20 transition-all" />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Giá vốn</label>
          <CurrencyInput value={product.giaVon || 0}
            onChange={(v) => onUpdate({ giaVon: v })}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 focus:border-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-700/20 transition-all" />
        </div>
      </div>
    </div>
  )
}

function OrderSummary({ totalAmount, totalItems }) {
  return (
    <div className="rounded-2xl border border-rose-700/20 bg-gradient-to-br from-rose-50/50 via-white to-rose-100/30 p-5 md:p-6 shadow-sm">
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <span className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Tổng mặt hàng</span>
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-rose-700/10 text-rose-700 font-bold">
            {totalItems}
          </div>
        </div>
        <div className="h-px bg-gradient-to-r from-slate-200/0 via-slate-200/50 to-slate-200/0" />
        <div>
          <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">Tổng hóa đơn</p>
          <p className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-rose-700 to-rose-500 bg-clip-text text-transparent">
            {totalAmount.toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  )
}

/*  Main Page  */

export default function CreateOrderPage() {
  const [isCustomerMode, setIsCustomerMode] = useState(false)
  const [customerInfo, setCustomerInfo] = useState({
    tenKhach: "",
    soDienThoai: "",
  })

  const [orderInfo, setOrderInfo] = useState(() => {
    const initial = createInitialOrderInfo()
    const cached = readCachedOrderDefaults()
    if (!cached) return initial
    return {
      ...initial,
      maPhieu: cached.maPhieu,
      ngayBan: cached.ngayBan,
    }
  })

  const [products, setProducts] = useState([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoadingOrderDefaults, setIsLoadingOrderDefaults] = useState(!readCachedOrderDefaults())
  const [productCatalog, setProductCatalog] = useState([])
  const [customerCatalog, setCustomerCatalog] = useState([])
  const [showProductSuggestions, setShowProductSuggestions] = useState(false)
  const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false)
  const [newProduct, setNewProduct] = useState({
    id: "",
    tenSanPham: "",
    donVi: "",
    soLuong: 1,
    donGiaBan: 0,
    giaVon: 0,
  })
  const loadOrderDefaults = async ({ silent = false } = {}) => {
    const today = getTodayInputDate()
    if (!silent) setIsLoadingOrderDefaults(true)
    try {
      const res = await getNextOrderFormDefaults()
      const nextCode = String(res?.data?.maPhieu || "").trim() || DEFAULT_ORDER_CODE
      writeCachedOrderDefaults({
        maPhieu: nextCode,
        ngayBan: res?.data?.ngayBan || today,
      })
      setOrderInfo((prev) => ({
        ...prev,
        maPhieu: nextCode,
        ngayBan: res?.data?.ngayBan || today,
      }))
    } catch (err) {
      setOrderInfo((prev) => ({
        ...prev,
        maPhieu: prev.maPhieu || DEFAULT_ORDER_CODE,
        ngayBan: today,
      }))
    } finally {
      if (!silent) setIsLoadingOrderDefaults(false)
    }
  }

  const loadProductCatalog = async () => {
    try {
      const res = await getProductCatalog()
      if (res?.success && Array.isArray(res.data)) {
        setProductCatalog(res.data)
      } else {
        setProductCatalog([])
      }
    } catch (err) {
      setProductCatalog([])
    }
  }

  const loadCustomerCatalog = async () => {
    try {
      const res = await getCustomerCatalog()
      if (res?.success && Array.isArray(res.data)) {
        const cleaned = res.data.filter(
          (c) => foldText(c?.tenKhach) && foldText(c?.tenKhach) !== "khach ghe tham",
        )
        setCustomerCatalog(cleaned)
      } else {
        setCustomerCatalog([])
      }
    } catch (err) {
      setCustomerCatalog([])
    }
  }

  const getCatalogMatch = (name) => {
    const keyword = foldText(name)
    if (!keyword) return null
    return (
      productCatalog.find((p) => foldText(p.tenSanPham) === keyword) || null
    )
  }

  const getCatalogSuggestions = (query) => {
    const keyword = foldText(query)
    if (!keyword) return productCatalog.slice(0, 8)
    return productCatalog
      .filter((p) => foldText(p.tenSanPham).includes(keyword))
      .slice(0, 8)
  }

  const getCustomerSuggestions = (query) => {
    const keyword = foldText(query)
    if (!keyword) return customerCatalog.slice(0, 8)
    return customerCatalog
      .filter((c) => {
        const byName = foldText(c.tenKhach).includes(keyword)
        const byPhone = String(c.soDienThoai || "").includes(query.trim())
        return byName || byPhone
      })
      .slice(0, 8)
  }

  const applyMatchedProduct = (current, tenSanPham, matched) => {
    if (!matched) return { ...current, tenSanPham }
    return {
      ...current,
      tenSanPham: tenSanPham || matched.tenSanPham || "",
      donVi: matched.donVi || "",
      donGiaBan: Number(matched.donGiaBan || 0),
      giaVon: Number(matched.giaVon || 0),
    }
  }

  useEffect(() => {
    const cached = readCachedOrderDefaults()
    if (cached) {
      setOrderInfo((prev) => ({
        ...prev,
        maPhieu: cached.maPhieu,
        ngayBan: cached.ngayBan,
      }))
      loadOrderDefaults({ silent: true })
    } else {
      loadOrderDefaults()
    }
    loadProductCatalog()
    loadCustomerCatalog()
  }, [])

  const handleAddProduct = () => {
    const normalizedProduct = {
      ...newProduct,
      tenSanPham: toTitleCase(newProduct.tenSanPham),
      donVi: toTitleCase(newProduct.donVi),
    }
    if (normalizedProduct.tenSanPham && normalizedProduct.donGiaBan > 0) {
      setProducts([...products, { ...normalizedProduct, id: Date.now().toString() }])
      setNewProduct({ id: "", tenSanPham: "", donVi: "", soLuong: 1, donGiaBan: 0, giaVon: 0 })
    }
  }

  const handleRemoveProduct = (id) => {
    setProducts(products.filter((p) => p.id !== id))
  }

  const handleUpdateProduct = (id, updated) => {
    setProducts(products.map((p) => (p.id === id ? { ...p, ...updated } : p)))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (isLoadingOrderDefaults) return toast.error("Đang tải mã phiếu mới, vui lòng chờ...")
    if (products.length === 0) return toast.error("Vui lòng thêm ít nhất một mặt hàng")
    if (isCustomerMode && !customerInfo.tenKhach) return toast.error("Vui lòng nhập tên khách hàng")
    if ((orderInfo.trangThaiCode || "") === "PARTIAL") {
      const paid = Number(orderInfo.soTienDaTra || 0)
      if (paid <= 0) return toast.error("Vui lòng nhập số tiền đã trả trước")
      if (paid > totalAmount) return toast.error("Số tiền đã trả không được lớn hơn tổng đơn")
    }

    setIsSubmitting(true)
    try {
      const normalizedOrderInfo = {
        ...orderInfo,
        soTienDaTra: (orderInfo.trangThaiCode || "") === "PARTIAL" ? Number(orderInfo.soTienDaTra || 0) : 0,
      }
      const orderData = {
        customer: isCustomerMode ? customerInfo : null,
        orderInfo: normalizedOrderInfo,
        products,
      }

      const result = await createOrder(orderData)

      if (result.success) {
        toast.success(result.message || "Đơn hàng được tạo thành công!")
        // Reset form
        setProducts([])
        setCustomerInfo({ tenKhach: "", soDienThoai: "" })
        setOrderInfo(createInitialOrderInfo())
        await loadOrderDefaults()
        await loadProductCatalog()
        await loadCustomerCatalog()
        setIsCustomerMode(false)
      } else {
        toast.error(result.message || "Có lỗi xảy ra, vui lòng thử lại!")
      }
    } catch (err) {
      console.error("Submit error:", err)
      toast.error("Lỗi kết nối: " + err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const totalAmount = products.reduce((sum, p) => sum + p.soLuong * p.donGiaBan, 0)
  const totalItems = products.reduce((sum, p) => sum + p.soLuong, 0)

  const inputCls =
    "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-700/20 transition-all"
  const customerSuggestions = getCustomerSuggestions(customerInfo.tenKhach)

  return (
    <main className="min-h-screen pb-24 bg-gradient-to-br from-slate-50 via-slate-50 to-rose-50/30">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-6 md:py-8 pb-24">
        {/* Header */}
        <div className="mb-8 md:mb-10 animate-[fadeUp_0.4s_ease] max-w-3xl">
          <div className="inline-flex items-center gap-2 mb-4 md:mb-6">
            <div className="w-3 h-3 rounded-full bg-rose-700" />
            <span className="text-xs font-bold text-rose-700 uppercase tracking-widest">Soạn Đơn</span>
          </div>
          <div className="mb-4 md:mb-6">
            <h1 className="text-4xl md:text-5xl font-black text-slate-900 leading-[1.15] md:leading-[1.2] pb-1 md:pb-2">Soạn Đơn</h1>
            <h2 className="text-4xl md:text-5xl font-black bg-gradient-to-r from-rose-700 to-rose-500 bg-clip-text text-transparent leading-[1.15] md:leading-[1.2] pb-1">
              Hàng
            </h2>
          </div>
          <p className="text-sm md:text-base text-slate-500 max-w-md leading-relaxed font-medium">
            Soạn đơn hàng nhanh chóng, thêm sản phẩm, số lượng, giá bán và gửi đơn chỉ trong vài bước.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5 md:space-y-6 xl:grid xl:grid-cols-12 xl:gap-6 xl:space-y-0">
          <div className="xl:col-span-8 space-y-5 md:space-y-6">
          {/* Customer Info Toggle */}
          <div className="rounded-2xl border border-slate-200/50 bg-gradient-to-br from-white to-white/80 p-5 md:p-6 shadow-sm hover:shadow-md transition-all duration-300 hover:border-slate-200">
            <button type="button" onClick={() => setIsCustomerMode(!isCustomerMode)}
              className="flex w-full items-center justify-between text-slate-800 hover:text-rose-700 transition-colors group">
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full transition-colors duration-300 ${isCustomerMode ? "bg-rose-700" : "bg-slate-300"}`} />
                <span className="font-semibold text-base md:text-lg">
                  {isCustomerMode ? "Đã có thông tin khách hàng" : "Thông tin khách hàng (Tùy chọn)"}
                </span>
              </div>
              <span className={`text-lg transition-all ${isCustomerMode ? "rotate-180" : ""} group-hover:text-rose-700`}>▼</span>
            </button>

            {isCustomerMode && (
              <div className="mt-5 pt-5 border-t border-slate-200/50 animate-[fadeUp_0.3s_ease]">
                <CustomerInfoSection
                  customerInfo={customerInfo}
                  onUpdate={setCustomerInfo}
                  showCustomerSuggestions={showCustomerSuggestions}
                  onShowSuggestions={() => setShowCustomerSuggestions(true)}
                  onHideSuggestions={() => setShowCustomerSuggestions(false)}
                  customerSuggestions={customerSuggestions}
                  onSelectCustomerSuggestion={(c) => {
                    setCustomerInfo({
                      tenKhach: c.tenKhach || "",
                      soDienThoai: c.soDienThoai || "",
                    })
                    setShowCustomerSuggestions(false)
                  }}
                />
              </div>
            )}
          </div>

          {/* Order Info */}
          <div className="rounded-2xl border border-slate-200/50 bg-gradient-to-br from-white to-white/80 p-5 md:p-6 shadow-sm hover:shadow-md transition-all duration-300 hover:border-slate-200">
            <h3 className="font-bold text-base md:text-lg text-slate-800 mb-4">Thông tin đơn hàng</h3>
            <OrderInfoSection
              orderInfo={orderInfo}
              onUpdate={setOrderInfo}
              isLoadingDefaults={isLoadingOrderDefaults}
            />
          </div>

          {/* Add Product Form */}
          <div className="rounded-2xl border border-slate-200/50 bg-gradient-to-br from-white to-white/80 p-5 md:p-6 space-y-4 md:space-y-5 shadow-sm hover:shadow-md transition-all duration-300">
            <div>
              <h3 className="font-bold text-base md:text-lg text-slate-800 mb-0.5">Thêm vào đơn</h3>
              <p className="text-xs text-slate-500">Nhập tên hàng, số lượng và giá bán</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-800 mb-2">Tên hàng</label>
                <div className="relative">
                  <input type="text" placeholder="Ví dụ: áo phông trắng, Quần jean..."
                    value={newProduct.tenSanPham}
                    onFocus={() => setShowProductSuggestions(true)}
                    onBlur={() => {
                      const titleName = toTitleCase(newProduct.tenSanPham)
                      if (titleName !== newProduct.tenSanPham) {
                        setNewProduct((prev) => ({ ...prev, tenSanPham: titleName }))
                      }
                      setTimeout(() => setShowProductSuggestions(false), 120)
                      const matched = getCatalogMatch(titleName)
                      if (!matched) return
                      setNewProduct((prev) => applyMatchedProduct(prev, titleName, matched))
                    }}
                    onChange={(e) => {
                      const tenSanPham = e.target.value
                      const matched = getCatalogMatch(tenSanPham)
                      setNewProduct((prev) => applyMatchedProduct(prev, tenSanPham, matched))
                    }}
                    className={inputCls} />
                  {showProductSuggestions && getCatalogSuggestions(newProduct.tenSanPham).length > 0 && (
                    <div className="absolute z-30 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-slate-200 bg-white shadow-lg">
                      {getCatalogSuggestions(newProduct.tenSanPham).map((p) => (
                        <button
                          key={`${p.tenSanPham}-${p.donVi}`}
                          type="button"
                          className="block w-full border-b border-slate-100 px-3 py-2 text-left last:border-b-0 hover:bg-rose-50"
                          onMouseDown={(ev) => ev.preventDefault()}
                          onClick={() => {
                            setNewProduct((prev) =>
                              applyMatchedProduct(prev, p.tenSanPham || "", p),
                            )
                            setShowProductSuggestions(false)
                          }}
                        >
                          <p className="text-sm font-semibold text-slate-800">{p.tenSanPham}</p>
                          <p className="text-xs text-slate-500">{p.donVi || "-"} • Giá {fmt(p.donGiaBan || 0)} • Vốn {fmt(p.giaVon || 0)}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 md:gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-2">Đơn vị</label>
                  <input type="text" placeholder="cái, bộ, chiếc..."
                    value={newProduct.donVi}
                    onChange={(e) => setNewProduct({ ...newProduct, donVi: e.target.value })}
                    onBlur={() => setNewProduct((prev) => ({ ...prev, donVi: toTitleCase(prev.donVi) }))}
                    className={inputCls} />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-2">Số lượng</label>
                  <input type="number" placeholder="1" min="0"
                    value={newProduct.soLuong}
                    onChange={(e) => setNewProduct({ ...newProduct, soLuong: e.target.value === "" ? "" : parseInt(e.target.value) || 0 })}
                    onBlur={() => {
                      if (newProduct.soLuong === "" || newProduct.soLuong < 1) setNewProduct({ ...newProduct, soLuong: 1 })
                    }}
                    className={inputCls} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-800 mb-2">Đơn giá bán</label>
                <CurrencyInput value={newProduct.donGiaBan}
                  onChange={(v) => setNewProduct({ ...newProduct, donGiaBan: v })}
                  className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-800 mb-2">Giá vốn</label>
                <CurrencyInput value={newProduct.giaVon || 0}
                  onChange={(v) => setNewProduct({ ...newProduct, giaVon: v })}
                  className={inputCls} />
              </div>
              <button type="button" onClick={handleAddProduct}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-rose-700 to-rose-500 px-4 py-3 font-semibold text-white hover:shadow-lg hover:shadow-rose-700/25 transition-all duration-300 active:scale-95">
                Thêm vào đơn
              </button>
            </div>
          </div>

          {/* Products Header + List */}
          {products.length > 0 && (
            <>
              <div className="flex items-center justify-between xl:hidden">
                <div>
                  <h2 className="text-xl md:text-2xl font-bold text-slate-800">Đơn hàng</h2>
                  <p className="text-xs md:text-sm text-slate-500 mt-1">Các mặt hàng trong đơn</p>
                </div>
                <div className="flex items-center justify-center w-10 h-10 md:w-12 md:h-12 rounded-xl bg-rose-700/10 text-rose-700 font-semibold">
                  {totalItems}
                </div>
              </div>
              <div className="space-y-3 xl:hidden">
                {products.map((product) => (
                  <ProductListItem key={product.id} product={product}
                    onUpdate={(updated) => handleUpdateProduct(product.id, updated)}
                    onRemove={() => handleRemoveProduct(product.id)} />
                ))}
              </div>
            </>
          )}

          {/* Empty state */}
          {products.length === 0 && (
            <div className="rounded-2xl border border-slate-200/50 bg-gradient-to-br from-slate-50/50 to-slate-100/30 p-8 md:p-12 text-center">
              <div className="flex justify-center mb-4">
                <div className="w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-rose-700/10 flex items-center justify-center text-2xl md:text-3xl">
                  📦
                </div>
              </div>
              <p className="text-base md:text-lg font-semibold text-slate-800 mb-1">Đơn hàng trống</p>
              <p className="text-sm text-slate-500">Thêm mặt hàng vào đơn để bắt đầu</p>
            </div>
          )}
          </div>

          <aside className="xl:col-span-4 xl:sticky xl:top-6 self-start space-y-4">
            {products.length > 0 && (
              <div className="hidden xl:flex items-center justify-between rounded-2xl border border-slate-200/70 bg-white p-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-800">Đơn hàng</h2>
                  <p className="text-sm text-slate-500 mt-1">Các mặt hàng trong đơn</p>
                </div>
                <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-rose-700/10 text-rose-700 font-semibold">
                  {totalItems}
                </div>
              </div>
            )}
            {products.length > 0 && (
              <div className="hidden xl:block space-y-3 max-h-[48vh] overflow-y-auto pr-1">
                {products.map((product) => (
                  <ProductListItem key={`desktop-${product.id}`} product={product}
                    onUpdate={(updated) => handleUpdateProduct(product.id, updated)}
                    onRemove={() => handleRemoveProduct(product.id)} />
                ))}
              </div>
            )}
            <OrderSummary totalAmount={totalAmount} totalItems={totalItems} />
            {products.length > 0 ? (
              <button type="submit" disabled={isSubmitting}
                className={`w-full rounded-xl px-6 py-4 font-bold text-white text-base md:text-lg transition-all duration-300 active:scale-95 ${
                  isSubmitting
                    ? "bg-slate-400 cursor-not-allowed"
                    : "bg-gradient-to-r from-rose-700 to-rose-500 hover:shadow-lg hover:shadow-rose-700/25"
                }`}>
                {isSubmitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Đang gửi...
                  </span>
                ) : "Gửi đơn hàng"}
              </button>
            ) : (
              <div className="rounded-2xl border border-slate-200/70 bg-white p-4 text-sm text-slate-500">
                Thêm ít nhất một sản phẩm để bật nút gửi đơn.
              </div>
            )}
          </aside>
        </form>
      </div>
    </main>
  )
}





