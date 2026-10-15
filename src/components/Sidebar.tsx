import React from 'react';
import {
  LayoutDashboard,
  Newspaper,
  Users,
  Settings,
  GraduationCap,
  LogOut,
  X,
  KeyRound,
  ShieldCheck,
  UserCheck
} from 'lucide-react';
import { AppSettings, UserRole } from '../types';

export type MainNavTab = 'dashboard' | 'board' | 'students' | 'settings';

interface SidebarProps {
  currentTab: MainNavTab;
  onSelectTab: (tab: MainNavTab) => void;
  settings: AppSettings;
  role: UserRole;
  currentStudentName?: string;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  onOpenChangePassword: () => void;
  onLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  settings,
  role,
  currentStudentName,
  isOpenMobile,
  onCloseMobile,
  onOpenChangePassword,
  onLogout,
}) => {
  const navItems: { id: MainNavTab; label: string; icon: React.ComponentType<{ className?: string }>; teacherOnly?: boolean }[] = [
    { id: 'dashboard', label: 'TỔNG QUAN', icon: LayoutDashboard },
    { id: 'board', label: 'BẢNG TIN & SƠ ĐỒ LỚP', icon: Newspaper },
    { id: 'students', label: role === 'teacher' ? 'HỌC SINH' : 'HỒ SƠ CỦA TÔI', icon: Users },
    { id: 'settings', label: 'CÀI ĐẶT', icon: Settings, teacherOnly: true },
  ];

  const visibleItems = navItems.filter((item) => !item.teacherOnly || role === 'teacher');

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-xs md:hidden"
          onClick={onCloseMobile}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed md:sticky top-0 left-0 z-40 h-screen w-64 bg-white border-r border-slate-200/80 flex flex-col transition-transform duration-200 ease-in-out md:translate-x-0 ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-600 to-sky-400 flex items-center justify-center text-white shadow-sm shadow-sky-500/20">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <div className="text-base font-bold text-slate-800 tracking-tight leading-tight">
                {settings.appName || 'GVCN'}
              </div>
              <div className="text-[11px] font-medium text-sky-700">
                Lớp {settings.className} · {settings.academicYear}
              </div>
            </div>
          </div>
          <button
            onClick={onCloseMobile}
            className="md:hidden p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* School & Teacher Subtitle Pill-free Info */}
        <div className="px-5 py-3 bg-[#F0F7FD] border-b border-sky-100/60">
          <div className="text-xs font-semibold text-slate-800 truncate">
            {settings.schoolName}
          </div>
          <div className="text-[11px] text-slate-600 flex items-center gap-1.5 mt-0.5 truncate">
            {role === 'teacher' ? (
              <>
                <ShieldCheck className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                <span>GVCN: {settings.teacherName}</span>
              </>
            ) : (
              <>
                <UserCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Học sinh: {currentStudentName || 'Học sinh'}</span>
              </>
            )}
          </div>
        </div>

        {/* 4 Main Nav Items */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onSelectTab(item.id);
                  onCloseMobile();
                }}
                className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-semibold tracking-wide transition-all cursor-pointer ${
                  isActive
                    ? 'bg-sky-50 text-sky-700 shadow-xs border border-sky-200/60'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <Icon
                  className={`w-4 h-4 transition-colors ${
                    isActive ? 'text-sky-600' : 'text-slate-400'
                  }`}
                />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Bottom User Controls */}
        <div className="p-3 border-t border-slate-100 bg-slate-50/50 space-y-1">
          <button
            onClick={() => {
              onOpenChangePassword();
              onCloseMobile();
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-white rounded-lg transition-colors cursor-pointer"
          >
            <KeyRound className="w-3.5 h-3.5 text-slate-400" />
            <span>Đổi mật khẩu</span>
          </button>
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5 text-rose-500" />
            <span>Đăng xuất</span>
          </button>
        </div>
      </aside>
    </>
  );
};
