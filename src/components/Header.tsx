import React from 'react';
import { Menu } from 'lucide-react';
import { AppSettings, UserRole } from '../types';
import { MainNavTab } from './Sidebar';

interface HeaderProps {
  currentTab: MainNavTab;
  settings: AppSettings;
  role: UserRole;
  studentName?: string;
  onOpenMobileSidebar: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  settings,
  role,
  onOpenMobileSidebar,
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
    <header className="sticky top-0 z-20 bg-white/90 backdrop-blur-md border-b border-slate-200/80 px-4 md:px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobileSidebar}
          className="md:hidden p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl"
          aria-label="Mở menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div>
          <h2 className="text-base font-bold text-slate-900 tracking-tight">
            {getTabTitle()}
          </h2>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-sky-800 bg-sky-50 px-2.5 py-1 rounded-lg border border-sky-100/80">
          Lớp {settings.className}
        </span>
      </div>
    </header>
  );
};
