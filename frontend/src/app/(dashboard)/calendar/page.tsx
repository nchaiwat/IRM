'use client';

import React, { useEffect, useState } from 'react';
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
  date: string; // YYYY-MM-DD
  quantity: number;
  unit: string;
  status: string;
  po_number: string;
  updated_by: string;
}

export default function CalendarPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDateEvents, setSelectedDateEvents] = useState<{ date: string; events: CalendarEvent[] } | null>(null);

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

  // Group events by date string (YYYY-MM-DD)
  const eventsByDate: Record<string, CalendarEvent[]> = {};
  events.forEach((ev) => {
    if (ev.date) {
      const dStr = ev.date;
      if (!eventsByDate[dStr]) eventsByDate[dStr] = [];
      eventsByDate[dStr].push(ev);
    }
  });

  const handleDateClick = (dateStr: string, dayEvents: CalendarEvent[]) => {
    if (dayEvents.length > 0) {
      setSelectedDateEvents({ date: dateStr, events: dayEvents });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-500">
        <div className="w-6 h-6 border-2 border-sky-500 border-t-transparent rounded-full animate-spin mr-3"></div>
        <span>กำลังโหลดปฏิทินส่งสินค้า...</span>
      </div>
    );
  }

  // Construct Calendar Grid Cells
  const gridCells = [];
  // Empty cells before 1st of month
  for (let i = 0; i < firstDayOfMonth; i++) {
    gridCells.push(null);
  }
  // Days 1..daysInMonth
  for (let day = 1; day <= daysInMonth; day++) {
    const formattedDay = day < 10 ? `0${day}` : `${day}`;
    const formattedMonth = month + 1 < 10 ? `0${month + 1}` : `${month + 1}`;
    const dateStr = `${year}-${formattedMonth}-${formattedDay}`;
    gridCells.push({ day, dateStr, dayEvents: eventsByDate[dateStr] || [] });
  }

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2.5">
            <CalendarIcon className="w-7 h-7 text-sky-600" />
            <span>Calendar (ปฏิทินรอบการส่งวัตถุดิบ)</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            แสดงกำหนดการส่งของจาก Supplier ในแต่ละวัน (คลิกที่วันเพื่อดูรายละเอียด)
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

      {/* Status Bar & Confirmation Notice */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm text-xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold shadow-2xs">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-2xs"></span>
            <span>🟢 ยืนยันแล้ว (Confirmed - Exact Date): {events.length} รายการ</span>
          </div>
          <span className="text-slate-400 hidden sm:inline">|</span>
          <span className="text-slate-500 text-xs font-medium">
            ปฏิทินจะแสดง<strong>เฉพาะรายการที่ฝ่ายจัดซื้อกด Accept / Confirm</strong> แล้วเท่านั้น
          </span>
        </div>

        <div className="flex items-center gap-2 font-semibold text-emerald-700 bg-emerald-50/60 px-3 py-1.5 rounded-xl border border-emerald-100">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>100% Exact Delivery Dates</span>
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
              return <div key={`empty-${index}`} className="min-h-[115px] bg-slate-100/40"></div>;
            }

            const { day, dateStr, dayEvents } = cell;
            const hasEvents = dayEvents.length > 0;

            return (
              <div
                key={dateStr}
                onClick={() => handleDateClick(dateStr, dayEvents)}
                className={`min-h-[115px] p-2 flex flex-col justify-between transition-all ${
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
                    const isConfirmed = ev.status === 'confirmed';
                    const isResponded = ev.status === 'supplier_responded';
                    const itemCode = ev.item_code || ev.title.split(' - ')[0];
                    const supName = ev.supplier_name || ev.title.split(' - ')[1] || '';

                    return (
                      <div
                        key={ev.id}
                        className={`p-1.5 rounded-lg text-[10px] border shadow-2xs ${
                          isConfirmed
                            ? 'bg-emerald-50/90 text-emerald-950 border-emerald-200'
                            : isResponded
                            ? 'bg-amber-50/90 text-amber-950 border-amber-300'
                            : 'bg-slate-100/90 text-slate-900 border-slate-200'
                        }`}
                      >
                        {/* TOP ROW: Item Code (Left) + Qty & Unit (Right) */}
                        <div className="flex items-center justify-between gap-1 leading-tight">
                          <span className="font-extrabold text-[10px] truncate text-slate-900" title={itemCode}>
                            {itemCode}
                          </span>
                          <span className="font-black text-[10px] text-sky-700 shrink-0 whitespace-nowrap">
                            {ev.quantity.toLocaleString()} {ev.unit}
                          </span>
                        </div>

                        {/* BOTTOM ROW: Supplier Name (Left) */}
                        <div className="text-[9px] text-slate-500 truncate text-left leading-tight mt-0.5" title={supName}>
                          {supName}
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
                const itemCode = ev.item_code || ev.title.split(' - ')[0];
                const supName = ev.supplier_name || ev.title.split(' - ')[1] || '';

                return (
                  <div key={ev.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                        <Package className="w-4 h-4 text-sky-600" />
                        PO: {ev.po_number}
                      </span>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                        ev.status === 'confirmed'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-amber-50 text-amber-800 border-amber-200'
                      }`}>
                        {ev.status === 'confirmed' ? 'Confirmed' : 'Estimate'}
                      </span>
                    </div>

                    <div className="bg-white p-2.5 rounded-xl border border-slate-200 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-slate-900 text-xs">{itemCode}</span>
                        <span className="font-black text-sky-700">{ev.quantity.toLocaleString()} {ev.unit}</span>
                      </div>
                      {ev.item_name && <div className="text-[11px] text-slate-500">{ev.item_name}</div>}
                      <div className="text-[11px] text-slate-600 flex items-center gap-1 pt-1 border-t border-slate-100 mt-1">
                        <Building2 className="w-3 h-3 text-slate-400" />
                        <span className="font-semibold">{supName}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                      <span>ผู้ปรับปรุงล่าสุด: <strong className="text-slate-700">{ev.updated_by}</strong></span>
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
