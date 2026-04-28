import { useEffect, useRef, useState } from "react";
import {
  createOrder,
  getCustomerCatalog,
  getBankConfig,
  getNextOrderFormDefaults,
  getProductCatalog,
  formatAllSheets,
} from "../api";
import { runInBackground } from "../api/backgroundApi";
import toast from "react-hot-toast";
import { openReceiptWithStrategy } from "../utils/printStrategy";
import ImageUploader from "../components/ImageUploader";
import { useUser } from "../context";
import { buildVietQrUrl } from "../utils/vietqr";
import PosCreateOrderLayout from "./pos/PosCreateOrderLayout";
import {
  formatMoney as fmt,
  normalizeText as foldText,
  toTitleCase,
  getTodayInputDate,
} from "../../core/core";

const DEFAULT_ORDER_CODE = "01";
const ORDER_DEFAULTS_CACHE_KEY = "soanhang.orderDefaults";
const BANK_CONFIG_CACHE_KEY = "soanhang.bankConfig";
const BANK_CONFIG_CACHE_TTL_MS = 30 * 60 * 1000;
const ORDER_DRAFT_KEY = "soanhang.createOrderDraft.v1";
const ORDER_DRAFT_MAX_AGE_MS = 48 * 60 * 60 * 1000;

const readCachedOrderDefaults = () => {
  try {
    const raw = sessionStorage.getItem(ORDER_DEFAULTS_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const maPhieu = String(parsed?.maPhieu || "").trim();
    const ngayBan = String(parsed?.ngayBan || "").trim();
    if (!maPhieu || !ngayBan) return null;
    return { maPhieu, ngayBan };
  } catch (e) {
    return null;
  }
};

const writeCachedOrderDefaults = (defaults) => {
  try {
    if (!defaults?.maPhieu || !defaults?.ngayBan) return;
    sessionStorage.setItem(
      ORDER_DEFAULTS_CACHE_KEY,
      JSON.stringify({
        maPhieu: String(defaults.maPhieu).trim(),
        ngayBan: String(defaults.ngayBan).trim(),
        updatedAt: Date.now(),
      }),
    );
  } catch (e) {
    // noop
  }
};

const readCachedBankConfig = () => {
  try {
    const raw = sessionStorage.getItem(BANK_CONFIG_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const updatedAt = Number(parsed?.updatedAt || 0);
    if (updatedAt && Date.now() - updatedAt > BANK_CONFIG_CACHE_TTL_MS) {
      sessionStorage.removeItem(BANK_CONFIG_CACHE_KEY);
      return null;
    }
    const bankCode = String(parsed?.bankCode || "").trim();
    const accountNumber = String(parsed?.accountNumber || "").trim();
    const accountName = String(parsed?.accountName || "").trim();
    if (!bankCode || !accountNumber) return null;
    return { bankCode, accountNumber, accountName };
  } catch (e) {
    return null;
  }
};

const writeCachedBankConfig = (config) => {
  try {
    const bankCode = String(config?.bankCode || "").trim();
    const accountNumber = String(config?.accountNumber || "").trim();
    const accountName = String(config?.accountName || "").trim();
    if (!bankCode || !accountNumber) return;
    sessionStorage.setItem(
      BANK_CONFIG_CACHE_KEY,
      JSON.stringify({
        bankCode,
        accountNumber,
        accountName,
        updatedAt: Date.now(),
      }),
    );
  } catch (e) {
    // noop
  }
};

const readOrderDraft = () => {
  try {
    const raw = localStorage.getItem(ORDER_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const updatedAt = Number(parsed?.updatedAt || 0);
    if (!updatedAt || Date.now() - updatedAt > ORDER_DRAFT_MAX_AGE_MS) {
      localStorage.removeItem(ORDER_DRAFT_KEY);
      return null;
    }
    return parsed;
  } catch (e) {
    return null;
  }
};

const writeOrderDraft = (payload) => {
  try {
    const updatedAt = Date.now();
    localStorage.setItem(
      ORDER_DRAFT_KEY,
      JSON.stringify({
        version: 1,
        updatedAt,
        payload,
      }),
    );
    return updatedAt;
  } catch (e) {
    return 0;
  }
};

const clearOrderDraft = () => {
  try {
    localStorage.removeItem(ORDER_DRAFT_KEY);
  } catch (e) {
    // noop
  }
};

const isMeaningfulDraftPayload = (payload) => {
  if (!payload) return false;
  if (Array.isArray(payload.products) && payload.products.length > 0) return true;
  if (String(payload?.customerInfo?.tenKhach || "").trim()) return true;
  if (String(payload?.newProduct?.tenSanPham || "").trim()) return true;
  if (String(payload?.orderInfo?.ghiChu || "").trim()) return true;
  return false;
};

const normalizeDraftProducts = (items) => {
  if (!Array.isArray(items)) return [];
  return items
    .slice(0, 300)
    .map((p) => ({
      id: String(p?.id || Date.now() + Math.random()),
      tenSanPham: String(p?.tenSanPham || "").trim(),
      anhSanPham: String(p?.anhSanPham || "").trim(),
      nhomHang: String(p?.nhomHang || "").trim(),
      donVi: String(p?.donVi || "").trim(),
      soLuong: Math.max(1, Number(p?.soLuong || 1)),
      donGiaBan: Math.max(0, Number(p?.donGiaBan || 0)),
      giaVon: Math.max(0, Number(p?.giaVon || 0)),
    }))
    .filter((p) => p.tenSanPham);
};

const createInitialOrderInfo = () => ({
  maPhieu: "",
  ngayBan: getTodayInputDate(),
  trangThai: "Đã thanh toán",
  trangThaiCode: "PAID",
  soTienDaTra: 0,
  ghiChu: "",
});


function CurrencyInput({ value, onChange, className }) {
  const [display, setDisplay] = useState(value ? fmt(value) : "");

  useEffect(() => {
    setDisplay(value ? fmt(value) : "");
  }, [value]);

  const handleChange = (e) => {
    const el = e.target;
    const cursorPos = el.selectionStart;
    const oldLen = el.value.length;

    const digits = e.target.value.replace(/[^0-9]/g, "");
    const num = parseInt(digits, 10) || 0;

    onChange(num);
    const formatted = num > 0 ? fmt(num) : digits;
    setDisplay(formatted);

    requestAnimationFrame(() => {
      const newLen = formatted.length;
      const diff = newLen - oldLen;
      const newPos = Math.max(0, cursorPos + diff);
      el.setSelectionRange(newPos, newPos);
    });
  };

  const handleBlur = () => {
    if (!value) setDisplay("");
    else setDisplay(fmt(value));
  };

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
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-medium pointer-events-none">
          đ
        </span>
      )}
    </div>
  );
}

function CustomerInfoSection({
  customerInfo,
  onUpdate,
  showCustomerSuggestions,
  onShowSuggestions,
  onHideSuggestions,
  customerSuggestions,
  onSelectCustomerSuggestion,
  errors = {},
}) {
  const inputCls = (hasError) =>
    `w-full rounded-xl border ${
      hasError ? "border-rose-500 ring-1 ring-rose-500/20" : "border-slate-200"
    } bg-white px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-700/20 transition-all`;

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-semibold text-slate-800 mb-2">
          Tên khách hàng <span className="text-rose-500">*</span>
        </label>
        <div className="relative">
          <input
            type="text"
            placeholder="Nhập hoặc chọn khách hàng"
            value={customerInfo.tenKhach}
            maxLength={120}
            onFocus={onShowSuggestions}
            onBlur={() => setTimeout(onHideSuggestions, 120)}
            onChange={(e) => {
              onUpdate({ ...customerInfo, tenKhach: e.target.value });
            }}
            className={inputCls(!!errors.tenKhach)}
          />
          {errors.tenKhach && (
            <p className="mt-1 text-[10px] font-semibold text-rose-600 ml-1">
              {errors.tenKhach}
            </p>
          )}
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
                  <p className="text-sm font-semibold text-slate-800">
                    {c.tenKhach}
                  </p>
                  <p className="text-xs text-slate-500">
                    {c.soDienThoai || "-"}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <div>
        <label className="block text-sm font-semibold text-slate-800 mb-2">
          Số điện thoại
        </label>
        <input
          type="tel"
          placeholder="Nhập số điện thoại"
          value={customerInfo.soDienThoai}
          maxLength={15}
          onChange={(e) =>
            onUpdate({
              ...customerInfo,
              soDienThoai: e.target.value.replace(/\D/g, ""),
            })
          }
          className={inputCls(false)}
        />
      </div>
    </div>
  );
}

function OrderInfoSection({ orderInfo, onUpdate, isLoadingDefaults }) {
  const inputCls = (hasError) =>
    `w-full min-w-0 rounded-xl border ${
      hasError ? "border-rose-500 ring-1 ring-rose-500/20" : "border-slate-200"
    } bg-white px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-700/20 transition-all`;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] gap-2 sm:gap-4">
        <div className="min-w-0">
          <label className="block text-sm font-semibold text-slate-800 mb-2">
            Mã phiếu <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            placeholder={
              isLoadingDefaults ? "Đang tạo mã phiếu..." : "Nhập mã phiếu"
            }
            value={orderInfo.maPhieu}
            maxLength={50}
            onChange={(e) =>
              onUpdate({ ...orderInfo, maPhieu: e.target.value })
            }
            className={`${inputCls(false)} px-3 sm:px-4 text-[13px] sm:text-sm`}
            disabled={isLoadingDefaults}
            readOnly
          />
        </div>
        <div className="min-w-0">
          <label className="block text-sm font-semibold text-slate-800 mb-2">
            Ngày bán <span className="text-rose-500">*</span>
          </label>
          <input
            type="date"
            lang="en-GB"
            value={orderInfo.ngayBan}
            onChange={(e) =>
              onUpdate({ ...orderInfo, ngayBan: e.target.value })
            }
            className={`${inputCls(false)} px-2 sm:px-4 text-[13px] sm:text-sm`}
            disabled={isLoadingDefaults}
          />
        </div>
      </div>
      {isLoadingDefaults && (
        <p className="text-xs text-slate-500">
          Đang lấy mã phiếu và ngày bán mới...
        </p>
      )}

      <div>
        <label className="block text-sm font-semibold text-slate-800 mb-2">
          Ghi chú đơn hàng
        </label>
        <textarea
          placeholder="Nhập ghi chú..."
          value={orderInfo.ghiChu}
          maxLength={200}
          onChange={(e) => onUpdate({ ...orderInfo, ghiChu: e.target.value })}
          className={`${inputCls(false)} resize-none`}
          rows={2}
        />
      </div>
    </div>
  );
}


function ProductListItem({
  product,
  onUpdate,
  onRemove,
  showImages = false,
}) {
  const thanhTien = product.soLuong * product.donGiaBan;
  const subText = product.nhomHang
    ? `${product.nhomHang} • ${product.donVi || "Không xác định"}`
    : product.donVi || "Không xác định";
  const giaVonError =
    product.giaVon > 0 &&
    product.donGiaBan > 0 &&
    product.giaVon > product.donGiaBan;

  return (
    <div className="rounded-2xl border border-slate-200/50 bg-gradient-to-br from-white to-white/80 p-4 md:p-5 shadow-sm hover:shadow-md transition-all duration-300 hover:border-slate-200 group">
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {showImages && (
            <div className="flex-shrink-0">
              {product.anhSanPham ? (
                <img
                  src={product.anhSanPham}
                  alt=""
                  className="w-11 h-11 rounded-lg object-cover border border-slate-200"
                  onError={(e) => {
                    e.target.style.display = "none";
                  }}
                />
              ) : (
                <div className="w-11 h-11 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 text-lg">
                  📦
                </div>
              )}
            </div>
          )}
          <div className="min-w-0">
            <p className="font-bold text-slate-800 text-base md:text-lg truncate">
              {product.tenSanPham}
            </p>
            <p className="text-sm text-slate-500 mt-0.5">{subText}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="text-red-400 hover:text-red-500 hover:bg-red-50 p-2 rounded-lg transition-all ml-2 shrink-0 md:opacity-0 md:group-hover:opacity-100"
        >
          x
        </button>
      </div>
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2 md:gap-3">
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
              Số lượng
            </label>
            <input
              type="number"
              min="0"
              value={product.soLuong}
              onChange={(e) => {
                const val =
                  e.target.value === "" ? "" : parseInt(e.target.value, 10) || 0;
                onUpdate({
                  soLuong: val === "" ? "" : Math.min(val, 100000),
                });
              }}
              onBlur={() => {
                if (product.soLuong === "" || product.soLuong < 1)
                  onUpdate({ soLuong: 1 });
              }}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 focus:border-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-700/20 transition-all"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
              Thành tiền
            </label>
            <div className="rounded-lg border border-rose-700/20 bg-gradient-to-br from-rose-50 to-rose-100/60 px-3 py-2 text-sm font-bold text-rose-700">
              {thanhTien.toLocaleString()}
            </div>
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
            Đơn giá bán
          </label>
          <CurrencyInput
            value={product.donGiaBan}
            onChange={(v) => onUpdate({ donGiaBan: v })}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 focus:border-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-700/20 transition-all"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
            Giá vốn
          </label>
          <CurrencyInput
            value={product.giaVon || 0}
            onChange={(v) => {
              if (v > 0 && product.donGiaBan > 0 && v > product.donGiaBan) {
                onUpdate({ giaVon: product.donGiaBan });
              } else {
                onUpdate({ giaVon: v });
              }
            }}
            className={`w-full rounded-lg border bg-white px-3 py-2 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 transition-all ${giaVonError ? "border-rose-500 focus:border-rose-500 focus:ring-rose-500/20" : "border-slate-200 focus:border-rose-700 focus:ring-rose-700/20"}`}
          />
          {giaVonError && (
            <p className="text-[10px] font-semibold text-rose-600 ml-1">
              Giá vốn không được lớn hơn giá bán
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function OrderSummary({ totalAmount, totalItems }) {
  return (
    <div className="rounded-2xl border border-rose-700/20 bg-gradient-to-br from-rose-50/50 via-white to-rose-100/30 p-5 md:p-6 shadow-sm">
      <div className="space-y-4">
        <div className="flex justify-between items-center gap-3">
          <span className="text-sm font-semibold text-slate-500 uppercase tracking-wider">
            Tổng mặt hàng
          </span>
          <div className="inline-flex items-center justify-center min-w-[40px] px-2 h-10 rounded-lg bg-rose-700/10 text-rose-700 font-bold">
            {totalItems}
          </div>
        </div>
        <div className="h-px bg-gradient-to-r from-slate-200/0 via-slate-200/50 to-slate-200/0" />
        <div>
          <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">
            Tổng hóa đơn
          </p>
          <p
            className={`font-bold bg-gradient-to-r from-rose-700 to-rose-500 bg-clip-text text-transparent break-all ${totalAmount > 1000000000 ? "text-2xl md:text-3xl" : "text-3xl md:text-4xl"}`}
          >
            {totalAmount.toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  );
}


function PaymentConfirmModal({
  visible,
  pendingOrder,
  closePaymentModal,
  paymentStatus,
  setPaymentStatus,
  partialAmount,
  setPartialAmount,
  isPartialOverpay,
  paymentMethod,
  setPaymentMethod,
  partialReady,
  ensureBankConfig,
  isLoadingBankConfig,
  bankError,
  bankConfig,
  handlePrintPreview,
  handleConfirmPayment,
  isSubmitting,
}) {
  if (!visible || !pendingOrder) return null;

  return (
    <div
      className="fixed inset-0 z-[9900] bg-slate-900/40 p-4"
      onClick={closePaymentModal}
    >
      <div
        className="mx-auto mt-[10vh] w-full max-w-md rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Xác nhận thanh toán đơn hàng
            </h3>
            <p className="text-sm text-slate-500 mt-1">
              Mã phiếu: {pendingOrder?.orderData?.orderInfo?.maPhieu || "-"}
            </p>
          </div>
          <button
            type="button"
            onClick={closePaymentModal}
            className="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100"
          >
            Đóng
          </button>
        </div>

        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
            Trạng thái thanh toán
          </p>
          <div className="grid grid-cols-3 gap-2">
            {[
              { code: "PAID", label: "Thanh toán tất" },
              { code: "PARTIAL", label: "Trả 1 phần" },
              { code: "DEBT", label: "Nợ" },
            ].map((st) => (
              <button
                key={st.code}
                type="button"
                onClick={() => {
                  setPaymentStatus(st.code);
                  if (st.code === "DEBT") {
                    setPaymentMethod("");
                  }
                }}
                className={`py-2 px-1 text-[11px] font-semibold rounded-xl transition-all border ${
                  paymentStatus === st.code
                    ? "bg-rose-700 border-rose-700 text-white shadow-md shadow-rose-700/20"
                    : "bg-white border-slate-200 text-slate-600 hover:border-rose-300 hover:bg-rose-50"
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>
        </div>

        {paymentStatus === "PARTIAL" && (
          <div className="mt-4">
            <label className="block text-sm font-semibold text-slate-800 mb-2">
              Số tiền đã trả trước
            </label>
            <CurrencyInput
              value={partialAmount || 0}
              onChange={(v) => setPartialAmount(v)}
              className={`w-full rounded-xl border bg-white px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 transition-all ${
                isPartialOverpay
                  ? "border-rose-400 focus:border-rose-500 focus:ring-rose-500/20"
                  : "border-slate-200 focus:border-rose-700 focus:ring-rose-700/20"
              }`}
            />
            <p
              className={`mt-1 text-xs ${
                isPartialOverpay ? "text-rose-600" : "text-slate-500"
              }`}
            >
              {isPartialOverpay
                ? "Số tiền đã trả không được lớn hơn tổng đơn."
                : "Không được lớn hơn tổng đơn."}
            </p>
          </div>
        )}

        {paymentStatus !== "DEBT" && (
          <div className="mt-4 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setPaymentMethod("cash")}
              disabled={!partialReady}
              className={`rounded-xl border px-4 py-2.5 text-sm font-semibold ${
                paymentMethod === "cash"
                  ? "border-slate-400 bg-slate-50 text-slate-700"
                  : "border-slate-200 text-slate-700 hover:bg-slate-50"
              } ${!partialReady ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              Tiền mặt
            </button>
            <button
              type="button"
              onClick={() => {
                setPaymentMethod("bank");
                ensureBankConfig();
              }}
              disabled={!partialReady}
              className={`rounded-xl border px-4 py-2.5 text-sm font-semibold ${
                paymentMethod === "bank"
                  ? "border-rose-200 bg-rose-50 text-rose-700"
                  : "border-rose-200 text-rose-700 hover:bg-rose-50"
              } ${!partialReady ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              Chuyển khoản
            </button>
          </div>
        )}
        {!partialReady && paymentStatus === "PARTIAL" && (
          <p className="mt-2 text-xs text-slate-500">
            Nhập số tiền đã trả trước để chọn phương thức thanh toán.
          </p>
        )}

        {paymentStatus !== "DEBT" && paymentMethod === "bank" && (
          <div className="mt-4 rounded-xl border border-rose-200/60 bg-rose-50/40">
            {isLoadingBankConfig && (
              <p className="text-sm text-slate-500">
                Đang tải thông tin ngân hàng...
              </p>
            )}
            {!isLoadingBankConfig && bankError && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {bankError}
              </div>
            )}
            {!isLoadingBankConfig && !bankError && bankConfig && (
              <div className="space-y-3">
                <div className="p-1 flex items-center justify-center">
                  {(() => {
                    const qrUrl = buildVietQrUrl({
                      bankCode: bankConfig.bankCode,
                      accountNumber: bankConfig.accountNumber,
                      accountName: bankConfig.accountName,
                      amount:
                        paymentStatus === "PARTIAL"
                          ? Number(partialAmount || 0)
                          : Number(pendingOrder.totalAmount || 0),
                      addInfo: (() => {
                        const maPhieu =
                          pendingOrder?.orderData?.orderInfo?.maPhieu || "";
                        if (paymentStatus !== "PARTIAL") return maPhieu;
                        const total = Number(pendingOrder.totalAmount || 0);
                        const paid = Number(partialAmount || 0);
                        const remain = Math.max(total - paid, 0);
                        const remainText = remain.toLocaleString("vi-VN");
                        return `${maPhieu} còn thiếu ${remainText}đ`;
                      })(),
                    });
                    if (!qrUrl) return null;
                    return (
                      <img
                        src={qrUrl}
                        alt="VietQR"
                        className="h-64 w-64 rounded-2xl border border-rose-200 bg-white object-contain p-3 shadow-sm"
                      />
                    );
                  })()}
                </div>
                <p className="text-center text-xs text-slate-500">
                  Quét mã để chuyển khoản
                </p>
              </div>
            )}
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={closePaymentModal}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={handlePrintPreview}
            className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100 transition-all"
          >
            In hóa đơn
          </button>
          <button
            type="button"
            onClick={handleConfirmPayment}
            disabled={isSubmitting}
            className={`rounded-xl px-4 py-2 text-sm font-semibold text-white transition-all ${
              isSubmitting
                ? "bg-slate-400 cursor-not-allowed"
                : "bg-gradient-to-r from-rose-700 to-rose-500 hover:shadow-lg hover:shadow-rose-700/25"
            }`}
          >
            {paymentStatus === "DEBT" ? "Xác nhận nợ" : "Xác nhận thanh toán"}
          </button>
        </div>
      </div>
    </div>
  );
}


/*  Main Page  */

export default function CreateOrderPage({ appMode = "web" }) {
  const { user } = useUser();
  const isPosMode = appMode === "pos";
  const [isCustomerMode, setIsCustomerMode] = useState(false);
  const [customerInfo, setCustomerInfo] = useState({
    tenKhach: "",
    soDienThoai: "",
  });

  const [orderInfo, setOrderInfo] = useState(() => {
    const initial = createInitialOrderInfo();
    const cached = readCachedOrderDefaults();
    if (!cached) return initial;
    return {
      ...initial,
      maPhieu: cached.maPhieu,
      ngayBan: cached.ngayBan,
    };
  });

  const [products, setProducts] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [isLoadingOrderDefaults, setIsLoadingOrderDefaults] = useState(
    !readCachedOrderDefaults(),
  );
  const [productCatalog, setProductCatalog] = useState([]);
  const [customerCatalog, setCustomerCatalog] = useState([]);
  const [showProductSuggestions, setShowProductSuggestions] = useState(false);
  const [showUnitSuggestions, setShowUnitSuggestions] = useState(false);
  const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState("PAID");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [partialAmount, setPartialAmount] = useState(0);
  const [pendingOrder, setPendingOrder] = useState(null);
  const [bankConfig, setBankConfig] = useState(null);
  const [bankError, setBankError] = useState("");
  const [isLoadingBankConfig, setIsLoadingBankConfig] = useState(false);
  const [newProduct, setNewProduct] = useState({
    id: "",
    tenSanPham: "",
    anhSanPham: "",
    nhomHang: "",
    donVi: "",
    soLuong: 1,
    donGiaBan: 0,
    giaVon: 0,
  });
  const [uploadingImage, setUploadingImage] = useState(false);
  const [hasDraft, setHasDraft] = useState(() => !!readOrderDraft());
  const [draftUpdatedAt, setDraftUpdatedAt] = useState(
    () => Number(readOrderDraft()?.updatedAt || 0),
  );
  const [selectedProductId, setSelectedProductId] = useState("");
  const [posKeyBuffer, setPosKeyBuffer] = useState("1");
  const didOfferRestoreRef = useRef(false);
  const loadOrderDefaults = async ({ silent = false } = {}) => {
    const today = getTodayInputDate();
    if (!silent) setIsLoadingOrderDefaults(true);
    try {
      const res = await getNextOrderFormDefaults();
      const nextCode =
        String(res?.data?.maPhieu || "").trim() || DEFAULT_ORDER_CODE;
      writeCachedOrderDefaults({
        maPhieu: nextCode,
        ngayBan: res?.data?.ngayBan || today,
      });
      setOrderInfo((prev) => ({
        ...prev,
        maPhieu: nextCode,
        ngayBan: res?.data?.ngayBan || today,
      }));
    } catch (err) {
      setOrderInfo((prev) => ({
        ...prev,
        maPhieu: prev.maPhieu || DEFAULT_ORDER_CODE,
        ngayBan: today,
      }));
    } finally {
      if (!silent) setIsLoadingOrderDefaults(false);
    }
  };

  const loadProductCatalog = async () => {
    try {
      const res = await getProductCatalog();
      if (res?.success && Array.isArray(res.data)) {
        setProductCatalog(res.data);
      } else {
        setProductCatalog([]);
      }
    } catch (err) {
      setProductCatalog([]);
    }
  };

  const loadCustomerCatalog = async () => {
    try {
      const res = await getCustomerCatalog();
      if (res?.success && Array.isArray(res.data)) {
        const cleaned = res.data.filter(
          (c) =>
            foldText(c?.tenKhach) && foldText(c?.tenKhach) !== "khach ghe tham",
        );
        setCustomerCatalog(cleaned);
      } else {
        setCustomerCatalog([]);
      }
    } catch (err) {
      setCustomerCatalog([]);
    }
  };

  const ensureBankConfig = async ({ force = false, silent = false } = {}) => {
    if ((bankConfig && !force) || isLoadingBankConfig) return;
    setIsLoadingBankConfig(true);
    if (!silent) setBankError("");
    try {
      const res = await getBankConfig();
      if (res?.success && res.data) {
        setBankConfig(res.data);
        writeCachedBankConfig(res.data);
        setBankError("");
      } else if (!silent) {
        setBankError(res?.message || "Không tải được thông tin ngân hàng.");
      }
    } catch (err) {
      if (!silent) {
        setBankError(err?.message || "Không tải được thông tin ngân hàng.");
      }
    } finally {
      setIsLoadingBankConfig(false);
    }
  };

  const openPaymentModal = (orderPayload) => {
    setPendingOrder(orderPayload);
    setPaymentStatus(orderPayload?.initialStatus || "PAID");
    setPartialAmount(orderPayload?.initialPartial || 0);
    setPaymentMethod("");
    setBankError("");
    setShowPaymentModal(true);
  };

  const closePaymentModal = () => {
    setShowPaymentModal(false);
    setPaymentMethod("");
    setPendingOrder(null);
  };

  const resetCreateOrderForm = ({ clearDraft = false } = {}) => {
    setProducts([]);
    setCustomerInfo({ tenKhach: "", soDienThoai: "" });
    setOrderInfo((prev) => ({
      ...prev,
      ghiChu: "",
    }));
    setIsCustomerMode(false);
    setNewProduct({
      id: "",
      tenSanPham: "",
      anhSanPham: "",
      nhomHang: "",
      donVi: "",
      soLuong: 1,
      donGiaBan: 0,
      giaVon: 0,
    });
    if (clearDraft) {
      clearOrderDraft();
      setHasDraft(false);
      setDraftUpdatedAt(0);
    }
  };

  const buildDraftPayload = () => ({
    isCustomerMode,
    customerInfo: {
      tenKhach: String(customerInfo?.tenKhach || "").trim(),
      soDienThoai: String(customerInfo?.soDienThoai || "").trim(),
    },
    orderInfo: {
      ghiChu: String(orderInfo?.ghiChu || "").trim(),
    },
    products: products.map((p) => ({
      id: p.id,
      tenSanPham: p.tenSanPham,
      anhSanPham: p.anhSanPham,
      nhomHang: p.nhomHang,
      donVi: p.donVi,
      soLuong: Number(p.soLuong || 0),
      donGiaBan: Number(p.donGiaBan || 0),
      giaVon: Number(p.giaVon || 0),
    })),
    newProduct: {
      tenSanPham: newProduct.tenSanPham,
      anhSanPham: newProduct.anhSanPham,
      nhomHang: newProduct.nhomHang,
      donVi: newProduct.donVi,
      soLuong: Number(newProduct.soLuong || 1),
      donGiaBan: Number(newProduct.donGiaBan || 0),
      giaVon: Number(newProduct.giaVon || 0),
    },
  });

  const saveDraftNow = ({ silent = false } = {}) => {
    const payload = buildDraftPayload();
    if (!isMeaningfulDraftPayload(payload)) {
      clearOrderDraft();
      setHasDraft(false);
      setDraftUpdatedAt(0);
      if (!silent) toast("Không có dữ liệu để lưu nháp.", { icon: "ℹ️" });
      return false;
    }
    const updatedAt = writeOrderDraft(payload);
    if (!updatedAt) {
      if (!silent) toast.error("Không lưu được nháp trên thiết bị.");
      return false;
    }
    setHasDraft(true);
    setDraftUpdatedAt(updatedAt);
    if (!silent) toast.success("Đã lưu nháp đơn hàng.");
    return true;
  };

  const restoreDraftNow = ({ silent = false } = {}) => {
    const draft = readOrderDraft();
    if (!draft?.payload) {
      setHasDraft(false);
      setDraftUpdatedAt(0);
      if (!silent) toast("Không tìm thấy bản nháp.", { icon: "ℹ️" });
      return false;
    }

    const payload = draft.payload;
    setIsCustomerMode(!!payload.isCustomerMode);
    setCustomerInfo({
      tenKhach: String(payload?.customerInfo?.tenKhach || ""),
      soDienThoai: String(payload?.customerInfo?.soDienThoai || ""),
    });
    setOrderInfo((prev) => ({
      ...prev,
      ghiChu: String(payload?.orderInfo?.ghiChu || ""),
    }));
    setProducts(normalizeDraftProducts(payload?.products));
    setNewProduct((prev) => ({
      ...prev,
      tenSanPham: String(payload?.newProduct?.tenSanPham || ""),
      anhSanPham: String(payload?.newProduct?.anhSanPham || ""),
      nhomHang: String(payload?.newProduct?.nhomHang || ""),
      donVi: String(payload?.newProduct?.donVi || ""),
      soLuong: Math.max(1, Number(payload?.newProduct?.soLuong || 1)),
      donGiaBan: Math.max(0, Number(payload?.newProduct?.donGiaBan || 0)),
      giaVon: Math.max(0, Number(payload?.newProduct?.giaVon || 0)),
    }));
    setHasDraft(true);
    setDraftUpdatedAt(Number(draft.updatedAt || 0));
    if (!silent) toast.success("Đã khôi phục bản nháp.");
    return true;
  };

  const clearDraftNow = ({ silent = false } = {}) => {
    clearOrderDraft();
    setHasDraft(false);
    setDraftUpdatedAt(0);
    if (!silent) toast.success("Đã xóa bản nháp.");
  };

  const duplicateLastProduct = () => {
    if (!products.length) {
      toast("Chưa có sản phẩm để nhân bản.", { icon: "ℹ️" });
      return;
    }
    const last = products[products.length - 1];
    setProducts((prev) => [
      ...prev,
      {
        ...last,
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        soLuong: 1,
      },
    ]);
    toast.success("Đã nhân bản sản phẩm cuối.");
  };

  const dismissKeyboard = () => {
    const el = document.activeElement;
    if (el && typeof el.blur === "function") el.blur();
  };

  const getCatalogMatch = (name) => {
    const keyword = foldText(name);
    if (!keyword) return null;
    return (
      productCatalog.find((p) => foldText(p.tenSanPham) === keyword) || null
    );
  };

  const getCatalogSuggestions = (query) => {
    const keyword = foldText(query);
    const pool = keyword
      ? productCatalog.filter((p) => foldText(p.tenSanPham).includes(keyword))
      : productCatalog;

    return pool
      .map((p) => ({
        ...p,
        variantKey: `${p.tenSanPham}-${p.donVi}`,
        displayUnit: p.donVi || "",
        displayPrice: p.donGiaBan || 0,
        displayCost: p.giaVon || 0,
        hasChanLeInfo: !!p.donViLon,
        isChan: !!p.donViLon && p.donVi === p.donViLon,
      }))
      .slice(0, 15);
  };

  const getCustomerSuggestions = (query) => {
    const keyword = foldText(query);
    if (!keyword) return customerCatalog.slice(0, 8);
    return customerCatalog
      .filter((c) => {
        const byName = foldText(c.tenKhach).includes(keyword);
        const byPhone = String(c.soDienThoai || "").includes(query.trim());
        return byName || byPhone;
      })
      .slice(0, 8);
  };

  const applyMatchedProduct = (current, tenSanPham, matched) => {
    if (!matched) return { ...current, tenSanPham };
    return {
      ...current,
      tenSanPham: tenSanPham || matched.tenSanPham || "",
      anhSanPham: matched.anhSanPham || "",
      nhomHang: matched.nhomHang || "",
      donVi: matched.displayUnit || matched.donVi || "",
      donGiaBan: Number(matched.displayPrice ?? matched.donGiaBan ?? 0),
      giaVon: Number(matched.displayCost ?? matched.giaVon ?? 0),
    };
  };

  useEffect(() => {
    const cached = readCachedOrderDefaults();
    if (cached) {
      setOrderInfo((prev) => ({
        ...prev,
        maPhieu: cached.maPhieu,
        ngayBan: cached.ngayBan,
      }));
      loadOrderDefaults({ silent: true });
    } else {
      loadOrderDefaults();
    }
    loadProductCatalog();
    loadCustomerCatalog();
    const cachedBank = readCachedBankConfig();
    if (cachedBank) {
      setBankConfig(cachedBank);
    }
    ensureBankConfig({ force: !!cachedBank, silent: true });
  }, []);

  const [showImages, setShowImages] = useState(
    () => localStorage.getItem("show_product_images") !== "false",
  );

  useEffect(() => {
    const handleImageChange = () =>
      setShowImages(localStorage.getItem("show_product_images") !== "false");
    window.addEventListener("storage", handleImageChange);
    return () => {
      window.removeEventListener("storage", handleImageChange);
    };
  }, []);

  useEffect(() => {
    if (didOfferRestoreRef.current) return;
    didOfferRestoreRef.current = true;
    const draft = readOrderDraft();
    if (!draft?.payload) return;
    setHasDraft(true);
    setDraftUpdatedAt(Number(draft.updatedAt || 0));
    if (!isPosMode) return;
    const draftProducts = Array.isArray(draft.payload.products)
      ? draft.payload.products.length
      : 0;
    if (!draftProducts) return;
    const ok = window.confirm(
      "Phát hiện bản nháp đơn hàng trước đó. Bạn có muốn khôi phục không?",
    );
    if (ok) {
      restoreDraftNow({ silent: true });
      toast.success("Đã khôi phục bản nháp trước đó.");
    }
  }, [isPosMode]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const payload = buildDraftPayload();
      if (!isMeaningfulDraftPayload(payload)) {
        clearOrderDraft();
        setHasDraft(false);
        setDraftUpdatedAt(0);
        return;
      }
      const updatedAt = writeOrderDraft(payload);
      if (updatedAt) {
        setHasDraft(true);
        setDraftUpdatedAt(updatedAt);
      }
    }, 900);
    return () => window.clearTimeout(timer);
  }, [isCustomerMode, customerInfo, orderInfo.ghiChu, products, newProduct]);

  const handleAddProduct = () => {
    const normalizedProduct = {
      ...newProduct,
      tenSanPham: toTitleCase(newProduct.tenSanPham),
      nhomHang: toTitleCase(newProduct.nhomHang),
      donVi: toTitleCase(newProduct.donVi),
    };
    const newErr = {};
    if (!normalizedProduct.tenSanPham?.trim())
      newErr.new_tenSanPham = "Chưa chọn hàng";

    const matched = getCatalogMatch(normalizedProduct.tenSanPham);
    if (matched) {
      const inputDonVi = String(normalizedProduct.donVi || "").trim();
      const units = [matched.donVi, matched.donViLon, matched.donViNho].filter(
        Boolean,
      );
      const found = units.find((u) => u.toLowerCase() === inputDonVi.toLowerCase());
      if (found) {
        normalizedProduct.donVi = found;
      } else {
        newErr.new_donVi = `Đơn vị phải là: ${[...new Set(units)].join(" hoặc ")}`;
      }
    }

    if (!normalizedProduct.soLuong || normalizedProduct.soLuong < 1)
      newErr.new_soLuong = "Sai SL";
    if (normalizedProduct.soLuong > 100000) newErr.new_soLuong = "Tối đa 100k";
    if (normalizedProduct.donGiaBan <= 0) newErr.new_donGiaBan = "Sai giá";
    if (
      normalizedProduct.giaVon > 0 &&
      normalizedProduct.donGiaBan > 0 &&
      normalizedProduct.giaVon > normalizedProduct.donGiaBan
    )
      newErr.new_giaVon = "Giá vốn không được lớn hơn giá bán";

    const isDuplicate = products.some(
      (p) =>
        p.tenSanPham.trim().toLowerCase() ===
          normalizedProduct.tenSanPham.trim().toLowerCase() &&
        p.donVi.trim().toLowerCase() ===
          String(normalizedProduct.donVi || "")
            .trim()
            .toLowerCase(),
    );
    if (isDuplicate) {
      newErr.new_tenSanPham = "Sản phẩm (kèm đơn vị) đã có trong đơn";
    }

    if (Object.keys(newErr).length > 0) {
      setErrors((p) => ({ ...p, ...newErr }));
      return;
    }

    setProducts([
      ...products,
      {
        ...normalizedProduct,
        id: Date.now().toString(),
      },
    ]);
    setNewProduct({
      id: "",
      tenSanPham: "",
      anhSanPham: "",
      nhomHang: "",
      donVi: "",
      soLuong: 1,
      donGiaBan: 0,
      giaVon: 0,
    });
    setErrors((p) => {
      const {
        new_tenSanPham,
        new_donVi,
        new_soLuong,
        new_donGiaBan,
        new_giaVon,
        ...rest
      } = p;
      return rest;
    });
  };

  const handleRemoveProduct = (id) => {
    setProducts(products.filter((p) => p.id !== id));
  };

  const handleUpdateProduct = (id, updated) => {
    setProducts(products.map((p) => (p.id === id ? { ...p, ...updated } : p)));
  };

  useEffect(() => {
    if (!products.length) {
      if (selectedProductId) setSelectedProductId("");
      return;
    }
    const exists = products.some((p) => p.id === selectedProductId);
    if (!exists) {
      setSelectedProductId(products[products.length - 1].id);
    }
  }, [products, selectedProductId]);

  const handleAddProductFromSuggestion = (item) => {
    if (!item) return;
    const tenSanPham = toTitleCase(String(item.tenSanPham || "").trim());
    const donVi = toTitleCase(String(item.displayUnit || item.donVi || "").trim());
    if (!tenSanPham || !donVi) {
      toast.error("Sản phẩm chưa đủ dữ liệu để thêm nhanh.");
      return;
    }

    const existing = products.find(
      (p) =>
        foldText(p.tenSanPham) === foldText(tenSanPham) &&
        foldText(p.donVi) === foldText(donVi),
    );

    if (existing) {
      const nextQty = Math.min(100000, Number(existing.soLuong || 0) + 1);
      handleUpdateProduct(existing.id, { soLuong: nextQty });
      setSelectedProductId(existing.id);
      setShowProductSuggestions(false);
      return;
    }

    const baseItem = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      tenSanPham,
      anhSanPham: String(item.anhSanPham || ""),
      nhomHang: String(item.nhomHang || ""),
      donVi,
      soLuong: 1,
      donGiaBan: Math.max(0, Number(item.displayPrice ?? item.donGiaBan ?? 0)),
      giaVon: Math.max(0, Number(item.displayCost ?? item.giaVon ?? 0)),
    };

    setProducts((prev) => [...prev, baseItem]);
    setSelectedProductId(baseItem.id);
    setShowProductSuggestions(false);
  };

  const applyPosQuantity = () => {
    const numeric = String(posKeyBuffer || "").replace(/[^\d]/g, "");
    const qty = Math.min(100000, Math.max(1, Number(numeric || 1)));
    if (selectedProductId) {
      handleUpdateProduct(selectedProductId, { soLuong: qty });
      return;
    }
    setNewProduct((prev) => ({ ...prev, soLuong: qty }));
  };

  const handlePosKeypadPress = (key) => {
    if (key === "AC") {
      setPosKeyBuffer("");
      return;
    }
    if (key === "⌫") {
      setPosKeyBuffer((prev) => prev.slice(0, -1));
      return;
    }
    if (key === "OK") {
      applyPosQuantity();
      return;
    }
    setPosKeyBuffer((prev) => {
      const next = `${prev}${key}`.replace(/[^\d]/g, "");
      return next.slice(0, 6);
    });
  };

  const startNewPosOrder = async () => {
    const ok = window.confirm("Tạo đơn mới? Dữ liệu hiện tại sẽ được xóa.");
    if (!ok) return;
    resetCreateOrderForm({ clearDraft: true });
    await loadOrderDefaults();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isLoadingOrderDefaults)
      return toast.error("Đang tải mã phiếu mới, vui lòng chờ...");

    const newErrors = {};
    if (isCustomerMode && !customerInfo.tenKhach?.trim()) {
      newErrors.tenKhach = "Vui lòng nhập tên khách hàng";
    }
    if (products.length === 0) {
      toast.error("Vui lòng thêm ít nhất một mặt hàng");
      return;
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      toast.error("Vui lòng kiểm tra lại thông tin");
      return;
    }

    setErrors({});
    const normalizedOrderInfo = {
      ...orderInfo,
      soTienDaTra: 0,
    };

    const orderData = {
      customer: isCustomerMode ? customerInfo : null,
      orderInfo: normalizedOrderInfo,
      products,
    };

    openPaymentModal({
      orderData,
      totalAmount,
      initialStatus: "PAID",
      initialPartial: 0,
    });
  };

  const openReceiptPage = async (
    maPhieu,
    size,
    isPreview = false,
    previewData = null,
  ) => {
    if (!maPhieu) return;
    await openReceiptWithStrategy(
      {
        code: String(maPhieu),
        size: size || "58",
        isPreview,
        previewData: previewData || "",
        autoPrint: true,
        autoBack: true,
      },
      {
        onInfo: (msg) => toast(msg, { icon: "🖨️" }),
      },
    );
  };

  const handlePrintPreview = () => {
    if (!pendingOrder?.orderData) return;
    const total = Number(pendingOrder.totalAmount || 0);

    const statusLabel =
      paymentStatus === "DEBT"
        ? "Nợ"
        : paymentStatus === "PARTIAL"
          ? paymentMethod === "bank"
            ? "Trả một phần QR"
            : "Trả một phần"
          : paymentMethod === "bank"
            ? "Đã thanh toán QR"
            : "Đã thanh toán";

    const updatedOrderInfo = {
      ...pendingOrder.orderData.orderInfo,
      trangThaiCode: paymentStatus,
      trangThai: statusLabel,
      paymentMethod: paymentStatus === "DEBT" ? "" : paymentMethod || "",
      soTienDaTra:
        paymentStatus === "PARTIAL"
          ? Number(partialAmount || 0)
          : paymentStatus === "DEBT"
            ? 0
            : total,
    };

    const previewData = {
      maPhieu: updatedOrderInfo.maPhieu,
      ngayBan: updatedOrderInfo.ngayBan,
      tenKhach: pendingOrder.orderData.customer?.tenKhach || "Khách ghé thăm",
      soDienThoai: pendingOrder.orderData.customer?.soDienThoai || "",
      ghiChu: updatedOrderInfo.ghiChu,
      trangThai: updatedOrderInfo.trangThai,
      tongHoaDon: total,
      tienNo:
        paymentStatus === "DEBT"
          ? total
          : paymentStatus === "PARTIAL"
            ? Math.max(0, total - Number(partialAmount || 0))
            : 0,
      products: pendingOrder.orderData.products.map((p) => ({
        tenSanPham: p.tenSanPham,
        donVi: p.donVi,
        soLuong: p.soLuong,
        donGiaBan: p.donGiaBan,
      })),
    };

    openReceiptPage(updatedOrderInfo.maPhieu, "58", true, JSON.stringify(previewData));
  };

  const totalAmount = products.reduce(
    (sum, p) => sum + p.soLuong * p.donGiaBan,
    0,
  );
  const totalItems = products.length; // Thay vì sum quantity, đếm số loại mặt hàng
  const formattedDraftTime = draftUpdatedAt
    ? new Date(draftUpdatedAt).toLocaleString("vi-VN")
    : "";
  const pendingTotal = Number(pendingOrder?.totalAmount || 0);
  const isPartialOverpay =
    paymentStatus === "PARTIAL" &&
    pendingTotal > 0 &&
    Number(partialAmount || 0) > pendingTotal;
  const partialReady =
    paymentStatus !== "PARTIAL" ||
    (Number(partialAmount || 0) > 0 &&
      Number(partialAmount || 0) <= pendingTotal);

  const handleConfirmPayment = () => {
    if (!pendingOrder?.orderData) return;
    const total = Number(pendingOrder.totalAmount || 0);

    if (paymentStatus === "PARTIAL") {
      const paid = Number(partialAmount || 0);
      if (paid <= 0) return toast.error("Vui lòng nhập số tiền đã trả trước");
      if (paid > total)
        return toast.error("Số tiền đã trả không được lớn hơn tổng đơn");
    }

    if (paymentStatus !== "DEBT" && !paymentMethod) {
      return toast.error("Vui lòng chọn phương thức thanh toán");
    }

    if (paymentMethod === "bank" && !bankConfig) {
      return toast.error("Chưa có thông tin ngân hàng để tạo QR");
    }

    const statusLabel =
      paymentStatus === "DEBT"
        ? "Nợ"
        : paymentStatus === "PARTIAL"
          ? paymentMethod === "bank"
            ? "Trả một phần QR"
            : "Trả một phần"
          : paymentMethod === "bank"
            ? "Đã thanh toán QR"
            : "Đã thanh toán";

    const updatedOrderInfo = {
      ...pendingOrder.orderData.orderInfo,
      trangThaiCode: paymentStatus,
      trangThai: statusLabel,
      paymentMethod: paymentStatus === "DEBT" ? "" : paymentMethod || "",
      soTienDaTra: paymentStatus === "PARTIAL" ? Number(partialAmount || 0) : 0,
    };

    const orderData = {
      ...pendingOrder.orderData,
      orderInfo: updatedOrderInfo,
    };

    const confirmMsg = "Bạn có chắc chắn muốn xác nhận thanh toán và tạo đơn?";

    if (!window.confirm(confirmMsg)) {
      return;
    }

    const maPhieu = orderData.orderInfo?.maPhieu || "";

    // Optimistic UI: clear form immediately, toast success, API runs in background
    setIsSubmitting(true);
    closePaymentModal();
    resetCreateOrderForm({ clearDraft: true });

    runInBackground({
      apiCall: () => createOrder(orderData),
      successMessage: "Đơn hàng được tạo thành công!",
      changeDescription: `Tạo đơn hàng "${maPhieu}"`,
      userName: user?.name || user?.email || "unknown",
      onComplete: (result) => {
        setIsSubmitting(false);
        // Reload data in background regardless of result
        Promise.all([
          loadOrderDefaults(),
          loadProductCatalog(),
          loadCustomerCatalog(),
        ]).catch(() => {});
        if (result?.success && !result?.queued) {
          formatAllSheets().catch(() => {});
        }
      },
    });
  };

  const inputCls = (hasError) =>
    `w-full rounded-xl border ${
      hasError ? "border-rose-500 ring-1 ring-rose-500/20" : "border-slate-200"
    } bg-white px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-700/20 transition-all`;
  const customerSuggestions = getCustomerSuggestions(customerInfo.tenKhach);
  const posProductSuggestions = getCatalogSuggestions(newProduct.tenSanPham);
  const selectedProduct = products.find((p) => p.id === selectedProductId) || null;
  const posKeypadKeys = ["7", "8", "9", "4", "5", "6", "1", "2", "3", "AC", "0", "⌫"];

  const paymentModal = (
    <PaymentConfirmModal
      visible={showPaymentModal}
      pendingOrder={pendingOrder}
      closePaymentModal={closePaymentModal}
      paymentStatus={paymentStatus}
      setPaymentStatus={setPaymentStatus}
      partialAmount={partialAmount}
      setPartialAmount={setPartialAmount}
      isPartialOverpay={isPartialOverpay}
      paymentMethod={paymentMethod}
      setPaymentMethod={setPaymentMethod}
      partialReady={partialReady}
      ensureBankConfig={ensureBankConfig}
      isLoadingBankConfig={isLoadingBankConfig}
      bankError={bankError}
      bankConfig={bankConfig}
      handlePrintPreview={handlePrintPreview}
      handleConfirmPayment={handleConfirmPayment}
      isSubmitting={isSubmitting}
    />
  );

  if (isPosMode) {
    return (
      <PosCreateOrderLayout
        newProduct={newProduct}
        setNewProduct={setNewProduct}
        showProductSuggestions={showProductSuggestions}
        setShowProductSuggestions={setShowProductSuggestions}
        getCatalogMatch={getCatalogMatch}
        applyMatchedProduct={applyMatchedProduct}
        orderInfo={orderInfo}
        startNewPosOrder={startNewPosOrder}
        posProductSuggestions={posProductSuggestions}
        handleAddProductFromSuggestion={handleAddProductFromSuggestion}
        totalItems={totalItems}
        products={products}
        selectedProductId={selectedProductId}
        setSelectedProductId={setSelectedProductId}
        handleUpdateProduct={handleUpdateProduct}
        handleRemoveProduct={handleRemoveProduct}
        customerInfo={customerInfo}
        setCustomerInfo={setCustomerInfo}
        showCustomerSuggestions={showCustomerSuggestions}
        setShowCustomerSuggestions={setShowCustomerSuggestions}
        customerSuggestions={customerSuggestions}
        setOrderInfo={setOrderInfo}
        handleAddProduct={handleAddProduct}
        posKeyBuffer={posKeyBuffer}
        posKeypadKeys={posKeypadKeys}
        handlePosKeypadPress={handlePosKeypadPress}
        selectedProduct={selectedProduct}
        totalAmount={totalAmount}
        hasDraft={hasDraft}
        formattedDraftTime={formattedDraftTime}
        saveDraftNow={saveDraftNow}
        dismissKeyboard={dismissKeyboard}
        handleSubmit={handleSubmit}
        isSubmitting={isSubmitting}
        paymentModal={paymentModal}
      />
    );
  }

  return (
    <main
      className={`min-h-screen pb-24 ${
        isPosMode
          ? "pos-create-order bg-slate-100"
          : "bg-gradient-to-br from-slate-50 via-slate-50 to-rose-50/30"
      }`}
    >
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-6 md:py-8 pb-24">
        {/* Header */}
        <div className="mb-8 md:mb-10 animate-[fadeUp_0.4s_ease] max-w-3xl">
          <div className="inline-flex items-center gap-2 mb-4 md:mb-6">
            <div className="w-3 h-3 rounded-full bg-rose-700" />
            <span className="text-xs font-bold text-rose-700 uppercase tracking-widest">
              Soạn Đơn
            </span>
          </div>
          <div className="mb-4 md:mb-6">
            <h1 className="text-4xl md:text-5xl font-black text-slate-900 leading-[1.15] md:leading-[1.2] pb-1 md:pb-2">
              Soạn Đơn
            </h1>
            <h2 className="text-4xl md:text-5xl font-black bg-gradient-to-r from-rose-700 to-rose-500 bg-clip-text text-transparent leading-[1.15] md:leading-[1.2] pb-1">
              Hàng
            </h2>
          </div>
        </div>

        {isPosMode && (
          <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => saveDraftNow({ silent: false })}
                className="rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-700"
              >
                Lưu nháp
              </button>
              <button
                type="button"
                onClick={() => restoreDraftNow({ silent: false })}
                disabled={!hasDraft}
                className={`rounded-xl px-3 py-2 text-sm font-semibold ${
                  hasDraft
                    ? "border border-cyan-200 bg-cyan-50 text-cyan-700"
                    : "border border-slate-200 bg-slate-100 text-slate-400"
                }`}
              >
                Khôi phục nháp
              </button>
              <button
                type="button"
                onClick={() => clearDraftNow({ silent: false })}
                disabled={!hasDraft}
                className={`rounded-xl px-3 py-2 text-sm font-semibold ${
                  hasDraft
                    ? "border border-slate-300 bg-slate-100 text-slate-700"
                    : "border border-slate-200 bg-slate-100 text-slate-400"
                }`}
              >
                Xóa nháp
              </button>
              <button
                type="button"
                onClick={duplicateLastProduct}
                className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700"
              >
                Nhân bản dòng cuối
              </button>
              <button
                type="button"
                onClick={dismissKeyboard}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
              >
                Ẩn bàn phím
              </button>
              <button
                type="button"
                onClick={() => {
                  const ok = window.confirm("Xóa form hiện tại và xóa nháp?");
                  if (!ok) return;
                  resetCreateOrderForm({ clearDraft: true });
                  toast.success("Đã xóa nhanh dữ liệu form.");
                }}
                className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700"
              >
                Xóa nhanh
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              {hasDraft && formattedDraftTime
                ? `Đã có nháp. Cập nhật lần cuối: ${formattedDraftTime}`
                : "Chưa có bản nháp gần đây."}
            </p>
          </section>
        )}

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="space-y-5 md:space-y-6 lg:grid lg:grid-cols-12 lg:gap-6 lg:space-y-0"
        >
          <div className="lg:col-span-8 space-y-5 md:space-y-6">
            {/* Customer Info Toggle */}
            <div className="rounded-2xl border border-slate-200/50 bg-gradient-to-br from-white to-white/80 p-5 md:p-6 shadow-sm hover:shadow-md transition-all duration-300 hover:border-slate-200">
              <button
                type="button"
                onClick={() => setIsCustomerMode(!isCustomerMode)}
                className="flex w-full items-center justify-between text-slate-800 hover:text-rose-700 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-2 h-2 rounded-full transition-colors duration-300 ${isCustomerMode ? "bg-rose-700" : "bg-slate-300"}`}
                  />
                  <span className="font-semibold text-base md:text-lg">
                    {isCustomerMode
                      ? "Đã có thông tin khách hàng"
                      : "Thông tin khách hàng (Tùy chọn)"}
                  </span>
                </div>
                <span
                  className={`text-lg transition-all ${isCustomerMode ? "rotate-180" : ""} group-hover:text-rose-700`}
                >
                  ▼
                </span>
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
                      });
                      if (errors.tenKhach)
                        setErrors((p) => {
                          const { tenKhach, ...rest } = p;
                          return rest;
                        });
                      setShowCustomerSuggestions(false);
                    }}
                    errors={errors}
                  />
                </div>
              )}
            </div>

            {/* Order Info */}
            <div className="rounded-2xl border border-slate-200/50 bg-gradient-to-br from-white to-white/80 shadow-sm hover:shadow-md transition-all duration-300 hover:border-slate-200 overflow-hidden">
              <div className="bg-rose-50/80 border-b border-rose-100/50 px-5 py-4 flex items-center gap-2.5">
                <div className="w-1.5 h-4 rounded-full bg-rose-600 shadow-sm"></div>
                <h3 className="font-bold text-sm md:text-base text-rose-800 uppercase tracking-widest mt-0.5">
                  Thông tin đơn hàng
                </h3>
              </div>
              <div className="p-5 md:p-6 pt-5">
                <OrderInfoSection
                  orderInfo={orderInfo}
                  onUpdate={setOrderInfo}
                  isLoadingDefaults={isLoadingOrderDefaults}
                />
              </div>
            </div>

            {/* Add Product Form */}
            <div className="rounded-2xl border border-slate-200/50 bg-gradient-to-br from-white to-white/80 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden">
              <div className="bg-rose-50/80 border-b border-rose-100/50 px-5 py-4 flex items-center gap-2.5">
                <div className="w-1.5 h-4 rounded-full bg-rose-600 shadow-sm"></div>
                <h3 className="font-bold text-sm md:text-base text-rose-800 uppercase tracking-widest mt-0.5">
                  Thêm vào đơn
                </h3>
              </div>

              <div className="p-5 md:p-6 pt-5 space-y-4 md:space-y-5">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-800 mb-2">
                      Tên hàng <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Ví dụ: áo phông trắng, Quần jean..."
                        value={newProduct.tenSanPham}
                        maxLength={200}
                        onFocus={() => setShowProductSuggestions(true)}
                        onBlur={() => {
                          const titleName = toTitleCase(newProduct.tenSanPham);
                          if (titleName !== newProduct.tenSanPham) {
                            setNewProduct((prev) => ({
                              ...prev,
                              tenSanPham: titleName,
                            }));
                          }
                          setTimeout(
                            () => setShowProductSuggestions(false),
                            120,
                          );
                          const matched = getCatalogMatch(titleName);
                          if (!matched) return;
                          setNewProduct((prev) => {
                            // Nếu tên đã chuẩn và đã có đơn vị (variant đã chọn), không được đè lại
                            if (
                              foldText(prev.tenSanPham) ===
                                foldText(titleName) &&
                              prev.donVi
                            ) {
                              return prev;
                            }
                            return applyMatchedProduct(
                              prev,
                              titleName,
                              matched,
                            );
                          });
                        }}
                        onChange={(e) => {
                          const tenSanPham = e.target.value;
                          const matched = getCatalogMatch(tenSanPham);
                          setNewProduct((prev) => {
                            // Tương tự: nếu đang gõ mà tên vẫn khớp cái cũ và đã có đơn vị, đừng đè
                            if (
                              foldText(prev.tenSanPham) ===
                                foldText(tenSanPham) &&
                              prev.donVi
                            ) {
                              return { ...prev, tenSanPham };
                            }
                            return applyMatchedProduct(
                              prev,
                              tenSanPham,
                              matched,
                            );
                          });
                          if (errors.new_tenSanPham)
                            setErrors((p) => {
                              const { new_tenSanPham, ...rest } = p;
                              return rest;
                            });
                        }}
                        className={inputCls(!!errors.new_tenSanPham)}
                      />
                      {errors.new_tenSanPham && (
                        <p className="mt-1 text-[10px] font-semibold text-rose-600 ml-1">
                          {errors.new_tenSanPham}
                        </p>
                      )}
                      {showProductSuggestions &&
                        getCatalogSuggestions(newProduct.tenSanPham).length >
                          0 && (
                          <div className="absolute z-30 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-slate-200 bg-white shadow-lg">
                            {getCatalogSuggestions(newProduct.tenSanPham).map(
                              (p) => (
                                <button
                                  key={
                                    p.variantKey || `${p.tenSanPham}-${p.donVi}`
                                  }
                                  type="button"
                                  className="block w-full border-b border-slate-100 px-3 py-2 text-left last:border-b-0 hover:bg-rose-50"
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
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2 min-w-0 flex-1">
                                      {showImages && p.anhSanPham ? (
                                        <img
                                          src={p.anhSanPham}
                                          alt=""
                                          className="w-8 h-8 rounded-md object-cover border border-slate-200 flex-shrink-0"
                                          onError={(e) => {
                                            e.target.style.display = "none";
                                          }}
                                        />
                                      ) : showImages ? (
                                        <div className="w-8 h-8 rounded-md bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 text-xs flex-shrink-0">
                                          📦
                                        </div>
                                      ) : null}
                                      <p className="text-sm font-semibold text-slate-800 truncate">
                                        {p.tenSanPham}
                                      </p>
                                    </div>
                                    {p.hasChanLeInfo && (
                                      <span
                                        className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold uppercase flex-shrink-0 ${p.isChan ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"}`}
                                      >
                                        {p.isChan ? "Chẵn" : "Lẻ"}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-slate-500 mt-1">
                                    {p.nhomHang || "-"} • {p.displayUnit || "-"}{" "}
                                    • Giá {fmt(p.displayPrice || 0)}
                                  </p>
                                </button>
                              ),
                            )}
                          </div>
                        )}
                    </div>
                  </div>
                  {showImages && (
                    <div>
                      <label className="block text-sm font-semibold text-slate-800 mb-2">
                        Ảnh sản phẩm
                      </label>
                      <ImageUploader
                        currentUrl={newProduct.anhSanPham}
                        onUploaded={(url) =>
                          setNewProduct((prev) => ({
                            ...prev,
                            anhSanPham: url,
                          }))
                        }
                        uploading={uploadingImage}
                        setUploading={setUploadingImage}
                      />
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-semibold text-slate-800 mb-2">
                      Nhóm hàng
                    </label>
                    <input
                      type="text"
                      placeholder="Nước, Bánh kẹo, Đồ đóng gói..."
                      value={newProduct.nhomHang}
                      maxLength={50}
                      onChange={(e) =>
                        setNewProduct((prev) => ({
                          ...prev,
                          nhomHang: e.target.value,
                        }))
                      }
                      onBlur={() =>
                        setNewProduct((prev) => ({
                          ...prev,
                          nhomHang: toTitleCase(prev.nhomHang),
                        }))
                      }
                      className={inputCls(false)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3 md:gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-slate-800 mb-2">
                        Đơn vị <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="cái, bộ, chiếc..."
                          value={newProduct.donVi}
                          maxLength={20}
                          onFocus={() => setShowUnitSuggestions(true)}
                          onChange={(e) => {
                            setNewProduct((prev) => ({
                              ...prev,
                              donVi: e.target.value,
                            }));
                            if (errors.new_donVi)
                              setErrors((p) => {
                                const { new_donVi, ...rest } = p;
                                return rest;
                              });
                          }}
                          onBlur={() => {
                            const matched = getCatalogMatch(
                              newProduct.tenSanPham,
                            );
                            setNewProduct((prev) => {
                              const inputVal = String(prev.donVi || "").trim();
                              if (matched) {
                                const found = [
                                  matched.donVi,
                                  matched.donViLon,
                                  matched.donViNho,
                                ]
                                  .filter(Boolean)
                                  .find(
                                    (u) =>
                                      u.toLowerCase() ===
                                      inputVal.toLowerCase(),
                                  );
                                if (found) return { ...prev, donVi: found };
                              }
                              return { ...prev, donVi: toTitleCase(inputVal) };
                            });
                            setTimeout(
                              () => setShowUnitSuggestions(false),
                              200,
                            );
                          }}
                          className={inputCls(!!errors.new_donVi)}
                        />
                        {errors.new_donVi && (
                          <p className="mt-1 text-[10px] font-semibold text-rose-600 ml-1">
                            {errors.new_donVi}
                          </p>
                        )}

                        {showUnitSuggestions &&
                          getCatalogMatch(newProduct.tenSanPham) && (
                            <div className="absolute top-full left-0 right-0 z-[60] mt-2 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300">
                              <div className="p-2 space-y-1">
                                {[
                                  getCatalogMatch(newProduct.tenSanPham).donVi,
                                  getCatalogMatch(newProduct.tenSanPham)
                                    .donViLon,
                                ]
                                  .filter(Boolean)
                                  .map((u, idx) => (
                                    <button
                                      key={idx}
                                      type="button"
                                      onClick={() => {
                                        setNewProduct((prev) => ({
                                          ...prev,
                                          donVi: u,
                                        }));
                                        setErrors((p) => {
                                          const { new_donVi, ...rest } = p;
                                          return rest;
                                        });
                                        setShowUnitSuggestions(false);
                                      }}
                                      className="w-full text-left p-3 rounded-xl hover:bg-slate-50 transition-colors duration-200 text-sm font-medium text-slate-700"
                                    >
                                      {u}
                                    </button>
                                  ))}
                              </div>
                            </div>
                          )}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-800 mb-2">
                        Số lượng <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="number"
                        placeholder="1"
                        min="0"
                        value={newProduct.soLuong}
                        onChange={(e) => {
                          const val = e.target.value;
                          const num = val === "" ? "" : parseInt(val) || 0;
                          setNewProduct((prev) => ({
                            ...prev,
                            soLuong: num === "" ? "" : Math.min(num, 100000),
                          }));
                          if (errors.new_soLuong)
                            setErrors((p) => {
                              const { new_soLuong, ...rest } = p;
                              return rest;
                            });
                        }}
                        onBlur={() => {
                          setNewProduct((prev) => {
                            if (prev.soLuong === "" || prev.soLuong < 1)
                              return { ...prev, soLuong: 1 };
                            return prev;
                          });
                        }}
                        className={inputCls(!!errors.new_soLuong)}
                      />
                      {errors.new_soLuong && (
                        <p className="mt-1 text-[10px] font-semibold text-rose-600 ml-1">
                          {errors.new_soLuong}
                        </p>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-800 mb-2">
                      Đơn giá bán <span className="text-rose-500">*</span>
                    </label>
                    <CurrencyInput
                      value={newProduct.donGiaBan}
                      onChange={(v) => {
                        setNewProduct((prev) => ({ ...prev, donGiaBan: v }));
                        if (errors.new_donGiaBan)
                          setErrors((p) => {
                            const { new_donGiaBan, ...rest } = p;
                            return rest;
                          });
                      }}
                      className={inputCls(!!errors.new_donGiaBan)}
                    />
                    {errors.new_donGiaBan && (
                      <p className="mt-1 text-[10px] font-semibold text-rose-600 ml-1">
                        {errors.new_donGiaBan}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-800 mb-2">
                      Giá vốn
                    </label>
                    <CurrencyInput
                      value={newProduct.giaVon || 0}
                      onChange={(v) => {
                        if (
                          v > 0 &&
                          newProduct.donGiaBan > 0 &&
                          v > newProduct.donGiaBan
                        ) {
                          setNewProduct((prev) => ({
                            ...prev,
                            giaVon: prev.donGiaBan,
                          }));
                        } else {
                          setNewProduct((prev) => ({ ...prev, giaVon: v }));
                        }
                        if (errors.new_giaVon)
                          setErrors((p) => {
                            const { new_giaVon, ...rest } = p;
                            return rest;
                          });
                      }}
                      className={inputCls(!!errors.new_giaVon)}
                    />
                    {errors.new_giaVon && (
                      <p className="mt-1 text-[10px] font-semibold text-rose-600 ml-1">
                        {errors.new_giaVon}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={handleAddProduct}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-rose-700 to-rose-500 px-4 py-3 font-semibold text-white hover:shadow-lg hover:shadow-rose-700/25 transition-all duration-300 active:scale-95"
                  >
                    Thêm vào đơn
                  </button>
                </div>
              </div>
            </div>

            {/* Products Header + List */}
            {products.length > 0 && (
              <>
                <div className="flex items-center justify-between lg:hidden">
                  <div>
                    <h2 className="text-xl md:text-2xl font-bold text-slate-800">
                      Đơn hàng
                    </h2>
                    <p className="text-xs md:text-sm text-slate-500 mt-1">
                      Các mặt hàng trong đơn
                    </p>
                  </div>
                  <div className="flex items-center justify-center min-w-[40px] px-2 h-10 md:h-12 rounded-xl bg-rose-700/10 text-rose-700 font-bold shadow-sm">
                    {totalItems}
                  </div>
                </div>
                <div className="space-y-3 lg:hidden">
                  {products.map((product) => (
                    <ProductListItem
                      key={product.id}
                      product={product}
                      showImages={showImages}
                      onUpdate={(updated) =>
                        handleUpdateProduct(product.id, updated)
                      }
                      onRemove={() => handleRemoveProduct(product.id)}
                    />
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
                <p className="text-base md:text-lg font-semibold text-slate-800 mb-1">
                  Đơn hàng trống
                </p>
                <p className="text-sm text-slate-500">
                  Thêm mặt hàng vào đơn để bắt đầu
                </p>
              </div>
            )}
          </div>

          <aside className="lg:col-span-4 lg:sticky lg:top-6 self-start space-y-4">
            {products.length > 0 && (
              <div className="hidden lg:flex items-center justify-between rounded-2xl border border-slate-200/70 bg-white p-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-800">Đơn hàng</h2>
                  <p className="text-sm text-slate-500 mt-1">
                    Các mặt hàng trong đơn
                  </p>
                </div>
                <div className="flex items-center justify-center min-w-[44px] px-2 h-11 rounded-xl bg-rose-700/10 text-rose-700 font-bold shadow-sm">
                  {totalItems}
                </div>
              </div>
            )}
            {products.length > 0 && (
              <div className="hidden lg:block space-y-3 max-h-[48vh] overflow-y-auto pr-1">
                {products.map((product) => (
                  <ProductListItem
                    key={`desktop-${product.id}`}
                    product={product}
                    showImages={showImages}
                    onUpdate={(updated) =>
                      handleUpdateProduct(product.id, updated)
                    }
                    onRemove={() => handleRemoveProduct(product.id)}
                  />
                ))}
              </div>
            )}
            <OrderSummary totalAmount={totalAmount} totalItems={totalItems} />
            {products.length > 0 ? (
              <button
                type="submit"
                disabled={isSubmitting}
                className={`w-full rounded-xl px-6 py-4 font-bold text-white text-base md:text-lg transition-all duration-300 active:scale-95 ${
                  isSubmitting
                    ? "bg-slate-400 cursor-not-allowed"
                    : "bg-gradient-to-r from-rose-700 to-rose-500 hover:shadow-lg hover:shadow-rose-700/25"
                }`}
              >
                {isSubmitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Đang gửi...
                  </span>
                ) : (
                  "Gửi đơn hàng"
                )}
              </button>
            ) : (
              <div className="rounded-2xl border border-slate-200/70 bg-white p-4 text-sm text-slate-500">
                Thêm ít nhất một sản phẩm để bật nút gửi đơn.
              </div>
            )}
          </aside>
        </form>
      </div>
      {paymentModal}
    </main>
  );
}
