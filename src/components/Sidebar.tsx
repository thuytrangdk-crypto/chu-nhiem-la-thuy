import React, { useState, useEffect } from 'react';
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
  UserCheck,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { AppSettings, UserRole } from '../types';
import { apiRequest } from '../utils/api';

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
  const [supabaseStatus, setSupabaseStatus] = useState<{
    connected: boolean;
    checked: boolean;
  }>({
    connected: false,
    checked: false,
  });

  useEffect(() => {
    let isMounted = true;
    const checkSupabase = async () => {
      try {
        const res = await apiRequest<{ connected: boolean }>('/api/supabase/status');
        if (isMounted) {
          setSupabaseStatus({ connected: !!res.connected, checked: true });
        }
      } catch (err) {
        if (isMounted) {
          setSupabaseStatus({ connected: false, checked: true });
        }
      }
    };
    checkSupabase();
    return () => {
      isMounted = false;
    };
  }, []);

  const navItems: {
    id: MainNavTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    teacherOnly?: boolean;
  }[] = [
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
        className={`fixed md:sticky top-0 left-0 z-40 h-screen w-64 bg-white border-r border-slate-200/90 flex flex-col transition-transform duration-200 ease-in-out md:translate-x-0 shrink-0 ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header: Identity at top of left sidebar */}
        <div className="p-4 border-b border-slate-100 flex flex-col gap-2.5">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-600 via-sky-500 to-indigo-500 flex items-center justify-center text-white shadow-sm shadow-sky-500/20">
                <GraduationCap className="w-6 h-6" />
              </div>
              <div>
                <div className="text-sm font-extrabold text-slate-900 tracking-tight leading-tight uppercase">
                  {settings.appName || 'TRỢ LÝ CHỦ NHIỆM'}
                </div>
                <div className="text-xs font-bold text-sky-700 leading-tight">
                  Lớp {settings.className} <span className="font-normal text-slate-400">•</span> GVCN: {settings.teacherName}
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

          <div className="text-[11px] text-slate-500 font-medium leading-relaxed">
            {settings.schoolName} <span className="text-slate-300">•</span> {settings.academicYear}
          </div>

          {/* Real Supabase Connection Indicator */}
          <div className="mt-1">
            {supabaseStatus.checked ? (
              supabaseStatus.connected ? (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200/80 text-[11px] font-semibold text-emerald-800">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Supabase: Đã kết nối</span>
                </div>
              ) : (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200/80 text-[11px] font-medium text-amber-800">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  <span>Supabase: Ngoại tuyến</span>
                </div>
              )
            ) : (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-50 border border-slate-200 text-[11px] text-slate-500">
                <span className="w-2 h-2 rounded-full bg-slate-400 animate-pulse" />
                <span>Supabase: Đang kiểm tra...</span>
              </div>
            )}
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-3 py-3.5 space-y-1.5 overflow-y-auto">
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
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold tracking-wide transition-all cursor-pointer ${
                  isActive
                    ? 'bg-sky-50/90 text-sky-700 shadow-xs border border-sky-200/70'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50/80'
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

        {/* User identification badge */}
        <div className="px-4 py-2.5 mx-3 mb-2 rounded-xl bg-slate-50 border border-slate-200/60 flex items-center gap-2 text-xs">
          {role === 'teacher' ? (
            <>
              <ShieldCheck className="w-4 h-4 text-sky-600 shrink-0" />
              <div className="truncate">
                <span className="font-bold text-slate-800 block truncate">{settings.teacherName}</span>
                <span className="text-[10px] text-slate-500">Giáo viên chủ nhiệm</span>
              </div>
            </>
          ) : (
            <>
              <UserCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <div className="truncate">
                <span className="font-bold text-slate-800 block truncate">{currentStudentName || 'Học sinh'}</span>
                <span className="text-[10px] text-slate-500">Tài khoản học sinh</span>
              </div>
            </>
          )}
        </div>

        {/* Bottom User Controls (Only Place Password Change & Logout Appear) */}
        <div className="p-3 border-t border-slate-100 bg-slate-50/60 space-y-1">
          <button
            onClick={() => {
              onOpenChangePassword();
              onCloseMobile();
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-white rounded-xl transition-colors cursor-pointer"
          >
            <KeyRound className="w-4 h-4 text-slate-400" />
            <span>Đổi mật khẩu</span>
          </button>
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50/80 rounded-xl transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4 text-rose-500" />
            <span>Đăng xuất</span>
          </button>
        </div>
      </aside>
    </>
  );
};
