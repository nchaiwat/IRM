'use client';

import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Group, User } from '@/types';
import { Users, UserPlus, Key, Edit, CheckCircle2, XCircle, Search, Shield, Send, Clock } from 'lucide-react';

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [testingTelegramId, setTestingTelegramId] = useState<number | null>(null);

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState<User | null>(null);
  const [showResetModal, setShowResetModal] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    full_name: '',
    email: '',
    telegram_chat_id: '',
    group_id: '',
    allowed_item_groups: '*',
    is_active: true,
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [usersRes, groupsRes] = await Promise.all([
        api.get<User[]>('/api/users'),
        api.get<Group[]>('/api/groups'),
      ]);
      setUsers(usersRes.data);
      setGroups(groupsRes.data);
    } catch (err) {
      console.error('Failed to fetch users or groups:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/api/users', {
        ...formData,
        group_id: formData.group_id ? parseInt(formData.group_id) : null,
        allowed_item_groups: formData.allowed_item_groups || '*',
      });
      setShowCreateModal(false);
      setFormData({ username: '', password: '', full_name: '', email: '', telegram_chat_id: '', group_id: '', allowed_item_groups: '*', is_active: true });
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'เกิดข้อผิดพลาดในการสร้างผู้ใช้งาน');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenEdit = (u: User) => {
    setShowEditModal(u);
    setFormData({
      username: u.username,
      password: '',
      full_name: u.full_name,
      email: u.email,
      telegram_chat_id: u.telegram_chat_id || '',
      group_id: u.group_id ? u.group_id.toString() : '',
      allowed_item_groups: u.allowed_item_groups || '*',
      is_active: u.is_active,
    });
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showEditModal) return;
    setSubmitting(true);
    try {
      await api.put(`/api/users/${showEditModal.id}`, {
        full_name: formData.full_name,
        email: formData.email,
        telegram_chat_id: formData.telegram_chat_id,
        group_id: formData.group_id ? parseInt(formData.group_id) : null,
        allowed_item_groups: formData.allowed_item_groups || '*',
        is_active: formData.is_active,
      });
      setShowEditModal(null);
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'เกิดข้อผิดพลาดในการแก้ไขผู้ใช้งาน');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showResetModal || !newPassword) return;
    setSubmitting(true);
    try {
      await api.post(`/api/users/${showResetModal.id}/reset-password`, { new_password: newPassword });
      setShowResetModal(null);
      setNewPassword('');
      alert('รีเซ็ตรหัสผ่านเรียบร้อยแล้ว');
    } catch (err: any) {
      alert(err.response?.data?.detail || 'เกิดข้อผิดพลาดในการรีเซ็ตรหัสผ่าน');
    } finally {
      setSubmitting(false);
    }
  };

  const handleTestTelegramDM = async (user: User) => {
    setTestingTelegramId(user.id);
    try {
      const res = await api.post(`/api/users/${user.id}/test-telegram`);
      alert(res.data.message || `ส่งข้อความ Telegram DM หา ${user.full_name} สำเร็จแล้ว`);
    } catch (err: any) {
      alert(err.response?.data?.detail || 'ส่งข้อความ Telegram DM ล้มเหลว');
    } finally {
      setTestingTelegramId(null);
    }
  };

  const handleToggleActive = async (user: User) => {
    try {
      await api.put(`/api/users/${user.id}`, { is_active: !user.is_active });
      fetchData();
    } catch (err) {
      console.error('Failed to toggle status:', err);
    }
  };

  const filteredUsers = users.filter(
    (u) =>
      u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.telegram_chat_id && u.telegram_chat_id.includes(searchTerm))
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-500">
        <div className="w-6 h-6 border-2 border-sky-500 border-t-transparent rounded-full animate-spin mr-3"></div>
        <span>กำลังโหลดข้อมูลผู้ใช้งาน...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2.5">
            <Users className="w-7 h-7 text-sky-600" />
            <span>จัดการผู้ใช้งาน (User Management)</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">เพิ่ม แก้ไข กำหนด Telegram ID และแสดงเวลาเข้าใช้งานล่าสุด (Last Access)</p>
        </div>

        <button
          onClick={() => {
            setFormData({ username: '', password: '', full_name: '', email: '', telegram_chat_id: '', group_id: '', allowed_item_groups: '*', is_active: true });
            setShowCreateModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs rounded-xl shadow-lg shadow-sky-600/20 transition cursor-pointer"
        >
          <UserPlus className="w-4 h-4" />
          <span>เพิ่มผู้ใช้งานใหม่</span>
        </button>
      </div>

      {/* Filter & Search */}
      <div className="flex items-center bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="ค้นหาตามชื่อผู้ใช้, ชื่อ-นามสกุล, อีเมล หรือ Telegram ID..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-sky-500 focus:bg-white transition"
          />
        </div>
      </div>

      {/* Users Data Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-left text-xs text-slate-600">
          <thead className="bg-slate-900 text-slate-200 font-bold uppercase tracking-wider">
            <tr>
              <th className="py-3.5 px-5">ผู้ใช้งาน (Username)</th>
              <th className="py-3.5 px-5">ชื่อ-นามสกุล</th>
              <th className="py-3.5 px-5">อีเมล & Telegram ID</th>
              <th className="py-3.5 px-5">กลุ่มสิทธิ์ (Group)</th>
              <th className="py-3.5 px-5">ใช้งานล่าสุด (Last Access)</th>
              <th className="py-3.5 px-5">สถานะ</th>
              <th className="py-3.5 px-5 text-right">การจัดการ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredUsers.map((u) => (
              <tr key={u.id} className="hover:bg-slate-50/80 transition">
                <td className="py-3.5 px-5 font-bold text-slate-900">{u.username}</td>
                <td className="py-3.5 px-5 font-semibold text-slate-800">{u.full_name}</td>
                <td className="py-3.5 px-5">
                  <div className="text-slate-600">{u.email}</div>
                  {u.telegram_chat_id ? (
                    <div className="text-[11px] text-sky-600 font-mono flex items-center gap-1 mt-0.5">
                      <Send className="w-3 h-3 text-sky-500" />
                      <span>{u.telegram_chat_id}</span>
                    </div>
                  ) : (
                    <div className="text-[10px] text-slate-400 italic">ไม่มี Telegram ID</div>
                  )}
                </td>
                <td className="py-3.5 px-5">
                  <div>
                    {u.group ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-sky-50 text-sky-700 border border-sky-200">
                        <Shield className="w-3 h-3" />
                        {u.group.name}
                      </span>
                    ) : (
                      <span className="text-slate-400 italic text-[11px]">ไม่ได้กำหนด</span>
                    )}
                  </div>
                  {u.allowed_item_groups && (
                    <div className="mt-1">
                      <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md">
                        กลุ่มสินค้า: {u.allowed_item_groups === '*' ? 'ทั้งหมด (*)' : u.allowed_item_groups}
                      </span>
                    </div>
                  )}
                </td>

                {/* Last Access Column */}
                <td className="py-3.5 px-5 text-slate-500 whitespace-nowrap">
                  {u.last_login_at ? (
                    <div className="flex items-center gap-1 text-[11px] font-medium text-slate-700">
                      <Clock className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{new Date(u.last_login_at).toLocaleString('th-TH')}</span>
                    </div>
                  ) : (
                    <span className="text-[10px] text-slate-400 italic">ยังไม่เคยเข้าสู่ระบบ</span>
                  )}
                </td>

                <td className="py-3.5 px-5 whitespace-nowrap">
                  <button
                    onClick={() => handleToggleActive(u)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
                      u.is_active
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-rose-50 text-rose-700 border-rose-200'
                    }`}
                  >
                    {u.is_active ? <CheckCircle2 className="w-3 h-3 text-emerald-600" /> : <XCircle className="w-3 h-3 text-rose-600" />}
                    <span>{u.is_active ? 'ใช้งานปกติ' : 'ปิดใช้งาน'}</span>
                  </button>
                </td>

                <td className="py-3.5 px-5 text-right whitespace-nowrap">
                  <div className="flex items-center justify-end gap-1.5">
                    {/* Small Test Telegram DM Button */}
                    {u.telegram_chat_id && (
                      <button
                        onClick={() => handleTestTelegramDM(u)}
                        disabled={testingTelegramId === u.id}
                        title="ทดสอบส่ง Telegram DM หาผู้ใช้นี้"
                        className="p-1.5 rounded-lg text-sky-600 hover:bg-sky-50 border border-sky-200 transition"
                      >
                        {testingTelegramId === u.id ? (
                          <div className="w-3.5 h-3.5 border-2 border-sky-600 border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                          <Send className="w-3.5 h-3.5" />
                        )}
                      </button>
                    )}

                    <button
                      onClick={() => handleOpenEdit(u)}
                      title="แก้ไขข้อมูล"
                      className="p-1.5 rounded-lg text-slate-500 hover:text-sky-600 hover:bg-sky-50 transition border border-slate-200"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => setShowResetModal(u)}
                      title="รีเซ็ตรหัสผ่าน"
                      className="p-1.5 rounded-lg text-slate-500 hover:text-amber-600 hover:bg-amber-50 transition border border-slate-200"
                    >
                      <Key className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal: Create User */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-slate-900">เพิ่มผู้ใช้งานใหม่</h3>
            <form onSubmit={handleCreateUser} className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700">Username *</label>
                  <span className="text-[10px] text-sky-600 font-medium">รูปแบบ: ชื่อ.นามสกุลตัวแรก (เช่น Chaiwat.N)</span>
                </div>
                <input
                  type="text"
                  required
                  placeholder="เช่น Chaiwat.N, Patcha.S, Pinyada.S"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-xs outline-none focus:border-sky-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Password *</label>
                <input
                  type="password"
                  required
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-xs outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">ชื่อ-นามสกุล *</label>
                <input
                  type="text"
                  required
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-xs outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">อีเมล *</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-xs outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Telegram Chat ID (สำหรับ DM)</label>
                <input
                  type="text"
                  value={formData.telegram_chat_id}
                  onChange={(e) => setFormData({ ...formData, telegram_chat_id: e.target.value })}
                  placeholder="เช่น 123456789"
                  className="w-full px-3 py-2 border rounded-lg text-xs outline-none focus:border-sky-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">กลุ่มผู้ใช้งาน (Group)</label>
                <select
                  value={formData.group_id}
                  onChange={(e) => setFormData({ ...formData, group_id: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-xs outline-none focus:border-sky-500"
                >
                  <option value="">-- ไม่ระบุกลุ่ม --</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  กลุ่มสินค้าที่รับผิดชอบ (Assigned Item Groups)
                </label>
                <input
                  type="text"
                  value={formData.allowed_item_groups}
                  onChange={(e) => setFormData({ ...formData, allowed_item_groups: e.target.value })}
                  placeholder="เช่น HW หรือ HW,RM-กระจก หรือ * (เห็นทุกกลุ่ม)"
                  className="w-full px-3 py-2 border rounded-lg text-xs outline-none focus:border-sky-500 font-mono"
                />
                <p className="text-[10px] text-slate-400 mt-0.5">ระบุรหัสกลุ่มสินค้า หรือคั่นด้วยจุลภาค เช่น <code>HW,RM-กระจก</code> หรือ <code>*</code> เพื่อดูทั้งหมด</p>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-semibold"
                >
                  บันทึก
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit User */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-slate-900">
              แก้ไขผู้ใช้งาน: <span className="text-sky-600">{showEditModal.username}</span>
            </h3>
            <form onSubmit={handleUpdateUser} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">ชื่อ-นามสกุล *</label>
                <input
                  type="text"
                  required
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-xs outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">อีเมล *</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-xs outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Telegram Chat ID (สำหรับ DM)</label>
                <input
                  type="text"
                  value={formData.telegram_chat_id}
                  onChange={(e) => setFormData({ ...formData, telegram_chat_id: e.target.value })}
                  placeholder="เช่น 123456789"
                  className="w-full px-3 py-2 border rounded-lg text-xs outline-none focus:border-sky-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">กลุ่มผู้ใช้งาน (Group)</label>
                <select
                  value={formData.group_id}
                  onChange={(e) => setFormData({ ...formData, group_id: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-xs outline-none focus:border-sky-500"
                >
                  <option value="">-- ไม่ระบุกลุ่ม --</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  กลุ่มสินค้าที่รับผิดชอบ (Assigned Item Groups)
                </label>
                <input
                  type="text"
                  value={formData.allowed_item_groups}
                  onChange={(e) => setFormData({ ...formData, allowed_item_groups: e.target.value })}
                  placeholder="เช่น HW หรือ HW,RM-กระจก หรือ * (เห็นทุกกลุ่ม)"
                  className="w-full px-3 py-2 border rounded-lg text-xs outline-none focus:border-sky-500 font-mono"
                />
                <p className="text-[10px] text-slate-400 mt-0.5">ระบุรหัสกลุ่มสินค้า หรือคั่นด้วยจุลภาค เช่น <code>HW,RM-กระจก</code> หรือ <code>*</code> เพื่อดูทั้งหมด</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">สถานะผู้ใช้งาน (Status)</label>
                <select
                  value={formData.is_active ? "true" : "false"}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.value === "true" })}
                  className="w-full px-3 py-2 border rounded-lg text-xs outline-none focus:border-sky-500"
                >
                  <option value="true">เปิดใช้งาน (Active)</option>
                  <option value="false">ระงับใช้งาน (Inactive / Deactivated)</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowEditModal(null)}
                  className="px-4 py-2 border rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-semibold"
                >
                  บันทึกแก้ไข
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Reset Password */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-900">
              รีเซ็ตรหัสผ่าน: <span className="text-sky-600">{showResetModal.username}</span>
            </h3>
            <form onSubmit={handleResetPassword} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">รหัสผ่านใหม่ *</label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="กรอกรหัสผ่านใหม่"
                  className="w-full px-3 py-2 border rounded-lg text-xs outline-none focus:border-sky-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowResetModal(null)}
                  className="px-4 py-2 border rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-semibold"
                >
                  ยืนยัน
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
