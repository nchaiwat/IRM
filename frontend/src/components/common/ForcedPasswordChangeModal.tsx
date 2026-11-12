'use client';

import React, { useState } from 'react';
import { api } from '@/lib/api';
import { Eye, EyeOff, ShieldAlert, CheckCircle2, XCircle, KeyRound } from 'lucide-react';

interface ForcedPasswordChangeModalProps {
  username: string;
  isExpired?: boolean;
  onSuccess: () => Promise<void>;
}

export function ForcedPasswordChangeModal({
  username,
  isExpired = true,
  onSuccess,
}: ForcedPasswordChangeModalProps) {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Password Complexity Validation Rules (ISO 27001 / CIAM v2.12.0 หมวด G)
  const isLenValid = newPassword.length >= 8 && newPassword.length <= 16;
  const isUpperValid = /[A-Z]/.test(newPassword);
  const isLowerValid = /[a-z]/.test(newPassword);
  const isDigitValid = /[0-9]/.test(newPassword);
  const isSpecialValid = /[!@#$%^&*()_+\-=\[\]{}|;:,.<>?/~`]/.test(newPassword);
  const isNoUserValid =
    !username ||
    username.trim().length < 3 ||
    !newPassword.toLowerCase().includes(username.trim().toLowerCase());
  const isMatchValid = newPassword.length > 0 && newPassword === confirmPassword;

  const isAllValid =
    isLenValid &&
    isUpperValid &&
    isLowerValid &&
    isDigitValid &&
    isSpecialValid &&
    isNoUserValid &&
    isMatchValid;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAllValid) {
      setError('กรุณาตั้งรหัสผ่านให้ตรงตามเกณฑ์ความปลอดภัยทั้งหมด');
      return;
    }
    if (oldPassword === newPassword) {
      setError('รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านเดิม');
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      await api.post('/api/auth/local/change-password', {
        old_password: oldPassword,
        new_password: newPassword,
        confirm_password: confirmPassword,
      });

      // Refresh current user in AuthContext to clear must_change_password flag
      await onSuccess();
    } catch (err: any) {
      console.error('Password change error:', err);
      const detail =
        err.response?.data?.detail ||
        err.message ||
        'เกิดข้อผิดพลาดในการเปลี่ยนรหัสผ่าน กรุณาลองใหม่อีกครั้ง';
      setError(detail);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[10000] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-start gap-3.5 mb-4">
          <div className="w-11 h-11 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shrink-0 shadow-sm">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 tracking-tight">
              {isExpired ? '⚠️ รหัสผ่านหมดอายุตามรอบความปลอดภัย 90 วัน' : '🔒 จำเป็นต้องเปลี่ยนรหัสผ่าน'}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
              บัญชีท้องถิ่น <b className="text-slate-800">@{username}</b> ต้องเปลี่ยนรหัสผ่านใหม่ตามมาตรฐาน ISO 27001 ก่อนเข้าใช้งานระบบ
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
            <XCircle className="w-4 h-4 shrink-0 text-rose-500" />
            <span>{error}</span>
          </div>
        )}

        {/* Live Complexity Checklist */}
        <div className="mb-4 p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-[11px] space-y-1.5">
          <div className="font-bold text-slate-700 flex items-center gap-1.5 mb-1">
            <KeyRound className="w-3.5 h-3.5 text-slate-500" />
            <span>เกณฑ์ความปลอดภัยรหัสผ่านระดับองค์กร (8 - 16 ตัวอักษร):</span>
          </div>
          <div className="grid grid-cols-2 gap-x-2 gap-y-1">
            <div className={`flex items-center gap-1.5 ${isLenValid ? 'text-emerald-700 font-semibold' : 'text-slate-500'}`}>
              {isLenValid ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> : <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mx-1" />}
              <span>ความยาว 8 - 16 ตัวอักษร</span>
            </div>
            <div className={`flex items-center gap-1.5 ${isUpperValid ? 'text-emerald-700 font-semibold' : 'text-slate-500'}`}>
              {isUpperValid ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> : <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mx-1" />}
              <span>พิมพ์ใหญ่ (A-Z) &ge; 1</span>
            </div>
            <div className={`flex items-center gap-1.5 ${isLowerValid ? 'text-emerald-700 font-semibold' : 'text-slate-500'}`}>
              {isLowerValid ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> : <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mx-1" />}
              <span>พิมพ์เล็ก (a-z) &ge; 1</span>
            </div>
            <div className={`flex items-center gap-1.5 ${isDigitValid ? 'text-emerald-700 font-semibold' : 'text-slate-500'}`}>
              {isDigitValid ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> : <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mx-1" />}
              <span>ตัวเลข (0-9) &ge; 1</span>
            </div>
            <div className={`flex items-center gap-1.5 ${isSpecialValid ? 'text-emerald-700 font-semibold' : 'text-slate-500'}`}>
              {isSpecialValid ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> : <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mx-1" />}
              <span>อักขระพิเศษ (!@#$...) &ge; 1</span>
            </div>
            <div className={`flex items-center gap-1.5 ${isNoUserValid ? 'text-emerald-700 font-semibold' : 'text-slate-500'}`}>
              {isNoUserValid ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> : <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mx-1" />}
              <span>ห้ามมี Username</span>
            </div>
          </div>
          {confirmPassword.length > 0 && (
            <div className={`flex items-center gap-1.5 pt-1 border-t border-slate-200/80 ${isMatchValid ? 'text-emerald-700 font-semibold' : 'text-rose-600'}`}>
              {isMatchValid ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> : <XCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />}
              <span>{isMatchValid ? 'รหัสผ่านใหม่ตรงกันเรียบร้อย' : 'รหัสผ่านยืนยันไม่ตรงกัน'}</span>
            </div>
          )}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          {/* Old Password */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              รหัสผ่านเดิม (Current Password) *
            </label>
            <div className="relative">
              <input
                type={showOld ? 'text' : 'password'}
                required
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                placeholder="กรอกรหัสผ่านเดิม"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-sky-500 focus:bg-white transition pr-10"
              />
              <button
                type="button"
                onClick={() => setShowOld(!showOld)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                title={showOld ? 'ซ่อน' : 'แสดง'}
              >
                {showOld ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* New Password */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              รหัสผ่านใหม่ (New Password) *
            </label>
            <div className="relative">
              <input
                type={showNew ? 'text' : 'password'}
                required
                maxLength={16}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="ตั้งรหัสผ่านใหม่ 8-16 ตัวอักษร"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-sky-500 focus:bg-white transition pr-10"
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                title={showNew ? 'ซ่อน' : 'แสดง'}
              >
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              ยืนยันรหัสผ่านใหม่ (Confirm Password) *
            </label>
            <div className="relative">
              <input
                type={showConfirm ? 'text' : 'password'}
                required
                maxLength={16}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="กรอกรหัสผ่านใหม่อีกครั้งให้ตรงกัน"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-sky-500 focus:bg-white transition pr-10"
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                title={showConfirm ? 'ซ่อน' : 'แสดง'}
              >
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={!isAllValid || submitting}
            className="w-full mt-2 py-2.5 px-4 bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs rounded-xl shadow-md shadow-sky-600/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
          >
            {submitting ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <span>บันทึกรหัสผ่านใหม่ (มีอายุ 90 วัน)</span>
            )}
          </button>
        </form>

        <p className="text-[10px] text-center text-slate-400 mt-4">
          นโยบายความปลอดภัยข้อมูล Window Asia Public Company Limited · ISO 27001
        </p>
      </div>
    </div>
  );
}
