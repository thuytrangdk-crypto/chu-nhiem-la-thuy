import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, AlertCircle } from 'lucide-react';
import { AuthState, AppData, Student, PublicSettings } from './types';
import { apiRequest, getStoredToken, setStoredToken } from './utils/api';
import { LoginModal } from './components/LoginModal';
import { Sidebar, MainNavTab } from './components/Sidebar';
import { Header } from './components/Header';
import { DashboardView } from './components/DashboardView';
import { BoardAndSeatingView } from './components/BoardAndSeatingView';
import { StudentListView } from './components/StudentListView';
import { StudentDetailView } from './components/StudentDetailView';
import { SettingsView } from './components/SettingsView';
import { ChangePasswordModal } from './components/ChangePasswordModal';

export default function App() {
  const [auth, setAuth] = useState<AuthState>({
    token: getStoredToken(),
    role: null,
  });

  const [data, setData] = useState<AppData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Public settings for login screen (cached in localStorage & synced from server)
  const [publicSettings, setPublicSettings] = useState<PublicSettings>(() => {
    try {
      const saved = localStorage.getItem('gvcn_public_settings');
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      appName: 'GVCN',
      schoolName: 'Trường THCS Nguyễn Huệ',
      className: '9A2',
      teacherName: 'Cô Lã Thị Thủy',
    };
  });

  // Navigation
  const [currentTab, setCurrentTab] = useState<MainNavTab>('dashboard');
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);

  // Password Modal
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState<boolean>(false);
  const [isForcedInitialPassword, setIsForcedInitialPassword] = useState<boolean>(false);

  // Fetch public settings for login screen
  const fetchPublicInfo = useCallback(async () => {
    try {
      const info = await apiRequest<PublicSettings>('/api/public/info');
      if (info && info.schoolName && info.className) {
        setPublicSettings(info);
        try {
          localStorage.setItem('gvcn_public_settings', JSON.stringify(info));
        } catch {}
      }
    } catch (err) {
      // Ignore network error on public info, use cached fallback
    }
  }, []);

  useEffect(() => {
    fetchPublicInfo();
  }, [fetchPublicInfo]);

  // Keep publicSettings in sync when full data is loaded or updated
  useEffect(() => {
    if (data?.settings) {
      const updated = {
        appName: data.settings.appName,
        schoolName: data.settings.schoolName,
        className: data.settings.className,
        teacherName: data.settings.teacherName,
      };
      setPublicSettings(updated);
      try {
        localStorage.setItem('gvcn_public_settings', JSON.stringify(updated));
      } catch {}
    }
  }, [data?.settings]);

  // Fetch / refresh data
  const loadData = useCallback(async () => {
    try {
      setFetchError(null);
      const res = await apiRequest<AppData>('/api/data');
      setData(res);
    } catch (err: any) {
      setFetchError(err.message || 'Không thể tải dữ liệu');
      if (err.message && err.message.includes('hết hạn')) {
        handleLogout();
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Check existing session on mount
  useEffect(() => {
    const initAuth = async () => {
      const token = getStoredToken();
      if (!token) {
        setIsLoading(false);
        return;
      }

      try {
        const userRes = await apiRequest('/api/auth/me', { token });
        setAuth({
          token,
          role: userRes.role,
          studentId: userRes.id,
          studentCode: userRes.studentCode,
          fullName: userRes.fullName,
          teacherName: userRes.teacherName,
          isInitialPassword: userRes.isInitialPassword,
        });

        if (userRes.role === 'student' && userRes.isInitialPassword) {
          setIsForcedInitialPassword(true);
          setIsPasswordModalOpen(true);
        }

        await loadData();
      } catch (err) {
        // Invalid or expired token
        setStoredToken(null);
        setAuth({ token: null, role: null });
        setIsLoading(false);
      }
    };

    initAuth();
  }, [loadData]);

  const handleLoginSuccess = async (newAuth: AuthState) => {
    setAuth(newAuth);
    setIsLoading(true);

    if (newAuth.role === 'student' && newAuth.isInitialPassword) {
      setIsForcedInitialPassword(true);
      setIsPasswordModalOpen(true);
    }

    try {
      const res = await apiRequest<AppData>('/api/data', { token: newAuth.token });
      setData(res);
      setCurrentTab('dashboard');
      setSelectedStudentId(null);
    } catch (err: any) {
      setFetchError(err.message || 'Không thể tải dữ liệu');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    setStoredToken(null);
    setAuth({ token: null, role: null });
    setData(null);
    setSelectedStudentId(null);
    setCurrentTab('dashboard');
    fetchPublicInfo();
  };

  // If not logged in, render LoginModal
  if (!auth.token || !auth.role) {
    return (
      <LoginModal
        appName={data?.settings?.appName || publicSettings.appName}
        className={data?.settings?.className || publicSettings.className}
        schoolName={data?.settings?.schoolName || publicSettings.schoolName}
        isDefaultTeacherPassword={publicSettings.isDefaultTeacherPassword}
        onRefreshPublicInfo={fetchPublicInfo}
        onLoginSuccess={handleLoginSuccess}
      />
    );
  }

  // Loading state
  if (isLoading || !data) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 rounded-2xl bg-sky-100 text-sky-600 flex items-center justify-center mb-4">
          <RefreshCw className="w-6 h-6 animate-spin" />
        </div>
        <p className="text-sm font-semibold text-slate-700">Đang khởi tạo hệ thống quản trị lớp...</p>
        <p className="text-xs text-slate-400 mt-1">Dữ liệu được bảo mật và đồng bộ từ máy chủ</p>
      </div>
    );
  }

  // Determine current student for detail view
  let activeStudentForDetail: Student | null = null;
  if (auth.role === 'student') {
    // In student mode, always view own record
    activeStudentForDetail = data.currentUserStudent || (data.students[0] as Student) || null;
  } else if (selectedStudentId) {
    activeStudentForDetail = data.students.find((s) => s.id === selectedStudentId) || null;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* 1. Main Left Sidebar */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={(tab) => {
          setCurrentTab(tab);
          setSelectedStudentId(null); // reset student selection when switching tabs
        }}
        settings={data.settings}
        role={auth.role}
        currentStudentName={auth.fullName}
        isOpenMobile={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
        onOpenChangePassword={() => {
          setIsForcedInitialPassword(false);
          setIsPasswordModalOpen(true);
        }}
        onLogout={handleLogout}
      />

      {/* 2. Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen overflow-x-hidden">
        {/* Header */}
        <Header
          currentTab={currentTab}
          settings={data.settings}
          role={auth.role}
          studentName={auth.fullName}
          onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
          onOpenChangePassword={() => {
            setIsForcedInitialPassword(false);
            setIsPasswordModalOpen(true);
          }}
          onLogout={handleLogout}
        />

        {/* Global Error Banner if any */}
        {fetchError && (
          <div className="mx-4 md:mx-6 mt-4 p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-center justify-between text-xs text-rose-700">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
              <span>{fetchError}</span>
            </div>
            <button
              onClick={loadData}
              className="font-semibold underline hover:text-rose-900 cursor-pointer"
            >
              Thử lại
            </button>
          </div>
        )}

        {/* Main View Port */}
        <main className="flex-1 p-4 md:p-6 max-w-7xl w-full mx-auto">
          {/* TAB 1: TỔNG QUAN */}
          {currentTab === 'dashboard' && (
            <DashboardView
              data={data}
              role={auth.role}
              onNavigateToStudent={(studentId) => {
                if (auth.role === 'teacher') {
                  setCurrentTab('students');
                  setSelectedStudentId(studentId);
                }
              }}
              onNavigateToBoard={(tabIdx) => {
                setCurrentTab('board');
              }}
            />
          )}

          {/* TAB 2: BẢNG TIN & SƠ ĐỒ LỚP */}
          {currentTab === 'board' && (
            <BoardAndSeatingView
              data={data}
              role={auth.role}
              onRefreshData={loadData}
            />
          )}

          {/* TAB 3: HỌC SINH (Student Management or Student Detail Profile) */}
          {currentTab === 'students' && (
            <>
              {auth.role === 'teacher' ? (
                activeStudentForDetail ? (
                  <StudentDetailView
                    student={activeStudentForDetail}
                    data={data}
                    role={auth.role}
                    onBack={() => setSelectedStudentId(null)}
                    onRefreshData={loadData}
                  />
                ) : (
                  <StudentListView
                    data={data}
                    role={auth.role}
                    onSelectStudent={(studentId) => setSelectedStudentId(studentId)}
                    onRefreshData={loadData}
                  />
                )
              ) : (
                /* Student Role: View their own personal profile directly */
                activeStudentForDetail ? (
                  <StudentDetailView
                    student={activeStudentForDetail}
                    data={data}
                    role="student"
                    onRefreshData={loadData}
                  />
                ) : (
                  <div className="bg-white p-8 rounded-2xl text-center text-slate-500">
                    Không tìm thấy dữ liệu học sinh của bạn.
                  </div>
                )
              )}
            </>
          )}

          {/* TAB 4: CÀI ĐẶT (Teacher Only) */}
          {currentTab === 'settings' && auth.role === 'teacher' && (
            <SettingsView
              data={data}
              onRefreshData={loadData}
              onOpenChangePassword={() => {
                setIsForcedInitialPassword(false);
                setIsPasswordModalOpen(true);
              }}
            />
          )}
        </main>
      </div>

      {/* Global Change Password Modal */}
      <ChangePasswordModal
        isOpen={isPasswordModalOpen}
        isInitial={isForcedInitialPassword}
        role={auth.role}
        onClose={() => {
          if (!isForcedInitialPassword) {
            setIsPasswordModalOpen(false);
          }
        }}
        onSuccess={() => {
          setIsForcedInitialPassword(false);
          setIsPasswordModalOpen(false);
          if (auth.role === 'student') {
            setAuth((prev) => ({ ...prev, isInitialPassword: false }));
          }
          fetchPublicInfo();
        }}
      />
    </div>
  );
}
