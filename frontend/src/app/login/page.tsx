'use client';

import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Lock, User, AlertCircle, ArrowRight, Eye, EyeOff, ShieldCheck, Sparkles, AlertTriangle, ShieldAlert } from 'lucide-react';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [ssoLoading, setSsoLoading] = useState(false);
  const [ssoConfig, setSsoConfig] = useState<{
    sso_enabled: boolean;
    break_glass_active: boolean;
    ciam_base_url?: string;
  } | null>(null);
  const { login } = useAuth();

  // Load remembered username from localStorage on mount & check SSO status
  useEffect(() => {
    const savedUsername = localStorage.getItem('irm_remembered_username');
    const savedRememberState = localStorage.getItem('irm_remember_me');

    if (savedUsername) {
      setUsername(savedUsername);
    }
    if (savedRememberState !== null) {
      setRememberMe(savedRememberState === 'true');
    }

    // Fetch SSO status
    api.get('/api/auth/sso/config')
      .then((res) => {
        setSsoConfig(res.data);
        if (res.data?.sso_enabled && res.data?.ciam_base_url) {
          localStorage.setItem('irm_ciam_portal_url', res.data.ciam_base_url + '/portal');
        } else {
          localStorage.removeItem('irm_ciam_portal_url');
        }
      })
      .catch((err) => {
        console.warn('Unable to load SSO config:', err);
      });
  }, []);

  const handleCiamSso = async () => {
    if (ssoConfig?.break_glass_active) {
      setError('ระบบกำลังทำงานในโหมดฉุกเฉิน (Break-Glass Mode) กรุณาใช้รหัสผ่านเฉพาะระบบ IRM หรือ AD');
      return;
    }
    if (ssoConfig && !ssoConfig.sso_enabled) {
      setError('ระบบ Central IAM Single Sign-On ถูกปิดใช้งานชั่วคราว');
      return;
    }
    setError(null);
    setSsoLoading(true);
    try {
      const redirectUri = window.location.origin + '/auth/callback';
      const res = await api.post('/api/auth/sso/authorize-url', { redirect_uri: redirectUri });
      if (res.data?.authorize_url) {
        // Store PKCE code_verifier and state in session storage
        sessionStorage.setItem('sso_code_verifier', res.data.code_verifier);
        sessionStorage.setItem('sso_state', res.data.state);
        // Redirect browser to Central IAM Authorize Portal
        window.location.href = res.data.authorize_url;
      } else {
        setError('ไม่สามารถรับ Authorize URL จาก Central IAM ได้');
      }
    } catch (err: any) {
      console.error('SSO Initiation error:', err);
      const detail =
        err.response?.data?.detail ||
        err.message ||
        'ไม่สามารถเชื่อมต่อไปยัง Central IAM ได้ (ระบบอาจอยู่ในโหมด Break-Glass)';
      setError(detail);
    } finally {
      setSsoLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError('กรุณากรอกชื่อผู้ใช้และรหัสผ่าน');
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      const res = await api.post('/api/auth/login', { username, password });

      // Save or clear remembered username
      if (rememberMe) {
        localStorage.setItem('irm_remembered_username', username);
        localStorage.setItem('irm_remember_me', 'true');
      } else {
        localStorage.removeItem('irm_remembered_username');
        localStorage.setItem('irm_remember_me', 'false');
      }

      // Record local auth provider in browser storage
      localStorage.setItem('irm_auth_provider', 'local');

      await login(res.data.access_token, res.data.refresh_token);
    } catch (err: any) {
      console.error('Login error:', err);
      if (err.response) {
        const detail = err.response.data?.detail;
        if (typeof detail === 'string') {
          setError(detail);
        } else if (Array.isArray(detail)) {
          setError(detail.map((d: any) => d.msg).join(', '));
        } else {
          setError(`HTTP Error ${err.response.status}: ${err.response.statusText}`);
        }
      } else if (err.request) {
        setError('ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้ (Network Error)');
      } else {
        setError(err.message || 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Subtle Gradient Blobs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-sky-500/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl relative z-10">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 mx-auto mb-4 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center font-extrabold text-white text-2xl shadow-lg shadow-sky-500/30">
            IRM
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Incoming Raw Material</h1>
          <p className="text-sm text-slate-400 mt-1">ระบบติดตามการรับวัตถุดิบ ฝ่ายจัดซื้อ</p>
        </div>

        {/* Break-Glass Active Notice - only when SSO is enabled and break-glass triggered */}
        {ssoConfig?.sso_enabled && ssoConfig?.break_glass_active && (
          <div className="mb-5 p-3.5 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-start gap-2.5 text-amber-300 text-xs">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
            <div className="leading-relaxed">
              <strong className="block font-semibold text-amber-200">โหมดฉุกเฉิน (Break-Glass Active)</strong>
              ระบบกำลังทำงานในโหมดฉุกเฉิน กรุณาใช้รหัสผ่าน Active Directory หรือ Local ของ IRM
            </div>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="mb-5 p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-3 text-red-400 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Desktop SSO Button (Compact & Balanced Option) */}
        {ssoConfig?.sso_enabled && !ssoConfig.break_glass_active && (
          <div className="hidden md:block mb-5">
            <button
              type="button"
              onClick={handleCiamSso}
              disabled={ssoLoading}
              className="w-full py-2.5 px-3 bg-gradient-to-r from-blue-600/90 via-indigo-600/90 to-sky-600/90 hover:from-blue-500 hover:to-sky-500 text-white font-medium text-xs rounded-xl shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 transition-all active:scale-98 disabled:opacity-50 cursor-pointer"
            >
              {ssoLoading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4 text-cyan-300" />
                  <span>เข้าสู่ระบบด้วย Window Asia SSO</span>
                  <Sparkles className="w-3.5 h-3.5 text-amber-300 ml-0.5" />
                </>
              )}
            </button>
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-800"></div>
              </div>
              <div className="relative flex justify-center text-[11px]">
                <span className="bg-slate-900 px-3 text-slate-500">หรือเข้าสู่ระบบด้วยชื่อผู้ใช้งาน</span>
              </div>
            </div>
          </div>
        )}

        {/* Standard Login Form (Always visible & familiar on Mobile 100%) */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Username Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">ชื่อผู้ใช้งาน (Username)</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <User className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="ชื่อผู้ใช้ AD หรือ Local (เช่น Somchai.P, admin)"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition"
              />
            </div>
          </div>

          {/* Password Input with Show/Hide Toggle */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">รหัสผ่าน (Password)</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="กรอกรหัสผ่าน"
                className="w-full pl-10 pr-10 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200 transition"
                title={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Remember Me Checkbox */}
          <div className="flex items-center justify-between text-xs">
            <label className="flex items-center gap-2 text-slate-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded bg-slate-950 border-slate-700 text-sky-500 focus:ring-sky-500 focus:ring-offset-slate-900 cursor-pointer"
              />
              <span>จำฉันไว้ในระบบ (Remember Me)</span>
            </label>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full mt-2 py-2.5 px-4 bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs rounded-xl shadow-lg shadow-sky-600/25 flex items-center justify-center gap-2 transition-all active:scale-98 disabled:opacity-50 cursor-pointer"
          >
            {submitting ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <>
                <span>เข้าสู่ระบบ (Sign In)</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Mobile Secondary SSO Option (Subtle & Compact below form) */}
        {ssoConfig?.sso_enabled && !ssoConfig.break_glass_active && (
          <div className="block md:hidden pt-4 mt-1">
            <div className="relative mb-3">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-800"></div>
              </div>
              <div className="relative flex justify-center text-[10px]">
                <span className="bg-slate-900 px-2.5 text-slate-500">หรือเข้าสู่ระบบด้วย</span>
              </div>
            </div>
            <button
              type="button"
              onClick={handleCiamSso}
              disabled={ssoLoading}
              className="w-full py-2.5 px-3 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 text-slate-300 hover:text-white text-xs rounded-xl flex items-center justify-center gap-2 transition-all active:scale-98 disabled:opacity-50 cursor-pointer"
            >
              {ssoLoading ? (
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <ShieldCheck className="w-3.5 h-3.5 text-sky-400" />
                  <span>Window Asia SSO</span>
                  <Sparkles className="w-3 h-3 text-amber-300" />
                </>
              )}
            </button>
          </div>
        )}

        <div className="mt-5 text-center text-[10px] text-slate-500 font-mono">
          {ssoConfig?.sso_enabled && ssoConfig?.break_glass_active
            ? "ISO 27001 Business Continuity & Break-Glass Ready"
            : "Window Asia Public Company Limited · IRM System"}
        </div>
      </div>
    </div>
  );
}
