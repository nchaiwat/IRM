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
      
      // If converting from single round to split rounds for first time:
      if (currentSubs.length === 0) {
        const itemObj = portalData?.items.find((i) => i.id === itemId);
        const remQty = itemObj?.remaining_qty ?? (typeof current.qty === 'number' ? current.qty : 0);
        const half1 = Math.ceil(remQty / 2);
        const half2 = Math.max(0, remQty - half1);
        
        return {
          ...prev,
          [itemId]: {
            ...current,
            subItems: [
              { estimate_date: current.date || '', quantity: half1 },
              { estimate_date: '', quantity: half2 }
            ]
          }
        };
      }

      return {
        ...prev,
        [itemId]: {
          ...current,
          subItems: [
            ...currentSubs,
            { estimate_date: '', quantity: 0 }
          ]
        }
      };
    });
  };

  const handleCancelSplit = (itemId: number) => {
    setFormInputs((prev) => {
      const current = prev[itemId];
      if (!current) return prev;
      const firstSub = current.subItems?.[0];
      const itemObj = portalData?.items.find((i) => i.id === itemId);
      return {
        ...prev,
        [itemId]: {
          date: firstSub?.estimate_date || current.date || '',
          qty: itemObj?.remaining_qty ?? current.qty,
          subItems: []
        }
      };
    });
  };

  const handleRemoveSubItem = (itemId: number, subIndex: number) => {
    setFormInputs((prev) => {
      const current = prev[itemId];
      if (!current || !current.subItems) return prev;
      const updatedSubs = current.subItems.filter((_, idx) => idx !== subIndex);
      if (updatedSubs.length <= 1) {
        // If 1 or 0 rounds left, revert back to single round
        const first = updatedSubs[0];
        const itemObj = portalData?.items.find((i) => i.id === itemId);
        return {
          ...prev,
          [itemId]: {
            date: first?.estimate_date || current.date || '',
            qty: first?.quantity !== undefined && first?.quantity !== '' ? first.quantity : (itemObj?.remaining_qty ?? current.qty),
            subItems: []
          }
        };
      }
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
      {/* Sticky Main Header */}
      <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur text-white py-4 px-6 shadow-lg border-b border-slate-800">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center overflow-hidden shrink-0 shadow-md border border-slate-700/50">
              <img src="/logo.png" alt="IRM Logo" className="w-10 h-10 object-contain rounded-xl" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white tracking-tight">IRM Supplier Portal</h1>
              <p className="text-xs text-slate-400">ระบบระบุวันและจำนวนส่งมอบวัตถุดิบ (Window Asia PCL.)</p>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-slate-800/90 border border-slate-700/60 px-4 py-2 rounded-xl text-xs shadow-inner">
            <Building2 className="w-4 h-4 text-sky-400 shrink-0" />
            <span className="font-semibold text-slate-100">{portalData?.supplier_name}</span>
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

            <div className="overflow-auto max-h-[calc(100vh-250px)] border-t border-slate-200 shadow-inner">
              <table className="w-full text-left text-xs border-collapse min-w-[980px]">
                <thead className="bg-slate-900 text-slate-200 font-bold sticky top-0 z-20 shadow-md">
                  <tr>
                    <th className="py-3 px-2 text-center w-10 whitespace-nowrap bg-slate-900">#</th>
                    <th className="py-3 px-3 w-28 whitespace-nowrap bg-slate-900">PO</th>
                    <th className="py-3 px-3 w-24 whitespace-nowrap bg-slate-900">PO Date</th>
                    <th className="py-3 px-3 min-w-[200px] bg-slate-900">รหัสสินค้า & ชื่อสินค้า</th>
                    <th className="py-3 px-3 text-right w-24 whitespace-nowrap bg-slate-900">ยอดสั่งซื้อ</th>
                    <th className="py-3 px-3 text-right w-24 whitespace-nowrap bg-slate-900">รับแล้ว</th>
                    <th className="py-3 px-3 text-right w-24 whitespace-nowrap text-sky-300 bg-slate-950">ยอดคงเหลือ</th>
                    <th className="py-3 px-3 bg-sky-950 text-sky-300 w-44 whitespace-nowrap">ระบุวันส่งสินค้า *</th>
                    <th className="py-3 px-3 text-right bg-sky-950 text-sky-300 w-36 whitespace-nowrap">จำนวนที่ส่ง (Qty) *</th>
                    <th className="py-3 px-3 text-center w-28 whitespace-nowrap bg-slate-900">สถานะ</th>
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

                      const totalSplitQty = hasSubItems
                        ? subItemsList.reduce((acc, s) => acc + (Number(s.quantity) || 0), 0)
                        : (Number(currentVal) || 0);
                      const isSplitOverLimit = !portalData.allow_over_delivery && hasSubItems && totalSplitQty > item.remaining_qty;
                      const isSplitExceed = hasSubItems && totalSplitQty > item.remaining_qty;

                      return (
                        <tr
                          key={item.id}
                          id={`row-${item.id}`}
                          className={`border-b border-slate-100 transition-colors ${
                            index % 2 === 0 ? 'bg-white hover:bg-slate-50/80' : 'bg-slate-50/40 hover:bg-slate-100/60'
                          } ${isOverQty || isSplitOverLimit ? 'bg-rose-50/40' : ''}`}
                        >
                          <td className="py-2.5 px-2 text-center text-slate-400 font-mono text-[11px] align-top">{index + 1}</td>
                          
                          {/* PO Number */}
                          <td className="py-2.5 px-3 font-mono font-bold text-slate-800 text-[11px] align-top">
                            {isFirstInPo ? (
                              <span className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200/80 text-slate-700">
                                {item.po_number}
                              </span>
                            ) : (
                              <span className="text-slate-300 pl-3">↳</span>
                            )}
                          </td>

                          {/* PO Date */}
                          <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px] whitespace-nowrap align-top">
                            {isFirstInPo ? formatDateThai(item.po_date) : ''}
                          </td>

                          {/* Item Code & Name */}
                          <td className="py-2.5 px-3 align-top">
                            <div className="font-mono font-bold text-slate-900 text-xs">{item.item_code}</div>
                            <div className="text-slate-500 text-[11px] truncate max-w-xs">{item.item_name}</div>
                          </td>

                          {/* Quantity */}
                          <td className="py-2.5 px-3 text-right font-mono font-medium text-slate-700 align-top">
                            <div>{item.quantity?.toLocaleString()}</div>
                            <div className="text-[10px] text-slate-400">{item.unit}</div>
                          </td>

                          {/* Received Qty */}
                          <td className="py-2.5 px-3 text-right font-mono text-slate-500 align-top">
                            <div>{item.received_qty?.toLocaleString() || 0}</div>
                            <div className="text-[10px] text-slate-400">{item.unit}</div>
                          </td>

                          {/* Remaining Qty */}
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 bg-sky-50/40 align-top">
                            <div>{item.remaining_qty?.toLocaleString()}</div>
                            <div className="text-[10px] text-slate-400">{item.unit}</div>
                          </td>

                          {/* Split Rounds Card (If Split Active) OR Single Delivery Inputs */}
                          {hasSubItems ? (
                            <td colSpan={2} className="py-2 px-3 align-top">
                              <div className="bg-white p-3 rounded-xl border border-sky-300 shadow-sm space-y-2.5 max-w-md w-full">
                                <div className="flex items-center justify-between text-xs pb-1.5 border-b border-slate-100">
                                  <span className="font-bold text-slate-800 text-[11px] flex items-center gap-1">
                                    <span className="text-sky-600 font-black">📦 แตกส่ง {subItemsList.length} รอบ</span>
                                  </span>
                                  <div className="flex items-center gap-3 text-[11px]">
                                    <span className="text-slate-500 font-medium">
                                      ค้างรับ: <strong className="text-slate-800">{item.remaining_qty.toLocaleString()}</strong>
                                    </span>
                                    <span className="font-medium">
                                      ยอดรวม: <strong className={isSplitOverLimit ? 'text-rose-600 font-black' : isSplitExceed && portalData?.allow_over_delivery ? 'text-amber-600 font-black' : totalSplitQty === item.remaining_qty ? 'text-emerald-600 font-black' : 'text-amber-600 font-black'}>
                                        {totalSplitQty.toLocaleString()} {item.unit}
                                      </strong>
                                    </span>
                                  </div>
                                </div>

                                {isSplitOverLimit && (
                                  <div className="p-1.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-600 font-bold text-[10px] flex items-center justify-between">
                                    <span>⚠️ ยอดส่งรวมเกินจำนวนค้างรับ</span>
                                    <span>เกินไป +{(totalSplitQty - item.remaining_qty).toLocaleString()} {item.unit}</span>
                                  </div>
                                )}

                                <div className="space-y-1.5">
                                  {subItemsList.map((sub, sIdx) => {
                                    const isRoundInvalid = isSplitOverLimit || Number(sub.quantity) < 0;
                                    return (
                                      <div key={sIdx} className="flex items-center justify-end gap-2 text-xs">
                                        <span className="w-14 font-bold text-slate-600 text-right text-[11px]">รอบที่ {sIdx + 1}</span>
                                        
                                        {/* Date Input with showPicker trigger */}
                                        <div className="relative flex items-center">
                                          <input
                                            type="text"
                                            disabled={isLocked}
                                            placeholder="วว/ดด/ปปปป"
                                            value={sub.estimate_date}
                                            onChange={(e) => handleSubItemChange(item.id, sIdx, 'estimate_date', e.target.value)}
                                            maxLength={10}
                                            className="w-32 pl-2.5 pr-8 py-1 rounded-lg border border-slate-300 text-xs font-mono focus:border-sky-500 focus:ring-1 focus:ring-sky-500 bg-white placeholder-slate-400 outline-none"
                                          />
                                          <input
                                            type="date"
                                            tabIndex={-1}
                                            disabled={isLocked}
                                            className="sr-only"
                                            onChange={(e) => {
                                              if (e.target.value) {
                                                const [y, m, d] = e.target.value.split('-');
                                                handleSubItemChange(item.id, sIdx, 'estimate_date', `${d}/${m}/${y}`);
                                              }
                                            }}
                                          />
                                          <button
                                            type="button"
                                            disabled={isLocked}
                                            onClick={(e) => {
                                              const parent = e.currentTarget.parentElement;
                                              const dateInput = parent?.querySelector('input[type="date"]') as HTMLInputElement;
                                              if (dateInput) {
                                                if ('showPicker' in HTMLInputElement.prototype) {
                                                  dateInput.showPicker();
                                                } else {
                                                  dateInput.focus();
                                                }
                                              }
                                            }}
                                            className="p-1 text-slate-400 hover:text-sky-600 absolute right-1.5 top-1/2 -translate-y-1/2 transition z-20 cursor-pointer disabled:cursor-not-allowed"
                                            title="คลิกเพื่อเปิดปฏิทิน"
                                          >
                                            <Calendar className="w-3.5 h-3.5" />
                                          </button>
                                        </div>

                                        {/* Qty Input with dynamic red/white highlight */}
                                        <input
                                          type="number"
                                          min="0"
                                          disabled={isLocked}
                                          placeholder="จำนวน"
                                          value={sub.quantity === '' ? '' : sub.quantity}
                                          onChange={(e) => handleSubItemChange(item.id, sIdx, 'quantity', e.target.value === '' ? '' : parseFloat(e.target.value))}
                                          className={`w-24 px-2.5 py-1 rounded-lg border text-right text-xs font-mono font-bold transition outline-none ${
                                            isRoundInvalid
                                              ? 'border-rose-400 bg-rose-50 text-rose-700 focus:border-rose-500 focus:ring-1 focus:ring-rose-500'
                                              : 'border-slate-300 bg-white text-slate-800 focus:border-sky-500 focus:ring-1 focus:ring-sky-500'
                                          }`}
                                        />

                                        {/* Delete round button */}
                                        {!isLocked && (
                                          <button
                                            type="button"
                                            onClick={() => handleRemoveSubItem(item.id, sIdx)}
                                            className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                                            title="ลบรอบนี้"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>

                                {!isLocked && (
                                  <div className="pt-1.5 flex items-center justify-between border-t border-slate-100 text-xs">
                                    <button
                                      type="button"
                                      onClick={() => handleAddSubItem(item.id)}
                                      className="text-[11px] text-sky-700 hover:text-sky-900 font-bold flex items-center gap-1 hover:underline"
                                    >
                                      <Plus className="w-3.5 h-3.5 text-sky-600" />
                                      <span>+ เพิ่มรอบส่ง</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleCancelSplit(item.id)}
                                      className="text-[11px] text-slate-400 hover:text-slate-600"
                                    >
                                      ยกเลิกแตกส่ง
                                    </button>
                                  </div>
                                )}
                              </div>
                            </td>
                          ) : (
                            <>
                              {/* Single Delivery Date Input */}
                              <td className="py-2.5 px-3 align-top">
                                {isLocked ? (
                                  <div className="font-mono text-slate-700 text-xs">
                                    {formInputs[item.id]?.date || '-'}
                                  </div>
                                ) : (
                                  <div className="relative flex items-center">
                                    <input
                                      type="text"
                                      placeholder="วว/ดด/ปปปป"
                                      value={formInputs[item.id]?.date || ''}
                                      onChange={(e) => handleInputChange(item.id, 'date', e.target.value)}
                                      maxLength={10}
                                      className="w-full pl-2.5 pr-8 py-1.5 rounded-lg border border-slate-300 text-xs font-mono focus:border-sky-500 focus:ring-1 focus:ring-sky-500 bg-white placeholder-slate-400 transition"
                                    />
                                    <input
                                      type="date"
                                      tabIndex={-1}
                                      className="sr-only"
                                      onChange={(e) => {
                                        if (e.target.value) {
                                          const [y, m, d] = e.target.value.split('-');
                                          handleInputChange(item.id, 'date', `${d}/${m}/${y}`);
                                        }
                                      }}
                                    />
                                    <button
                                      type="button"
                                      disabled={isLocked}
                                      onClick={(e) => {
                                        const parent = e.currentTarget.parentElement;
                                        const dateInput = parent?.querySelector('input[type="date"]') as HTMLInputElement;
                                        if (dateInput) {
                                          if ('showPicker' in HTMLInputElement.prototype) {
                                            dateInput.showPicker();
                                          } else {
                                            dateInput.focus();
                                          }
                                        }
                                      }}
                                      className="p-1 text-slate-400 hover:text-sky-600 absolute right-1.5 top-1/2 -translate-y-1/2 transition z-20 cursor-pointer"
                                      title="คลิกเพื่อเปิดปฏิทิน"
                                    >
                                      <Calendar className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                )}
                                {!isLocked && (
                                  <div className="mt-1 flex items-center gap-1.5 text-[10px]">
                                    <button
                                      type="button"
                                      onClick={() => handleAddSubItem(item.id)}
                                      className="text-sky-600 hover:text-sky-800 font-semibold flex items-center gap-0.5 hover:underline"
                                    >
                                      <span>↳ แตกส่งหลายงวด (Split)</span>
                                    </button>
                                  </div>
                                )}
                              </td>

                              {/* Single Delivery Qty Input */}
                              <td className="py-2.5 px-3 text-right align-top">
                                {isLocked ? (
                                  <div className="font-mono font-bold text-slate-800 text-xs">
                                    {formInputs[item.id]?.qty?.toLocaleString() || '-'}
                                  </div>
                                ) : (
                                  <div>
                                    <input
                                      type="number"
                                      min="0"
                                      max={portalData.allow_over_delivery ? undefined : item.remaining_qty}
                                      value={formInputs[item.id]?.qty ?? ''}
                                      onChange={(e) => handleInputChange(item.id, 'qty', e.target.value === '' ? '' : parseFloat(e.target.value))}
                                      className={`w-full px-2.5 py-1.5 rounded-lg border text-right text-xs font-mono font-bold focus:ring-1 transition ${
                                        isOverQty
                                          ? 'border-rose-400 text-rose-600 focus:border-rose-500 focus:ring-rose-500 bg-rose-50'
                                          : 'border-slate-300 text-slate-800 focus:border-sky-500 focus:ring-sky-500 bg-white'
                                      }`}
                                    />
                                    {isOverQty && (
                                      <div className="text-[10px] text-rose-600 mt-0.5 text-right font-medium">
                                        ห้ามส่งเกินยอดคงเหลือ ({item.remaining_qty})
                                      </div>
                                    )}
                                  </div>
                                )}
                              </td>
                            </>
                          )}

                          {/* Status */}
                          <td className="py-2.5 px-3 text-center align-top">
                            {isLocked ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                ยืนยันแล้ว
                              </span>
                            ) : (formInputs[item.id]?.date && formInputs[item.id]?.qty) || hasSubItems ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-800 border border-sky-200">
                                กรอกแล้ว
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                รอการตอบกลับ
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
          </div>

          {/* Sticky Action Bottom Bar */}
          {!isLocked && (
            <div className="sticky bottom-4 z-30 flex flex-col sm:flex-row items-center justify-between gap-4 p-4 sm:p-5 bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200 shadow-2xl">
              <div className="text-xs text-slate-600 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></span>
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
