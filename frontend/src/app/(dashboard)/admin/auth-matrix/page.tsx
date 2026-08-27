'use client';

import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { GroupMatrixRow } from '@/types';
import { Lock, Save, CheckCircle2, AlertCircle, Shield, CornerDownRight } from 'lucide-react';

export default function AuthMatrixPage() {
  const { refreshUser } = useAuth();
  const [rows, setRows] = useState<GroupMatrixRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchMatrix();
  }, []);

  const fetchMatrix = async () => {
    try {
      const res = await api.get<GroupMatrixRow[]>('/api/auth-matrix');
      setRows(res.data);
    } catch (err) {
      console.error('Failed to fetch auth matrix:', err);
      setMessage({ type: 'error', text: 'ไม่สามารถโหลดข้อมูลสิทธิ์การใช้งานได้' });
    } finally {
      setLoading(false);
    }
  };

  const handleCheckboxChange = (
    groupId: number,
    menuId: number,
    field: 'can_view' | 'can_create' | 'can_edit' | 'can_delete',
    checked: boolean
  ) => {
    setRows((prevRows) =>
      prevRows.map((row) => {
        if (row.group_id !== groupId) return row;
        const updatedPermissions = row.permissions.map((perm) => {
          if (perm.menu_id !== menuId) return perm;
          return { ...perm, [field]: checked };
        });
        return { ...row, permissions: updatedPermissions };
      })
    );
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

    const entriesToSave: any[] = [];
    rows.forEach((row) => {
      row.permissions.forEach((perm) => {
        entriesToSave.push({
          group_id: row.group_id,
          menu_id: perm.menu_id,
          can_view: perm.can_view,
          can_create: perm.can_create,
          can_edit: perm.can_edit,
          can_delete: perm.can_delete,
        });
      });
    });

    try {
      await api.put('/api/auth-matrix', { entries: entriesToSave });
      await refreshUser();
      setMessage({ type: 'success', text: 'บันทึกสิทธิ์การใช้งานตาราง Auth Matrix เรียบร้อยแล้ว' });
    } catch (err) {
      console.error('Failed to save auth matrix:', err);
      setMessage({ type: 'error', text: 'เกิดข้อผิดพลาดในการบันทึกสิทธิ์การใช้งาน' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-500">
        <div className="w-6 h-6 border-2 border-sky-500 border-t-transparent rounded-full animate-spin mr-3"></div>
        <span>กำลังโหลดตารางสิทธิ์การใช้งาน...</span>
      </div>
    );
  }

  const samplePermissions = rows[0]?.permissions || [];

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2.5">
            <Lock className="w-7 h-7 text-sky-600" />
            <span>ตารางกำหนดสิทธิ์ (Auth Matrix)</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            กำหนดสิทธิ์การเข้าถึงเมนูและการทำรายการ (ดูข้อมูล, เพิ่ม, แก้ไข, ลบ) แยกตามกลุ่มผู้ใช้งาน
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs rounded-xl shadow-lg shadow-sky-600/20 transition disabled:opacity-50"
        >
          {saving ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          ) : (
            <Save className="w-4 h-4" />
          )}
          <span>บันทึกตารางสิทธิ์</span>
        </button>
      </div>

      {/* Message Alert */}
      {message && (
        <div
          className={`p-4 rounded-xl border flex items-center gap-3 text-xs font-semibold ${
            message.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-600" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* Grid Container */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-slate-900 text-slate-200 font-bold border-b border-slate-800">
            <tr>
              <th className="py-4 px-6 min-w-[180px] bg-slate-950 sticky left-0 z-10 border-r border-slate-800">
                กลุ่มผู้ใช้งาน (Group)
              </th>
              {samplePermissions.map((m) => (
                <th key={m.menu_id} className="py-4 px-4 text-center border-r border-slate-800 min-w-[145px]">
                  <div className="flex flex-col items-center gap-1.5">
                    {m.parent_id ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-sky-400 border border-sky-400/30 flex items-center gap-1 font-normal">
                        <CornerDownRight className="w-2.5 h-2.5" /> Sub-menu Admin
                      </span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700 font-normal">
                        เมนูหลัก (Main)
                      </span>
                    )}
                    <span className="font-bold text-slate-100 text-xs">{m.menu_name}</span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => {
              const isAdminGroup = row.group_name.toLowerCase() === 'admin';

              return (
                <tr key={row.group_id} className="hover:bg-slate-50/80 transition">
                  {/* Group Name Column */}
                  <td className="py-4 px-6 font-bold text-slate-900 bg-white sticky left-0 z-10 border-r border-slate-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                    <div className="flex items-center gap-2">
                      <Shield className={`w-4 h-4 ${isAdminGroup ? 'text-sky-600' : 'text-slate-400'}`} />
                      <span>{row.group_name}</span>
                    </div>
                  </td>

                  {/* Menu Permissions Cells */}
                  {row.permissions.map((perm) => (
                    <td key={perm.menu_id} className="py-3 px-4 border-r border-slate-100 align-top">
                      {isAdminGroup ? (
                        <div className="text-center py-2 text-[11px] font-semibold text-emerald-600 bg-emerald-50 rounded-lg border border-emerald-200">
                          Full Access
                        </div>
                      ) : (
                        <div className="space-y-1.5 bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 text-[11px]">
                          <label className="flex items-center gap-2 cursor-pointer hover:text-sky-700">
                            <input
                              type="checkbox"
                              checked={perm.can_view}
                              onChange={(e) =>
                                handleCheckboxChange(row.group_id, perm.menu_id, 'can_view', e.target.checked)
                              }
                              className="rounded border-slate-300 text-sky-600 focus:ring-sky-500 w-3.5 h-3.5"
                            />
                            <span>View</span>
                          </label>

                          <label className="flex items-center gap-2 cursor-pointer hover:text-sky-700">
                            <input
                              type="checkbox"
                              checked={perm.can_create}
                              onChange={(e) =>
                                handleCheckboxChange(row.group_id, perm.menu_id, 'can_create', e.target.checked)
                              }
                              className="rounded border-slate-300 text-sky-600 focus:ring-sky-500 w-3.5 h-3.5"
                            />
                            <span>Create</span>
                          </label>

                          <label className="flex items-center gap-2 cursor-pointer hover:text-sky-700">
                            <input
                              type="checkbox"
                              checked={perm.can_edit}
                              onChange={(e) =>
                                handleCheckboxChange(row.group_id, perm.menu_id, 'can_edit', e.target.checked)
                              }
                              className="rounded border-slate-300 text-sky-600 focus:ring-sky-500 w-3.5 h-3.5"
                            />
                            <span>Edit</span>
                          </label>

                          <label className="flex items-center gap-2 cursor-pointer hover:text-sky-700">
                            <input
                              type="checkbox"
                              checked={perm.can_delete}
                              onChange={(e) =>
                                handleCheckboxChange(row.group_id, perm.menu_id, 'can_delete', e.target.checked)
                              }
                              className="rounded border-slate-300 text-sky-600 focus:ring-sky-500 w-3.5 h-3.5"
                            />
                            <span>Delete</span>
                          </label>
                        </div>
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
