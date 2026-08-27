'use client';

import React from 'react';
import { LogOut, User as UserIcon, Shield, Menu } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

interface HeaderProps {
  onOpenMobileMenu?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenMobileMenu }) => {
  const { user, logout } = useAuth();

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-4 md:px-8 flex items-center justify-between sticky top-0 z-10 shadow-sm">
      {/* Mobile Menu Toggle & Page Context */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          className="md:hidden p-2 -ml-1 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
          aria-label="เปิดเมนูนำทาง"
          title="เปิดเมนูนำทาง"
        >
          <Menu className="w-5 h-5" />
        </button>
        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200 truncate max-w-[150px] sm:max-w-none">
          Incoming Raw Material System
        </span>
      </div>

      {/* User Info & Actions */}
      <div className="flex items-center gap-2 sm:gap-4">
        {user && (
          <div className="flex items-center gap-2 sm:gap-3 pr-2 sm:pr-4 border-r border-slate-200">
            <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-300 flex items-center justify-center text-slate-600 shrink-0">
              <UserIcon className="w-4 h-4" />
            </div>
            <div className="text-right max-w-[120px] sm:max-w-[180px] truncate">
              <div className="text-xs font-bold text-slate-800 truncate">{user.full_name}</div>
              <div className="flex items-center gap-1 justify-end text-[10px] text-slate-500">
                <Shield className="w-3 h-3 text-sky-600 shrink-0" />
                <span className="font-semibold text-sky-700 truncate">{user.group_name || 'No Group'}</span>
              </div>
            </div>
          </div>
        )}

        {/* Logout Button */}
        <button
          onClick={logout}
          className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:text-red-600 hover:bg-red-50 border border-slate-200 hover:border-red-200 transition-all duration-150"
          title="ออกจากระบบ"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          <span className="hidden sm:inline">ออกจากระบบ</span>
        </button>
      </div>
    </header>
  );
};
