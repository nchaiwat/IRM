'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  BookOpen,
  Compass,
  Check,
  Copy,
  Printer,
  Calendar,
  ClipboardList,
  Package,
  Factory,
  ScrollText,
  Shield,
  Clock,
  Lock,
  Key,
  Database,
  ArrowRight,
  Layers,
  FileCheck,
  Send,
  Bell,
  AlertTriangle,
  UserCheck,
  Sparkles,
  Presentation,
  Share2,
} from 'lucide-react';

export default function SystemBlueprintPage() {
  const [copiedPrompt, setCopiedPrompt] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<string>('all');

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedPrompt(id);
    setTimeout(() => setCopiedPrompt(null), 2500);
  };

  // Prompt 1: Presentation Prompt (Thai)
  const presentationPromptThai = `คุณคือผู้เชี่ยวชาญด้าน System Analyst และ Presentation Designer กรุณาสร้างโครงร่าง Presentation (สไลด์นำเสนอ) เป็นภาษาไทยอย่างมืออาชีพ สำหรับระบบ "IRM (Incoming Raw Material Management System)" ของบริษัท Window Asia Public Company Limited 

ให้จัดทำเนื้อหาจำนวน 10 สไลด์ โทนสีทางการสำหรับองค์กร (Enterprise Navy & Emerald) โดยในแต่ละสไลด์ต้องมี:
1. หัวข้อสไลด์ (Slide Title)
2. วัตถุประสงค์และประเด็นสำคัญ (Key Takeaways)
3. เนื้อหาแบบ Bullet Points ที่กระชับ ได้ใจความ
4. คำแนะนำสำหรับภาพประกอบ/ไอคอน (Visual Guidance)
5. สคริปต์คำพูดของผู้บรรยาย (Speaker Notes)

โครงสร้างสไลด์ทั้ง 10 สไลด์ มีดังนี้:
• สไลด์ที่ 1: หน้าปก — ระบบบริหารจัดการและติดตามการส่งมอบวัตถุดิบ (IRM System)
• สไลด์ที่ 2: ที่มาและปัญหาเดิม (Pain Points) — การขาดข้อมูลวันส่งที่แน่นอน, PO ข้ามเดือน, และการประสานงานแบบ Manual
• สไลด์ที่ 3: สถาปัตยกรรมและภาพรวมการทำงาน (End-to-End Data Pipeline) — การเชื่อมต่อ SAP B1 ➔ IRM ➔ Supplier Portal ➔ QMS
• สไลด์ที่ 4: หน้า Operation (ศูนย์กลางงานจัดซื้อ) — การคุม Estimate Date, การแตกงวดส่ง (Sub-items) และระบบป้องกัน Conflict
• สไลด์ที่ 5: หน้า Calendar & Universal Search — การดูรอบส่งรายเดือนและภาพรวมทั้งปี (รายปี 12 เดือน) พร้อมระบบค้นหาด่วน
• สไลด์ที่ 6: กลไกความปลอดภัย Supplier Portal & Token — ระบบ One-Time Cryptographic Token, การ Reuse Token ในรอบสัปดาห์ (จันทร์-พุธ / พฤหัส-อาทิตย์) และลิงก์ด่วน 1 ชม.
• สไลด์ที่ 7: กฎและเงื่อนไขทางธุรกิจ (Business Rules) — การคำนวณวันเตือน (Notify Alert Days), Lead Time, การตัดยอดแบบ FIFO จาก SAP และสิทธิ์ส่งเกิน PO
• สไลด์ที่ 8: ระบบอัตโนมัติ 24 ชม. (Automation Schedules) — 06:45 SAP Sync, 08:00 Mail & Telegram Briefing, 08:30 PU Reminder Excel
• สไลด์ที่ 9: การเชื่อมต่อระบบคุณภาพ (QMS Integration) & ใบตรวจรับสินค้า (Receiving Checklist)
• สไลด์ที่ 10: สรุปผลลัพธ์และประโยชน์ที่ได้รับ (Business Value) — ความแม่นยำ 100%, ลดงานเอกสาร, วางแผนผลิตล่วงหน้าได้อย่างมีประสิทธิภาพ`;

  // Prompt 2: Infographic Prompt (Thai)
  const infographicPromptThai = `สร้างแผนภาพ Infographic ภาษาไทย แสดงผังกระบวนการทำงานของระบบ "IRM (Incoming Raw Material Management System)" สไตล์ Modern Industrial Minimal โทนสี Slate-900, Sky-600 และ Emerald-600

ให้แบ่งผังออกเป็น 5 ขั้นตอนหลัก (Step-by-Step Pipeline Flow):
ขั้นตอนที่ 1 [06:45 น.]: "ดึงข้อมูลจาก SAP B1" ➔ ระบบ IRM ดึงข้อมูล PO เปิด (Open PO) เฉพาะกลุ่มวัตถุดิบหลัก (กระจก, อลูมิเนียม, UPVC, ฮาร์ดแวร์) เข้าสู่ฐานข้อมูล
ขั้นตอนที่ 2 [08:00 น.]: "เชิญ Supplier ระบุวันส่ง" ➔ ระบบส่งอีเมลอัตโนมัติพร้อมลิงก์ Cryptographic Portal ที่ปลอดภัย (รอบจันทร์-พุธ และรอบพฤหัส-อาทิตย์)
ขั้นตอนที่ 3 [Operation]: "จัดซื้อตรวจสอบและยืนยัน" ➔ ฝ่ายจัดซื้อดูข้อมูลที่ Supplier ตอบกลับ, ปรับวันส่งหรือแตกงวดส่ง (Sub-items) และกดยืนยัน (Confirm)
ขั้นตอนที่ 4 [Calendar]: "แสดงผลรอบส่งทั้งปี" ➔ แสดงบนปฏิทินรายเดือนและรายปี พร้อมระบบ Universal Search ค้นหาได้ทุกคำ
ขั้นตอนที่ 5 [QMS & คลังสินค้า]: "ตรวจรับสินค้าจริง" ➔ เปิด API ให้ระบบ QMS เข้ามาดึงข้อมูลเพื่อวางแผนตรวจคุณภาพ และพิมพ์ใบ Receiving Checklist ให้สโตร์/รปภ. ตรวจของจริงที่หน้าโรงงาน

ในภาพต้องมีไอคอนประจำแต่ละขั้นตอน, มีลูกศรเชื่อมต่อทิศทางการไหลของข้อมูลชัดเจน, และมีกล่องสรุปเกณฑ์สำคัญ:
- วันแจ้งเตือน = Estimate Date - Notify Alert Days
- ลิงก์ Portal กรอกได้ 1 ครั้ง และ Reuse ลิงก์เดิมในรอบเดียวกันได้`;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-sky-950 text-white p-6 sm:p-8 rounded-3xl shadow-xl border border-slate-700/60 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-sky-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/20 text-sky-300 border border-sky-400/30 text-xs font-bold">
              <Compass className="w-3.5 h-3.5" />
              <span>พิมพ์เขียวและคู่มือระบบ (System Architecture & Blueprint)</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
              <span>System Blueprint — สถาปัตยกรรมระบบ IRM</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              ศูนย์รวมข้อมูลการทำงานของระบบ Incoming Raw Material (IRM) ฉบับสมบูรณ์
              ครอบคลุมโฟลว์ข้อมูล, กฎธุรกิจ (Conditions), สิทธิ์ผู้ใช้, ระบบ Token และระบบอัตโนมัติทั้งหมด เพื่อให้อ่านเข้าใจง่ายและใช้ตรวจสอบระบบได้ในหน้าเดียว
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              onClick={() => handleCopy(presentationPromptThai, 'pres')}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition shadow-md cursor-pointer"
              title="คัดลอก Prompt สำหรับทำ Presentation สไลด์นำเสนอ"
            >
              {copiedPrompt === 'pres' ? <Check className="w-4 h-4 text-emerald-300" /> : <Presentation className="w-4 h-4" />}
              <span>{copiedPrompt === 'pres' ? 'คัดลอกแล้ว!' : 'Prompt Presentation (ไทย)'}</span>
            </button>

            <button
              onClick={() => handleCopy(infographicPromptThai, 'info')}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-md cursor-pointer"
              title="คัดลอก Prompt สำหรับทำ Infographic แผนผังระบบ"
            >
              {copiedPrompt === 'info' ? <Check className="w-4 h-4 text-emerald-200" /> : <Share2 className="w-4 h-4" />}
              <span>{copiedPrompt === 'info' ? 'คัดลอกแล้ว!' : 'Prompt Infographic (ไทย)'}</span>
            </button>

            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 text-xs font-bold transition cursor-pointer"
              title="พิมพ์เอกสารพิมพ์เขียวนี้"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">พิมพ์</span>
            </button>
          </div>
        </div>
      </div>

      {/* Quick Jump Navigation Pill Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
        {[
          { id: 'all', label: 'ทั้งหมด (All)' },
          { id: 'flow', label: '1. โฟลว์ข้อมูล (Data Pipeline)' },
          { id: 'modules', label: '2. ฟังก์ชัน 6 โมดูล' },
          { id: 'rules', label: '3. กฎและเงื่อนไข (Conditions)' },
          { id: 'roles', label: '4. สิทธิ์ผู้ใช้งาน (Roles)' },
          { id: 'security', label: '5. Token Portal & ความปลอดภัย' },
          { id: 'schedules', label: '6. ตารางเวลาอัตโนมัติ' },
          { id: 'prompts', label: '7. ชุด Prompt นำเสนอ' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveSection(tab.id)}
            className={`px-3 py-1.5 rounded-xl font-bold transition whitespace-nowrap shrink-0 border cursor-pointer ${
              activeSection === tab.id
                ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200 shadow-2xs'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ========================================================================= */}
      {/* SECTION 1: DATA PIPELINE WORKFLOW (แผนภาพการไหลของข้อมูล)                 */}
      {/* ========================================================================= */}
      {(activeSection === 'all' || activeSection === 'flow') && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2 text-slate-900 font-extrabold text-base">
              <Database className="w-5 h-5 text-sky-600" />
              <span>1. แผนภาพการไหลของข้อมูลครบวงจร (End-to-End Data Pipeline)</span>
            </div>
            <span className="text-xs text-slate-400 font-medium">5 ขั้นตอนการทำงาน</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 text-xs">
            {/* Step 1 */}
            <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 flex flex-col justify-between space-y-2 relative">
              <div className="flex items-center justify-between">
                <span className="w-6 h-6 rounded-full bg-slate-900 text-white font-black text-xs flex items-center justify-center">1</span>
                <span className="text-[10px] font-bold text-sky-700 bg-sky-100 px-1.5 py-0.2 rounded">06:45 น.</span>
              </div>
              <div>
                <div className="font-extrabold text-slate-900">SAP B1 Report 8</div>
                <div className="text-[11px] text-slate-500 mt-1">
                  Worker ดึง PO สถานะ Open (O) เฉพาะกลุ่มสินค้าที่เปิดรับ ลงตาราง <code>po_headers</code> และ <code>po_items</code>
                </div>
              </div>
              <div className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 p-1.5 rounded border border-emerald-200">
                ✓ รายการใหม่ติดป้าย NEW
              </div>
            </div>

            {/* Step 2 */}
            <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 flex flex-col justify-between space-y-2 relative">
              <div className="flex items-center justify-between">
                <span className="w-6 h-6 rounded-full bg-slate-900 text-white font-black text-xs flex items-center justify-center">2</span>
                <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.2 rounded">จัดซื้อ / PU</span>
              </div>
              <div>
                <div className="font-extrabold text-slate-900">หน้า Operation</div>
                <div className="text-[11px] text-slate-500 mt-1">
                  จัดซื้อตรวจสอบรายการ, ใส่วันที่ส่ง (Estimate Date), แตกงวดส่ง (Sub-items) หรือเตรียมส่งต่อให้คู่ค้า
                </div>
              </div>
              <div className="text-[10px] font-semibold text-slate-700 bg-slate-100 p-1.5 rounded border border-slate-200">
                ✓ ตรวจไม่ให้ส่งเกินคงเหลือ
              </div>
            </div>

            {/* Step 3 */}
            <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 flex flex-col justify-between space-y-2 relative">
              <div className="flex items-center justify-between">
                <span className="w-6 h-6 rounded-full bg-slate-900 text-white font-black text-xs flex items-center justify-center">3</span>
                <span className="text-[10px] font-bold text-indigo-700 bg-indigo-100 px-1.5 py-0.2 rounded">จันทร์ / พฤหัส</span>
              </div>
              <div>
                <div className="font-extrabold text-slate-900">Supplier Portal</div>
                <div className="text-[11px] text-slate-500 mt-1">
                  ส่งอีเมลลิงก์ One-Time Token (หรือส่งผ่าน Line) ให้ Supplier ระบุวันส่งมอบด้วยตนเอง
                </div>
              </div>
              <div className="text-[10px] font-semibold text-indigo-700 bg-indigo-50 p-1.5 rounded border border-indigo-200">
                ✓ ล็อคป้องกันจัดซื้อแก้ทับ
              </div>
            </div>

            {/* Step 4 */}
            <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 flex flex-col justify-between space-y-2 relative">
              <div className="flex items-center justify-between">
                <span className="w-6 h-6 rounded-full bg-slate-900 text-white font-black text-xs flex items-center justify-center">4</span>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded">Real-time</span>
              </div>
              <div>
                <div className="font-extrabold text-slate-900">Confirm & Calendar</div>
                <div className="text-[11px] text-slate-500 mt-1">
                  Supplier Submit ➔ จัดซื้อกด Accept/Confirm ➔ ข้อมูลขึ้นปฏิทินส่งมอบ (รายเดือน/รายปี)
                </div>
              </div>
              <div className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 p-1.5 rounded border border-emerald-200">
                ✓ สีเขียว 🟢 ยืนยัน / สีส้ม 🟠 ประมาณการ
              </div>
            </div>

            {/* Step 5 */}
            <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 flex flex-col justify-between space-y-2 relative">
              <div className="flex items-center justify-between">
                <span className="w-6 h-6 rounded-full bg-slate-900 text-white font-black text-xs flex items-center justify-center">5</span>
                <span className="text-[10px] font-bold text-sky-700 bg-sky-100 px-1.5 py-0.2 rounded">ตรวจรับจริง</span>
              </div>
              <div>
                <div className="font-extrabold text-slate-900">QMS & คลังสินค้า</div>
                <div className="text-[11px] text-slate-500 mt-1">
                  QMS ดึง JSON แพลนส่งไปวางแผนตรวจรับ และคลังสินค้าพิมพ์ใบ <strong>Receiving Checklist</strong> ตรวจของจริง
                </div>
              </div>
              <div className="text-[10px] font-semibold text-sky-700 bg-sky-50 p-1.5 rounded border border-sky-200">
                ✓ รับของครบ ย้ายเข้า History
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 2: CORE MODULES (ฟังก์ชัน 6 โมดูลหลัก)                           */}
      {/* ========================================================================= */}
      {(activeSection === 'all' || activeSection === 'modules') && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2 text-slate-900 font-extrabold text-base">
              <Layers className="w-5 h-5 text-sky-600" />
              <span>2. รายละเอียดฟังก์ชันและโมดูลการทำงานหลัก (6 Core Modules)</span>
            </div>
            <span className="text-xs text-slate-400 font-medium">เมนูการทำงาน</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
            {/* Module 1: Operation */}
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-slate-900 flex items-center gap-1.5">
                  <ClipboardList className="w-4 h-4 text-sky-600" />
                  <span>Operation (จัดการรอบส่ง)</span>
                </span>
                <Link href="/operation" className="text-[10px] font-bold text-sky-600 hover:underline flex items-center gap-0.5">
                  <span>เปิดหน้า</span>
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
              <p className="text-slate-600 text-[11px] leading-relaxed">
                หัวใจหลักของฝ่ายจัดซื้อ จัดการวันและยอดส่งมอบของ PO ที่ยังค้างรับ:
              </p>
              <ul className="space-y-1 text-[11px] text-slate-600 list-disc list-inside">
                <li>ระบุ <strong>Estimate Date</strong> และ <strong>Estimate Qty</strong></li>
                <li><strong>แตกงวดส่ง (Sub-items):</strong> แบ่งส่งหลายรอบตามกำหนดจริง</li>
                <li><strong>แท็บกรอง 10 มิติ:</strong> มาใหม่, ยืนยันแล้ว, รอ Sup ตอบ, ถึงใน 3 วัน, ส่งเกิน PO ฯลฯ</li>
                <li><strong>ปุ่ม Confirm / Accept:</strong> ยืนยันข้อมูลลง Calendar</li>
                <li><strong>Audit Trail:</strong> บันทึกประวัติว่าใครปรับปรุง ล่าสุดเวลาใด</li>
              </ul>
            </div>

            {/* Module 2: Calendar */}
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-slate-900 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-sky-600" />
                  <span>Calendar (ปฏิทินส่งมอบ)</span>
                </span>
                <Link href="/calendar" className="text-[10px] font-bold text-sky-600 hover:underline flex items-center gap-0.5">
                  <span>เปิดหน้า</span>
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
              <p className="text-slate-600 text-[11px] leading-relaxed">
                ปฏิทินแสดงนัดหมายสินค้าเข้าโรงงาน ตอบโจทย์การวางแผนสายการผลิต:
              </p>
              <ul className="space-y-1 text-[11px] text-slate-600 list-disc list-inside">
                <li><strong>โหมดรายเดือน:</strong> ตาราง 7 วัน พร้อม Badge สินค้าและตัวกรองกลุ่ม</li>
                <li><strong>โหมดรายปี (12 เดือน):</strong> สรุปยอด 12 กล่องเดือน มาร์กวันส่งชัดเจน</li>
                <li><strong>Universal Search:</strong> ค้นหาได้ทุกคำ (PO, รหัสสินค้า, Sup) ข้ามปี 0 วินาที</li>
                <li><strong>คลิกดูรายละเอียด:</strong> แสดงชื่อสินค้า, จำนวน, ผู้ขาย และผู้จัดซื้อดูแล</li>
              </ul>
            </div>

            {/* Module 3: Receiving Checklist */}
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-slate-900 flex items-center gap-1.5">
                  <FileCheck className="w-4 h-4 text-sky-600" />
                  <span>Receiving Checklist (ใบตรวจรับ)</span>
                </span>
                <Link href="/receiving-checklist" className="text-[10px] font-bold text-sky-600 hover:underline flex items-center gap-0.5">
                  <span>เปิดหน้า</span>
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
              <p className="text-slate-600 text-[11px] leading-relaxed">
                เครื่องมือประสานงานหน้างานจริงสำหรับสโตร์ รปภ. และแผนกตรวจรับ:
              </p>
              <ul className="space-y-1 text-[11px] text-slate-600 list-disc list-inside">
                <li>สรุปรายการสินค้าที่มีนัดหมายส่งมอบในวันที่เลือก</li>
                <li>มีช่องให้เจ้าหน้าที่หน้างาน <strong>ติ๊กตรวจรับ, บันทึกทะเบียนรถ, จำนวนรับจริง</strong></li>
                <li>ปุ่ม <strong>สั่งพิมพ์ (Print Ready):</strong> จัดหน้า A4 แนวนอน พร้อมช่องลงชื่อครบถ้วน</li>
              </ul>
            </div>

            {/* Module 4: Item Master */}
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-slate-900 flex items-center gap-1.5">
                  <Package className="w-4 h-4 text-sky-600" />
                  <span>Item Master (คลังรหัสสินค้า)</span>
                </span>
                <Link href="/items" className="text-[10px] font-bold text-sky-600 hover:underline flex items-center gap-0.5">
                  <span>เปิดหน้า</span>
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
              <p className="text-slate-600 text-[11px] leading-relaxed">
                จัดการพารามิเตอร์ประจำรหัสสินค้า เพื่อการคำนวณและแจ้งเตือน:
              </p>
              <ul className="space-y-1 text-[11px] text-slate-600 list-disc list-inside">
                <li><strong>Lead Time Days:</strong> จำนวนวันผลิตและจัดส่งปกติของสินค้านั้น</li>
                <li><strong>Notify Alert Days:</strong> วันแจ้งเตือนล่วงหน้า (ค่าเริ่มต้น 3 วัน)</li>
                <li><strong>Auto-Seed สินค้าใหม่:</strong> เมื่อมีรหัสใหม่จาก SAP ระบบจะดึงเข้า Master อัตโนมัติ</li>
                <li>มีปุ่ม <strong>Accept สินค้าใหม่:</strong> เพื่อให้จัดซื้อตรวจสอบก่อนใช้งาน</li>
              </ul>
            </div>

            {/* Module 5: Supplier Master */}
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-slate-900 flex items-center gap-1.5">
                  <Factory className="w-4 h-4 text-sky-600" />
                  <span>Supplier Master (ข้อมูลคู่ค้า)</span>
                </span>
                <Link href="/suppliers" className="text-[10px] font-bold text-sky-600 hover:underline flex items-center gap-0.5">
                  <span>เปิดหน้า</span>
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
              <p className="text-slate-600 text-[11px] leading-relaxed">
                บริหารจัดการข้อมูลการติดต่อและการตั้งค่าความยืดหยุ่นของ Supplier:
              </p>
              <ul className="space-y-1 text-[11px] text-slate-600 list-disc list-inside">
                <li>เก็บอีเมลและเบอร์โทรศัพท์สำหรับจัดส่งลิงก์ Portal</li>
                <li><strong>Allow Over-Delivery:</strong> สิทธิ์การอนุญาตให้ส่งสินค้าเกินจำนวน PO</li>
                <li><strong>ส่งอีเมล Manual & คัดลอก Token Link:</strong> ส่งซ้ำได้เมื่อ Supplier ขอเร่งด่วน</li>
              </ul>
            </div>

            {/* Module 6: History & Logs */}
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-slate-900 flex items-center gap-1.5">
                  <ScrollText className="w-4 h-4 text-sky-600" />
                  <span>History & Logs (ประวัติ & ตรวจสอบ)</span>
                </span>
                <Link href="/history" className="text-[10px] font-bold text-sky-600 hover:underline flex items-center gap-0.5">
                  <span>เปิดหน้า</span>
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
              <p className="text-slate-600 text-[11px] leading-relaxed">
                ศูนย์รวมประวัติการรับของและบันทึกการทำงานของระบบ (Audit Trail):
              </p>
              <ul className="space-y-1 text-[11px] text-slate-600 list-disc list-inside">
                <li><strong>History:</strong> เก็บรายการที่รับของครบแล้ว (LineStatus = &apos;C&apos;) ย้อนหลังตามกำหนด</li>
                <li><strong>SAP Sync Logs:</strong> ประวัติการดึงข้อมูลจาก SAP ทุกเช้า</li>
                <li><strong>Email Logs:</strong> สรุปยอดส่งอีเมลหา Supplier สำเร็จ/ล้มเหลว</li>
                <li><strong>QMS Pull Logs:</strong> ประวัติการส่งออกข้อมูลไปยังระบบ QMS</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 3: BUSINESS RULES & CONDITIONS (เงื่อนไขและกฎธุรกิจ)              */}
      {/* ========================================================================= */}
      {(activeSection === 'all' || activeSection === 'rules') && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2 text-slate-900 font-extrabold text-base">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              <span>3. กฎและเงื่อนไขทางธุรกิจที่สำคัญ (Business Rules & Conditions)</span>
            </div>
            <span className="text-xs text-slate-400 font-medium">Logic กฎการทำงาน</span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3.5 space-y-1.5">
              <div className="font-extrabold text-amber-900 text-sm flex items-center gap-2">
                <span>1. การคำนวณวันแจ้งเตือนล่วงหน้า (Notify Alert Logic)</span>
              </div>
              <p className="text-amber-800 text-[11px] leading-relaxed">
                ระบบใช้สูตร: <strong>วันแจ้งเตือน = Estimate Date - Notify Alert Days (จาก Item Master)</strong>
              </p>
              <div className="bg-white/80 p-2.5 rounded-lg border border-amber-200/80 text-[11px] text-slate-700 space-y-1">
                <div>• <strong>ตัวอย่าง:</strong> Item Master ตั้ง Notify Alert = 3 วัน, นัดส่ง 15/09 ➔ แจ้งเตือนวันที่ 12/09</div>
                <div>• <strong>เมื่อมีการเลื่อนวันส่ง:</strong> หากวันที่ 13/09 เลื่อนวันเป็น 20/09 ➔ วันเตือนรอบใหม่จะถูกคำนวณใหม่เป็น <strong>17/09</strong> อัตโนมัติ</div>
                <div>• <strong>ผลลัพธ์:</strong> รายการจะวิ่งเข้าแท็บ &quot;ถึงใน 3 วัน&quot; บนหน้า Operation และเตรียมส่งแจ้งเตือนตามรอบวันใหม่เสมอ</div>
              </div>
            </div>

            <div className="bg-sky-50/70 border border-sky-200 rounded-xl p-3.5 space-y-1.5">
              <div className="font-extrabold text-sky-950 text-sm flex items-center gap-2">
                <span>2. การตัดยอดส่งมอบแบบ FIFO จาก SAP (Partial Delivery Matching)</span>
              </div>
              <p className="text-sky-900 text-[11px] leading-relaxed">
                กรณี 1 รายการ PO สั่ง 10,000 ชิ้น ถูกแตกเป็น 2 งวด: งวดที่ 1 ส่ง 6,000 ชิ้น, งวดที่ 2 ส่ง 4,000 ชิ้น
              </p>
              <div className="bg-white/80 p-2.5 rounded-lg border border-sky-200/80 text-[11px] text-slate-700 space-y-1">
                <div>• เมื่อ SAP Sync ข้อมูลการรับของกลับมา ระบบจะนำ <code>received_qty</code> มาตัดลบกับ Sub-item งวดแรกก่อน (FIFO)</div>
                <div>• หากรับครบ 6,000 ชิ้นแล้ว ยอดรับส่วนเกินจะถูกนำไปตัดงวดที่ 2 อัตโนมัติ โดยไม่เกิด Conflict ข้อมูลกับ SAP</div>
              </div>
            </div>

            <div className="bg-rose-50/70 border border-rose-200 rounded-xl p-3.5 space-y-1.5">
              <div className="font-extrabold text-rose-950 text-sm flex items-center gap-2">
                <span>3. สิทธิ์และเงื่อนไขการส่งสินค้าเกิน PO (Over-Delivery Control)</span>
              </div>
              <p className="text-rose-900 text-[11px] leading-relaxed">
                ระบบมีระบบป้องกันไม่ให้บันทึกจำนวนส่งเกินจำนวนค้างรับ (<code>remaining_qty</code>) เพื่อคุมงบประมาณจัดซื้อ
              </p>
              <div className="bg-white/80 p-2.5 rounded-lg border border-rose-200/80 text-[11px] text-slate-700 space-y-1">
                <div>• <strong>กรณีปกติ:</strong> หากจัดซื้อหรือ Supplier กรอกจำนวนส่งรวมเกินกว่ายอดค้างรับ ระบบจะแจ้งเตือนและปฏิเสธการบันทึก</div>
                <div>• <strong>ข้อยกเว้น:</strong> หาก Supplier นั้นถูกเปิดสิทธิ์ <strong>Allow Over-Delivery</strong> ในหน้า Supplier Master ระบบจะอนุญาตให้ส่งเกินได้ และแสดงป้ายสัญลักษณ์เตือนสีส้มในหน้า Operation</div>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1.5">
              <div className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                <span>4. การย้าย PO เข้าสู่ประวัติ (Auto-Archive Rule)</span>
              </div>
              <div className="text-[11px] text-slate-600 space-y-1">
                <div>• เมื่อ SAP รายงานว่าสถานะแถวของ PO นั้นเป็น <code>LineStatus = &apos;C&apos;</code> (Closed — ได้รับสินค้าครบแล้ว)</div>
                <div>• รายการนั้นจะถูกย้ายออกจากหน้า Operation ไปยังหน้า <strong>History</strong> ทันที โดยจัดเก็บไว้ 7–15 วัน ตามที่ตั้งไว้ใน System Settings</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 4: USER ROLES & MATRIX (สิทธิ์ผู้ใช้งาน)                         */}
      {/* ========================================================================= */}
      {(activeSection === 'all' || activeSection === 'roles') && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2 text-slate-900 font-extrabold text-base">
              <Shield className="w-5 h-5 text-sky-600" />
              <span>4. ระดับสิทธิ์และการเข้าถึงของผู้ใช้งาน (User Roles & Permissions)</span>
            </div>
            <span className="text-xs text-slate-400 font-medium">Auth Matrix</span>
          </div>

          <div className="overflow-x-auto text-xs">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-slate-900 text-white text-left">
                  <th className="p-3 rounded-l-xl">ระดับผู้ใช้งาน (User Role)</th>
                  <th className="p-3">กลุ่มผู้ใช้งานเป้าหมาย</th>
                  <th className="p-3">ขอบเขตสิทธิ์การใช้งาน (Scope)</th>
                  <th className="p-3 rounded-r-xl">การเข้าถึงระบบ Admin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                <tr className="hover:bg-slate-50">
                  <td className="p-3 font-bold text-slate-900 flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                    <span>Admin</span>
                  </td>
                  <td className="p-3 text-slate-600">ผู้ดูแลระบบ / IT / หัวหน้าฝ่าย</td>
                  <td className="p-3 text-slate-700 font-medium">
                    เข้าถึงได้ทุกหน้า, แก้ไข/ลบข้อมูลได้ทุกส่วน, จัดการผู้ใช้, กำหนดสิทธิ์ Auth Matrix, ตั้งค่าระบบ System Settings, สั่ง Sync SAP และยิง QMS ด้วยตนเอง
                  </td>
                  <td className="p-3 font-bold text-emerald-700">✓ สิทธิ์เต็ม 100%</td>
                </tr>

                <tr className="hover:bg-slate-50">
                  <td className="p-3 font-bold text-slate-900 flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-sky-500"></span>
                    <span>PU User</span>
                  </td>
                  <td className="p-3 text-slate-600">เจ้าหน้าที่ฝ่ายจัดซื้อ (Buyers เช่น พัชชา, ภิญญาดา)</td>
                  <td className="p-3 text-slate-700 font-medium">
                    จัดการหน้า Operation, Calendar, พิมพ์ใบ Checklist, จัดการ Item Master, Supplier Master, ดูหน้า History (ไม่มีสิทธิ์ลบ Record ถาวร)
                  </td>
                  <td className="p-3 text-slate-400 font-bold">✗ ปิดกั้นเมนู Admin</td>
                </tr>

                <tr className="hover:bg-slate-50">
                  <td className="p-3 font-bold text-slate-900 flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-400"></span>
                    <span>Viewer</span>
                  </td>
                  <td className="p-3 text-slate-600">ผู้บริหาร / ฝ่ายผลิต / คลังสินค้า</td>
                  <td className="p-3 text-slate-700 font-medium">
                    เปิดดูข้อมูลได้อย่างเดียว (Read-only): หน้า Dashboard, Calendar, และ History ไม่สามารถแก้ไขข้อมูลใดๆ ได้
                  </td>
                  <td className="p-3 text-slate-400 font-bold">✗ ปิดกั้นเมนู Admin</td>
                </tr>

                <tr className="hover:bg-slate-50">
                  <td className="p-3 font-bold text-slate-900 flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                    <span>Supplier (คู่ค้า)</span>
                  </td>
                  <td className="p-3 text-slate-600">Supplier ภายนอกโรงงาน</td>
                  <td className="p-3 text-slate-700 font-medium">
                    <strong>ไม่มีสิทธิ์ Login เข้าเว็บหลัก</strong> ➔ ใช้งานผ่าน <strong>One-Time Cryptographic Token Link</strong> ที่ได้รับทางอีเมลหรือ Line เข้าดูและกรอกข้อมูลได้เฉพาะ PO ของตนเองเท่านั้น
                  </td>
                  <td className="p-3 text-slate-400 font-bold">✗ ไม่มี User ในระบบ</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 5: TOKEN SECURITY & REUSE LOGIC (ระบบความปลอดภัย TOKEN)           */}
      {/* ========================================================================= */}
      {(activeSection === 'all' || activeSection === 'security') && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2 text-slate-900 font-extrabold text-base">
              <Key className="w-5 h-5 text-indigo-600" />
              <span>5. ระบบความปลอดภัยของ Token Portal และการ Reuse Token</span>
            </div>
            <span className="text-xs text-slate-400 font-medium">Security & Expiry</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="bg-indigo-50/60 border border-indigo-200 rounded-2xl p-4 space-y-2">
              <div className="font-extrabold text-indigo-950 text-sm flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-600" />
                <span>รอบอายุของ Token (Weekly Round Windows)</span>
              </div>
              <p className="text-indigo-900 text-[11px] leading-relaxed">
                ระบบตั้งเวลากำหนดอายุของ Token แบบแบ่ง 2 รอบต่อสัปดาห์ เพื่อให้สอดคล้องกับรอบงานจัดซื้อ:
              </p>
              <ul className="space-y-1.5 text-[11px] text-slate-700">
                <li className="flex items-start gap-1.5">
                  <span className="text-indigo-600 font-bold">1.</span>
                  <span><strong>รอบวันจันทร์:</strong> เริ่ม 08:00 น. ➔ จะหมดอายุ <strong>คืนวันพุธ เวลา 23:59:59 น.</strong></span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-indigo-600 font-bold">2.</span>
                  <span><strong>รอบวันพฤหัสบดี:</strong> เริ่ม 08:00 น. ➔ จะหมดอายุ <strong>คืนวันอาทิตย์ เวลา 23:59:59 น.</strong></span>
                </li>
              </ul>
            </div>

            <div className="bg-emerald-50/60 border border-emerald-200 rounded-2xl p-4 space-y-2">
              <div className="font-extrabold text-emerald-950 text-sm flex items-center gap-2">
                <Lock className="w-4 h-4 text-emerald-600" />
                <span>กลไก Reuse Token (ไม่ตัดสิทธิ์ลิงก์เก่า)</span>
              </div>
              <p className="text-emerald-900 text-[11px] leading-relaxed">
                แก้ไขปัญหา Supplier เปิดอีเมลรอบแรกไม่ได้เมื่อมีการส่งซ้ำ:
              </p>
              <ul className="space-y-1.5 text-[11px] text-slate-700">
                <li className="flex items-start gap-1.5">
                  <span className="text-emerald-600 font-bold">✓</span>
                  <span>หาก Token เดิมยังไม่หมดอายุและยังไม่ได้กด Submit การส่ง Manual ซ้ำ หรือการกด Copy Link จะ <strong>ใช้ Token และ URL เดิม</strong></span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-emerald-600 font-bold">✓</span>
                  <span>ลิงก์จากอีเมลตอนเช้า, อีเมลส่งซ้ำตอนสาย, และลิงก์ที่ส่งทาง Line <strong>จะเปิดใช้งานได้ทั้งหมดพร้อมกัน</strong> และหมดอายุตามรอบปกติ</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-rose-600 font-bold">✓</span>
                  <span><strong>One-Time Submit:</strong> ทันทีที่ Supplier กดปุ่ม Submit ยืนยันข้อมูลแล้ว ลิงก์จะถูกปิด (Expired) ทันที เพื่อความปลอดภัย</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 6: AUTOMATED SCHEDULES (ตารางเวลาทำงานอัตโนมัติ)                  */}
      {/* ========================================================================= */}
      {(activeSection === 'all' || activeSection === 'schedules') && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2 text-slate-900 font-extrabold text-base">
              <Clock className="w-5 h-5 text-sky-600" />
              <span>6. ตารางเวลาการทำงานอัตโนมัติ (Automated Schedules & Cron Jobs)</span>
            </div>
            <span className="text-xs text-slate-400 font-medium">Background Tasks</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            <div className="bg-slate-900 text-white rounded-2xl p-4 flex flex-col justify-between space-y-3 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-sky-400 text-base">06:45 น.</span>
                <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full border border-slate-700">ทุกวัน</span>
              </div>
              <div>
                <div className="font-bold text-sm">SAP Open PO Sync</div>
                <div className="text-[11px] text-slate-400 mt-1">
                  รัน SQL Query Report 8 ดึงข้อมูล PO ที่เปิดใหม่และยอดรับเข้าล่าสุดจาก SAP B1 เข้าฐานข้อมูล IRM
                </div>
              </div>
              <div className="text-[10px] text-emerald-400 font-bold">Auto Ingestion 100%</div>
            </div>

            <div className="bg-indigo-900 text-white rounded-2xl p-4 flex flex-col justify-between space-y-3 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-indigo-300 text-base">08:00 น.</span>
                <span className="text-[10px] bg-indigo-800 text-indigo-200 px-2 py-0.5 rounded-full border border-indigo-700">จันทร์ & พฤหัส</span>
              </div>
              <div>
                <div className="font-bold text-sm">Supplier Email Broadcast</div>
                <div className="text-[11px] text-indigo-200 mt-1">
                  ระบบส่งอีเมลสรุปรายการ PO ค้างส่ง พร้อมแนบลิงก์ One-Time Token ไปยังอีเมลของ Supplier แต่ละราย
                </div>
              </div>
              <div className="text-[10px] text-indigo-300 font-bold">Email Notification</div>
            </div>

            <div className="bg-sky-900 text-white rounded-2xl p-4 flex flex-col justify-between space-y-3 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-sky-300 text-base">08:00 น.</span>
                <span className="text-[10px] bg-sky-800 text-sky-200 px-2 py-0.5 rounded-full border border-sky-700">ทุกวัน</span>
              </div>
              <div>
                <div className="font-bold text-sm">Telegram Morning Briefing</div>
                <div className="text-[11px] text-sky-200 mt-1">
                  ยิงข้อความสรุปภาพรวมประจำวันเข้ากลุ่ม Telegram: PO เข้าใหม่, สินค้ารอยืนยัน, และสินค้าจะส่งใน 7 วัน
                </div>
              </div>
              <div className="text-[10px] text-sky-300 font-bold">Telegram Broadcast</div>
            </div>

            <div className="bg-emerald-950 text-white rounded-2xl p-4 flex flex-col justify-between space-y-3 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-emerald-300 text-base">08:30 น.</span>
                <span className="text-[10px] bg-emerald-900 text-emerald-200 px-2 py-0.5 rounded-full border border-emerald-800">ทุกวัน</span>
              </div>
              <div>
                <div className="font-bold text-sm">Daily PU Reminder Email</div>
                <div className="text-[11px] text-emerald-200 mt-1">
                  ส่งอีเมลสรุปงานให้ทีมจัดซื้อ พร้อมแนบไฟล์ Excel 2 แผ่น: รายการที่ยังไม่ Confirm และรายการส่งวันนี้
                </div>
              </div>
              <div className="text-[10px] text-emerald-300 font-bold">Excel Attachment</div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 7: PROMPTS FOR PRESENTATION & INFOGRAPHIC                        */}
      {/* ========================================================================= */}
      {(activeSection === 'all' || activeSection === 'prompts') && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-sm space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2 text-slate-900 font-extrabold text-base">
              <Sparkles className="w-5 h-5 text-amber-500" />
              <span>7. ชุดคำสั่ง Prompt ภาษาไทย (สำหรับทำ Slide Presentation & Infographic)</span>
            </div>
            <span className="text-xs text-slate-400 font-medium">Ready-to-Use AI Prompts</span>
          </div>

          <p className="text-xs text-slate-600">
            คุณสามารถคัดลอกข้อความ Prompt ภาษาไทยด้านล่างนี้ ไปวางในเครื่องมือ AI เช่น <strong>Gamma.app, Beautiful.ai, ChatGPT, Claude หรือ Napkin.ai</strong> เพื่อสร้างสไลด์และแผนภาพได้ทันที:
          </p>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Prompt Card 1 */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col justify-between space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-slate-900 text-sm flex items-center gap-1.5">
                  <Presentation className="w-4 h-4 text-sky-600" />
                  <span>Prompt 1: สำหรับสร้าง Slide Presentation (10 สไลด์)</span>
                </span>
                <button
                  onClick={() => handleCopy(presentationPromptThai, 'pres-box')}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-[11px] font-bold transition shadow-2xs cursor-pointer"
                >
                  {copiedPrompt === 'pres-box' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedPrompt === 'pres-box' ? 'คัดลอกแล้ว!' : 'คัดลอก Prompt'}</span>
                </button>
              </div>

              <div className="bg-white p-3 rounded-xl border border-slate-200 text-[11px] text-slate-700 font-mono max-h-60 overflow-y-auto leading-relaxed whitespace-pre-wrap">
                {presentationPromptThai}
              </div>

              <div className="text-[10px] text-slate-500">
                💡 <strong>เครื่องมือที่แนะนำ:</strong> นำไปวางใน <em>Gamma.app</em> หรือ <em>ChatGPT / Claude</em> เพื่อเจนสไลด์ PowerPoint อัตโนมัติ
              </div>
            </div>

            {/* Prompt Card 2 */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col justify-between space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-slate-900 text-sm flex items-center gap-1.5">
                  <Share2 className="w-4 h-4 text-emerald-600" />
                  <span>Prompt 2: สำหรับสร้าง Infographic Flowchart แผนผังระบบ</span>
                </span>
                <button
                  onClick={() => handleCopy(infographicPromptThai, 'info-box')}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-[11px] font-bold transition shadow-2xs cursor-pointer"
                >
                  {copiedPrompt === 'info-box' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedPrompt === 'info-box' ? 'คัดลอกแล้ว!' : 'คัดลอก Prompt'}</span>
                </button>
              </div>

              <div className="bg-white p-3 rounded-xl border border-slate-200 text-[11px] text-slate-700 font-mono max-h-60 overflow-y-auto leading-relaxed whitespace-pre-wrap">
                {infographicPromptThai}
              </div>

              <div className="text-[10px] text-slate-500">
                💡 <strong>เครื่องมือที่แนะนำ:</strong> นำไปวางใน <em>Napkin.ai</em> หรือ <em>Canva Magic Design</em> เพื่อเจน Infographic สวยงามทันใจ
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
