'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { MenuNode } from '@/types';
import { ShieldAlert } from 'lucide-react';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [menus, setMenus] = useState<MenuNode[]>([]);
  const [fetchingMenus, setFetchingMenus] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [user, loading, router]);

  // Automatically close mobile menu when navigating to a new path
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  const fetchMenus = async () => {
    if (!user) return;
    try {
      const res = await api.get<MenuNode[]>('/api/menus');
      setMenus(res.data);
    } catch (err) {
      console.error('Failed to fetch menus:', err);
    } finally {
      setFetchingMenus(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchMenus();
    }
  }, [user]);

  // Check if current route is authorized for this user
  const isAuthorized = useMemo(() => {
    if (!user) return false;
    if (user.group_name?.toLowerCase() === 'admin') return true;
    if (!pathname || pathname === '/') return true;

    // Check if the current pathname matches a menu in user permissions
    const matchingPerm = user.permissions.find(
      (p) => p.menu_path && (pathname === p.menu_path || pathname.startsWith(p.menu_path + '/'))
    );

    // If this route is governed by a menu permission in Auth Matrix
    if (matchingPerm) {
      return matchingPerm.can_view;
    }

    // Default: allow if not a restricted menu
    return true;
  }, [user, pathname]);

  if (loading || fetchingMenus) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 border-2 border-sky-400 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm font-medium">กำลังเตรียมระบบ...</span>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen flex bg-slate-100">
      {/* Sidebar (Desktop Permanent + Mobile Drawer Overlay) */}
      <Sidebar
        menus={menus}
        isOpenMobile={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
        <Header onOpenMobileMenu={() => setMobileMenuOpen(true)} />
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          {!isAuthorized ? (
            <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-8 bg-white rounded-2xl border border-slate-200 shadow-sm max-w-xl mx-auto mt-8">
              <div className="w-16 h-16 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center text-red-500 mb-4 shadow-sm">
                <ShieldAlert className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-bold text-slate-800 tracking-tight">ไม่มีสิทธิ์เข้าถึงหน้านี้ (Access Denied)</h2>
              <p className="text-xs sm:text-sm text-slate-500 max-w-md mt-2 leading-relaxed">
                กลุ่มผู้ใช้งาน <b className="text-slate-700">{user.group_name || 'ของคุณ'}</b> ไม่ได้รับสิทธิ์ในการเข้าถึงหน้านี้ตามที่กำหนดไว้ในตารางสิทธิ์ (Auth Matrix)
              </p>
              <button
                onClick={() => router.push('/operation')}
                className="mt-6 px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs rounded-xl shadow-lg shadow-sky-600/20 transition"
              >
                กลับสู่หน้าหลัก (Operation)
              </button>
            </div>
          ) : (
            children
          )}
        </main>
      </div>
    </div>
  );
}
