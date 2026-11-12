'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { ShieldCheck, AlertTriangle, RefreshCw } from 'lucide-react';

export default function AuthStartPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const executedRef = useRef(false);

  useEffect(() => {
    if (executedRef.current) return;
    executedRef.current = true;

    const initiateSsoBounce = async () => {
      try {
        const redirectUri = window.location.origin + '/auth/callback';
        const res = await api.post('/api/auth/sso/authorize-url', { redirect_uri: redirectUri });

        if (res.data?.authorize_url) {
          // Store PKCE code_verifier and state in sessionStorage (RFC 7636 / RFC 9700)
          sessionStorage.setItem('sso_code_verifier', res.data.code_verifier);
          sessionStorage.setItem('sso_state', res.data.state);

          // Seamless Bounce to Central IAM Authorize Endpoint (< 400ms auto-approval if session exists)
          window.location.href = res.data.authorize_url;
        } else {
          setError('ไม่สามารถรับ Authorize URL จาก Central IAM ได้');
        }
      } catch (err: any) {
        console.error('SSO Start Bounce error:', err);
        const detail =
          err.response?.data?.detail ||
          err.message ||
          'ไม่สามารถเชื่อมต่อไปยัง Central IAM ได้ (ระบบอาจอยู่ในโหมด Break-Glass)';
        setError(detail);
      }
    };

    initiateSsoBounce();
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl relative z-10 text-center space-y-6">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-sky-500/30">
          <ShieldCheck className="w-8 h-8 text-white" />
        </div>

        <div className="space-y-1">
          <h2 className="text-xl font-bold text-white tracking-tight">
            Central IAM Portal Launch
          </h2>
          <p className="text-xs text-slate-400">
            กำลังเชื่อมต่อและยืนยันตัวตนกับ Central IAM (RFC 9700 Seamless Launch)...
          </p>
        </div>

        {error ? (
          <div className="p-4 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs text-left space-y-3">
            <div className="flex items-center gap-2 font-bold text-rose-200">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>การเริ่มระบบผ่าน SSO ล้มเหลว</span>
            </div>
            <p className="leading-relaxed">{error}</p>
            <button
              onClick={() => router.push('/login')}
              className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-semibold text-xs transition cursor-pointer"
            >
              กลับสู่หน้าล็อกอิน (Break-Glass Login)
            </button>
          </div>
        ) : (
          <div className="space-y-3 py-4">
            <RefreshCw className="w-8 h-8 text-sky-400 animate-spin mx-auto" />
            <p className="text-xs text-slate-300 font-medium">กำลังเตรียมพร้อมเซสชัน...</p>
          </div>
        )}

        <div className="text-[11px] text-slate-500 border-t border-slate-800/80 pt-4">
          ISO 27001 & RFC 9700 Compliant Launchpad
        </div>
      </div>
    </div>
  );
}
