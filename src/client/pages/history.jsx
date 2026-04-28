import { useEffect, useMemo, useRef, useState } from "react";
import {
  createReceiptPdf,
  deleteOrder,
  getBankConfig,
  getCustomerCatalog,
  getOrderHistory,
  getProductCatalog,
  updateOrder,
  getReceiptHistory,
  formatAllSheets,
  issueEasyInvoice,
  cancelEasyInvoice,
  replaceEasyInvoice,
  downloadInvoicePDF,
} from "../api";
import { runInBackground } from "../api/backgroundApi";
import toast from "react-hot-toast";
import { buildVietQrUrl } from "../utils/vietqr";
import { openReceiptWithStrategy } from "../utils/printStrategy";
import { useUser } from "../context";
import {
  formatMoney as fmt,
  parseNumber as toNum,
  normalizeText as foldText,
  isGuestCustomer,
  getStatusCode,
  toIsoDate,
  pad2,
  parseFlexibleDateParts,
  isValidCalendarDate,
  buildDateTokens,
  getDateSearchMeta,
  hasDateTokenMatch,
  moneyMeaning,
} from "../../core/core";

const openReceiptPage = async (order, size) => {
  const maPhieu = String(order?.maPhieu || "").trim();
  if (!maPhieu) {
    toast.error("Không tìm thấy mã phiếu để in.");
    return;
  }
  const isPdf = size === "pdf";
  const preferredExecUrl = String(import.meta.env.VITE_GAS_WEBAPP_URL || "").trim();
  const baseUrl = preferredExecUrl || `${window.location.origin}${window.location.pathname}`;
  const sizeParam =
    size === "58" ? "58" : size === "80" ? "80" : size === "pdf" ? "pdf" : "";

  if (isPdf) {
    const url = `${baseUrl}?printPdf=${encodeURIComponent(maPhieu)}${sizeParam ? `&size=${sizeParam}` : ""}`;
    const win = window.open(url, "_blank");
    if (!win) {
      toast.error("Trình duyệt đang chặn cửa sổ in hóa đơn.");
    }
  } else {
    await openReceiptWithStrategy(
      {
        code: maPhieu,
        size: sizeParam || "58",
        autoPrint: true,
        autoBack: true,
      },
      {
        onInfo: (msg) => toast(msg, { icon: "🖨️" }),
      },
    );
  }
};

const BANK_CONFIG_CACHE_KEY = "soanhang.bankConfig";
const BANK_CONFIG_CACHE_TTL_MS = 30 * 60 * 1000;

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

function MoneyInput({ value, onChange, placeholder, className = "" }) {
  const [display, setDisplay] = useState(value ? fmt(value) : "");

  useEffect(() => {
    setDisplay(value ? fmt(value) : "");
  }, [value]);

  const onInput = (e) => {
    const digits = String(e.target.value || "").replace(/[^\d]/g, "");
    const n = digits ? Number(digits) : 0;
    setDisplay(digits ? fmt(n) : "");
    onChange(n);
  };

  return (
    <input
      value={display}
      onChange={onInput}
      placeholder={placeholder}
      inputMode="numeric"
      className={
        className || "rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
      }
    />
  );
}

function StatusBadge({ status }) {
  const text = String(status || "Đã thanh toán");
  const key = getStatusCode(text);
  let cls = "bg-rose-100 text-rose-800";
  if (key === "PAID") cls = "bg-emerald-100 text-emerald-700";
  if (key === "PARTIAL") cls = "bg-violet-100 text-violet-700";
  if (key === "DEBT") cls = "bg-amber-100 text-amber-800";
  if (key === "CANCELLED") cls = "bg-slate-200 text-slate-600 border border-slate-300";
  return (
    <span
      className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${cls}`}
    >
      {text}
    </span>
  );
}

function HistoryCard({
  order,
  deleting,
  issuing,
  canceling,
  onEdit,
  onDelete,
  onIssueInvoice,
  onCancelInvoice,
  onReplaceInvoice,
  replacing,
  bankConfig,
}) {
  const [open, setOpen] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const isPartial = getStatusCode(order.trangThai) === "PARTIAL";
  const isCancelled = order.statusText === "Đã hủy" || getStatusCode(order.trangThai) === "CANCELLED";

  useEffect(() => {
    const onEsc = (e) => {
      if (e.key === "Escape") {
        setPrintOpen(false);
        setQrOpen(false);
        setInvoiceModalOpen(false);
      }
    };
    if (printOpen || qrOpen || invoiceModalOpen)
      document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, [printOpen, qrOpen, invoiceModalOpen]);

  const qrAmount = isPartial
    ? Math.max(toNum(order.tienNo), 0)
    : toNum(order.tongHoaDon);
  const qrUrl = bankConfig
    ? buildVietQrUrl({
        bankCode: bankConfig.bankCode,
        accountNumber: bankConfig.accountNumber,
        accountName: bankConfig.accountName,
        amount: qrAmount,
        addInfo: order.maPhieu,
      })
    : "";

  const handlePrintPdf = async () => {
    const maPhieu = String(order?.maPhieu || "").trim();
    if (!maPhieu) {
      toast.error("Không tìm thấy mã phiếu để in.");
      return;
    }
    const loadingId = toast.loading("Đang tạo PDF...");
    try {
      const res = await createReceiptPdf(maPhieu);
      if (res?.success && res?.url) {
        toast.success("Đã tạo PDF.", { id: loadingId });
        window.open(res.url, "_blank");
      } else {
        toast.error(res?.message || "Tạo PDF thất bại.", { id: loadingId });
      }
    } catch (e) {
      toast.error("Tạo PDF thất bại.", { id: loadingId });
    }
  };

  return (
    <article className={`rounded-2xl border ${isCancelled ? "border-slate-200 bg-slate-50/50 opacity-80 shadow-none" : "border-rose-200 bg-white shadow-sm"} p-4 md:p-5 transition-all`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-slate-500">Mã phiếu</p>
          <h3 className={`text-lg font-bold ${isCancelled ? "text-slate-500 line-through" : "text-slate-900"}`}>{order.maPhieu}</h3>
          <p className="text-sm text-slate-500 mt-1">
            Ngày bán: {order.ngayBan || "-"}
          </p>
          <p className="text-sm text-slate-500">
            Khách: {order.tenKhach || "Khách ghé thăm"}
          </p>
        </div>
        <div className="text-right">
          <StatusBadge status={order.trangThai} />
          {isPartial && Number(order.tienNo || 0) > 0 && (
            <p className="text-xs font-semibold text-amber-700 mt-2">
              Còn nợ: {fmt(order.tienNo)}
            </p>
          )}
          <p className="text-xs text-slate-500 mt-2">Tổng hóa đơn</p>
          <p className={`text-lg font-bold ${isCancelled ? "text-slate-400 line-through" : "text-rose-700"}`}>
            {fmt(order.tongHoaDon)}
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-sm text-slate-600 truncate">
          Ghi chú: {order.ghiChu || "-"}
        </p>
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
                <p className="text-sm font-semibold text-slate-800">
                  {p.tenSanPham}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {p.donVi || "-"} | SL {fmt(p.soLuong)} | Đơn giá{" "}
                  {fmt(p.donGiaBan)}
                </p>
                <p className="mt-1 text-sm font-bold text-slate-800">
                  Thành tiền: {fmt(p.thanhTien)}
                </p>
              </div>
            ))}
          </div>

          <div className="hidden md:block overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide whitespace-nowrap">
                    Sản phẩm
                  </th>
                  <th className="px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide whitespace-nowrap">
                    Đơn vị
                  </th>
                  <th className="px-3 py-2.5 text-right text-xs font-bold uppercase tracking-wide whitespace-nowrap">
                    SL
                  </th>
                  <th className="px-3 py-2.5 text-right text-xs font-bold uppercase tracking-wide whitespace-nowrap">
                    Đơn giá
                  </th>
                  <th className="px-3 py-2.5 text-right text-xs font-bold uppercase tracking-wide whitespace-nowrap">
                    Thành tiền
                  </th>
                </tr>
              </thead>
              <tbody>
                {order.products.map((p, idx) => (
                  <tr
                    key={`${order.maPhieu}-${idx}`}
                    className="border-t border-slate-100"
                  >
                    <td className="px-3 py-2 text-slate-800 whitespace-nowrap">
                      {p.tenSanPham}
                    </td>
                    <td className="px-3 py-2 text-slate-600 whitespace-nowrap">
                      {p.donVi || "-"}
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      {fmt(p.soLuong)}
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      {fmt(p.donGiaBan)}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold text-slate-800 whitespace-nowrap">
                      {fmt(p.thanhTien)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-3 py-2.5 bg-slate-50/60">
            {bankConfig && (
              <button
                type="button"
                onClick={() => setQrOpen(true)}
                className="shrink-0 px-3 py-1.5 text-xs font-semibold rounded-lg border border-blue-200 text-blue-700 hover:bg-blue-50"
              >
                QR ck
              </button>
            )}
            <button
              type="button"
              onClick={() => setPrintOpen(true)}
              className="shrink-0 px-3 py-1.5 text-xs font-semibold rounded-lg border border-emerald-200 text-emerald-700 hover:bg-emerald-50"
            >
              In hóa đơn
            </button>
            <button
              type="button"
              onClick={onEdit}
              className="shrink-0 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 text-slate-700 hover:bg-white"
            >
              Sửa
            </button>
            {order.invoiceNo ? (
              <button
                type="button"
                onClick={() => setInvoiceModalOpen(true)}
                className="shrink-0 px-3 py-1.5 text-xs font-semibold rounded-lg border border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 flex items-center gap-1.5"
                title={`HĐ Đỏ Số: ${order.invoiceNo} - Trạng thái: ${order.statusText || "Đang xử lý"}`}
              >
                HĐĐT
                <span
                  className={`w-2 h-2 rounded-full ${order.statusText === "Đã hủy" || isCancelled ? "bg-rose-500" : "bg-emerald-500"}`}
                ></span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setInvoiceModalOpen(true)}
                disabled={issuing || isCancelled}
                className="shrink-0 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                Hóa đơn ĐT
              </button>
            )}
            <button
              type="button"
              onClick={onDelete}
              disabled={deleting || isCancelled}
              className="shrink-0 px-3 py-1.5 text-xs font-semibold rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50 disabled:opacity-50"
            >
              {deleting ? "Đang xóa..." : "Xóa"}
            </button>
          </div>
        </div>
      )}
      {invoiceModalOpen && (
        <div
          className="fixed inset-0 z-[9900] bg-slate-900/40 p-4"
          onClick={() => setInvoiceModalOpen(false)}
        >
          <div
            className="mx-auto mt-[18vh] w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-slate-900 mb-1">
              Hóa Đơn Điện Tử (HSM)
            </h3>
            <p className="text-sm text-slate-500 mb-4">
              Mã phiếu: {order.maPhieu}
            </p>

            {order.invoiceNo ? (
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 mb-4">
                <p className="text-sm font-semibold text-slate-700">
                  Thông tin HĐĐT
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Số hóa đơn:{" "}
                  <span className="font-bold text-slate-800">
                    {order.invoiceNo}
                  </span>
                </p>
                <p className="text-xs text-slate-500">
                  Mã tra cứu: {String(order.lookupCode || "").split("|IKEY:")[0]}
                </p>
                <p className="text-xs text-slate-500">
                  Trạng thái:{" "}
                  <span
                    className={`font-bold ${order.statusText === "Đã hủy" ? "text-rose-600" : "text-emerald-600"}`}
                  >
                    {order.statusText || "Đang xử lý"}
                  </span>
                </p>
                {order.taxAuthorityCode && (
                  <p className="text-xs text-slate-500 mt-1 pb-1 border-t border-slate-100 pt-1">
                    Mã CQT:{" "}
                    <span className="font-medium text-slate-800 break-all">
                      {order.taxAuthorityCode}
                    </span>
                  </p>
                )}
              </div>
            ) : (
              <div className={`bg-amber-50 p-3 rounded-xl border ${isCancelled ? "border-rose-200 bg-rose-50/50" : "border-amber-200"} mb-4`}>
                <p className={`text-sm font-medium ${isCancelled ? "text-rose-700" : "text-amber-700"}`}>
                  {isCancelled ? "Hóa đơn này đã bị Hủy. Bạn có thể Sửa đơn hàng và Phát hành hóa đơn mới bên dưới." : "Đơn hàng này chưa được xuất Hóa đơn điện tử."}
                </p>
              </div>
            )}

            <div className="space-y-2 mt-2">
              {(!order.invoiceNo || isCancelled) && (
                <button
                  onClick={() => {
                    onIssueInvoice();
                    setInvoiceModalOpen(false);
                  }}
                  disabled={issuing}
                  className="w-full rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
                >
                  {issuing ? "Đang xuất..." : isCancelled ? "Phát hành lại HĐĐT mới" : "Tiến hành xuất HĐĐT"}
                </button>
              )}
              {order.invoiceNo && order.statusText !== "Đã hủy" && (
                <button
                  onClick={() => {
                    const ok = window.confirm(
                      "Bạn có chắc chắn muốn Hủy hóa đơn này và báo cáo lên Thuế?\nHành động này không thể hoàn tác!",
                    );
                    if (ok) {
                      onCancelInvoice();
                      setInvoiceModalOpen(false);
                    }
                  }}
                  disabled={canceling}
                  className="w-full rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-60"
                >
                  {canceling
                    ? "Đang xử lý hủy..."
                    : "Hủy Hóa Đơn (Báo Cáo Thuế)"}
                </button>
              )}
              {order.invoiceNo && !isCancelled && (
                <button
                  onClick={() => {
                    const ok = window.confirm(
                      "Bạn sẽ xuất 1 hóa đơn mới với số mới (Hóa đơn thay thế) và báo cáo thuế, Hóa đơn cũ này sẽ bị thay thế. Bạn có chắc chắn?",
                    );
                    if (ok) {
                      onReplaceInvoice();
                      setInvoiceModalOpen(false);
                    }
                  }}
                  disabled={replacing}
                  className="w-full rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-60"
                >
                  {replacing
                    ? "Đang cập nhật..."
                    : "Lưu Cập Nhật (Thay Thế HĐĐT)"}
                </button>
              )}
              {order.invoiceNo && (
                <button
                  disabled={downloading}
                  onClick={async () => {
                    setDownloading(true);
                    try {
                      const res = await downloadInvoicePDF({
                        maPhieu: order.maPhieu,
                      });
                      if (res?.success && res.base64) {
                        const byteCharacters = atob(res.base64);
                        const byteNumbers = new Array(byteCharacters.length);
                        for (let i = 0; i < byteCharacters.length; i++) {
                          byteNumbers[i] = byteCharacters.charCodeAt(i);
                        }
                        const byteArray = new Uint8Array(byteNumbers);
                        const blob = new Blob([byteArray], {
                          type: "application/pdf",
                        });
                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = res.filename || `HoaDon_${order.maPhieu}.pdf`;
                        document.body.appendChild(a);
                        a.click();
                        window.URL.revokeObjectURL(url);
                        document.body.removeChild(a);
                        toast.success("Đang tải hóa đơn...");
                      } else {
                        toast.error(res?.message || "Không thể tải file PDF");
                      }
                    } catch (err) {
                      toast.error("Lỗi khi tải file: " + err.message);
                    } finally {
                      setDownloading(false);
                    }
                  }}
                  className="w-full mb-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-sm font-semibold text-indigo-700 hover:bg-indigo-100 flex items-center justify-center gap-2"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M12 15V3m0 12l-4-4m4 4l4-4M4 17v1a2 2 0 002 2h12a2 2 0 002-2v-1"
                    ></path>
                  </svg>
                  {downloading ? "Đang tải..." : "Tải hóa đơn (PDF)"}
                </button>
              )}
              <button
                onClick={() => setInvoiceModalOpen(false)}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Đóng cửa sổ
              </button>
            </div>
          </div>
        </div>
      )}
      {printOpen && (
        <div
          className="fixed inset-0 z-[9900] bg-slate-900/40 p-4"
          onClick={() => setPrintOpen(false)}
        >
          <div
            className="mx-auto mt-[18vh] w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-1.5 h-5 rounded-full bg-rose-600 shadow-sm mt-0.5"></div>
              <h3 className="text-base font-black text-slate-900 tracking-tight">
                Chọn kiểu in hóa đơn
              </h3>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Mã phiếu: {order.maPhieu}
            </p>
            <div className="mt-4 space-y-2">
              <button
                type="button"
                onClick={() => {
                  setPrintOpen(false);
                  handlePrintPdf();
                }}
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                In PDF (A4)
              </button>
              <button
                type="button"
                onClick={() => {
                  setPrintOpen(false);
                  openReceiptPage(order, "58");
                }}
                className="w-full rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700"
              >
                In khổ 58mm (máy in nhiệt)
              </button>
              <button
                type="button"
                onClick={() => {
                  setPrintOpen(false);
                  openReceiptPage(order, "80");
                }}
                className="w-full rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700"
              >
                In khổ 80mm (máy in nhiệt)
              </button>
            </div>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setPrintOpen(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
      {qrOpen && (
        <div
          className="fixed inset-0 z-[9900] bg-slate-900/40 p-4"
          onClick={() => setQrOpen(false)}
        >
          <div
            className="mx-auto mt-[10vh] w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-1.5 h-5 rounded-full bg-rose-600 shadow-sm mt-0.5"></div>
              <h3 className="text-base font-black text-slate-900 tracking-tight">
                QR Chuyển khoản
              </h3>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Mã phiếu: {order.maPhieu}
            </p>
            <p className="mt-0.5 text-sm text-slate-500">
              Số tiền:{" "}
              <strong className="text-rose-700">{fmt(qrAmount)}</strong>
            </p>
            {qrUrl ? (
              <div className="mt-4 flex justify-center">
                <img
                  src={qrUrl}
                  alt="VietQR"
                  className="w-full max-w-[280px] rounded-xl border border-slate-200"
                />
              </div>
            ) : (
              <p className="mt-4 text-sm text-red-500 text-center">
                Không tạo được mã QR. Vui lòng kiểm tra cấu hình ngân hàng.
              </p>
            )}
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setQrOpen(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </article>
  );
}

function EditOrderModal({
  order,
  saving,
  onClose,
  onSave,
  productCatalog,
  customerCatalog,
}) {
  const [form, setForm] = useState(() => ({
    maPhieuOriginal: order.maPhieu,
    maPhieu: order.maPhieu,
    ngayBan: toIsoDate(order.ngayBan),
    tenKhach:
      order.tenKhach === "Khách ghé thăm" ? "" : String(order.tenKhach || ""),
    soDienThoai: String(order.soDienThoai || ""),
    ghiChu: String(order.ghiChu || "-"),
    trangThaiCode: getStatusCode(order.trangThai),
    soTienDaTra:
      getStatusCode(order.trangThai) === "PARTIAL"
        ? Math.max(toNum(order.tongHoaDon) - toNum(order.tienNo), 0)
        : 0,
    products: (order.products || []).map((p) => ({
      tenSanPham: p.tenSanPham || "",
      nhomHang: p.nhomHang || "",
      donVi: p.donVi || "",
      soLuong: toNum(p.soLuong) || 1,
      giaVon: toNum(p.giaVon),
      donGiaBan: toNum(p.donGiaBan),
    })),
  }));
  const [errors, setErrors] = useState({});
  const [suggestIndex, setSuggestIndex] = useState(-1);
  const [showCustomerSuggest, setShowCustomerSuggest] = useState(false);

  const total = useMemo(
    () =>
      form.products.reduce(
        (sum, p) => sum + toNum(p.soLuong) * toNum(p.donGiaBan),
        0,
      ),
    [form.products],
  );

  const validate = () => {
    const err = {};
    if (!form.maPhieu?.trim()) err.maPhieu = "Cần mã phiếu";
    if (!form.ngayBan) err.ngayBan = "Cần ngày";

    const validProducts = form.products.filter(
      (p) => p.tenSanPham?.trim() && p.donGiaBan > 0,
    );
    if (validProducts.length === 0) {
      err.products = "Cần ít nhất 1 SP hợp lệ";
    }

    if (form.trangThaiCode === "PARTIAL") {
      if (!form.soTienDaTra || form.soTienDaTra <= 0)
        err.soTienDaTra = "Nhập tiền trả";
      else if (form.soTienDaTra > total) err.soTienDaTra = "Lớn hơn tổng";
    }

    setErrors(err);
    return Object.keys(err).length === 0;
  };

  const inputCls = (hasError) =>
    `w-full rounded-xl border ${
      hasError ? "border-rose-500 ring-1 ring-rose-500/20" : "border-slate-200"
    } px-3 py-2.5 text-sm focus:border-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-700/20 transition-all`;

  const updateProduct = (idx, patch) => {
    setForm((prev) => ({
      ...prev,
      products: prev.products.map((p, i) =>
        i === idx ? { ...p, ...patch } : p,
      ),
    }));
  };

  const removeProduct = (idx) => {
    setForm((prev) => ({
      ...prev,
      products: prev.products.filter((_, i) => i !== idx),
    }));
  };

  const getSuggestions = (query) => {
    const q = foldText(query);
    if (!q) return (productCatalog || []).slice(0, 8);
    return (productCatalog || [])
      .filter((p) => foldText(p.tenSanPham).includes(q))
      .slice(0, 8);
  };

  const getCustomerSuggestions = (query) => {
    const q = foldText(query);
    if (!q)
      return (customerCatalog || [])
        .filter((c) => !isGuestCustomer(c.tenKhach))
        .slice(0, 8);
    return (customerCatalog || [])
      .filter(
        (c) =>
          !isGuestCustomer(c.tenKhach) &&
          (foldText(c.tenKhach).includes(q) ||
            foldText(c.soDienThoai).includes(q)),
      )
      .slice(0, 8);
  };

  return (
    <div
      className="fixed inset-0 z-[9800] bg-slate-900/45 p-3 md:p-6"
      onClick={onClose}
    >
      <div
        className="mx-auto max-w-3xl rounded-2xl bg-white shadow-2xl border border-slate-200 max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-slate-200 px-4 py-3 md:px-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 mb-1">
              <div className="w-1.5 h-5 rounded-full bg-rose-600 shadow-sm mt-0.5"></div>
              <h3 className="text-base md:text-lg font-black text-slate-900 tracking-tight">
                Sửa hóa đơn {order.maPhieu}
              </h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100"
            >
              Đóng
            </button>
          </div>
        </div>

        <div className="p-4 md:p-5 space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <input
                value={form.maPhieu}
                onChange={(e) => {
                  setForm((p) => ({ ...p, maPhieu: e.target.value }));
                  if (errors.maPhieu)
                    setErrors((prev) => {
                      const { maPhieu, ...rest } = prev;
                      return rest;
                    });
                }}
                placeholder="Mã phiếu"
                className={inputCls(!!errors.maPhieu)}
                readOnly
              />
              {errors.maPhieu && (
                <p className="mt-1 text-[10px] font-semibold text-rose-600 ml-1">
                  {errors.maPhieu}
                </p>
              )}
            </div>
            <div>
              <input
                type="date"
                lang="en-GB"
                value={form.ngayBan}
                onChange={(e) => {
                  setForm((p) => ({ ...p, ngayBan: e.target.value }));
                  if (errors.ngayBan)
                    setErrors((prev) => {
                      const { ngayBan, ...rest } = prev;
                      return rest;
                    });
                }}
                className={inputCls(!!errors.ngayBan)}
              />
              {errors.ngayBan && (
                <p className="mt-1 text-[10px] font-semibold text-rose-600 ml-1">
                  {errors.ngayBan}
                </p>
              )}
            </div>
            <div className="relative">
              <input
                value={form.tenKhach}
                onChange={(e) => {
                  setForm((p) => ({ ...p, tenKhach: e.target.value }));
                  setShowCustomerSuggest(true);
                }}
                onFocus={() => setShowCustomerSuggest(true)}
                onBlur={() =>
                  setTimeout(() => setShowCustomerSuggest(false), 120)
                }
                placeholder="Tên khách (để trống = Khách ghé thăm)"
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
              />
              {showCustomerSuggest &&
                getCustomerSuggestions(form.tenKhach).length > 0 && (
                  <div className="absolute z-40 mt-1 max-h-52 w-full overflow-auto rounded-xl border border-slate-200 bg-white shadow-lg">
                    {getCustomerSuggestions(form.tenKhach).map((c) => (
                      <button
                        key={`${c.tenKhach}-${c.soDienThoai}`}
                        type="button"
                        onMouseDown={(ev) => ev.preventDefault()}
                        onClick={() => {
                          setForm((p) => ({
                            ...p,
                            tenKhach: c.tenKhach || "",
                            soDienThoai: String(c.soDienThoai || ""),
                          }));
                          setShowCustomerSuggest(false);
                        }}
                        className="block w-full border-b border-slate-100 px-3 py-2 text-left last:border-b-0 hover:bg-rose-50"
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
            <input
              value={form.soDienThoai}
              onChange={(e) =>
                setForm((p) => ({ ...p, soDienThoai: e.target.value }))
              }
              placeholder="Số điện thoại"
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
            />
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
          {(form.trangThaiCode === "PARTIAL" ||
            form.trangThaiCode === "DEBT") && (
            <div className="space-y-1">
              <MoneyInput
                value={form.soTienDaTra}
                onChange={(v) => {
                  setForm((p) => ({ ...p, soTienDaTra: v }));
                  if (errors.soTienDaTra)
                    setErrors((prev) => {
                      const { soTienDaTra, ...rest } = prev;
                      return rest;
                    });
                }}
                placeholder="Số tiền đã trả trước"
              />
              {errors.soTienDaTra && (
                <p className="mt-1 text-[10px] font-semibold text-rose-600 ml-1">
                  {errors.soTienDaTra}
                </p>
              )}
              <p className="text-xs font-semibold text-slate-700">
                Tiền đã trả:{" "}
                <span className="text-rose-700">
                  {fmt(form.soTienDaTra)} VND
                </span>
              </p>
            </div>
          )}

          <textarea
            value={form.ghiChu}
            onChange={(e) => setForm((p) => ({ ...p, ghiChu: e.target.value }))}
            rows={2}
            placeholder="Ghi chú"
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm resize-none"
          />

          <div className="space-y-3">
            {form.products.map((p, idx) => (
              <div
                key={`edit-p-${idx}`}
                className="rounded-xl border border-slate-200 p-3 space-y-2"
              >
                <div className="grid gap-2 md:grid-cols-2">
                  <div className="relative">
                    <input
                      value={p.tenSanPham}
                      onFocus={() => setSuggestIndex(idx)}
                      onBlur={() => setTimeout(() => setSuggestIndex(-1), 120)}
                      onChange={(e) => {
                        updateProduct(idx, { tenSanPham: e.target.value });
                        setSuggestIndex(idx);
                        if (errors.products)
                          setErrors((prev) => {
                            const { products, ...rest } = prev;
                            return rest;
                          });
                      }}
                      placeholder="Tên sản phẩm"
                      className={inputCls(errors.products && !p.tenSanPham)}
                      readOnly
                    />
                    {suggestIndex === idx &&
                      getSuggestions(p.tenSanPham).length > 0 && (
                        <div className="absolute z-40 mt-1 max-h-52 w-full overflow-auto rounded-xl border border-slate-200 bg-white shadow-lg">
                          {getSuggestions(p.tenSanPham).map((sp) => (
                            <button
                              key={`${sp.tenSanPham}-${sp.donVi}`}
                              type="button"
                              onMouseDown={(ev) => ev.preventDefault()}
                              onClick={() => {
                                updateProduct(idx, {
                                  tenSanPham: sp.tenSanPham || "",
                                  nhomHang: sp.nhomHang || "",
                                  donVi: sp.donVi || "",
                                  donGiaBan: toNum(sp.donGiaBan),
                                });
                                setSuggestIndex(-1);
                              }}
                              className="block w-full border-b border-slate-100 px-3 py-2 text-left last:border-b-0 hover:bg-rose-50"
                            >
                              <p className="text-sm font-semibold text-slate-800">
                                {sp.tenSanPham}
                              </p>
                              <p className="text-xs text-slate-500">
                                {sp.nhomHang || "-"} • {sp.donVi || "-"} | Bán{" "}
                                {fmt(sp.donGiaBan || 0)}
                              </p>
                            </button>
                          ))}
                        </div>
                      )}
                  </div>
                  <input
                    value={p.donVi}
                    onChange={(e) =>
                      updateProduct(idx, { donVi: e.target.value })
                    }
                    placeholder="Đơn vị"
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    readOnly
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    value={p.soLuong}
                    onChange={(e) => {
                      const val = toNum(e.target.value) || 1;
                      updateProduct(idx, {
                        soLuong: Math.min(val, 100000),
                      });
                    }}
                    placeholder="SL"
                    className={inputCls(false)}
                  />
                  <MoneyInput
                    value={p.donGiaBan}
                    onChange={(v) => {
                      updateProduct(idx, { donGiaBan: v });
                      if (errors.products)
                        setErrors((prev) => {
                          const { products, ...rest } = prev;
                          return rest;
                        });
                    }}
                    placeholder="Đơn giá bán"
                    className={inputCls(errors.products && p.donGiaBan <= 0)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-rose-700">
                    Thành tiền: {fmt(toNum(p.soLuong) * toNum(p.donGiaBan))}
                  </p>
                  <button
                    type="button"
                    onClick={() => removeProduct(idx)}
                    className="text-xs font-semibold text-rose-700"
                  >
                    Xóa sản phẩm
                  </button>
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={() => {
                setForm((p) => ({
                  ...p,
                  products: [
                    ...p.products,
                    {
                      tenSanPham: "",
                      nhomHang: "",
                      donVi: "",
                      soLuong: 1,
                      giaVon: 0,
                      donGiaBan: 0,
                    },
                  ],
                }));
                if (errors.products)
                  setErrors((prev) => {
                    const { products, ...rest } = prev;
                    return rest;
                  });
              }}
              className="w-full rounded-xl border border-dashed border-slate-300 py-2 text-sm text-slate-600 relative"
            >
              + Thêm sản phẩm
              {errors.products && (
                <p className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-rose-600">
                  {errors.products}
                </p>
              )}
            </button>
          </div>

          <div className="rounded-xl bg-rose-50 border border-rose-200 px-3 py-2.5 text-sm font-semibold text-slate-700">
            Tổng hóa đơn: {fmt(total)}
          </div>
        </div>

        <div className="sticky bottom-0 bg-white border-t border-slate-200 p-4 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-700"
          >
            Hủy
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => {
              if (validate()) onSave(form, total);
              else toast.error("Vui lòng kiểm tra lại thông tin");
            }}
            className={`flex-1 rounded-xl py-2.5 text-sm font-semibold text-white ${
              saving
                ? "bg-slate-400"
                : "bg-gradient-to-r from-rose-700 to-rose-500"
            }`}
          >
            {saving ? "Đang lưu..." : "Lưu thay đổi"}
          </button>
        </div>
      </div>
    </div>
  );
}

function StatusDropdown({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const options = [
    { value: "ALL", label: "Tất cả trạng thái" },
    { value: "PAID", label: "Đã thanh toán" },
    { value: "PARTIAL", label: "Trả một phần" },
    { value: "DEBT", label: "Nợ" },
  ];

  useEffect(() => {
    const onDocClick = (e) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target)) setOpen(false);
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

  const selected = options.find((o) => o.value === value) || options[0];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left text-sm font-semibold text-slate-800 shadow-sm focus:border-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-700/20 transition-all"
      >
        <span>{selected.label}</span>
        <span
          className={`absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
        >
          ▾
        </span>
      </button>
      {open && (
        <div className="absolute z-40 mt-1.5 max-h-56 w-full overflow-auto rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              className={`block w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                value === opt.value
                  ? "bg-rose-50 text-rose-700 font-semibold"
                  : "text-slate-700 hover:bg-rose-50"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CustomDropdown({ value, onChange, options, className = "" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onDocClick = (e) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target)) setOpen(false);
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

  const selected = options.find((o) => o.value === value) ||
    options[0] || { label: "" };

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative min-w-[120px] w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-left text-sm font-semibold text-slate-800 shadow-[0_2px_8px_rgba(0,0,0,0.04)] focus:border-rose-700 focus:outline-none focus:ring-1 focus:ring-rose-500/50 transition-all"
      >
        <span className="block pr-5 truncate">{selected.label}</span>
        <span
          className={`absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
        >
          ▾
        </span>
      </button>
      {open && (
        <div className="absolute z-40 mt-1.5 max-h-56 min-w-max w-full overflow-auto rounded-xl border border-slate-200 bg-white p-1 shadow-lg right-0">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              className={`block w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                value === opt.value
                  ? "bg-rose-50 text-rose-700 font-semibold"
                  : "text-slate-700 hover:bg-rose-50"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function FilterFields({
  filters,
  setFilters,
  statusFilter,
  setStatusFilter,
  activeTab,
}) {
  const inputCls =
    "w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-rose-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-700/20 transition-all";

  return (
    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
      <div>
        <label className="mb-1 block text-xs font-semibold text-slate-500 uppercase tracking-wide">
          Trạng thái
        </label>
        <StatusDropdown value={statusFilter} onChange={setStatusFilter} />
      </div>
      <div>
        <label className="mb-1 block text-xs font-semibold text-slate-500 uppercase tracking-wide">
          Từ ngày
        </label>
        <input
          type="date"
          lang="en-GB"
          value={filters.fromDate}
          onChange={(e) =>
            setFilters((p) => ({ ...p, fromDate: e.target.value }))
          }
          className={inputCls}
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-semibold text-slate-500 uppercase tracking-wide">
          Đến ngày
        </label>
        <input
          type="date"
          lang="en-GB"
          value={filters.toDate}
          onChange={(e) =>
            setFilters((p) => ({ ...p, toDate: e.target.value }))
          }
          className={inputCls}
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-semibold text-slate-500 uppercase tracking-wide">
          {activeTab === "orders" ? "Tên khách" : "Nhà cung cấp"}
        </label>
        <input
          value={filters.tenKhach}
          onChange={(e) =>
            setFilters((p) => ({ ...p, tenKhach: e.target.value }))
          }
          placeholder={
            activeTab === "orders" ? "Nhập tên khách" : "Nhập nhà CC"
          }
          className={inputCls}
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-semibold text-slate-500 uppercase tracking-wide">
          Mã phiếu
        </label>
        <input
          value={filters.maPhieu}
          onChange={(e) =>
            setFilters((p) => ({ ...p, maPhieu: e.target.value }))
          }
          placeholder="VD: DH012"
          className={inputCls}
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-semibold text-slate-500 uppercase tracking-wide">
          Tên sản phẩm
        </label>
        <input
          value={filters.tenSanPham}
          onChange={(e) =>
            setFilters((p) => ({ ...p, tenSanPham: e.target.value }))
          }
          placeholder="Nhập tên sản phẩm"
          className={inputCls}
        />
      </div>
    </div>
  );
}

function ReceiptHistoryCard({ receipt }) {
  const [open, setOpen] = useState(false);
  const total =
    receipt.tongTienPhieu ||
    (receipt.products || []).reduce((acc, p) => acc + p.thanhTien, 0);

  return (
    <article className="rounded-2xl border border-blue-200 bg-white p-4 md:p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-slate-500">Mã phiếu nhập</p>
          <h3 className="text-lg font-bold text-slate-900">
            {receipt.maPhieu}
          </h3>
          <p className="text-sm text-slate-500 mt-1">
            Ngày nhập: {receipt.ngayNhap || "-"}
          </p>
          <p className="text-sm text-slate-500">
            NCC: {receipt.nhaCungCap || "Không rõ"}
          </p>
        </div>
        <div className="text-right">
          <StatusBadge status={receipt.trangThai || "Đã thanh toán"} />
          <p className="text-xs text-slate-500 mt-2">Tổng tiền phiếu</p>
          <p className="text-lg font-bold text-blue-700">{fmt(total)}</p>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-sm text-slate-600 truncate">
          Ghi chú: {receipt.ghiChu || "-"}
        </p>
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
            {(receipt.products || []).map((p, idx) => (
              <div key={`${receipt.maPhieu}-m-${idx}`} className="px-3 py-2.5">
                <p className="text-sm font-semibold text-slate-800">
                  {p.tenSanPham}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {p.donVi || "-"} | SL {fmt(p.soLuong)} | Giá nhập{" "}
                  {fmt(p.donGiaNhap)}
                </p>
                <p className="mt-1 text-sm font-bold text-slate-800">
                  Thành tiền: {fmt(p.thanhTien)}
                </p>
              </div>
            ))}
          </div>

          <div className="hidden md:block overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide whitespace-nowrap">
                    Sản phẩm
                  </th>
                  <th className="px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide whitespace-nowrap">
                    Nhóm hàng
                  </th>
                  <th className="px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide whitespace-nowrap">
                    Đơn vị
                  </th>
                  <th className="px-3 py-2.5 text-right text-xs font-bold uppercase tracking-wide whitespace-nowrap">
                    SL
                  </th>
                  <th className="px-3 py-2.5 text-right text-xs font-bold uppercase tracking-wide whitespace-nowrap">
                    Giá nhập
                  </th>
                  <th className="px-3 py-2.5 text-right text-xs font-bold uppercase tracking-wide whitespace-nowrap">
                    Thành tiền
                  </th>
                </tr>
              </thead>
              <tbody>
                {(receipt.products || []).map((p, idx) => (
                  <tr
                    key={`${receipt.maPhieu}-${idx}`}
                    className="border-t border-slate-100"
                  >
                    <td className="px-3 py-2 text-slate-800 whitespace-nowrap">
                      {p.tenSanPham}
                    </td>
                    <td className="px-3 py-2 text-slate-600 whitespace-nowrap">
                      {p.nhomHang || "-"}
                    </td>
                    <td className="px-3 py-2 text-slate-600 whitespace-nowrap">
                      {p.donVi || "-"}
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      {fmt(p.soLuong)}
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      {fmt(p.donGiaNhap)}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold text-slate-800 whitespace-nowrap">
                      {fmt(p.thanhTien)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </article>
  );
}

export default function HistoryPage() {
  const { user } = useUser();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("orders");
  const [orders, setOrders] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [revenuePeriodType, setRevenuePeriodType] = useState("all");
  const [revenuePeriodValue, setRevenuePeriodValue] = useState("current");
  const [receiptMonthValue, setReceiptMonthValue] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`;
  });
  const [productCatalog, setProductCatalog] = useState([]);
  const [customerCatalog, setCustomerCatalog] = useState([]);
  const [bankConfig, setBankConfig] = useState(() => readCachedBankConfig());
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [editingOrder, setEditingOrder] = useState(null);
  const [savingOrder, setSavingOrder] = useState(false);
  const [deletingCode, setDeletingCode] = useState("");
  const [issuingCode, setIssuingCode] = useState("");
  const [cancelingCode, setCancelingCode] = useState("");
  const [replacingCode, setReplacingCode] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [filters, setFilters] = useState({
    fromDate: "",
    toDate: "",
    tenKhach: "",
    maPhieu: "",
    tenSanPham: "",
  });

  const loadProductCatalog = async () => {
    try {
      const res = await getProductCatalog();
      if (res?.success && Array.isArray(res.data)) setProductCatalog(res.data);
      else setProductCatalog([]);
    } catch (e) {
      setProductCatalog([]);
    }
  };

  const loadCustomerCatalog = async () => {
    try {
      const res = await getCustomerCatalog();
      if (res?.success && Array.isArray(res.data)) setCustomerCatalog(res.data);
      else setCustomerCatalog([]);
    } catch (e) {
      setCustomerCatalog([]);
    }
  };

  const loadOrderHistory = async () => {
    setLoading(true);
    try {
      const res = await getOrderHistory();
      if (res?.success && Array.isArray(res.data)) {
        setOrders(res.data);
      } else {
        setOrders([]);
        if (res?.message) toast.error(res.message);
      }
    } catch (e) {
      setOrders([]);
      toast.error("Không tải được lịch sử đơn hàng");
    } finally {
      setLoading(false);
    }
  };

  const loadReceiptHistory = async () => {
    setLoading(true);
    try {
      const res = await getReceiptHistory();
      if (res?.success && Array.isArray(res.data)) {
        const grouped = res.data.reduce((acc, c) => {
          if (!acc[c.maPhieu]) {
            acc[c.maPhieu] = {
              maPhieu: c.maPhieu,
              nhaCungCap: c.nhaCungCap,
              ngayNhap: c.ngayNhap,
              ghiChu: c.ghiChu,
              tongTienPhieu: c.tongTienPhieu || 0,
              trangThai: c.trangThai,
              products: [],
            };
          }
          acc[c.maPhieu].products.push(c);
          if (!acc[c.maPhieu].tongTienPhieu && c.tongTienPhieu)
            acc[c.maPhieu].tongTienPhieu = c.tongTienPhieu;
          return acc;
        }, {});
        setReceipts(Object.values(grouped));
      } else {
        setReceipts([]);
      }
    } catch (e) {
      setReceipts([]);
      toast.error("Không tải được lịch sử nhập kho");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "orders" && orders.length === 0) loadOrderHistory();
    if (activeTab === "receipts" && receipts.length === 0) loadReceiptHistory();
  }, [activeTab]);

  useEffect(() => {
    loadProductCatalog();
    loadCustomerCatalog();
    // Load bank config for QR button
    const loadBankConfig = async () => {
      try {
        const res = await getBankConfig();
        if (res?.success && res.data) {
          setBankConfig(res.data);
          writeCachedBankConfig(res.data);
        }
      } catch (e) {
        // silent - QR button just won't show
      }
    };
    loadBankConfig();
  }, []);

  const enrichOrderForEdit = (order) => {
    if (!order) return order;
    if (!productCatalog || productCatalog.length === 0) return order;
    const products = (order.products || []).map((p) => {
      if (p.nhomHang) return p;
      const match = productCatalog.find(
        (sp) =>
          foldText(sp.tenSanPham) === foldText(p.tenSanPham) &&
          foldText(sp.donVi) === foldText(p.donVi),
      );
      return { ...p, nhomHang: match ? match.nhomHang || "" : "" };
    });
    return { ...order, products };
  };

  const dateSearchMeta = useMemo(() => getDateSearchMeta(query), [query]);

  const loadHistory = () => {
    if (activeTab === "orders") return loadOrderHistory();
    return loadReceiptHistory();
  };

  const filteredOrders = useMemo(() => {
    const list = activeTab === "orders" ? orders : receipts;
    const qAll = foldText(query);
    const qKhach = foldText(filters.tenKhach);
    const qMa = foldText(filters.maPhieu);
    const qSanPham = foldText(filters.tenSanPham);

    return list.filter((item) => {
      const itemStatusCode = getStatusCode(item.trangThai);
      const statusOk =
        statusFilter === "ALL" ||
        (statusFilter === "PAID" && itemStatusCode === "PAID") ||
        (statusFilter === "PARTIAL" && itemStatusCode === "PARTIAL") ||
        (statusFilter === "DEBT" && itemStatusCode === "DEBT");

      if (!statusOk) return false;

      const itemDate = toIsoDate(
        activeTab === "orders" ? item.ngayBan : item.ngayNhap,
      );
      if ((filters.fromDate || filters.toDate) && !itemDate) return false;
      if (filters.fromDate && itemDate < filters.fromDate) return false;
      if (filters.toDate && itemDate > filters.toDate) return false;

      const tenDoiTac =
        activeTab === "orders" ? item.tenKhach : item.nhaCungCap;
      if (qKhach && !foldText(tenDoiTac || "").includes(qKhach)) return false;
      if (qMa && !foldText(item.maPhieu || "").includes(qMa)) return false;

      if (qSanPham) {
        const productText = (item.products || [])
          .map((p) => p.tenSanPham)
          .join(" ");
        if (!foldText(productText).includes(qSanPham)) return false;
      }

      if (qAll) {
        if (dateSearchMeta.isDateQuery) {
          if (!dateSearchMeta.isValid) return false;
          if (
            !hasDateTokenMatch(
              activeTab === "orders" ? item.ngayBan : item.ngayNhap,
              dateSearchMeta.tokens,
            )
          )
            return false;
        } else {
          const productTextAll = (item.products || [])
            .map((p) => p.tenSanPham)
            .join(" ");
          const allText = [
            item.maPhieu,
            activeTab === "orders" ? item.ngayBan : item.ngayNhap,
            tenDoiTac,
            productTextAll,
          ].join(" ");
          if (!foldText(allText).includes(qAll)) return false;
        }
      }

      return true;
    });
  }, [
    orders,
    receipts,
    activeTab,
    filters,
    statusFilter,
    query,
    dateSearchMeta,
  ]);

  const revenuePeriodTypeOptions = [
    { value: "all", label: "Tất cả" },
    { value: "week", label: "Tuần" },
    { value: "month", label: "Tháng" },
    { value: "year", label: "Năm" },
  ];

  const revenuePeriodValueOptions = useMemo(() => {
    const formatD = (d) => `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}`;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (revenuePeriodType === "week") {
      const options = [];
      const thisW = new Date(today);
      thisW.setDate(thisW.getDate() - ((thisW.getDay() + 6) % 7)); // Monday of this week

      for (let i = 0; i < 5; i++) {
        const startW = new Date(thisW);
        startW.setDate(thisW.getDate() - i * 7);
        const endW = new Date(startW);
        endW.setDate(startW.getDate() + 6);

        let label = `Tuần từ ${formatD(startW)} - ${formatD(endW)}`;
        if (i === 0) label = `Tuần này (${formatD(startW)} - ${formatD(endW)})`;
        if (i === 1)
          label = `Tuần trước (${formatD(startW)} - ${formatD(endW)})`;

        options.push({ value: String(i), label });
      }
      return options;
    }

    if (revenuePeriodType === "month") {
      const options = [];
      for (let i = 0; i < 12; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const y = d.getFullYear();
        const m = d.getMonth() + 1;
        let label = `Tháng ${m}/${y}`;
        if (i === 0) label = `Tháng này (T${m})`;
        if (i === 1) label = `Tháng trước (T${m})`;

        options.push({ value: `${y}-${pad2(m)}`, label });
      }
      return options;
    }

    if (revenuePeriodType === "year") {
      const options = [];
      const currentY = now.getFullYear();
      for (let i = 0; i < 5; i++) {
        const y = currentY - i;
        let label = `Năm ${y}`;
        if (i === 0) label = `Năm nay (${y})`;
        if (i === 1) label = `Năm trước (${y})`;
        options.push({ value: String(y), label });
      }
      return options;
    }
    return [];
  }, [revenuePeriodType]);

  const handlePeriodTypeChange = (type) => {
    setRevenuePeriodType(type);
    if (type === "month") {
      const now = new Date();
      setRevenuePeriodValue(`${now.getFullYear()}-${pad2(now.getMonth() + 1)}`);
    } else if (type === "year") {
      setRevenuePeriodValue(String(new Date().getFullYear()));
    } else if (type === "week") {
      setRevenuePeriodValue("0");
    } else {
      setRevenuePeriodValue("current");
    }
  };

  const periodFilteredOrders = useMemo(() => {
    if (activeTab !== "orders") return [];
    if (revenuePeriodType === "all") return orders;

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    let start, end;
    if (revenuePeriodType === "week") {
      const i = parseInt(revenuePeriodValue || "0", 10);
      const thisW = new Date(today);
      thisW.setDate(thisW.getDate() - ((thisW.getDay() + 6) % 7)); // Monday of this week

      start = new Date(thisW);
      start.setDate(thisW.getDate() - i * 7);

      end = new Date(start);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
    } else if (revenuePeriodType === "month") {
      const [y, m] = (revenuePeriodValue || "").split("-");
      if (y && m) {
        start = new Date(parseInt(y), parseInt(m) - 1, 1);
        end = new Date(parseInt(y), parseInt(m), 0, 23, 59, 59, 999);
      } else {
        return orders; // fallback
      }
    } else if (revenuePeriodType === "year") {
      const y = parseInt(revenuePeriodValue || now.getFullYear(), 10);
      start = new Date(y, 0, 1);
      end = new Date(y, 11, 31, 23, 59, 59, 999);
    } else {
      return orders;
    }

    const startIso = toIsoDate(
      `${pad2(start.getDate())}/${pad2(start.getMonth() + 1)}/${start.getFullYear()}`,
    );
    const endIso = toIsoDate(
      `${pad2(end.getDate())}/${pad2(end.getMonth() + 1)}/${end.getFullYear()}`,
    );

    return orders.filter((o) => {
      const iso = toIsoDate(o.ngayBan);
      if (!iso) return false;
      return iso >= startIso && iso <= endIso;
    });
  }, [orders, activeTab, revenuePeriodType, revenuePeriodValue]);

  const totalRevenue = useMemo(
    () =>
      activeTab === "orders"
        ? periodFilteredOrders.reduce((sum, o) => sum + toNum(o.tongHoaDon), 0)
        : 0,
    [periodFilteredOrders, activeTab],
  );

  const totalProfit = useMemo(
    () =>
      activeTab === "orders"
        ? periodFilteredOrders.reduce((sum, o) => {
            const orderProfit = (o.products || []).reduce((acc, p) => {
              const qty = toNum(p.soLuong);
              const sell = toNum(p.donGiaBan);
              const cost = toNum(p.giaVon);
              return acc + (sell - cost) * qty;
            }, 0);
            return sum + orderProfit;
          }, 0)
        : 0,
    [periodFilteredOrders, activeTab],
  );

  const receiptMonthOptions = useMemo(() => {
    const months = new Set();
    const now = new Date();
    for (let i = 0; i < 12; i += 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.add(`${d.getFullYear()}-${pad2(d.getMonth() + 1)}`);
    }
    receipts.forEach((r) => {
      const iso = toIsoDate(r.ngayNhap);
      if (!iso) return;
      months.add(iso.slice(0, 7));
    });
    return Array.from(months)
      .sort((a, b) => (a < b ? 1 : -1))
      .map((value) => {
        const [y, m] = value.split("-");
        return { value, label: `Tháng ${Number(m)}/${y}` };
      });
  }, [receipts]);

  const receiptMonthlyStats = useMemo(() => {
    if (activeTab !== "receipts") return null;
    const [y, m] = String(receiptMonthValue || "").split("-");
    if (!y || !m) return { totalAmount: 0, receiptCount: 0, supplierCount: 0 };
    const monthKey = `${y}-${m}`;
    const rows = filteredOrders.filter((item) => {
      const iso = toIsoDate(item.ngayNhap);
      return iso && iso.slice(0, 7) === monthKey;
    });
    const totalAmount = rows.reduce((sum, r) => sum + toNum(r.tongTienPhieu), 0);
    const supplierCount = new Set(
      rows.map((r) => foldText(r.nhaCungCap || "")).filter(Boolean),
    ).size;
    return {
      totalAmount,
      receiptCount: rows.length,
      supplierCount,
    };
  }, [activeTab, filteredOrders, receiptMonthValue]);

  const resetFilters = () => {
    setFilters({
      fromDate: "",
      toDate: "",
      tenKhach: "",
      maPhieu: "",
      tenSanPham: "",
    });
    setStatusFilter("ALL");
  };

  const handleDeleteOrder = async (maPhieu) => {
    const key = String(maPhieu || "").trim();
    if (!key) return;
    setDeleteTarget({ maPhieu: key });
  };

  const confirmDeleteOrder = () => {
    const key = String(deleteTarget?.maPhieu || "").trim();
    if (!key) return;

    // Optimistic UI: remove from list immediately
    setOrders((prev) =>
      prev.filter((o) => String(o?.maPhieu || "").trim() !== key),
    );
    setDeleteTarget(null);
    setDeletingCode("");

    runInBackground({
      apiCall: () => deleteOrder(key),
      successMessage: `Đã xóa hóa đơn ${key}`,
      changeDescription: `Xóa hóa đơn "${key}"`,
      userName: user?.name || user?.email || "unknown",
      onComplete: (result) => {
        if (result?.success && !result?.queued) {
          formatAllSheets().catch(() => {});
        }
        loadHistory().catch(() => {});
      },
    });
  };

  const handleIssueInvoice = (maPhieu) => {
    const key = String(maPhieu || "").trim();
    if (!key) return;
    setIssuingCode(key);

    runInBackground({
      apiCall: () => issueEasyInvoice({ maPhieu: key }),
      successMessage: `Đã phát hành HĐĐT cho đơn ${key}`,
      changeDescription: `Phát hành HĐĐT đơn "${key}"`,
      userName: user?.name || user?.email || "unknown",
      onComplete: (result) => {
        setIssuingCode("");
        if (result?.success && !result?.queued) {
          // Có thể load lại list ngay để hiển thị số hóa đơn Mới
          loadHistory().catch(() => {});
        }
      },
    });
  };

  const handleCancelInvoice = (maPhieu) => {
    const key = String(maPhieu || "").trim();
    if (!key) return;
    setCancelingCode(key);

    runInBackground({
      apiCall: () => cancelEasyInvoice({ maPhieu: key }),
      successMessage: `Đã xử lý tiến trình hủy hóa đơn ${key}`,
      changeDescription: `Hủy HĐĐT đơn "${key}"`,
      userName: user?.name || user?.email || "unknown",
      onComplete: (result) => {
        setCancelingCode("");
        if (result?.success && !result?.queued) {
          loadHistory().catch(() => {});
        }
      },
    });
  };

  const handleReplaceInvoice = (maPhieu) => {
    const key = String(maPhieu || "").trim();
    if (!key) return;
    setReplacingCode(key);

    runInBackground({
      apiCall: () => replaceEasyInvoice({ maPhieu: key }),
      successMessage: `Đã thay thế HĐĐT cho đơn ${key}`,
      changeDescription: `Thay thế HĐĐT đơn "${key}"`,
      userName: user?.name || user?.email || "unknown",
      onComplete: (result) => {
        setReplacingCode("");
        if (result?.success && !result?.queued) {
          loadHistory().catch(() => {});
        }
      },
    });
  };

  const handleSaveOrder = (form, total) => {
    const maPhieu = String(form.maPhieu || "").trim();
    if (!maPhieu) return toast.error("Mã phiếu không được để trống");

    const products = (form.products || [])
      .map((p) => ({
        tenSanPham: String(p.tenSanPham || "").trim(),
        donVi: String(p.donVi || "").trim(),
        soLuong: Math.max(toNum(p.soLuong), 1),
        giaVon: Math.max(toNum(p.giaVon), 0),
        donGiaBan: Math.max(toNum(p.donGiaBan), 0),
      }))
      .filter((p) => p.tenSanPham && p.donVi && p.donGiaBan > 0);

    if (!products.length) return toast.error("Cần ít nhất 1 sản phẩm hợp lệ");

    if (form.trangThaiCode === "PARTIAL") {
      const paid = Math.max(toNum(form.soTienDaTra), 0);
      if (paid <= 0) return toast.error("Nhập số tiền đã trả trước");
      if (paid > total)
        return toast.error("Số tiền đã trả không được lớn hơn tổng hóa đơn");
    }

    const statusLabel =
      form.trangThaiCode === "DEBT"
        ? "Nợ"
        : form.trangThaiCode === "PARTIAL"
          ? "Trả một phần"
          : "Đã thanh toán";
    const soTienDaTra =
      form.trangThaiCode === "PARTIAL"
        ? Math.max(toNum(form.soTienDaTra), 0)
        : 0;

    const optimisticOrder = {
      maPhieu,
      ngayBan: form.ngayBan || "",
      tenKhach: String(form.tenKhach || "").trim() || "Khách ghé thăm",
      soDienThoai: String(form.soDienThoai || "").trim(),
      trangThai: statusLabel,
      ghiChu: String(form.ghiChu || "-").trim() || "-",
      tongHoaDon: total,
      tienNo:
        form.trangThaiCode === "PARTIAL"
          ? Math.max(total - soTienDaTra, 0)
          : form.trangThaiCode === "DEBT"
            ? total
            : 0,
      products: products.map((p) => ({
        ...p,
        thanhTien: p.soLuong * p.donGiaBan,
      })),
    };

    // Optimistic UI: update list + close modal immediately
    setOrders((prev) =>
      prev.map((o) =>
        String(o.maPhieu || "").trim() ===
        String(form.maPhieuOriginal || "").trim()
          ? { ...o, ...optimisticOrder }
          : o,
      ),
    );
    setEditingOrder(null);
    setSavingOrder(false);

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
        soTienDaTra,
        ghiChu: String(form.ghiChu || "-").trim() || "-",
      },
      products,
    };

    runInBackground({
      apiCall: () => updateOrder(payload),
      successMessage: `Đã cập nhật hóa đơn ${maPhieu}`,
      changeDescription: `Cập nhật hóa đơn "${maPhieu}"`,
      userName: user?.name || user?.email || "unknown",
      onComplete: (result) => {
        if (result?.success && !result?.queued) {
          formatAllSheets().catch(() => {});
        }
        loadHistory().catch(() => {});
      },
    });
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-50 to-rose-50/30">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-6 md:py-8 pb-24">
        <div className="mb-6 md:mb-8 flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-black text-slate-900 leading-tight">
              Lịch sử {activeTab === "orders" ? "đơn hàng" : "nhập kho"}
            </h1>
            <p className="mt-2 text-sm md:text-base text-slate-500">
              Tra cứu {activeTab === "orders" ? "đơn hàng" : "phiếu nhập"} theo
              ngày, {activeTab === "orders" ? "khách" : "nhà cung cấp"}, mã
              phiếu và sản phẩm.
            </p>
          </div>
          <div className="flex bg-slate-200/50 p-1 rounded-xl w-full md:w-auto mt-2 md:mt-0">
            <button
              type="button"
              onClick={() => setActiveTab("orders")}
              className={`flex-1 md:w-32 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === "orders" ? "bg-white text-rose-700 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
            >
              Bán hàng
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("receipts")}
              className={`flex-1 md:w-32 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === "receipts" ? "bg-white text-rose-700 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
            >
              Nhập nguyên liệu
            </button>
          </div>
        </div>

        {activeTab === "orders" && (
          <section className="mb-4">
            <div className="mb-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <h2 className="text-sm font-bold text-slate-800">Doanh thu</h2>
              <div className="flex items-center gap-2 self-start md:self-auto">
                <CustomDropdown
                  value={revenuePeriodType}
                  onChange={handlePeriodTypeChange}
                  options={revenuePeriodTypeOptions}
                />
                {revenuePeriodType !== "all" && (
                  <CustomDropdown
                    value={revenuePeriodValue}
                    onChange={setRevenuePeriodValue}
                    options={revenuePeriodValueOptions}
                  />
                )}
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-rose-200 bg-rose-50/60 px-4 py-3 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-rose-700">
                  Doanh thu
                </p>
                <p className="mt-1 text-2xl font-black text-rose-700">
                  {fmt(totalRevenue)}
                </p>
                <p className="mt-1 text-xs text-rose-700">
                  {revenuePeriodType === "all"
                    ? "Tất cả thời gian"
                    : "Theo khoảng đã chọn"}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Lợi nhuận
                </p>
                <p
                  className={`mt-1 text-2xl font-black ${totalProfit >= 0 ? "text-emerald-600" : "text-rose-600"}`}
                >
                  {fmt(totalProfit)}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Chưa trừ chi phí khác
                </p>
              </div>
            </div>
          </section>
        )}

        {activeTab === "receipts" && receiptMonthlyStats && (
          <section className="mb-4">
            <div className="mb-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <h2 className="text-sm font-bold text-slate-800">
                Chi phí nhập theo tháng
              </h2>
              <div className="flex items-center gap-2 self-start md:self-auto">
                <CustomDropdown
                  value={receiptMonthValue}
                  onChange={setReceiptMonthValue}
                  options={receiptMonthOptions}
                />
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 px-4 py-3 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                  Tổng tiền nhập
                </p>
                <p className="mt-1 text-2xl font-black text-emerald-700">
                  {fmt(receiptMonthlyStats.totalAmount)}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Số phiếu nhập
                </p>
                <p className="mt-1 text-2xl font-black text-slate-800">
                  {receiptMonthlyStats.receiptCount}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Số nhà cung cấp
                </p>
                <p className="mt-1 text-2xl font-black text-slate-800">
                  {receiptMonthlyStats.supplierCount}
                </p>
              </div>
            </div>
          </section>
        )}

        <section className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5 shadow-sm mb-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm md:text-base font-bold text-slate-800">
              Bộ lọc
            </h2>
            <span className="text-xs text-slate-400">
              Lọc nhanh theo nhu cầu
            </span>
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
                Ngày không hợp lệ. Dùng định dạng như `08/03/2026`, `8-3-2026`
                hoặc `2026-03-08`.
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
            <FilterFields
              filters={filters}
              setFilters={setFilters}
              statusFilter={statusFilter}
              setStatusFilter={setStatusFilter}
              activeTab={activeTab}
            />
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={resetFilters}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
              >
                Xóa lọc
              </button>
              <button
                type="button"
                onClick={loadHistory}
                className="rounded-lg bg-gradient-to-r from-rose-700 to-rose-500 px-3 py-2 text-sm font-semibold text-white hover:shadow-lg hover:shadow-rose-700/25"
              >
                Làm mới
              </button>
            </div>
          </div>
        </section>

        {showMobileFilters && (
          <div
            className="fixed inset-0 z-[9500] bg-slate-900/40 md:hidden"
            onClick={() => setShowMobileFilters(false)}
          >
            <div
              className="absolute bottom-0 left-0 right-0 rounded-t-3xl bg-white p-4 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-900">
                  Bộ lọc đơn hàng
                </h2>
                <button
                  type="button"
                  onClick={() => setShowMobileFilters(false)}
                  className="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100"
                >
                  Đóng
                </button>
              </div>
              <FilterFields
                filters={filters}
                setFilters={setFilters}
                statusFilter={statusFilter}
                setStatusFilter={setStatusFilter}
                activeTab={activeTab}
              />
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={resetFilters}
                  className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700"
                >
                  Xóa lọc
                </button>
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
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-500">
            Đang tải lịch sử {activeTab === "orders" ? "đơn hàng" : "nhập kho"}
            ...
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-500">
            Không có {activeTab === "orders" ? "đơn hàng" : "phiếu nhập"} phù
            hợp.
          </div>
        ) : (
          <div className="space-y-3">
            {filteredOrders.map((item, idx) =>
              activeTab === "orders" ? (
                <HistoryCard
                  key={`${item.maPhieu}-${idx}`}
                  order={item}
                  deleting={deletingCode === item.maPhieu}
                  issuing={issuingCode === item.maPhieu}
                  canceling={cancelingCode === item.maPhieu}
                  replacing={replacingCode === item.maPhieu}
                  onEdit={() => setEditingOrder(enrichOrderForEdit(item))}
                  onDelete={() => handleDeleteOrder(item.maPhieu)}
                  onIssueInvoice={() => handleIssueInvoice(item.maPhieu)}
                  onCancelInvoice={() => handleCancelInvoice(item.maPhieu)}
                  onReplaceInvoice={() => handleReplaceInvoice(item.maPhieu)}
                  bankConfig={bankConfig}
                />
              ) : (
                <ReceiptHistoryCard
                  key={`${item.maPhieu}-${idx}`}
                  receipt={item}
                />
              ),
            )}
          </div>
        )}
      </div>

      {editingOrder && (
        <EditOrderModal
          order={editingOrder}
          saving={savingOrder}
          productCatalog={productCatalog}
          customerCatalog={customerCatalog}
          onClose={() => (savingOrder ? null : setEditingOrder(null))}
          onSave={handleSaveOrder}
        />
      )}

      {deleteTarget && (
        <div
          className="fixed inset-0 z-[9900] bg-slate-900/45 p-4"
          onClick={() => (deletingCode ? null : setDeleteTarget(null))}
        >
          <div
            className="mx-auto mt-[18vh] w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-slate-900">
              Xác nhận xóa hóa đơn
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              Bạn sắp xóa hóa đơn{" "}
              <span className="font-semibold text-slate-900">
                {deleteTarget.maPhieu}
              </span>
              . Thao tác này sẽ cập nhật cả `DON_HANG` và `KHACH`.
            </p>
            <p className="mt-1 text-xs text-rose-600">
              Hành động này không thể hoàn tác.
            </p>
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
  );
}
