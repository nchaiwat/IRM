'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  FileCheck,
  Printer,
  Calendar as CalendarIcon,
  Filter,
  Search,
  RefreshCw,
  Package,
  Building2,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Layers,
  UserCheck,
} from 'lucide-react';
import { api } from '@/lib/api';

interface ChecklistItem {
  id: string;
  po_id: number;
  po_number: string;
  po_date: string | null;
  line_num: number;
  item_code: string;
  item_name: string;
  item_group: string;
  quantity: number;
  unit: string;
  delivery_date: string;
  status: 'confirmed' | 'estimate';
  is_confirmed: boolean;
  is_overdue: boolean;
  supplier_code: string;
  supplier_name: string;
  buyer_name: string;
  updated_by: string;
  is_sub_item: boolean;
}

interface ChecklistResponse {
  items: ChecklistItem[];
  summary: {
    total_items: number;
    total_pos: number;
    total_suppliers: number;
    total_quantity: number;
    confirmed_count: number;
    estimate_count: number;
    overdue_count: number;
  };
  filters_applied: {
    date_from: string | null;
    date_to: string | null;
    item_group: string;
    status_mode: string;
    user_allowed_groups: string;
  };
}

// Helper: format buyer name without "B-"
const formatBuyerName = (name?: string | null) => {
  if (!name || name === '-') return '-';
  return name.replace(/^[bB]-/, '').trim();
};

// Helper: group badge styling matching Item Master
const getGroupBadge = (grp?: string | null) => {
  const g = (grp || '').trim();
  if (!g || g === '-') return <span className="text-slate-300">-</span>;
  if (g === 'RM-กระจก') {
    return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 inline-block">RM-กระจก</span>;
  }
  if (g.startsWith('RM-ALU/UPVC')) {
    return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-300 inline-block">{g}</span>;
  }
  if (g === 'HW') {
    return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-800 border border-sky-300 inline-block">HW</span>;
  }
  if (g === 'RM-เหล็กดัด') {
    return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 inline-block">RM-เหล็กดัด</span>;
  }
  if (g.startsWith('FG-')) {
    return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300 inline-block">{g}</span>;
  }
  if (g.startsWith('SP')) {
    return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-300 inline-block">{g}</span>;
  }
  if (g.startsWith('HW-')) {
    return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-100 text-teal-800 border border-teal-300 inline-block">{g}</span>;
  }
  return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-800 border border-slate-300 inline-block">{g}</span>;
};

export default function ReceivingChecklistPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ChecklistResponse | null>(null);
  const [itemGroups, setItemGroups] = useState<string[]>([]);

  // Filter States
  const [presetPeriod, setPresetPeriod] = useState<'today' | 'this_week' | 'next_week' | 'this_month' | 'custom'>('today');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'confirmed' | 'estimate' | 'overdue'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Mask function for DD/MM/YYYY
  const handleDateMask = (val: string) => {
    let cleaned = val.replace(/\D/g, '');
    if (cleaned.length > 8) cleaned = cleaned.slice(0, 8);
    if (cleaned.length > 4) {
      return `${cleaned.slice(0, 2)}/${cleaned.slice(2, 4)}/${cleaned.slice(4)}`;
    } else if (cleaned.length > 2) {
      return `${cleaned.slice(0, 2)}/${cleaned.slice(2)}`;
    }
    return cleaned;
  };

  // Convert DD/MM/YYYY to YYYY-MM-DD for backend API
  const toIsoDate = (dStr: string) => {
    if (!dStr) return '';
    const trimmed = dStr.trim();
    if (trimmed.includes('/')) {
      const [d, m, y] = trimmed.split('/');
      if (d && m && y && y.length === 4) {
        return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
      }
    }
    return trimmed;
  };

  // Helper date generators (DD/MM/YYYY)
  const getTodayStr = () => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${day}/${m}/${y}`;
  };

  const getWeekRange = (offsetWeeks = 0) => {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = Sun, 1 = Mon...
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(now);
    monday.setDate(now.getDate() + diffToMonday + offsetWeeks * 7);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const format = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${day}/${m}/${y}`;
    };

    return { from: format(monday), to: format(sunday) };
  };

  const getMonthRange = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const lastDay = String(new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()).padStart(2, '0');

    return { from: `01/${m}/${y}`, to: `${lastDay}/${m}/${y}` };
  };

  // Initialize Today Preset on load
  useEffect(() => {
    const today = getTodayStr();
    setDateFrom(today);
    setDateTo(today);
    fetchItemGroups();
  }, []);

  const fetchItemGroups = async () => {
    try {
      const res = await api.get<string[]>('/api/receiving-checklist/item-groups');
      setItemGroups(res.data);
    } catch (err) {
      console.error('Failed to fetch item groups:', err);
    }
  };

  const fetchChecklist = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {
        status_mode: statusFilter,
      };
      const isoFrom = toIsoDate(dateFrom);
      const isoTo = toIsoDate(dateTo);

      if (isoFrom) params.date_from = isoFrom;
      if (isoTo) params.date_to = isoTo;
      if (selectedGroup && selectedGroup !== 'all') params.item_group = selectedGroup;

      const res = await api.get<ChecklistResponse>('/api/receiving-checklist', { params });
      setData(res.data);
    } catch (err) {
      console.error('Failed to fetch receiving checklist:', err);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, selectedGroup, statusFilter]);

  useEffect(() => {
    if (dateFrom && dateTo) {
      fetchChecklist();
    }
  }, [fetchChecklist, dateFrom, dateTo, selectedGroup, statusFilter]);

  // Apply Preset Handler
  const applyPreset = (preset: 'today' | 'this_week' | 'next_week' | 'this_month' | 'custom') => {
    setPresetPeriod(preset);
    if (preset === 'today') {
      const today = getTodayStr();
      setDateFrom(today);
      setDateTo(today);
    } else if (preset === 'this_week') {
      const { from, to } = getWeekRange(0);
      setDateFrom(from);
      setDateTo(to);
    } else if (preset === 'next_week') {
      const { from, to } = getWeekRange(1);
      setDateFrom(from);
      setDateTo(to);
    } else if (preset === 'this_month') {
      const { from, to } = getMonthRange();
      setDateFrom(from);
      setDateTo(to);
    }
  };

  // Filtered items by search query
  const filteredItems = useMemo(() => {
    if (!data?.items) return [];
    if (!searchQuery.trim()) return data.items;
    const q = searchQuery.toLowerCase().trim();
    return data.items.filter(
      (it) =>
        it.po_number.toLowerCase().includes(q) ||
        it.item_code.toLowerCase().includes(q) ||
        it.item_name.toLowerCase().includes(q) ||
        it.supplier_name.toLowerCase().includes(q) ||
        it.buyer_name.toLowerCase().includes(q) ||
        it.item_group.toLowerCase().includes(q)
    );
  }, [data?.items, searchQuery]);

  const handlePrint = () => {
    window.print();
  };

  const formatDisplayDate = (dStr: string) => {
    if (!dStr) return '-';
    const trimmed = dStr.trim();
    if (trimmed.includes('/')) return trimmed;
    if (trimmed.includes('-')) {
      const [y, m, d] = trimmed.split('-');
      if (y && m && d) {
        return `${d}/${m}/${y}`;
      }
    }
    return trimmed;
  };

  return (
    <div className="space-y-6">
      {/* ─── SCREEN ONLY: Header & Controls ─────────────────────────────────── */}
      <div className="print:hidden space-y-6">
        {/* Title and Top Actions */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2.5">
              <FileCheck className="w-7 h-7 text-sky-600" />
              <span>Receiving Checklist (ใบตรวจรับมอบวัตถุดิบประจำวัน)</span>
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              สร้างรายการเช็คลิสต์สำหรับตรวจรับวัตถุดิบหน้างาน กรองตามกลุ่มสินค้า (Item Group) และสั่งพิมพ์เอกสาร A4
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={fetchChecklist}
              className="p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition shadow-2xs cursor-pointer"
              title="รีเฟรชข้อมูล"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-sky-600' : ''}`} />
            </button>

            <button
              type="button"
              onClick={handlePrint}
              disabled={filteredItems.length === 0}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs bg-sky-600 hover:bg-sky-700 text-white transition shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Printer className="w-4 h-4" />
              <span>พิมพ์ใบตรวจรับสินค้า (A4 Print Sheet)</span>
            </button>
          </div>
        </div>

        {/* KPI Stats Cards (5-Column Layout) */}
        {data && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {/* Total Items */}
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between text-slate-500 text-[11px] font-bold">
                <span>รายการทั้งหมด</span>
                <Package className="w-4 h-4 text-sky-600" />
              </div>
              <div className="mt-1.5 text-xl font-black text-slate-900">
                {data.summary.total_items.toLocaleString()}
                <span className="text-xs font-normal text-slate-500 ml-1">รายการ</span>
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                รวม {data.summary.total_quantity.toLocaleString()} หน่วย
              </div>
            </div>

            {/* Total POs */}
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between text-slate-500 text-[11px] font-bold">
                <span>ใบสั่งซื้อ (PO)</span>
                <Layers className="w-4 h-4 text-indigo-600" />
              </div>
              <div className="mt-1.5 text-xl font-black text-slate-900">
                {data.summary.total_pos.toLocaleString()}
                <span className="text-xs font-normal text-slate-500 ml-1">PO</span>
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                จาก {data.summary.total_suppliers} ผู้ขาย
              </div>
            </div>

            {/* Confirmed */}
            <div className="bg-white p-3.5 rounded-2xl border border-emerald-200 shadow-2xs bg-emerald-50/20">
              <div className="flex items-center justify-between text-emerald-700 text-[11px] font-bold">
                <span>🟢 ยืนยันแล้ว</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="mt-1.5 text-xl font-black text-emerald-700">
                {data.summary.confirmed_count.toLocaleString()}
                <span className="text-xs font-normal text-emerald-600 ml-1">รายการ</span>
              </div>
              <div className="text-[10px] text-emerald-600/80 mt-0.5">
                Confirmed Delivery
              </div>
            </div>

            {/* Estimate */}
            <div className="bg-white p-3.5 rounded-2xl border border-amber-200 shadow-2xs bg-amber-50/20">
              <div className="flex items-center justify-between text-amber-800 text-[11px] font-bold">
                <span>🟠 ประมาณการ</span>
                <Clock className="w-4 h-4 text-amber-600" />
              </div>
              <div className="mt-1.5 text-xl font-black text-amber-800">
                {data.summary.estimate_count.toLocaleString()}
                <span className="text-xs font-normal text-amber-700 ml-1">รายการ</span>
              </div>
              <div className="text-[10px] text-amber-700/80 mt-0.5">
                Estimate Delivery
              </div>
            </div>

            {/* Overdue */}
            <div className="bg-white p-3.5 rounded-2xl border border-rose-200 shadow-2xs bg-rose-50/20">
              <div className="flex items-center justify-between text-rose-700 text-[11px] font-bold">
                <span>🔴 เกินกำหนด</span>
                <AlertTriangle className="w-4 h-4 text-rose-600" />
              </div>
              <div className="mt-1.5 text-xl font-black text-rose-700">
                {data.summary.overdue_count.toLocaleString()}
                <span className="text-xs font-normal text-rose-600 ml-1">รายการ</span>
              </div>
              <div className="text-[10px] text-rose-600/80 mt-0.5">
                Overdue Unconfirmed
              </div>
            </div>
          </div>
        )}

        {/* Filter Toolbar */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          {/* Row 1: Period Presets + Custom Date Pickers */}
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-700 mr-1 flex items-center gap-1.5">
                <CalendarIcon className="w-3.5 h-3.5 text-sky-600" />
                <span>ช่วงเวลาตรวจรับ:</span>
              </span>

              <button
                type="button"
                onClick={() => applyPreset('today')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  presetPeriod === 'today'
                    ? 'bg-sky-600 text-white shadow-2xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                วันนี้ (Today)
              </button>

              <button
                type="button"
                onClick={() => applyPreset('this_week')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  presetPeriod === 'this_week'
                    ? 'bg-sky-600 text-white shadow-2xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                สัปดาห์นี้
              </button>

              <button
                type="button"
                onClick={() => applyPreset('next_week')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  presetPeriod === 'next_week'
                    ? 'bg-sky-600 text-white shadow-2xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                สัปดาห์หน้า
              </button>

              <button
                type="button"
                onClick={() => applyPreset('this_month')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  presetPeriod === 'this_month'
                    ? 'bg-sky-600 text-white shadow-2xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                เดือนนี้
              </button>
            </div>

            {/* Custom Date Pickers */}
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-500 font-semibold">จาก:</span>
              <div className="relative flex items-center">
                <input
                  type="text"
                  placeholder="วว/ดด/ปปปป"
                  value={dateFrom}
                  onChange={(e) => {
                    setDateFrom(handleDateMask(e.target.value));
                    setPresetPeriod('custom');
                  }}
                  className="w-28 pl-2.5 pr-7 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-sky-500 focus:bg-white"
                />
                <button
                  type="button"
                  onClick={(e) => {
                    const hiddenDate = e.currentTarget.nextElementSibling as HTMLInputElement;
                    if (hiddenDate) {
                      if ('showPicker' in HTMLInputElement.prototype) {
                        hiddenDate.showPicker();
                      } else {
                        hiddenDate.focus();
                      }
                    }
                  }}
                  className="absolute right-2 text-slate-400 hover:text-sky-600 focus:outline-none cursor-pointer"
                  title="คลิกเพื่อเลือกจากปฏิทิน"
                >
                  <CalendarIcon className="w-3.5 h-3.5" />
                </button>
                <input
                  type="date"
                  tabIndex={-1}
                  className="absolute opacity-0 pointer-events-none w-0 h-0"
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val) {
                      const [y, m, d] = val.split('-');
                      setDateFrom(`${d}/${m}/${y}`);
                      setPresetPeriod('custom');
                    }
                  }}
                />
              </div>

              <span className="text-slate-500 font-semibold">ถึง:</span>
              <div className="relative flex items-center">
                <input
                  type="text"
                  placeholder="วว/ดด/ปปปป"
                  value={dateTo}
                  onChange={(e) => {
                    setDateTo(handleDateMask(e.target.value));
                    setPresetPeriod('custom');
                  }}
                  className="w-28 pl-2.5 pr-7 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-sky-500 focus:bg-white"
                />
                <button
                  type="button"
                  onClick={(e) => {
                    const hiddenDate = e.currentTarget.nextElementSibling as HTMLInputElement;
                    if (hiddenDate) {
                      if ('showPicker' in HTMLInputElement.prototype) {
                        hiddenDate.showPicker();
                      } else {
                        hiddenDate.focus();
                      }
                    }
                  }}
                  className="absolute right-2 text-slate-400 hover:text-sky-600 focus:outline-none cursor-pointer"
                  title="คลิกเพื่อเลือกจากปฏิทิน"
                >
                  <CalendarIcon className="w-3.5 h-3.5" />
                </button>
                <input
                  type="date"
                  tabIndex={-1}
                  className="absolute opacity-0 pointer-events-none w-0 h-0"
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val) {
                      const [y, m, d] = val.split('-');
                      setDateTo(`${d}/${m}/${y}`);
                      setPresetPeriod('custom');
                    }
                  }}
                />
              </div>
            </div>
          </div>

          {/* Row 2: Item Group Dropdown + Status Selector + Search Box */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              {/* Item Group Filter Dropdown */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-700">กลุ่มสินค้า:</span>
                <select
                  value={selectedGroup}
                  onChange={(e) => setSelectedGroup(e.target.value)}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer"
                >
                  <option value="all">ทั้งหมด (All Groups)</option>
                  {itemGroups.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </div>

              {/* Status Filter Buttons */}
              <div className="flex items-center gap-1.5 text-xs">
                <button
                  type="button"
                  onClick={() => setStatusFilter('all')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                    statusFilter === 'all'
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  ทุกสถานะ
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('confirmed')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                    statusFilter === 'confirmed'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200'
                  }`}
                >
                  🟢 ยืนยันแล้ว
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('estimate')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                    statusFilter === 'estimate'
                      ? 'bg-amber-600 text-white'
                      : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300'
                  }`}
                >
                  🟠 ประมาณการ
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('overdue')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                    statusFilter === 'overdue'
                      ? 'bg-rose-600 text-white'
                      : 'bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200'
                  }`}
                >
                  🔴 เกินกำหนด
                </button>
              </div>
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="ค้นหา PO, รหัสสินค้า, ผู้ขาย..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 font-medium"
              />
            </div>
          </div>
        </div>

        {/* Checklist Data Table (Screen View) */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between p-4 bg-slate-50 border-b border-slate-200">
            <div className="text-xs font-bold text-slate-700">
              รายการวัตถุดิบที่ต้องตรวจรับตามเงื่อนไข
            </div>

            <div className="text-xs text-slate-500 font-semibold">
              แสดง {filteredItems.length.toLocaleString()} จากทั้งหมด {data?.items.length || 0} รายการ
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-48 text-slate-500 text-xs">
              <div className="w-5 h-5 border-2 border-sky-500 border-t-transparent rounded-full animate-spin mr-2.5"></div>
              <span>กำลังโหลดรายการเช็คลิสต์ตรวจรับ...</span>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-xs space-y-2">
              <FileCheck className="w-10 h-10 mx-auto text-slate-300" />
              <p className="font-bold text-slate-600">ไม่พบรายการนัดส่งตามเงื่อนไขที่เลือก</p>
              <p>กรุณาปรับช่วงวันที่ตรวจรับ หรือกลุ่มสินค้าเพื่อค้นหาใหม่</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-900 text-slate-200 font-bold border-b border-slate-800">
                    <th className="py-3 px-2 text-center w-10">#</th>
                    <th className="py-3 px-3 w-28 whitespace-nowrap">กำหนดส่ง</th>
                    <th className="py-3 px-3 w-28 whitespace-nowrap">เลขที่ PO</th>
                    <th className="py-3 px-3 min-w-[220px]">รหัสสินค้า & ชื่อสินค้า</th>
                    <th className="py-3 px-2 text-center w-28 whitespace-nowrap">กลุ่มสินค้า</th>
                    <th className="py-3 px-3 text-right w-28 whitespace-nowrap">จำนวนนัดส่ง</th>
                    <th className="py-3 px-3 w-52 whitespace-nowrap">ผู้ขาย (Supplier)</th>
                    <th className="py-3 px-3 w-32 whitespace-nowrap">ผู้ดูแล</th>
                    <th className="py-3 px-2 text-center w-28 whitespace-nowrap">สถานะ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {(() => {
                    let lastPoNumber = '';
                    return filteredItems.map((item, idx) => {
                      const isFirstInPo = item.po_number !== lastPoNumber;
                      if (isFirstInPo) {
                        lastPoNumber = item.po_number;
                      }

                      return (
                        <tr
                          key={item.id}
                          className={`transition hover:bg-slate-50/80 ${
                            isFirstInPo && idx > 0
                              ? '!border-t-2 !border-t-slate-300 shadow-[0_-2px_4px_rgba(0,0,0,0.03)]'
                              : ''
                          }`}
                        >
                          {/* Index */}
                          <td className="py-2.5 px-2 text-center text-slate-400 font-semibold">{idx + 1}</td>

                          {/* Delivery Date */}
                          <td className="py-2.5 px-3 font-bold text-slate-900 whitespace-nowrap align-top">
                            {isFirstInPo ? formatDisplayDate(item.delivery_date) : null}
                          </td>

                          {/* PO Number */}
                          <td className="py-2.5 px-3 font-bold text-sky-700 whitespace-nowrap align-top">
                            {isFirstInPo ? item.po_number : null}
                          </td>

                          {/* Item Code & Description */}
                          <td className="py-2.5 px-3">
                            <div className="font-extrabold text-slate-900 truncate" title={item.item_code}>
                              {item.item_code}
                            </div>
                            <div className="text-[11px] text-slate-500 truncate mt-0.5" title={item.item_name}>
                              {item.item_name}
                            </div>
                          </td>

                          {/* Item Group */}
                          <td className="py-2.5 px-2 text-center whitespace-nowrap">
                            {getGroupBadge(item.item_group)}
                          </td>

                          {/* Quantity */}
                          <td className="py-2.5 px-3 text-right font-black text-slate-900 whitespace-nowrap">
                            {item.quantity.toLocaleString()}{' '}
                            <span className="font-normal text-slate-500 text-[11px]">{item.unit}</span>
                          </td>

                          {/* Supplier */}
                          <td className="py-2.5 px-3 max-w-[200px] truncate" title={item.supplier_name}>
                            <span className="font-semibold text-slate-800">{item.supplier_name}</span>
                          </td>

                          {/* Buyer */}
                          <td className="py-2.5 px-3 whitespace-nowrap text-slate-700 text-[11px] font-medium">
                            {formatBuyerName(item.buyer_name)}
                          </td>

                          {/* Status Badge */}
                          <td className="py-2.5 px-2 text-center whitespace-nowrap">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                item.is_confirmed
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : item.is_overdue
                                  ? 'bg-rose-50 text-rose-700 border-rose-200 font-extrabold'
                                  : 'bg-amber-50 text-amber-800 border-amber-200'
                              }`}
                            >
                              {item.is_confirmed
                                ? '🟢 Confirmed'
                                : item.is_overdue
                                ? '🔴 Overdue'
                                : '🟠 Estimate'}
                            </span>
                          </td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ─── PRINT ONLY: A4 Print Layout Sheet ──────────────────────────────── */}
      <div className="hidden print:block font-sans text-slate-900 bg-white p-4">
        {/* Document Header */}
        <div className="border-b-2 border-slate-900 pb-3 mb-4">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-xl font-black tracking-tight text-slate-900 uppercase">
                บริษัท วินโดว์ เอเชีย จำกัด (มหาชน)
              </h1>
              <h2 className="text-base font-extrabold text-slate-800 mt-0.5">
                ใบตรวจรับมอบวัตถุดิบประจำวัน (Daily Receiving Inspection Checklist)
              </h2>
            </div>
            <div className="text-right text-xs text-slate-600 space-y-0.5">
              <div>
                <strong>วันที่พิมพ์:</strong>{' '}
                {new Date().toLocaleDateString('th-TH', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </div>
              <div>
                <strong>กลุ่มสินค้า:</strong> {selectedGroup === 'all' ? 'ทุกกลุ่มสินค้า' : `กลุ่ม ${selectedGroup}`}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 mt-3 pt-2 border-t border-slate-300 text-xs">
            <div>
              <strong>ช่วงวันที่ตรวจรับ:</strong> {formatDisplayDate(dateFrom)} - {formatDisplayDate(dateTo)}
            </div>
            <div>
              <strong>สถานะรายการ:</strong>{' '}
              {statusFilter === 'all'
                ? 'ทั้งหมด (Confirmed & Estimate)'
                : statusFilter === 'confirmed'
                ? 'เฉพาะยืนยันแล้ว (Confirmed)'
                : statusFilter === 'estimate'
                ? 'เฉพาะประมาณการ (Estimate)'
                : 'เกินกำหนด (Overdue)'}
            </div>
            <div className="text-right">
              <strong>รวมทั้งหมด:</strong> {filteredItems.length} รายการ (
              {filteredItems.reduce((acc, it) => acc + it.quantity, 0).toLocaleString()} หน่วย)
            </div>
          </div>
        </div>

        {/* Printable Checklist Table */}
        <table className="w-full text-left text-[10px] border-collapse border border-slate-400">
          <thead>
            <tr className="bg-slate-100 text-slate-900 font-bold border-b border-slate-400">
              <th className="py-1 px-1 text-center border-r border-slate-400 w-7">ลำดับ</th>
              <th className="py-1 px-1.5 border-r border-slate-400 w-18">กำหนดส่ง</th>
              <th className="py-1 px-1.5 border-r border-slate-400 w-20">เลขที่ PO</th>
              <th className="py-1 px-1.5 border-r border-slate-400">รหัสสินค้า / รายละเอียดสินค้า</th>
              <th className="py-1 px-1 text-center border-r border-slate-400 w-14">กลุ่ม</th>
              <th className="py-1 px-1.5 text-right border-r border-slate-400 w-16">จำนวนนัดส่ง</th>
              <th className="py-1 px-1.5 border-r border-slate-400 w-32">ผู้ขาย (Supplier)</th>
              <th className="py-1 px-1 text-center border-r border-slate-400 w-20">ผลการตรวจรับ</th>
              <th className="py-1 px-1 text-center w-20">หมายเหตุ / เลขที่บิล</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-300">
            {(() => {
              let lastPoNumber = '';
              return filteredItems.map((item, idx) => {
                const isFirstInPo = item.po_number !== lastPoNumber;
                if (isFirstInPo) {
                  lastPoNumber = item.po_number;
                }

                return (
                  <tr
                    key={item.id}
                    className={`border-b border-slate-300 ${
                      isFirstInPo && idx > 0 ? '!border-t-2 !border-t-slate-500' : ''
                    }`}
                    style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}
                  >
                    <td className="py-1 px-1 text-center font-semibold border-r border-slate-300">{idx + 1}</td>
                    <td className="py-1 px-1.5 font-bold border-r border-slate-300 whitespace-nowrap">
                      {isFirstInPo ? formatDisplayDate(item.delivery_date) : null}
                    </td>
                    <td className="py-1 px-1.5 font-bold border-r border-slate-300 whitespace-nowrap">
                      {isFirstInPo ? item.po_number : null}
                    </td>
                    <td className="py-1 px-1.5 border-r border-slate-300">
                      <div className="font-bold">{item.item_code}</div>
                      <div className="text-[9px] text-slate-600 leading-tight line-clamp-2">{item.item_name}</div>
                    </td>
                    <td className="py-1 px-1 text-center border-r border-slate-300 font-semibold">
                      {item.item_group || '-'}
                    </td>
                    <td className="py-1 px-1.5 text-right font-black border-r border-slate-300 whitespace-nowrap">
                      {item.quantity.toLocaleString()} {item.unit}
                    </td>
                    <td className="py-1 px-1.5 border-r border-slate-300 text-[9px] leading-tight">
                      {item.supplier_name}
                    </td>
                    {/* Physical Checklist Box */}
                    <td className="py-1 px-1 border-r border-slate-300 text-[9px]">
                      <div className="flex flex-col gap-0.5">
                        <span className="flex items-center gap-1">
                          <span className="inline-block w-2.5 h-2.5 border border-slate-700 rounded-2xs"></span>
                          <span>ครบถ้วน</span>
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="inline-block w-2.5 h-2.5 border border-slate-700 rounded-2xs"></span>
                          <span>ขาด: .....</span>
                        </span>
                      </div>
                    </td>
                    {/* Notes / Invoice */}
                    <td className="py-1 px-1 text-[9px] text-slate-400"></td>
                  </tr>
                );
              });
            })()}
          </tbody>
        </table>

        {/* Guaranteed Signatures Section at the end of Document */}
        <div
          className="mt-4 pt-3 border-t-2 border-slate-800"
          style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}
        >
          <div className="grid grid-cols-3 gap-6 text-center text-[10px] text-slate-800 pt-2 pb-1">
            <div className="space-y-2.5">
              <div>ลงชื่อ ............................................................</div>
              <div>( ............................................................ )</div>
              <div className="font-bold text-slate-900">ผู้ส่งมอบสินค้า (Supplier / Driver)</div>
            </div>
            <div className="space-y-2.5">
              <div>ลงชื่อ ............................................................</div>
              <div>( ............................................................ )</div>
              <div className="font-bold text-slate-900">ผู้ตรวจรับสินค้า (Warehouse Inspector)</div>
            </div>
            <div className="space-y-2.5">
              <div>ลงชื่อ ............................................................</div>
              <div>( ............................................................ )</div>
              <div className="font-bold text-slate-900">หัวหน้าแผนก / ผู้ตรวจสอบ (Supervisor)</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
