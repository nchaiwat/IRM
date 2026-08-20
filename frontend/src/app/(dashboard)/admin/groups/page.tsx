'use client';

import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Group } from '@/types';
import { Shield, Plus, Users, CheckCircle2, XCircle } from 'lucide-react';

export default function GroupsPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

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
      await api.post('/api/groups', { name, description });
      setShowCreateModal(false);
      setName('');
      setDescription('');
      fetchGroups();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'เกิดข้อผิดพลาดในการสร้างกลุ่ม');
    } finally {
      setSubmitting(false);
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
          <p className="text-xs text-slate-500 mt-1">จัดการกลุ่มบทบาทหน้าที่การทำงานในระบบ</p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs rounded-xl shadow-lg shadow-sky-600/20 transition"
        >
          <Plus className="w-4 h-4" />
          <span>เพิ่มกลุ่มใหม่</span>
        </button>
      </div>

      {/* Groups Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {groups.map((g) => (
          <div key={g.id} className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-sky-600" />
                  <span>{g.name}</span>
                </h3>
                <button
                  onClick={() => handleToggleActive(g)}
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                    g.is_active ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'
                  }`}
                >
                  {g.is_active ? <CheckCircle2 className="w-3 h-3 text-emerald-600" /> : <XCircle className="w-3 h-3 text-rose-600" />}
                  <span>{g.is_active ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}</span>
                </button>
              </div>
              <p className="text-xs text-slate-500 mt-2 min-h-[36px]">{g.description || 'ไม่มีคำอธิบาย'}</p>
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
              <div className="flex items-center gap-1.5 font-medium">
                <Users className="w-4 h-4 text-slate-400" />
                <span>จำนวนผู้ใช้งาน:</span>
                <span className="font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md">{g.user_count} คน</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal: Create Group */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-900">เพิ่มกลุ่มผู้ใช้งานใหม่</h3>
            <form onSubmit={handleCreateGroup} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">ชื่อกลุ่ม *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="เช่น PU Supervisor"
                  className="w-full px-3 py-2 border rounded-lg text-xs outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">คำอธิบาย</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="รายละเอียดหน้าที่กลุ่มสิทธิ์"
                  className="w-full px-3 py-2 border rounded-lg text-xs outline-none focus:border-sky-500 h-20"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
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
    </div>
  );
}
