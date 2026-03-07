import { useState } from "react"

/* ── Sub-components (chỉ dùng trong page này) ── */

function CustomerInfoSection({ customerInfo, onUpdate }) {
  const inputCls =
    "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20 transition-all"

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-semibold text-slate-800 mb-2">Tên khách hàng</label>
        <input type="text" placeholder="Nhập tên khách hàng" value={customerInfo.tenKhach}
          onChange={(e) => onUpdate({ ...customerInfo, tenKhach: e.target.value })} className={inputCls} />
      </div>
      <div>
        <label className="block text-sm font-semibold text-slate-800 mb-2">Số điện thoại</label>
        <input type="tel" placeholder="Nhập số điện thoại" value={customerInfo.soDienThoai}
          onChange={(e) => onUpdate({ ...customerInfo, soDienThoai: e.target.value })} className={inputCls} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-slate-800 mb-2">Mã phiếu</label>
          <input type="text" placeholder="Nhập mã phiếu" value={customerInfo.maPHieu}
            onChange={(e) => onUpdate({ ...customerInfo, maPHieu: e.target.value })} className={inputCls} />
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-800 mb-2">Ngày bán</label>
          <input type="date" value={customerInfo.ngayBan}
            onChange={(e) => onUpdate({ ...customerInfo, ngayBan: e.target.value })} className={inputCls} />
        </div>
      </div>
      <div>
        <label className="block text-sm font-semibold text-slate-800 mb-2">Ghi chú</label>
        <textarea placeholder="Thêm ghi chú cho khách hàng..." value={customerInfo.ghiChu}
          onChange={(e) => onUpdate({ ...customerInfo, ghiChu: e.target.value })}
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
          🗑
        </button>
      </div>
      <div className="grid grid-cols-3 gap-2 md:gap-3">
        <div className="space-y-1">
          <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Số lượng</label>
          <input type="number" min="1" value={product.soLuong}
            onChange={(e) => onUpdate({ soLuong: parseInt(e.target.value) || 1 })}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20 transition-all" />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Đơn giá</label>
          <input type="number" step="1000" value={product.donGiaBan}
            onChange={(e) => onUpdate({ donGiaBan: parseFloat(e.target.value) || 0 })}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20 transition-all" />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Thành tiền</label>
          <div className="rounded-lg border border-blue-600/20 bg-gradient-to-br from-blue-50 to-blue-100/60 px-3 py-2 text-sm font-bold text-blue-600">
            {thanhTien.toLocaleString("vi-VN")}₫
          </div>
        </div>
      </div>
    </div>
  )
}

function OrderSummary({ totalAmount, totalItems }) {
  return (
    <div className="rounded-2xl border border-blue-600/20 bg-gradient-to-br from-blue-50/50 via-white to-blue-100/30 p-5 md:p-6 shadow-sm">
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <span className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Tổng số sản phẩm</span>
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-blue-600/10 text-blue-600 font-bold">
            {totalItems}
          </div>
        </div>
        <div className="h-px bg-gradient-to-r from-slate-200/0 via-slate-200/50 to-slate-200/0" />
        <div>
          <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">Tổng hóa đơn</p>
          <p className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-blue-600 to-blue-500 bg-clip-text text-transparent">
            {totalAmount.toLocaleString("vi-VN")}₫
          </p>
        </div>
      </div>
    </div>
  )
}

/* ── Main Page ── */

export default function CreateOrderPage() {
  const [isCustomerMode, setIsCustomerMode] = useState(false)
  const [customerInfo, setCustomerInfo] = useState({
    tenKhach: "",
    soDienThoai: "",
    maPHieu: "",
    ngayBan: new Date().toISOString().split("T")[0],
    ghiChu: "",
  })

  const [products, setProducts] = useState([])
  const [newProduct, setNewProduct] = useState({
    id: "",
    tenSanPham: "",
    donVi: "",
    soLuong: 1,
    donGiaBan: 0,
  })

  const handleAddProduct = () => {
    if (newProduct.tenSanPham && newProduct.donGiaBan > 0) {
      setProducts([...products, { ...newProduct, id: Date.now().toString() }])
      setNewProduct({ id: "", tenSanPham: "", donVi: "", soLuong: 1, donGiaBan: 0 })
    }
  }

  const handleRemoveProduct = (id) => {
    setProducts(products.filter((p) => p.id !== id))
  }

  const handleUpdateProduct = (id, updated) => {
    setProducts(products.map((p) => (p.id === id ? { ...p, ...updated } : p)))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (products.length === 0) return alert("Vui lòng thêm ít nhất một sản phẩm")
    if (isCustomerMode && !customerInfo.tenKhach) return alert("Vui lòng nhập tên khách hàng")

    const orderData = {
      customer: isCustomerMode ? customerInfo : null,
      products,
      timestamp: new Date().toISOString(),
    }
    console.log("Order Data:", orderData)
    // TODO: gọi API call(...) để lưu đơn hàng
  }

  const totalAmount = products.reduce((sum, p) => sum + p.soLuong * p.donGiaBan, 0)
  const totalItems = products.reduce((sum, p) => sum + p.soLuong, 0)

  const inputCls =
    "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20 transition-all"

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-50 to-blue-50/30">
      <div className="mx-auto max-w-2xl px-4 py-6 md:py-8 pb-24">
        {/* Header */}
        <div className="mb-8 md:mb-12 animate-[fadeUp_0.4s_ease]">
          <div className="inline-flex items-center gap-2 mb-4 md:mb-6">
            <div className="w-3 h-3 rounded-full bg-blue-600" />
            <span className="text-xs font-bold text-blue-600 uppercase tracking-widest">Bán hàng</span>
          </div>
          <div className="mb-4 md:mb-6">
            <h1 className="text-4xl md:text-5xl font-black text-slate-900 leading-tight">Lập Đơn</h1>
            <h2 className="text-4xl md:text-5xl font-black bg-gradient-to-r from-blue-600 to-blue-400 bg-clip-text text-transparent leading-tight mt-1">
              Hàng Mới
            </h2>
          </div>
          <p className="text-sm md:text-base text-slate-500 max-w-md leading-relaxed font-medium">
            Tạo đơn hàng nhanh chóng với giao diện thân thiện, quản lý thông tin khách hàng và sản phẩm dễ dàng.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5 md:space-y-6">
          {/* Customer Info Toggle */}
          <div className="rounded-2xl border border-slate-200/50 bg-gradient-to-br from-white to-white/80 p-5 md:p-6 shadow-sm hover:shadow-md transition-all duration-300 hover:border-slate-200">
            <button type="button" onClick={() => setIsCustomerMode(!isCustomerMode)}
              className="flex w-full items-center justify-between text-slate-800 hover:text-blue-600 transition-colors group">
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full transition-colors duration-300 ${isCustomerMode ? "bg-blue-600" : "bg-slate-300"}`} />
                <span className="font-semibold text-base md:text-lg">
                  {isCustomerMode ? "✓ Thông tin khách hàng" : "Thông tin khách hàng (Tùy chọn)"}
                </span>
              </div>
              <span className={`text-lg transition-all ${isCustomerMode ? "rotate-180" : ""} group-hover:text-blue-600`}>▾</span>
            </button>

            {isCustomerMode && (
              <div className="mt-5 pt-5 border-t border-slate-200/50 animate-[fadeUp_0.3s_ease]">
                <CustomerInfoSection customerInfo={customerInfo} onUpdate={setCustomerInfo} />
              </div>
            )}
          </div>

          {/* Products Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl md:text-2xl font-bold text-slate-800">Danh sách sản phẩm</h2>
              <p className="text-xs md:text-sm text-slate-500 mt-1">Quản lý các sản phẩm trong đơn hàng</p>
            </div>
            {products.length > 0 && (
              <div className="flex items-center justify-center w-10 h-10 md:w-12 md:h-12 rounded-xl bg-blue-600/10 text-blue-600 font-semibold">
                {totalItems}
              </div>
            )}
          </div>

          {/* Product List */}
          {products.length > 0 && (
            <div className="space-y-3">
              {products.map((product) => (
                <ProductListItem key={product.id} product={product}
                  onUpdate={(updated) => handleUpdateProduct(product.id, updated)}
                  onRemove={() => handleRemoveProduct(product.id)} />
              ))}
            </div>
          )}

          {/* Add Product Form */}
          <div className="rounded-2xl border border-slate-200/50 bg-gradient-to-br from-white to-white/80 p-5 md:p-6 space-y-4 md:space-y-5 shadow-sm hover:shadow-md transition-all duration-300">
            <div>
              <h3 className="font-bold text-base md:text-lg text-slate-800 mb-0.5">Thêm sản phẩm mới</h3>
              <p className="text-xs text-slate-500">Nhập chi tiết sản phẩm và giá bán</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-800 mb-2">Tên sản phẩm</label>
                <input type="text" placeholder="Ví dụ: Áo phông trắng, Quần jean..."
                  value={newProduct.tenSanPham}
                  onChange={(e) => setNewProduct({ ...newProduct, tenSanPham: e.target.value })}
                  className={inputCls} />
              </div>
              <div className="grid grid-cols-2 gap-3 md:gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-2">Đơn vị</label>
                  <input type="text" placeholder="cái, bộ, chiếc..."
                    value={newProduct.donVi}
                    onChange={(e) => setNewProduct({ ...newProduct, donVi: e.target.value })}
                    className={inputCls} />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-2">Số lượng</label>
                  <input type="number" placeholder="0" min="1"
                    value={newProduct.soLuong}
                    onChange={(e) => setNewProduct({ ...newProduct, soLuong: parseInt(e.target.value) || 1 })}
                    className={inputCls} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-800 mb-2">Đơn giá bán</label>
                <input type="number" placeholder="0 ₫" min="0" step="1000"
                  value={newProduct.donGiaBan}
                  onChange={(e) => setNewProduct({ ...newProduct, donGiaBan: parseFloat(e.target.value) || 0 })}
                  className={inputCls} />
              </div>
              <button type="button" onClick={handleAddProduct}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 px-4 py-3 font-semibold text-white hover:shadow-lg hover:shadow-blue-600/25 transition-all duration-300 active:scale-95">
                ＋ Thêm sản phẩm
              </button>
            </div>
          </div>

          {/* Summary + Submit */}
          {products.length > 0 && (
            <div className="space-y-4 animate-[fadeUp_0.3s_ease]">
              <OrderSummary totalAmount={totalAmount} totalItems={totalItems} />
              <button type="submit"
                className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 px-6 py-4 font-bold text-white text-base md:text-lg hover:shadow-lg hover:shadow-blue-600/25 transition-all duration-300 active:scale-95">
                Tạo đơn hàng
              </button>
            </div>
          )}

          {/* Empty state */}
          {products.length === 0 && (
            <div className="rounded-2xl border border-slate-200/50 bg-gradient-to-br from-slate-50/50 to-slate-100/30 p-8 md:p-12 text-center">
              <div className="flex justify-center mb-4">
                <div className="w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-blue-600/10 flex items-center justify-center text-2xl md:text-3xl">
                  📦
                </div>
              </div>
              <p className="text-base md:text-lg font-semibold text-slate-800 mb-1">Chưa có sản phẩm nào</p>
              <p className="text-sm text-slate-500">Vui lòng thêm sản phẩm để tiếp tục tạo đơn hàng</p>
            </div>
          )}
        </form>
      </div>
    </main>
  )
}
