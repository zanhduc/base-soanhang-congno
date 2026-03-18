import { useState, useMemo, useEffect } from "react";
import toast from "react-hot-toast";
import { getProductCatalog, createInventoryReceipt } from "../api";

const fmt = (n) => Number(n || 0).toLocaleString("vi-VN");

const toTitleCase = (str) => {
  return String(str || "")
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
    .trim();
};

function CurrencyInput({ value, onChange, className }) {
  const [display, setDisplay] = useState(value ? fmt(value) : "");

  useEffect(() => {
    setDisplay(value ? fmt(value) : "");
  }, [value]);

  return (
    <input
      value={display}
      onChange={(e) => {
        const digits = String(e.target.value || "").replace(/[^\d]/g, "");
        const n = digits ? Number(digits) : 0;
        setDisplay(digits ? fmt(n) : "");
        onChange(n);
      }}
      inputMode="numeric"
      placeholder="0"
      className={className}
    />
  );
}

function ProductListItem({ product, onUpdate, onRemove }) {
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState(product);

  if (isEditing) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50/50 p-4 space-y-3 shadow-sm animate-[fadeUp_0.2s_ease]">
        <div className="flex items-center justify-between">
          <p className="font-bold text-slate-800">Sửa hàng hóa</p>
          <button
            type="button"
            onClick={onRemove}
            className="rounded-lg p-1 text-slate-400 hover:bg-rose-100 hover:text-rose-600 transition-colors"
          >
            ❌
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="text-xs font-semibold text-slate-500 mb-1 block">
              Tên hàng hóa
            </label>
            <input
              value={form.tenSanPham}
              onChange={(e) => setForm({ ...form, tenSanPham: e.target.value })}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-rose-500 focus:ring-1 focus:ring-rose-500 outline-none transition-all"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1 block">
              Số lượng
            </label>
            <input
              type="number"
              min="1"
              value={form.soLuong}
              onChange={(e) =>
                setForm({ ...form, soLuong: parseInt(e.target.value) || 0 })
              }
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-rose-500 focus:ring-1 focus:ring-rose-500 outline-none transition-all"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-1 block">
              Giá nhập
            </label>
            <CurrencyInput
              value={form.giaNhap}
              onChange={(v) => setForm({ ...form, giaNhap: v })}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-rose-500 focus:ring-1 focus:ring-rose-500 outline-none transition-all"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={() => {
              setForm(product);
              setIsEditing(false);
            }}
            className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 border border-slate-200 hover:bg-white transition-colors"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={() => {
              onUpdate(form);
              setIsEditing(false);
            }}
            className="rounded-xl px-4 py-2 text-sm font-semibold bg-rose-600 text-white hover:bg-rose-700 transition-colors"
          >
            Lưu
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={() => setIsEditing(true)}
      className="group flex flex-col sm:flex-row sm:items-center justify-between rounded-xl border border-slate-100 bg-white px-4 py-3 hover:border-rose-200 hover:shadow-sm transition-all cursor-pointer gap-2"
    >
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-slate-800 leading-tight group-hover:text-rose-700 transition-colors">
          {product.tenSanPham}{" "}
          <span className="text-slate-400 font-normal">({product.donVi})</span>
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
          <span>
            SL:{" "}
            <strong className="text-slate-700">{fmt(product.soLuong)}</strong>
          </span>
          <span className="opacity-40">•</span>
          <span>
            Giá:{" "}
            <strong className="text-slate-700">{fmt(product.giaNhap)}</strong>
          </span>
        </div>
      </div>
      <div className="flex items-center justify-between sm:flex-col sm:items-end sm:justify-center shrink-0 border-t border-slate-50 sm:border-0 pt-2 sm:pt-0 mt-1 sm:mt-0">
        <span className="text-xs text-slate-400 sm:hidden">Thành tiền</span>
        <span className="font-bold text-rose-600 tabular-nums">
          {fmt(product.soLuong * product.giaNhap)}
        </span>
      </div>
    </div>
  );
}

export default function InventoryPage({ user }) {
  const [productCatalog, setProductCatalog] = useState([]);
  const [products, setProducts] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showProductSuggestions, setShowProductSuggestions] = useState(false);

  const getTodayInputDate = () => {
    const now = new Date();
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    return local.toISOString().split("T")[0];
  };

  const [receiptInfo, setReceiptInfo] = useState({
    maPhieu: `NK${Date.now()}`.slice(-8),
    ngayNhap: getTodayInputDate(),
    ghiChu: "",
    nhaCungCap: "",
  });

  const [newProduct, setNewProduct] = useState({
    tenSanPham: "",
    donVi: "",
    soLuong: 1,
    giaNhap: 0,
  });

  // Mock catalog load for suggestions
  useEffect(() => {
    getProductCatalog().then((res) => {
      if (res?.success && Array.isArray(res.data)) {
        setProductCatalog(res.data);
      }
    });
  }, []);

  const applyMatchedProduct = (prev, inputName, matched) => {
    if (!matched) return { ...prev, tenSanPham: inputName };
    return {
      ...prev,
      tenSanPham: matched.tenSanPham || inputName,
      donVi: matched.donVi || prev.donVi,
      giaNhap: matched.giaVon || prev.giaNhap, // Gợi ý giá vốn làm giá nhập mặc định
    };
  };

  const handleAddProduct = () => {
    const name = newProduct.tenSanPham.trim();
    const unit = newProduct.donVi.trim();
    const qty = Number(newProduct.soLuong) || 0;
    const price = Number(newProduct.giaNhap) || 0;

    if (!name) return toast.error("Vui lòng nhập tên sản phẩm");
    if (!unit) return toast.error("Vui lòng nhập đơn vị");
    if (qty <= 0) return toast.error("Số lượng phải lớn hơn 0");
    if (price < 0) return toast.error("Giá nhập không hợp lệ");

    setProducts((prev) => [
      {
        id: Date.now().toString(),
        tenSanPham: name,
        donVi: unit,
        soLuong: qty,
        giaNhap: price,
      },
      ...prev,
    ]);

    setNewProduct({ tenSanPham: "", donVi: "", soLuong: 1, giaNhap: 0 });
    toast.success("Đã thêm vào phiếu");
  };

  const handleUpdateProduct = (id, updated) => {
    setProducts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...updated } : p)),
    );
  };

  const handleRemoveProduct = (id) => {
    setProducts((prev) => prev.filter((p) => p.id !== id));
  };

  const totalAmount = products.reduce(
    (sum, p) => sum + p.soLuong * p.giaNhap,
    0,
  );
  const totalItems = products.reduce((sum, p) => sum + p.soLuong, 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (products.length === 0)
      return toast.error("Vui lòng thêm sản phẩm vào phiếu nhập");

    setIsSubmitting(true);
    try {
      const payload = {
        receiptInfo,
        products: products.map((p) => ({
          tenSanPham: p.tenSanPham,
          donVi: p.donVi,
          soLuong: p.soLuong,
          giaNhap: p.giaNhap,
        })),
        user: user?.email || "Unknown",
      };

      const res = await createInventoryReceipt(payload);
      if (res?.success) {
        toast.success("Tạo phiếu nhập kho thành công!");
        setProducts([]);
        setReceiptInfo({
          ...receiptInfo,
          maPhieu: `NK${Date.now()}`.slice(-8),
        });
      } else {
        toast.error(res?.message || "Tạo phiếu nhập thất bại");
      }
    } catch (err) {
      toast.error("Có lỗi xảy ra khi tạo phiếu nhập");
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputCls =
    "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all";

  return (
    <main className="min-h-screen pb-24 bg-gradient-to-br from-slate-50 via-slate-50 to-emerald-50/30">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-6 md:py-8 pb-24">
        {/* Header */}
        <div className="mb-8 md:mb-10 animate-[fadeUp_0.4s_ease] max-w-3xl">
          <div className="inline-flex items-center gap-2 mb-4 md:mb-6">
            <div className="w-3 h-3 rounded-full bg-emerald-600" />
            <span className="text-xs font-bold text-emerald-600 uppercase tracking-widest">
              Inventory
            </span>
          </div>
          <div className="mb-4 md:mb-6">
            <h1 className="text-4xl md:text-5xl font-black text-slate-900 leading-[1.15] md:leading-[1.2] pb-1 md:pb-2">
              Nhập Hàng
            </h1>
            <h2 className="text-4xl md:text-5xl font-black bg-gradient-to-r from-emerald-600 to-teal-500 bg-clip-text text-transparent leading-[1.15] md:leading-[1.2] pb-1">
              Vào Kho
            </h2>
          </div>
          <p className="text-sm md:text-base text-slate-500 max-w-md leading-relaxed font-medium">
            Tạo phiếu cập nhật số lượng và giá vốn sản phẩm vào kho hệ thống.
          </p>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="space-y-5 md:space-y-6 lg:grid lg:grid-cols-12 lg:gap-6 lg:space-y-0"
        >
          <div className="lg:col-span-8 space-y-5 md:space-y-6">
            {/* Receipt Info */}
            <div className="rounded-2xl border border-slate-200/50 bg-gradient-to-br from-white to-white/80 p-5 md:p-6 shadow-sm hover:shadow-md transition-all duration-300 hover:border-slate-200">
              <h3 className="font-bold text-base md:text-lg text-slate-800 mb-4">
                Thông tin phiếu nhập
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-500">
                    Mã phiếu
                  </label>
                  <input
                    value={receiptInfo.maPhieu}
                    onChange={(e) =>
                      setReceiptInfo({
                        ...receiptInfo,
                        maPhieu: e.target.value,
                      })
                    }
                    placeholder="Mã phiếu tự động"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-500">
                    Ngày nhập
                  </label>
                  <input
                    type="date"
                    value={receiptInfo.ngayNhap}
                    onChange={(e) =>
                      setReceiptInfo({
                        ...receiptInfo,
                        ngayNhap: e.target.value,
                      })
                    }
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-xs font-semibold text-slate-500">
                    Nhà cung cấp
                  </label>
                  <input
                    value={receiptInfo.nhaCungCap}
                    onChange={(e) =>
                      setReceiptInfo({
                        ...receiptInfo,
                        nhaCungCap: e.target.value,
                      })
                    }
                    placeholder="Tên nhà cung cấp (không bắt buộc)"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-xs font-semibold text-slate-500">
                    Ghi chú
                  </label>
                  <input
                    value={receiptInfo.ghiChu}
                    onChange={(e) =>
                      setReceiptInfo({ ...receiptInfo, ghiChu: e.target.value })
                    }
                    placeholder="Ghi chú thêm về lô hàng nhập..."
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
              </div>
            </div>

            {/* Add Product Form */}
            <div className="rounded-2xl border border-slate-200/50 bg-gradient-to-br from-white to-white/80 p-5 md:p-6 space-y-4 md:space-y-5 shadow-sm hover:shadow-md transition-all duration-300">
              <div>
                <h3 className="font-bold text-base md:text-lg text-slate-800 mb-0.5">
                  Thêm mặt hàng nhập
                </h3>
                <p className="text-xs text-slate-500">
                  Sản phẩm có cùng đơn vị trong hệ thống sẽ được ưu tiên chọn
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-2">
                    Tên hàng
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Ví dụ: áo phông trắng, Quần jean..."
                      value={newProduct.tenSanPham}
                      onFocus={() => setShowProductSuggestions(true)}
                      onBlur={() => {
                        const titleName = toTitleCase(newProduct.tenSanPham);
                        if (titleName !== newProduct.tenSanPham) {
                          setNewProduct((prev) => ({
                            ...prev,
                            tenSanPham: titleName,
                          }));
                        }
                        setTimeout(() => setShowProductSuggestions(false), 120);

                        // Need a custom logic for local filtered logic here similar to getCatalogMatch
                        const q = titleName
                          .toLowerCase()
                          .replace(/[\u0300-\u036f]/g, "")
                          .trim();
                        const matched = productCatalog.find(
                          (p) =>
                            p.tenSanPham
                              ?.toLowerCase()
                              .replace(/[\u0300-\u036f]/g, "")
                              .trim() === q,
                        );

                        if (!matched) return;
                        setNewProduct((prev) =>
                          applyMatchedProduct(prev, titleName, matched),
                        );
                      }}
                      onChange={(e) => {
                        const tenSanPham = e.target.value;
                        const q = tenSanPham
                          .toLowerCase()
                          .replace(/[\u0300-\u036f]/g, "")
                          .trim();
                        const matched = productCatalog.find(
                          (p) =>
                            p.tenSanPham
                              ?.toLowerCase()
                              .replace(/[\u0300-\u036f]/g, "")
                              .trim() === q,
                        );
                        setNewProduct((prev) =>
                          applyMatchedProduct(prev, tenSanPham, matched),
                        );
                      }}
                      className={inputCls}
                    />
                    {showProductSuggestions &&
                      productCatalog.filter((p) =>
                        p.tenSanPham
                          .toLowerCase()
                          .includes(newProduct.tenSanPham.toLowerCase()),
                      ).length > 0 && (
                        <div className="absolute z-30 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-slate-200 bg-white shadow-lg">
                          {productCatalog
                            .filter((p) =>
                              p.tenSanPham
                                .toLowerCase()
                                .includes(newProduct.tenSanPham.toLowerCase()),
                            )
                            .slice(0, 8)
                            .map((p) => (
                              <button
                                key={`${p.tenSanPham}-${p.donVi}`}
                                type="button"
                                className="block w-full border-b border-slate-100 px-3 py-2 text-left last:border-b-0 hover:bg-emerald-50"
                                onMouseDown={(ev) => ev.preventDefault()}
                                onClick={() => {
                                  setNewProduct((prev) =>
                                    applyMatchedProduct(
                                      prev,
                                      p.tenSanPham || "",
                                      p,
                                    ),
                                  );
                                  setShowProductSuggestions(false);
                                }}
                              >
                                <p className="text-sm font-semibold text-slate-800">
                                  {p.tenSanPham}
                                </p>
                                <p className="text-xs text-slate-500">
                                  {p.donVi || "-"} • Vốn HT:{" "}
                                  {fmt(p.giaVon || 0)}
                                </p>
                              </button>
                            ))}
                        </div>
                      )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 md:gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-800 mb-2">
                      Đơn vị
                    </label>
                    <input
                      type="text"
                      placeholder="cái, bộ..."
                      value={newProduct.donVi}
                      onChange={(e) =>
                        setNewProduct({ ...newProduct, donVi: e.target.value })
                      }
                      onBlur={() =>
                        setNewProduct((prev) => ({
                          ...prev,
                          donVi: toTitleCase(prev.donVi),
                        }))
                      }
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-800 mb-2">
                      Số lượng nhập
                    </label>
                    <input
                      type="number"
                      placeholder="1"
                      min="0"
                      value={newProduct.soLuong}
                      onChange={(e) =>
                        setNewProduct({
                          ...newProduct,
                          soLuong:
                            e.target.value === ""
                              ? ""
                              : parseInt(e.target.value) || 0,
                        })
                      }
                      onBlur={() => {
                        if (newProduct.soLuong === "" || newProduct.soLuong < 1)
                          setNewProduct({ ...newProduct, soLuong: 1 });
                      }}
                      className={inputCls}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-2">
                    Giá nhập (Giá vốn mới)
                  </label>
                  <CurrencyInput
                    value={newProduct.giaNhap}
                    onChange={(v) =>
                      setNewProduct({ ...newProduct, giaNhap: v })
                    }
                    className={inputCls}
                  />
                </div>
                <button
                  type="button"
                  onClick={handleAddProduct}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 px-4 py-3 font-semibold text-white hover:shadow-lg hover:shadow-emerald-600/25 transition-all duration-300 active:scale-95"
                >
                  Thêm vào phiếu
                </button>
              </div>
            </div>

            {/* Mobile Products List */}
            {products.length > 0 && (
              <>
                <div className="flex items-center justify-between lg:hidden">
                  <div>
                    <h2 className="text-xl md:text-2xl font-bold text-slate-800">
                      Thông tin phiếu
                    </h2>
                    <p className="text-xs md:text-sm text-slate-500 mt-1">
                      Hàng hóa đang chuẩn bị nhập
                    </p>
                  </div>
                  <div className="flex items-center justify-center w-10 h-10 md:w-12 md:h-12 rounded-xl bg-emerald-600/10 text-emerald-700 font-semibold">
                    {totalItems}
                  </div>
                </div>
                <div className="space-y-3 lg:hidden">
                  {products.map((product) => (
                    <ProductListItem
                      key={product.id}
                      product={product}
                      onUpdate={(updated) =>
                        handleUpdateProduct(product.id, updated)
                      }
                      onRemove={() => handleRemoveProduct(product.id)}
                    />
                  ))}
                </div>
              </>
            )}

            {products.length === 0 && (
              <div className="rounded-2xl border border-slate-200/50 bg-gradient-to-br from-slate-50/50 to-slate-100/30 p-8 md:p-12 text-center lg:hidden">
                <div className="flex justify-center mb-4">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-600/10 flex items-center justify-center text-2xl">
                    📦
                  </div>
                </div>
                <p className="text-base font-semibold text-slate-800 mb-1">
                  Phiếu trống
                </p>
                <p className="text-sm text-slate-500">
                  Thêm mặt hàng để bắt đầu
                </p>
              </div>
            )}
          </div>

          <aside className="lg:col-span-4 lg:sticky lg:top-6 self-start space-y-4">
            {products.length > 0 && (
              <div className="hidden lg:flex items-center justify-between rounded-2xl border border-slate-200/70 bg-white p-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-800">
                    Hàng nhập
                  </h2>
                  <p className="text-sm text-slate-500 mt-1">
                    Tổng cộng {totalItems} sản phẩm
                  </p>
                </div>
              </div>
            )}
            {products.length > 0 && (
              <div className="hidden lg:block space-y-3 max-h-[48vh] overflow-y-auto pr-1">
                {products.map((product) => (
                  <ProductListItem
                    key={`desktop-${product.id}`}
                    product={product}
                    onUpdate={(updated) =>
                      handleUpdateProduct(product.id, updated)
                    }
                    onRemove={() => handleRemoveProduct(product.id)}
                  />
                ))}
              </div>
            )}

            <div className="rounded-2xl border border-slate-200/70 bg-white overflow-hidden shadow-sm">
              <div className="bg-emerald-50/50 px-5 py-4 border-b border-emerald-100">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-semibold text-emerald-800 uppercase tracking-wide">
                    Tổng tiền hàng
                  </span>
                  <span className="text-2xl font-black text-emerald-600 tabular-nums tracking-tight">
                    {fmt(totalAmount)}
                  </span>
                </div>
              </div>
            </div>

            {products.length > 0 ? (
              <button
                type="submit"
                disabled={isSubmitting}
                className={`w-full rounded-xl px-6 py-4 font-bold text-white text-base md:text-lg transition-all duration-300 active:scale-95 ${
                  isSubmitting
                    ? "bg-slate-400 cursor-not-allowed"
                    : "bg-gradient-to-r from-emerald-600 to-teal-500 hover:shadow-lg hover:shadow-emerald-600/25"
                }`}
              >
                {isSubmitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Đang lưu...
                  </span>
                ) : (
                  "Lưu Phiếu Nhập"
                )}
              </button>
            ) : (
              <div className="hidden lg:block rounded-2xl border border-slate-200/70 bg-slate-50/50 p-8 text-center text-sm text-slate-500">
                <div className="flex justify-center mb-4">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-600/10 flex items-center justify-center text-2xl">
                    📦
                  </div>
                </div>
                Thêm mặt hàng để lưu phiếu
              </div>
            )}
          </aside>
        </form>
      </div>
    </main>
  );
}
