'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ClipboardList,
  Calendar,
  Package,
  Factory,
  ScrollText,
  Shield,
  Settings,
  Users,
  Lock,
  Activity,
  FileText,
  LayoutDashboard,
  ChevronDown,
  ChevronRight,
  LucideIcon,
} from 'lucide-react';
import { MenuNode } from '@/types';

// Map icon names to Lucide icons
const iconMap: Record<string, LucideIcon> = {
  LayoutDashboard,
  ClipboardList,
  Calendar,
  Package,
  Factory,
  ScrollText,
  Shield,
  Settings,
  Users,
  Lock,
  Activity,
  FileText,
};

interface SidebarProps {
  menus: MenuNode[];
}

export const Sidebar: React.FC<SidebarProps> = ({ menus }) => {
  const pathname = usePathname();
  // State for collapsible sub-menus (default open Admin if current route is under /admin)
  const [openParents, setOpenParents] = useState<Record<number, boolean>>(() => {
    const initialState: Record<number, boolean> = {};
    menus.forEach((m) => {
      if (m.children && m.children.length > 0) {
        const isSubActive = m.children.some((child) => child.path && pathname.startsWith(child.path));
        initialState[m.id] = isSubActive || m.name === 'Admin'; // Admin expanded by default
      }
    });
    return initialState;
  });

  const toggleParent = (menuId: number) => {
    setOpenParents((prev) => ({ ...prev, [menuId]: !prev[menuId] }));
  };

  const getIcon = (iconName: string | null) => {
    if (!iconName || !iconMap[iconName]) return Shield;
    return iconMap[iconName];
  };

  return (
    <aside className="w-64 bg-slate-900 text-slate-200 flex flex-col border-r border-slate-800 shadow-xl min-h-screen">
      {/* Brand Header */}
      <div className="h-16 flex items-center px-6 border-b border-slate-800 bg-slate-950/50">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center font-bold text-white shadow-md shadow-sky-500/20">
            IRM
          </div>
          <div>
            <h1 className="font-bold text-base text-white tracking-wide leading-none">IRM System</h1>
            <p className="text-[11px] text-slate-400 font-medium">Incoming Raw Material</p>
          </div>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 py-4 px-3 space-y-1.5 overflow-y-auto">
        {menus.map((menu) => {
          const Icon = getIcon(menu.icon);
          const hasChildren = menu.children && menu.children.length > 0;
          const isOpen = !!openParents[menu.id];

          if (hasChildren) {
            // Parent Menu Header (e.g. Admin) with Sub-menus
            const isAnyChildActive = menu.children.some(
              (child) => child.path && pathname.startsWith(child.path)
            );

            return (
              <div key={menu.id} className="space-y-1">
                {/* Parent Toggle Button */}
                <button
                  onClick={() => toggleParent(menu.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-semibold transition-all duration-150 ${
                    isAnyChildActive
                      ? 'bg-slate-800/80 text-sky-400'
                      : 'text-slate-300 hover:bg-slate-800/50 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-5 h-5 ${isAnyChildActive ? 'text-sky-400' : 'text-slate-400'}`} />
                    <span>{menu.name}</span>
                  </div>
                  {isOpen ? (
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  )}
                </button>

                {/* Sub-menus Container (Indented Level 1) */}
                {isOpen && (
                  <div className="ml-4 pl-3 border-l-2 border-slate-700/60 space-y-1 py-1">
                    {menu.children.map((child) => {
                      const ChildIcon = getIcon(child.icon);
                      const isChildActive = child.path ? pathname.startsWith(child.path) : false;

                      return (
                        <Link
                          key={child.id}
                          href={child.path || '#'}
                          className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-medium transition-all duration-150 ${
                            isChildActive
                              ? 'bg-sky-600 text-white font-semibold shadow-md shadow-sky-600/30'
                              : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                          }`}
                        >
                          <ChildIcon className={`w-4 h-4 ${isChildActive ? 'text-white' : 'text-slate-400'}`} />
                          <span>{child.name}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          // Single Top-Level Menu (e.g. Operation, Calendar, Item Master, Supplier Master, History)
          const isActive = menu.path ? pathname.startsWith(menu.path) : false;

          return (
            <Link
              key={menu.id}
              href={menu.path || '#'}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                isActive
                  ? 'bg-sky-600 text-white font-semibold shadow-md shadow-sky-600/30'
                  : 'text-slate-300 hover:bg-slate-800/50 hover:text-white'
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
              <span>{menu.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer Info */}
      <div className="p-4 border-t border-slate-800 text-[11px] text-slate-500 text-center">
        IRM v1.0.0 &copy; 2026
      </div>
    </aside>
  );
};
