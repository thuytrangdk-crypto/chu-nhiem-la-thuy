import React from 'react';
import { Menu, LogOut, KeyRound, ShieldCheck, GraduationCap } from 'lucide-react';
import { AppSettings, UserRole } from '../types';
import { MainNavTab } from './Sidebar';

interface HeaderProps {
  currentTab: MainNavTab;
  settings: AppSettings;
  role: UserRole;
  studentName?: string;
  onOpenMobileSidebar: () => void;
  onOpenChangePassword: () => void;
  onLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  settings,
  role,
  studentName,
  onOpenMobileSidebar,
  onOpenChangePassword,
  onLogout,
}) => {
  const getTabTitle = () => {
    switch (currentTab) {
      case 'dashboard':
        return 'Tổng Quan Lớp Học';
      case 'board':
        return 'Bảng Tin & Sơ Đồ Lớp';
      case 'students':
        return role === 'teacher' ? 'Quản Lý Học Sinh' : 'Hồ Sơ Học Sinh';
      case 'settings':
        return 'Cài Đặt Hệ Thống';
      default:
        return 'GVCN';
    }
  };

  return (
    <header className="sticky top-0 z-20 bg-white/90 backdrop-blur-md border-b border-slate-200/80 px-4 md:px-6 py-3 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobileSidebar}
          className="md:hidden p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg"
          aria-label="Mở menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div>
          <h2 className="text-base font-bold text-slate-900 tracking-tight">
            {getTabTitle()}
          </h2>
          <div className="hidden sm:flex items-center gap-2 text-[11px] text-slate-500">
            <span>{settings.schoolName}</span>
            <span aria-hidden="true">·</span>
            <span>Lớp {settings.className}</span>
            <span aria-hidden="true">·</span>
            <span>Năm học {settings.academicYear}</span>
          </div>
        </div>
      </div>

      {/* User profile & actions */}
      <div className="flex items-center gap-3">
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-sky-50/70 border border-sky-100 text-xs">
          {role === 'teacher' ? (
            <>
              <ShieldCheck className="w-4 h-4 text-sky-600" />
              <span className="font-semibold text-slate-800">{settings.teacherName}</span>
              <span className="text-sky-600 text-[11px] font-medium">(GVCN)</span>
            </>
          ) : (
            <>
              <GraduationCap className="w-4 h-4 text-sky-600" />
              <span className="font-semibold text-slate-800">{studentName || 'Học sinh'}</span>
              <span className="text-sky-600 text-[11px] font-medium">(Học sinh)</span>
            </>
          )}
        </div>

        <button
          onClick={onOpenChangePassword}
          title="Đổi mật khẩu"
          className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
        >
          <KeyRound className="w-4 h-4" />
        </button>

        <button
          onClick={onLogout}
          title="Đăng xuất"
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 border border-rose-200/60 rounded-lg transition-colors cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Đăng xuất</span>
        </button>
      </div>
    </header>
  );
};
