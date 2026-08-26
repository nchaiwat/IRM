'use client';

import React, { useEffect, useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { api } from '@/lib/api';
import { ItemMaster } from '@/types';
import { Package, Search, Edit, Check, Download, Upload, Filter, FileSpreadsheet } from 'lucide-react';

export default function ItemsPage() {
  const [items, setItems] = useState<ItemMaster[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string>('ALL');
  const [savedIndicator, setSavedIndicator] = useState<Record<string, boolean>>({});

  const fileInputRef = useRef<HTMLInputElement>(null);
  const topScrollRef = useRef<HTMLDivElement>(null);
  const mainTableRef = useRef<HTMLDivElement>(null);
  const [tableScrollWidth, setTableScrollWidth] = useState<number>(1000);

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
      setTableScrollWidth(scrollW > 900 ? scrollW : 1000);
    }
  }, [items, loading]);

  const formatDateThai = (isoStr: string | null | undefined) => {
    if (!isoStr) return '-';
    const d = new Date(isoStr);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const handleInlineSave = async (itemId: number, field: 'lead_time_days' | 'notify_alert_days', value: number) => {
    try {
      await api.put(`/api/items/${itemId}`, {
        [field]: value
      });
      setSavedIndicator(prev => ({ ...prev, [`${itemId}-${field}`]: true }));
      setTimeout(() => {
        setSavedIndicator(prev => ({ ...prev, [`${itemId}-${field}`]: false }));
      }, 1500);
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.detail || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    }
  };

  // XLSX Export
  const handleExportXLSX = () => {
    const excelData = filtered.map((item) => ({
      'Item Code': item.item_code,
      'Group': item.item_group || 'HW',
      'Description': item.description || '',
      'Lead Time (Days)': item.lead_time_days || 60,
      'Notify Alert (Days)': item.notify_alert_days || 3,
      'Accept': item.is_new ? 'รอ Accept' : 'Accept',
    }));

    const worksheet = XLSX.utils.json_to_sheet(excelData);

    // Set Column Widths for clean viewing in Excel
    worksheet['!cols'] = [
      { wch: 22 }, // Item Code
      { wch: 18 }, // Group
      { wch: 45 }, // Description
      { wch: 18 }, // Lead Time (Days)
      { wch: 20 }, // Notify Alert (Days)
      { wch: 16 }, // Accept
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'ItemMaster');

    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');

    XLSX.writeFile(workbook, `IRM_Item_Master_${yyyy}${mm}${dd}_${hh}${min}.xlsx`);
  };

  // XLSX Import
  const handleImportXLSX = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const rows: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

      if (rows.length === 0) {
        alert('ไฟล์ Excel ไม่มีข้อมูล');
        return;
      }

      const bulkPayload: any[] = [];
      for (const row of rows) {
        const keys = Object.keys(row);
        const codeKey = keys.find(k => k.toLowerCase().includes('code') || k.toLowerCase().includes('รหัส'));
        const descKey = keys.find(k => k.toLowerCase().includes('desc') || k.toLowerCase().includes('ชื่อ') || k.toLowerCase().includes('ราย'));
        const groupKey = keys.find(k => k.toLowerCase().includes('group') || k.toLowerCase().includes('กลุ่ม'));
        const ltKey = keys.find(k => k.toLowerCase().includes('lead') || k.toLowerCase().includes('เวลา'));
        const alertKey = keys.find(k => k.toLowerCase().includes('notify') || k.toLowerCase().includes('alert') || k.toLowerCase().includes('เตือน'));
        const acceptKey = keys.find(k => k.toLowerCase().includes('accept') || k.toLowerCase().includes('ยอมรับ') || k.toLowerCase().includes('สถานะ') || k.toLowerCase().includes('status'));

        if (!codeKey || !row[codeKey]) continue;

        const codeVal = String(row[codeKey]).trim();
        if (!codeVal) continue;

        const descVal = descKey && row[descKey] ? String(row[descKey]).trim() : undefined;
        const groupVal = groupKey && row[groupKey] ? String(row[groupKey]).trim() : undefined;

        let ltDays: number | undefined = undefined;
        if (ltKey && row[ltKey] !== '') {
          const parsed = parseInt(String(row[ltKey]), 10);
          if (!isNaN(parsed) && parsed >= 0) ltDays = parsed;
        }

        let naDays: number | undefined = undefined;
        if (alertKey && row[alertKey] !== '') {
          const parsed = parseInt(String(row[alertKey]), 10);
          if (!isNaN(parsed) && parsed >= 0) naDays = parsed;
        }

        // Parse Accept Status
        let acceptVal: boolean | undefined = undefined;
        if (acceptKey && row[acceptKey] !== '') {
          const rawAccept = String(row[acceptKey]).trim().toLowerCase();
          if (rawAccept === 'accept' || rawAccept === 'ยอมรับ' || rawAccept === 'ยอมรับแล้ว' || rawAccept === 'true' || rawAccept === '1' || rawAccept === 'yes' || rawAccept === 'y' || rawAccept === 'ยืนยัน') {
            acceptVal = true;
          } else if (rawAccept.includes('รอ') || rawAccept === 'false' || rawAccept === '0' || rawAccept === 'no' || rawAccept === 'n') {
            acceptVal = false;
          }
        }

        bulkPayload.push({
          item_code: codeVal,
          description: descVal,
          item_group: groupVal,
          lead_time_days: ltDays,
          notify_alert_days: naDays,
          accept: acceptVal,
        });
      }

      if (bulkPayload.length === 0) {
        alert('ไม่พบข้อมูล Item Master ที่ถูกต้องในไฟล์ Excel (ต้องมีคอลัมน์ Item Code)');
        return;
      }

      const res = await api.put<{ message: string; updated_count: number }>('/api/items/bulk-update', {
        items: bulkPayload,
      });
      alert(res.data.message || `นำเข้าและอัปเดตข้อมูลสำเร็จ ${res.data.updated_count} รายการ`);
      fetchItems();
    } catch (err: any) {
      console.error('Import Error:', err);
      let errMsg = 'เกิดข้อผิดพลาดในการนำเข้าไฟล์ Excel';
      if (err.response?.data?.detail) {
        if (typeof err.response.data.detail === 'string') {
          errMsg = err.response.data.detail;
        } else if (Array.isArray(err.response.data.detail)) {
          errMsg = err.response.data.detail.map((d: any) => `${d.loc ? d.loc.join('.') + ': ' : ''}${d.msg || JSON.stringify(d)}`).join('\n');
        } else {
          errMsg = JSON.stringify(err.response.data.detail);
        }
      } else if (err.message) {
        errMsg = err.message;
      }
      alert(errMsg);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const fetchItems = async () => {
    try {
      const res = await api.get<ItemMaster[]>('/api/items');
      setItems(res.data);
    } catch (err) {
      console.error('Failed to fetch items:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const [editingItem, setEditingItem] = useState<ItemMaster | null>(null);
  const [editLeadTime, setEditLeadTime] = useState<number>(60);
  const [editNotifyAlert, setEditNotifyAlert] = useState<number>(3);
  const [editGroup, setEditGroup] = useState<string>('HW');

  const handleEditClick = (item: ItemMaster) => {
    setEditingItem(item);
    setEditLeadTime(item.lead_time_days || 60);
    setEditNotifyAlert(item.notify_alert_days || 3);
    setEditGroup(item.item_group || 'HW');
  };

  const handleSaveModal = async () => {
    if (!editingItem) return;
    try {
      await api.put(`/api/items/${editingItem.id}`, {
        lead_time_days: editLeadTime,
        notify_alert_days: editNotifyAlert,
        item_group: editGroup,
      });
      setEditingItem(null);
      fetchItems();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    }
  };

  const handleAcceptItem = async (itemId: number) => {
    try {
      await api.post(`/api/items/${itemId}/accept`);
      fetchItems();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'เกิดข้อผิดพลาดในการยืนยัน Accept Item Master');
    }
  };

  // Group Badge Component with distinct colors
  const getGroupBadge = (grp?: string | null) => {
    const g = (grp || 'HW').trim();
    if (g === 'RM-กระจก') {
      return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">RM-กระจก</span>;
    }
    if (g === 'RM-ALU/UPVC (เต็ม)') {
      return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-300">RM-ALU/UPVC</span>;
    }
    if (g === 'HW') {
      return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-800 border border-sky-300">HW</span>;
    }
    if (g === 'RM-เหล็กดัด') {
      return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">RM-เหล็กดัด</span>;
    }
    if (g === 'FG-Non BOI') {
      return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">FG-Non BOI</span>;
    }
    if (g === 'SP - Sparepart') {
      return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-300">SP-Sparepart</span>;
    }
    if (g === 'HW-Partner') {
      return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-100 text-teal-800 border border-teal-300">HW-Partner</span>;
    }
    return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-800 border border-slate-300">{g}</span>;
  };

  // Group list count calculation
  const groupCounts: Record<string, number> = {};
  items.forEach((it) => {
    const grp = it.item_group || 'HW';
    groupCounts[grp] = (groupCounts[grp] || 0) + 1;
  });

  const availableGroups = [
    { key: 'ALL', label: 'ทั้งหมด', count: items.length },
    { key: 'HW', label: 'HW (ฮาร์ดแวร์)', count: groupCounts['HW'] || 0 },
    { key: 'RM-ALU/UPVC (เต็ม)', label: 'RM-ALU/UPVC', count: groupCounts['RM-ALU/UPVC (เต็ม)'] || 0 },
    { key: 'FG-Non BOI', label: 'FG-Non BOI', count: groupCounts['FG-Non BOI'] || 0 },
    { key: 'RM-กระจก', label: 'RM-กระจก', count: groupCounts['RM-กระจก'] || 0 },
    { key: 'SP - Sparepart', label: 'SP-Sparepart', count: groupCounts['SP - Sparepart'] || 0 },
    { key: 'RM-เหล็กดัด', label: 'RM-เหล็กดัด', count: groupCounts['RM-เหล็กดัด'] || 0 },
    { key: 'HW-Partner', label: 'HW-Partner', count: groupCounts['HW-Partner'] || 0 },
  ];

  const filtered = items.filter((i) => {
    const matchSearch =
      i.item_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      i.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (i.item_group && i.item_group.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchGroup = selectedGroup === 'ALL' || i.item_group === selectedGroup;

    return matchSearch && matchGroup;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-500">
        <div className="w-6 h-6 border-2 border-sky-500 border-t-transparent rounded-full animate-spin mr-3"></div>
        <span>กำลังโหลด Item Master...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Title & Action Buttons */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2.5">
            <Package className="w-7 h-7 text-sky-600" />
            <span>Item Master (ทะเบียนรหัสสินค้า)</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            จัดการรหัสสินค้า ทั้ง 7 กลุ่มวัตถุดิบ, Lead Time และวันแจ้งเตือนล่วงหน้า
          </p>
        </div>

        {/* Export & Import Buttons */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={handleExportXLSX}
            className="px-3.5 py-2 rounded-xl bg-white hover:bg-emerald-50 text-emerald-800 font-bold text-xs border border-emerald-300 shadow-sm flex items-center gap-1.5 transition cursor-pointer"
            title="Export ข้อมูลเป็นไฟล์ Excel (XLSX)"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Export XLSX</span>
          </button>

          <label className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm flex items-center gap-1.5 cursor-pointer transition">
            <Upload className="w-4 h-4" />
            <span>Import XLSX</span>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleImportXLSX}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* Filter Tabs by Group & Search */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        {/* Quick Filter Group Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          <span className="text-slate-400 font-semibold text-[11px] flex items-center gap-1 shrink-0 mr-1">
            <Filter className="w-3.5 h-3.5" />
            กลุ่มสินค้า:
          </span>
          {availableGroups.map((grp) => (
            <button
              key={grp.key}
              onClick={() => setSelectedGroup(grp.key)}
              className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 shrink-0 shadow-2xs ${
                selectedGroup === grp.key
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <span>{grp.label}</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                selectedGroup === grp.key ? 'bg-sky-500 text-white' : 'bg-slate-200 text-slate-700'
              }`}>
                {grp.count}
              </span>
            </button>
          ))}
        </div>

        {/* Search Bar */}
        <div className="flex items-center justify-between gap-4 pt-1">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="ค้นหารหัสสินค้า, กลุ่มสินค้า หรือชื่อสินค้า..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-sky-500 focus:bg-white transition"
            />
          </div>

          <div className="text-xs text-slate-500 font-medium">
            แสดง <span className="font-bold text-slate-800">{filtered.length}</span> จากทั้งหมด {items.length} รายการ
          </div>
        </div>
      </div>

      {/* Compact Item Master Data Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm text-xs max-h-[72vh] overflow-y-auto">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-900 text-slate-200 font-bold sticky top-0 z-20 shadow-md">
            <tr>
              <th className="py-2.5 px-2 text-center w-10 whitespace-nowrap">#</th>
              <th className="py-2.5 px-2.5 w-40 whitespace-nowrap">Item Code</th>
              <th className="py-2.5 px-2 text-center w-32 whitespace-nowrap">Group</th>
              <th className="py-2.5 px-3">Description</th>
              <th className="py-2.5 px-2 text-center w-24 whitespace-nowrap">Add Date</th>
              <th className="py-2.5 px-2 text-center w-24 whitespace-nowrap">Lead Time (Days)</th>
              <th className="py-2.5 px-2 text-center w-24 whitespace-nowrap">Notify Alert (Days)</th>
              <th className="py-2.5 px-2 text-center w-20 whitespace-nowrap">Status</th>
              <th className="py-2.5 px-2.5 text-right w-24 whitespace-nowrap">การจัดการ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((item, index) => (
              <tr key={item.id} className="hover:bg-slate-50/80 transition">
                {/* Running No. */}
                <td className="py-2 px-2 text-center font-bold text-slate-400">{index + 1}</td>
                <td className="py-2 px-2.5 font-bold text-slate-900 whitespace-nowrap">
                  <div className="flex items-center gap-1.5">
                    <span>{item.item_code}</span>
                    {item.is_new && (
                      <span className="px-1.5 py-0.2 rounded-full text-[9px] font-extrabold bg-amber-500 text-white shadow-2xs">
                        NEW
                      </span>
                    )}
                  </div>
                </td>

                {/* Dynamic Group Badge */}
                <td className="py-2 px-2 text-center whitespace-nowrap">
                  {getGroupBadge(item.item_group)}
                </td>

                <td className="py-2 px-3 text-slate-700 font-medium">{item.description}</td>
                <td className="py-2 px-2 text-center text-slate-500 font-medium whitespace-nowrap">
                  {formatDateThai(item.created_at)}
                </td>

                {/* Lead Time Days (Inline Editable) */}
                <td className="py-2 px-2 text-center whitespace-nowrap">
                  <div className="flex items-center justify-center gap-1">
                    <input
                      type="number"
                      min={0}
                      defaultValue={item.lead_time_days || 60}
                      onBlur={(e) => {
                        const val = parseInt(e.target.value, 10);
                        if (!isNaN(val) && val !== item.lead_time_days) {
                          handleInlineSave(item.id, 'lead_time_days', val);
                        }
                      }}
                      className="w-14 px-1 py-0.5 bg-slate-50 border border-slate-200 rounded-lg text-center font-bold text-slate-800 outline-none focus:border-sky-500 focus:bg-white transition"
                    />
                    {savedIndicator[`${item.id}-lead_time_days`] && (
                      <Check className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
                    )}
                  </div>
                </td>

                {/* Notify Alert Days (Inline Editable) */}
                <td className="py-2 px-2 text-center whitespace-nowrap">
                  <div className="flex items-center justify-center gap-1">
                    <input
                      type="number"
                      min={0}
                      defaultValue={item.notify_alert_days || 3}
                      onBlur={(e) => {
                        const val = parseInt(e.target.value, 10);
                        if (!isNaN(val) && val !== item.notify_alert_days) {
                          handleInlineSave(item.id, 'notify_alert_days', val);
                        }
                      }}
                      className="w-14 px-1 py-0.5 bg-slate-50 border border-slate-200 rounded-lg text-center font-bold text-slate-800 outline-none focus:border-sky-500 focus:bg-white transition"
                    />
                    {savedIndicator[`${item.id}-notify_alert_days`] && (
                      <Check className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
                    )}
                  </div>
                </td>

                {/* Status */}
                <td className="py-2 px-2 text-center whitespace-nowrap">
                  {item.is_new ? (
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                      รอ Accept
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      พร้อมใช้งาน
                    </span>
                  )}
                </td>

                {/* Actions */}
                <td className="py-2 px-2.5 text-right whitespace-nowrap">
                  <div className="flex items-center justify-end gap-1.5">
                    {item.is_new && (
                      <button
                        onClick={() => handleAcceptItem(item.id)}
                        className="px-2 py-1 rounded bg-amber-500 hover:bg-amber-600 text-white font-bold text-[10px] shadow-2xs flex items-center gap-1 transition"
                        title="รับทราบรหัสสินค้าใหม่"
                      >
                        <Check className="w-3 h-3" />
                        <span>Accept</span>
                      </button>
                    )}

                    <button
                      onClick={() => handleEditClick(item)}
                      className="p-1 rounded text-slate-400 hover:text-sky-600 hover:bg-slate-100 transition"
                      title="แก้ไขข้อมูล Lead Time / วันเตือน / กลุ่มสินค้า"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Edit Modal */}
      {editingItem && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-200">
            <h2 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Edit className="w-4 h-4 text-sky-600" />
              <span>แก้ไข Item: {editingItem.item_code}</span>
            </h2>

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-600 mb-1">กลุ่มสินค้า (Item Group)</label>
                <select
                  value={editGroup}
                  onChange={(e) => setEditGroup(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:border-sky-500 bg-white font-bold"
                >
                  <option value="HW">HW (ฮาร์ดแวร์)</option>
                  <option value="RM-ALU/UPVC (เต็ม)">RM-ALU/UPVC (เต็ม)</option>
                  <option value="FG-Non BOI">FG-Non BOI</option>
                  <option value="RM-กระจก">RM-กระจก</option>
                  <option value="SP - Sparepart">SP - Sparepart</option>
                  <option value="RM-เหล็กดัด">RM-เหล็กดัด</option>
                  <option value="HW-Partner">HW-Partner</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-600 mb-1">Lead Time (วันส่งมอบมาตรฐาน)</label>
                <input
                  type="number"
                  min={0}
                  value={editLeadTime}
                  onChange={(e) => setEditLeadTime(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:border-sky-500 font-bold"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-600 mb-1">วันแจ้งเตือนล่วงหน้า (วัน)</label>
                <input
                  type="number"
                  min={0}
                  value={editNotifyAlert}
                  onChange={(e) => setEditNotifyAlert(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:border-sky-500 font-bold"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  onClick={() => setEditingItem(null)}
                  className="px-3 py-1.5 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold transition"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={handleSaveModal}
                  className="px-4 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold transition shadow-sm"
                >
                  บันทึก
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
