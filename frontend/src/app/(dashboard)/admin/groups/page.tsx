'use client';

import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Group } from '@/types';
import { Shield, Plus, Users, CheckCircle2, XCircle, Edit, Trash2, Compass } from 'lucide-react';

const LANDING_PAGE_OPTIONS = [
  { path: '/dashboard', label: '📊 Dashboard (ภาพรวมระบบ - ค่าเริ่มต้น)' },
  { path: '/calendar', label: '📅 Calendar (ปฏิทินนัดส่งสินค้า)' },
  { path: '/receiving-checklist', label: '📑 Receiving Checklist (ใบตรวจรับสินค้า)' },
  { path: '/operation', label: '📋 Operation (จัดการสถานะ PO/สินค้า)' },
  { path: '/items', label: '📦 Item Master (ข้อมูลสินค้า)' },
  { path: '/suppliers', label: '🏭 Supplier Master (ข้อมูลผู้ขาย)' },
  { path: '/history', label: '📜 History (ประวัติการแก้ไข)' },
];

export default function GroupsPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [allowedItemGroups, setAllowedItemGroups] = useState('*');
  const [defaultPage, setDefaultPage] = useState('/dashboard');
  const [submitting, setSubmitting] = useState(false);

  // Edit Modal State
  const [showEditModal, setShowEditModal] = useState<Group | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editAllowedItemGroups, setEditAllowedItemGroups] = useState('*');
  const [editDefaultPage, setEditDefaultPage] = useState('/dashboard');
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    fetchGroups();
  }, []);

  const fetchGroups = async () => {
    try {
      const res = await api.get<Group[]>('/api/groups');
      setGroups(res.data);
    } catch (err) {
      console.error('Failed to fetch groups:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/api/groups', {
        name,
        description,
        allowed_item_groups: allowedItemGroups || '*',
        default_page: defaultPage || '/dashboard',
      });
      setShowCreateModal(false);
      setName('');
      setDescription('');
      setAllowedItemGroups('*');
      setDefaultPage('/dashboard');
      fetchGroups();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'เกิดข้อผิดพลาดในการสร้างกลุ่ม');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenEdit = (group: Group) => {
    setShowEditModal(group);
    setEditName(group.name);
    setEditDescription(group.description || '');
    setEditAllowedItemGroups(group.allowed_item_groups || '*');
    setEditDefaultPage(group.default_page || '/dashboard');
  };

  const handleUpdateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showEditModal) return;
    setSubmitting(true);
    try {
      await api.put(`/api/groups/${showEditModal.id}`, {
        name: editName,
        description: editDescription,
        allowed_item_groups: editAllowedItemGroups || '*',
        default_page: editDefaultPage || '/dashboard',
      });
      setShowEditModal(null);
      fetchGroups();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'เกิดข้อผิดพลาดในการแก้ไขกลุ่ม');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteGroup = async (group: Group) => {
    if (group.name.toLowerCase() === 'admin') {
      alert('ไม่สามารถลบกลุ่มระบบหลัก (Admin) ได้');
      return;
    }
    if (group.user_count > 0) {
      alert(
        `ไม่สามารถลบกลุ่ม '${group.name}' ได้ เนื่องจากยังมีผู้ใช้งานสังกัดอยู่ในกลุ่มนี้ ${group.user_count} คน กรุณาย้ายผู้ใช้งานไปกลุ่มอื่นก่อน`
      );
      return;
    }
    if (!confirm(`คุณต้องการลบกลุ่ม '${group.name}' ใช่หรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้`)) {
      return;
    }

    setDeletingId(group.id);
    try {
      const res = await api.delete<{ message: string }>(`/api/groups/${group.id}`);
      alert(res.data.message || 'ลบกลุ่มเรียบร้อยแล้ว');
      fetchGroups();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'เกิดข้อผิดพลาดในการลบกลุ่ม');
    } finally {
      setDeletingId(null);
    }
  };

  const handleToggleActive = async (group: Group) => {
    try {
      await api.put(`/api/groups/${group.id}`, { is_active: !group.is_active });
      fetchGroups();
    } catch (err) {
      console.error('Failed to update group status:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-500">
        <div className="w-6 h-6 border-2 border-sky-500 border-t-transparent rounded-full animate-spin mr-3"></div>
        <span>กำลังโหลดข้อมูลกลุ่มผู้ใช้งาน...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2.5">
            <Shield className="w-7 h-7 text-sky-600" />
            <span>กลุ่มผู้ใช้งาน (Group Management)</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">จัดการกลุ่มบทบาทหน้าที่ กำหนดสิทธิ์กลุ่มสินค้า และกำหนดหน้าแรกหลังล็อกอิน</p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs rounded-xl shadow-lg shadow-sky-600/20 transition cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>เพิ่มกลุ่มใหม่</span>
        </button>
      </div>

      {/* Groups Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {groups.map((g) => {
          const isAdminGroup = g.name.toLowerCase() === 'admin';
          const hasUsers = g.user_count > 0;
          const landingOpt = LANDING_PAGE_OPTIONS.find((p) => p.path === g.default_page);
          const landingTitle = landingOpt ? landingOpt.label.split(' ')[1] : g.default_page || 'Dashboard';

          return (
            <div key={g.id} className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                    <Shield className="w-4 h-4 text-sky-600" />
                    <span>{g.name}</span>
                  </h3>
                  <button
                    onClick={() => handleToggleActive(g)}
                    disabled={isAdminGroup}
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border transition ${
                      g.is_active
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-rose-50 text-rose-700 border-rose-200'
                    } ${isAdminGroup ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'}`}
                    title={isAdminGroup ? 'กลุ่ม Admin เปิดใช้งานตลอดเวลา' : 'คลิกเพื่อสลับสถานะเปิด/ปิด'}
                  >
                    {g.is_active ? <CheckCircle2 className="w-3 h-3 text-emerald-600" /> : <XCircle className="w-3 h-3 text-rose-600" />}
                    <span>{g.is_active ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}</span>
                  </button>
                </div>
                <p className="text-xs text-slate-500 mt-2 min-h-[36px]">{g.description || 'ไม่มีคำอธิบาย'}</p>

                <div className="mt-3 flex flex-wrap gap-1.5 items-center">
                  <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md">
                    กลุ่มสินค้า: {g.allowed_item_groups === '*' ? 'ทุกกลุ่มสินค้า (*)' : g.allowed_item_groups || 'ทุกกลุ่ม (*)'}
                  </span>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                    <Compass className="w-3 h-3 text-emerald-600" />
                    <span>หน้าแรก: {landingTitle}</span>
                  </span>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
                <div className="flex items-center gap-1.5 font-medium">
                  <Users className="w-4 h-4 text-slate-400" />
                  <span>จำนวนผู้ใช้งาน:</span>
                  <span className="font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md">{g.user_count} คน</span>
                </div>

                <div className="flex items-center gap-1.5">
                  {/* Edit Button */}
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(g)}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-sky-600 hover:bg-sky-50 border border-slate-200 transition cursor-pointer shadow-2xs"
                    title="แก้ไขกลุ่ม"
                  >
                    <Edit className="w-3.5 h-3.5" />
                  </button>

                  {/* Delete Button */}
                  <button
                    type="button"
                    onClick={() => handleDeleteGroup(g)}
                    disabled={isAdminGroup || hasUsers || deletingId === g.id}
                    className={`p-1.5 rounded-lg border transition shadow-2xs ${
                      isAdminGroup || hasUsers
                        ? 'text-slate-300 border-slate-100 cursor-not-allowed'
                        : 'text-slate-500 hover:text-rose-600 hover:bg-rose-50 border-slate-200 cursor-pointer'
                    }`}
                    title={
                      isAdminGroup
                        ? 'กลุ่มระบบหลัก (Admin) ไม่สามารถลบได้'
                        : hasUsers
                        ? `ไม่สามารถลบได้ เนื่องจากมีผู้ใช้งาน ${g.user_count} คน`
                        : 'ลบกลุ่มนี้ทิ้ง'
                    }
                  >
                    {deletingId === g.id ? (
                      <div className="w-3.5 h-3.5 border-2 border-rose-600 border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal: Create Group */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-900">เพิ่มกลุ่มผู้ใช้งานใหม่</h3>
            <form onSubmit={handleCreateGroup} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">ชื่อกลุ่ม *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="เช่น WH User"
                  className="w-full px-3 py-2 border rounded-lg text-xs outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">คำอธิบาย</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="รายละเอียดหน้าที่ความรับผิดชอบ..."
                  className="w-full px-3 py-2 border rounded-lg text-xs outline-none focus:border-sky-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  กลุ่มสินค้าที่มองเห็น (Allowed Item Groups)
                </label>
                <input
                  type="text"
                  value={allowedItemGroups}
                  onChange={(e) => setAllowedItemGroups(e.target.value)}
                  placeholder="เช่น HW หรือ HW,RM-กระจก หรือ *"
                  className="w-full px-3 py-2 border rounded-lg text-xs outline-none focus:border-sky-500 font-mono"
                />
                <p className="text-[10px] text-slate-400 mt-0.5">
                  ระบุรหัสกลุ่มสินค้า หรือคั่นด้วยจุลภาค เช่น <code>HW,RM-กระจก</code> หรือ <code>*</code> เพื่อดูทั้งหมด
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  หน้าแรกหลังเข้าสู่ระบบ (Default Landing Page)
                </label>
                <select
                  value={defaultPage}
                  onChange={(e) => setDefaultPage(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-xs outline-none focus:border-sky-500 bg-white"
                >
                  {LANDING_PAGE_OPTIONS.map((opt) => (
                    <option key={opt.path} value={opt.path}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  หน้าที่ผู้ใช้ในกลุ่มนี้จะถูกพาไปทันทีเมื่อเข้าสู่ระบบสำเร็จ
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-50"
                >
                  {submitting ? 'กำลังบันทึก...' : 'บันทึก'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Group */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-900">
              แก้ไขกลุ่ม: <span className="text-sky-600">{showEditModal.name}</span>
            </h3>
            <form onSubmit={handleUpdateGroup} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">ชื่อกลุ่ม *</label>
                <input
                  type="text"
                  required
                  disabled={showEditModal.name.toLowerCase() === 'admin'}
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="เช่น WH User"
                  className="w-full px-3 py-2 border rounded-lg text-xs outline-none focus:border-sky-500 disabled:bg-slate-100 disabled:text-slate-400 font-medium"
                />
                {showEditModal.name.toLowerCase() === 'admin' && (
                  <p className="text-[10px] text-amber-600 mt-0.5">กลุ่ม Admin ไม่สามารถเปลี่ยนชื่อได้</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">คำอธิบาย</label>
                <textarea
                  rows={2}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="รายละเอียดหน้าที่ความรับผิดชอบ..."
                  className="w-full px-3 py-2 border rounded-lg text-xs outline-none focus:border-sky-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  กลุ่มสินค้าที่มองเห็น (Allowed Item Groups)
                </label>
                <input
                  type="text"
                  value={editAllowedItemGroups}
                  onChange={(e) => setEditAllowedItemGroups(e.target.value)}
                  placeholder="เช่น HW หรือ HW,RM-กระจก หรือ *"
                  className="w-full px-3 py-2 border rounded-lg text-xs outline-none focus:border-sky-500 font-mono"
                />
                <p className="text-[10px] text-slate-400 mt-0.5">
                  ระบุรหัสกลุ่มสินค้า หรือคั่นด้วยจุลภาค เช่น <code>HW,RM-กระจก</code> หรือ <code>*</code> เพื่อดูทั้งหมด
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  หน้าแรกหลังเข้าสู่ระบบ (Default Landing Page)
                </label>
                <select
                  value={editDefaultPage}
                  onChange={(e) => setEditDefaultPage(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-xs outline-none focus:border-sky-500 bg-white"
                >
                  {LANDING_PAGE_OPTIONS.map((opt) => (
                    <option key={opt.path} value={opt.path}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  หน้าที่ผู้ใช้ในกลุ่มนี้จะถูกพาไปทันทีเมื่อเข้าสู่ระบบสำเร็จ
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowEditModal(null)}
                  className="px-4 py-2 border rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-50"
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
