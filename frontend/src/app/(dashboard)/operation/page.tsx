'use client';

import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { api } from '@/lib/api';
import { POItemResponse } from '@/types';
import { useAuth } from '@/lib/auth-context';
import {
  ClipboardList,
  Calendar as CalendarIcon,
  CheckCircle2,
  Clock,
  UserCheck,
  Building2,
  History,
  Plus,
  Edit,
  Check,
  AlertCircle,
  Search,
  Trash2,
  Trash,
  Layers,
  Lock,
  Unlock,
  AlertTriangle,
  Filter,
  CheckCircle,
  Clock3,
  Sparkles,
  Copy,
  Link as LinkIcon,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

type FilterTab =
  | 'all'
  | 'new_today'
  | 'unconfirmed'
  | 'confirmed'
  | 'split_delivery'
  | 'over_po'
  | 'overdue'
  | 'due_7d'
  | 'due_3d'
  | 'awaiting_sup';

export default function OperationPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<POItemResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(100);

  // Debounce search term by 200ms to eliminate UI stuttering during typing
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 200);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // Reset pagination when search or tab changes
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, activeTab]);

  // Lazy Loaded Audit Logs state
  const [modalAuditLogs, setModalAuditLogs] = useState<any[]>([]);
  const [loadingAuditLogs, setLoadingAuditLogs] = useState(false);
  
  // Dual Scrollbar Refs for small screens (14"+)
  const topScrollRef = useRef<HTMLDivElement>(null);
  const mainTableRef = useRef<HTMLDivElement>(null);
  const [tableScrollWidth, setTableScrollWidth] = useState<number>(1400);

  // Edit Main Item Modal
  const [showEditModal, setShowEditModal] = useState<POItemResponse | null>(null);
  const [estDate, setEstDate] = useState('');
  const [estQty, setEstQty] = useState<number>(0);
  const [subItems, setSubItems] = useState<{ estimate_date: string; quantity: number | '' }[]>([]);

  // Edit Single Sub Item Modal
  const [showEditSubItem, setShowEditSubItem] = useState<{
    sub_id: number;
    parent_item: POItemResponse;
    estimate_date: string;
    quantity: number;
  } | null>(null);

  // History modal
  const [showHistoryModal, setShowHistoryModal] = useState<POItemResponse | null>(null);

  // Force Override Modal State (Problem 1: Conflict Prevention)
  const [forceOverrideModal, setForceOverrideModal] = useState<{
    isOpen: boolean;
    item: POItemResponse | null;
    reason: string;
    pendingPayload?: any;
    isSubItem?: boolean;
    subItemId?: number;
  }>({
    isOpen: false,
    item: null,
    reason: '',
  });

  // Inline Sub-Item Expansion State for Splitting
  const [expandedSubItemRow, setExpandedSubItemRow] = useState<number | null>(null);
  const [inlineSubItems, setInlineSubItems] = useState<{ estimate_date: string; quantity: number | '' }[]>([]);

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchItems();
  }, []);

  // Sync scroll between Top Scrollbar and Table container
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

  // Update table width measurement when items load
  useEffect(() => {
    if (mainTableRef.current) {
      const scrollW = mainTableRef.current.scrollWidth;
      setTableScrollWidth(scrollW > 1200 ? scrollW : 1400);
    }
  }, [items, loading]);

  const fetchItems = async () => {
    try {
      const res = await api.get<POItemResponse[]>('/api/operation');
      setItems(res.data);
    } catch (err) {
      console.error('Failed to fetch operation items:', err);
    } finally {
      setLoading(false);
    }
  };

  const isSupplierLocked = (item: POItemResponse) => {
    if (item.locked_by === 'supplier' && item.lock_expires_at) {
      const expiry = new Date(item.lock_expires_at);
      return expiry > new Date();
    }
    return false;
  };

  const isRecordModified = (item: POItemResponse): boolean => {
    return (
      item.status === 'confirmed' ||
      item.status === 'supplier_responded' ||
      (item.sub_items && item.sub_items.length > 0 && item.status === 'confirmed') ||
      (item.updated_by_name !== null && item.updated_by_name !== '')
    );
  };

  // Helper date getters and condition checkers
  const getItemTargetDate = (item: POItemResponse): Date | null => {
    if (item.sub_items && item.sub_items.length > 0) {
      const dates = item.sub_items
        .map((s) => (s.estimate_date ? new Date(s.estimate_date) : null))
        .filter((d): d is Date => d !== null && !isNaN(d.getTime()));
      if (dates.length > 0) {
        return new Date(Math.min(...dates.map((d) => d.getTime())));
      }
    }
    if (item.estimate_date) {
      const d = new Date(item.estimate_date);
      if (!isNaN(d.getTime())) return d;
    }
    if (item.due_date) {
      const d = new Date(item.due_date);
      if (!isNaN(d.getTime())) return d;
    }
    return null;
  };

  const isOverdue = (item: POItemResponse, todayTime: number): boolean => {
    const d = getItemTargetDate(item);
    if (!d) return false;
    const itemDate = new Date(d);
    itemDate.setHours(0, 0, 0, 0);
    return itemDate.getTime() < todayTime;
  };

  const isDueWithinDays = (item: POItemResponse, todayTime: number, days: number): boolean => {
    const d = getItemTargetDate(item);
    if (!d) return false;
    const itemDate = new Date(d);
    itemDate.setHours(0, 0, 0, 0);
    const diffDays = Math.round((itemDate.getTime() - todayTime) / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= days;
  };

  const isOverPO = (item: POItemResponse): boolean => {
    const isModified = isRecordModified(item);
    const poQty = item.quantity || 0;
    const received = item.received_qty || 0;
    const remaining = item.remaining_qty || 0;

    // 1. If item has split deliveries (sub items)
    if (item.sub_items && item.sub_items.length > 0) {
      const totalSub = item.sub_items.reduce((sum, s) => sum + (Number(s.quantity) || 0), 0);
      if (received + totalSub > poQty || totalSub > remaining) {
        return true;
      }
    }

    // 2. Single item check: only consider over-delivery if the item was modified/confirmed
    // and the entered estimate exceeds remaining or (received + estimate) exceeds total PO quantity
    if (isModified || item.status === 'confirmed') {
      const est = item.estimate_qty || 0;
      if (est > remaining || (received + est > poQty && est > 0)) {
        return true;
      }
    }

    return false;
  };

  const isSplitDelivery = (item: POItemResponse): boolean => {
    return Boolean(item.sub_items && item.sub_items.length > 1);
  };

  const isAwaitingSup = (item: POItemResponse): boolean => {
    return (
      item.status === 'awaiting_supplier' ||
      item.status === 'supplier_responded' ||
      isSupplierLocked(item)
    );
  };

  // Tab Filtering & Search (Memoized with Debounced Search)
  const filteredItems = useMemo(() => {
    const searchLower = debouncedSearch.trim().toLowerCase();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTime = today.getTime();

    return items.filter((i) => {
      if (searchLower) {
        const matchesSearch =
          i.po_number.toLowerCase().includes(searchLower) ||
          i.item_code.toLowerCase().includes(searchLower) ||
          i.item_name.toLowerCase().includes(searchLower) ||
          i.supplier_name.toLowerCase().includes(searchLower) ||
          i.supplier_code.toLowerCase().includes(searchLower);

        if (!matchesSearch) return false;
      }

      if (activeTab === 'new_today') {
        return i.is_new === true;
      }
      if (activeTab === 'unconfirmed') {
        return i.is_new === false && i.status !== 'confirmed';
      }
      if (activeTab === 'confirmed') {
        return i.status === 'confirmed';
      }
      if (activeTab === 'split_delivery') {
        return isSplitDelivery(i);
      }
      if (activeTab === 'over_po') {
        return isOverPO(i);
      }
      if (activeTab === 'overdue') {
        return isOverdue(i, todayTime);
      }
      if (activeTab === 'due_7d') {
        return isDueWithinDays(i, todayTime, 7);
      }
      if (activeTab === 'due_3d') {
        return isDueWithinDays(i, todayTime, 3);
      }
      if (activeTab === 'awaiting_sup') {
        return isAwaitingSup(i);
      }
      return true;
    });
  }, [items, debouncedSearch, activeTab]);

  // Calculate Tab Counts (Memoized on items list change)
  const {
    countAll,
    countNewToday,
    countUnconfirmed,
    countConfirmed,
    countSplitDelivery,
    countOverPO,
    countOverdue,
    countDue7d,
    countDue3d,
    countAwaitingSup,
  } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTime = today.getTime();

    let newToday = 0;
    let unconfirmed = 0;
    let confirmed = 0;
    let split = 0;
    let overPO = 0;
    let overdue = 0;
    let due7d = 0;
    let due3d = 0;
    let awaitingSup = 0;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.is_new === true) newToday++;
      if (item.is_new === false && item.status !== 'confirmed') unconfirmed++;
      if (item.status === 'confirmed') confirmed++;
      if (isSplitDelivery(item)) split++;
      if (isOverPO(item)) overPO++;
      if (isOverdue(item, todayTime)) overdue++;
      if (isDueWithinDays(item, todayTime, 7)) due7d++;
      if (isDueWithinDays(item, todayTime, 3)) due3d++;
      if (isAwaitingSup(item)) awaitingSup++;
    }

    return {
      countAll: items.length,
      countNewToday: newToday,
      countUnconfirmed: unconfirmed,
      countConfirmed: confirmed,
      countSplitDelivery: split,
      countOverPO: overPO,
      countOverdue: overdue,
      countDue7d: due7d,
      countDue3d: due3d,
      countAwaitingSup: awaitingSup,
    };
  }, [items]);

  const cleanBuyerName = (name: string | null | undefined) => {
    if (!name) return '-';
    const stripped = name.replace(/^b\s*-\s*/i, '').trim();
    return stripped.split(/\s+/)[0] || stripped;
  };

  const formatDateThai = (isoStr: string | null | undefined) => {
    if (!isoStr) return '';
    const d = new Date(isoStr);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const formatUpdatedBy = (name: string | null | undefined, type: string | null | undefined) => {
    if (!name) return 'ยังไม่อัปเดต';
    if (type === 'supplier') {
      return 'Supplier';
    }
    const clean = name.replace(/\s*\(Accepted Supplier\)/gi, '');
    if (clean === 'System Administrator') return 'admin';
    if (clean === 'พัชชา สุขสวัสดิ์') return 'patcha';
    if (clean === 'ภิญญดา สุขสวัสดิ์') return 'pinyada';
    return clean;
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
    if (day < 1 || day > 31 || month < 1 || month > 12 || year < 2000) return null;
    
    const d = new Date(year, month - 1, day, 12, 0, 0);
    return d.toISOString();
  };

  const handleOpenInlineSubItem = (item: POItemResponse) => {
    if (expandedSubItemRow === item.id) {
      setExpandedSubItemRow(null);
    } else {
      setExpandedSubItemRow(item.id);
      setInlineSubItems(
        item.sub_items.length > 0
          ? item.sub_items.map((s) => ({ estimate_date: formatDateThai(s.estimate_date), quantity: s.quantity }))
          : [
              {
                estimate_date: item.estimate_date ? formatDateThai(item.estimate_date) : '',
                quantity: item.estimate_qty || item.remaining_qty,
              },
              { estimate_date: '', quantity: 0 },
            ]
      );
    }
  };

  const handleSaveInlineSubItems = async (item: POItemResponse, forceOverride: boolean = false, reason: string = '') => {
    const activeSubItems = inlineSubItems.filter((s) => s.estimate_date && Number(s.quantity) > 0);
    const totalSubQty = activeSubItems.reduce((acc, curr) => acc + Number(curr.quantity), 0);

    for (const sub of activeSubItems) {
      if (!parseDateInput(sub.estimate_date)) {
        alert(`⚠️ รูปแบบวันที่ "${sub.estimate_date}" ไม่ถูกต้อง\nกรุณากรอกเป็น วัน/เดือน/ปี เช่น 27/08/2026`);
        return;
      }
    }

    if (!item.allow_over_delivery && totalSubQty > item.remaining_qty) {
      alert(
        `⚠️ ไม่สามารถบันทึกได้!\n\nจำนวนส่งรวมทุกรอบ (${totalSubQty.toLocaleString()} ${item.unit}) เกินกว่าจำนวนสินค้าที่ยังค้างรับ (${item.remaining_qty.toLocaleString()} ${item.unit})\n\nกรุณาปรับจำนวนให้พอดีหรือไม่เกินจำนวนค้างรับ`
      );
      return;
    }

    if (isSupplierLocked(item) && !forceOverride) {
      setForceOverrideModal({
        isOpen: true,
        item: item,
        reason: '',
        pendingPayload: {
          estimate_date: activeSubItems.length > 0 ? parseDateInput(activeSubItems[0].estimate_date) : item.estimate_date,
          estimate_qty: totalSubQty,
          sub_items: activeSubItems.map((s) => ({
            estimate_date: parseDateInput(s.estimate_date)!,
            quantity: Number(s.quantity),
          })),
        },
        isSubItem: false,
      });
      return;
    }

    setSubmitting(true);
    try {
      const parsedSubs = activeSubItems.map((s) => ({
        estimate_date: parseDateInput(s.estimate_date)!,
        quantity: Number(s.quantity),
      }));

      await api.put(`/api/operation/${item.id}`, {
        estimate_date: parsedSubs.length > 0 ? parsedSubs[0].estimate_date : item.estimate_date,
        estimate_qty: totalSubQty,
        sub_items: parsedSubs,
        force_override: forceOverride,
        override_reason: reason,
      });
      setExpandedSubItemRow(null);
      setForceOverrideModal({ isOpen: false, item: null, reason: '' });
      fetchItems();
    } catch (err: any) {
      if (err.response?.status === 409) {
        setForceOverrideModal({
          isOpen: true,
          item: item,
          reason: '',
          pendingPayload: {
            estimate_date: activeSubItems.length > 0 ? parseDateInput(activeSubItems[0].estimate_date) : item.estimate_date,
            estimate_qty: totalSubQty,
            sub_items: activeSubItems.map((s) => ({
              estimate_date: parseDateInput(s.estimate_date)!,
              quantity: Number(s.quantity),
            })),
          },
          isSubItem: false,
        });
      } else {
        alert(err.response?.data?.detail || 'เกิดข้อผิดพลาดในการปรับปรุงรอบส่ง');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenEdit = (item: POItemResponse) => {
    setShowEditModal(item);
    setEstDate(item.estimate_date ? formatDateThai(item.estimate_date) : '');
    setEstQty(item.estimate_qty || item.remaining_qty);
    setSubItems(
      item.sub_items.map((sub) => ({
        estimate_date: formatDateThai(sub.estimate_date),
        quantity: sub.quantity,
      }))
    );
  };

  const handleSaveEdit = async (e?: React.FormEvent, forceOverride: boolean = false, reason: string = '') => {
    if (e) e.preventDefault();
    if (!showEditModal) return;

    const parsedEstDate = parseDateInput(estDate);
    if (estDate && !parsedEstDate) {
      alert(`⚠️ รูปแบบวันที่ "${estDate}" ไม่ถูกต้อง\nกรุณากรอกเป็น วัน/เดือน/ปี เช่น 27/08/2026`);
      return;
    }

    const activeSubItems = subItems.filter((s) => s.estimate_date && Number(s.quantity) > 0);
    for (const sub of activeSubItems) {
      if (!parseDateInput(sub.estimate_date)) {
        alert(`⚠️ รูปแบบวันที่ "${sub.estimate_date}" ไม่ถูกต้อง\nกรุณากรอกเป็น วัน/เดือน/ปี เช่น 27/08/2026`);
        return;
      }
    }

    const totalQty = activeSubItems.length > 0 ? activeSubItems.reduce((acc, curr) => acc + Number(curr.quantity), 0) : estQty;

    if (!showEditModal.allow_over_delivery && totalQty > showEditModal.remaining_qty) {
      alert(
        `⚠️ ไม่สามารถบันทึกได้!\n\nจำนวนส่ง (${totalQty.toLocaleString()} ${showEditModal.unit}) เกินกว่าจำนวนสินค้าที่ยังค้างรับ (${showEditModal.remaining_qty.toLocaleString()} ${showEditModal.unit})\n\nกรุณาปรับจำนวนให้พอดีหรือไม่เกินจำนวนค้างรับ`
      );
      return;
    }

    if (isSupplierLocked(showEditModal) && !forceOverride) {
      setForceOverrideModal({
        isOpen: true,
        item: showEditModal,
        reason: '',
        pendingPayload: {
          estimate_date: parsedEstDate,
          estimate_qty: estQty,
          sub_items: activeSubItems.map((s) => ({
            estimate_date: parseDateInput(s.estimate_date)!,
            quantity: Number(s.quantity),
          })),
        },
        isSubItem: false,
      });
      return;
    }

    setSubmitting(true);
    try {
      await api.put(`/api/operation/${showEditModal.id}`, {
        estimate_date: parsedEstDate,
        estimate_qty: estQty,
        sub_items: activeSubItems.map((s) => ({
          estimate_date: parseDateInput(s.estimate_date)!,
          quantity: Number(s.quantity),
        })),
        force_override: forceOverride,
        override_reason: reason,
      });
      setShowEditModal(null);
      setForceOverrideModal({ isOpen: false, item: null, reason: '' });
      fetchItems();
    } catch (err: any) {
      if (err.response?.status === 409) {
        setForceOverrideModal({
          isOpen: true,
          item: showEditModal,
          reason: '',
          pendingPayload: {
            estimate_date: parsedEstDate,
            estimate_qty: estQty,
            sub_items: activeSubItems.map((s) => ({
              estimate_date: parseDateInput(s.estimate_date)!,
              quantity: Number(s.quantity),
            })),
          },
          isSubItem: false,
        });
      } else {
        alert(err.response?.data?.detail || 'เกิดข้อผิดพลาดในการปรับปรุงข้อมูล');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmForceOverride = async () => {
    if (!forceOverrideModal.item || !forceOverrideModal.pendingPayload) return;
    if (!forceOverrideModal.reason.trim()) {
      alert('กรุณาระบุเหตุผลในการ Force Edit เพื่อบันทึกในประวัติ Audit Log');
      return;
    }

    setSubmitting(true);
    try {
      await api.put(`/api/operation/${forceOverrideModal.item.id}`, {
        ...forceOverrideModal.pendingPayload,
        force_override: true,
        override_reason: forceOverrideModal.reason.trim(),
      });
      setForceOverrideModal({ isOpen: false, item: null, reason: '' });
      setShowEditModal(null);
      setExpandedSubItemRow(null);
      fetchItems();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'เกิดข้อผิดพลาดในการ Force Edit');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenEditSubItem = (subId: number, subDate: string, subQty: number, parent: POItemResponse) => {
    setShowEditSubItem({
      sub_id: subId,
      parent_item: parent,
      estimate_date: formatDateThai(subDate),
      quantity: subQty,
    });
  };

  const handleSaveSubItemEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showEditSubItem) return;

    const parsedDate = parseDateInput(showEditSubItem.estimate_date);
    if (!parsedDate) {
      alert(`⚠️ รูปแบบวันที่ "${showEditSubItem.estimate_date}" ไม่ถูกต้อง\nกรุณากรอกเป็น วัน/เดือน/ปี เช่น 27/08/2026`);
      return;
    }

    const parent = showEditSubItem.parent_item;
    const otherSubItemsQty = parent.sub_items
      .filter((s) => s.id !== showEditSubItem.sub_id)
      .reduce((sum, s) => sum + s.quantity, 0);

    const totalQty = otherSubItemsQty + showEditSubItem.quantity;

    if (!parent.allow_over_delivery && totalQty > parent.remaining_qty) {
      alert(
        `⚠️ ไม่สามารถบันทึกได้!\n\nจำนวนส่งรวมรอบนี้ (${totalQty.toLocaleString()} ${parent.unit}) เกินกว่าจำนวนสินค้าที่ยังค้างรับ (${parent.remaining_qty.toLocaleString()} ${parent.unit})`
      );
      return;
    }

    setSubmitting(true);
    try {
      await api.put(`/api/operation/sub-items/${showEditSubItem.sub_id}`, {
        estimate_date: parsedDate,
        quantity: showEditSubItem.quantity,
      });
      setShowEditSubItem(null);
      fetchItems();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'เกิดข้อผิดพลาดในการแก้ไขรอบย่อย');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteSubItem = async (subId: number) => {
    if (!confirm('คุณแน่ใจหรือไม่ที่จะลบรอบการจัดส่งย่อยนี้?')) return;
    try {
      await api.delete(`/api/operation/sub-items/${subId}`);
      fetchItems();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'เกิดข้อผิดพลาดในการลบรอบย่อย');
    }
  };

  // Copy Link and Unlock Handlers
  const [copiedItemId, setCopiedItemId] = useState<number | null>(null);

  const handleUnlockItem = async (itemId: number) => {
    try {
      const res = await api.post<POItemResponse>(`/api/operation/items/${itemId}/unlock`);
      setItems((prev) => prev.map((it) => (it.id === itemId ? res.data : it)));
    } catch (err: any) {
      alert(err.response?.data?.detail || 'เกิดข้อผิดพลาดในการปลดล็อค');
    }
  };

  const handleLockItem = async (itemId: number) => {
    try {
      const res = await api.post<POItemResponse>(`/api/operation/items/${itemId}/lock`);
      setItems((prev) => prev.map((it) => (it.id === itemId ? res.data : it)));
    } catch (err: any) {
      alert(err.response?.data?.detail || 'เกิดข้อผิดพลาดในการล็อคให้ Supplier');
    }
  };

  const handleCopyItemPortalLink = async (itemId: number) => {
    try {
      const res = await api.get<{ portal_url: string }>(`/api/operation/items/${itemId}/portal-link`);
      navigator.clipboard.writeText(res.data.portal_url);
      setCopiedItemId(itemId);
      setTimeout(() => setCopiedItemId(null), 2000);
    } catch (err: any) {
      alert('ไม่สามารถดึงลิงก์ Portal ได้');
    }
  };

  const handleOpenHistoryModal = async (item: POItemResponse) => {
    setShowHistoryModal(item);
    setLoadingAuditLogs(true);
    setModalAuditLogs(item.audit_logs || []);
    try {
      const res = await api.get<any[]>(`/api/operation/items/${item.id}/audit-logs`);
      setModalAuditLogs(res.data);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoadingAuditLogs(false);
    }
  };

  const handleAcceptSupplier = async (itemId: number) => {
    try {
      await api.post(`/api/operation/${itemId}/accept-supplier`);
      fetchItems();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'เกิดข้อผิดพลาดในการยืนยันข้อมูล Supplier');
    }
  };

  const handleConfirmItem = async (itemId: number) => {
    try {
      await api.post(`/api/operation/${itemId}/confirm`);
      fetchItems();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'เกิดข้อผิดพลาดในการยืนยันรายการ');
    }
  };

  // Paginated Sliced Items for High Performance Rendering
  const totalPages = useMemo(() => {
    if (pageSize === 0) return 1;
    return Math.ceil(filteredItems.length / pageSize) || 1;
  }, [filteredItems.length, pageSize]);

  const paginatedItems = useMemo(() => {
    if (pageSize === 0) return filteredItems;
    const startIndex = (currentPage - 1) * pageSize;
    return filteredItems.slice(startIndex, startIndex + pageSize);
  }, [filteredItems, currentPage, pageSize]);

  const getStatusBadge = (item: POItemResponse) => {
    const isLocked = isSupplierLocked(item);

    if (item.status === 'confirmed') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 whitespace-nowrap shadow-2xs">
          <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
          <span>ยืนยันแล้ว</span>
        </span>
      );
    }
    if (item.status === 'supplier_responded') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500 text-white shadow-sm animate-pulse whitespace-nowrap">
          <Building2 className="w-2.5 h-2.5" />
          <span>Sup ตอบกลับ</span>
        </span>
      );
    }
    if (item.status === 'awaiting_supplier' || isLocked) {
      const expDate = item.lock_expires_at ? formatDateThai(item.lock_expires_at) : '';
      return (
        <span 
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-sky-100 text-sky-800 border border-sky-300 whitespace-nowrap"
          title={expDate ? `Supplier กำลังเปิดกรอกข้อมูลถึง ${expDate}` : 'รอ Supplier ตอบกลับ'}
        >
          <Lock className="w-2.5 h-2.5 text-sky-600" />
          <span>รอ Sup ตอบ</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-500 border border-dashed border-slate-300 whitespace-nowrap">
        <Clock3 className="w-2.5 h-2.5 text-slate-400" />
        <span>รอ PU ยืนยัน</span>
      </span>
    );
  };

  return (
    <div className="space-y-4">
      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-sky-600" />
            <span>Operation (รายการติดตามรับวัตถุดิบจาก SAP)</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            ตารางจัดการรอบส่งสินค้า — มีแถบไฮไลท์สีแยกชัดเจนระหว่าง <strong>รายการที่ปรับเปลี่ยนแล้ว</strong>, <strong>รายการมาใหม่วันนี้</strong> และ <strong>รายการที่ยังไม่ปรับเปลี่ยน</strong>
          </p>
        </div>
      </div>

      {/* FILTER TABS & SEARCH BAR */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm space-y-3">
        {/* Quick Filter Tabs */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-1.5 p-1 bg-slate-100/90 rounded-xl border border-slate-200 overflow-x-auto max-w-full scrollbar-thin flex-nowrap">
            {/* 1. ทั้งหมด */}
            <button
              onClick={() => setActiveTab('all')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                activeTab === 'all'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>ทั้งหมด</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                activeTab === 'all' ? 'bg-slate-200 text-slate-800' : 'bg-slate-200/60 text-slate-600'
              }`}>
                {countAll}
              </span>
            </button>

            {/* 2. มาใหม่วันนี้ */}
            <button
              onClick={() => setActiveTab('new_today')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                activeTab === 'new_today'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-indigo-700 bg-indigo-50/80 hover:bg-indigo-100 border border-indigo-200'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>มาใหม่วันนี้</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                activeTab === 'new_today' ? 'bg-indigo-700 text-white' : 'bg-indigo-200 text-indigo-900'
              }`}>
                {countNewToday}
              </span>
            </button>

            {/* 3. ยังไม่ยืนยัน */}
            <button
              onClick={() => setActiveTab('unconfirmed')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                activeTab === 'unconfirmed'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-700 bg-slate-200/70 hover:bg-slate-200 border border-slate-300'
              }`}
            >
              <Clock3 className="w-3.5 h-3.5 text-slate-400" />
              <span>ยังไม่ยืนยัน</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                activeTab === 'unconfirmed' ? 'bg-slate-900 text-white' : 'bg-slate-300 text-slate-800'
              }`}>
                {countUnconfirmed}
              </span>
            </button>

            {/* 4. ยืนยันแล้ว */}
            <button
              onClick={() => setActiveTab('confirmed')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                activeTab === 'confirmed'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200'
              }`}
            >
              <CheckCircle className="w-3.5 h-3.5" />
              <span>ยืนยันแล้ว</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                activeTab === 'confirmed' ? 'bg-emerald-700 text-white' : 'bg-emerald-100 text-emerald-800'
              }`}>
                {countConfirmed}
              </span>
            </button>

            {/* 5. แบ่งการส่ง */}
            <button
              onClick={() => setActiveTab('split_delivery')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                activeTab === 'split_delivery'
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>แบ่งการส่ง</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                activeTab === 'split_delivery' ? 'bg-sky-700 text-white' : 'bg-sky-100 text-sky-800'
              }`}>
                {countSplitDelivery}
              </span>
            </button>

            {/* 6. ส่งเกิน PO */}
            <button
              onClick={() => setActiveTab('over_po')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                activeTab === 'over_po'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-300'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
              <span>ส่งเกิน PO</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                activeTab === 'over_po' ? 'bg-amber-700 text-white' : 'bg-amber-200 text-amber-900'
              }`}>
                {countOverPO}
              </span>
            </button>

            {/* 7. เกินกำหนด */}
            <button
              onClick={() => setActiveTab('overdue')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                activeTab === 'overdue'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200'
              }`}
            >
              <AlertCircle className="w-3.5 h-3.5" />
              <span>เกินกำหนด</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                activeTab === 'overdue' ? 'bg-rose-700 text-white' : 'bg-rose-100 text-rose-800'
              }`}>
                {countOverdue}
              </span>
            </button>

            {/* 8. ถึงใน 7 วัน */}
            <button
              onClick={() => setActiveTab('due_7d')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                activeTab === 'due_7d'
                  ? 'bg-yellow-600 text-white shadow-sm'
                  : 'text-yellow-800 bg-yellow-50 hover:bg-yellow-100 border border-yellow-300'
              }`}
            >
              <CalendarIcon className="w-3.5 h-3.5" />
              <span>ถึงใน 7 วัน</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                activeTab === 'due_7d' ? 'bg-yellow-700 text-white' : 'bg-yellow-100 text-yellow-900'
              }`}>
                {countDue7d}
              </span>
            </button>

            {/* 9. ถึงใน 3 วัน */}
            <button
              onClick={() => setActiveTab('due_3d')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                activeTab === 'due_3d'
                  ? 'bg-orange-600 text-white shadow-sm'
                  : 'text-orange-800 bg-orange-50 hover:bg-orange-100 border border-orange-200'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>ถึงใน 3 วัน</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                activeTab === 'due_3d' ? 'bg-orange-700 text-white' : 'bg-orange-100 text-orange-900'
              }`}>
                {countDue3d}
              </span>
            </button>

            {/* 10. รอ Sup ยืนยัน */}
            <button
              onClick={() => setActiveTab('awaiting_sup')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                activeTab === 'awaiting_sup'
                  ? 'bg-cyan-700 text-white shadow-sm'
                  : 'text-cyan-800 bg-cyan-50 hover:bg-cyan-100 border border-cyan-300'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>รอ Sup ยืนยัน</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                activeTab === 'awaiting_sup' ? 'bg-cyan-800 text-white' : 'bg-cyan-100 text-cyan-900'
              }`}>
                {countAwaitingSup}
              </span>
            </button>
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
            <span className="flex items-center gap-1 font-semibold text-indigo-700">
              <span className="w-3 h-3 rounded-full bg-indigo-600 border border-indigo-700 inline-block"></span>
              มาใหม่
            </span>
            <span className="flex items-center gap-1 font-semibold text-emerald-700">
              <span className="w-3 h-3 rounded-full bg-emerald-500 border border-emerald-600 inline-block"></span>
              ปรับแล้ว
            </span>
            <span className="flex items-center gap-1 font-semibold text-amber-700">
              <span className="w-3 h-3 rounded-full bg-amber-500 border border-amber-600 inline-block"></span>
              Sup ตอบ
            </span>
            <span className="flex items-center gap-1 font-semibold text-slate-400">
              <span className="w-3 h-3 rounded-full bg-slate-200 border border-slate-300 inline-block"></span>
              ยังไม่ปรับ
            </span>
          </div>
        </div>

        {/* Search input */}
        <div className="flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="ค้นหาเลข PO, รหัส/ชื่อสินค้า, หรือ Supplier..."
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-sky-500 focus:bg-white transition"
            />
          </div>

          <div className="text-xs text-slate-500 font-medium">
            แสดง <span className="font-bold text-slate-800">{filteredItems.length}</span> จากทั้งหมด {items.length} รายการ
          </div>
        </div>
      </div>

      {/* TOP SYNCHRONIZED SCROLLBAR */}
      <div 
        ref={topScrollRef}
        onScroll={handleTopScroll}
        className="overflow-x-auto overflow-y-hidden h-3.5 bg-slate-100 border border-slate-200 rounded-t-xl cursor-ew-resize shadow-inner"
        title="แถบเลื่อนซ้าย-ขวาด้านบนตาราง (สะดวกสำหรับจอเล็ก)"
      >
        <div style={{ width: `${tableScrollWidth}px` }} className="h-1" />
      </div>

      {/* MAIN TABLE CONTAINER */}
      <div 
        ref={mainTableRef}
        onScroll={handleMainScroll}
        className="bg-white rounded-b-xl border border-slate-200 shadow-sm max-h-[75vh] overflow-y-auto overflow-x-auto -mt-4"
      >
        <table className="w-full text-left text-xs border-collapse min-w-[1200px]">
          <thead className="bg-slate-900 text-slate-200 font-bold sticky top-0 z-20 shadow-md">
            <tr>
              <th className="py-2 px-1 text-center w-10 border-b border-slate-800 sticky left-0 z-30 bg-slate-950">#</th>
              <th className="py-2 px-2.5 w-28 border-b border-slate-800 sticky left-10 z-30 bg-slate-900 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.4)] whitespace-nowrap">PO No. / Date</th>
              <th className="py-2 px-2.5 border-b border-slate-800 w-44">Supplier</th>
              <th className="py-2 px-1.5 text-center w-24 border-b border-slate-800 whitespace-nowrap">Group</th>
              <th className="py-2 px-2.5 border-b border-slate-800 min-w-[180px]">Item Code & Description</th>
              <th className="py-2 px-2 text-right border-b border-slate-800 w-24 whitespace-nowrap">PO Qty / Unit</th>
              <th className="py-2 px-2 text-center border-b border-slate-800 w-24 whitespace-nowrap">Due To</th>
              <th className="py-2 px-2 text-right border-b border-slate-800 w-28 whitespace-nowrap">รับแล้ว / เหลือ</th>
              <th className="py-2 px-2 text-center border-b border-slate-800 w-20 whitespace-nowrap">Buyer</th>
              <th className="py-2 px-2 bg-sky-950 text-sky-300 border-b border-slate-800 w-28 text-center whitespace-nowrap">Est. Date</th>
              <th className="py-2 px-2 text-right bg-sky-950 text-sky-300 border-b border-slate-800 w-20 whitespace-nowrap">Est. Qty</th>
              <th className="py-2 px-2 border-b border-slate-800 w-32 whitespace-nowrap">ผู้ปรับปรุงล่าสุด</th>
              <th className="py-2 px-1.5 text-center border-b border-slate-800 w-24 whitespace-nowrap">สถานะ</th>
              <th className="py-2 px-2 text-right border-b border-slate-800 w-24 whitespace-nowrap">การจัดการ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(() => {
              let lastPoNumber = '';
              let lastSupplierCode = '';
              let lastItemGroup = '';

              return paginatedItems.map((item, index) => {
                const isFirstInPo = item.po_number !== lastPoNumber;
                const isFirstInSup = isFirstInPo || item.supplier_code !== lastSupplierCode;
                const isFirstInGroup = isFirstInPo || item.item_group !== lastItemGroup;
                if (isFirstInPo) {
                  lastPoNumber = item.po_number;
                  lastSupplierCode = item.supplier_code;
                  lastItemGroup = item.item_group || '';
                } else {
                  if (item.supplier_code !== lastSupplierCode) lastSupplierCode = item.supplier_code;
                  if (item.item_group !== lastItemGroup) lastItemGroup = item.item_group || '';
                }

                const hasSubItems = item.sub_items && item.sub_items.length > 0;
              const subItemsTotalQty = hasSubItems
                ? item.sub_items.reduce((sum, s) => sum + s.quantity, 0)
                : 0;
              const locked = isSupplierLocked(item);
              const isModified = isRecordModified(item);
              const isSupResponded = item.status === 'supplier_responded';
              const isNew = item.is_new === true;
              const displayIndex = (pageSize === 0 ? 0 : (currentPage - 1) * pageSize) + index + 1;

              // Visual Differentiation Styles - SOLID OPAQUE BACKGROUNDS (NO TRANSPARENCY ON STICKY)
              let rowBorderStripe = 'border-l-4 border-l-slate-200';
              let rowBg = 'bg-white hover:bg-slate-50';
              let stickyBg = 'bg-[#ffffff]';

              if (isSupResponded) {
                rowBorderStripe = 'border-l-4 border-l-amber-500';
                rowBg = 'bg-[#fffbeb] hover:bg-[#fef3c7]';
                stickyBg = 'bg-[#fffbeb]';
              } else if (isNew) {
                rowBorderStripe = 'border-l-4 border-l-indigo-600';
                rowBg = 'bg-[#f5f3ff] hover:bg-[#ede9fe]';
                stickyBg = 'bg-[#f5f3ff]';
              } else if (isModified) {
                rowBorderStripe = 'border-l-4 border-l-emerald-500';
                rowBg = hasSubItems ? 'bg-[#f0fdf4] hover:bg-[#dcfce7]' : 'bg-[#f0fdf4] hover:bg-[#dcfce7]';
                stickyBg = 'bg-[#f0fdf4]';
              } else if (locked) {
                rowBorderStripe = 'border-l-4 border-l-sky-400';
                rowBg = 'bg-[#f0f9ff] hover:bg-[#e0f2fe]';
                stickyBg = 'bg-[#f0f9ff]';
              }

              return (
                <React.Fragment key={item.id}>
                  {/* MAIN PARENT ROW */}
                  <tr className={`${rowBorderStripe} ${rowBg} ${isFirstInPo && index > 0 ? '!border-t-4 !border-t-slate-400/90 shadow-[0_-3px_6px_rgba(0,0,0,0.06)]' : ''} transition`}>
                    {/* STICKY COLUMN 1: # (Left: 0) */}
                    <td className={`py-2.5 px-2 text-center font-bold sticky left-0 z-10 ${stickyBg} border-r border-slate-100`}>
                      <div className="flex items-center justify-center gap-1">
                        {isSupResponded ? (
                          <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping inline-block"></span>
                        ) : isNew ? (
                          <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse inline-block" title="รายการใหม่วันนี้"></span>
                        ) : isModified ? (
                          <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" title="ปรับปรุงแล้ว"></span>
                        ) : (
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-300 inline-block" title="ยังไม่ปรับปรุง"></span>
                        )}
                        <span className={isModified || isNew ? 'text-slate-800 font-bold' : 'text-slate-400'}>{displayIndex}</span>
                      </div>
                    </td>

                    {/* STICKY COLUMN 2: PO No. / Date (Left: 48px, SOLID NON-TRANSPARENT SHADOW) */}
                    <td className={`py-2 px-3 whitespace-nowrap font-medium sticky left-10 z-10 ${stickyBg} shadow-[4px_0_8px_-2px_rgba(0,0,0,0.12)] border-r border-slate-200 align-top`}>
                      {isFirstInPo ? (
                        <>
                          <div className="font-bold text-slate-900 flex items-center gap-1.5 flex-wrap">
                            <span>{item.po_number}</span>
                            {isNew && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-indigo-600 text-white shadow-2xs flex items-center gap-0.5">
                                <Sparkles className="w-2.5 h-2.5 text-amber-300" />
                                <span>NEW</span>
                              </span>
                            )}
                            {locked && (
                              <span title="Supplier กำลังเปิดกรอกข้อมูล" className="inline-flex">
                                <Lock className="w-3 h-3 text-amber-500" />
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-500 font-normal">
                            {formatDateThai(item.po_date)}
                          </div>
                        </>
                      ) : (
                        <div className="text-slate-300 text-xs font-mono select-none pl-1">↳</div>
                      )}
                    </td>

                    {/* COLUMN 3: Supplier (Code / Name) - Stacked with Deduplication */}
                    <td className="py-2 px-3 align-top border-r border-slate-100">
                      {isFirstInSup ? (
                        <>
                          <div className="font-mono font-bold text-slate-800">{item.supplier_code}</div>
                          <div className="text-[10px] text-slate-500 truncate max-w-[160px]" title={item.supplier_name}>
                            {item.supplier_name}
                          </div>
                        </>
                      ) : (
                        <div className="text-slate-300 text-xs font-mono select-none pl-1">↳</div>
                      )}
                    </td>

                    {/* COLUMN 4: Group */}
                    <td className="py-2 px-2 text-center whitespace-nowrap border-r border-slate-100 align-top">
                      {isFirstInGroup ? (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                          {item.item_group || 'RM-กระจก'}
                        </span>
                      ) : (
                        <span className="text-slate-200 text-xs select-none">-</span>
                      )}
                    </td>

                    {/* COLUMN 5: Stacked Item Code & Description */}
                    <td className="py-2 px-3">
                      <div className="font-bold text-slate-900">{item.item_code}</div>
                      <div className="text-[11px] text-slate-500 leading-tight line-clamp-1">{item.item_name}</div>
                    </td>

                    {/* 6. Stacked PO Qty & Unit */}
                    <td className="py-2 px-3 text-right whitespace-nowrap">
                      <div className="font-bold text-slate-900">{item.quantity.toLocaleString()}</div>
                      <div className="text-[10px] text-slate-500">{item.unit}</div>
                    </td>

                    {/* 7. Due To */}
                    <td className="py-2 px-3 text-center text-slate-600 whitespace-nowrap">
                      {formatDateThai(item.due_date)}
                    </td>

                    {/* 8. Stacked Received / Remaining Qty */}
                    <td className="py-2 px-3 text-right whitespace-nowrap">
                      <div className="text-emerald-700 font-semibold text-[11px]">รับแล้ว: {item.received_qty.toLocaleString()}</div>
                      <div className="text-sky-700 font-bold">เหลือ: {item.remaining_qty.toLocaleString()}</div>
                    </td>

                    {/* 9. Buyer */}
                    <td className="py-2 px-3 text-slate-700 whitespace-nowrap font-medium">{cleanBuyerName(item.buyer_name)}</td>

                    {/* 10. Est. Date (PROMINENT HIGHLIGHT) */}
                    <td className={`py-2 px-3 text-center whitespace-nowrap ${
                      isModified ? 'bg-emerald-100/50 text-emerald-950 font-bold' : 'bg-slate-50/50 text-slate-400'
                    }`}>
                      {hasSubItems ? (
                        <span className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 font-bold text-[11px] border border-indigo-200 inline-flex items-center gap-1">
                          <Layers className="w-3 h-3" />
                          <span>แยก {item.sub_items.length} รอบ</span>
                        </span>
                      ) : item.estimate_date ? (
                        <span className="inline-flex items-center gap-1 text-emerald-900">
                          <CalendarIcon className="w-3 h-3 text-emerald-600" />
                          <span>{formatDateThai(item.estimate_date)}</span>
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded border border-dashed border-slate-300 text-[10px] text-slate-400 font-normal">
                          - ยังไม่ระบุวัน -
                        </span>
                      )}
                    </td>

                    {/* 11. Est. Qty */}
                    <td className={`py-2 px-3 text-right whitespace-nowrap ${
                      isModified ? 'bg-emerald-100/50 font-bold text-emerald-950' : 'bg-slate-50/50 text-slate-400'
                    }`}>
                      {hasSubItems ? (
                        <div className="flex flex-col text-right">
                          <span className="text-indigo-900 font-bold">รวม: {subItemsTotalQty.toLocaleString()}</span>
                          <span className="text-[10px] text-slate-500 font-normal">ค้าง {item.remaining_qty.toLocaleString()}</span>
                        </div>
                      ) : isModified && item.estimate_qty ? (
                        <span className="text-emerald-900 font-bold">{item.estimate_qty.toLocaleString()}</span>
                      ) : (
                        <span className="text-slate-500 font-medium">{(item.remaining_qty || 0).toLocaleString()}</span>
                      )}
                    </td>

                    {/* 12. Compact Audit Trail */}
                    <td className="py-2 px-3 whitespace-nowrap">
                      {item.updated_by_name ? (
                        <div className="flex flex-col gap-0.5">
                          <span className={`inline-flex items-center gap-1 text-[10px] font-bold ${
                            item.updated_by_type === 'supplier' ? 'text-amber-700' : 'text-emerald-700'
                          }`}>
                            {item.updated_by_type === 'supplier' ? (
                              <>
                                <Building2 className="w-2.5 h-2.5" />
                                <span>Supplier</span>
                              </>
                            ) : (
                              <>
                                <UserCheck className="w-2.5 h-2.5" />
                                <span>{formatUpdatedBy(item.updated_by_name, item.updated_by_type)}</span>
                              </>
                            )}
                          </span>
                          <span className="text-[9px] text-slate-400">
                            {new Date(item.updated_at).toLocaleString('th-TH')}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-300 text-[10px] italic">-</span>
                      )}
                    </td>

                    {/* 13. Status Badge */}
                    <td className="py-2 px-3 text-center whitespace-nowrap">
                      {getStatusBadge(item)}
                    </td>

                    {/* 14. Actions */}
                    <td className="py-2 px-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        {/* 1. Accept / Confirm Button (Compact Icon Button: Active vs Disabled State) */}
                        {item.status === 'confirmed' ? (
                          <button
                            type="button"
                            disabled
                            className="p-1 rounded bg-emerald-50 text-emerald-600 border border-emerald-300 cursor-not-allowed opacity-80 transition flex items-center justify-center"
                            title="ยืนยันวันส่งมอบแล้ว (Confirmed - แสดงบน Calendar)"
                          >
                            <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                          </button>
                        ) : item.status === 'supplier_responded' ? (
                          <button
                            type="button"
                            onClick={() => handleAcceptSupplier(item.id)}
                            className="p-1 rounded bg-amber-500 hover:bg-amber-600 text-white border border-amber-600 shadow-2xs transition cursor-pointer flex items-center justify-center animate-pulse"
                            title="คลิกเพื่อยืนยันรอบส่งของ Supplier (Accept & Confirm)"
                          >
                            <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleConfirmItem(item.id)}
                            className="p-1 rounded bg-sky-50 hover:bg-sky-600 text-sky-600 hover:text-white border border-sky-300 shadow-2xs transition cursor-pointer flex items-center justify-center"
                            title="คลิกเพื่อยืนยันวันส่งมอบนี้ลงปฏิทิน (Confirm)"
                          >
                            <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                          </button>
                        )}

                        {/* 2. Unlock Button (Only shown when item was sent to Supplier and is currently locked) */}
                        {locked && (
                          <button
                            onClick={() => handleUnlockItem(item.id)}
                            className="p-1 rounded text-amber-600 hover:text-amber-700 hover:bg-amber-50 border border-amber-200 transition"
                            title="ปลดล็อค (ให้จัดซื้อคุมและแก้ไขเอง)"
                          >
                            <Unlock className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* 3. Copy Portal Link (Chain Link Icon only, no wording) */}
                        <button
                          onClick={() => handleCopyItemPortalLink(item.id)}
                          className="p-1 rounded text-slate-500 hover:text-sky-600 hover:bg-sky-50 border border-slate-200 transition"
                          title="คัดลอกลิงก์ Portal ของ Supplier รายนี้"
                        >
                          {copiedItemId === item.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <LinkIcon className="w-3.5 h-3.5" />
                          )}
                        </button>

                        {/* 4. Edit/Split Sub-items */}
                        <button
                          onClick={() => handleOpenInlineSubItem(item)}
                          className={`p-1 rounded border transition ${
                            expandedSubItemRow === item.id
                              ? 'bg-sky-600 text-white border-sky-600'
                              : 'text-slate-600 hover:text-sky-600 hover:bg-sky-50 border-slate-200'
                          }`}
                          title="แก้ไข/เพิ่มรอบส่ง (Inline)"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>

                        {/* 5. History Audit Log */}
                        <button
                          onClick={() => handleOpenHistoryModal(item)}
                          className="p-1 rounded text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200 transition"
                          title="ดูประวัติ Audit Trail"
                        >
                          <History className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>

                  {/* INLINE SUB-ITEM ROWS EXPANSION (ALIGNED TO THE RIGHT WITH REAL-TIME VALIDATION) */}
                  {expandedSubItemRow === item.id && (() => {
                    const inlineTotalQty = inlineSubItems.reduce((sum, s) => sum + (Number(s.quantity) || 0), 0);
                    const isExceed = inlineTotalQty > item.remaining_qty;
                    const isOverLimit = !item.allow_over_delivery && isExceed;
                    const hasEmptyQty = inlineSubItems.some(s => s.quantity === '' || Number(s.quantity) <= 0);
                    const hasInvalidDate = inlineSubItems.some(s => !s.estimate_date || s.estimate_date.length < 10);
                    const canSave = !isOverLimit && !hasEmptyQty && !hasInvalidDate && !submitting;

                    return (
                      <tr className="bg-sky-50/40 border-y border-sky-200">
                        <td colSpan={14} className="p-3">
                          <div className="flex justify-end">
                            <div className="bg-white p-3.5 rounded-xl border border-sky-300 shadow-md space-y-3 max-w-2xl w-full">
                              <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-100">
                                <span className="font-bold text-slate-800 flex items-center gap-1.5">
                                  <Layers className="w-4 h-4 text-sky-600" />
                                  <span>{item.item_code} {item.item_name}</span>
                                </span>
                                <div className="text-right flex items-center gap-3">
                                  <span className="text-slate-500 font-medium">
                                    ค้างรับ: <strong className="text-slate-800">{item.remaining_qty.toLocaleString()} {item.unit}</strong>
                                  </span>
                                  <span className="font-medium">
                                    ยอดรวม: <strong className={isOverLimit ? 'text-red-600 font-black' : isExceed && item.allow_over_delivery ? 'text-amber-600 font-black' : 'text-emerald-600 font-black'}>
                                      {inlineTotalQty.toLocaleString()} {item.unit}
                                    </strong>
                                  </span>
                                </div>
                              </div>

                              {isOverLimit && (
                                <div className="p-2 bg-red-50 border border-red-200 rounded-lg text-red-600 font-bold text-xs flex items-center justify-between">
                                  <span>⚠️ ยอดส่งรวมเกินจำนวนค้างรับ (Supplier ไม่อนุญาตให้ส่งเกิน)</span>
                                  <span>เกินไป +{(inlineTotalQty - item.remaining_qty).toLocaleString()} {item.unit}</span>
                                </div>
                              )}

                              {!isOverLimit && isExceed && item.allow_over_delivery && (
                                <div className="p-2 bg-amber-50 border border-amber-300 rounded-lg text-amber-900 font-bold text-xs flex items-center justify-between shadow-2xs">
                                  <span>⚡ Supplier รายนี้ได้รับอนุญาตให้ส่งเกินยอดสั่งซื้อได้</span>
                                  <span className="bg-amber-200/80 px-2 py-0.5 rounded text-amber-950">ส่งเกิน +{(inlineTotalQty - item.remaining_qty).toLocaleString()} {item.unit}</span>
                                </div>
                              )}

                              <div className="space-y-2">
                                {inlineSubItems.map((sub, idx) => (
                                  <div key={idx} className="flex items-center justify-end gap-2 text-xs">
                                    <span className="w-16 font-bold text-slate-600 text-right">รอบที่ {idx + 1}</span>
                                    <div className="relative flex items-center">
                                      <input
                                        type="text"
                                        placeholder="วัน/เดือน/ปี เช่น 27/08/2026"
                                        value={sub.estimate_date}
                                        onChange={(e) => {
                                          const newSubs = [...inlineSubItems];
                                          newSubs[idx].estimate_date = handleDateMask(e.target.value);
                                          setInlineSubItems(newSubs);
                                        }}
                                        className={`pl-3 pr-8 py-1.5 border rounded-lg text-xs outline-none w-36 font-semibold transition ${
                                          !sub.estimate_date || sub.estimate_date.length < 10
                                            ? 'bg-amber-50 border-amber-300 focus:border-amber-500'
                                            : 'bg-slate-50 border-slate-200 focus:border-sky-500'
                                        }`}
                                      />
                                      <input
                                        type="date"
                                        tabIndex={-1}
                                        className="sr-only"
                                        onChange={(e) => {
                                          if (e.target.value) {
                                            const [y, m, d] = e.target.value.split('-');
                                            const newSubs = [...inlineSubItems];
                                            newSubs[idx].estimate_date = `${d}/${m}/${y}`;
                                            setInlineSubItems(newSubs);
                                          }
                                        }}
                                      />
                                      <button
                                        type="button"
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
                                        <CalendarIcon className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                    <input
                                      type="number"
                                      placeholder="จำนวน"
                                      value={sub.quantity === '' ? '' : sub.quantity}
                                      onChange={(e) => {
                                        const newSubs = [...inlineSubItems];
                                        newSubs[idx].quantity = e.target.value === '' ? '' : Number(e.target.value);
                                        setInlineSubItems(newSubs);
                                      }}
                                      className={`px-3 py-1.5 border rounded-lg text-xs outline-none w-28 font-bold text-right transition ${
                                        isOverLimit || Number(sub.quantity) <= 0
                                          ? 'bg-red-50 border-red-400 text-red-700 focus:border-red-500'
                                          : 'bg-slate-50 border-slate-200 text-slate-800 focus:border-sky-500'
                                      }`}
                                    />
                                    <span className="text-slate-500 w-12">{item.unit}</span>
                                    {inlineSubItems.length > 1 && (
                                      <button
                                        onClick={() => setInlineSubItems(inlineSubItems.filter((_, i) => i !== idx))}
                                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition"
                                      >
                                        <Trash className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </div>
                                ))}
                              </div>

                              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                                <button
                                  onClick={() => setInlineSubItems([...inlineSubItems, { estimate_date: '', quantity: 0 }])}
                                  className="px-2.5 py-1 text-sky-600 hover:bg-sky-50 rounded text-xs font-semibold flex items-center gap-1 transition"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                  <span>เพิ่มรอบส่ง</span>
                                </button>

                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => setExpandedSubItemRow(null)}
                                    className="px-3 py-1.5 rounded-lg text-slate-600 hover:bg-slate-100 text-xs font-medium transition"
                                  >
                                    ยกเลิก
                                  </button>
                                  <button
                                    onClick={() => handleSaveInlineSubItems(item)}
                                    disabled={!canSave}
                                    className={`px-5 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition ${
                                      canSave
                                        ? 'bg-sky-600 hover:bg-sky-700 text-white cursor-pointer'
                                        : 'bg-slate-200 text-slate-400 cursor-not-allowed opacity-75'
                                    }`}
                                  >
                                    {submitting ? 'กำลังบันทึก...' : 'บันทึก'}
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })()}
                </React.Fragment>
              );
            });
          })()}
        </tbody>
        </table>
      </div>

      {/* PAGINATION CONTROLS */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-slate-500 font-medium flex-wrap">
          <span>แสดง</span>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 outline-none focus:border-sky-500 transition cursor-pointer"
          >
            <option value={50}>50 รายการ / หน้า</option>
            <option value={100}>100 รายการ / หน้า</option>
            <option value={200}>200 รายการ / หน้า</option>
            <option value={0}>แสดงทั้งหมด ({filteredItems.length.toLocaleString()})</option>
          </select>
          <span>
            (รายการที่ {filteredItems.length === 0 ? 0 : (currentPage - 1) * (pageSize || filteredItems.length) + 1} - {pageSize === 0 ? filteredItems.length : Math.min(currentPage * pageSize, filteredItems.length)} จากทั้งหมด <strong className="text-slate-800 font-bold">{filteredItems.length.toLocaleString()}</strong> รายการ)
          </span>
        </div>

        {pageSize > 0 && totalPages > 1 && (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed font-medium transition flex items-center gap-1 cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>ย้อนกลับ</span>
            </button>
            
            <div className="flex items-center gap-1">
              {(() => {
                if (totalPages <= 5) {
                  return Array.from({ length: totalPages }, (_, i) => i + 1);
                }
                let start = Math.max(1, currentPage - 2);
                let end = Math.min(totalPages, start + 4);
                if (end - start < 4) {
                  start = Math.max(1, end - 4);
                }
                const pages: number[] = [];
                for (let i = start; i <= end; i++) {
                  pages.push(i);
                }
                return pages;
              })().map((pageNum) => (
                <button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  className={`w-7 h-7 rounded-lg text-xs font-bold transition cursor-pointer ${
                    currentPage === pageNum
                      ? 'bg-sky-600 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {pageNum}
                </button>
              ))}
            </div>

            <button
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed font-medium transition flex items-center gap-1 cursor-pointer"
            >
              <span>ถัดไป</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* EDIT MODAL */}
      {showEditModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-200">
            <h2 className="text-base font-bold text-slate-800 mb-3 flex items-center gap-2">
              <Edit className="w-5 h-5 text-sky-600" />
              <span>กำหนดวัน/จำนวนส่ง: {showEditModal.po_number}</span>
            </h2>

            <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
              <div className="bg-slate-50 p-3 rounded-xl space-y-1">
                <div className="font-bold text-slate-800">{showEditModal.item_name}</div>
                <div className="text-slate-500">รหัสสินค้า: {showEditModal.item_code}</div>
                <div className="text-slate-600 font-semibold">
                  คงเหลือที่ต้องส่ง: <span className="text-sky-700">{showEditModal.remaining_qty.toLocaleString()} {showEditModal.unit}</span>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">วันที่คาดว่าจะส่ง (วัน/เดือน/ปี)</label>
                <div className="relative flex items-center">
                  <input
                    type="text"
                    placeholder="เช่น 27/08/2026"
                    value={estDate}
                    onChange={(e) => setEstDate(handleDateMask(e.target.value))}
                    className="w-full pl-3 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-sky-500 font-semibold text-xs"
                  />
                  <input
                    type="date"
                    tabIndex={-1}
                    className="sr-only"
                    onChange={(e) => {
                      if (e.target.value) {
                        const [y, m, d] = e.target.value.split('-');
                        setEstDate(`${d}/${m}/${y}`);
                      }
                    }}
                  />
                  <button
                    type="button"
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
                    className="p-1.5 text-slate-400 hover:text-sky-600 absolute right-2 top-1/2 -translate-y-1/2 transition z-20 cursor-pointer"
                    title="คลิกเพื่อเปิดปฏิทิน"
                  >
                    <CalendarIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">จำนวนที่คาดว่าจะส่ง ({showEditModal.unit})</label>
                <input
                  type="number"
                  value={estQty}
                  onChange={(e) => setEstQty(Number(e.target.value))}
                  className={`w-full px-3 py-2 border rounded-xl outline-none font-bold transition ${
                    (!showEditModal.allow_over_delivery && estQty > showEditModal.remaining_qty) || estQty <= 0
                      ? 'bg-red-50 border-red-400 text-red-700 focus:border-red-500'
                      : 'bg-slate-50 border-slate-200 focus:border-sky-500'
                  }`}
                />
                {estQty > showEditModal.remaining_qty && (
                  showEditModal.allow_over_delivery ? (
                    <p className="text-[11px] text-amber-800 font-bold mt-1 bg-amber-50 p-1.5 rounded border border-amber-300">
                      ⚡ Supplier ได้รับอนุญาตให้ส่งเกินยอดสั่งซื้อได้ (ส่งเกิน +{(estQty - showEditModal.remaining_qty).toLocaleString()} {showEditModal.unit})
                    </p>
                  ) : (
                    <p className="text-[11px] text-red-600 font-bold mt-1">
                      ⚠️ จำนวนส่ง ({estQty.toLocaleString()}) เกินกว่ายอดค้างรับ ({showEditModal.remaining_qty.toLocaleString()} {showEditModal.unit})
                    </p>
                  )
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowEditModal(null)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-medium transition"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={submitting || estQty > showEditModal.remaining_qty || estQty <= 0 || !estDate || estDate.length < 10}
                  className={`px-4 py-2 rounded-xl font-semibold shadow-sm transition ${
                    submitting || estQty > showEditModal.remaining_qty || estQty <= 0 || !estDate || estDate.length < 10
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed opacity-75'
                      : 'bg-sky-600 hover:bg-sky-700 text-white cursor-pointer'
                  }`}
                >
                  {submitting ? 'กำลังบันทึก...' : 'บันทึก'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FORCE OVERRIDE MODAL */}
      {forceOverrideModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-amber-200 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center gap-3 text-amber-600 mb-3">
              <div className="p-2 rounded-xl bg-amber-100">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900">ยืนยันการ Force Edit (ปลดล็อคด่วน)</h3>
                <p className="text-[11px] text-slate-500">
                  รายการนี้อยู่ในช่วงเวลาเปิดกรอกของ Supplier ({forceOverrideModal.item?.supplier_name})
                </p>
              </div>
            </div>

            <div className="bg-amber-50 p-3 rounded-xl border border-amber-200/80 text-xs text-amber-900 mb-4 space-y-1">
              <p>
                ⏰ <strong>รอบเวลาเปิดกรอก:</strong> เปิดถึง{' '}
                {forceOverrideModal.item?.lock_expires_at ? formatDateThai(forceOverrideModal.item.lock_expires_at) : 'สิ้นสุดรอบนี้'}
              </p>
              <p className="text-[11px] text-amber-800">
                การแก้ไขในขณะนี้จะทำการปลดล็อคและบันทึกประวัติว่า User ทำการ Override ข้อมูล
              </p>
            </div>

            <div className="space-y-3 text-xs mb-4">
              <label className="block font-semibold text-slate-700">
                ระบุเหตุผลในการแก้ไขด่วน <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={forceOverrideModal.reason}
                onChange={(e) => setForceOverrideModal({ ...forceOverrideModal, reason: e.target.value })}
                placeholder="เช่น Supplier โทรแจ้งเลื่อนวันส่ง, จัดซื้อประสานงานตรง..."
                className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:border-amber-500 bg-slate-50 font-medium"
                autoFocus
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setForceOverrideModal({ isOpen: false, item: null, reason: '' })}
                className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-medium text-xs transition"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleConfirmForceOverride}
                disabled={submitting || !forceOverrideModal.reason.trim()}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-sm transition disabled:opacity-50"
              >
                {submitting ? 'กำลังบันทึก...' : 'ยืนยัน Force Edit'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HISTORY AUDIT MODAL */}
      {showHistoryModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 max-h-[85vh] flex flex-col">
            <h2 className="text-base font-bold text-slate-800 mb-3 flex items-center gap-2">
              <History className="w-5 h-5 text-indigo-600" />
              <span>ประวัติการเปลี่ยนแปลง: {showHistoryModal.po_number} ({showHistoryModal.item_code})</span>
            </h2>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1 text-xs">
              {showHistoryModal.audit_logs && showHistoryModal.audit_logs.length > 0 ? (
                [...showHistoryModal.audit_logs]
                  .sort((a, b) => new Date(b.changed_at).getTime() - new Date(a.changed_at).getTime())
                  .map((log, idx) => (
                    <div
                      key={log.id}
                      className={`p-3 rounded-xl border transition ${
                        idx === 0
                          ? 'bg-indigo-50/70 border-indigo-200 shadow-2xs'
                          : 'bg-slate-50 border-slate-100'
                      } space-y-1`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-slate-800">{log.changed_by_name} ({log.changed_by_type})</span>
                          {idx === 0 && (
                            <span className="px-1.5 py-0.2 rounded-full text-[9px] font-extrabold bg-indigo-600 text-white shadow-2xs">
                              ล่าสุด
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400 font-medium">{new Date(log.changed_at).toLocaleString('th-TH')}</span>
                      </div>
                      <div className="text-slate-600 text-[11px] leading-relaxed">{log.changes_detail}</div>
                    </div>
                  ))
              ) : (
                <div className="text-center py-8 text-slate-400">ยังไม่มีประวัติการแก้ไข</div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setShowHistoryModal(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition"
              >
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
