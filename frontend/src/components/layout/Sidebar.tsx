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
  FileCheck,
  LayoutDashboard,
  ChevronDown,
  ChevronRight,
  X,
  PanelLeftClose,
  Compass,
  LucideIcon,
} from 'lucide-react';
import { MenuNode } from '@/types';

// Map icon names to Lucide icons
const iconMap: Record<string, LucideIcon> = {
  LayoutDashboard,
  ClipboardList,
  Calendar,
  FileCheck,
  Package,
  Factory,
  ScrollText,
  Shield,
  Settings,
  Users,
  Lock,
  Activity,
  FileText,
  Compass,
};

interface SidebarProps {
  menus: MenuNode[];
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  menus,
  isOpenMobile = false,
  onCloseMobile,
  isCollapsed = false,
  onToggleCollapse,
}) => {
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

  const renderNavContent = (isMobileView = false) => (
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
                        onClick={() => {
                          if (isMobileView && onCloseMobile) {
                            onCloseMobile();
                          }
                        }}
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
            onClick={() => {
              if (isMobileView && onCloseMobile) {
                onCloseMobile();
              }
            }}
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
  );

  return (
    <>
      {/* Desktop Sidebar (Collapsible / Toggleable) */}
      <aside
        className={`hidden md:flex bg-slate-900 text-slate-200 flex-col border-slate-800 shadow-xl min-h-screen shrink-0 sticky top-0 h-screen transition-all duration-300 ease-in-out z-20 overflow-hidden ${
          isCollapsed ? 'w-0 border-r-0 opacity-0 pointer-events-none' : 'w-64 border-r opacity-100'
        }`}
      >
        <div className="w-64 flex flex-col h-full min-h-screen shrink-0">
          {/* Brand Header */}
          <div className="h-16 flex items-center justify-between px-5 border-b border-slate-800 bg-slate-950/50 shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <img
                src="/logo.png"
                alt="IRM Logo"
                className="w-9 h-9 rounded-lg object-cover shadow-md shadow-sky-500/30 border border-sky-400/20 shrink-0"
              />
              <div className="truncate">
                <h1 className="font-bold text-base text-white tracking-wide leading-none truncate">IRM System</h1>
                <p className="text-[11px] text-slate-400 font-medium mt-0.5 truncate">Incoming Raw Material</p>
              </div>
            </div>

            {onToggleCollapse && (
              <button
                type="button"
                onClick={onToggleCollapse}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition shrink-0 cursor-pointer"
                title="ซ่อนแถบเมนู (Hide Sidebar)"
                aria-label="ซ่อนแถบเมนู"
              >
                <PanelLeftClose className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Navigation */}
          {renderNavContent(false)}

          {/* Footer Info */}
          <div className="p-4 border-t border-slate-800 text-[11px] text-slate-500 text-center shrink-0">
            IRM v1.0.0 &copy; 2026
          </div>
        </div>
      </aside>

      {/* Mobile Drawer (Modal / Overlay) */}
      {isOpenMobile && (
        <div className="fixed inset-0 z-50 md:hidden flex" aria-modal="true" role="dialog">
          {/* Backdrop Overlay */}
          <div
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm transition-opacity"
            onClick={onCloseMobile}
          />

          {/* Drawer Container */}
          <div className="relative w-72 max-w-[85vw] bg-slate-900 text-slate-200 flex flex-col shadow-2xl z-10 animate-in slide-in-from-left duration-200 h-full border-r border-slate-800">
            {/* Mobile Header with Close Button */}
            <div className="h-16 flex items-center justify-between px-5 border-b border-slate-800 bg-slate-950/50 shrink-0">
              <div className="flex items-center gap-3">
                <img
                  src="/logo.png"
                  alt="IRM Logo"
                  className="w-8 h-8 rounded-lg object-cover shadow-md shadow-sky-500/30 border border-sky-400/20"
                />
                <div>
                  <h1 className="font-bold text-sm text-white tracking-wide leading-none">IRM System</h1>
                  <p className="text-[10px] text-slate-400 font-medium mt-0.5">Incoming Raw Material</p>
                </div>
              </div>
              <button
                onClick={onCloseMobile}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                aria-label="ปิดเมนู"
                title="ปิดเมนู"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Navigation */}
            {renderNavContent(true)}

            {/* Footer */}
            <div className="p-4 border-t border-slate-800 text-[11px] text-slate-500 text-center shrink-0">
              IRM v1.0.0 &copy; 2026
            </div>
          </div>
        </div>
      )}
    </>
  );
};
