'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { Building2, Calendar, CheckCircle2, Package, Send, AlertCircle, Lock, Clock, Trash2, Plus, Save, Sparkles, Check, ChevronRight } from 'lucide-react';

interface SupplierItem {
  id: number;
  po_number: string;
  po_date: string;
  item_code: string;
  item_name: string;
  quantity: number;
  unit: string;
  received_qty: number;
  remaining_qty: number;
  estimate_date: string | null;
  estimate_qty: number | null;
  status: string;
  sub_items?: any[];
}

interface SupplierPortalData {
  supplier_code: string;
  supplier_name: string;
  allow_over_delivery?: boolean;
  is_single_po?: boolean;
  po_number?: string;
  is_submitted: boolean;
  expires_at_formatted: string;
  items: SupplierItem[];
}

export default function SupplierPortalPage() {
  const params = useParams();
  const rawToken = params?.token as string;
  const token = (rawToken || '').trim().replace(/\s+/g, '_');

  const [portalData, setPortalData] = useState<SupplierPortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);
  const [draftSavedMessage, setDraftSavedMessage] = useState<string | null>(null);

  // Form input state: item_id -> { date, qty, subItems }
  const [formInputs, setFormInputs] = useState<Record<number, {
    date: string;
    qty: number | '';
    subItems?: { estimate_date: string; quantity: number | '' }[];
  }>>({});

  useEffect(() => {
    if (token) {
      fetchPortalData();
    }
  }, [token]);

  const formatDateThai = (isoStr: string | null) => {
    if (!isoStr) return '';
    const d = new Date(isoStr);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  };

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

  const parseDateInput = (str: string): string | null => {
    if (!str) return null;
    const parts = str.split('/');
    if (parts.length !== 3) return null;
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const year = parseInt(parts[2], 10);
    if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
    if (day < 1 || day > 31 || month < 1 || month > 12 || year < 2020 || year > 2099) return null;
    
    const d = new Date(year, month - 1, day, 12, 0, 0);
    return d.toISOString();
  };

  const fetchPortalData = async () => {
    try {
      const cleanTok = String(token || '').trim().replace(/\s+/g, '_');
      const res = await api.get<SupplierPortalData>(`/api/supplier-portal/token/${encodeURIComponent(cleanTok)}`);
      setPortalData(res.data);

      const initialInputs: Record<number, { date: string; qty: number | ''; subItems: { estimate_date: string; quantity: number | '' }[] }> = {};
      res.data.items.forEach((item) => {
        // DEFAULT QTY: STRICTLY USE remaining_qty (not total quantity)
        const defaultQty = item.estimate_qty !== null && item.estimate_qty !== undefined
          ? item.estimate_qty
          : (item.remaining_qty !== undefined ? item.remaining_qty : item.quantity);

        initialInputs[item.id] = {
          date: item.estimate_date ? formatDateThai(item.estimate_date) : '',
          qty: defaultQty,
          subItems: item.sub_items && item.sub_items.length > 0
            ? item.sub_items.map((sub: any) => ({
                estimate_date: formatDateThai(sub.estimate_date),
                quantity: sub.quantity
              }))
            : []
        };
      });
      setFormInputs(initialInputs);
      if (res.data.is_submitted) {
        setSubmittedSuccess(true);
      }
    } catch (err: any) {
      console.error('Failed to load supplier portal:', err);
      setError(err.response?.data?.detail || 'ลิงก์ไม่ถูกต้อง หรือหมดอายุแล้ว');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (itemId: number, field: 'date' | 'qty', val: string | number) => {
    let finalVal = val;
    if (field === 'date') {
      finalVal = handleDateMask(val as string);
    }
    setFormInputs((prev) => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        [field]: finalVal,
      },
    }));
  };

  const handleAddSubItem = (itemId: number) => {
    setFormInputs((prev) => {
      const current = prev[itemId] || { date: '', qty: '', subItems: [] };
      const currentSubs = current.subItems || [];
      return {
        ...prev,
        [itemId]: {
          ...current,
          subItems: [
            ...currentSubs,
            { estimate_date: '', quantity: '' }
          ]
        }
      };
    });
  };

  const handleRemoveSubItem = (itemId: number, subIndex: number) => {
    setFormInputs((prev) => {
      const current = prev[itemId];
      if (!current || !current.subItems) return prev;
      const updatedSubs = current.subItems.filter((_, idx) => idx !== subIndex);
      return {
        ...prev,
        [itemId]: {
          ...current,
          subItems: updatedSubs
        }
      };
    });
  };

  const handleSubItemChange = (itemId: number, subIndex: number, field: 'estimate_date' | 'quantity', val: string | number) => {
    setFormInputs((prev) => {
      const current = prev[itemId];
      if (!current || !current.subItems) return prev;
      const updatedSubs = [...current.subItems];
      let finalVal = val;
      if (field === 'estimate_date') {
        finalVal = handleDateMask(val as string);
      }
      updatedSubs[subIndex] = {
        ...updatedSubs[subIndex],
        [field]: finalVal
      };
      return {
        ...prev,
        [itemId]: {
          ...current,
          subItems: updatedSubs
        }
      };
    });
  };

  const scrollToRow = (itemId: number) => {
    const el = document.getElementById(`row-${itemId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('bg-amber-100/50');
      setTimeout(() => el.classList.remove('bg-amber-100/50'), 2500);
    }
  };

  const handleSubmit = async (e?: React.FormEvent, isDraft: boolean = false) => {
    if (e) e.preventDefault();
    if (!portalData || portalData.is_submitted) return;

    setError(null);
    setDraftSavedMessage(null);
    const payloadItems = [];
    const allowOver = Boolean(portalData.allow_over_delivery);

    // Strict validation loop with row identification
    for (let idx = 0; idx < portalData.items.length; idx++) {
      const item = portalData.items[idx];
      const input = formInputs[item.id] || { date: '', qty: '', subItems: [] };
      const hasSubItems = input.subItems && input.subItems.length > 0;

      if (hasSubItems) {
        let totalQty = 0;
        const parsedSubs = [];
        for (let sIdx = 0; sIdx < input.subItems!.length; sIdx++) {
          const sub = input.subItems![sIdx];
          if (!isDraft) {
            if (!sub.estimate_date || sub.estimate_date.length < 10) {
              setError(`❌ แถวที่ ${idx + 1} (${item.item_code}) รอบที่ ${sIdx + 1}: กรุณาระบุวันที่ส่งสินค้าให้ถูกต้องครบถ้วน (วว/ดด/ปปปป)`);
              scrollToRow(item.id);
              return;
            }
            if (sub.quantity === '' || Number(sub.quantity) <= 0) {
              setError(`❌ แถวที่ ${idx + 1} (${item.item_code}) รอบที่ ${sIdx + 1}: กรุณาระบุจำนวนสินค้าที่ส่ง`);
              scrollToRow(item.id);
              return;
            }
          }

          const isoDate = parseDateInput(sub.estimate_date);
          const qVal = Number(sub.quantity) || 0;
          if (isoDate && qVal > 0) {
            parsedSubs.push({ estimate_date: isoDate, quantity: qVal });
            totalQty += qVal;
          }
        }

        if (!allowOver && totalQty > item.remaining_qty && !isDraft) {
          setError(`❌ แถวที่ ${idx + 1} (${item.item_code}): ยอดรวมส่ง (${totalQty.toLocaleString()} ${item.unit}) สูงกว่ายอดค้างส่ง (${item.remaining_qty.toLocaleString()} ${item.unit})`);
          scrollToRow(item.id);
          return;
        }

        if (parsedSubs.length > 0) {
          payloadItems.push({ item_id: item.id, sub_items: parsedSubs });
        }
      } else {
        const qVal = Number(input.qty);
        if (!isDraft) {
          if (!input.date || input.date.length < 10) {
            setError(`❌ แถวที่ ${idx + 1} (${item.item_code}): กรุณาระบุวันที่ส่งสินค้า (วว/ดด/ปปปป)`);
            scrollToRow(item.id);
            return;
          }
          const isoDate = parseDateInput(input.date);
          if (!isoDate) {
            setError(`❌ แถวที่ ${idx + 1} (${item.item_code}): รูปแบบวันที่ "${input.date}" ไม่ถูกต้อง`);
            scrollToRow(item.id);
            return;
          }
          if (isNaN(qVal) || qVal <= 0) {
            setError(`❌ แถวที่ ${idx + 1} (${item.item_code}): กรุณาระบุจำนวนสินค้าที่ส่ง`);
            scrollToRow(item.id);
            return;
          }
          if (!allowOver && qVal > item.remaining_qty) {
            setError(`❌ แถวที่ ${idx + 1} (${item.item_code}): จำนวนที่ส่ง (${qVal.toLocaleString()} ${item.unit}) สูงกว่ายอดค้างส่ง (${item.remaining_qty.toLocaleString()} ${item.unit})`);
            scrollToRow(item.id);
            return;
          }
          payloadItems.push({ item_id: item.id, estimate_date: isoDate, estimate_qty: qVal });
        } else {
          // In Draft mode, include if date is parsed
          const isoDate = parseDateInput(input.date);
          if (isoDate && qVal > 0) {
            payloadItems.push({ item_id: item.id, estimate_date: isoDate, estimate_qty: qVal });
          }
        }
      }
    }

    if (payloadItems.length === 0 && !isDraft) {
      setError('❌ กรุณาระบุวันส่งของและจำนวนสินค้าอย่างน้อย 1 รายการ');
      return;
    }

    setSubmitting(true);
    try {
      const cleanTok = String(token || '').trim().replace(/\s+/g, '_');
      await api.post(`/api/supplier-portal/token/${encodeURIComponent(cleanTok)}/submit`, {
        items: payloadItems,
        is_draft: isDraft,
      });

      if (isDraft) {
        setDraftSavedMessage('💾 บันทึกร่างข้อมูลชั่วคราวเรียบร้อยแล้ว ท่านสามารถกลับมาแก้ไขและส่งข้อมูลจริงได้ตามเวลาที่กำหนด');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        setSubmittedSuccess(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
      fetchPortalData();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'เกิดข้อผิดพลาดในการส่งข้อมูล');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 border-2 border-sky-400 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm font-medium">กำลังตรวจสอบความถูกต้องของ Cryptographic Token...</span>
        </div>
      </div>
    );
  }

  if (error && !portalData) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 max-w-md w-full text-center space-y-4 shadow-2xl">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
          <h2 className="text-lg font-bold text-white">ลิงก์ไม่ถูกต้อง หรือหมดอายุการใช้งานแล้ว</h2>
          <p className="text-xs text-slate-400 leading-relaxed">{error}</p>
        </div>
      </div>
    );
  }

  const isLocked = submittedSuccess || (portalData?.is_submitted ?? false);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 font-sans pb-16">
      {/* Header */}
      <header className="bg-slate-900 text-white py-5 px-6 shadow-lg border-b border-slate-800">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center font-bold text-white shadow-md shadow-sky-500/20">
              IRM
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">IRM Supplier Portal</h1>
              <p className="text-xs text-slate-400">ระบบระบุวันและจำนวนส่งมอบวัตถุดิบ (Window Asia PCL.)</p>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-slate-800 px-4 py-2 rounded-xl text-xs">
            <Building2 className="w-4 h-4 text-sky-400" />
            <span className="font-semibold text-slate-200">{portalData?.supplier_name}</span>
            <span className="font-mono text-slate-400 font-normal">({portalData?.supplier_code})</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto mt-6 px-4 space-y-5">
        {/* Expiry Window Notice */}
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-amber-900 text-xs font-semibold shadow-sm">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-600 shrink-0" />
            <span>กำหนดเวลากรอกข้อมูล: ลิงก์จะหมดอายุใน <strong className="text-amber-950 font-bold">{portalData?.expires_at_formatted}</strong></span>
          </div>
          {portalData?.allow_over_delivery && (
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300 inline-flex items-center gap-1">
              <span>⚡ อนุญาตให้ระบุยอดส่งเกินยอดสั่งซื้อได้</span>
            </span>
          )}
        </div>

        {/* Success Modal / Banner */}
        {submittedSuccess && (
          <div className="p-6 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-950 space-y-2 shadow-sm">
            <div className="flex items-center gap-2.5 font-bold text-base text-emerald-800">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
              <span>ยืนยันส่งข้อมูลให้ฝ่ายจัดซื้อเรียบร้อยแล้ว</span>
            </div>
            <p className="text-xs text-emerald-800 leading-relaxed pl-8.5">
              ข้อมูลกำหนดวันส่งมอบและจำนวนสินค้าได้รับการบันทึกเข้าสู่ระบบ IRM เรียบร้อยแล้ว ฝ่ายจัดซื้อจะทำการตรวจสอบและนำเข้าแผนงานต่อไป ขอขอบพระคุณครับ
            </p>
          </div>
        )}

        {/* Draft Saved Banner */}
        {draftSavedMessage && (
          <div className="p-4 rounded-2xl bg-sky-500/10 border border-sky-500/30 flex items-center gap-2 text-sky-900 text-xs font-semibold shadow-sm">
            <Check className="w-4 h-4 text-sky-600 shrink-0" />
            <span>{draftSavedMessage}</span>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center gap-3 text-rose-800 text-xs font-semibold shadow-sm animate-shake">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Table Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 sm:p-5 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <Package className="w-5 h-5 text-sky-600" />
                <h2 className="font-bold text-slate-800 text-sm sm:text-base">
                  {portalData?.is_single_po ? `รายการสำหรับ PO: ${portalData?.po_number}` : 'รายการ PO ที่รอระบุวันส่งมอบวัตถุดิบ'}
                </h2>
                {portalData?.is_single_po && (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300">
                    ⚡ ลิงก์ด่วนเฉพาะ PO นี้
                  </span>
                )}
              </div>
              <span className="text-xs text-slate-500">จำนวนทั้งหมด <strong>{portalData?.items.length}</strong> รายการ</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse min-w-[980px]">
                <thead className="bg-slate-900 text-slate-200 font-bold sticky top-0 z-10 shadow-sm">
                  <tr>
                    <th className="py-2.5 px-2 text-center w-10 whitespace-nowrap">#</th>
                    <th className="py-2.5 px-3 w-28 whitespace-nowrap">PO</th>
                    <th className="py-2.5 px-3 w-24 whitespace-nowrap">PO Date</th>
                    <th className="py-2.5 px-3 min-w-[200px]">รหัสสินค้า & ชื่อสินค้า</th>
                    <th className="py-2.5 px-3 text-right w-24 whitespace-nowrap">ยอดสั่งซื้อ</th>
                    <th className="py-2.5 px-3 text-right w-24 whitespace-nowrap">รับแล้ว</th>
                    <th className="py-2.5 px-3 text-right w-24 whitespace-nowrap text-sky-300 bg-slate-950">ยอดคงเหลือ</th>
                    <th className="py-2.5 px-3 bg-sky-950 text-sky-300 w-44 whitespace-nowrap">ระบุวันส่งสินค้า *</th>
                    <th className="py-2.5 px-3 text-right bg-sky-950 text-sky-300 w-36 whitespace-nowrap">จำนวนที่ส่ง (Qty) *</th>
                    <th className="py-2.5 px-3 text-center w-28 whitespace-nowrap">สถานะ</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    let lastPo = '';

                    return portalData?.items.map((item, index) => {
                      const isFirstInPo = item.po_number !== lastPo;
                      if (isFirstInPo) {
                        lastPo = item.po_number;
                      }

                      const subItemsList = formInputs[item.id]?.subItems || [];
                      const hasSubItems = subItemsList.length > 0;
                      const currentVal = formInputs[item.id]?.qty;
                      const isOverQty = !portalData.allow_over_delivery && typeof currentVal === 'number' && currentVal > item.remaining_qty;
                      const isPermittedOver = portalData.allow_over_delivery && typeof currentVal === 'number' && currentVal > item.remaining_qty;

                      return (
                        <React.Fragment key={item.id}>
                          <tr
                            id={`row-${item.id}`}
                            className={`hover:bg-slate-50 transition ${isFirstInPo && index > 0 ? '!border-t-4 !border-t-slate-400/90 shadow-[0_-3px_6px_rgba(0,0,0,0.06)]' : 'border-t border-slate-100'}`}
                          >
                            {/* 1. # */}
                            <td className="py-3 px-2 text-center text-slate-400 font-bold align-top">{index + 1}</td>

                            {/* 2. PO Number */}
                            <td className="py-3 px-3 font-medium whitespace-nowrap align-top">
                              {isFirstInPo ? (
                                <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                  {item.po_number}
                                </span>
                              ) : (
                                <span className="text-slate-300 text-xs font-mono select-none pl-1">↳</span>
                              )}
                            </td>

                            {/* 3. PO Date */}
                            <td className="py-3 px-3 text-slate-600 whitespace-nowrap align-top">
                              {isFirstInPo ? formatDateThai(item.po_date) : <span className="text-slate-200">-</span>}
                            </td>

                            {/* 4. Item Code & Name */}
                            <td className="py-3 px-3 align-top">
                              <div className="font-bold text-slate-900">{item.item_code}</div>
                              <div className="text-[11px] text-slate-500 leading-tight">{item.item_name}</div>
                            </td>

                            {/* 5. Total PO Qty */}
                            <td className="py-3 px-3 text-right whitespace-nowrap align-top font-medium text-slate-600">
                              <div>{item.quantity.toLocaleString()}</div>
                              <div className="text-[10px] text-slate-400">{item.unit}</div>
                            </td>

                            {/* 6. Received Qty */}
                            <td className="py-3 px-3 text-right whitespace-nowrap align-top text-emerald-700 font-medium">
                              <div>{item.received_qty.toLocaleString()}</div>
                              <div className="text-[10px] text-slate-400">{item.unit}</div>
                            </td>

                            {/* 7. Remaining Qty */}
                            <td className="py-3 px-3 text-right whitespace-nowrap align-top font-black text-slate-900 bg-slate-50/70">
                              <div className="text-slate-900">{item.remaining_qty.toLocaleString()}</div>
                              <div className="text-[10px] text-slate-500 font-normal">{item.unit}</div>
                            </td>

                            {/* 8. Date Input (or Split trigger) */}
                            <td className="py-3 px-3 align-top">
                              {hasSubItems ? (
                                <div className="text-sky-700 font-bold text-[11px] flex items-center gap-1 py-1">
                                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                                  <span>แตกส่ง {subItemsList.length} รอบ</span>
                                </div>
                              ) : (
                                <div className="space-y-1">
                                  <div className="relative flex items-center">
                                    <input
                                      type="text"
                                      disabled={isLocked}
                                      placeholder="วว/ดด/ปปปป"
                                      value={formInputs[item.id]?.date || ''}
                                      onChange={(e) => handleInputChange(item.id, 'date', e.target.value)}
                                      className="w-full pl-3 pr-8 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:outline-none disabled:bg-slate-100 disabled:text-slate-400"
                                    />
                                    <input
                                      type="date"
                                      disabled={isLocked}
                                      className="absolute right-2 opacity-0 w-5 h-5 cursor-pointer disabled:cursor-not-allowed"
                                      onChange={(e) => {
                                        if (e.target.value) {
                                          const [y, m, d] = e.target.value.split('-');
                                          handleInputChange(item.id, 'date', `${d}/${m}/${y}`);
                                        }
                                      }}
                                    />
                                    <Calendar className="w-4 h-4 text-slate-400 absolute right-2 pointer-events-none" />
                                  </div>
                                  {!isLocked && (
                                    <button
                                      type="button"
                                      onClick={() => handleAddSubItem(item.id)}
                                      className="text-[10px] text-sky-600 hover:text-sky-800 font-semibold hover:underline flex items-center gap-0.5"
                                    >
                                      <span>↳ แตกส่งหลายงวด (Split)</span>
                                    </button>
                                  )}
                                </div>
                              )}
                            </td>

                            {/* 9. Qty Input */}
                            <td className="py-3 px-3 text-right align-top">
                              {hasSubItems ? (
                                <div className="text-[11px] font-bold text-slate-700 py-1">
                                  รวม: {subItemsList.reduce((sum, s) => sum + (Number(s.quantity) || 0), 0).toLocaleString()}
                                </div>
                              ) : (
                                <div className="space-y-1">
                                  <input
                                    type="number"
                                    disabled={isLocked}
                                    value={formInputs[item.id]?.qty === '' ? '' : formInputs[item.id]?.qty}
                                    onChange={(e) => handleInputChange(item.id, 'qty', e.target.value === '' ? '' : Number(e.target.value))}
                                    className={`w-full text-right px-3 py-1.5 text-xs font-bold rounded-lg border focus:ring-2 focus:outline-none disabled:bg-slate-100 ${
                                      isOverQty
                                        ? 'border-rose-400 bg-rose-50 text-rose-700 focus:ring-rose-400'
                                        : isPermittedOver
                                        ? 'border-amber-400 bg-amber-50 text-amber-900 focus:ring-amber-400'
                                        : 'border-slate-300 bg-white text-slate-900 focus:ring-sky-500'
                                    }`}
                                  />
                                  {isOverQty && (
                                    <div className="text-[10px] font-semibold text-rose-600 leading-tight">
                                      ! ยอดส่งสูงกว่ายอดค้างส่ง
                                    </div>
                                  )}
                                  {isPermittedOver && (
                                    <div className="text-[10px] font-semibold text-amber-700 leading-tight">
                                      ⚠️ ส่งเกินยอดค้างส่ง (ได้รับอนุญาต)
                                    </div>
                                  )}
                                </div>
                              )}
                            </td>

                            {/* 10. Status */}
                            <td className="py-3 px-3 text-center align-top whitespace-nowrap">
                              {isLocked || item.status === 'supplier_responded' ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                  <Check className="w-3 h-3" />
                                  <span>ตอบกลับแล้ว</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                  <span>รอการตอบกลับ</span>
                                </span>
                              )}
                            </td>
                          </tr>

                          {/* SUB ITEMS ROWS (SPLIT ROUNDS) */}
                          {hasSubItems && subItemsList.map((sub, sIdx) => (
                            <tr key={`${item.id}-sub-${sIdx}`} className="bg-sky-50/50 border-t border-sky-100">
                              <td colSpan={7} className="py-2 px-3 text-right text-[11px] font-semibold text-sky-800">
                                ↳ งวดที่ {sIdx + 1}:
                              </td>
                              <td className="py-2 px-3">
                                <div className="relative flex items-center">
                                  <input
                                    type="text"
                                    disabled={isLocked}
                                    placeholder="วว/ดด/ปปปป"
                                    value={sub.estimate_date}
                                    onChange={(e) => handleSubItemChange(item.id, sIdx, 'estimate_date', e.target.value)}
                                    className="w-full pl-3 pr-8 py-1 text-xs font-mono bg-white border border-sky-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:outline-none disabled:bg-slate-100"
                                  />
                                  <input
                                    type="date"
                                    disabled={isLocked}
                                    className="absolute right-2 opacity-0 w-5 h-5 cursor-pointer disabled:cursor-not-allowed"
                                    onChange={(e) => {
                                      if (e.target.value) {
                                        const [y, m, d] = e.target.value.split('-');
                                        handleSubItemChange(item.id, sIdx, 'estimate_date', `${d}/${m}/${y}`);
                                      }
                                    }}
                                  />
                                  <Calendar className="w-3.5 h-3.5 text-sky-500 absolute right-2 pointer-events-none" />
                                </div>
                              </td>
                              <td className="py-2 px-3 text-right">
                                <input
                                  type="number"
                                  disabled={isLocked}
                                  placeholder="จำนวน"
                                  value={sub.quantity === '' ? '' : sub.quantity}
                                  onChange={(e) => handleSubItemChange(item.id, sIdx, 'quantity', e.target.value === '' ? '' : Number(e.target.value))}
                                  className="w-full text-right px-3 py-1 text-xs font-bold rounded-lg border border-sky-300 bg-white text-slate-900 focus:ring-2 focus:ring-sky-500 focus:outline-none disabled:bg-slate-100"
                                />
                              </td>
                              <td className="py-2 px-3 text-center">
                                {!isLocked && (
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveSubItem(item.id, sIdx)}
                                    className="p-1 rounded text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition"
                                    title="ลบรอบส่งนี้"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                          {hasSubItems && !isLocked && (
                            <tr className="bg-sky-50/30 border-t border-sky-100">
                              <td colSpan={7}></td>
                              <td colSpan={3} className="py-1.5 px-3 text-left">
                                <button
                                  type="button"
                                  onClick={() => handleAddSubItem(item.id)}
                                  className="text-[10px] text-sky-700 hover:text-sky-900 font-bold flex items-center gap-1 bg-white px-2 py-0.5 rounded border border-sky-200 shadow-2xs"
                                >
                                  <Plus className="w-3 h-3" />
                                  <span>เพิ่มงวดส่งถัดไป</span>
                                </button>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
          </div>

          {/* Action Bottom Bar */}
          {!isLocked && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 sm:p-5 bg-white rounded-2xl border border-slate-200 shadow-md">
              <div className="text-xs text-slate-500 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                <span>กรุณาตรวจสอบวันและจำนวนส่งมอบให้ครบถ้วนก่อนกดยืนยัน</span>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={(e) => handleSubmit(e, true)}
                  className="flex-1 sm:flex-none px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition border border-slate-200 disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>บันทึกชั่วคราว</span>
                </button>

                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 sm:flex-none px-6 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition shadow-md shadow-sky-500/20 disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>กำลังส่งข้อมูล...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>ยืนยันส่งข้อมูลให้ฝ่ายจัดซื้อ</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </form>
      </main>
    </div>
  );
}
