'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { api } from '@/lib/api';
import {
  LayoutDashboard,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Truck,
  Package,
  Factory,
  Users,
  ShieldCheck,
  Calendar,
  Layers,
  ArrowUpRight,
  Download,
  RefreshCw,
  Search,
  Filter,
  BarChart3,
  PieChart,
  Award,
  Sparkles,
} from 'lucide-react';

interface DashboardData {
  summary: {
    total_open_pos: number;
    total_open_items: number;
    total_open_qty: number;
    otif_rate: number;
    critical_overdue_count: number;
    next_7d_items: number;
    next_7d_qty: number;
    total_reschedules: number;
    portal_adoption_rate: number;
    split_delivery_pct: number;
  };
  inbound_forecast: {
    date: string;
    iso_date: string;
    day_name: string;
    total_qty: number;
    item_count: number;
    groups: Record<string, number>;
  }[];
  item_groups: {
    group: string;
    open_items: number;
    open_qty: number;
    percentage: number;
  }[];
  supplier_scorecard: {
    supplier_code: string;
    supplier_name: string;
    total_items: number;
    open_items: number;
    completed_items: number;
    open_qty: number;
    otif_rate: number;
    reschedules: number;
    portal_adoption_rate: number;
    grade: string;
    sla_status: string;
  }[];
  buyer_workload: {
    buyer_name: string;
    total_items: number;
    pending_items: number;
    completed_items: number;
    open_qty: number;
    completion_rate: number;
  }[];
  digital_adoption: {
    portal_self_service_pct: number;
    buyer_manual_override_pct: number;
    total_audit_events: number;
  };
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [supplierSearch, setSupplierSearch] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [selectedGrade, setSelectedGrade] = useState<string>('all');
  const [hoveredDay, setHoveredDay] = useState<any | null>(null);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const res = await api.get<DashboardData>('/api/dashboard/analytics');
      setData(res.data);
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Filtered Suppliers
  const filteredSuppliers = useMemo(() => {
    if (!data) return [];
    return data.supplier_scorecard.filter((s) => {
      const matchSearch =
        s.supplier_name.toLowerCase().includes(supplierSearch.toLowerCase()) ||
        s.supplier_code.toLowerCase().includes(supplierSearch.toLowerCase());
      const matchGrade = selectedGrade === 'all' || s.grade === selectedGrade;
      return matchSearch && matchGrade;
    });
  }, [data, supplierSearch, selectedGrade]);

  // Max forecast quantity for relative bar height calculation
  const maxForecastQty = useMemo(() => {
    if (!data || !data.inbound_forecast) return 1;
    return Math.max(...data.inbound_forecast.map((f) => f.total_qty), 1);
  }, [data]);

  // Export CSV Handler
  const handleExportCSV = () => {
    if (!data) return;
    const headers = ['Supplier Code', 'Supplier Name', 'Grade', 'SLA Status', 'OTIF Rate (%)', 'Open Items', 'Open Qty', 'Reschedules', 'Portal Adoption (%)'];
    const rows = data.supplier_scorecard.map((s) => [
      `"${s.supplier_code}"`,
      `"${s.supplier_name}"`,
      `"${s.grade}"`,
      `"${s.sla_status}"`,
      s.otif_rate,
      s.open_items,
      s.open_qty,
      s.reschedules,
      s.portal_adoption_rate,
    ]);
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;

    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    link.download = `IRM_Supplier_Scorecard_${yyyy}${mm}${dd}_${hh}${min}${ss}.csv`;

    link.click();
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-sky-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm font-medium text-slate-500">กำลังประมวลผลข้อมูลสถิติ IRM Analytics...</span>
        </div>
      </div>
    );
  }

  const sum = data?.summary;

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12">
      {/* 1. Header & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-sky-50 text-sky-600 rounded-xl border border-sky-100 shadow-2xs">
              <LayoutDashboard className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
                Procurement & Operations Analytics Dashboard
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                ศูนย์รวมดัชนีชี้วัดประสิทธิภาพ (KPIs), พยากรณ์สินค้าเข้าคลัง, การประเมินเกรด Supplier และการติดตามงานจัดซื้อ
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={fetchDashboardData}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition border border-slate-200"
            title="รีเฟรชข้อมูลล่าสุด"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>รีเฟรช</span>
          </button>
          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-sm hover:shadow"
          >
            <Download className="w-3.5 h-3.5" />
            <span>ส่งออกสรุปรายงาน (CSV)</span>
          </button>
        </div>
      </div>

      {/* 2. Top 4 Executive KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Open Backlog */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">ยอดค้างส่งสะสม</span>
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100 shrink-0">
                <Package className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-slate-900 tracking-tight">{sum?.total_open_items.toLocaleString()}</span>
              <span className="text-xs text-slate-500 font-medium">รายการ</span>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between text-[11px] text-slate-600 pt-2.5 border-t border-slate-100">
            <span>รวม <strong>{sum?.total_open_pos}</strong> PO</span>
            <span className="font-bold text-indigo-700">{sum?.total_open_qty.toLocaleString()} หน่วย</span>
          </div>
        </div>

        {/* KPI 2: OTIF Rate */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">ส่งตรงเวลา (OTIF Rate)</span>
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100 shrink-0">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline justify-between gap-2">
              <span className="text-2xl font-black text-emerald-600 tracking-tight">
                {sum?.otif_rate !== undefined ? `${sum.otif_rate}%` : '0%'}
              </span>
              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                Target ≥ 95%
              </span>
            </div>
            <div className="mt-2.5 w-full bg-slate-100 rounded-full h-2 overflow-hidden">
              <div
                className="bg-emerald-500 h-2 rounded-full transition-all duration-1000"
                style={{ width: `${Math.min(sum?.otif_rate || 0, 100)}%` }}
              ></div>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500 pt-2.5 border-t border-slate-100">
            <span>SLA Commitment</span>
            <span className="font-bold text-slate-700">
              {(sum?.otif_rate || 0) === 0 ? 'รอข้อมูลส่งมอบ' : (sum?.otif_rate || 0) >= 95 ? 'เกรดเฉลี่ย A' : (sum?.otif_rate || 0) >= 85 ? 'เกรดเฉลี่ย B+' : 'เกรดเฉลี่ย C'}
            </span>
          </div>
        </div>

        {/* KPI 3: Inbound Next 7 Days */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">พยากรณ์เข้า 7 วันนี้</span>
              <div className="p-2 bg-sky-50 text-sky-600 rounded-xl border border-sky-100 shrink-0">
                <Truck className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-sky-600 tracking-tight">{sum?.next_7d_items.toLocaleString()}</span>
              <span className="text-xs text-slate-500 font-medium">รายการที่จะเข้า</span>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between text-[11px] text-slate-600 pt-2.5 border-t border-slate-100">
            <span>ปริมาณสัปดาห์นี้</span>
            <span className="font-bold text-sky-700">{sum?.next_7d_qty.toLocaleString()} หน่วย</span>
          </div>
        </div>

        {/* KPI 4: Critical Overdue */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">เกินกำหนดส่ง (Overdue)</span>
              <div className="p-2 bg-rose-50 text-rose-600 rounded-xl border border-rose-100 shrink-0">
                <AlertTriangle className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className={`text-2xl font-black ${(sum?.critical_overdue_count || 0) > 0 ? 'text-rose-600' : 'text-slate-700'} tracking-tight`}>
                {sum?.critical_overdue_count.toLocaleString()}
              </span>
              <span className="text-xs text-slate-500 font-medium">รายการเลย Due Date</span>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between text-[11px] pt-2.5 border-t border-slate-100">
            <span className="text-slate-500">เสี่ยงกระทบสายผลิต</span>
            <span className="font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">เร่งติดตามด่วน</span>
          </div>
        </div>
      </div>

      {/* 3. Row 2: Inbound Forecast (65%) & Group Distribution (35%) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* 14-Day Inbound Forecast Chart */}
        <div className="lg:col-span-8 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between gap-4">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-sky-50 text-sky-600 rounded-xl border border-sky-100">
                  <BarChart3 className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-extrabold text-slate-900">
                    แผนพยากรณ์ปริมาณวัตถุดิบเข้าคลัง 14 วันล่วงหน้า (Inbound Forecast)
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    คำนวณจากวันที่ Est. Date ที่ Supplier และจัดซื้อยืนยันรอบส่งมอบจริง
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                14 วันถัดไป
              </span>
            </div>

            {/* Visual Column Bars with Expanded Height (h-56) */}
            <div className="flex items-end gap-1.5 h-56 pt-4 pb-2 px-1 border-b border-slate-100 overflow-x-auto relative">
              {data?.inbound_forecast.map((f, idx) => {
                const heightPct = f.total_qty > 0 ? Math.max((f.total_qty / maxForecastQty) * 100, 10) : 4;
                const isToday = idx === 0;
                const isWeekend = f.day_name === 'Sat' || f.day_name === 'Sun';
                const isHovered = hoveredDay?.iso_date === f.iso_date;

                return (
                  <div
                    key={f.iso_date}
                    onMouseEnter={() => setHoveredDay(f)}
                    className="flex-1 min-w-[34px] flex flex-col items-center h-full justify-end group cursor-pointer transition"
                  >
                    {/* Quantity Label on Top of Bar */}
                    {f.total_qty > 0 && (
                      <span className={`text-[10px] font-extrabold mb-1 truncate max-w-full ${isHovered ? 'text-sky-700 scale-105' : 'text-slate-600'}`}>
                        {(f.total_qty / 1000).toFixed(1)}k
                      </span>
                    )}

                    {/* Bar Column */}
                    <div
                      style={{ height: `${heightPct}%` }}
                      className={`w-full rounded-t-md transition-all duration-300 ${
                        isToday
                          ? 'bg-indigo-600 group-hover:bg-indigo-700 shadow-sm'
                          : f.total_qty > 0
                          ? isHovered
                            ? 'bg-sky-600 ring-2 ring-sky-300'
                            : 'bg-sky-500 group-hover:bg-sky-600'
                          : isWeekend
                          ? 'bg-slate-100'
                          : 'bg-slate-100 hover:bg-slate-200'
                      }`}
                    ></div>

                    {/* Date & Day Label */}
                    <div className="mt-2 text-center select-none">
                      <span className={`text-[10px] block ${isToday ? 'font-black text-indigo-700' : isHovered ? 'font-bold text-sky-700' : 'text-slate-600 font-medium'}`}>
                        {f.date.slice(0, 5)}
                      </span>
                      <span className={`text-[9px] block ${isWeekend ? 'text-rose-500 font-bold' : 'text-slate-400 font-medium'}`}>
                        {f.day_name}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Interactive Inbound Day Inspector Box (Fills bottom area cleanly) */}
          <div className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-200/80 text-xs">
            {hoveredDay ? (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-sky-500 animate-pulse"></span>
                  <span className="font-bold text-slate-800">
                    วันที่ {hoveredDay.date} ({hoveredDay.day_name}):
                  </span>
                  <span className="text-slate-600">
                    ยอดเข้า <strong>{hoveredDay.total_qty.toLocaleString()}</strong> หน่วย ({hoveredDay.item_count} รายการ)
                  </span>
                </div>
                {Object.keys(hoveredDay.groups).length > 0 ? (
                  <div className="flex items-center gap-2 flex-wrap">
                    {Object.entries(hoveredDay.groups).map(([grp, qty]) => (
                      <span key={grp} className="px-2 py-0.5 bg-white rounded-md text-[11px] font-medium text-slate-700 border border-slate-200 shadow-2xs">
                        <strong>{grp}:</strong> {(qty as number).toLocaleString()}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-slate-400 text-[11px]">ไม่มีแผนส่งมอบในวันนี้</span>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-between text-[11px] text-slate-500">
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded bg-indigo-600 inline-block"></span>
                    <span className="font-medium">วันนี้ (Today)</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded bg-sky-500 inline-block"></span>
                    <span className="font-medium">มีแผนส่งมอบ (Scheduled)</span>
                  </span>
                </div>
                <span className="italic text-sky-700 font-medium">💡 นำเมาส์ชี้ที่แท่งกราฟวันใดๆ เพื่อดูรายละเอียดกลุ่มวัตถุดิบ</span>
              </div>
            )}
          </div>
        </div>

        {/* Item Group Distribution */}
        <div className="lg:col-span-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
                <PieChart className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-extrabold text-slate-900">สัดส่วนค้างส่งตามกลุ่มวัตถุดิบ</h2>
                <p className="text-[11px] text-slate-500">Item Group Backlog Breakdown</p>
              </div>
            </div>

            <div className="space-y-3.5">
              {data?.item_groups.map((grp, idx) => {
                const colors = [
                  'bg-sky-500 text-sky-700 bg-sky-50',
                  'bg-indigo-500 text-indigo-700 bg-indigo-50',
                  'bg-emerald-500 text-emerald-700 bg-emerald-50',
                  'bg-amber-500 text-amber-700 bg-amber-50',
                  'bg-purple-500 text-purple-700 bg-purple-50',
                ];
                const color = colors[idx % colors.length];

                return (
                  <div key={grp.group} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-800 flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${color.split(' ')[0]}`}></span>
                        <span>{grp.group}</span>
                      </span>
                      <span className="text-slate-500 text-[11px]">
                        <strong>{grp.open_qty.toLocaleString()}</strong> หน่วย ({grp.percentage}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-2 rounded-full ${color.split(' ')[0]} transition-all duration-700`}
                        style={{ width: `${grp.percentage}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-[11px] text-slate-600 mt-4">
            <span className="font-bold text-slate-800">กลุ่มหลักที่มีโหลดสูงสุด:</span>{' '}
            {data?.item_groups[0]?.group || 'RM-กระจก'} ({data?.item_groups[0]?.percentage || 0}%)
          </div>
        </div>
      </div>

      {/* 4. Row 3: Supplier Reliability & SLA Scorecard */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-amber-50 text-amber-600 rounded-lg">
              <Award className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-slate-900">
                ตารางประเมินผลและจัดเกรดความน่าเชื่อถือ Supplier (Supplier SLA Scorecard)
              </h2>
              <p className="text-[11px] text-slate-500">
                วิเคราะห์อัตราส่งตรงเวลา (OTIF), ความถี่ในการขอเลื่อนนัด (Reschedules), และการตอบกลับผ่าน Portal
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Search Input */}
            <div className="relative w-56">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="ค้นหารหัส หรือชื่อ Supplier..."
                value={supplierSearch}
                onChange={(e) => setSupplierSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-sky-500 focus:outline-none"
              />
            </div>

            {/* Grade Filter */}
            <select
              value={selectedGrade}
              onChange={(e) => setSelectedGrade(e.target.value)}
              className="text-xs px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 focus:outline-none"
            >
              <option value="all">ทุกเกรด (All Grades)</option>
              <option value="A">Grade A (ดีเยี่ยม ≥ 95%)</option>
              <option value="B">Grade B (มาตรฐาน ≥ 85%)</option>
              <option value="C">Grade C (เฝ้าระวัง ≥ 75%)</option>
              <option value="D">Grade D (วิกฤต &lt; 75%)</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto text-xs border border-slate-200 rounded-xl max-h-[50vh] overflow-y-auto">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead className="bg-slate-900 text-slate-200 font-bold sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="py-2.5 px-3 w-12 text-center">#</th>
                <th className="py-2.5 px-3 w-28">รหัส Sup</th>
                <th className="py-2.5 px-3 min-w-[200px]">ชื่อ Supplier</th>
                <th className="py-2.5 px-3 text-center w-24">เกรด (Grade)</th>
                <th className="py-2.5 px-3 text-center w-36">สถานะ SLA</th>
                <th className="py-2.5 px-3 text-right w-28">OTIF Rate (%)</th>
                <th className="py-2.5 px-3 text-center w-28">เลื่อนนัด (ครั้ง)</th>
                <th className="py-2.5 px-3 text-right w-28">PO ค้างส่ง</th>
                <th className="py-2.5 px-3 text-right w-32">จำนวนค้างส่ง</th>
                <th className="py-2.5 px-3 text-right w-32">Portal Adoption</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSuppliers.map((s, idx) => {
                let gradeBadge = 'bg-emerald-100 text-emerald-800 border-emerald-300';
                if (s.grade === 'B') gradeBadge = 'bg-blue-100 text-blue-800 border-blue-300';
                if (s.grade === 'C') gradeBadge = 'bg-amber-100 text-amber-800 border-amber-300';
                if (s.grade === 'D') gradeBadge = 'bg-rose-100 text-rose-800 border-rose-300';

                return (
                  <tr key={s.supplier_code} className="hover:bg-slate-50/80 transition">
                    <td className="py-2 px-3 text-center text-slate-400 font-bold">{idx + 1}</td>
                    <td className="py-2 px-3 font-mono font-bold text-slate-800">{s.supplier_code}</td>
                    <td className="py-2 px-3 font-medium text-slate-900 truncate max-w-[240px]" title={s.supplier_name}>
                      {s.supplier_name}
                    </td>
                    <td className="py-2 px-3 text-center">
                      <span className={`px-2.5 py-0.5 rounded-md font-black text-[11px] border ${gradeBadge}`}>
                        {s.grade}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-center text-[11px] font-medium whitespace-nowrap">
                      {s.sla_status}
                    </td>
                    <td className="py-2 px-3 text-right font-bold whitespace-nowrap">
                      <span className={s.otif_rate >= 90 ? 'text-emerald-700' : s.otif_rate >= 80 ? 'text-blue-700' : 'text-amber-700'}>
                        {s.otif_rate}%
                      </span>
                    </td>
                    <td className="py-2 px-3 text-center">
                      {s.reschedules > 0 ? (
                        <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 font-bold text-[10px] border border-amber-200">
                          {s.reschedules} ครั้ง
                        </span>
                      ) : (
                        <span className="text-slate-300 text-[10px]">0</span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-right font-semibold text-slate-800">{s.open_items}</td>
                    <td className="py-2 px-3 text-right font-bold text-slate-900">{s.open_qty.toLocaleString()}</td>
                    <td className="py-2 px-3 text-right font-medium text-slate-600">
                      <div className="flex items-center justify-end gap-1.5">
                        <span>{s.portal_adoption_rate}%</span>
                        <div className="w-12 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                          <div className="bg-sky-500 h-1.5 rounded-full" style={{ width: `${s.portal_adoption_rate}%` }}></div>
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. Row 4: Buyer Workload (60%) & Digital Adoption (40%) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Buyer Workload */}
        <div className="lg:col-span-7 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-slate-900">
                การกระจายงานและประสิทธิภาพเจ้าหน้าที่จัดซื้อ (Buyer Workload Matrix)
              </h2>
              <p className="text-[11px] text-slate-500">จำนวน PO และอัตราการติดตามยืนยันวันส่งมอบของ Buyer แต่ละท่าน</p>
            </div>
          </div>

          <div className="space-y-3">
            {data?.buyer_workload.map((b) => (
              <div key={b.buyer_name} className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    <span>{b.buyer_name}</span>
                    <span className="text-[10px] text-slate-400 font-normal">({b.total_items} รายการทั้งหมด)</span>
                  </div>
                  <div className="text-[11px] text-slate-600 font-medium">
                    ค้างติดตาม <strong>{b.pending_items}</strong> รายการ | ปิดยอดแล้ว <strong>{b.completed_items}</strong>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-slate-200 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-emerald-500 h-2 rounded-full transition-all duration-700"
                      style={{ width: `${b.completion_rate}%` }}
                    ></div>
                  </div>
                  <span className="text-[11px] font-bold text-emerald-700 w-10 text-right">{b.completion_rate}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Digital Adoption & Process Governance */}
        <div className="lg:col-span-5 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-extrabold text-slate-900">
                  การเปลี่ยนผ่านสู่ดิจิทัลและกระบวนการ (Digital Adoption)
                </h2>
                <p className="text-[11px] text-slate-500">อัตราการกรอกผ่าน Supplier Portal vs โทรตามเอง</p>
              </div>
            </div>

            <div className="space-y-4">
              {/* Portal vs Override Bar */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-600">Portal Self-Service (Supplier กรอกเอง)</span>
                  <span className="font-bold text-sky-700">{data?.digital_adoption.portal_self_service_pct}%</span>
                </div>
                <div className="w-full bg-amber-100 rounded-full h-3 flex overflow-hidden">
                  <div
                    className="bg-sky-500 h-3 transition-all duration-700"
                    style={{ width: `${data?.digital_adoption.portal_self_service_pct}%` }}
                    title={`Supplier กรอกเอง: ${data?.digital_adoption.portal_self_service_pct}%`}
                  ></div>
                  <div
                    className="bg-amber-400 h-3 transition-all duration-700"
                    style={{ width: `${data?.digital_adoption.buyer_manual_override_pct}%` }}
                    title={`จัดซื้อโทรคีย์เอง: ${data?.digital_adoption.buyer_manual_override_pct}%`}
                  ></div>
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-500 pt-0.5">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-sky-500"></span>
                    <span>Self-Service ({data?.digital_adoption.portal_self_service_pct}%)</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                    <span>Manual Override ({data?.digital_adoption.buyer_manual_override_pct}%)</span>
                  </span>
                </div>
              </div>

              {/* Split Delivery Overhead */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700">สัดส่วนการแตกส่งย่อย (Split Rounds)</span>
                  <span className="font-bold text-slate-900">{sum?.split_delivery_pct}%</span>
                </div>
                <p className="text-[10px] text-slate-500">
                  รายการที่มีการซอยส่งหลายงวด ยิ่งน้อยยิ่งช่วยลดต้นทุนค่าตรวจรับและงานเอกสารคลังสินค้า
                </p>
              </div>

              {/* Audit Trail Activity Total */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-600">ประวัติการเปลี่ยนแปลงทั้งหมด (Audit Trail Events)</span>
                <span className="font-bold text-indigo-700">
                  {data?.digital_adoption.total_audit_events.toLocaleString()} เหตุการณ์
                </span>
              </div>
            </div>
          </div>

          <div className="text-[10px] text-slate-400 text-right pt-2 border-t border-slate-100">
            ระบบอัปเดตข้อมูลอัตโนมัติแบบ Real-Time จาก SAP B1 & IRM Operations
          </div>
        </div>
      </div>
    </div>
  );
}
