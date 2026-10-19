'use client';

import React, { useState, useEffect, useRef } from 'react';
import { api } from '@/lib/api';
import {
  Sparkles,
  X,
  Send,
  Bot,
  User as UserIcon,
  RotateCcw,
  ShieldCheck,
  ChevronDown,
  Minimize2,
} from 'lucide-react';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export function SpokeCopilotWidget() {
  const [enabled, setEnabled] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Check if AI Copilot is enabled and configured before rendering
  const checkStatus = () => {
    api
      .get('/api/settings/ai')
      .then((res) => {
        // Show widget when enabled is true (or ai_copilot_enabled is on)
        setEnabled(Boolean(res.data?.enabled ?? res.data?.ai_copilot_enabled));
      })
      .catch(() => {
        setEnabled(false);
      });
  };

  useEffect(() => {
    checkStatus();

    const handleCustomUpdate = (e: any) => {
      if (e?.detail?.enabled !== undefined) {
        setEnabled(Boolean(e.detail.enabled));
      } else {
        checkStatus();
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkStatus();
      }
    };

    window.addEventListener('irm_ai_settings_updated', handleCustomUpdate);
    window.addEventListener('storage', checkStatus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('irm_ai_settings_updated', handleCustomUpdate);
      window.removeEventListener('storage', checkStatus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    if (isOpen && !isMinimized) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, isMinimized]);

  if (!enabled) return null;

  const handleSend = async (textToSend?: string) => {
    const query = (textToSend || input).trim();
    if (!query || loading) return;

    const userMsg: ChatMessage = { role: 'user', content: query };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput('');
    setLoading(true);

    try {
      const res = await api.post('/api/ai/chat', {
        messages: updatedMessages,
      });
      const assistantReply =
        res.data?.message?.content || 'ขออภัยครับ ไม่สามารถรับคำตอบจากระบบได้ในขณะนี้';
      setMessages([...updatedMessages, { role: 'assistant', content: assistantReply }]);
    } catch (err: any) {
      const errDetail =
        err.response?.data?.detail || 'เกิดข้อผิดพลาดในการเชื่อมต่อกับผู้ช่วย AI กรุณาลองใหม่อีกครั้ง';
      setMessages([
        ...updatedMessages,
        {
          role: 'assistant',
          content: `⚠️ ${errDetail}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickQuestion = (q: string) => {
    handleSend(q);
  };

  const handleClearChat = () => {
    setMessages([]);
  };

  return (
    <div className="print:hidden">
      {/* Floating Trigger Button */}
      {!isOpen && (
        <button
          onClick={() => {
            setIsOpen(true);
            setIsMinimized(false);
          }}
          className="fixed bottom-6 right-6 z-[9999] px-4 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-full shadow-xl shadow-purple-600/30 flex items-center gap-2.5 transition transform hover:scale-105 cursor-pointer"
          title="เปิดผู้ช่วย AI ประจำระบบ IRM"
        >
          <div className="relative">
            <Bot className="w-5 h-5 text-white" />
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-400 rounded-full animate-ping"></span>
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-400 rounded-full"></span>
          </div>
          <span className="text-xs font-bold tracking-wide">IRM Copilot</span>
          <Sparkles className="w-3.5 h-3.5 text-amber-300" />
        </button>
      )}

      {/* Floating Chat Modal */}
      {isOpen && (
        <div
          className={`fixed bottom-6 right-6 z-[9999] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden transition-all duration-200 ${
            isMinimized
              ? 'w-80 h-14'
              : 'w-[92vw] sm:w-[420px] h-[580px] max-h-[85vh]'
          }`}
        >
          {/* Header */}
          <div className="px-4 py-3 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex items-center justify-between border-b border-slate-700 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-purple-600/30 border border-purple-500/40 flex items-center justify-center text-purple-300">
                <Bot className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-1.5 font-bold text-xs">
                  <span>IRM AI Copilot</span>
                  <span className="px-1.5 py-0.2 rounded text-[9px] bg-purple-500/20 text-purple-300 border border-purple-400/30">
                    Read-Only
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  <span>Zero-Training Guaranteed</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setIsMinimized(!isMinimized)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700/50 transition cursor-pointer"
                title={isMinimized ? 'ขยายหน้าต่าง' : 'ย่อหน้าต่าง'}
              >
                {isMinimized ? <ChevronDown className="w-4 h-4 rotate-180" /> : <Minimize2 className="w-3.5 h-3.5" />}
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700/50 transition cursor-pointer"
                title="ปิดหน้าต่างแชท"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {!isMinimized && (
            <>
              {/* Messages Body */}
              <div className="flex-1 p-3.5 overflow-y-auto space-y-3 bg-slate-50 text-xs">
                {messages.length === 0 && (
                  <div className="text-center py-6 space-y-3">
                    <div className="w-12 h-12 mx-auto rounded-2xl bg-purple-100 border border-purple-200 flex items-center justify-center text-purple-600 shadow-sm">
                      <Sparkles className="w-6 h-6" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="font-bold text-slate-800 text-sm">ยินดีต้อนรับสู่ IRM AI Copilot</h4>
                      <p className="text-[11px] text-slate-500 max-w-[280px] mx-auto leading-relaxed">
                        สอบถามข้อมูลใบสั่งซื้อ (PO), กำหนดการส่งมอบ, ยอดค้างส่ง หรือข้อมูลคู่ค้าได้แบบทันที
                      </p>
                    </div>

                    <div className="pt-2 text-left space-y-1.5">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-1">
                        คำถามแนะนำ:
                      </span>
                      {[
                        'สรุปภาพรวม PO ค้างส่งวันนี้',
                        'รายการที่เกินกำหนดส่งมอบ (Overdue)',
                        'ตรวจสอบของเข้าวันนี้',
                        'มีรายการไหนที่ Supplier ตอบกลับแล้วบ้าง?',
                      ].map((promptText, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleQuickQuestion(promptText)}
                          className="w-full text-left p-2 rounded-xl bg-white hover:bg-purple-50 border border-slate-200 hover:border-purple-200 text-slate-700 hover:text-purple-700 text-xs transition cursor-pointer flex items-center justify-between shadow-2xs group"
                        >
                          <span>{promptText}</span>
                          <span className="text-purple-400 group-hover:translate-x-0.5 transition-transform">→</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {messages.map((m, idx) => (
                  <div
                    key={idx}
                    className={`flex items-start gap-2 ${
                      m.role === 'user' ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    {m.role === 'assistant' && (
                      <div className="w-6 h-6 rounded-full bg-purple-600 text-white flex items-center justify-center shrink-0 mt-0.5">
                        <Bot className="w-3.5 h-3.5" />
                      </div>
                    )}
                    <div
                      className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed whitespace-pre-wrap ${
                        m.role === 'user'
                          ? 'bg-purple-600 text-white rounded-tr-xs shadow-sm font-medium'
                          : 'bg-white text-slate-800 border border-slate-200 rounded-tl-xs shadow-2xs'
                      }`}
                    >
                      {m.content}
                    </div>
                    {m.role === 'user' && (
                      <div className="w-6 h-6 rounded-full bg-slate-300 text-slate-700 flex items-center justify-center shrink-0 mt-0.5">
                        <UserIcon className="w-3.5 h-3.5" />
                      </div>
                    )}
                  </div>
                ))}

                {loading && (
                  <div className="flex items-start gap-2">
                    <div className="w-6 h-6 rounded-full bg-purple-600 text-white flex items-center justify-center shrink-0 mt-0.5">
                      <Bot className="w-3.5 h-3.5" />
                    </div>
                    <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-xs px-3.5 py-2.5 text-xs text-slate-500 flex items-center gap-2 shadow-2xs">
                      <div className="w-3.5 h-3.5 border-2 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
                      <span>กำลังประมวลผลข้อมูล...</span>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input Area */}
              <div className="p-2.5 bg-white border-t border-slate-200">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSend();
                  }}
                  className="flex items-center gap-1.5"
                >
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="พิมพ์คำถามเกี่ยวกับ PO, กำหนดส่ง..."
                    className="flex-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 focus:bg-white focus:border-purple-500 outline-none transition"
                    disabled={loading}
                  />
                  <button
                    type="submit"
                    disabled={loading || !input.trim()}
                    className="p-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl disabled:opacity-40 transition shadow-sm cursor-pointer"
                    title="ส่งข้อความ"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                  {messages.length > 0 && (
                    <button
                      type="button"
                      onClick={handleClearChat}
                      className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                      title="ล้างการสนทนา"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  )}
                </form>

                <div className="pt-2 flex items-center justify-between text-[10px] text-slate-400 px-1">
                  <span className="flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-emerald-500" />
                    <span>Strict Read-Only &bull; ISO 27001</span>
                  </span>
                  <span>Pure Date: dd/mm/yyyy</span>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
