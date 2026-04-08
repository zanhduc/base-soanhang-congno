import { useEffect, useMemo, useState } from "react";
import { getOrderHistory } from "../api";
import toast from "react-hot-toast";

const fmt = (n) => Number(n || 0).toLocaleString("vi-VN");
const toNum = (v) => Number(String(v ?? "").replace(/[^\d.-]/g, "")) || 0;

const formatDisplayDate = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "-";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return `${raw.slice(8, 10)}/${raw.slice(5, 7)}/${raw.slice(0, 4)}`;
  }
  return raw;
};

const getPaperWidth = (size) => {
  if (size === "58") return "58mm";
  if (size === "pdf") return "210mm";
  return "80mm";
};

export default function ReceiptPage({ code, size, isPreview, previewDataStr }) {
  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState(null);
  const [currentSize, setCurrentSize] = useState(size || "58");

  useEffect(() => {
    const load = async (retryCount = 0) => {
      setLoading(true);

      if (isPreview && previewDataStr) {
        try {
          const data = JSON.parse(previewDataStr);
          if (String(data.maPhieu || "").trim() === String(code || "").trim()) {
            setOrder(data);
            setLoading(false);
            return;
          }
        } catch (e) {
          console.error("Lỗi parse previewDataStr", e);
        }
      }

      try {
        const res = await getOrderHistory();
        if (res?.success && Array.isArray(res.data)) {
          const found = res.data.find(
            (o) => String(o.maPhieu || "").trim() === String(code || "").trim(),
          );
          if (found) {
            setOrder(found);
            setLoading(false);
          } else {
            if (retryCount < 3) {
              setTimeout(() => load(retryCount + 1), 2000);
              return;
            }
            setOrder(null);
            setLoading(false);
            toast.error("Không tìm thấy hóa đơn cần in.");
          }
        } else {
          if (retryCount < 2) {
            setTimeout(() => load(retryCount + 1), 2000);
            return;
          }
          setOrder(null);
          setLoading(false);
          toast.error(res?.message || "Không tải được hóa đơn.");
        }
      } catch (e) {
        if (retryCount < 2) {
          setTimeout(() => load(retryCount + 1), 2000);
          return;
        }
        setOrder(null);
        setLoading(false);
        toast.error("Không tải được hóa đơn.");
      }
    };
    if (code) load();
  }, [code, isPreview]);

  const view = useMemo(() => {
    if (!order) return null;
    const totalFromItems = (order.products || []).reduce(
      (sum, p) => sum + toNum(p.soLuong) * toNum(p.donGiaBan),
      0,
    );
    const total = toNum(order.tongHoaDon) || totalFromItems;
    const tienNo = Math.max(toNum(order.tienNo), 0);
    const daTra = Math.max(total - tienNo, 0);
    return {
      total,
      tienNo,
      daTra,
      createdAt: formatDisplayDate(order.ngayBan),
      customerName: order.tenKhach || "Khách ghé thăm",
      phone: order.soDienThoai || "",
      note: order.ghiChu || "-",
      statusText: String(order.trangThai || "Đã thanh toán"),
    };
  }, [order]);

  const paperWidth = getPaperWidth(currentSize);
  const paperLabel =
    currentSize === "58" ? "58mm" : currentSize === "pdf" ? "PDF/A4" : "80mm";
  const isCompact = currentSize === "58";
  const isPdf = currentSize === "pdf";

  return (
    <main className="min-h-screen bg-slate-100 py-6">
      <style>{`
        @page { size: ${paperWidth} auto; margin: 6mm; }
        @media print {
          .no-print { display: none !important; }
          body { background: white; }
          main { padding: 0 !important; }
        }
      `}</style>

      <div className="no-print mx-auto mb-4 flex w-full max-w-[520px] items-center justify-between px-4">
        <div className="flex flex-col gap-1.5">
          <div className="text-sm font-bold text-slate-800">
            In phiếu: <span className="text-rose-600">{code || "-"}</span>
          </div>
          <select
            className="text-[11px] bg-white border border-slate-200 rounded-md px-2 py-1 outline-none focus:border-rose-400 font-semibold text-slate-600 cursor-pointer shadow-sm"
            value={currentSize}
            onChange={(e) => setCurrentSize(e.target.value)}
          >
            <option value="58">Máy in nhiệt 58mm</option>
            <option value="80">Máy in nhiệt 80mm</option>
            <option value="pdf">Lưu File PDF / A4</option>
          </select>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-xl bg-gradient-to-r from-rose-700 to-rose-500 px-4 py-2.5 text-[11px] font-bold text-white hover:shadow-lg hover:shadow-rose-700/30 transition-all"
          >
            In ngay
          </button>
          <button
            type="button"
            onClick={() => window.close()}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[11px] font-bold text-slate-600 hover:bg-slate-50 transition-all shadow-sm"
          >
            Đóng
          </button>
        </div>
      </div>

      <div className="mx-auto w-full px-4" style={{ maxWidth: paperWidth }}>
        <div
          className={`bg-white shadow-lg ${isPdf ? "rounded-none p-8" : isCompact ? "rounded-2xl p-3" : "rounded-2xl p-4"}`}
        >
          {loading && (
            <p className="text-center text-sm text-slate-500">
              Đang tải hóa đơn...
            </p>
          )}
          {!loading && !order && (
            <p className="text-center text-sm text-slate-500">
              Không có dữ liệu hóa đơn.
            </p>
          )}
          {!loading && order && view && !isPdf && (
            <div
              className={`space-y-3 text-slate-900 ${isCompact ? "text-[11px]" : "text-[12px]"}`}
            >
              <div className="text-center">
                <div
                  className={`font-black tracking-wide ${isCompact ? "text-sm" : "text-base"}`}
                >
                  HÓA ĐƠN BÁN LẺ
                </div>
                <div
                  className={`text-slate-500 ${isCompact ? "text-[10px]" : "text-xs"}`}
                >
                  Mã phiếu: <strong>{order.maPhieu}</strong>
                </div>
                <div
                  className={`text-slate-500 ${isCompact ? "text-[10px]" : "text-xs"}`}
                >
                  Ngày bán: {view.createdAt}
                </div>
              </div>

              <div className="border-t border-dashed border-slate-200 pt-2 space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-slate-500">Khách</span>
                  <strong className="text-right leading-tight">
                    {view.customerName}
                  </strong>
                </div>
                {view.phone && (
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-slate-500">SĐT</span>
                    <strong className="text-right leading-tight">
                      {view.phone}
                    </strong>
                  </div>
                )}
                <div className="flex items-start justify-between gap-2">
                  <span className="text-slate-500">TT</span>
                  <strong className="text-right leading-tight">
                    {view.statusText}
                  </strong>
                </div>
                <div className="flex items-start justify-between gap-2">
                  <span className="text-slate-500">Ghi chú</span>
                  <strong className="text-right leading-tight">
                    {view.note}
                  </strong>
                </div>
              </div>

              <div className="border-t border-dashed border-slate-200 pt-2 space-y-2">
                {(order.products || []).map((p, idx) => (
                  <div key={`${order.maPhieu}-r-${idx}`}>
                    <div
                      className={`font-semibold ${isCompact ? "text-[11px]" : "text-[12px]"}`}
                    >
                      {p.tenSanPham}{" "}
                      {p.donVi ? (
                        <span className="text-slate-400">({p.donVi})</span>
                      ) : null}
                    </div>
                    <div
                      className={`flex justify-between text-slate-500 ${isCompact ? "text-[10px]" : "text-[11px]"}`}
                    >
                      <span>
                        SL {fmt(p.soLuong)} x {fmt(p.donGiaBan)}
                      </span>
                      <span className="font-semibold text-slate-900">
                        {fmt(toNum(p.soLuong) * toNum(p.donGiaBan))}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t border-dashed border-slate-200 pt-2 space-y-1">
                <div
                  className={`flex justify-between font-bold ${isCompact ? "text-[12px]" : "text-[13px]"}`}
                >
                  <span>Tổng cộng</span>
                  <span>{fmt(view.total)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Phải trả</span>
                  <strong>{fmt(view.daTra)}</strong>
                </div>
                {view.tienNo > 0 && (
                  <div className="flex justify-between">
                    <span>Còn nợ</span>
                    <strong>{fmt(view.tienNo)}</strong>
                  </div>
                )}
              </div>

              <div className="border-t border-dashed border-slate-200 pt-2 text-center text-[10.5px] text-slate-400">
                Hóa đơn được tạo bởi{" "}
                <span className="font-extrabold text-rose-600">DULIA</span>
              </div>
            </div>
          )}
          {!loading && order && view && isPdf && (
            <div className="text-slate-900">
              <div className="rounded-2xl border border-rose-200 bg-gradient-to-r from-rose-50 to-white p-5">
                <div className="flex items-start justify-between gap-6">
                  <div>
                    <div className="text-2xl font-black tracking-wide text-rose-700">
                      DULIA
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      Hóa đơn bán lẻ chuyên nghiệp
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-semibold uppercase tracking-wide text-rose-500">
                      Mã phiếu
                    </div>
                    <div className="text-2xl font-black text-slate-900">
                      {order.maPhieu}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      Ngày bán: {view.createdAt}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-6 text-sm">
                <div className="rounded-xl border border-slate-200 p-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-rose-600">
                    Thông tin khách hàng
                  </div>
                  <div className="mt-2 space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Tên</span>
                      <strong>{view.customerName}</strong>
                    </div>
                    {view.phone && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">SĐT</span>
                        <strong>{view.phone}</strong>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-slate-500">Trạng thái</span>
                      <strong>{view.statusText}</strong>
                    </div>
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 p-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-rose-600">
                    Ghi chú đơn hàng
                  </div>
                  <div className="mt-2 text-sm text-slate-700 min-h-[72px]">
                    {view.note}
                  </div>
                </div>
              </div>

              <div className="mt-6 rounded-xl border border-slate-200 overflow-hidden">
                <table className="w-full text-sm">
                  <colgroup>
                    <col style={{ width: "40%" }} />
                    <col style={{ width: "14%" }} />
                    <col style={{ width: "10%" }} />
                    <col style={{ width: "18%" }} />
                    <col style={{ width: "18%" }} />
                  </colgroup>
                  <thead className="bg-rose-100 text-rose-700">
                    <tr>
                      <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wide border-b border-rose-200">
                        Sản phẩm
                      </th>
                      <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wide border-b border-rose-200">
                        Đơn vị
                      </th>
                      <th className="px-4 py-2.5 text-right text-[11px] font-bold uppercase tracking-wide border-b border-rose-200">
                        SL
                      </th>
                      <th className="px-4 py-2.5 text-right text-[11px] font-bold uppercase tracking-wide border-b border-rose-200">
                        Đơn giá
                      </th>
                      <th className="px-4 py-2.5 text-right text-[11px] font-bold uppercase tracking-wide border-b border-rose-200">
                        Thành tiền
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {(order.products || []).map((p, idx) => (
                      <tr
                        key={`${order.maPhieu}-pdf-${idx}`}
                        className="border-t border-slate-100"
                      >
                        <td className="px-4 py-2.5 text-slate-800 font-semibold">
                          {p.tenSanPham}
                        </td>
                        <td className="px-4 py-2.5 text-slate-600">
                          {p.donVi || "-"}
                        </td>
                        <td className="px-4 py-2.5 text-right text-slate-700">
                          {fmt(p.soLuong)}
                        </td>
                        <td className="px-4 py-2.5 text-right text-slate-700">
                          {fmt(p.donGiaBan)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-semibold text-rose-700">
                          {fmt(toNum(p.soLuong) * toNum(p.donGiaBan))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-6 flex justify-end">
                <div className="w-full max-w-sm rounded-xl border border-rose-200 bg-rose-50/50 p-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Tổng cộng</span>
                    <strong className="text-rose-700">{fmt(view.total)}</strong>
                  </div>
                  <div className="flex justify-between text-sm mt-2">
                    <span className="text-slate-500">Đã trả</span>
                    <strong>{fmt(view.daTra)}</strong>
                  </div>
                  {view.tienNo > 0 && (
                    <div className="flex justify-between text-sm mt-2">
                      <span className="text-slate-500">Còn nợ</span>
                      <strong>{fmt(view.tienNo)}</strong>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-8 flex items-center justify-between text-xs text-slate-400">
                <div>
                  Hóa đơn được tạo bởi{" "}
                  <span className="font-bold text-rose-600">DULIA</span>
                </div>
                <div>In từ hệ thống bán hàng</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
