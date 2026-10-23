import React, { useState, useEffect } from 'react';
import {
  Settings,
  Scale,
  BookOpen,
  Save,
  Plus,
  Trash2,
  Edit2,
  CheckCircle,
  AlertCircle,
  Database,
  Download,
  Upload,
  RefreshCw,
  KeyRound,
  ShieldAlert,
  Cloud,
  Copy,
  ExternalLink,
  Check
} from 'lucide-react';
import { AppData, DisciplineRule, Subject } from '../types';
import { apiRequest } from '../utils/api';
import { SUPABASE_SQL_SCHEMA } from '../utils/supabase';

interface SettingsViewProps {
  data: AppData;
  onRefreshData: () => Promise<void>;
  onOpenChangePassword: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  data,
  onRefreshData,
  onOpenChangePassword,
}) => {
  const [activeTab, setActiveTab] = useState<'general' | 'discipline' | 'subjects'>('general');

  // --- TAB 1: GENERAL SETTINGS STATE ---
  const [appName, setAppName] = useState(data.settings.appName);
  const [schoolName, setSchoolName] = useState(data.settings.schoolName);
  const [className, setClassName] = useState(data.settings.className);
  const [teacherName, setTeacherName] = useState(data.settings.teacherName);
  const [academicYear, setAcademicYear] = useState(data.settings.academicYear);
  const [baseDisciplinePoints, setBaseDisciplinePoints] = useState(data.settings.baseDisciplinePoints);
  const [isSavingGeneral, setIsSavingGeneral] = useState(false);
  const [generalMessage, setGeneralMessage] = useState<string | null>(null);

  // Teacher password change inside settings state
  const [showPasswordInputs, setShowPasswordInputs] = useState(false);
  const [teacherNewPassword, setTeacherNewPassword] = useState('');
  const [teacherConfirmPassword, setTeacherConfirmPassword] = useState('');

  // Thresholds state
  const [thresholds, setThresholds] = useState(() => {
    return data.settings.conductThresholds || [
      { label: 'Tốt', minScore: 90 },
      { label: 'Khá', minScore: 75 },
      { label: 'Đạt', minScore: 50 },
      { label: 'Chưa đạt', minScore: 0 },
    ];
  });

  // --- TAB 2: DISCIPLINE RULES STATE ---
  const [isAddingRule, setIsAddingRule] = useState(false);
  const [editingRule, setEditingRule] = useState<DisciplineRule | null>(null);
  const [ruleName, setRuleName] = useState('');
  const [ruleGroup, setRuleGroup] = useState<'Học tập' | 'Nề nếp' | 'Chuyên cần' | 'Phong trào' | 'Khác'>('Nề nếp');
  const [rulePoints, setRulePoints] = useState(0);
  const [ruleLinkedAtt, setRuleLinkedAtt] = useState<'none' | 'present' | 'excused_absence' | 'unexcused_absence' | 'late'>('none');

  // --- TAB 3: SUBJECTS STATE ---
  const [isAddingSubject, setIsAddingSubject] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [subjectName, setSubjectName] = useState('');

  // Backup / Restore state
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);

  // Supabase state
  const [supabaseStatus, setSupabaseStatus] = useState<{
    connected: boolean;
    url: string;
    lastSync: string | null;
    error: string | null;
    isTableCreated: boolean;
  } | null>(null);
  const [isSyncingSupabase, setIsSyncingSupabase] = useState(false);
  const [supabaseMessage, setSupabaseMessage] = useState<string | null>(null);
  const [copiedSql, setCopiedSql] = useState(false);

  useEffect(() => {
    apiRequest('/api/supabase/status')
      .then((res) => setSupabaseStatus(res))
      .catch(() => {});
  }, []);

  const handleSyncSupabase = async () => {
    setIsSyncingSupabase(true);
    setSupabaseMessage(null);
    try {
      const res = await apiRequest('/api/supabase/sync', { method: 'POST' });
      setSupabaseMessage(res.message);
      const stat = await apiRequest('/api/supabase/status');
      setSupabaseStatus(stat);
    } catch (err: any) {
      alert(err.message || 'Lỗi khi đồng bộ lên Supabase');
    } finally {
      setIsSyncingSupabase(false);
    }
  };

  const handleCopySql = () => {
    navigator.clipboard.writeText(SUPABASE_SQL_SCHEMA);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2500);
  };

  // ---------------- HANDLER: SAVE GENERAL SETTINGS ----------------
  const handleSaveGeneral = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingGeneral(true);
    setGeneralMessage(null);

    if (showPasswordInputs && teacherNewPassword) {
      if (teacherNewPassword.length < 6) {
        alert('Mật khẩu mới phải có tối thiểu 6 ký tự');
        setIsSavingGeneral(false);
        return;
      }
      if (teacherNewPassword !== teacherConfirmPassword) {
        alert('Xác nhận mật khẩu mới không khớp!');
        setIsSavingGeneral(false);
        return;
      }
    }

    try {
      await apiRequest('/api/settings', {
        method: 'POST',
        body: {
          appName,
          schoolName,
          className,
          teacherName,
          academicYear,
          baseDisciplinePoints: Number(baseDisciplinePoints),
          conductThresholds: thresholds,
          teacherPassword: showPasswordInputs && teacherNewPassword ? teacherNewPassword : undefined,
        },
      });
      await onRefreshData();
      if (showPasswordInputs && teacherNewPassword) {
        setTeacherNewPassword('');
        setTeacherConfirmPassword('');
        setShowPasswordInputs(false);
        setGeneralMessage('Đã lưu cài đặt và cập nhật mật khẩu GVCN thành công!');
      } else {
        setGeneralMessage('Đã lưu các thay đổi cài đặt chung thành công!');
      }
      setTimeout(() => setGeneralMessage(null), 3500);
    } catch (err: any) {
      alert(err.message || 'Lỗi khi lưu cài đặt');
    } finally {
      setIsSavingGeneral(false);
    }
  };

  // ---------------- HANDLER: DISCIPLINE RULES ----------------
  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/api/discipline/rules', {
        method: 'POST',
        body: {
          id: editingRule ? editingRule.id : undefined,
          name: ruleName,
          group: ruleGroup,
          points: Number(rulePoints),
          linkedAttendance: ruleLinkedAtt,
          isActive: true,
        },
      });
      await onRefreshData();
      setIsAddingRule(false);
      setEditingRule(null);
      setRuleName('');
      setRulePoints(0);
      setRuleLinkedAtt('none');
    } catch (err: any) {
      alert(err.message || 'Lỗi khi lưu quy tắc thi đua');
    }
  };

  const handleDeactivateRule = async (id: string) => {
    if (!confirm('Ngừng áp dụng quy tắc thi đua này? (Dữ liệu thi đua cũ vẫn được bảo lưu)')) return;
    try {
      await apiRequest(`/api/discipline/rules/${id}`, { method: 'DELETE' });
      await onRefreshData();
    } catch (err: any) {
      alert(err.message || 'Lỗi khi ngừng quy tắc');
    }
  };

  // ---------------- HANDLER: SUBJECTS ----------------
  const handleSaveSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/api/subjects', {
        method: 'POST',
        body: {
          id: editingSubject ? editingSubject.id : undefined,
          name: subjectName,
          order: data.subjects.length + 1,
          isActive: true,
        },
      });
      await onRefreshData();
      setIsAddingSubject(false);
      setEditingSubject(null);
      setSubjectName('');
    } catch (err: any) {
      alert(err.message || 'Lỗi khi lưu môn học');
    }
  };

  const handleDeactivateSubject = async (id: string) => {
    if (!confirm('Ngừng sử dụng môn học này? Bảng điểm lịch sử vẫn sẽ được bảo lưu.')) return;
    try {
      await apiRequest(`/api/subjects/${id}`, { method: 'DELETE' });
      await onRefreshData();
    } catch (err: any) {
      alert(err.message || 'Lỗi khi ngừng môn học');
    }
  };

  // ---------------- HANDLER: BACKUP & RESTORE ----------------
  const handleExportBackup = async () => {
    try {
      const res = await apiRequest('/api/backup/export');
      const blob = new Blob([JSON.stringify(res, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `GVCN_Backup_${data.settings.className}_${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err.message || 'Lỗi khi xuất file sao lưu');
    }
  };

  const handleRestoreBackup = async () => {
    if (!restoreFile) {
      alert('Vui lòng chọn file sao lưu .json trước');
      return;
    }

    if (!confirm('Khôi phục sẽ ghi đè toàn bộ dữ liệu hiện tại bằng file sao lưu. Bạn có chắc chắn?')) {
      return;
    }

    setIsRestoring(true);
    try {
      const text = await restoreFile.text();
      const backupData = JSON.parse(text);
      const res = await apiRequest('/api/backup/restore', {
        method: 'POST',
        body: { backupData },
      });
      alert(res.message);
      await onRefreshData();
      setRestoreFile(null);
    } catch (err: any) {
      alert(err.message || 'Lỗi khi khôi phục dữ liệu');
    } finally {
      setIsRestoring(false);
    }
  };

  const handleResetDemoData = async () => {
    if (!confirm('Khôi phục lại toàn bộ dữ liệu mẫu ban đầu của hệ thống? Dữ liệu hiện tại sẽ được thay thế.')) {
      return;
    }

    try {
      const res = await apiRequest('/api/database/reset-demo', { method: 'POST' });
      alert(res.message);
      await onRefreshData();
    } catch (err: any) {
      alert(err.message || 'Lỗi khi đặt lại dữ liệu mẫu');
    }
  };

  return (
    <div className="space-y-5">
      {/* 3 Main Tabs */}
      <div className="flex bg-white p-1 rounded-2xl border border-slate-200/80 shadow-xs">
        {[
          { id: 'general', label: '1. CÀI ĐẶT CHUNG', icon: Settings },
          { id: 'discipline', label: '2. QUY TẮC THI ĐUA', icon: Scale },
          { id: 'subjects', label: '3. MÔN HỌC', icon: BookOpen },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 py-2.5 text-xs font-semibold rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer ${
                isActive
                  ? 'bg-sky-50 text-sky-800 shadow-xs border border-sky-200/70'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-sky-600' : 'text-slate-400'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ================= TAB 1: CÀI ĐẶT CHUNG ================= */}
      {activeTab === 'general' && (
        <div className="space-y-6">
          <form
            onSubmit={handleSaveGeneral}
            className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-5"
          >
            <div className="pb-3 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-800">Thông Tin Ứng Dụng & Lớp Học</h3>
                <p className="text-xs text-slate-500">
                  Khi thay đổi thông tin, toàn bộ hệ thống sẽ cập nhật tên trường, lớp, giáo viên tương ứng
                </p>
              </div>
              <button
                type="submit"
                disabled={isSavingGeneral}
                className="px-4 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                {isSavingGeneral ? 'Đang lưu...' : 'Lưu Cài Đặt'}
              </button>
            </div>

            {generalMessage && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>{generalMessage}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tên ứng dụng
                </label>
                <input
                  type="text"
                  value={appName}
                  onChange={(e) => setAppName(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tên trường
                </label>
                <input
                  type="text"
                  value={schoolName}
                  onChange={(e) => setSchoolName(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tên lớp
                </label>
                <input
                  type="text"
                  value={className}
                  onChange={(e) => setClassName(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tên Giáo viên chủ nhiệm
                </label>
                <input
                  type="text"
                  value={teacherName}
                  onChange={(e) => setTeacherName(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Năm học
                </label>
                <input
                  type="text"
                  value={academicYear}
                  onChange={(e) => setAcademicYear(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                  required
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-slate-700">
                    Mật khẩu giáo viên chủ nhiệm
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowPasswordInputs(!showPasswordInputs)}
                    className="text-[11px] text-sky-600 hover:text-sky-800 hover:underline cursor-pointer"
                  >
                    {showPasswordInputs ? 'Thu gọn' : 'Đổi trực tiếp tại đây'}
                  </button>
                </div>

                {!showPasswordInputs ? (
                  <button
                    type="button"
                    onClick={onOpenChangePassword}
                    className="w-full px-3 py-2 text-xs text-left text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-xl flex items-center justify-between cursor-pointer transition-colors"
                  >
                    <span className="flex items-center gap-1.5 font-medium">
                      <KeyRound className="w-3.5 h-3.5" />
                      Mở hộp thoại đổi mật khẩu GVCN
                    </span>
                    <span className="text-[11px] font-semibold text-sky-600 bg-white px-2 py-0.5 rounded-md border border-sky-200 shadow-2xs">Đổi mật khẩu</span>
                  </button>
                ) : (
                  <div className="p-3 bg-sky-50/70 border border-sky-200 rounded-xl space-y-2.5">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-700 mb-1">
                        Mật khẩu mới (tối thiểu 6 ký tự)
                      </label>
                      <input
                        type="password"
                        placeholder="Nhập mật khẩu mới"
                        value={teacherNewPassword}
                        onChange={(e) => setTeacherNewPassword(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-700 mb-1">
                        Xác nhận mật khẩu mới
                      </label>
                      <input
                        type="password"
                        placeholder="Nhập lại mật khẩu mới"
                        value={teacherConfirmPassword}
                        onChange={(e) => setTeacherConfirmPassword(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                      />
                    </div>
                    <p className="text-[10px] text-slate-500">
                      Mật khẩu mới sẽ được lưu vĩnh viễn khi bạn bấm &ldquo;Lưu Cài Đặt Chung&rdquo; bên dưới.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Thi đua base points & thresholds */}
            <div className="pt-4 border-t border-slate-100 space-y-4">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                Cấu Hình Thi Đua & Xếp Loại Rèn Luyện
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Điểm nền mỗi kỳ đánh giá
                  </label>
                  <input
                    type="number"
                    value={baseDisciplinePoints}
                    onChange={(e) => setBaseDisciplinePoints(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs font-mono font-bold bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Tổng điểm = Điểm nền + tổng điểm cộng/trừ trong kỳ
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Ngưỡng xếp loại rèn luyện
                  </label>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {thresholds.map((th, idx) => (
                      <div key={idx} className="flex items-center gap-1.5 bg-slate-50 p-2 rounded-lg border border-slate-200">
                        <span className="font-semibold text-slate-700 w-16">{th.label}:</span>
                        <input
                          type="number"
                          value={th.minScore}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setThresholds((prev) =>
                              prev.map((t, i) => (i === idx ? { ...t, minScore: val } : t))
                            );
                          }}
                          className="w-16 px-1.5 py-0.5 bg-white border border-slate-200 rounded text-center font-mono font-bold"
                        />
                        <span className="text-[10px] text-slate-400">đ trở lên</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </form>

          {/* Supabase Cloud Database Integration Card */}
          <div className="bg-white p-6 rounded-2xl border border-emerald-200/90 shadow-xs space-y-4">
            <div className="pb-3 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
                  <Cloud className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                    Cơ Sở Dữ Liệu Đám Mây Supabase
                  </h3>
                  <p className="text-xs text-slate-500">
                    Dữ liệu lớp học được đồng bộ thời gian thực lên máy chủ Supabase PostgreSQL
                  </p>
                </div>
              </div>

              {/* Status Badge */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold px-2.5 py-1 rounded-lg border flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border-emerald-200">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                  Đang kết nối: sohuavueougdlsqerwuk.supabase.co
                </span>
              </div>
            </div>

            {supabaseMessage && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>{supabaseMessage}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="text-xs font-bold text-slate-800">Trạng Thái Đồng Bộ Supabase</div>
                <div className="text-xs text-slate-600 space-y-1">
                  <div>
                    Dự án: <strong className="font-mono text-slate-800">sohuavueougdlsqerwuk</strong>
                  </div>
                  <div>
                    Lần đồng bộ gần nhất:{' '}
                    <strong className="text-slate-800 font-mono">
                      {supabaseStatus?.lastSync
                        ? new Date(supabaseStatus.lastSync).toLocaleString('vi-VN')
                        : 'Vừa khởi tạo'}
                    </strong>
                  </div>
                  <div className="text-[11px] text-slate-500">
                    * Mọi thay đổi về học sinh, thi đua, điểm danh sẽ tự động sao lưu lên máy chủ và Supabase.
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    disabled={isSyncingSupabase}
                    onClick={handleSyncSupabase}
                    className="w-full py-2 px-3 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncingSupabase ? 'animate-spin' : ''}`} />
                    {isSyncingSupabase ? 'Đang đồng bộ...' : 'Đồng Bộ Lên Supabase Ngay'}
                  </button>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 flex flex-col justify-between">
                <div>
                  <div className="text-xs font-bold text-slate-800">Khởi Tạo Bảng SQL Trên Supabase</div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Nếu bạn vừa tạo dự án mới trên Supabase, hãy copy đoạn mã SQL này, dán vào <strong>SQL Editor</strong> trên Supabase và bấm <strong>RUN</strong>.
                  </p>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={handleCopySql}
                    className="flex-1 py-2 px-3 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    {copiedSql ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-700">Đã sao chép SQL!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-slate-600" />
                        Sao Chép Mã SQL
                      </>
                    )}
                  </button>
                  <a
                    href="https://supabase.com/dashboard/project/sohuavueougdlsqerwuk/sql"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="py-2 px-3 text-xs font-semibold text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-xl flex items-center justify-center gap-1 cursor-pointer"
                  >
                    Mở Supabase SQL
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </div>

            {/* SQL Script Accordion / Preview */}
            <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-900 text-slate-200">
              <div className="px-4 py-2 bg-slate-800 text-[11px] font-mono text-slate-300 flex items-center justify-between border-b border-slate-700">
                <span>Mã SQL khởi tạo bảng trên Supabase (gvcn_store):</span>
                <button
                  type="button"
                  onClick={handleCopySql}
                  className="hover:text-white flex items-center gap-1 text-[11px] cursor-pointer"
                >
                  <Copy className="w-3 h-3" />
                  {copiedSql ? 'Đã sao chép' : 'Sao chép'}
                </button>
              </div>
              <pre className="p-3 text-[11px] font-mono overflow-x-auto leading-relaxed max-h-36">
                {SUPABASE_SQL_SCHEMA}
              </pre>
            </div>
          </div>

          {/* Data Backup & Restore & Reset demo */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="pb-3 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <Database className="w-4 h-4 text-sky-600" />
                  Sao Lưu & Khôi Phục Dữ Liệu
                </h3>
                <p className="text-xs text-slate-500">
                  Dữ liệu lớp học được lưu trữ bền vững trên máy chủ. Bạn có thể tải file sao lưu JSON về máy.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Backup export */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between space-y-3">
                <div>
                  <span className="text-xs font-bold text-slate-800 block">Sao lưu dữ liệu</span>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Tải về toàn bộ hồ sơ lớp, thi đua, điểm số, sơ đồ lớp dưới dạng file JSON.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleExportBackup}
                  className="w-full py-2 px-3 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Download className="w-3.5 h-3.5 text-sky-600" />
                  Tải Bản Sao Lưu JSON
                </button>
              </div>

              {/* Backup restore */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between space-y-3">
                <div>
                  <span className="text-xs font-bold text-slate-800 block">Khôi phục từ file</span>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Tải lên file sao lưu .json đã lưu trước đây để phục hồi lại dữ liệu lớp.
                  </p>
                </div>
                <div className="space-y-2">
                  <input
                    type="file"
                    accept=".json"
                    onChange={(e) => setRestoreFile(e.target.files?.[0] || null)}
                    className="text-xs text-slate-600 w-full"
                  />
                  <button
                    type="button"
                    disabled={!restoreFile || isRestoring}
                    onClick={handleRestoreBackup}
                    className="w-full py-2 px-3 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    {isRestoring ? 'Đang khôi phục...' : 'Khôi Phục Dữ Liệu'}
                  </button>
                </div>
              </div>

              {/* Reset demo data */}
              <div className="p-4 rounded-xl bg-rose-50/40 border border-rose-200 flex flex-col justify-between space-y-3">
                <div>
                  <span className="text-xs font-bold text-rose-800 flex items-center gap-1">
                    <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                    Đặt lại dữ liệu mẫu
                  </span>
                  <p className="text-[11px] text-rose-700 mt-1">
                    Khôi phục lại danh sách lớp mẫu gồm 12 học sinh và cấu hình chuẩn ban đầu.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleResetDemoData}
                  className="w-full py-2 px-3 text-xs font-semibold text-rose-700 bg-white hover:bg-rose-50 border border-rose-300 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Đặt Lại Dữ Liệu Mẫu
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB 2: QUY TẮC THI ĐUA ================= */}
      {activeTab === 'discipline' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-5">
          <div className="pb-3 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-800">Quản Lý Quy Tắc Thi Đua</h3>
              <p className="text-xs text-slate-500">
                Thiết lập điểm cộng, điểm trừ và liên kết tự động với điểm danh
              </p>
            </div>

            <button
              onClick={() => {
                setEditingRule(null);
                setRuleName('');
                setRuleGroup('Nề nếp');
                setRulePoints(-2);
                setRuleLinkedAtt('none');
                setIsAddingRule(true);
              }}
              className="px-3.5 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4" />
              Thêm Quy Tắc Mới
            </button>
          </div>

          {/* Add / Edit Rule Form */}
          {isAddingRule && (
            <form
              onSubmit={handleSaveRule}
              className="p-4 bg-sky-50/50 border border-sky-200 rounded-xl space-y-3 animate-in fade-in"
            >
              <h4 className="text-xs font-bold text-sky-900">
                {editingRule ? 'Chỉnh Sửa Quy Tắc' : 'Thêm Quy Tắc Thi Đua Mới'}
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Tên quy tắc sự việc *
                  </label>
                  <input
                    type="text"
                    value={ruleName}
                    onChange={(e) => setRuleName(e.target.value)}
                    placeholder="Ví dụ: Đi học muộn, Giúp đỡ bạn bè..."
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Nhóm quy tắc
                  </label>
                  <select
                    value={ruleGroup}
                    onChange={(e: any) => setRuleGroup(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg"
                  >
                    <option value="Học tập">Học tập</option>
                    <option value="Nề nếp">Nề nếp</option>
                    <option value="Chuyên cần">Chuyên cần</option>
                    <option value="Phong trào">Phong trào</option>
                    <option value="Khác">Khác</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Điểm cộng / trừ (+/-) *
                  </label>
                  <input
                    type="number"
                    value={rulePoints}
                    onChange={(e) => setRulePoints(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg font-mono font-bold"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Liên kết trạng thái điểm danh tự động
                </label>
                <select
                  value={ruleLinkedAtt}
                  onChange={(e: any) => setRuleLinkedAtt(e.target.value)}
                  className="w-full sm:w-1/2 px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg"
                >
                  <option value="none">Không liên kết điểm danh</option>
                  <option value="late">Điểm danh: Đi muộn</option>
                  <option value="excused_absence">Điểm danh: Vắng có phép</option>
                  <option value="unexcused_absence">Điểm danh: Vắng không phép</option>
                  <option value="present">Điểm danh: Có mặt</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddingRule(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-200 rounded-lg"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-lg shadow-xs"
                >
                  Lưu Quy Tắc
                </button>
              </div>
            </form>
          )}

          {/* Rules Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-[11px]">
                <tr>
                  <th className="py-2.5 px-3 w-12 text-center">STT</th>
                  <th className="py-2.5 px-3">Tên quy tắc</th>
                  <th className="py-2.5 px-3 w-32">Nhóm</th>
                  <th className="py-2.5 px-3 w-28 text-center">Điểm cộng/trừ</th>
                  <th className="py-2.5 px-3 w-40">Liên kết điểm danh</th>
                  <th className="py-2.5 px-3 w-28">Trạng thái</th>
                  <th className="py-2.5 px-3 w-24 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.disciplineRules.map((rule, idx) => (
                  <tr key={rule.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 text-center font-mono text-slate-400">
                      {idx + 1}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-slate-800">
                      {rule.name}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">{rule.group}</td>
                    <td className="py-2.5 px-3 text-center">
                      <span
                        className={`font-mono font-bold ${
                          rule.points >= 0 ? 'text-emerald-700' : 'text-rose-600'
                        }`}
                      >
                        {rule.points >= 0 ? `+${rule.points}` : rule.points} đ
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">
                      {rule.linkedAttendance === 'late'
                        ? 'Đi muộn'
                        : rule.linkedAttendance === 'excused_absence'
                        ? 'Vắng có phép'
                        : rule.linkedAttendance === 'unexcused_absence'
                        ? 'Vắng không phép'
                        : rule.linkedAttendance === 'present'
                        ? 'Có mặt'
                        : 'Không liên kết'}
                    </td>
                    <td className="py-2.5 px-3">
                      {rule.isActive !== false ? (
                        <span className="text-[11px] text-emerald-700 font-medium">Đang áp dụng</span>
                      ) : (
                        <span className="text-[11px] text-slate-400 font-medium">Ngừng áp dụng</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => {
                            setEditingRule(rule);
                            setRuleName(rule.name);
                            setRuleGroup(rule.group);
                            setRulePoints(rule.points);
                            setRuleLinkedAtt(rule.linkedAttendance || 'none');
                            setIsAddingRule(true);
                          }}
                          className="p-1 text-slate-600 hover:bg-slate-100 rounded"
                          title="Sửa quy tắc"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeactivateRule(rule.id)}
                          className="p-1 text-rose-500 hover:bg-rose-50 rounded"
                          title="Ngừng quy tắc"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= TAB 3: MÔN HỌC ================= */}
      {activeTab === 'subjects' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-5">
          <div className="pb-3 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-800">Quản Lý Danh Sách Môn Học</h3>
              <p className="text-xs text-slate-500">
                Các môn học được đồng bộ sang phần Bảng điểm học tập của học sinh
              </p>
            </div>

            <button
              onClick={() => {
                setEditingSubject(null);
                setSubjectName('');
                setIsAddingSubject(true);
              }}
              className="px-3.5 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4" />
              Thêm Môn Học Mới
            </button>
          </div>

          {/* Add / Edit Subject Form */}
          {isAddingSubject && (
            <form
              onSubmit={handleSaveSubject}
              className="p-4 bg-sky-50/50 border border-sky-200 rounded-xl flex items-center gap-3 animate-in fade-in"
            >
              <div className="flex-1">
                <input
                  type="text"
                  value={subjectName}
                  onChange={(e) => setSubjectName(e.target.value)}
                  placeholder="Nhập tên môn học (ví dụ: Tin học, Giáo dục địa phương...)"
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:bg-white"
                  required
                />
              </div>

              <button
                type="button"
                onClick={() => setIsAddingSubject(false)}
                className="px-3 py-2 text-xs text-slate-600 hover:bg-slate-200 rounded-lg"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-lg shadow-xs"
              >
                {editingSubject ? 'Lưu Thay Đổi' : 'Thêm Môn'}
              </button>
            </form>
          )}

          {/* Subjects Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden max-w-xl">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                <tr>
                  <th className="py-2.5 px-4 w-16 text-center">STT</th>
                  <th className="py-2.5 px-4">Tên môn học</th>
                  <th className="py-2.5 px-4 w-32">Trạng thái</th>
                  <th className="py-2.5 px-4 w-24 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.subjects.map((sub, index) => (
                  <tr key={sub.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-4 text-center font-mono text-slate-400">
                      {index + 1}
                    </td>
                    <td className="py-2.5 px-4 font-semibold text-slate-800">
                      {sub.name}
                    </td>
                    <td className="py-2.5 px-4">
                      {sub.isActive !== false ? (
                        <span className="text-emerald-700 font-medium">Đang giảng dạy</span>
                      ) : (
                        <span className="text-slate-400 font-medium">Đã dừng</span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => {
                            setEditingSubject(sub);
                            setSubjectName(sub.name);
                            setIsAddingSubject(true);
                          }}
                          className="p-1 text-slate-600 hover:bg-slate-100 rounded"
                          title="Sửa tên môn"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeactivateSubject(sub.id)}
                          className="p-1 text-rose-500 hover:bg-rose-50 rounded"
                          title="Ngừng sử dụng môn"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
