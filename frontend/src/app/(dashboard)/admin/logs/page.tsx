'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { TransactionLogItem, LogSummaryStats } from '@/types';
import {
  Activity,
  Calendar,
  RefreshCw,
  Search,
  Download,
  Send,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Info,
  Clock,
  Database,
  Mail,
  FileJson,
  Users,
  MessageSquare,
  Settings,
  Copy,
  Check,
  Key,
  X,
  Eye,
} from 'lucide-react';

export default function TransactionLogsPage() {
  const [logs, setLogs] = useState<TransactionLogItem[]>([]);
  const [stats, setStats] = useState<LogSummaryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [total, setTotal] = useState(0);

  // Filters
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const pageSize = 50;

  // Modals & Actions
  const [selectedLog, setSelectedLog] = useState<TransactionLogItem | null>(null);
  const [copiedJson, setCopiedJson] = useState(false);
  const [triggeringQms, setTriggeringQms] = useState(false);
  const [qmsResultModal, setQmsResultModal] = useState<any | null>(null);

  const fetchLogs = useCallback(async () => {
    try {
      const params: any = {
        page,
        page_size: pageSize,
      };
      if (activeCategory !== 'all') params.category = activeCategory;
      if (statusFilter !== 'all') params.status = statusFilter;
      if (searchTerm.trim()) params.search = searchTerm.trim();
      const apiDateFrom = parseToApiDate(dateFrom);
      const apiDateTo = parseToApiDate(dateTo);
      if (apiDateFrom) params.date_from = apiDateFrom;
      if (apiDateTo) params.date_to = apiDateTo;

      const [logsRes, statsRes] = await Promise.all([
        api.get<{ items: TransactionLogItem[]; total: number }>('/api/logs', { params }),
        api.get<LogSummaryStats>('/api/logs/summary'),
      ]);

      setLogs(logsRes.data.items);
      setTotal(logsRes.data.total);
      setStats(statsRes.data);
    } catch (err) {
      console.error('Failed to load transaction logs:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [page, activeCategory, statusFilter, searchTerm, dateFrom, dateTo]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchLogs();
  };

  const handleTriggerQms = async () => {
    setTriggeringQms(true);
    try {
      const res = await api.post('/api/logs/trigger-qms-export');
      setQmsResultModal(res.data);
      fetchLogs();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'เกิดข้อผิดพลาดในการส่งข้อมูลไป QMS');
    } finally {
      setTriggeringQms(false);
    }
  };

  // Date Mask & Parsing Helpers (System Constraint: dd/mm/yyyy with Calendar Picker)
  const handleDateMask = (val: string): string => {
    let clean = val.replace(/[^0-9]/g, '');
    if (clean.length > 8) clean = clean.substring(0, 8);
    if (clean.length > 4) {
      return `${clean.substring(0, 2)}/${clean.substring(2, 4)}/${clean.substring(4)}`;
    } else if (clean.length > 2) {
      return `${clean.substring(0, 2)}/${clean.substring(2)}`;
    }
    return clean;
  };

  const parseToApiDate = (ddmmyyyy: string): string | null => {
    if (!ddmmyyyy) return null;
    const parts = ddmmyyyy.split('/');
    if (parts.length !== 3) return null;
    const [d, m, y] = parts;
    if (d.length === 2 && m.length === 2 && y.length === 4) {
      return `${y}-${m}-${d}`;
    }
    return null;
  };

  const formatDateThai = (isoStr: string) => {
    if (!isoStr) return '-';
    const d = new Date(isoStr);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
  };

  const getCategoryBadge = (category: string) => {
    switch (category) {
      case 'sap_sync':
        return (
          <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 inline-flex items-center gap-1">
            <Database className="w-3 h-3 text-indigo-600 shrink-0" />
            <span>SAP Sync</span>
          </span>
        );
      case 'supplier_email':
        return (
          <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-sky-50 text-sky-700 border border-sky-200 inline-flex items-center gap-1">
            <Mail className="w-3 h-3 text-sky-600 shrink-0" />
            <span>Supplier Email</span>
          </span>
        );
      case 'qms_export':
        return (
          <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-teal-50 text-teal-700 border border-teal-200 inline-flex items-center gap-1">
            <FileJson className="w-3 h-3 text-teal-600 shrink-0" />
            <span>QMS Export</span>
          </span>
        );
      case 'supplier_portal':
        return (
          <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200 inline-flex items-center gap-1">
            <Users className="w-3 h-3 text-amber-600 shrink-0" />
            <span>Supplier Portal</span>
          </span>
        );
      case 'telegram_alert':
        return (
          <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200 inline-flex items-center gap-1">
            <MessageSquare className="w-3 h-3 text-blue-600 shrink-0" />
            <span>Telegram</span>
          </span>
        );
      case 'system_audit':
        return (
          <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200 inline-flex items-center gap-1">
            <Settings className="w-3 h-3 text-slate-600 shrink-0" />
            <span>System</span>
          </span>
        );
      case 'user_auth':
        return (
          <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-violet-50 text-violet-700 border border-violet-200 inline-flex items-center gap-1">
            <Key className="w-3 h-3 text-violet-600 shrink-0" />
            <span>User Logon</span>
          </span>
        );
      case 'central_management':
        return (
          <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center gap-1">
            <Users className="w-3 h-3 text-emerald-600 shrink-0" />
            <span>Central IAM</span>
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
            {category}
          </span>
        );
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            <span>Success</span>
          </span>
        );
      case 'failed':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 inline-flex items-center gap-1">
            <AlertCircle className="w-3 h-3 text-rose-600" />
            <span>Failed</span>
          </span>
        );
      case 'warning':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 inline-flex items-center gap-1">
            <AlertTriangle className="w-3 h-3 text-amber-600" />
            <span>Warning</span>
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200 inline-flex items-center gap-1">
            <Info className="w-3 h-3 text-slate-500" />
            <span>{status}</span>
          </span>
        );
    }
  };

  const handleExportCSV = () => {
    const BOM = '\uFEFF';
    const headers = ['ID', 'Date Time', 'Category', 'Action', 'Status', 'Message', 'Records', 'Duration(ms)', 'Triggered By'];
    const rows = logs.map((l) => [
      l.id,
      formatDateThai(l.created_at),
      l.category,
      l.action,
      l.status,
      l.message,
      l.records_count,
      l.duration_ms,
      l.triggered_by,
    ]);

    let csvContent = BOM + headers.join(',') + '\n';
    rows.forEach((r) => {
      csvContent += r.map((val) => `"${(val || '').toString().replace(/"/g, '""')}"`).join(',') + '\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);

    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    link.setAttribute('download', `IRM_Transaction_Logs_${yyyy}${mm}${dd}_${hh}${min}${ss}.csv`);

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopyDetails = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
  };

  const categoryTabs = [
    { id: 'all', label: 'ทั้งหมด', count: stats?.total_logs ?? 0 },
    { id: 'user_auth', label: '🔐 User Logon' },
    { id: 'central_management', label: '🛡️ Central IAM' },
    { id: 'sap_sync', label: '🔄 SAP Sync', count: stats?.sap_sync_count ?? 0 },
    { id: 'supplier_email', label: '📧 ส่ง Email', count: stats?.email_sent_count ?? 0 },
    { id: 'qms_export', label: '📤 ส่ง QMS (JSON)', count: stats?.qms_export_count ?? 0 },
    { id: 'supplier_portal', label: '👥 Supplier Portal', count: stats?.portal_submits_count ?? 0 },
    { id: 'telegram_alert', label: '📢 Telegram' },
    { id: 'system_audit', label: '⚙️ System Audit' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-500">
        <div className="w-6 h-6 border-2 border-sky-500 border-t-transparent rounded-full animate-spin mr-3"></div>
        <span>กำลังโหลด Transaction Logs...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2.5">
            <Activity className="w-7 h-7 text-sky-600" />
            <span>Transaction Logs (บันทึกการทำงานของระบบ)</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            ตรวจสอบประวัติการซิงค์ SAP, การส่ง Email Supplier, การส่ง JSON ให้ QMS และการตอบกลับของ Supplier
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={handleTriggerQms}
            disabled={triggeringQms}
            className="px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-sm flex items-center gap-1.5 transition disabled:opacity-50"
            title="ทดสอบยิงส่ง JSON แพลนส่งสินค้าไปยังระบบ QMS ทันที"
          >
            {triggeringQms ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <FileJson className="w-4 h-4" />
            )}
            <span>{triggeringQms ? 'กำลังส่ง QMS...' : 'ทดสอบส่ง JSON ไป QMS'}</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs border border-slate-200 shadow-sm flex items-center gap-1.5 transition"
            title="Export ข้อมูล Log เป็นไฟล์ CSV"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 rounded-xl bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 shadow-sm transition"
            title="รีเฟรชข้อมูล"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-sky-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <span className="text-[11px] font-bold text-slate-500">Log ทั้งหมด</span>
          <div className="text-lg font-black text-slate-800 mt-1">{(stats?.total_logs ?? 0).toLocaleString()}</div>
        </div>
        <div className="bg-white p-3 rounded-2xl border border-indigo-100 shadow-xs flex flex-col justify-between">
          <span className="text-[11px] font-bold text-indigo-700 flex items-center gap-1">
            <Database className="w-3 h-3" />
            <span>SAP Sync</span>
          </span>
          <div className="text-lg font-black text-indigo-900 mt-1">{(stats?.sap_sync_count ?? 0).toLocaleString()}</div>
        </div>
        <div className="bg-white p-3 rounded-2xl border border-sky-100 shadow-xs flex flex-col justify-between">
          <span className="text-[11px] font-bold text-sky-700 flex items-center gap-1">
            <Mail className="w-3 h-3" />
            <span>Email ส่งแล้ว</span>
          </span>
          <div className="text-lg font-black text-sky-900 mt-1">{(stats?.email_sent_count ?? 0).toLocaleString()}</div>
        </div>
        <div className="bg-white p-3 rounded-2xl border border-teal-100 shadow-xs flex flex-col justify-between">
          <span className="text-[11px] font-bold text-teal-700 flex items-center gap-1">
            <FileJson className="w-3 h-3" />
            <span>ส่ง QMS</span>
          </span>
          <div className="text-lg font-black text-teal-900 mt-1">{(stats?.qms_export_count ?? 0).toLocaleString()}</div>
        </div>
        <div className="bg-white p-3 rounded-2xl border border-amber-100 shadow-xs flex flex-col justify-between">
          <span className="text-[11px] font-bold text-amber-700 flex items-center gap-1">
            <Users className="w-3 h-3" />
            <span>Sup ตอบกลับ</span>
          </span>
          <div className="text-lg font-black text-amber-900 mt-1">{(stats?.portal_submits_count ?? 0).toLocaleString()}</div>
        </div>
        <div className="bg-white p-3 rounded-2xl border border-rose-100 shadow-xs flex flex-col justify-between">
          <span className="text-[11px] font-bold text-rose-700 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            <span>Errors</span>
          </span>
          <div className="text-lg font-black text-rose-900 mt-1">{(stats?.errors_count ?? 0).toLocaleString()}</div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-200 text-xs">
        {categoryTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveCategory(tab.id);
              setPage(1);
            }}
            className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition flex items-center gap-1.5 ${
              activeCategory === tab.id
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeCategory === tab.id ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-600'}`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Search and Filters Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-xs">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="ค้นหาข้อความ, กิจกรรม หรือ ที่มา..."
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-sky-500 focus:bg-white transition"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:border-sky-500"
          >
            <option value="all">สถานะทั้งหมด</option>
            <option value="success">Success (สำเร็จ)</option>
            <option value="failed">Failed (ล้มเหลว)</option>
            <option value="warning">Warning (เตือน)</option>
          </select>

          <div className="flex items-center gap-1.5 text-xs text-slate-600 font-medium">
            <span>จาก</span>
            <div className="relative flex items-center">
              <input
                type="text"
                placeholder="วว/ดด/ปปปป"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(handleDateMask(e.target.value));
                  setPage(1);
                }}
                className="w-28 pl-2 pr-7 py-1 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-sky-500 focus:bg-white"
              />
              <button
                type="button"
                onClick={(e) => {
                  const hiddenDate = e.currentTarget.nextElementSibling as HTMLInputElement;
                  hiddenDate?.showPicker();
                }}
                className="absolute right-1.5 text-slate-400 hover:text-slate-600 focus:outline-none"
                title="เลือกจากปฏิทิน"
              >
                <Calendar className="w-3.5 h-3.5" />
              </button>
              <input
                type="date"
                className="absolute opacity-0 pointer-events-none w-0 h-0"
                onChange={(e) => {
                  const val = e.target.value;
                  if (val) {
                    const [y, m, d] = val.split('-');
                    setDateFrom(`${d}/${m}/${y}`);
                    setPage(1);
                  }
                }}
              />
            </div>

            <span>ถึง</span>
            <div className="relative flex items-center">
              <input
                type="text"
                placeholder="วว/ดด/ปปปป"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(handleDateMask(e.target.value));
                  setPage(1);
                }}
                className="w-28 pl-2 pr-7 py-1 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-sky-500 focus:bg-white"
              />
              <button
                type="button"
                onClick={(e) => {
                  const hiddenDate = e.currentTarget.nextElementSibling as HTMLInputElement;
                  hiddenDate?.showPicker();
                }}
                className="absolute right-1.5 text-slate-400 hover:text-slate-600 focus:outline-none"
                title="เลือกจากปฏิทิน"
              >
                <Calendar className="w-3.5 h-3.5" />
              </button>
              <input
                type="date"
                className="absolute opacity-0 pointer-events-none w-0 h-0"
                onChange={(e) => {
                  const val = e.target.value;
                  if (val) {
                    const [y, m, d] = val.split('-');
                    setDateTo(`${d}/${m}/${y}`);
                    setPage(1);
                  }
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-x-auto text-xs max-h-[70vh] overflow-y-auto">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-900 text-slate-200 font-bold sticky top-0 z-20 shadow-md">
            <tr>
              <th className="py-2.5 px-3 text-center w-12 whitespace-nowrap">#</th>
              <th className="py-2.5 px-3 w-36 whitespace-nowrap">วัน - เวลา</th>
              <th className="py-2.5 px-3 w-28 whitespace-nowrap">หมวดหมู่</th>
              <th className="py-2.5 px-3 w-32 whitespace-nowrap">กิจกรรม</th>
              <th className="py-2.5 px-3 min-w-[240px]">รายละเอียดการทำงาน</th>
              <th className="py-2.5 px-3 text-center w-20 whitespace-nowrap">จำนวน</th>
              <th className="py-2.5 px-3 w-32 whitespace-nowrap">ผู้ทำรายการ / ที่มา</th>
              <th className="py-2.5 px-3 text-center w-24 whitespace-nowrap">สถานะ</th>
              <th className="py-2.5 px-3 text-center w-20 whitespace-nowrap">ดูข้อมูล</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {logs.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-8 text-center text-slate-400 font-medium">
                  ไม่พบรายการ Transaction Log ตามเงื่อนไขที่เลือก
                </td>
              </tr>
            ) : (
              logs.map((item, index) => (
                <tr key={item.id} className="hover:bg-slate-50/80 transition">
                  <td className="py-2 px-3 text-center font-bold text-slate-400">
                    {(page - 1) * pageSize + index + 1}
                  </td>
                  <td className="py-2 px-3 font-semibold text-slate-700 whitespace-nowrap">
                    {formatDateThai(item.created_at)}
                  </td>
                  <td className="py-2 px-3 whitespace-nowrap">
                    {getCategoryBadge(item.category)}
                  </td>
                  <td className="py-2 px-3 font-mono font-bold text-slate-800 text-[11px] whitespace-nowrap">
                    {item.action === 'login_ad' ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                        🏢 login_ad
                      </span>
                    ) : item.action === 'login_local' ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                        🔑 login_local
                      </span>
                    ) : (
                      item.action
                    )}
                  </td>
                  <td className="py-2 px-3 text-slate-700 font-medium">
                    <div className="line-clamp-2" title={item.message}>
                      {item.message}
                    </div>
                  </td>
                  <td className="py-2 px-3 text-center font-bold text-slate-800 whitespace-nowrap">
                    {item.records_count > 0 ? item.records_count.toLocaleString() : '-'}
                  </td>
                  <td className="py-2 px-3 whitespace-nowrap">
                    <span className="font-semibold text-slate-600 text-[11px] px-2 py-0.5 rounded bg-slate-100 border border-slate-200">
                      {item.triggered_by}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-center whitespace-nowrap">
                    {getStatusBadge(item.status)}
                  </td>
                  <td className="py-2 px-3 text-center whitespace-nowrap">
                    <button
                      onClick={() => setSelectedLog(item)}
                      className="p-1 rounded text-slate-400 hover:text-sky-600 hover:bg-sky-50 border border-slate-200 transition"
                      title="ดูรายละเอียด JSON Payload"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* JSON Payload & Details Modal */}
      {selectedLog && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileJson className="w-5 h-5 text-teal-400" />
                <div>
                  <h3 className="font-bold text-sm">รายละเอียด Transaction Log #{selectedLog.id}</h3>
                  <p className="text-[11px] text-slate-300">
                    {selectedLog.action} &bull; {formatDateThai(selectedLog.created_at)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-5 space-y-4 overflow-y-auto flex-1 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block">หมวดหมู่</span>
                  <div className="mt-0.5">{getCategoryBadge(selectedLog.category)}</div>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block">สถานะ</span>
                  <div className="mt-0.5">{getStatusBadge(selectedLog.status)}</div>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block">ผู้ทำรายการ</span>
                  <span className="font-bold text-slate-700">{selectedLog.triggered_by}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block">จำนวนรายการ</span>
                  <span className="font-bold text-slate-700">{selectedLog.records_count} รายการ</span>
                </div>
              </div>

              <div>
                <span className="font-bold text-slate-800 block mb-1">ข้อความสรุป:</span>
                <div className="p-3 bg-slate-100 rounded-xl text-slate-800 font-medium leading-relaxed">
                  {selectedLog.message}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-slate-800">JSON Payload / Details:</span>
                  {selectedLog.details && (
                    <button
                      onClick={() => handleCopyDetails(selectedLog.details!)}
                      className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-[10px] flex items-center gap-1 transition"
                    >
                      {copiedJson ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3 text-slate-500" />
                          <span>คัดลอก JSON</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
                <div className="p-3 bg-slate-950 text-emerald-400 rounded-xl font-mono text-[11px] overflow-x-auto max-h-60 leading-relaxed shadow-inner">
                  {selectedLog.details ? (
                    <pre>{selectedLog.details}</pre>
                  ) : (
                    <span className="text-slate-500 italic">ไม่มีข้อมูล Details เพิ่มเติม</span>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QMS Export Result Modal */}
      {qmsResultModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 shadow-2xl border border-slate-200 text-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-6 h-6 text-teal-600" />
                <h3 className="font-bold text-sm text-slate-800">ส่งข้อมูล JSON ไปยังระบบ QMS สำเร็จ</h3>
              </div>
              <button onClick={() => setQmsResultModal(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-teal-50 border border-teal-200 p-3 rounded-xl space-y-1 text-teal-900">
              <div><strong>Endpoint:</strong> {qmsResultModal.endpoint}</div>
              <div><strong>HTTP Status:</strong> {qmsResultModal.http_code} OK</div>
              <div><strong>จำนวนรายการที่ส่ง:</strong> {qmsResultModal.total_items} รายการ</div>
              <div><strong>เวลาที่ใช้:</strong> {qmsResultModal.duration_ms} ms</div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setQmsResultModal(null)}
                className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-xs transition"
              >
                ตกลง
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
