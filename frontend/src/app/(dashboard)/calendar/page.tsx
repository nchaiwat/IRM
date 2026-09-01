'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { api } from '@/lib/api';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Package,
  Building2,
  CheckCircle2,
  Clock,
  AlertCircle,
  X,
  Truck,
} from 'lucide-react';

interface CalendarEvent {
  id: string | number;
  title: string;
  item_code?: string;
  item_name?: string;
  supplier_code?: string;
  supplier_name?: string;
  buyer_name?: string;
  date: string; // YYYY-MM-DD
  quantity: number;
  unit: string;
  status: string; // 'confirmed' | 'estimate'
  is_confirmed?: boolean;
  po_number: string;
  updated_by: string;
}

export default function CalendarPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDateEvents, setSelectedDateEvents] = useState<{ date: string; events: CalendarEvent[] } | null>(null);
  const [filterMode, setFilterMode] = useState<'all' | 'confirmed' | 'estimate' | 'overdue'>('all');

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      const res = await api.get<CalendarEvent[]>('/api/calendar');
      setEvents(res.data);
    } catch (err) {
      console.error('Failed to fetch calendar events:', err);
    } finally {
      setLoading(false);
    }
  };

  // Calendar Math
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0 = Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const monthNames = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
  ];

  // Today Date string YYYY-MM-DD for overdue check
  const todayStr = useMemo(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }, []);

  // Group events by date string (YYYY-MM-DD) with active filter (Memoized)
  const { eventsByDate, confirmedCount, estimateCount, overdueCount } = useMemo(() => {
    const byDate: Record<string, CalendarEvent[]> = {};
    let conf = 0;
    let est = 0;
    let overdue = 0;

    for (let i = 0; i < events.length; i++) {
      const ev = events[i];
      const isConf = ev.status === 'confirmed' || ev.is_confirmed;
      const isOverdue = !isConf && !!ev.date && ev.date < todayStr;

      if (isConf) {
        conf++;
      } else {
        est++;
      }

      if (isOverdue) {
        overdue++;
      }

      // Apply Filter Mode
      if (filterMode === 'confirmed' && !isConf) continue;
      if (filterMode === 'estimate' && isConf) continue;
      if (filterMode === 'overdue' && !isOverdue) continue;

      if (ev.date) {
        const dStr = ev.date;
        if (!byDate[dStr]) byDate[dStr] = [];
        byDate[dStr].push(ev);
      }
    }

    return {
      eventsByDate: byDate,
      confirmedCount: conf,
      estimateCount: est,
      overdueCount: overdue,
    };
  }, [events, filterMode, todayStr]);

  const handleDateClick = (dateStr: string, dayEvents: CalendarEvent[]) => {
    if (dayEvents.length > 0) {
      setSelectedDateEvents({ date: dateStr, events: dayEvents });
    }
  };

  // Construct Calendar Grid Cells (Memoized)
  const gridCells = useMemo(() => {
    const cells = [];
    for (let i = 0; i < firstDayOfMonth; i++) {
      cells.push(null);
    }
    for (let day = 1; day <= daysInMonth; day++) {
      const formattedDay = day < 10 ? `0${day}` : `${day}`;
      const formattedMonth = month + 1 < 10 ? `0${month + 1}` : `${month + 1}`;
      const dateStr = `${year}-${formattedMonth}-${formattedDay}`;
      cells.push({ day, dateStr, dayEvents: eventsByDate[dateStr] || [] });
    }
    return cells;
  }, [firstDayOfMonth, daysInMonth, year, month, eventsByDate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-500">
        <div className="w-6 h-6 border-2 border-sky-500 border-t-transparent rounded-full animate-spin mr-3"></div>
        <span>กำลังโหลดปฏิทินส่งสินค้า...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2.5">
            <CalendarIcon className="w-7 h-7 text-sky-600" />
            <span>Calendar (ปฏิทินรอบการส่งมอบวัตถุดิบ)</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            แสดงกำหนดส่งมอบวัตถุดิบและจำนวน (Qty) สามารถเลือกตัวกรองดูเฉพาะ ยืนยันแล้ว (สีเขียว 🟢) หรือ ประมาณการ (สีส้ม 🟠) ได้
          </p>
        </div>

        {/* Month Navigation */}
        <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-2xl border border-slate-200 shadow-sm">
          <button
            onClick={prevMonth}
            className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 transition"
            title="เดือนก่อนหน้า"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-sm font-extrabold text-slate-900 min-w-[140px] text-center">
            {monthNames[month]} {year + 543}
          </span>
          <button
            onClick={nextMonth}
            className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 transition"
            title="เดือนถัดไป"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Interactive Filter Status Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm text-xs">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-slate-600 font-bold mr-1">มุมมองตัวกรอง:</span>

          {/* All Filter Pill */}
          <button
            type="button"
            onClick={() => setFilterMode('all')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl font-bold transition shadow-2xs ${
              filterMode === 'all'
                ? 'bg-slate-900 text-white shadow-sm ring-2 ring-slate-900'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-sky-400"></span>
            <span>แสดงทั้งหมด ({events.length.toLocaleString()})</span>
          </button>

          {/* Confirmed Pill (Green) */}
          <button
            type="button"
            onClick={() => setFilterMode('confirmed')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl font-bold transition shadow-2xs ${
              filterMode === 'confirmed'
                ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-600'
                : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200'
            }`}
          >
            <span className={`w-2.5 h-2.5 rounded-full ${filterMode === 'confirmed' ? 'bg-white' : 'bg-emerald-500'}`}></span>
            <span>🟢 ยืนยันแล้ว ({confirmedCount.toLocaleString()})</span>
          </button>

          {/* Estimate Pill (Orange) */}
          <button
            type="button"
            onClick={() => setFilterMode('estimate')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl font-bold transition shadow-2xs cursor-pointer ${
              filterMode === 'estimate'
                ? 'bg-amber-600 text-white shadow-sm ring-2 ring-amber-600'
                : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300'
            }`}
          >
            <span className={`w-2.5 h-2.5 rounded-full ${filterMode === 'estimate' ? 'bg-white' : 'bg-amber-500'}`}></span>
            <span>🟠 ประมาณการ ({estimateCount.toLocaleString()})</span>
          </button>

          {/* Overdue Pill (Red) */}
          <button
            type="button"
            onClick={() => setFilterMode('overdue')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl font-bold transition shadow-2xs cursor-pointer ${
              filterMode === 'overdue'
                ? 'bg-rose-600 text-white shadow-sm ring-2 ring-rose-600'
                : 'bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200'
            }`}
          >
            <span className={`w-2.5 h-2.5 rounded-full ${filterMode === 'overdue' ? 'bg-white' : 'bg-rose-500'}`}></span>
            <span>🔴 เกินกำหนด ({overdueCount.toLocaleString()})</span>
          </button>
        </div>

        <div className="flex items-center gap-2 font-semibold text-slate-600 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
          <Truck className="w-4 h-4 text-sky-600 shrink-0" />
          <span>คลิกที่วันเพื่อดูรายละเอียดและผู้รับผิดชอบ</span>
        </div>
      </div>

      {/* Monthly Grid Calendar */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Days of Week Header */}
        <div className="grid grid-cols-7 bg-slate-900 text-slate-200 text-xs font-bold text-center py-3">
          <div className="text-rose-400">อาทิตย์</div>
          <div>จันทร์</div>
          <div>อังคาร</div>
          <div>พุธ</div>
          <div>พฤหัสบดี</div>
          <div>ศุกร์</div>
          <div className="text-sky-400">เสาร์</div>
        </div>

        {/* Date Grid Cells */}
        <div className="grid grid-cols-7 divide-x divide-y divide-slate-100 bg-slate-50/50">
          {gridCells.map((cell, index) => {
            if (!cell) {
              return <div key={`empty-${index}`} className="min-h-[125px] bg-slate-100/40"></div>;
            }

            const { day, dateStr, dayEvents } = cell;
            const hasEvents = dayEvents.length > 0;

            return (
              <div
                key={dateStr}
                onClick={() => handleDateClick(dateStr, dayEvents)}
                className={`min-h-[125px] p-2 flex flex-col justify-between transition-all ${
                  hasEvents
                    ? 'bg-white hover:bg-sky-50/60 cursor-pointer shadow-sm'
                    : 'bg-white/80'
                }`}
              >
                {/* Date Number Header */}
                <div className="flex items-center justify-between">
                  <span
                    className={`text-xs font-extrabold w-6 h-6 flex items-center justify-center rounded-full ${
                      hasEvents ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-700'
                    }`}
                  >
                    {day}
                  </span>
                  {hasEvents && (
                    <span className="text-[10px] font-bold text-sky-700 bg-sky-100 px-1.5 py-0.5 rounded-full">
                      {dayEvents.length} รายการ
                    </span>
                  )}
                </div>

                {/* Event Badges inside Date Cell */}
                <div className="space-y-1.5 my-1">
                  {dayEvents.slice(0, 2).map((ev) => {
                    const isConfirmed = ev.status === 'confirmed' || ev.is_confirmed;
                    const isOverdue = !isConfirmed && !!ev.date && ev.date < todayStr;
                    const itemCode = ev.item_code || ev.title.split(' - ')[0];
                    const supName = ev.supplier_name || ev.title.split(' - ')[1] || '';
                    const buyerName = ev.buyer_name && ev.buyer_name !== '-' ? ev.buyer_name : '';

                    return (
                      <div
                        key={ev.id}
                        className={`p-1.5 rounded-lg text-[10px] border shadow-2xs transition ${
                          isConfirmed
                            ? 'bg-emerald-50/95 text-emerald-950 border-emerald-300 hover:border-emerald-400'
                            : isOverdue
                            ? 'bg-rose-50/95 text-rose-950 border-rose-300 hover:border-rose-400 ring-1 ring-rose-300/60'
                            : 'bg-amber-50/95 text-amber-950 border-amber-300 hover:border-amber-400'
                        }`}
                      >
                        {/* LINE 1: Item Code (Left) + Qty & Unit (Right) */}
                        <div className="flex items-center justify-between gap-1 leading-tight">
                          <span className="font-extrabold text-[10px] truncate text-slate-900" title={itemCode}>
                            {itemCode}
                          </span>
                          <span className={`font-black text-[10px] shrink-0 whitespace-nowrap ${
                            isConfirmed ? 'text-emerald-700' : isOverdue ? 'text-rose-700' : 'text-amber-800'
                          }`}>
                            {ev.quantity.toLocaleString()} {ev.unit}
                          </span>
                        </div>

                        {/* LINE 2: Supplier Name (Left) + Buyer Name (Right) */}
                        <div className="flex items-center justify-between gap-1 text-[9px] leading-tight mt-0.5">
                          <span className="text-slate-500 truncate text-left" title={supName}>
                            {supName}
                          </span>
                          {buyerName && (
                            <span className="font-bold text-slate-700 shrink-0 bg-white/80 px-1 py-0.2 rounded border border-slate-200" title={`ผู้ดูแล: ${buyerName}`}>
                              {buyerName}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {dayEvents.length > 2 && (
                    <div className="text-[9px] font-bold text-sky-600 text-center bg-sky-50 py-0.5 rounded border border-sky-100">
                      +{dayEvents.length - 2} รายการเพิ่มเติม...
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal: Date Detail View */}
      {selectedDateEvents && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <CalendarIcon className="w-5 h-5 text-sky-600" />
                <h3 className="text-base font-bold text-slate-900">
                  รายการส่งของวันที่ {new Date(selectedDateEvents.date).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                </h3>
              </div>
              <button
                onClick={() => setSelectedDateEvents(null)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              {selectedDateEvents.events.map((ev) => {
                const isConfirmed = ev.status === 'confirmed' || ev.is_confirmed;
                const isOverdue = !isConfirmed && !!ev.date && ev.date < todayStr;
                const itemCode = ev.item_code || ev.title.split(' - ')[0];
                const supName = ev.supplier_name || ev.title.split(' - ')[1] || '';
                const buyerName = ev.buyer_name && ev.buyer_name !== '-' ? ev.buyer_name : '-';

                return (
                  <div key={ev.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                        <Package className="w-4 h-4 text-sky-600" />
                        PO: {ev.po_number}
                      </span>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                        isConfirmed
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : isOverdue
                          ? 'bg-rose-50 text-rose-700 border-rose-200 font-extrabold'
                          : 'bg-amber-50 text-amber-800 border-amber-200'
                      }`}>
                        {isConfirmed
                          ? '🟢 Confirmed (ยืนยันแล้ว)'
                          : isOverdue
                          ? '🔴 Overdue (เกินกำหนดส่งมอบ)'
                          : '🟠 Estimate (ประมาณการ)'}
                      </span>
                    </div>

                    <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-slate-900 text-xs">{itemCode}</span>
                        <span className={`font-black text-sm ${
                          isConfirmed ? 'text-emerald-700' : isOverdue ? 'text-rose-700' : 'text-amber-800'
                        }`}>
                          {ev.quantity.toLocaleString()} {ev.unit}
                        </span>
                      </div>
                      {ev.item_name && <div className="text-[11px] text-slate-500">{ev.item_name}</div>}
                      
                      <div className="flex items-center justify-between pt-1.5 border-t border-slate-100 text-[11px]">
                        <div className="flex items-center gap-1 text-slate-600">
                          <Building2 className="w-3.5 h-3.5 text-slate-400" />
                          <span className="font-semibold">{supName}</span>
                        </div>
                        <div className="flex items-center gap-1 text-slate-700 font-bold bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                          <span>{buyerName}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                      <span>ผู้ปรับปรุงล่าสุด: <strong className="text-slate-700">{ev.updated_by}</strong></span>
                      <span>กำหนดส่ง: <strong>{new Date(ev.date).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' })}</strong></span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
