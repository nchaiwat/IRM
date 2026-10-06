'use client';

import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { X, Send, Copy, Check, ExternalLink, RefreshCw, Smartphone, ShieldCheck, AlertCircle, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { api } from '@/lib/api';

interface TelegramSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId?: number;
  targetUserName?: string;
  existingChatId?: string | null;
  onSuccess?: (chatId: string) => void;
}

interface BindTokenData {
  token: string;
  bot_username: string;
  deep_link: string;
  user_id: number;
  full_name: string;
  username: string;
  expires_at: string;
  expires_in_seconds: number;
}

export const TelegramSyncModal: React.FC<TelegramSyncModalProps> = ({
  isOpen,
  onClose,
  userId,
  targetUserName,
  existingChatId,
  onSuccess,
}) => {
  // If user already has a Telegram Chat ID, start in 'status' view, else 'qr_sync'
  const [viewMode, setViewMode] = useState<'status' | 'qr_sync'>('status');

  // Status view states
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // QR Sync view states
  const [loading, setLoading] = useState(false);
  const [tokenData, setTokenData] = useState<BindTokenData | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [status, setStatus] = useState<'pending' | 'completed' | 'expired' | 'error'>('pending');
  const [completedChatId, setCompletedChatId] = useState<string>('');
  const [timeLeft, setTimeLeft] = useState<number>(900);
  const [copied, setCopied] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize view mode and data when modal opens
  useEffect(() => {
    if (isOpen) {
      setTestResult(null);
      if (existingChatId && existingChatId.trim()) {
        setViewMode('status');
      } else {
        setViewMode('qr_sync');
        fetchBindToken();
      }
    } else {
      // Clear timers and state when modal closes
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      setTokenData(null);
      setQrDataUrl('');
      setStatus('pending');
      setTestResult(null);
    }
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [isOpen, existingChatId, userId]);

  // Generate QR Token
  const fetchBindToken = async () => {
    setLoading(true);
    setErrorMessage('');
    setStatus('pending');
    setCompletedChatId('');

    try {
      const endpoint = userId
        ? `/api/users/${userId}/telegram-bind-token`
        : '/api/users/me/telegram-bind-token';
      const res = await api.post<BindTokenData>(endpoint);
      setTokenData(res.data);
      setTimeLeft(res.data.expires_in_seconds || 900);

      // Generate QR Code data URL
      const dataUrl = await QRCode.toDataURL(res.data.deep_link, {
        width: 260,
        margin: 2,
        color: {
          dark: '#0369a1', // Sky-700
          light: '#ffffff',
        },
        errorCorrectionLevel: 'H',
      });
      setQrDataUrl(dataUrl);
    } catch (err: any) {
      console.error('Failed to create Telegram bind token:', err);
      setStatus('error');
      setErrorMessage(err.response?.data?.detail || 'ไม่สามารถสร้างลิงก์เชื่อมต่อ Telegram ได้');
    } finally {
      setLoading(false);
    }
  };

  // Test current Telegram connection health
  const handleTestPing = async () => {
    setTestingConnection(true);
    setTestResult(null);
    try {
      const endpoint = userId
        ? `/api/users/${userId}/test-telegram`
        : '/api/users/me/test-telegram';
      const res = await api.post(endpoint);
      setTestResult({
        success: true,
        message: res.data.message || 'ส่งข้อความทดสอบสำเร็จ! บอทส่งข้อความเข้า Telegram ของคุณเรียบร้อยแล้ว',
      });
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.response?.data?.detail || 'ส่งข้อความไม่สำเร็จ กรุณาตรวจสอบสถานะบอทใน Telegram',
      });
    } finally {
      setTestingConnection(false);
    }
  };

  // Countdown timer for QR code
  useEffect(() => {
    if (viewMode === 'qr_sync' && status === 'pending' && timeLeft > 0) {
      timerIntervalRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            setStatus('expired');
            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [viewMode, status, timeLeft]);

  // Polling for QR status check every 2.5s
  useEffect(() => {
    if (isOpen && viewMode === 'qr_sync' && tokenData?.token && status === 'pending') {
      pollIntervalRef.current = setInterval(async () => {
        try {
          const res = await api.get<{
            status: 'pending' | 'completed' | 'expired';
            telegram_chat_id?: string;
          }>(`/api/users/telegram-bind-status?token=${tokenData.token}`);

          if (res.data.status === 'completed' && res.data.telegram_chat_id) {
            setStatus('completed');
            setCompletedChatId(res.data.telegram_chat_id);
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
            if (onSuccess) {
              onSuccess(res.data.telegram_chat_id);
            }
          } else if (res.data.status === 'expired') {
            setStatus('expired');
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          }
        } catch (err) {
          console.error('Polling Telegram bind status error:', err);
        }
      }, 2500);
    }

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [isOpen, viewMode, tokenData?.token, status]);

  const handleCopyLink = () => {
    if (!tokenData?.deep_link) return;
    navigator.clipboard.writeText(tokenData.deep_link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-sky-50 via-white to-sky-50/50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-sky-600 text-white flex items-center justify-center shadow-xs">
              <Send className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">
                {viewMode === 'status' ? 'สถานะการเชื่อมต่อ Telegram' : 'เชื่อมต่อการแจ้งเตือน Telegram อัตโนมัติ'}
              </h3>
              <p className="text-[11px] text-slate-500">
                {targetUserName ? `ผู้ใช้งาน: คุณ${targetUserName}` : 'ผูกบัญชี Telegram ส่วนบุคคล'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4">
          {/* ========================================================================= */}
          {/* VIEW 1: ALREADY CONNECTED & READY TO USE (No confusing "Waiting for START") */}
          {/* ========================================================================= */}
          {viewMode === 'status' ? (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="py-2 flex flex-col items-center text-center space-y-3">
                <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center ring-8 ring-emerald-50">
                  <ShieldCheck className="w-9 h-9" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-base font-bold text-slate-800 flex items-center justify-center gap-1.5">
                    <span>Telegram พร้อมใช้งานเรียบร้อยแล้ว</span>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 inline-block" />
                  </h4>
                  <p className="text-xs text-slate-600 max-w-xs mx-auto">
                    บัญชีนี้เชื่อมต่อกับระบบ IRM เรียบร้อย และพร้อมรับการแจ้งเตือนยอดวัตถุดิบรายบุคคล (Inbound DMs) ทุกเช้าเวลา 07:30 น.
                  </p>
                </div>
              </div>

              {/* Information Card */}
              <div className="w-full bg-emerald-50/70 border border-emerald-200/90 rounded-xl p-3.5 space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-emerald-800 font-semibold">Telegram Chat ID:</span>
                  <span className="font-mono font-bold text-emerald-950 bg-emerald-100/90 px-2.5 py-0.5 rounded-lg border border-emerald-300/60">
                    {existingChatId}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-emerald-800 font-semibold">สถานะการเชื่อมต่อ:</span>
                  <span className="text-emerald-700 font-bold flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
                    พร้อมใช้งาน (Active)
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-emerald-800 font-semibold">บอทแจ้งเตือน:</span>
                  <span className="text-sky-800 font-bold font-mono">
                    @PRORGBOT
                  </span>
                </div>
              </div>

              {/* Test Message Result Alert Box */}
              {testResult && (
                <div
                  className={`p-3 rounded-xl border text-xs animate-in zoom-in-95 duration-150 ${
                    testResult.success
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-rose-50 border-rose-200 text-rose-800'
                  }`}
                >
                  <p className="font-semibold flex items-center gap-1.5">
                    {testResult.success ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>{testResult.message}</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                        <span>{testResult.message}</span>
                      </>
                    )}
                  </p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="space-y-2 pt-1">
                <button
                  type="button"
                  onClick={handleTestPing}
                  disabled={testingConnection}
                  className="w-full py-2.5 px-4 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {testingConnection ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>กำลังทดสอบส่งข้อความไปยัง Telegram...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>ทดสอบส่งข้อความหาฉัน (Test Message)</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setViewMode('qr_sync');
                    fetchBindToken();
                  }}
                  className="w-full py-2 px-3 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl text-xs font-semibold border border-slate-200 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
                  <span>เปลี่ยนบัญชี Telegram หรือสแกน QR Code ใหม่</span>
                </button>
              </div>
            </div>
          ) : (
            /* ========================================================================= */
            /* VIEW 2: QR SYNC FLOW (For new binding or changing accounts)               */
            /* ========================================================================= */
            <>
              {existingChatId && (
                <button
                  type="button"
                  onClick={() => setViewMode('status')}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-sky-600 transition-colors cursor-pointer mb-1"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>กลับไปยังหน้าสถานะเดิม</span>
                </button>
              )}

              {loading ? (
                <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-500">
                  <RefreshCw className="w-8 h-8 animate-spin text-sky-600" />
                  <p className="text-xs font-semibold">กำลังสร้าง Secure Deep Link QR Code...</p>
                </div>
              ) : status === 'completed' ? (
                <div className="py-6 flex flex-col items-center text-center space-y-4 animate-in zoom-in-95 duration-200">
                  <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center ring-8 ring-emerald-50">
                    <ShieldCheck className="w-9 h-9" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-base font-bold text-slate-800">เชื่อมต่อ Telegram สำเร็จแล้ว!</h4>
                    <p className="text-xs text-slate-600">
                      ระบบได้บันทึกและผูก Chat ID กับบัญชีของคุณเรียบร้อยแล้ว
                    </p>
                  </div>

                  <div className="w-full bg-emerald-50/80 border border-emerald-200 rounded-xl p-3 text-left space-y-1.5">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-emerald-700 font-semibold">Telegram Chat ID:</span>
                      <span className="font-mono font-bold text-emerald-900 bg-emerald-100/80 px-2 py-0.5 rounded">
                        {completedChatId}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-emerald-700 font-semibold">สถานะการรับ DM:</span>
                      <span className="text-emerald-700 font-bold flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
                        พร้อมรับยอดประจำวัน 07:30 น.
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={onClose}
                    className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm transition-colors cursor-pointer"
                  >
                    เสร็จสิ้น (ปิดหน้าต่าง)
                  </button>
                </div>
              ) : status === 'expired' ? (
                <div className="py-8 flex flex-col items-center text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center">
                    <AlertCircle className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-800">ลิงก์และ QR Code หมดอายุ</h4>
                    <p className="text-xs text-slate-500 mt-1">
                      เพื่อความปลอดภัย ลิงก์เชื่อมต่อมีอายุ 15 นาที กรุณากดสร้างใหม่
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={fetchBindToken}
                    className="mt-2 flex items-center gap-1.5 py-2 px-4 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>สร้าง QR Code ใหม่อีกครั้ง</span>
                  </button>
                </div>
              ) : status === 'error' ? (
                <div className="py-8 flex flex-col items-center text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center">
                    <AlertCircle className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-800">เกิดข้อผิดพลาด</h4>
                  <p className="text-xs text-red-600">{errorMessage}</p>
                  <button
                    type="button"
                    onClick={fetchBindToken}
                    className="mt-2 flex items-center gap-1.5 py-2 px-4 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>ลองใหม่อีกครั้ง</span>
                  </button>
                </div>
              ) : (
                <>
                  {/* QR Code Container */}
                  <div className="flex flex-col items-center justify-center p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                    <div className="relative p-2 bg-white rounded-xl shadow-xs border border-slate-200">
                      {qrDataUrl ? (
                        <img
                          src={qrDataUrl}
                          alt="Telegram Deep Link QR Code"
                          className="w-48 h-48 sm:w-52 sm:h-52 object-contain"
                        />
                      ) : (
                        <div className="w-48 h-48 bg-slate-100 animate-pulse rounded-lg" />
                      )}
                      {/* Center Bot Badge */}
                      <div className="absolute inset-x-0 bottom-3 flex justify-center pointer-events-none">
                        <span className="bg-sky-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-xs">
                          @{tokenData?.bot_username || 'PRORGBOT'}
                        </span>
                      </div>
                    </div>

                    <div className="text-center space-y-0.5">
                      <p className="text-xs font-bold text-slate-700 flex items-center justify-center gap-1">
                        <Smartphone className="w-3.5 h-3.5 text-sky-600" />
                        <span>ใช้มือถือเปิดแอป Telegram สแกน QR</span>
                      </p>
                      <p className="text-[11px] text-slate-500">
                        แล้วกดปุ่ม <span className="font-bold text-sky-700">START</span> ที่ด้านล่างห้องแชท
                      </p>
                    </div>
                  </div>

                  {/* Action Buttons: Direct App Open & Copy Link */}
                  <div className="grid grid-cols-2 gap-2">
                    <a
                      href={tokenData?.deep_link || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-1.5 py-2 px-3 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
                      title="เปิดแอปพลิเคชัน Telegram บนอุปกรณ์นี้ทันที"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>เปิดแอป Telegram</span>
                    </a>

                    <button
                      type="button"
                      onClick={handleCopyLink}
                      className="flex items-center justify-center gap-1.5 py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                      title="คัดลอกลิงก์ส่งให้พนักงานผ่าน LINE หรือ Chat"
                    >
                      {copied ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-emerald-700 font-bold">คัดลอกแล้ว!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-slate-500" />
                          <span>คัดลอกลิงก์</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Status Pulse Banner */}
                  <div className="bg-sky-50/70 border border-sky-200/80 rounded-xl p-2.5 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
                      </span>
                      <span className="text-slate-700 font-medium text-[11px]">
                        กำลังรอการกด <b className="text-sky-700">START</b> จาก Telegram...
                      </span>
                    </div>
                    <span className="font-mono text-[11px] text-slate-500 font-semibold bg-white px-2 py-0.5 rounded border border-sky-100">
                      {formatSeconds(timeLeft)}
                    </span>
                  </div>
                </>
              )}
            </>
          )}
        </div>

        {/* Footer Guidance */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
          <span>* ระบบซิงค์อัตโนมัติ ไม่ต้องกรอกตัวเลขด้วยตนเอง</span>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-600 hover:text-slate-900 font-semibold cursor-pointer"
          >
            ปิด
          </button>
        </div>
      </div>
    </div>
  );
};
