'use client';

import React from 'react';
import { LogOut, User as UserIcon, Shield } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

export const Header: React.FC = () => {
  const { user, logout } = useAuth();

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-8 flex items-center justify-between sticky top-0 z-10 shadow-sm">
      {/* Page Context / Title */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
          Incoming Raw Material System
        </span>
      </div>

      {/* User Info & Actions */}
      <div className="flex items-center gap-4">
        {user && (
          <div className="flex items-center gap-3 pr-4 border-r border-slate-200">
            <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-300 flex items-center justify-center text-slate-600">
              <UserIcon className="w-4 h-4" />
            </div>
            <div className="text-right">
              <div className="text-xs font-bold text-slate-800">{user.full_name}</div>
              <div className="flex items-center gap-1 justify-end text-[10px] text-slate-500">
                <Shield className="w-3 h-3 text-sky-600" />
                <span className="font-semibold text-sky-700">{user.group_name || 'No Group'}</span>
              </div>
            </div>
          </div>
        )}

        {/* Logout Button */}
        <button
          onClick={logout}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:text-red-600 hover:bg-red-50 border border-slate-200 hover:border-red-200 transition-all duration-150"
        >
          <LogOut className="w-4 h-4" />
          <span>ออกจากระบบ</span>
        </button>
      </div>
    </header>
  );
};
