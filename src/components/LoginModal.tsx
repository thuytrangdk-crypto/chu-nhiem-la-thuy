import React, { useState } from 'react';
import { LogIn, Key, GraduationCap, ShieldCheck, AlertCircle, RefreshCw } from 'lucide-react';
import { apiRequest, setStoredToken } from '../utils/api';
import { AuthState } from '../types';

interface LoginModalProps {
  onLoginSuccess: (auth: AuthState) => void;
  appName: string;
  className: string;
  schoolName: string;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  onLoginSuccess,
  appName,
  className,
  schoolName,
}) => {
  const [role, setRole] = useState<'teacher' | 'student'>('teacher');
  const [password, setPassword] = useState('');
  const [studentCode, setStudentCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsLoading(true);

    try {
      const res = await apiRequest('/api/auth/login', {
        method: 'POST',
        body: {
          role,
          password: password.trim(),
          studentCode: studentCode.trim().toUpperCase(),
        },
      });

      setStoredToken(res.token);

      onLoginSuccess({
        token: res.token,
        role,
        studentId: res.user.id,
        studentCode: res.user.studentCode,
        fullName: res.user.fullName,
        teacherName: res.user.teacherName,
        isInitialPassword: res.user.isInitialPassword,
      });
    } catch (err: any) {
      setErrorMessage(err.message || 'Đăng nhập không thành công');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#DCEFFA] via-[#EDF6FD] to-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl shadow-sky-900/5 border border-sky-100 overflow-hidden">
        {/* Header Banner */}
        <div className="bg-gradient-to-r from-sky-600 via-sky-500 to-sky-600 p-6 text-white text-center">
          <div className="w-14 h-14 bg-white/20 backdrop-blur-xs rounded-xl flex items-center justify-center mx-auto mb-3 shadow-inner">
            <GraduationCap className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{appName}</h1>
          <p className="text-sky-100 text-xs mt-1">
            {schoolName} · Lớp {className}
          </p>
        </div>

        {/* Role Segmented Tabs */}
        <div className="p-6">
          <div className="flex bg-slate-100 p-1 rounded-xl mb-6">
            <button
              type="button"
              onClick={() => {
                setRole('teacher');
                setErrorMessage(null);
              }}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition-all ${
                role === 'teacher'
                  ? 'bg-white text-sky-800 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              Giáo Viên Chủ Nhiệm
            </button>
            <button
              type="button"
              onClick={() => {
                setRole('student');
                setErrorMessage(null);
              }}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition-all ${
                role === 'student'
                  ? 'bg-white text-sky-800 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <GraduationCap className="w-4 h-4" />
              Học Sinh
            </button>
          </div>

          {errorMessage && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-xs text-rose-700">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {role === 'student' && (
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Mã học sinh
                </label>
                <input
                  type="text"
                  placeholder="Ví dụ: HS001"
                  value={studentCode}
                  onChange={(e) => setStudentCode(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-colors uppercase font-mono"
                  required
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Mã học sinh do GVCN cung cấp (HS001, HS002, ...)
                </p>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                {role === 'teacher' ? 'Mật khẩu quản trị' : 'Mật khẩu'}
              </label>
              <div className="relative">
                <input
                  type="password"
                  placeholder={
                    role === 'teacher'
                      ? 'Nhập mật khẩu GVCN'
                      : 'Mặc định: ngày sinh DDMMYYYY (vd: 15022008)'
                  }
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-colors"
                  required
                />
                <Key className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
              </div>
              {role === 'teacher' ? (
                <p className="text-[11px] text-slate-500 mt-1">
                  Mật khẩu mặc định: <span className="font-mono text-sky-700">giaovien123</span>
                </p>
              ) : (
                <p className="text-[11px] text-slate-500 mt-1">
                  Mật khẩu ban đầu là ngày sinh viết liền (vd: 15022008). Học sinh phải đổi mật khẩu khi đăng nhập lần đầu.
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 py-2.5 px-4 bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white font-medium text-sm rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Đang đăng nhập...
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  Đăng Nhập Vào Hệ Thống
                </>
              )}
            </button>
          </form>

          {/* Teacher quick hints */}
          <div className="mt-6 pt-4 border-t border-slate-100 text-center">
            <span className="text-[11px] text-slate-600">
              {role === 'teacher'
                ? 'Hệ thống quản lý lớp học dành riêng cho Giáo viên Chủ nhiệm'
                : 'Học sinh chỉ có quyền xem thông tin cá nhân và thông báo của lớp'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
