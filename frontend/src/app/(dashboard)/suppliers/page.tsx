'use client';

import React, { useEffect, useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { api } from '@/lib/api';
import { SupplierMaster } from '@/types';
import { Factory, Search, Mail, Send, Copy, Edit, Check, AlertCircle, Download, Upload, ShieldCheck, ShieldAlert, FileSpreadsheet } from 'lucide-react';

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<SupplierMaster[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [sendingEmailId, setSendingEmailId] = useState<number | null>(null);

  // Inline Email Editing State
  const [editingEmailId, setEditingEmailId] = useState<number | null>(null);
  const [editingEmailVal, setEditingEmailVal] = useState<string>('');
  const [savedEmailIndicator, setSavedEmailIndicator] = useState<Record<number, boolean>>({});

  // Edit Modal State
  const [showEditModal, setShowEditModal] = useState<SupplierMaster | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    supplier_name: '',
    telephone: '',
    email: '',
    contact_person: '',
    allow_over_delivery: false,
  });

  // File Upload Ref for Import
  const fileInputRef = useRef<HTMLInputElement>(null);
  const topScrollRef = useRef<HTMLDivElement>(null);
  const mainTableRef = useRef<HTMLDivElement>(null);
  const [tableScrollWidth, setTableScrollWidth] = useState<number>(1100);

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
      setTableScrollWidth(scrollW > 900 ? scrollW : 1100);
    }
  }, [suppliers, loading]);

  const formatDateTimeThai = (dateStr: string | null | undefined) => {
    if (!dateStr) return 'ยังไม่เคยส่ง';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'ยังไม่เคยส่ง';
    const date = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `ส่งล่าสุดเมื่อ ${date}/${month}/${year} ${hours}:${minutes}`;
  };

  const isEmailValid = (email?: string | null) => {
    if (!email) return false;
    const e = email.trim();
    if (e === '-' || e === '--' || e.toLowerCase() === 'none' || e.toLowerCase() === 'null' || !e.includes('@')) {
      return false;
    }
    return true;
  };

  const fetchSuppliers = async () => {
    try {
      const res = await api.get<SupplierMaster[]>('/api/suppliers');
      setSuppliers(res.data);
    } catch (err) {
      console.error('Failed to fetch suppliers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const handleToggleOverDelivery = async (sup: SupplierMaster) => {
    const newVal = !sup.allow_over_delivery;
    try {
      await api.put(`/api/suppliers/${sup.id}`, {
        allow_over_delivery: newVal,
      });
      setSuppliers((prev) =>
        prev.map((s) => (s.id === sup.id ? { ...s, allow_over_delivery: newVal } : s))
      );
    } catch (err: any) {
      alert(err.response?.data?.detail || 'เกิดข้อผิดพลาดในการเปลี่ยนสิทธิ์ส่งเกิน');
    }
  };

  const handleAcceptNew = async (supplierId: number) => {
    try {
      await api.post(`/api/suppliers/${supplierId}/accept`);
      setSuppliers((prev) =>
        prev.map((s) => (s.id === supplierId ? { ...s, is_new: false } : s))
      );
    } catch (err: any) {
      alert(err.response?.data?.detail || 'เกิดข้อผิดพลาดในการรับทราบ');
    }
  };

  // Inline Email Save
  const handleSaveInlineEmail = async (supplierId: number) => {
    try {
      const cleaned = editingEmailVal.trim();
      const finalEmail = isEmailValid(cleaned) ? cleaned : null;
      await api.put(`/api/suppliers/${supplierId}`, { email: finalEmail });
      
      setEditingEmailId(null);
      setSavedEmailIndicator((prev) => ({ ...prev, [supplierId]: true }));
      setTimeout(() => {
        setSavedEmailIndicator((prev) => ({ ...prev, [supplierId]: false }));
      }, 1500);
      fetchSuppliers();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'เกิดข้อผิดพลาดในการบันทึก Email');
    }
  };

  const handleOpenEdit = (s: SupplierMaster) => {
    setShowEditModal(s);
    setFormData({
      supplier_name: s.supplier_name,
      telephone: s.telephone || '',
      email: isEmailValid(s.email) ? s.email! : '',
      contact_person: s.contact_person || '',
      allow_over_delivery: s.allow_over_delivery || false,
    });
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showEditModal) return;
    setSubmitting(true);

    try {
      const cleanedEmail = formData.email.trim();
      const finalEmail = isEmailValid(cleanedEmail) ? cleanedEmail : null;

      await api.put(`/api/suppliers/${showEditModal.id}`, {
        ...formData,
        email: finalEmail,
      });
      setShowEditModal(null);
      fetchSuppliers();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'เกิดข้อผิดพลาดในการปรับปรุงข้อมูล Supplier');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyLink = async (supplierId: number, supplierCode: string) => {
    try {
      const res = await api.post<{ token: string; portal_url: string }>(`/api/suppliers/${supplierId}/token`);
      navigator.clipboard.writeText(res.data.portal_url);
      setCopiedCode(supplierCode);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch (err: any) {
      alert(err.response?.data?.detail || 'เกิดข้อผิดพลาดในการสร้างลิงก์');
    }
  };

  const handleSendPortalEmail = async (supplier: SupplierMaster) => {
    if (!isEmailValid(supplier.email)) {
      alert('กรุณาระบุ Email ของ Supplier ก่อนส่งแจ้งเตือน');
      return;
    }

    setSendingEmailId(supplier.id);
    try {
      const res = await api.post(`/api/suppliers/${supplier.id}/send-portal-email`);
      alert(res.data.message || `ส่ง Email แจ้งลิงก์ Portal หา ${supplier.supplier_name} เรียบร้อยแล้ว`);
    } catch (err: any) {
      alert(err.response?.data?.detail || 'ส่ง Email ล้มเหลว');
    } finally {
      setSendingEmailId(null);
    }
  };

  const [broadcasting, setBroadcasting] = useState(false);

  const handleBroadcastEmails = async () => {
    if (!confirm('คุณต้องการส่ง Email แจ้งลิงก์ Portal ไปยัง Supplier ทุกรายที่มีอีเมลใช่หรือไม่? (ระบบจะส่งเป็นชุดๆ ละ 20 รายการเพื่อความปลอดภัย)')) {
      return;
    }

    setBroadcasting(true);
    try {
      const res = await api.post<{ message: string; details: any }>('/api/suppliers/send-all-portal-emails');
      alert(res.data.message || 'กระจายส่ง Email สำเร็จเรียบร้อยแล้ว');
      fetchSuppliers();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'เกิดข้อผิดพลาดในการกระจายส่ง Email');
    } finally {
      setBroadcasting(false);
    }
  };

  // XLSX Export
  const handleExportXLSX = () => {
    const excelData = filtered.map((s) => ({
      'Supplier Code': s.supplier_code,
      'Supplier Name': s.supplier_name,
      'Email': isEmailValid(s.email) ? s.email! : '',
      'Allow Over Delivery': s.allow_over_delivery ? 'ใช่' : 'ไม่ใช่',
      'Accept': s.is_new ? 'รอ Accept' : 'Accept',
    }));

    const worksheet = XLSX.utils.json_to_sheet(excelData);

    // Set Column Widths for clean viewing in Excel
    worksheet['!cols'] = [
      { wch: 15 }, // Supplier Code
      { wch: 40 }, // Supplier Name
      { wch: 32 }, // Email
      { wch: 18 }, // Telephone
      { wch: 20 }, // Contact Person
      { wch: 22 }, // Allow Over Delivery
      { wch: 16 }, // Accept
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'SupplierMaster');

    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');

    XLSX.writeFile(workbook, `IRM_Supplier_Master_${yyyy}${mm}${dd}_${hh}${min}.xlsx`);
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
        // Find keys dynamically
        const keys = Object.keys(row);
        const codeKey = keys.find(k => k.toLowerCase().includes('code') || k.toLowerCase().includes('รหัส'));
        const nameKey = keys.find(k => k.toLowerCase().includes('name') || k.toLowerCase().includes('ชื่อ'));
        const emailKey = keys.find(k => k.toLowerCase().includes('email') || k.toLowerCase().includes('อีเมล'));
        const telKey = keys.find(k => k.toLowerCase().includes('tel') || k.toLowerCase().includes('phone') || k.toLowerCase().includes('เบอร์') || k.toLowerCase().includes('โทร'));
        const contactKey = keys.find(k => k.toLowerCase().includes('contact') || k.toLowerCase().includes('ผู้ติดต่อ'));
        const overKey = keys.find(k => k.toLowerCase().includes('over') || k.toLowerCase().includes('ส่งเกิน'));
        const acceptKey = keys.find(k => k.toLowerCase().includes('accept') || k.toLowerCase().includes('ยอมรับ') || k.toLowerCase().includes('สถานะ') || k.toLowerCase().includes('status'));

        if (!codeKey || !row[codeKey]) continue;

        const codeVal = String(row[codeKey]).trim();
        if (!codeVal) continue;

        let emailVal = emailKey && row[emailKey] ? String(row[emailKey]).trim() : undefined;
        let telVal = telKey && row[telKey] ? String(row[telKey]).trim() : undefined;
        let contactVal = contactKey && row[contactKey] ? String(row[contactKey]).trim() : undefined;
        let nameVal = nameKey && row[nameKey] ? String(row[nameKey]).trim() : undefined;

        // Parse Over Delivery
        let overVal: boolean | undefined = undefined;
        if (overKey && row[overKey] !== '') {
          const rawOver = String(row[overKey]).trim().toLowerCase();
          overVal = rawOver === 'ใช่' || rawOver === 'อนุญาต' || rawOver === 'true' || rawOver === '1' || rawOver === 'yes' || rawOver === 'y';
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
          supplier_code: codeVal,
          supplier_name: nameVal,
          email: emailVal !== undefined ? (isEmailValid(emailVal) ? emailVal : null) : undefined,
          telephone: telVal,
          contact_person: contactVal,
          allow_over_delivery: overVal,
          accept: acceptVal,
        });
      }

      if (bulkPayload.length === 0) {
        alert('ไม่พบข้อมูล Supplier ที่ถูกต้องในไฟล์ Excel (ต้องมีคอลัมน์ Supplier Code)');
        return;
      }

      const res = await api.put<{ message: string; updated_count: number }>('/api/suppliers/bulk-update', {
        suppliers: bulkPayload,
      });
      alert(res.data.message || `นำเข้าและอัปเดตข้อมูลสำเร็จ ${res.data.updated_count} รายการ`);
      fetchSuppliers();
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

  const filtered = suppliers.filter(
    (s) =>
      s.supplier_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.supplier_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.email && s.email.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-500">
        <div className="w-6 h-6 border-2 border-sky-500 border-t-transparent rounded-full animate-spin mr-3"></div>
        <span>กำลังโหลด Supplier Master...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Title & Action Buttons */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2.5">
            <Factory className="w-7 h-7 text-sky-600" />
            <span>Supplier Master (ทะเบียนรายชื่อ Supplier)</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            จัดการ Email, สิทธิ์การส่งของเกินยอด (Over-Delivery), เบอร์โทรศัพท์ และส่งลิงก์ติดตามการส่งของให้ Supplier
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={handleBroadcastEmails}
            disabled={broadcasting}
            className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-sm flex items-center gap-1.5 transition disabled:opacity-50"
            title="กระจายส่ง Email แจ้งลิงก์ Portal หา Supplier ทุกรายที่มีอีเมล"
          >
            {broadcasting ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <Send className="w-4 h-4" />
            )}
            <span>{broadcasting ? 'กำลังกระจายส่ง...' : 'กระจายส่ง Email ทั้งหมด'}</span>
          </button>

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

      {/* Filter / Search */}
      <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="ค้นหารหัส, ชื่อ Supplier หรือ อีเมล..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-sky-500 focus:bg-white transition"
          />
        </div>

        <div className="text-xs text-slate-500 font-medium">
          พบทั้งหมด <span className="font-bold text-slate-800">{filtered.length}</span> รายชื่อ
        </div>
      </div>

      {/* TOP SYNCHRONIZED SCROLLBAR */}
      <div 
        ref={topScrollRef}
        onScroll={handleTopScroll}
        className="overflow-x-auto overflow-y-hidden h-3 bg-slate-100 border border-slate-200 rounded-t-xl cursor-ew-resize"
        title="แถบเลื่อนซ้าย-ขวาสำหรับตาราง"
      >
        <div style={{ width: `${tableScrollWidth}px` }} className="h-1" />
      </div>

      {/* Compact Supplier Master Data Table */}
      <div 
        ref={mainTableRef}
        onScroll={handleMainScroll}
        className="bg-white rounded-b-2xl border border-slate-200 shadow-sm text-xs max-h-[72vh] overflow-y-auto -mt-3"
      >
        <table className="w-full text-left border-collapse min-w-[1100px]">
          <thead className="bg-slate-900 text-slate-200 font-bold sticky top-0 z-20 shadow-md">
            <tr>
              <th className="py-2.5 px-2 text-center w-10 whitespace-nowrap">#</th>
              <th className="py-2.5 px-2.5 w-32 whitespace-nowrap">Supplier Code</th>
              <th className="py-2.5 px-3 min-w-[200px]">Supplier Name</th>
              <th className="py-2.5 px-2.5 w-52 whitespace-nowrap">Email</th>
              <th className="py-2.5 px-2.5 w-40 whitespace-nowrap">เบอร์โทรศัพท์ & ผู้ติดต่อ</th>
              <th className="py-2.5 px-2 text-center w-40 whitespace-nowrap bg-slate-950 text-amber-300">ส่งเกินยอด (Over-Delivery)</th>
              <th className="py-2.5 px-2 text-center w-28 whitespace-nowrap">สถานะ</th>
              <th className="py-2.5 px-2.5 text-right w-48 whitespace-nowrap">การจัดการ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((s, index) => (
              <tr key={s.id} className="hover:bg-slate-50/80 transition">
                {/* Running No. */}
                <td className="py-2 px-2 text-center font-bold text-slate-400">{index + 1}</td>
                <td className="py-2 px-2.5 font-bold text-slate-900 whitespace-nowrap">
                  <div className="flex items-center gap-1.5">
                    <span>{s.supplier_code}</span>
                    {s.is_new && (
                      <span className="px-1.5 py-0.2 rounded-full text-[9px] font-extrabold bg-amber-500 text-white shadow-2xs">
                        NEW
                      </span>
                    )}
                  </div>
                </td>
                <td className="py-2 px-3 text-slate-800 font-semibold">{s.supplier_name}</td>

                {/* Email Column (With Inline Edit) */}
                <td className="py-2 px-2.5 whitespace-nowrap">
                  {editingEmailId === s.id ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="email"
                        value={editingEmailVal}
                        onChange={(e) => setEditingEmailVal(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveInlineEmail(s.id);
                          if (e.key === 'Escape') setEditingEmailId(null);
                        }}
                        placeholder="email@supplier.com"
                        className="px-2 py-0.5 bg-white border border-sky-400 rounded-lg text-xs font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-sky-200 w-44"
                        autoFocus
                      />
                      <button
                        onClick={() => handleSaveInlineEmail(s.id)}
                        className="p-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition shadow-2xs"
                        title="บันทึก Email"
                      >
                        <Check className="w-3 h-3" />
                      </button>
                    </div>
                  ) : isEmailValid(s.email) ? (
                    <div className="flex items-center gap-1.5 group cursor-pointer" onClick={() => { setEditingEmailId(s.id); setEditingEmailVal(s.email!); }}>
                      <span className="text-sky-600 font-medium flex items-center gap-1 group-hover:underline">
                        <Mail className="w-3 h-3 text-sky-500" />
                        {s.email}
                      </span>
                      <Edit className="w-3 h-3 text-slate-300 group-hover:text-sky-500 transition" />
                      {savedEmailIndicator[s.id] && (
                        <span className="text-[9px] text-emerald-600 font-bold bg-emerald-50 px-1 py-0.2 rounded border border-emerald-200 animate-fade-in flex items-center gap-0.5">
                          <Check className="w-2.5 h-2.5" /> บันทึกแล้ว!
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 cursor-pointer" onClick={() => { setEditingEmailId(s.id); setEditingEmailVal(''); }}>
                      <span className="text-amber-600 font-bold text-[10px] bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 inline-flex items-center gap-1 hover:bg-amber-100 transition">
                        <AlertCircle className="w-3 h-3 text-amber-500" />
                        กรุณาระบุ Email
                      </span>
                      <Edit className="w-3 h-3 text-slate-300 hover:text-amber-600 transition" />
                      {savedEmailIndicator[s.id] && (
                        <span className="text-[9px] text-emerald-600 font-bold bg-emerald-50 px-1 py-0.2 rounded border border-emerald-200 flex items-center gap-0.5">
                          <Check className="w-2.5 h-2.5" /> บันทึกแล้ว!
                        </span>
                      )}
                    </div>
                  )}
                </td>

                {/* Phone & Contact */}
                <td className="py-2 px-2.5 whitespace-nowrap">
                  <div className="text-slate-700 font-medium">{s.telephone || '-'}</div>
                  {s.contact_person && (
                    <div className="text-[10px] text-slate-400">{s.contact_person}</div>
                  )}
                </td>

                {/* Direct Over-Delivery Interactive Toggle Button */}
                <td className="py-2 px-2 text-center whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => handleToggleOverDelivery(s)}
                    className={`px-3 py-1 rounded-full text-[10px] font-extrabold border transition shadow-2xs cursor-pointer inline-flex items-center gap-1.5 ${
                      s.allow_over_delivery
                        ? 'bg-amber-100 text-amber-950 border-amber-400 hover:bg-amber-200'
                        : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200 hover:text-slate-700'
                    }`}
                    title="คลิกเพื่อสลับสิทธิ์การส่งเกินยอดสั่งซื้อของ Supplier รายนี้"
                  >
                    {s.allow_over_delivery ? (
                      <>
                        <ShieldCheck className="w-3 h-3 text-amber-600" />
                        <span>⚡ ส่งเกินได้</span>
                      </>
                    ) : (
                      <>
                        <ShieldAlert className="w-3 h-3 text-slate-400" />
                        <span>ไม่อนุญาต</span>
                      </>
                    )}
                  </button>
                </td>

                {/* Email Status Badge & Accept Status */}
                <td className="py-2 px-2 text-center whitespace-nowrap">
                  <div className="flex flex-col items-center gap-0.5">
                    {!isEmailValid(s.email) ? (
                      <span className="px-2 py-0.2 rounded-full text-[9px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                        ขาดข้อมูล Email
                      </span>
                    ) : s.last_sent_at ? (
                      <span className="px-2 py-0.2 rounded-full text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {formatDateTimeThai(s.last_sent_at)}
                      </span>
                    ) : (
                      <span className="px-2 py-0.2 rounded-full text-[9px] font-bold bg-slate-50 text-slate-500 border border-slate-200">
                        ยังไม่เคยส่ง
                      </span>
                    )}
                  </div>
                </td>

                {/* Actions */}
                <td className="py-2 px-2.5 text-right whitespace-nowrap">
                  <div className="flex items-center justify-end gap-1.5">
                    {/* Accept New Button */}
                    {s.is_new && (
                      <button
                        onClick={() => handleAcceptNew(s.id)}
                        className="px-2 py-0.5 rounded text-amber-700 hover:bg-amber-50 border border-amber-300 font-bold text-[10px] flex items-center gap-1 transition shadow-2xs"
                        title="รับทราบ Supplier ใหม่"
                      >
                        <Check className="w-3 h-3 text-amber-600" />
                        <span>Accept</span>
                      </button>
                    )}

                    {/* Copy Link Button */}
                    <button
                      onClick={() => handleCopyLink(s.id, s.supplier_code)}
                      className="px-2 py-0.5 rounded text-slate-600 hover:text-sky-600 hover:bg-sky-50 border border-slate-200 font-semibold text-[10px] flex items-center gap-1 transition"
                      title="คัดลอกลิงก์ส่งให้ Supplier"
                    >
                      {copiedCode === s.supplier_code ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span className="text-emerald-600">คัดลอกแล้ว!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-slate-400" />
                          <span>Copy Link</span>
                        </>
                      )}
                    </button>

                    {/* Send Email Button */}
                    <button
                      onClick={() => handleSendPortalEmail(s)}
                      disabled={sendingEmailId === s.id}
                      className="px-2.5 py-1 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-semibold text-[11px] flex items-center gap-1 shadow-sm transition disabled:opacity-50"
                      title="ส่ง Email แจ้งลิงก์ Portal"
                    >
                      {sendingEmailId === s.id ? (
                        <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                        <Send className="w-3.5 h-3.5" />
                      )}
                      <span>ส่ง Email</span>
                    </button>

                    {/* Edit Button */}
                    <button
                      onClick={() => handleOpenEdit(s)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-sky-600 hover:bg-sky-50 border border-slate-200 transition"
                      title="แก้ไขข้อมูล Email / สิทธิ์ส่งเกิน / เบอร์โทร"
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
      {showEditModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-200">
            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Edit className="w-5 h-5 text-sky-600" />
              <span>แก้ไขข้อมูล Supplier ({showEditModal.supplier_code})</span>
            </h2>

            <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">ชื่อ Supplier</label>
                <input
                  type="text"
                  value={formData.supplier_name}
                  onChange={(e) => setFormData({ ...formData, supplier_name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:border-sky-500"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Email สำหรับส่ง Portal Link</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="example@company.com"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">เบอร์โทรศัพท์</label>
                <input
                  type="text"
                  value={formData.telephone}
                  onChange={(e) => setFormData({ ...formData, telephone: e.target.value })}
                  placeholder="02-XXX-XXXX"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">ชื่อผู้ติดต่อ</label>
                <input
                  type="text"
                  value={formData.contact_person}
                  onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                  placeholder="คุณ..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:border-sky-500"
                />
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-3 cursor-pointer select-none bg-amber-50/70 p-3 rounded-xl border border-amber-200 hover:bg-amber-100/70 transition">
                  <input
                    type="checkbox"
                    checked={formData.allow_over_delivery || false}
                    onChange={(e) => setFormData({ ...formData, allow_over_delivery: e.target.checked })}
                    className="w-4 h-4 text-amber-600 rounded focus:ring-amber-500"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">อนุญาตให้ส่งเกินยอดสั่งซื้อได้ (Allow Over-Delivery)</span>
                    <span className="text-[10px] text-slate-600 block">ยินยอมให้ Supplier รายนี้กรอกจำนวนส่งมอบสูงกว่ายอดค้างส่งใน Portal ได้</span>
                  </div>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowEditModal(null)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold transition"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold transition shadow-sm disabled:opacity-50"
                >
                  {submitting ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
