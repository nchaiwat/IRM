'use client';

import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { SystemSetting } from '@/types';
import {
  Settings,
  Save,
  CheckCircle2,
  AlertCircle,
  Mail,
  Clock,
  Server,
  Send,
  RefreshCw,
  Download,
  Copy,
  Check,
  Code,
  Key,
  ShieldCheck,
  Cpu,
  FileCode,
  Eye,
  EyeOff,
  Building2,
  X,
} from 'lucide-react';

export default function SettingsPage() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingTelegram, setTestingTelegram] = useState(false);
  const [testingMorningSummary, setTestingMorningSummary] = useState(false);
  const [testingSap, setTestingSap] = useState(false);
  const [syncingSap, setSyncingSap] = useState(false);
  const [testEmailRecipient, setTestEmailRecipient] = useState('');
  const [puTestEmailRecipient, setPuTestEmailRecipient] = useState('');
  const [testingEmail, setTestingEmail] = useState(false);
  const [testingPuRemind, setTestingPuRemind] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Active Directory (AD) State
  const [showAdTestModal, setShowAdTestModal] = useState(false);
  const [adTestUsername, setAdTestUsername] = useState('');
  const [adTestPassword, setAdTestPassword] = useState('');
  const [testingAd, setTestingAd] = useState(false);
  const [adTestResult, setAdTestResult] = useState<{ success: boolean; message: string; data?: any } | null>(null);
  const [showSecretKey, setShowSecretKey] = useState(false);

  // SAP Agent State
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);
  const [regeneratingToken, setRegeneratingToken] = useState(false);
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [generatedScriptCode, setGeneratedScriptCode] = useState('');
  const [loadingScript, setLoadingScript] = useState(false);

  const [currentOrigin, setCurrentOrigin] = useState('https://irm.windowasia.com');

  // Central Management API State
  const [copiedMgmtKey, setCopiedMgmtKey] = useState(false);
  const [regeneratingMgmtKey, setRegeneratingMgmtKey] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setCurrentOrigin(window.location.origin);
    }
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await api.get<SystemSetting[]>('/api/settings');
      const settingsMap: Record<string, string> = {};
      res.data.forEach((s) => {
        settingsMap[s.key] = s.value || '';
      });
      setSettings(settingsMap);
    } catch (err) {
      console.error('Failed to fetch settings:', err);
      setMessage({ type: 'error', text: 'ไม่สามารถโหลดข้อมูลการตั้งค่าได้' });
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (key: string, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    const payload = Object.entries(settings).map(([key, value]) => ({
      key,
      value,
    }));

    try {
      await api.put('/api/settings', { settings: payload });
      setMessage({ type: 'success', text: 'บันทึกการตั้งค่าเรียบร้อยแล้ว' });
    } catch (err) {
      console.error('Failed to save settings:', err);
      setMessage({ type: 'error', text: 'เกิดข้อผิดพลาดในการบันทึกการตั้งค่า' });
    } finally {
      setSaving(false);
    }
  };

  const handleManualSyncSap = async () => {
    setSyncingSap(true);
    setMessage(null);
    try {
      const res = await api.post('/api/sap/sync-now');
      setMessage({ type: 'success', text: res.data.message || 'Sync ข้อมูลจาก SAP B1 สำเร็จเรียบร้อยแล้ว' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.detail || 'เกิดข้อผิดพลาดในการ Sync ข้อมูลจาก SAP' });
    } finally {
      setSyncingSap(false);
    }
  };

  const handleTestTelegramGroup = async () => {
    setTestingTelegram(true);
    setMessage(null);
    try {
      const res = await api.post('/api/settings/test-telegram-group');
      setMessage({ type: 'success', text: res.data.message || 'ส่งข้อความทดสอบเข้ากลุ่ม Telegram สำเร็จแล้ว!' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.detail || 'ส่งข้อความ Telegram ล้มเหลว' });
    } finally {
      setTestingTelegram(false);
    }
  };

  const handleTestMorningSummary = async () => {
    setTestingMorningSummary(true);
    setMessage(null);
    try {
      const res = await api.post('/api/settings/test-telegram-morning-summary');
      const successText = res.data.message || 'ส่งสรุปสถานะประจำวัน (Morning Summary) เข้า Telegram สำเร็จแล้ว!';
      setMessage({ type: 'success', text: successText });
      alert(`✅ ${successText}`);
    } catch (err: any) {
      const errText = err.response?.data?.detail || 'เกิดข้อผิดพลาดในการส่งสรุปสถานะประจำวัน Telegram';
      setMessage({ type: 'error', text: errText });
      alert(`❌ ${errText}`);
    } finally {
      setTestingMorningSummary(false);
    }
  };

  const handleTestSapConnection = async () => {
    setTestingSap(true);
    setMessage(null);
    try {
      const res = await api.post('/api/settings/test-sap-connection');
      setMessage({ type: 'success', text: res.data.message || 'เชื่อมต่อฐานข้อมูล SAP B1 สำเร็จแล้ว!' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.detail || 'เชื่อมต่อ SAP B1 ล้มเหลว' });
    } finally {
      setTestingSap(false);
    }
  };

  const handleTestEmail = async () => {
    if (!testEmailRecipient) return;
    setTestingEmail(true);
    setMessage(null);
    try {
      const res = await api.post('/api/settings/test-email', {
        recipient_email: testEmailRecipient,
        smtp_host: settings.smtp_host,
        smtp_port: parseInt(settings.smtp_port) || undefined,
        smtp_user: settings.smtp_user,
        smtp_password: settings.smtp_password,
      });
      setMessage({ type: 'success', text: res.data.message || 'ส่งอีเมลทดสอบเรียบร้อยแล้ว!' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.detail || 'การทดสอบส่งอีเมลล้มเหลว' });
    } finally {
      setTestingEmail(false);
    }
  };

  const handleTestPuRemindEmail = async () => {
    const emailToSend = puTestEmailRecipient.trim() || testEmailRecipient.trim();
    if (!emailToSend) {
      alert('⚠️ กรุณาระบุอีเมลผู้รับทดสอบสรุปงานในช่อง "อีเมลผู้รับทดสอบสรุปงาน" ก่อนกดส่ง');
      setMessage({ type: 'error', text: 'กรุณาระบุอีเมลผู้รับทดสอบสรุปงานก่อนกดส่ง' });
      return;
    }
    setTestingPuRemind(true);
    setMessage(null);
    try {
      const res = await api.post<{ message: string; unconfirmed_items: number; today_deliveries: number }>('/api/settings/test-pu-remind-email', {
        recipient_email: emailToSend,
      });
      const successText = `${res.data.message} (ยังไม่ Confirm: ${res.data.unconfirmed_items} รายการ, ส่งวันนี้: ${res.data.today_deliveries} รายการ)`;
      setMessage({ type: 'success', text: successText });
      alert(`✅ ${successText}`);
    } catch (err: any) {
      const errText = err.response?.data?.detail || 'เกิดข้อผิดพลาดในการทดสอบส่งอีเมลสรุปงานจัดซื้อ';
      setMessage({ type: 'error', text: errText });
      alert(`❌ ${errText}`);
    } finally {
      setTestingPuRemind(false);
    }
  };

  const handleTestAd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adTestUsername.trim() || !adTestPassword) {
      alert('⚠️ กรุณากรอก Username และ Password สำหรับทดสอบเข้าสู่ระบบ AD');
      return;
    }
    setTestingAd(true);
    setAdTestResult(null);
    try {
      const res = await api.post('/api/settings/test-ad-connection', {
        username: adTestUsername.trim(),
        password: adTestPassword,
        gateway_url: settings.ad_gateway_url || '',
        app_id: settings.ad_app_id || '',
        secret_key: settings.ad_secret_key || '',
        forwarded_ip: settings.ad_forwarded_ip || '157.173.219.153',
      });
      setAdTestResult({
        success: true,
        message: res.data.message || 'ทดสอบยืนยันสิทธิ์กับ AD สำเร็จ',
        data: res.data.raw_response,
      });
    } catch (err: any) {
      setAdTestResult({
        success: false,
        message: err.response?.data?.detail || 'การทดสอบเชื่อมต่อ AD ล้มเหลว',
        data: err.response?.data,
      });
    } finally {
      setTestingAd(false);
    }
  };

  const handleRegenerateIngestToken = async () => {
    if (!confirm('คุณแน่ใจหรือไม่ว่าต้องการสุ่มสร้าง Ingest Secret Token ใหม่? (สคริปต์ที่รันอยู่บน On-Premise จะต้องอัปเดต Token ใหม่ด้วย)')) {
      return;
    }
    setRegeneratingToken(true);
    try {
      const res = await api.post('/api/sap/regenerate-ingest-token');
      setSettings((prev) => ({ ...prev, sap_ingest_token: res.data.ingest_token }));
      setMessage({ type: 'success', text: 'สร้าง Ingest Secret Token ใหม่สำเร็จเรียบร้อยแล้ว' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.detail || 'สร้าง Ingest Token ล้มเหลว' });
    } finally {
      setRegeneratingToken(false);
    }
  };

  const handleRegenerateMgmtKey = async () => {
    if (!confirm('คุณแน่ใจหรือไม่ว่าต้องการสร้าง Central Management API Key ใหม่? (ระบบส่วนกลางจะต้องเปลี่ยน Key ใหม่ตามด้วย)')) {
      return;
    }
    setRegeneratingMgmtKey(true);
    try {
      const res = await api.post('/api/settings/regenerate-management-api-key');
      setSettings((prev) => ({ ...prev, management_api_key: res.data.management_api_key }));
      setMessage({ type: 'success', text: 'สร้าง Central Management API Key ใหม่สำเร็จแล้ว' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.detail || 'สร้าง Management API Key ล้มเหลว' });
    } finally {
      setRegeneratingMgmtKey(false);
    }
  };

  const handleDownloadAgentScript = async () => {
    try {
      const res = await api.get('/api/sap/generate-agent-script?download=true', { responseType: 'blob' });
      
      // Extract filename from header if available
      let filename = `irm_agent_sync_v${Number(settings.sap_agent_version || 1) + 1}.py`;
      const disposition = res.headers['content-disposition'];
      if (disposition && disposition.includes('filename=')) {
        filename = disposition.split('filename=')[1].replace(/["']/g, '').trim();
      }

      const blob = new Blob([res.data], { type: 'text/x-python' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      setMessage({ type: 'success', text: `ดาวน์โหลดไฟล์ ${filename} เรียบร้อยแล้ว (บันทึกประวัติ Version ลง Transaction Log)` });
      fetchSettings(); // Refresh settings to show incremented version
    } catch (err) {
      console.error('Download script error:', err);
      setMessage({ type: 'error', text: 'ไม่สามารถดาวน์โหลด Script ได้' });
    }
  };

  const handleViewOrCopyScript = async (onlyCopy = false) => {
    setLoadingScript(true);
    try {
      const res = await api.get<{ script: string; filename: string; version: string; ingest_url: string; ingest_token: string }>('/api/sap/generate-agent-script');
      setGeneratedScriptCode(res.data.script);
      const fname = res.data.filename || `irm_agent_sync_v${settings.sap_agent_version || '1'}.py`;
      if (onlyCopy) {
        navigator.clipboard.writeText(res.data.script);
        setCopiedScript(true);
        setTimeout(() => setCopiedScript(false), 2500);
        setMessage({ type: 'success', text: `คัดลอกโค้ด ${fname} ลง Clipboard แล้ว!` });
      } else {
        setShowCodeModal(true);
      }
    } catch (err) {
      console.error('Fetch script error:', err);
      setMessage({ type: 'error', text: 'ไม่สามารถดึงข้อมูล Script ได้' });
    } finally {
      setLoadingScript(false);
    }
  };

  const currentAgentVer = settings.sap_agent_version || '1';
  const currentAgentFilename = `irm_agent_sync_v${currentAgentVer}.py`;
  const ingestEndpointUrl = `${currentOrigin}/api/sap/inbound-push`;
  const currentToken = settings.sap_ingest_token || 'tok_irm_ingest_sec_8a39f029b4c12e87';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-500">
        <div className="w-6 h-6 border-2 border-sky-500 border-t-transparent rounded-full animate-spin mr-3"></div>
        <span>กำลังโหลดการตั้งค่า...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl pb-16">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2.5">
            <Settings className="w-7 h-7 text-sky-600" />
            <span>ตั้งค่าระบบ (System Setting)</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            กำหนดค่าการส่งอีเมล (SMTP), Telegram Bot, SAP B1 Read-Only Connection, Ingest Agent สำหรับ On-Premise, และรอบเวลา Sync อัตโนมัติ
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          type="button"
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 text-white font-bold text-sm rounded-xl shadow-lg shadow-sky-500/20 transition disabled:opacity-50"
        >
          {saving ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          ) : (
            <Save className="w-4 h-4" />
          )}
          <span>{saving ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่าทั้งหมด'}</span>
        </button>
      </div>

      {/* Quick Jump Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-200">
        <a
          href="#sec-agent"
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-white border border-slate-200 text-slate-700 hover:bg-sky-50 hover:text-sky-700 hover:border-sky-300 transition shadow-sm whitespace-nowrap"
        >
          <Cpu className="w-4 h-4 text-indigo-600" />
          <span>1. SAP On-Premise Agent</span>
        </a>
        <a
          href="#sec-email"
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-white border border-slate-200 text-slate-700 hover:bg-sky-50 hover:text-sky-700 hover:border-sky-300 transition shadow-sm whitespace-nowrap"
        >
          <Mail className="w-4 h-4 text-sky-600" />
          <span>2. การส่งอีเมล (SMTP)</span>
        </a>
        <a
          href="#sec-telegram"
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-white border border-slate-200 text-slate-700 hover:bg-sky-50 hover:text-sky-700 hover:border-sky-300 transition shadow-sm whitespace-nowrap"
        >
          <Send className="w-4 h-4 text-sky-500" />
          <span>3. Telegram Bot & Group</span>
        </a>
        <a
          href="#sec-schedule"
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-white border border-slate-200 text-slate-700 hover:bg-sky-50 hover:text-sky-700 hover:border-sky-300 transition shadow-sm whitespace-nowrap"
        >
          <Clock className="w-4 h-4 text-amber-600" />
          <span>4. รอบเวลาและวันส่งแจ้งเตือน</span>
        </a>
        <a
          href="#sec-sap-sql"
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-white border border-slate-200 text-slate-700 hover:bg-sky-50 hover:text-sky-700 hover:border-sky-300 transition shadow-sm whitespace-nowrap"
        >
          <Server className="w-4 h-4 text-emerald-600" />
          <span>5. SAP B1 MS SQL Connection</span>
        </a>
      </div>

      {/* Alert Message */}
      {message && (
        <div
          className={`p-4 rounded-xl border flex items-center gap-3 text-xs font-semibold animate-fadeIn ${
            message.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* ================================================================= */}
        {/* Section 1: SAP On-Premise Outbound Sync Agent (NEW FEATURE)      */}
        {/* ================================================================= */}
        <div className="bg-gradient-to-br from-white to-slate-50 rounded-2xl p-6 border-2 border-sky-200 shadow-md space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-sky-100 gap-3">
            <div className="flex items-center gap-2.5 text-slate-800 font-bold text-lg">
              <Cpu className="w-6 h-6 text-sky-600" />
              <div>
                <span>1. SAP On-Premise Sync Agent ({currentAgentFilename})</span>
                <span className="ml-2.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-sky-100 text-sky-700 border border-sky-200 uppercase tracking-wider">
                  Recommended for VPS
                </span>
                <span className="ml-2 px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-300 text-[11px] font-mono font-bold">
                  v{currentAgentVer}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDownloadAgentScript}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs rounded-xl shadow-md shadow-sky-600/20 transition-all"
                title={`ดาวน์โหลดไฟล์ ${currentAgentFilename} พร้อมคอนฟิก`}
              >
                <Download className="w-4 h-4" />
                <span>ดาวน์โหลด Script ({`irm_agent_sync_v${Number(currentAgentVer) + 1}.py`})</span>
              </button>

              <button
                type="button"
                onClick={() => handleViewOrCopyScript(false)}
                disabled={loadingScript}
                className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-semibold text-xs rounded-xl transition shadow-sm"
              >
                <Eye className="w-4 h-4 text-slate-500" />
                <span>ดูโค้ด Script</span>
              </button>
            </div>
          </div>

          <div className="bg-sky-50/70 border border-sky-200/80 rounded-xl p-4 text-xs text-sky-900 leading-relaxed space-y-1.5">
            <p className="font-bold flex items-center gap-1.5 text-sky-800">
              <ShieldCheck className="w-4 h-4 text-sky-600" />
              <span>สถาปัตยกรรม Outbound HTTPS Push (ปลอดภัย 100% โดยไม่ต้องแก้ Firewall หรือเปิด Inbound Port ที่โรงงาน):</span>
            </p>
            <p className="text-slate-600">
              นำไฟล์ <code className="px-1.5 py-0.5 bg-white border border-sky-200 rounded font-mono font-bold text-sky-700">{currentAgentFilename}</code> ไปวางบน Server ในโรงงาน (On-Premise) ที่เชื่อมต่อกับ SAP B1 SQL Server ได้ สคริปต์จะคิวรีข้อมูล PO ตาม 7 กลุ่มสินค้า และยิงข้อมูลออกมาหา IRM บน VPS Hostinger ทางพอร์ต HTTPS (443) โดยอัตโนมัติ พร้อมระบุ Version <code className="text-emerald-700 font-bold">v{currentAgentVer}</code> ให้ระบบบันทึก Log ตรงกัน
            </p>
          </div>

          {/* Endpoint URL & Secret Key */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-2">
              <label className="block text-xs font-bold text-slate-700">
                🌐 Ingest API Endpoint (เป้าหมายบน VPS Hostinger)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={ingestEndpointUrl}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-700 select-all outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(ingestEndpointUrl);
                    setCopiedUrl(true);
                    setTimeout(() => setCopiedUrl(false), 2000);
                  }}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1 transition"
                  title="คัดลอก Endpoint URL"
                >
                  {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedUrl ? 'คัดลอกแล้ว' : 'คัดลอก'}</span>
                </button>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-amber-500" />
                  <span>Secret Ingest Token (X-IRM-Ingest-Key)</span>
                </label>
                <button
                  type="button"
                  onClick={handleRegenerateIngestToken}
                  disabled={regeneratingToken}
                  className="text-[11px] text-sky-600 hover:text-sky-800 font-semibold flex items-center gap-1 transition"
                >
                  <RefreshCw className={`w-3 h-3 ${regeneratingToken ? 'animate-spin' : ''}`} />
                  <span>สุ่มสร้าง Token ใหม่</span>
                </button>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={settings.sap_ingest_token || currentToken}
                  onChange={(e) => handleChange('sap_ingest_token', e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-800 font-bold select-all outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(settings.sap_ingest_token || currentToken);
                    setCopiedToken(true);
                    setTimeout(() => setCopiedToken(false), 2000);
                  }}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1 transition"
                  title="คัดลอก Token"
                >
                  {copiedToken ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedToken ? 'คัดลอกแล้ว' : 'คัดลอก'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Reference Schedule & Notice */}
          <div className="bg-amber-50/80 border border-amber-200/80 rounded-xl p-4 text-xs text-amber-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2 font-bold text-amber-950">
                <Clock className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <span>รอบเวลาแนะนำสำหรับตั้ง Task Scheduler (Reference Schedule):</span>
                <span className="px-2.5 py-0.5 rounded-md bg-amber-200/80 text-amber-900 font-extrabold text-xs font-mono">
                  {settings.sap_sync_time || '04:00'} น.
                </span>
              </div>
              <p className="text-amber-800/90 text-[11px] leading-relaxed">
                ไฟล์ Python ที่ดาวน์โหลดจะเป็น Script ชนิด <strong>Single-Run (รันครั้งเดียวจบ)</strong> โดยไม่มีการใส่เวลาไว้ในโค้ด เพื่อให้ Admin สามารถนำไปตั้งเวลาใน Windows Task Scheduler หรือ Linux Cron ตามรอบเวลาที่ต้องการได้อย่างอิสระ
              </p>
            </div>
            <div className="text-[11px] text-amber-700 bg-white/80 px-3 py-1.5 rounded-lg border border-amber-200 flex-shrink-0 font-medium">
              กำหนดเวลาหลักได้ที่หัวข้อ 4 ด้านล่าง
            </div>
          </div>
        </div>

        {/* ================================================================= */}
        {/* Section 2: Email Configuration (SMTP)                            */}
        {/* ================================================================= */}
        <div id="sec-email" className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4 scroll-mt-6">
          {/* Implementation Safety Banner */}
          <div className="bg-red-50/90 border-2 border-red-200 rounded-xl p-4 flex items-start gap-3 text-xs text-red-900 shadow-sm">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-red-950 text-sm flex items-center gap-2">
                <span>🛡️ โหมดระงับการส่งอีเมลอัตโนมัติช่วง Implementation (Safe Guard Active)</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-red-200 text-red-900 uppercase">
                  LOCKED
                </span>
              </p>
              <p className="text-red-800 mt-1 leading-relaxed">
                ระบบได้ทำการ <strong>ระงับและล็อก (Hard-Lock) การส่งอีเมลอัตโนมัติหา Supplier ตามรอบ Schedule โดยเด็ดขาด</strong> เพื่อป้องกันไม่ให้มีการส่งอีเมลจริงหาคู่ค้าภายนอกในช่วงทดสอบและติดตั้งระบบ
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-2">
            <div className="flex items-center gap-2 text-slate-800 font-bold text-base">
              <Mail className="w-5 h-5 text-sky-600" />
              <span>2. ตั้งค่าการส่งอีเมล (SMTP Config)</span>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="email"
                placeholder="อีเมลผู้รับทดสอบ"
                value={testEmailRecipient}
                onChange={(e) => setTestEmailRecipient(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs outline-none focus:border-sky-500 w-44 font-semibold text-slate-800"
              />
              <button
                type="button"
                onClick={handleTestEmail}
                disabled={testingEmail || !testEmailRecipient}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 font-semibold text-xs rounded-lg transition disabled:opacity-50"
              >
                {testingEmail ? (
                  <div className="w-3.5 h-3.5 border-2 border-sky-600 border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <Mail className="w-3.5 h-3.5" />
                )}
                <span>ทดสอบส่ง Email</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">SMTP Host</label>
              <input
                type="text"
                value={settings.smtp_host || ''}
                onChange={(e) => handleChange('smtp_host', e.target.value)}
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:bg-white focus:ring-1 focus:ring-sky-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">SMTP Port</label>
              <input
                type="text"
                value={settings.smtp_port || ''}
                onChange={(e) => handleChange('smtp_port', e.target.value)}
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:bg-white focus:ring-1 focus:ring-sky-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Sender Email</label>
              <input
                type="text"
                value={settings.smtp_user || ''}
                onChange={(e) => handleChange('smtp_user', e.target.value)}
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:bg-white focus:ring-1 focus:ring-sky-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">SMTP Password / App Password</label>
              <input
                type="password"
                value={settings.smtp_password || ''}
                onChange={(e) => handleChange('smtp_password', e.target.value)}
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:bg-white focus:ring-1 focus:ring-sky-500 outline-none"
              />
            </div>
          </div>

          {/* Sub-Card: PU Reminder Email with Excel Attachment */}
          <div className="bg-sky-50/60 border border-sky-200/80 rounded-xl p-4 mt-4 space-y-3">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-sky-100">
              <div>
                <h4 className="text-xs font-bold text-sky-950 flex items-center gap-1.5">
                  <Mail className="w-4 h-4 text-sky-600" />
                  <span>ระบบส่งอีเมลสรุปงานและของส่งวันนี้ให้จัดซื้อ (PU Reminder Email with 2-Sheet Excel)</span>
                </h4>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  ส่งอีเมลสรุปจำนวน PO/Item ที่ยังไม่ Confirm และของที่มีกำหนดส่งมอบวันนี้ พร้อมแนบไฟล์ Excel 2 Sheet
                </p>
              </div>

              {/* Dedicated Test Email Input & Consistent Button */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <input
                  type="email"
                  placeholder="อีเมลผู้รับทดสอบสรุปงาน"
                  value={puTestEmailRecipient}
                  onChange={(e) => setPuTestEmailRecipient(e.target.value)}
                  className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs outline-none focus:border-sky-500 w-48 font-semibold text-slate-800 shadow-2xs"
                />
                <button
                  type="button"
                  onClick={handleTestPuRemindEmail}
                  disabled={testingPuRemind}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 font-semibold text-xs rounded-lg transition disabled:opacity-50 shadow-2xs"
                >
                  {testingPuRemind ? (
                    <div className="w-3.5 h-3.5 border-2 border-sky-600 border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <Mail className="w-3.5 h-3.5" />
                  )}
                  <span>ทดสอบส่งอีเมลสรุปงาน</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  สวิตช์เปิด/ปิดฟังก์ชันส่งอีเมลสรุปจัดซื้อ
                </label>
                <div className="flex items-center gap-2 p-2 bg-white border border-slate-300 rounded-lg">
                  <input
                    type="checkbox"
                    id="pu_remind_mail_enabled"
                    checked={settings.pu_remind_mail_enabled === 'true'}
                    onChange={(e) => handleChange('pu_remind_mail_enabled', e.target.checked ? 'true' : 'false')}
                    className="w-4 h-4 text-sky-600 rounded focus:ring-sky-500"
                  />
                  <label htmlFor="pu_remind_mail_enabled" className="text-xs font-bold text-slate-800 cursor-pointer">
                    {settings.pu_remind_mail_enabled === 'true' ? '🟢 เปิดใช้งานส่งอีเมลอัตโนมัติ' : '⚪ ปิดใช้งาน (Disabled)'}
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  เวลาส่งอีเมลสรุปประจำวัน (HH:MM)
                </label>
                <input
                  type="text"
                  value={settings.pu_remind_mail_time || '08:30'}
                  onChange={(e) => handleChange('pu_remind_mail_time', e.target.value)}
                  placeholder="08:30"
                  className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-1 focus:ring-sky-500 outline-none font-mono"
                />
              </div>
            </div>
          </div>
        </div>

        {/* ================================================================= */}
        {/* Section 3: Telegram Bot Notification Configuration              */}
        {/* ================================================================= */}
        <div id="sec-telegram" className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4 scroll-mt-6">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2 text-slate-800 font-bold text-base">
              <Send className="w-5 h-5 text-sky-500" />
              <span>3. ตั้งค่าการแจ้งเตือน Telegram</span>
            </div>

            <button
              type="button"
              onClick={handleTestTelegramGroup}
              disabled={testingTelegram}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 font-semibold text-xs rounded-lg transition disabled:opacity-50"
            >
              {testingTelegram ? (
                <div className="w-3.5 h-3.5 border-2 border-sky-600 border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              <span>ทดสอบส่งข้อความเข้ากลุ่ม Telegram</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">API Base URL</label>
              <input
                type="text"
                value={settings.telegram_api_url || 'https://api.telegram.org'}
                onChange={(e) => handleChange('telegram_api_url', e.target.value)}
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:bg-white focus:ring-1 focus:ring-sky-500 outline-none font-mono text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Bot Token ID</label>
              <input
                type="text"
                value={settings.telegram_bot_token || ''}
                onChange={(e) => handleChange('telegram_bot_token', e.target.value)}
                placeholder="8231754616:AAHcITgZR6_Gc8XJx..."
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:bg-white focus:ring-1 focus:ring-sky-500 outline-none font-mono text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Group ID</label>
              <input
                type="text"
                value={settings.telegram_group_id || ''}
                onChange={(e) => handleChange('telegram_group_id', e.target.value)}
                placeholder="-5394050672"
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:bg-white focus:ring-1 focus:ring-sky-500 outline-none font-mono text-xs"
              />
            </div>
          </div>

          {/* Sub-Card: Telegram Morning Daily Briefing Schedule & Controls */}
          <div className="bg-gradient-to-br from-amber-50/80 via-sky-50/50 to-indigo-50/60 border border-amber-200/80 rounded-xl p-4 mt-4 space-y-3">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-amber-200/60">
              <div>
                <h4 className="text-xs font-bold text-slate-900 flex items-center gap-2">
                  <span className="text-base">🌅</span>
                  <span>รายงานสรุปสถานะระบบประจำวัน (Telegram Morning Daily Summary)</span>
                </h4>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  รายงานสรุป 4 หมวด: สถานะ PO/Item ค้างส่ง, Item Master เพิ่มใหม่, Supplier Master และ History ปิดยอด
                </p>
              </div>

              {/* Dedicated Test Morning Summary Button */}
              <button
                type="button"
                onClick={handleTestMorningSummary}
                disabled={testingMorningSummary}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 font-semibold text-xs rounded-lg transition disabled:opacity-50 flex-shrink-0 cursor-pointer"
              >
                {testingMorningSummary ? (
                  <div className="w-3.5 h-3.5 border-2 border-sky-600 border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                <span>ทดสอบส่ง Morning Summary ทันที</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  สวิตช์เปิด/ปิดรายงานประจำวัน (Morning Summary)
                </label>
                <div className="flex items-center gap-2 p-2 bg-white border border-slate-300 rounded-lg">
                  <input
                    type="checkbox"
                    id="telegram_morning_summary_enabled"
                    checked={settings.telegram_morning_summary_enabled !== 'false'}
                    onChange={(e) => handleChange('telegram_morning_summary_enabled', e.target.checked ? 'true' : 'false')}
                    className="w-4 h-4 text-amber-600 rounded focus:ring-amber-500"
                  />
                  <label htmlFor="telegram_morning_summary_enabled" className="text-xs font-bold text-slate-800 cursor-pointer">
                    {settings.telegram_morning_summary_enabled !== 'false' ? '🟢 เปิดใช้งานส่งแจ้งเตือนประจำวัน' : '⚪ ปิดใช้งาน (Disabled)'}
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  เวลากำหนดส่งรายงานสรุปประจำวัน (HH:MM)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={settings.telegram_morning_summary_time || '08:00'}
                    onChange={(e) => handleChange('telegram_morning_summary_time', e.target.value)}
                    placeholder="08:00"
                    className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-1 focus:ring-amber-500 outline-none font-mono font-bold text-slate-800"
                  />
                  <span className="text-xs font-semibold text-slate-500 whitespace-nowrap">น. (เวลาไทย)</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ================================================================= */}
        {/* Section 4: Schedule Settings                                     */}
        {/* ================================================================= */}
        <div id="sec-schedule" className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4 scroll-mt-6">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100 text-slate-800 font-bold text-base">
            <Clock className="w-5 h-5 text-indigo-600" />
            <span>4. กำหนดรอบเวลาและวันส่งแจ้งเตือน</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">เวลาส่ง Email/Telegram (HH:MM)</label>
              <input
                type="text"
                value={settings.mail_send_time || '08:00'}
                onChange={(e) => handleChange('mail_send_time', e.target.value)}
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:bg-white focus:ring-1 focus:ring-sky-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">เวลา Sync ข้อมูล SAP (HH:MM)</label>
              <input
                type="text"
                value={settings.sap_sync_time || '04:00'}
                onChange={(e) => handleChange('sap_sync_time', e.target.value)}
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:bg-white focus:ring-1 focus:ring-sky-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">ระยะเวลาเก็บประวัติ (วัน)</label>
              <input
                type="number"
                value={settings.history_retention_days ?? ''}
                onChange={(e) => handleChange('history_retention_days', e.target.value)}
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:bg-white focus:ring-1 focus:ring-sky-500 outline-none"
              />
            </div>

            <div className="flex flex-col justify-end">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                สวิตช์ส่ง Email อัตโนมัติ (Schedule)
              </label>
              <div className="flex items-center gap-2 p-2 bg-red-50 border border-red-200 rounded-lg">
                <input
                  type="checkbox"
                  id="mail_schedule_enabled"
                  checked={settings.mail_schedule_enabled === 'true'}
                  onChange={(e) => handleChange('mail_schedule_enabled', e.target.checked ? 'true' : 'false')}
                  className="w-4 h-4 text-red-600 rounded focus:ring-red-500"
                />
                <label htmlFor="mail_schedule_enabled" className="text-xs font-bold text-red-800 cursor-pointer">
                  {settings.mail_schedule_enabled === 'true' ? '🟢 เปิดใช้งาน' : '🛑 ระงับ (ช่วง Implement)'}
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* ================================================================= */}
        {/* Section 5: SAP Connection Credentials (For Script Generation)    */}
        {/* ================================================================= */}
        <div id="sec-sap-sql" className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4 scroll-mt-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2 text-slate-800 font-bold text-base">
              <Server className="w-5 h-5 text-emerald-600" />
              <span>5. กำหนดค่าการเชื่อมต่อ SAP B1 MS SQL On-Premise</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">SAP Host / IP *</label>
              <input
                type="text"
                value={settings.sap_host || 'wa-dbs2.wa.net'}
                onChange={(e) => handleChange('sap_host', e.target.value)}
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:bg-white focus:ring-1 focus:ring-sky-500 outline-none font-mono text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">SAP Port *</label>
              <input
                type="text"
                value={settings.sap_port || '1433'}
                onChange={(e) => handleChange('sap_port', e.target.value)}
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:bg-white focus:ring-1 focus:ring-sky-500 outline-none font-mono text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">SAP Database Name *</label>
              <input
                type="text"
                value={settings.sap_database || 'SBO_COMPANY_DB'}
                onChange={(e) => handleChange('sap_database', e.target.value)}
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:bg-white focus:ring-1 focus:ring-sky-500 outline-none font-mono text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">SQL Read-Only Username *</label>
              <input
                type="text"
                value={settings.sap_user || 'irm_readonly'}
                onChange={(e) => handleChange('sap_user', e.target.value)}
                placeholder="เช่น irm_readonly หรือ sa"
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:bg-white focus:ring-1 focus:ring-sky-500 outline-none font-mono text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">SQL Read-Only Password *</label>
              <input
                type="password"
                value={settings.sap_password || ''}
                onChange={(e) => handleChange('sap_password', e.target.value)}
                placeholder="รหัสผ่าน SQL Server"
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:bg-white focus:ring-1 focus:ring-sky-500 outline-none font-mono text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">SAP Item Groups (JSON Array) *</label>
              <input
                type="text"
                value={settings.sap_item_groups || '[113, 115]'}
                onChange={(e) => handleChange('sap_item_groups', e.target.value)}
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:bg-white focus:ring-1 focus:ring-sky-500 outline-none font-mono text-xs"
              />
            </div>
          </div>
        </div>

        {/* ================================================================= */}
        {/* Section 6: Active Directory (AD Sync Agent Gateway) Settings      */}
        {/* ================================================================= */}
        <div id="sec-ad-gateway" className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4 scroll-mt-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2 text-slate-800 font-bold text-base">
              <Building2 className="w-5 h-5 text-indigo-600" />
              <span>6. ตั้งค่าการเชื่อมต่อ Active Directory (AD Sync Agent Gateway)</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setAdTestResult(null);
                  setShowAdTestModal(true);
                }}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-semibold text-xs rounded-lg transition cursor-pointer"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                <span>ทดสอบการ Authen AD</span>
              </button>
            </div>
          </div>

          <p className="text-xs text-slate-500">
            กำหนดค่าการเชื่อมต่อระหว่างระบบ IRM กับ Identity Gateway (AD Sync Agent) เพื่อยืนยันรหัสผ่านของผู้ใช้ผ่าน Active Directory ภายในองค์กร
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                AD Gateway Endpoint URL *
              </label>
              <input
                type="text"
                value={settings.ad_gateway_url || ''}
                onChange={(e) => handleChange('ad_gateway_url', e.target.value)}
                placeholder="เช่น https://192.168.12.11:3100/api/v2/login"
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:bg-white focus:ring-1 focus:ring-sky-500 outline-none font-mono text-xs"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">API Endpoint ตามข้อกำหนด (POST /api/v2/login ผ่าน HTTPS Port 3100)</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                App ID (app_id) *
              </label>
              <input
                type="text"
                value={settings.ad_app_id || ''}
                onChange={(e) => handleChange('ad_app_id', e.target.value)}
                placeholder="Registered ID in registry.json"
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:bg-white focus:ring-1 focus:ring-sky-500 outline-none font-mono text-xs"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">รหัสระบบที่ลงทะเบียนไว้ใน registry.json บนเซิร์ฟเวอร์ AD</span>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700">
                  Secret Key (secret_key) *
                </label>
                <button
                  type="button"
                  onClick={() => setShowSecretKey(!showSecretKey)}
                  className="text-[11px] text-sky-600 hover:text-sky-700 flex items-center gap-1 font-medium cursor-pointer"
                >
                  {showSecretKey ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  <span>{showSecretKey ? 'ซ่อน' : 'แสดง'}</span>
                </button>
              </div>
              <input
                type={showSecretKey ? 'text' : 'password'}
                value={settings.ad_secret_key || ''}
                onChange={(e) => handleChange('ad_secret_key', e.target.value)}
                placeholder="Corresponding Secret Key"
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:bg-white focus:ring-1 focus:ring-sky-500 outline-none font-mono text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Origin IP Header (X-Forwarded-For) *
              </label>
              <input
                type="text"
                value={settings.ad_forwarded_ip || '157.173.219.153'}
                onChange={(e) => handleChange('ad_forwarded_ip', e.target.value)}
                placeholder="157.173.219.153"
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:bg-white focus:ring-1 focus:ring-sky-500 outline-none font-mono text-xs"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">IP ของเซิร์ฟเวอร์ที่อยู่ใน allowed_ips ของ AD Gateway (VPS: 157.173.219.153)</span>
            </div>
          </div>

          <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <span className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                <span>เปิดใช้งานระบบ Active Directory (AD Master Switch)</span>
              </span>
              <p className="text-[11px] text-indigo-800">
                เปิดให้ระบบส่งคำขอตรวจสอบรหัสผ่านไปยัง AD Gateway สำหรับผู้ใช้ที่มีการเปิด Checkbox ไว้ใน User Management
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={settings.ad_enabled === 'true'}
                onChange={(e) => handleChange('ad_enabled', e.target.checked ? 'true' : 'false')}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
          </div>
        </div>

        {/* ================================================================= */}
        {/* Section 7: Centralized Identity Management API                    */}
        {/* ================================================================= */}
        <div id="sec-central-iam" className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4 scroll-mt-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2 text-slate-800 font-bold text-base">
              <Key className="w-5 h-5 text-emerald-600" />
              <span>7. Centralized Identity Management API (SCIM-Like Integration)</span>
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              Active / Ready
            </span>
          </div>

          <p className="text-xs text-slate-500 leading-relaxed">
            API มาตรฐานสำหรับ Central Management App ยิงเข้ามาเพื่อดึงข้อมูลรายชื่อพนักงานทั้งหมด (Reconciliation) หรือส่งคำสั่งระงับการใช้งานบัญชีผู้ใช้เมื่อพนักงานลาออก (Instant Offboarding / Disable Account)
          </p>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2 text-xs">
            <div className="font-bold text-slate-800 flex items-center justify-between">
              <span>Endpoints ให้บริการ:</span>
              <a
                href={`${currentOrigin}/docs`}
                target="_blank"
                rel="noreferrer"
                className="text-sky-600 hover:underline text-[11px] font-semibold"
              >
                ดู Swagger API Documentation ↗
              </a>
            </div>
            <div className="space-y-1.5 font-mono text-[11px] text-slate-600">
              <div className="flex items-center gap-2 bg-white px-2.5 py-1.5 rounded-lg border border-slate-200">
                <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px]">GET</span>
                <span className="text-slate-800">{currentOrigin}/api/v1/directory/accounts</span>
              </div>
              <div className="flex items-center gap-2 bg-white px-2.5 py-1.5 rounded-lg border border-slate-200">
                <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-bold text-[10px]">PATCH</span>
                <span className="text-slate-800">{currentOrigin}/api/v1/directory/accounts/&#123;username&#125;/status</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700">
                  X-Management-API-Key (Machine-to-Machine Secret Token) *
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(settings.management_api_key || '');
                      setCopiedMgmtKey(true);
                      setTimeout(() => setCopiedMgmtKey(false), 2000);
                    }}
                    className="text-[11px] text-sky-600 hover:text-sky-700 flex items-center gap-1 font-medium cursor-pointer"
                  >
                    {copiedMgmtKey ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedMgmtKey ? 'คัดลอกแล้ว' : 'คัดลอก Key'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleRegenerateMgmtKey}
                    disabled={regeneratingMgmtKey}
                    className="text-[11px] text-amber-600 hover:text-amber-700 flex items-center gap-1 font-medium cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3 h-3 ${regeneratingMgmtKey ? 'animate-spin' : ''}`} />
                    <span>สร้าง Key ใหม่</span>
                  </button>
                </div>
              </div>
              <input
                type="text"
                value={settings.management_api_key || ''}
                onChange={(e) => handleChange('management_api_key', e.target.value)}
                placeholder="sec_irm_mgmt_..."
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:bg-white focus:ring-1 focus:ring-sky-500 outline-none font-mono text-xs"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">
                นำค่านี้ไปใส่ใน Header ของคำขอ: <code>X-Management-API-Key: &lt;Key&gt;</code>
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                IP Whitelist (เครื่องที่ได้รับอนุญาตให้ยิงคำขอ)
              </label>
              <input
                type="text"
                value={settings.management_allowed_ips || ''}
                onChange={(e) => handleChange('management_allowed_ips', e.target.value)}
                placeholder="เช่น 157.173.219.153, 192.168.12.11 (เว้นว่างไว้เพื่อรับทุก IP)"
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:bg-white focus:ring-1 focus:ring-sky-500 outline-none font-mono text-xs"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">
                ระบุ IP ของ Central Management Server คั่นด้วยจุลภาค หรือเว้นว่างไว้เพื่ออนุญาตทุก IP
              </span>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-semibold text-sm rounded-xl shadow-lg shadow-sky-600/20 transition-all disabled:opacity-50"
          >
            {saving ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>บันทึกการตั้งค่า</span>
          </button>
        </div>
      </form>

      {/* Code Viewer Modal */}
      {showCodeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 text-slate-100 rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl border border-slate-700">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <FileCode className="w-5 h-5 text-sky-400" />
                <span className="font-bold text-sm text-white">{currentAgentFilename} (Generated Source Code)</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(generatedScriptCode);
                    setCopiedScript(true);
                    setTimeout(() => setCopiedScript(false), 2000);
                  }}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
                >
                  {copiedScript ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedScript ? 'คัดลอกแล้ว' : 'คัดลอกโค้ด'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowCodeModal(false)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-6 overflow-y-auto font-mono text-xs text-emerald-300 bg-slate-950/80 leading-relaxed whitespace-pre selection:bg-sky-500 selection:text-white">
              {generatedScriptCode}
            </div>
          </div>
        </div>
      )}

      {/* AD Test Modal */}
      {showAdTestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-slate-900 text-base">ทดสอบการ Authentication กับ AD</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAdTestModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              ทดลองส่งคำขอเข้าสู่ระบบไปยัง AD Sync Agent Gateway ตาม Parameter ที่ตั้งค่าไว้ เพื่อตรวจสอบว่าการเชื่อมต่อและสิทธิ์การเข้าใช้งานถูกต้อง
            </p>

            <form onSubmit={handleTestAd} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  AD Username (sAMAccountName) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="เช่น Somchai.P"
                  value={adTestUsername}
                  onChange={(e) => setAdTestUsername(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-xs outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  AD User Password *
                </label>
                <input
                  type="password"
                  required
                  placeholder="รหัสผ่านผู้ใช้บน Active Directory"
                  value={adTestPassword}
                  onChange={(e) => setAdTestPassword(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-xs outline-none focus:border-indigo-500"
                />
              </div>

              {adTestResult && (
                <div
                  className={`p-3 rounded-xl border text-xs leading-relaxed space-y-1 ${
                    adTestResult.success
                      ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                      : 'bg-rose-50 text-rose-900 border-rose-200'
                  }`}
                >
                  <p className="font-bold flex items-center gap-1.5">
                    {adTestResult.success ? <span>✅ สำเร็จ</span> : <span>❌ ล้มเหลว</span>}
                  </p>
                  <p>{adTestResult.message}</p>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAdTestModal(false)}
                  className="px-4 py-2 border rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  ปิด
                </button>
                <button
                  type="submit"
                  disabled={testingAd}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition disabled:opacity-50 cursor-pointer"
                >
                  {testingAd ? (
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <ShieldCheck className="w-3.5 h-3.5" />
                  )}
                  <span>{testingAd ? 'กำลังทดสอบ...' : 'เริ่มทดสอบ Authen'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
