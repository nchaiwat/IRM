'use client';

import React, { useEffect, useState, useRef, useMemo } from 'react';
import { api } from '@/lib/api';
import { POItemResponse } from '@/types';
import {
  ScrollText,
  CheckCircle2,
  Search,
  History as HistoryIcon,
  Calendar,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

export default function HistoryPage() {
  const [items, setItems] = useState<POItemResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [showHistoryModal, setShowHistoryModal] = useState<POItemResponse | null>(null);
  const [modalAuditLogs, setModalAuditLogs] = useState<any[]>([]);
  const [loadingAuditLogs, setLoadingAuditLogs] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(100);

  const topScrollRef = useRef<HTMLDivElement>(null);
  const mainTableRef = useRef<HTMLDivElement>(null);
  const [tableScrollWidth, setTableScrollWidth] = useState<number>(1150);

  // Debounce search term by 200ms
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 200);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // Reset pagination when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch]);

  const handleTopScroll = () => {
    if (topScrollRef.current && mainTableRef.current) {
      mainTableRef.current.scrollLeft = topScrollRef.current.scrollLeft;
    }
  };

  const handleMainScroll = () => {
    if (topScrollRef.current && mainTableRef.current) {
      topScrollRef.current.scrollLeft = mainTableRef.current.scrollLeft;
    }
  };

  useEffect(() => {
    if (mainTableRef.current) {
      const scrollW = mainTableRef.current.scrollWidth;
      setTableScrollWidth(scrollW > 1000 ? scrollW : 1150);
    }
  }, [items, loading]);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const res = await api.get<POItemResponse[]>('/api/history');
      setItems(res.data);
    } catch (err) {
      console.error('Failed to fetch history:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDateThai = (isoStr: string | null | undefined) => {
    if (!isoStr) return '-';
    const d = new Date(isoStr);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const handleOpenAuditModal = async (item: POItemResponse) => {
    setShowHistoryModal(item);
    setLoadingAuditLogs(true);
    setModalAuditLogs([]);
    try {
      const res = await api.get<any[]>(`/api/history/items/${item.id}/audit-logs`);
      setModalAuditLogs(res.data);
    } catch (err) {
      console.error('Failed to load history audit logs:', err);
    } finally {
      setLoadingAuditLogs(false);
    }
  };

  const filtered = useMemo(() => {
    const searchLower = debouncedSearch.trim().toLowerCase();
    if (!searchLower) return items;
    return items.filter(
      (i) =>
        i.po_number.toLowerCase().includes(searchLower) ||
        i.item_code.toLowerCase().includes(searchLower) ||
        i.item_name.toLowerCase().includes(searchLower) ||
        i.supplier_name.toLowerCase().includes(searchLower) ||
        i.supplier_code.toLowerCase().includes(searchLower)
    );
  }, [items, debouncedSearch]);

  const totalPages = useMemo(() => {
    if (pageSize === 0) return 1;
    return Math.ceil(filtered.length / pageSize) || 1;
  }, [filtered.length, pageSize]);

  const paginatedItems = useMemo(() => {
    if (pageSize === 0) return filtered;
    const startIndex = (currentPage - 1) * pageSize;
    return filtered.slice(startIndex, startIndex + pageSize);
  }, [filtered, currentPage, pageSize]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-500">
        <div className="w-6 h-6 border-2 border-sky-500 border-t-transparent rounded-full animate-spin mr-3"></div>
        <span>กำลังโหลดประวัติ History...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2.5">
            <ScrollText className="w-7 h-7 text-sky-600" />
            <span>History (ประวัติรายการที่ปิดยอดใน SAP แล้ว)</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            รายการที่รับเข้าคลังครบแล้วใน SAP — เก็บประวัติย้อนหลังตามระยะเวลา Retention (7 วัน) พร้อมเปรียบเทียบยอดแผน (Plan vs Actual)
          </p>
        </div>

        <div className="text-xs text-slate-500 font-medium bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-xs">
          พบประวัติปิดยอด <span className="font-bold text-slate-800">{filtered.length}</span> รายการ
        </div>
      </div>

      <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="ค้นหาเลข PO, รหัสสินค้า, ชื่อสินค้า หรือ Supplier..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-sky-500 focus:bg-white transition"
          />
        </div>
      </div>

      {/* Compact History Data Table matching Operation Template */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-x-auto text-xs max-h-[72vh] overflow-y-auto">
        <table className="w-full text-left border-collapse min-w-[1200px]">
          <thead className="bg-slate-900 text-slate-200 font-bold sticky top-0 z-20 shadow-md">
            <tr>
              <th className="py-2.5 px-2 text-center w-12 border-b border-slate-800">#</th>
              <th className="py-2.5 px-3 w-36 border-b border-slate-800">PO No. / Date</th>
              <th className="py-2.5 px-3 border-b border-slate-800 min-w-[180px]">Supplier</th>
              <th className="py-2.5 px-2 text-center w-24 border-b border-slate-800">Group</th>
              <th className="py-2.5 px-3 border-b border-slate-800 min-w-[220px]">Item Code & Description</th>
              <th className="py-2.5 px-3 text-right border-b border-slate-800 w-28">ยอดสั่งซื้อ (PO)</th>
              <th className="py-2.5 px-3 text-right bg-sky-950 text-sky-300 border-b border-slate-800 w-28">แผนเดิม (Est)</th>
              <th className="py-2.5 px-3 text-right bg-emerald-950 text-emerald-300 border-b border-slate-800 w-28">รับจริง (SAP)</th>
              <th className="py-2.5 px-3 text-center border-b border-slate-800 w-28">ผลต่าง (Plan/Act)</th>
              <th className="py-2.5 px-3 text-center border-b border-slate-800 w-28">วันที่ปิดยอด</th>
              <th className="py-2.5 px-3 text-center border-b border-slate-800 w-20">ประวัติ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(() => {
              let lastPo = '';
              let lastSup = '';
              let lastGroup = '';

              return paginatedItems.map((item, idx) => {
                const estQty = item.estimate_qty || 0;
                const actualQty = item.received_qty || item.quantity;
                const variance = actualQty - estQty;
                const isFirstInPo = item.po_number !== lastPo;
                const isFirstInSup = isFirstInPo || item.supplier_code !== lastSup;
                const isFirstInGroup = isFirstInPo || (item.item_group || '') !== lastGroup;
                const displayIndex = (pageSize === 0 ? 0 : (currentPage - 1) * pageSize) + idx + 1;

                if (isFirstInPo) {
                  lastPo = item.po_number;
                  lastSup = item.supplier_code;
                  lastGroup = item.item_group || '';
                } else {
                  if (item.supplier_code !== lastSup) lastSup = item.supplier_code;
                  if ((item.item_group || '') !== lastGroup) lastGroup = item.item_group || '';
                }

                return (
                  <tr key={item.id} className={`hover:bg-slate-50/80 transition ${isFirstInPo && idx > 0 ? '!border-t-4 !border-t-slate-400/90 shadow-[0_-3px_6px_rgba(0,0,0,0.06)]' : ''}`}>
                    {/* 1. # */}
                    <td className="py-2.5 px-2 text-center font-bold text-slate-400 align-top">{displayIndex}</td>

                    {/* 2. PO No. / Date */}
                    <td className="py-2.5 px-3 font-medium text-slate-700 whitespace-nowrap align-top">
                      {isFirstInPo ? (
                        <>
                          <div className="font-bold text-slate-900">{item.po_number}</div>
                          <div className="text-[10px] text-slate-500 font-normal">{formatDateThai(item.po_date)}</div>
                        </>
                      ) : (
                        <div className="text-slate-300 text-xs font-mono select-none pl-1">↳</div>
                      )}
                    </td>

                    {/* 3. Supplier */}
                    <td className="py-2.5 px-3 align-top border-r border-slate-100">
                      {isFirstInSup ? (
                        <>
                          <div className="font-mono font-bold text-slate-800">{item.supplier_code}</div>
                          <div className="text-[10px] text-slate-500 truncate max-w-[160px]" title={item.supplier_name}>
                            {item.supplier_name}
                          </div>
                        </>
                      ) : (
                        <div className="text-slate-300 text-xs font-mono select-none pl-1">↳</div>
                      )}
                    </td>

                    {/* 4. Group */}
                    <td className="py-2.5 px-2 text-center whitespace-nowrap border-r border-slate-100 align-top">
                      {isFirstInGroup ? (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                          {item.item_group || 'RM-กระจก'}
                        </span>
                      ) : (
                        <span className="text-slate-200 text-xs select-none">-</span>
                      )}
                    </td>

                    {/* 5. Item Code & Description */}
                    <td className="py-2.5 px-3 align-top">
                      <div className="font-bold text-slate-900">{item.item_code}</div>
                      <div className="text-[11px] text-slate-500 leading-tight">{item.item_name}</div>
                    </td>

                    {/* 6. PO Qty / Unit */}
                    <td className="py-2.5 px-3 text-right whitespace-nowrap align-top">
                      <div className="font-bold text-slate-900">{item.quantity.toLocaleString()}</div>
                      <div className="text-[10px] text-slate-500">{item.unit}</div>
                    </td>

                    {/* 7. Est Qty */}
                    <td className="py-2.5 px-3 text-right font-bold text-sky-900 bg-sky-50/40 whitespace-nowrap align-top">
                      {estQty > 0 ? (
                        <>
                          <div>{estQty.toLocaleString()}</div>
                          <div className="text-[10px] text-slate-500 font-normal">{item.unit}</div>
                        </>
                      ) : (
                        '-'
                      )}
                    </td>

                    {/* 8. Received Qty */}
                    <td className="py-2.5 px-3 text-right font-bold text-emerald-800 bg-emerald-50/40 whitespace-nowrap align-top">
                      <div>{actualQty.toLocaleString()}</div>
                      <div className="text-[10px] text-slate-500 font-normal">{item.unit}</div>
                    </td>

                    {/* 9. Variance */}
                    <td className="py-2.5 px-3 text-center whitespace-nowrap align-top">
                      {estQty > 0 ? (
                        variance === 0 ? (
                          <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>ตรงตามแผน</span>
                          </span>
                        ) : variance > 0 ? (
                          <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">
                            <TrendingUp className="w-3 h-3 text-blue-600" />
                            <span>+{variance.toLocaleString()}</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                            <TrendingDown className="w-3 h-3 text-amber-600" />
                            <span>{variance.toLocaleString()}</span>
                          </span>
                        )
                      ) : (
                        <span className="text-slate-400 text-[10px]">-</span>
                      )}
                    </td>

                    {/* 10. Closed Date */}
                    <td className="py-2.5 px-3 text-center text-slate-600 whitespace-nowrap font-medium text-[11px] align-top">
                      {item.closed_at ? formatDateThai(item.closed_at) : 'ล่าสุด'}
                    </td>

                    {/* 11. Actions */}
                    <td className="py-2.5 px-3 text-center align-top">
                      <button
                        onClick={() => handleOpenAuditModal(item)}
                        className="p-1 rounded text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200 transition"
                        title="ดู Audit Trail ประวัติการเปลี่ยนแปลง"
                      >
                        <HistoryIcon className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              });
            })()}
          </tbody>
        </table>
      </div>

      {/* PAGINATION CONTROLS */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-slate-500 font-medium flex-wrap">
          <span>แสดง</span>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 outline-none focus:border-sky-500 transition cursor-pointer"
          >
            <option value={50}>50 รายการ / หน้า</option>
            <option value={100}>100 รายการ / หน้า</option>
            <option value={200}>200 รายการ / หน้า</option>
            <option value={0}>แสดงทั้งหมด ({filtered.length.toLocaleString()})</option>
          </select>
          <span>
            (รายการที่ {filtered.length === 0 ? 0 : (currentPage - 1) * (pageSize || filtered.length) + 1} - {pageSize === 0 ? filtered.length : Math.min(currentPage * pageSize, filtered.length)} จากทั้งหมด <strong className="text-slate-800 font-bold">{filtered.length.toLocaleString()}</strong> รายการ)
          </span>
        </div>

        {pageSize > 0 && totalPages > 1 && (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed font-medium transition flex items-center gap-1"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>ย้อนกลับ</span>
            </button>
            
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(totalPages, 5) }, (_, idx) => {
                let pageNum = idx + 1;
                if (totalPages > 5 && currentPage > 3) {
                  pageNum = currentPage - 2 + idx;
                  if (pageNum > totalPages) pageNum = totalPages - (4 - idx);
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`w-7 h-7 rounded-lg text-xs font-bold transition ${
                      currentPage === pageNum
                        ? 'bg-sky-600 text-white shadow-xs'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed font-medium transition flex items-center gap-1"
            >
              <span>ถัดไป</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* HISTORY AUDIT MODAL */}
      {showHistoryModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 max-h-[85vh] flex flex-col">
            <h2 className="text-base font-bold text-slate-800 mb-3 flex items-center gap-2">
              <HistoryIcon className="w-5 h-5 text-indigo-600" />
              <span>ประวัติ: {showHistoryModal.po_number} ({showHistoryModal.item_code})</span>
            </h2>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1 text-xs">
              {loadingAuditLogs ? (
                <div className="flex items-center justify-center py-10 text-slate-400 gap-2">
                  <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                  <span>กำลังโหลดประวัติ...</span>
                </div>
              ) : modalAuditLogs.length > 0 ? (
                modalAuditLogs.map((log, idx) => (
                  <div
                    key={log.id}
                    className={`p-3 rounded-xl border transition ${
                      idx === 0
                        ? 'bg-indigo-50/70 border-indigo-200 shadow-2xs'
                        : 'bg-slate-50 border-slate-100'
                    } space-y-1`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-800">{log.changed_by_name} ({log.changed_by_type})</span>
                        {idx === 0 && (
                          <span className="px-1.5 py-0.2 rounded-full text-[9px] font-extrabold bg-indigo-600 text-white shadow-2xs">
                            ล่าสุด
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 font-medium">
                        {log.changed_at ? new Date(log.changed_at).toLocaleString('th-TH') : '-'}
                      </span>
                    </div>
                    <div className="text-slate-600 text-[11px] leading-relaxed">{log.changes_detail}</div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-slate-400">ยังไม่มีประวัติการแก้ไข</div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setShowHistoryModal(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition"
              >
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
