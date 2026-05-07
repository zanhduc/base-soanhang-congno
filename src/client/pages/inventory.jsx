import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import {
  createInventoryReceipt,
  getNextInventoryReceiptDefaults,
  getSupplierCatalog,
  formatAllSheets,
} from "../api";
import { runInBackground } from "../api/backgroundApi";
import { normalizeText as foldText } from "../../core/core";

const fmt = (n) => Number(n || 0).toLocaleString("vi-VN");

const RECEIPT_STATUS = {
  PAID: "Đã thanh toán",
  PARTIAL: "Trả một phần",
  DEBT: "Nợ",
};

const RECEIPT_STATUS_OPTIONS = [
  RECEIPT_STATUS.PAID,
  RECEIPT_STATUS.PARTIAL,
  RECEIPT_STATUS.DEBT,
];

const getTodayInputDate = () => {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().split("T")[0];
};

const getReceiptStatusCode = (status) => {
  if (status === RECEIPT_STATUS.PARTIAL) return "PARTIAL";
  if (status === RECEIPT_STATUS.DEBT) return "DEBT";
  return "PAID";
};

const createInitialReceiptInfo = () => ({
  maPhieu: "",
  ngayNhap: getTodayInputDate(),
  ghiChu: "",
  nhaCungCap: "",
  soDienThoai: "",
  trangThai: RECEIPT_STATUS.PAID,
  soTienDaTra: 0,
});

const createInitialMaterial = () => ({
  tenSanPham: "",
  nhomHang: "",
  donVi: "",
  soLuong: 1,
  giaNhap: 0,
});

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

function ReceiptStatusSelect({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const current = RECEIPT_STATUS_OPTIONS.includes(value)
    ? value
    : RECEIPT_STATUS.PAID;

  useEffect(() => {
    const onDocClick = (e) => {
      if (!e.target.closest("#material-status-select")) setOpen(false);
    };
    const onEsc = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("touchstart", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("touchstart", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, []);

  return (
    <div id="material-status-select" className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-left text-sm text-slate-800 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
      >
        {current}
        <span
          className={`absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        >
          <i className="ri-arrow-down-s-line text-lg"></i>
        </span>
      </button>
      {open && (
        <div className="absolute z-30 mt-1.5 w-full rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
          {RECEIPT_STATUS_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => {
                onChange(option);
                setOpen(false);
              }}
              className={`block w-full rounded-lg px-3 py-2 text-left text-sm ${
                option === current
                  ? "bg-emerald-50 font-semibold text-emerald-700"
                  : "text-slate-700 hover:bg-emerald-50"
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function InventoryPage({ user }) {
  const [materials, setMaterials] = useState([]);
  const [supplierCatalog, setSupplierCatalog] = useState([]);
  const [showSupplierSuggestions, setShowSupplierSuggestions] = useState(false);
  const [isLoadingReceiptDefaults, setIsLoadingReceiptDefaults] =
    useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  const [receiptInfo, setReceiptInfo] = useState(createInitialReceiptInfo);
  const [newMaterial, setNewMaterial] = useState(createInitialMaterial);

  const loadReceiptDefaults = async ({ silent = false } = {}) => {
    if (!silent) setIsLoadingReceiptDefaults(true);
    const today = getTodayInputDate();
    try {
      const res = await getNextInventoryReceiptDefaults();
      const maPhieu = String(res?.data?.maPhieu || "").trim() || "NK01";
      const ngayNhap = String(res?.data?.ngayNhap || "").trim() || today;
      setReceiptInfo((prev) => ({ ...prev, maPhieu, ngayNhap }));
    } catch (err) {
      setReceiptInfo((prev) => ({
        ...prev,
        maPhieu: prev.maPhieu || "NK01",
        ngayNhap: prev.ngayNhap || today,
      }));
    } finally {
      if (!silent) setIsLoadingReceiptDefaults(false);
    }
  };

  const loadSuppliers = async () => {
    try {
      const res = await getSupplierCatalog();
      if (res?.success && Array.isArray(res.data)) {
        setSupplierCatalog(res.data);
      }
    } catch (_) {
      setSupplierCatalog([]);
    }
  };

  useEffect(() => {
    loadReceiptDefaults();
    loadSuppliers();
  }, []);

  const supplierSuggestions = useMemo(() => {
    const keyword = foldText(receiptInfo.nhaCungCap);
    if (!keyword) return supplierCatalog.slice(0, 5);
    return supplierCatalog
      .filter((s) => foldText(s.tenNCC).includes(keyword))
      .slice(0, 5);
  }, [supplierCatalog, receiptInfo.nhaCungCap]);

  const totalAmount = materials.reduce(
    (sum, m) => sum + Number(m.soLuong || 0) * Number(m.giaNhap || 0),
    0,
  );

  const handleAddMaterial = () => {
    const nextErrors = {};
    const tenSanPham = String(newMaterial.tenSanPham || "").trim();
    const donVi = String(newMaterial.donVi || "").trim();
    const nhomHang = String(newMaterial.nhomHang || "").trim();
    const soLuong = Number(newMaterial.soLuong || 0);
    const giaNhap = Number(newMaterial.giaNhap || 0);

    if (!tenSanPham) nextErrors.new_tenSanPham = "Chưa có tên nguyên liệu";
    if (!donVi) nextErrors.new_donVi = "Chưa có đơn vị";
    if (soLuong <= 0) nextErrors.new_soLuong = "Số lượng phải > 0";
    if (soLuong > 100000) nextErrors.new_soLuong = "Số lượng tối đa 100000";
    if (giaNhap <= 0) nextErrors.new_giaNhap = "Giá nhập phải > 0";

    const isDuplicate = materials.some(
      (m) =>
        foldText(m.tenSanPham) === foldText(tenSanPham) &&
        foldText(m.donVi) === foldText(donVi),
    );
    if (isDuplicate) nextErrors.new_tenSanPham = "Nguyên liệu đã có trong phiếu";

    if (Object.keys(nextErrors).length > 0) {
      setErrors((prev) => ({ ...prev, ...nextErrors }));
      return;
    }

    setMaterials((prev) => [
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        tenSanPham,
        nhomHang,
        donVi,
        soLuong,
        giaNhap,
      },
      ...prev,
    ]);

    setNewMaterial(createInitialMaterial());
    setErrors((prev) => {
      const {
        new_tenSanPham,
        new_nhomHang,
        new_donVi,
        new_soLuong,
        new_giaNhap,
        ...rest
      } = prev;
      return rest;
    });
  };

  const handleRemoveMaterial = (id) => {
    setMaterials((prev) => prev.filter((m) => m.id !== id));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isLoadingReceiptDefaults) {
      toast.error("Đang tải mã phiếu nhập mới, vui lòng chờ...");
      return;
    }

    const nextErrors = {};
    if (!String(receiptInfo.nhaCungCap || "").trim()) {
      nextErrors.nhaCungCap = "Vui lòng nhập tên nhà cung cấp";
    }
    if (materials.length === 0) {
      toast.error("Vui lòng thêm ít nhất một nguyên liệu");
      return;
    }
    if (receiptInfo.trangThai === RECEIPT_STATUS.PARTIAL) {
      const paid = Number(receiptInfo.soTienDaTra || 0);
      if (paid <= 0) {
        toast.error("Vui lòng nhập số tiền đã trả trước");
        return;
      }
      if (paid > totalAmount) {
        toast.error("Số tiền đã trả không được lớn hơn tổng phiếu nhập");
        return;
      }
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      toast.error("Vui lòng kiểm tra lại thông tin");
      return;
    }

    setErrors({});
    setIsSubmitting(true);

    const payload = {
      receiptInfo: {
        ...receiptInfo,
        trangThaiCode: getReceiptStatusCode(receiptInfo.trangThai),
        soTienDaTra:
          receiptInfo.trangThai === RECEIPT_STATUS.PARTIAL
            ? Number(receiptInfo.soTienDaTra || 0)
            : 0,
      },
      products: materials.map((m) => ({
        id: m.id,
        tenSanPham: m.tenSanPham,
        nhomHang: m.nhomHang,
        donVi: m.donVi,
        soLuong: Number(m.soLuong || 0),
        giaNhap: Number(m.giaNhap || 0),
        donViChan: m.donVi,
        donViLe: m.donVi,
        quyDoi: 1,
        giaNhapChan: Number(m.giaNhap || 0),
      })),
      user: user?.email || "unknown",
    };

    const maPhieu = String(receiptInfo.maPhieu || "").trim();

    setMaterials([]);
    setReceiptInfo(createInitialReceiptInfo());

    runInBackground({
      apiCall: () => createInventoryReceipt(payload),
      successMessage: "Tạo phiếu nhập nguyên liệu thành công!",
      changeDescription: `Tạo phiếu nhập nguyên liệu \"${maPhieu}\"`,
      userName: user?.name || user?.email || "unknown",
      onComplete: (result) => {
        setIsSubmitting(false);
        if (result?.success && !result?.queued) {
          formatAllSheets().catch(() => {});
        }
        Promise.all([loadReceiptDefaults(), loadSuppliers()]).catch(() => {});
      },
    });
  };

  const inputCls = (hasError) =>
    `w-full rounded-xl border ${
      hasError ? "border-rose-500 ring-1 ring-rose-500/20" : "border-slate-200"
    } bg-white px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all`;

  return (
    <main className="min-h-screen pb-24 bg-gradient-to-br from-slate-50 via-slate-50 to-emerald-50/30">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-6 md:py-8 pb-24">
        <div className="mb-8 max-w-3xl">
          <h1 className="text-4xl md:text-5xl font-black text-slate-900 leading-[1.15]">
            Nhập Nguyên Liệu
          </h1>
          <p className="mt-3 text-sm md:text-base text-slate-500 max-w-xl leading-relaxed font-medium">
            Ghi nhận nguyên liệu đã nhập và chi phí theo từng phiếu. Dữ liệu này
            không làm thay đổi tồn kho sản phẩm bán hàng.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-5 md:space-y-6 lg:grid lg:grid-cols-12 lg:gap-6 lg:space-y-0"
        >
          <div className="lg:col-span-8 space-y-5 md:space-y-6">
            <div className="rounded-2xl border border-slate-200/50 bg-white shadow-sm overflow-hidden">
              <div className="bg-emerald-50/80 border-b border-emerald-100/50 px-5 py-4">
                <h3 className="font-bold text-sm md:text-base text-emerald-800 uppercase tracking-widest">
                  Thông tin phiếu nhập
                </h3>
              </div>
              <div className="p-5 md:p-6 space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-500">
                      Mã phiếu <span className="text-rose-500">*</span>
                    </label>
                    <input
                      value={receiptInfo.maPhieu}
                      maxLength={50}
                      onChange={(e) =>
                        setReceiptInfo((prev) => ({
                          ...prev,
                          maPhieu: e.target.value,
                        }))
                      }
                      placeholder={
                        isLoadingReceiptDefaults
                          ? "Đang tải mã phiếu..."
                          : "Mã phiếu tự động"
                      }
                      className={inputCls(false)}
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-500">
                      Ngày nhập <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={receiptInfo.ngayNhap}
                      onChange={(e) =>
                        setReceiptInfo((prev) => ({
                          ...prev,
                          ngayNhap: e.target.value,
                        }))
                      }
                      className={inputCls(false)}
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="mb-1.5 block text-xs font-semibold text-slate-500">
                      Tên nhà cung cấp <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={receiptInfo.nhaCungCap}
                        maxLength={120}
                        onFocus={() => setShowSupplierSuggestions(true)}
                        onBlur={() =>
                          setTimeout(() => setShowSupplierSuggestions(false), 120)
                        }
                        onChange={(e) =>
                          setReceiptInfo((prev) => ({
                            ...prev,
                            nhaCungCap: e.target.value,
                          }))
                        }
                        className={inputCls(!!errors.nhaCungCap)}
                        placeholder="Nhập tên nhà cung cấp"
                      />
                      {showSupplierSuggestions && supplierSuggestions.length > 0 && (
                        <div className="absolute z-30 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-slate-200 bg-white shadow-lg">
                          {supplierSuggestions.map((s) => (
                            <button
                              key={`${s.tenNCC}-${s.soDienThoai || ""}`}
                              type="button"
                              className="block w-full border-b border-slate-100 px-3 py-2 text-left last:border-b-0 hover:bg-emerald-50"
                              onMouseDown={(ev) => ev.preventDefault()}
                              onClick={() => {
                                setReceiptInfo((prev) => ({
                                  ...prev,
                                  nhaCungCap: s.tenNCC,
                                  soDienThoai: s.soDienThoai || "",
                                }));
                                setShowSupplierSuggestions(false);
                              }}
                            >
                              <p className="text-sm font-semibold text-slate-800">{s.tenNCC}</p>
                              <p className="text-xs text-slate-500">{s.soDienThoai || "-"}</p>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    {errors.nhaCungCap && (
                      <p className="mt-1 text-[10px] font-semibold text-rose-600 ml-1">
                        {errors.nhaCungCap}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-500">
                      Số điện thoại NCC
                    </label>
                    <input
                      type="tel"
                      value={receiptInfo.soDienThoai}
                      maxLength={15}
                      onChange={(e) =>
                        setReceiptInfo((prev) => ({
                          ...prev,
                          soDienThoai: e.target.value.replace(/\D/g, ""),
                        }))
                      }
                      className={inputCls(false)}
                      placeholder="Nhập số điện thoại"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-500">
                      Trạng thái <span className="text-rose-500">*</span>
                    </label>
                    <ReceiptStatusSelect
                      value={receiptInfo.trangThai}
                      onChange={(nextStatus) =>
                        setReceiptInfo((prev) => ({
                          ...prev,
                          trangThai: nextStatus,
                          soTienDaTra:
                            nextStatus === RECEIPT_STATUS.PARTIAL
                              ? prev.soTienDaTra
                              : 0,
                        }))
                      }
                    />
                  </div>

                  {receiptInfo.trangThai === RECEIPT_STATUS.PARTIAL && (
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-slate-500">
                        Đã trả trước
                      </label>
                      <CurrencyInput
                        value={Number(receiptInfo.soTienDaTra || 0)}
                        onChange={(v) =>
                          setReceiptInfo((prev) => ({ ...prev, soTienDaTra: v }))
                        }
                        className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/20"
                      />
                    </div>
                  )}

                  <div className="sm:col-span-2">
                    <label className="mb-1.5 block text-xs font-semibold text-slate-500">
                      Ghi chú
                    </label>
                    <input
                      value={receiptInfo.ghiChu}
                      maxLength={200}
                      onChange={(e) =>
                        setReceiptInfo((prev) => ({
                          ...prev,
                          ghiChu: e.target.value,
                        }))
                      }
                      placeholder="Ghi chú thêm về phiếu nhập..."
                      className={inputCls(false)}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200/50 bg-white shadow-sm overflow-hidden">
              <div className="bg-emerald-50/80 border-b border-emerald-100/50 px-5 py-4">
                <h3 className="font-bold text-sm md:text-base text-emerald-800 uppercase tracking-widest">
                  Thêm nguyên liệu
                </h3>
              </div>
              <div className="p-5 md:p-6 space-y-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <label className="mb-1.5 block text-xs font-semibold text-slate-500">
                      Tên nguyên liệu <span className="text-rose-500">*</span>
                    </label>
                    <input
                      value={newMaterial.tenSanPham}
                      maxLength={200}
                      onChange={(e) =>
                        setNewMaterial((prev) => ({
                          ...prev,
                          tenSanPham: e.target.value,
                        }))
                      }
                      className={inputCls(!!errors.new_tenSanPham)}
                      placeholder="Ví dụ: Bột mì, Trứng gà, Đường..."
                    />
                    {errors.new_tenSanPham && (
                      <p className="mt-1 text-[10px] font-semibold text-rose-600 ml-1">
                        {errors.new_tenSanPham}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-500">
                      Nhóm nguyên liệu
                    </label>
                    <input
                      value={newMaterial.nhomHang}
                      maxLength={80}
                      onChange={(e) =>
                        setNewMaterial((prev) => ({
                          ...prev,
                          nhomHang: e.target.value,
                        }))
                      }
                      className={inputCls(false)}
                      placeholder="Ví dụ: Khô, Tươi, Gia vị..."
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-500">
                      Đơn vị <span className="text-rose-500">*</span>
                    </label>
                    <input
                      value={newMaterial.donVi}
                      maxLength={20}
                      onChange={(e) =>
                        setNewMaterial((prev) => ({
                          ...prev,
                          donVi: e.target.value,
                        }))
                      }
                      className={inputCls(!!errors.new_donVi)}
                      placeholder="kg, gói, chai..."
                    />
                    {errors.new_donVi && (
                      <p className="mt-1 text-[10px] font-semibold text-rose-600 ml-1">
                        {errors.new_donVi}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-500">
                      Số lượng <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={newMaterial.soLuong}
                      onChange={(e) =>
                        setNewMaterial((prev) => ({
                          ...prev,
                          soLuong: Math.min(
                            100000,
                            Math.max(0, Number(e.target.value || 0)),
                          ),
                        }))
                      }
                      className={inputCls(!!errors.new_soLuong)}
                    />
                    {errors.new_soLuong && (
                      <p className="mt-1 text-[10px] font-semibold text-rose-600 ml-1">
                        {errors.new_soLuong}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-500">
                      Giá nhập <span className="text-rose-500">*</span>
                    </label>
                    <CurrencyInput
                      value={newMaterial.giaNhap}
                      onChange={(v) =>
                        setNewMaterial((prev) => ({ ...prev, giaNhap: v }))
                      }
                      className={inputCls(!!errors.new_giaNhap)}
                    />
                    {errors.new_giaNhap && (
                      <p className="mt-1 text-[10px] font-semibold text-rose-600 ml-1">
                        {errors.new_giaNhap}
                      </p>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleAddMaterial}
                  className="w-full rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 px-4 py-3 text-sm font-semibold text-white hover:shadow-lg hover:shadow-emerald-500/25"
                >
                  Thêm vào phiếu nhập
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200/50 bg-white shadow-sm overflow-hidden">
              <div className="bg-slate-50 border-b border-slate-100 px-5 py-4">
                <h3 className="font-bold text-sm md:text-base text-slate-800 uppercase tracking-widest">
                  Danh sách nguyên liệu ({materials.length})
                </h3>
              </div>
              <div className="p-5 md:p-6 space-y-3">
                {materials.length === 0 ? (
                  <p className="text-sm text-slate-500">Chưa có nguyên liệu nào trong phiếu.</p>
                ) : (
                  materials.map((m) => (
                    <div
                      key={m.id}
                      className="rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-bold text-slate-900">{m.tenSanPham}</p>
                          <p className="text-xs text-slate-500 mt-1">
                            {m.nhomHang || "-"} • {m.soLuong} {m.donVi} • Giá {fmt(m.giaNhap)}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveMaterial(m.id)}
                          className="rounded-lg px-2 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50"
                        >
                          Xóa
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="lg:col-span-4">
            <div className="sticky top-4 rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-emerald-700">
                Tổng kết phiếu nhập
              </h3>
              <div className="flex items-center justify-between text-sm text-slate-600">
                <span>Tổng mặt hàng</span>
                <strong className="text-slate-900">{materials.length}</strong>
              </div>
              <div className="flex items-center justify-between text-sm text-slate-600">
                <span>Tổng tiền phiếu</span>
                <strong className="text-emerald-700 text-lg">{fmt(totalAmount)}</strong>
              </div>
              {receiptInfo.trangThai === RECEIPT_STATUS.PARTIAL && (
                <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">
                  Còn nợ: {fmt(Math.max(totalAmount - Number(receiptInfo.soTienDaTra || 0), 0))}
                </div>
              )}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full rounded-xl bg-gradient-to-r from-rose-700 to-rose-500 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60 hover:shadow-lg hover:shadow-rose-700/25"
              >
                {isSubmitting ? "Đang gửi phiếu..." : "Lưu phiếu nhập nguyên liệu"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </main>
  );
}
