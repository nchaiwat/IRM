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
  CheckSquare,
  Square,
  ArrowRight,
  ExternalLink,
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

  // Interactive on-screen checkboxes (Checked items)
  const [checkedIds, setCheckedIds] = useState<Record<string, boolean>>({});

  // Helper date generators
  const getTodayStr = () => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
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
      return `${y}-${m}-${day}`;
    };

    return { from: format(monday), to: format(sunday) };
  };

  const getMonthRange = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const first = new Date(y, m, 1);
    const last = new Date(y, m + 1, 0);

    const format = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    return { from: format(first), to: format(last) };
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
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
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

  // Toggle on-screen checkbox
  const toggleCheck = (id: string) => {
    setCheckedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleCheckAll = () => {
    if (filteredItems.every((it) => checkedIds[it.id])) {
      // Uncheck all
      setCheckedIds({});
    } else {
      // Check all
      const all: Record<string, boolean> = {};
      filteredItems.forEach((it) => {
        all[it.id] = true;
      });
      setCheckedIds(all);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const formatDisplayDate = (dStr: string) => {
    if (!dStr) return '-';
    try {
      return new Date(dStr).toLocaleDateString('th-TH', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    } catch {
      return dStr;
    }
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

        {/* KPI Stats Cards */}
        {data && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
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

            {/* Checked Progress */}
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between text-slate-500 text-[11px] font-bold">
                <span>ตรวจรับแล้วหน้าจอ</span>
                <CheckSquare className="w-4 h-4 text-sky-600" />
              </div>
              <div className="mt-1.5 text-xl font-black text-sky-700">
                {Object.values(checkedIds).filter(Boolean).length.toLocaleString()}
                <span className="text-xs font-normal text-slate-500 ml-1">/{filteredItems.length}</span>
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                Checked on-screen
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
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setPresetPeriod('custom');
                }}
                className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
              <span className="text-slate-500 font-semibold">ถึง:</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  setPresetPeriod('custom');
                }}
                className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
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
                      กลุ่ม {g}
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
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={toggleCheckAll}
                className="flex items-center gap-2 text-xs font-bold text-slate-700 hover:text-sky-600 transition cursor-pointer"
              >
                {filteredItems.length > 0 && filteredItems.every((it) => checkedIds[it.id]) ? (
                  <CheckSquare className="w-4 h-4 text-sky-600" />
                ) : (
                  <Square className="w-4 h-4 text-slate-400" />
                )}
                <span>เลือกทั้งหมด ({filteredItems.length} รายการ)</span>
              </button>
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
                    <th className="py-3 px-3 text-center w-10">ตรวจ</th>
                    <th className="py-3 px-3 text-center w-12">ลำดับ</th>
                    <th className="py-3 px-3">กำหนดส่ง</th>
                    <th className="py-3 px-3">เลขที่ PO</th>
                    <th className="py-3 px-3">รหัสสินค้า & ชื่อสินค้า</th>
                    <th className="py-3 px-3 text-center">กลุ่มสินค้า</th>
                    <th className="py-3 px-3 text-right">จำนวนนัดส่ง</th>
                    <th className="py-3 px-3">ผู้ขาย (Supplier)</th>
                    <th className="py-3 px-3">ผู้ดูแล</th>
                    <th className="py-3 px-3 text-center">สถานะ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {filteredItems.map((item, idx) => {
                    const isChecked = !!checkedIds[item.id];
                    return (
                      <tr
                        key={item.id}
                        onClick={() => toggleCheck(item.id)}
                        className={`transition cursor-pointer ${
                          isChecked
                            ? 'bg-sky-50/60 hover:bg-sky-50'
                            : idx % 2 === 0
                            ? 'bg-white hover:bg-slate-50'
                            : 'bg-slate-50/40 hover:bg-slate-100/60'
                        }`}
                      >
                        {/* Checkbox */}
                        <td className="py-3 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => toggleCheck(item.id)}
                            className="cursor-pointer text-sky-600 hover:text-sky-700"
                          >
                            {isChecked ? (
                              <CheckSquare className="w-4 h-4 text-sky-600" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-300 hover:text-slate-400" />
                            )}
                          </button>
                        </td>

                        {/* Index */}
                        <td className="py-3 px-3 text-center text-slate-400 font-semibold">{idx + 1}</td>

                        {/* Delivery Date */}
                        <td className="py-3 px-3 font-bold text-slate-900 whitespace-nowrap">
                          {formatDisplayDate(item.delivery_date)}
                        </td>

                        {/* PO Number */}
                        <td className="py-3 px-3 font-bold text-sky-700 whitespace-nowrap">
                          {item.po_number}
                        </td>

                        {/* Item Code & Description */}
                        <td className="py-3 px-3 max-w-[280px]">
                          <div className="font-extrabold text-slate-900 truncate" title={item.item_code}>
                            {item.item_code}
                          </div>
                          <div className="text-[11px] text-slate-500 truncate mt-0.5" title={item.item_name}>
                            {item.item_name}
                          </div>
                        </td>

                        {/* Item Group */}
                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                            {item.item_group || '-'}
                          </span>
                        </td>

                        {/* Quantity */}
                        <td className="py-3 px-3 text-right font-black text-slate-900 whitespace-nowrap">
                          {item.quantity.toLocaleString()}{' '}
                          <span className="font-normal text-slate-500 text-[11px]">{item.unit}</span>
                        </td>

                        {/* Supplier */}
                        <td className="py-3 px-3 max-w-[200px] truncate" title={item.supplier_name}>
                          <span className="font-semibold text-slate-800">{item.supplier_name}</span>
                        </td>

                        {/* Buyer */}
                        <td className="py-3 px-3 whitespace-nowrap text-slate-600 text-[11px]">
                          {item.buyer_name}
                        </td>

                        {/* Status Badge */}
                        <td className="py-3 px-3 text-center whitespace-nowrap">
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
                  })}
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
        <table className="w-full text-left text-[11px] border-collapse border border-slate-400">
          <thead>
            <tr className="bg-slate-100 text-slate-900 font-bold border-b border-slate-400">
              <th className="py-2 px-1.5 text-center border-r border-slate-400 w-8">ลำดับ</th>
              <th className="py-2 px-2 border-r border-slate-400 w-20">กำหนดส่ง</th>
              <th className="py-2 px-2 border-r border-slate-400 w-22">เลขที่ PO</th>
              <th className="py-2 px-2 border-r border-slate-400">รหัสสินค้า / รายละเอียดสินค้า</th>
              <th className="py-2 px-1.5 text-center border-r border-slate-400 w-14">กลุ่ม</th>
              <th className="py-2 px-2 text-right border-r border-slate-400 w-20">จำนวนนัดส่ง</th>
              <th className="py-2 px-2 border-r border-slate-400 w-36">ผู้ขาย (Supplier)</th>
              <th className="py-2 px-2 text-center border-r border-slate-400 w-28">ผลการตรวจรับ</th>
              <th className="py-2 px-2 text-center w-28">หมายเหตุ / เลขที่บิล</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-300">
            {filteredItems.map((item, idx) => (
              <tr key={item.id} className="border-b border-slate-300">
                <td className="py-2 px-1.5 text-center font-semibold border-r border-slate-300">{idx + 1}</td>
                <td className="py-2 px-2 font-bold border-r border-slate-300 whitespace-nowrap">
                  {formatDisplayDate(item.delivery_date)}
                </td>
                <td className="py-2 px-2 font-bold border-r border-slate-300 whitespace-nowrap">{item.po_number}</td>
                <td className="py-2 px-2 border-r border-slate-300">
                  <div className="font-bold">{item.item_code}</div>
                  <div className="text-[10px] text-slate-600 leading-tight">{item.item_name}</div>
                </td>
                <td className="py-2 px-1.5 text-center border-r border-slate-300 font-semibold">
                  {item.item_group || '-'}
                </td>
                <td className="py-2 px-2 text-right font-black border-r border-slate-300 whitespace-nowrap">
                  {item.quantity.toLocaleString()} {item.unit}
                </td>
                <td className="py-2 px-2 border-r border-slate-300 text-[10px] leading-tight">
                  {item.supplier_name}
                </td>
                {/* Physical Checklist Box */}
                <td className="py-2 px-2 border-r border-slate-300 text-[10px]">
                  <div className="flex flex-col gap-1">
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block w-3.5 h-3.5 border border-slate-700 rounded-2xs"></span>
                      <span>ครบถ้วน</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block w-3.5 h-3.5 border border-slate-700 rounded-2xs"></span>
                      <span>ขาด: ........</span>
                    </span>
                  </div>
                </td>
                {/* Notes / Invoice */}
                <td className="py-2 px-2 text-[10px] text-slate-400"></td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Signatures Footer */}
        <div className="mt-8 pt-4 border-t border-slate-400 grid grid-cols-3 gap-8 text-center text-xs">
          <div className="space-y-6">
            <div>ลงชื่อ ............................................................</div>
            <div>( ............................................................ )</div>
            <div className="font-bold text-slate-700">ผู้ส่งมอบสินค้า (Supplier / Driver)</div>
          </div>
          <div className="space-y-6">
            <div>ลงชื่อ ............................................................</div>
            <div>( ............................................................ )</div>
            <div className="font-bold text-slate-700">ผู้ตรวจรับสินค้า (Warehouse Inspector)</div>
          </div>
          <div className="space-y-6">
            <div>ลงชื่อ ............................................................</div>
            <div>( ............................................................ )</div>
            <div className="font-bold text-slate-700">หัวหน้าแผนก / ผู้ตรวจสอบ (Supervisor)</div>
          </div>
        </div>
      </div>
    </div>
  );
}
