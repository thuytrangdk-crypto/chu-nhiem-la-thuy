import React, { useState, useMemo } from 'react';
import {
  Calendar,
  BookOpen,
  Award,
  BarChart3,
  CheckCircle,
  Clock,
  FileText,
  XCircle,
  Plus,
  Trash2,
  Edit2,
  Search,
  Printer,
  ChevronLeft,
  Download,
  Upload,
  AlertCircle,
  Save,
  FileSpreadsheet,
  TrendingUp,
  UserCheck,
  User,
  Phone,
  Shield,
  KeyRound,
  AlertTriangle,
  Contact2
} from 'lucide-react';
import { AppData, Student, UserRole, Grade } from '../types';
import { apiRequest } from '../utils/api';
import { calculateDisciplineScore, evaluateConduct, calculateAttendanceStats } from '../utils/scoring';
import { downloadGradeTemplate, exportStudentViolationsExcel } from '../utils/excel';

interface StudentDetailViewProps {
  student: Student;
  data: AppData;
  role: UserRole;
  onBack?: () => void;
  onRefreshData: () => Promise<void>;
  onEditStudentInfo?: (student: Student) => void;
}

export type DetailTab = 'personal' | 'attendance' | 'grades' | 'discipline' | 'handbook';

export const StudentDetailView: React.FC<StudentDetailViewProps> = ({
  student,
  data,
  role,
  onBack,
  onRefreshData,
  onEditStudentInfo,
}) => {
  const currentMonthNum = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();
  const defaultMonth = `${currentYear}-${String(currentMonthNum).padStart(2, '0')}`;

  const [activeTab, setActiveTab] = useState<DetailTab>('discipline');
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [selectedSemester, setSelectedSemester] = useState<'HK1' | 'HK2'>('HK1');

  // --- TAB THI ĐUA GHI NHẬN SỰ VIỆC STATE ---
  const todayDateStr = new Date().toISOString().split('T')[0];
  const [incidentDate, setIncidentDate] = useState(todayDateStr);
  const [selectedRuleId, setSelectedRuleId] = useState<string>(data.disciplineRules[0]?.id || '');
  const [incidentNote, setIncidentNote] = useState('');
  const [ruleSearch, setRuleSearch] = useState('');
  const [isSubmittingDiscipline, setIsSubmittingDiscipline] = useState(false);
  const [disciplineMessage, setDisciplineMessage] = useState<string | null>(null);

  // --- TAB ĐIỂM DANH STATE ---
  const [manualAttDate, setManualAttDate] = useState(todayDateStr);
  const [manualAttStatus, setManualAttStatus] = useState<
    'present' | 'excused_absence' | 'unexcused_absence' | 'late'
  >('present');
  const [isUpdatingAttendance, setIsUpdatingAttendance] = useState(false);

  // --- TAB HỌC TẬP STATE ---
  const [isAddingGrade, setIsAddingGrade] = useState(false);
  const [gradeSubjectId, setGradeSubjectId] = useState(data.subjects[0]?.id || '');
  const [gradeScoreType, setGradeScoreType] = useState<
    'diem_mieng' | '15_phut' | 'giua_ky' | 'cuoi_ky'
  >('giua_ky');
  const [gradeScore, setGradeScore] = useState('');
  const [gradeNote, setGradeNote] = useState('');
  const [editingGrade, setEditingGrade] = useState<Grade | null>(null);

  // Teacher feedback notes in Handbook / Summary
  const [teacherFeedback, setTeacherFeedback] = useState(
    'Học sinh có ý thức kỷ luật tốt, tích cực tham gia các phong trào của lớp.'
  );

  // Edit student profile modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editCode, setEditCode] = useState(student.studentCode);
  const [editName, setEditName] = useState(student.fullName);
  const [editGender, setEditGender] = useState<'Nam' | 'Nữ'>(student.gender);
  const [editDob, setEditDob] = useState(student.dob);
  const [editPhone, setEditPhone] = useState(student.phone || '');
  const [editError, setEditError] = useState<string | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const handleOpenEditModal = () => {
    if (onEditStudentInfo) {
      onEditStudentInfo(student);
    } else {
      setEditCode(student.studentCode);
      setEditName(student.fullName);
      setEditGender(student.gender);
      setEditDob(student.dob);
      setEditPhone(student.phone || '');
      setEditError(null);
      setIsEditModalOpen(true);
    }
  };

  const handleSaveStudentInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditError(null);
    setIsSavingEdit(true);

    try {
      await apiRequest('/api/students', {
        method: 'POST',
        body: {
          id: student.id,
          studentCode: editCode,
          fullName: editName,
          gender: editGender,
          dob: editDob,
          phone: editPhone,
        },
      });
      await onRefreshData();
      setIsEditModalOpen(false);
    } catch (err: any) {
      setEditError(err.message || 'Lỗi khi cập nhật thông tin học sinh');
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Subject map
  const subjectMap = useMemo(() => {
    const map = new Map<string, string>();
    data.subjects.forEach((s) => map.set(s.id, s.name));
    return map;
  }, [data.subjects]);

  // Discipline score calculation using 9A2 settings (base score e.g. 100)
  const disciplineStats = useMemo(() => {
    return calculateDisciplineScore(
      student.id,
      data.disciplineEvents,
      data.settings.baseDisciplinePoints,
      selectedMonth
    );
  }, [student.id, data.disciplineEvents, data.settings.baseDisciplinePoints, selectedMonth]);

  const conductEval = useMemo(() => {
    return evaluateConduct(disciplineStats.totalScore, data.settings.conductThresholds);
  }, [disciplineStats.totalScore, data.settings.conductThresholds]);

  // Overall discipline stats (all time) for top stat box
  const overallDisciplineStats = useMemo(() => {
    return calculateDisciplineScore(
      student.id,
      data.disciplineEvents,
      data.settings.baseDisciplinePoints,
      'all'
    );
  }, [student.id, data.disciplineEvents, data.settings.baseDisciplinePoints]);

  const overallConductEval = useMemo(() => {
    return evaluateConduct(overallDisciplineStats.totalScore, data.settings.conductThresholds);
  }, [overallDisciplineStats.totalScore, data.settings.conductThresholds]);

  // Attendance statistics (overall for top card)
  const overallAttendanceStats = useMemo(() => {
    return calculateAttendanceStats(student.id, data.attendance, 'all');
  }, [student.id, data.attendance]);

  // Student's grades filtered by semester
  const studentGrades = useMemo(() => {
    return data.grades.filter(
      (g) => g.studentId === student.id && g.semester === selectedSemester
    );
  }, [data.grades, student.id, selectedSemester]);

  // All student grades for overall stat
  const allStudentGrades = useMemo(() => {
    return data.grades.filter((g) => g.studentId === student.id);
  }, [data.grades, student.id]);

  const averageGrade = useMemo(() => {
    if (allStudentGrades.length === 0) return null;
    const sum = allStudentGrades.reduce((acc, g) => acc + g.score, 0);
    return (sum / allStudentGrades.length).toFixed(1);
  }, [allStudentGrades]);

  // Active discipline rules filtered by search
  const filteredRules = useMemo(() => {
    return data.disciplineRules
      .filter((r) => r.isActive !== false)
      .filter(
        (r) =>
          r.name.toLowerCase().includes(ruleSearch.toLowerCase()) ||
          r.group.toLowerCase().includes(ruleSearch.toLowerCase())
      );
  }, [data.disciplineRules, ruleSearch]);

  const selectedRule = useMemo(() => {
    return data.disciplineRules.find((r) => r.id === selectedRuleId);
  }, [data.disciplineRules, selectedRuleId]);

  // Label for selected month/period
  const selectedPeriodLabel = useMemo(() => {
    if (selectedMonth === 'all') return 'Tất cả thời gian';
    const [y, m] = selectedMonth.split('-');
    return `Tháng ${parseInt(m, 10)}/${y}`;
  }, [selectedMonth]);

  // ---------------- HANDLER: RECORD DISCIPLINE EVENT ----------------
  const handleSaveDisciplineEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRuleId) return;

    setIsSubmittingDiscipline(true);
    setDisciplineMessage(null);

    try {
      const res = await apiRequest('/api/discipline/event', {
        method: 'POST',
        body: {
          studentId: student.id,
          date: incidentDate,
          ruleId: selectedRuleId,
          note: incidentNote,
        },
      });

      setDisciplineMessage(
        res.attendanceSynced
          ? 'Đã lưu thi đua & tự động cập nhật điểm danh thành công!'
          : 'Đã lưu ghi nhận thi đua thành công!'
      );
      setIncidentNote('');
      await onRefreshData();

      setTimeout(() => setDisciplineMessage(null), 3000);
    } catch (err: any) {
      alert(err.message || 'Lỗi khi ghi nhận thi đua');
    } finally {
      setIsSubmittingDiscipline(false);
    }
  };

  // ---------------- HANDLER: DELETE DISCIPLINE EVENT ----------------
  const handleDeleteDisciplineEvent = async (id: string, name: string) => {
    if (
      !confirm(
        `Bạn có chắc muốn xóa bản ghi "${name}"? Tổng điểm và điểm danh liên kết sẽ được tự động tính lại.`
      )
    ) {
      return;
    }

    try {
      await apiRequest(`/api/discipline/event/${id}`, { method: 'DELETE' });
      await onRefreshData();
    } catch (err: any) {
      alert(err.message || 'Lỗi khi xóa bản ghi thi đua');
    }
  };

  // ---------------- HANDLER: EXPORT STUDENT VIOLATIONS ----------------
  const handleExportStudentViolations = () => {
    exportStudentViolationsExcel(
      student,
      data.disciplineEvents,
      data.settings,
      selectedPeriodLabel,
      selectedMonth
    );
  };

  // ---------------- HANDLER: ATTENDANCE ----------------
  const handleUpdateAttendance = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdatingAttendance(true);
    try {
      await apiRequest('/api/attendance', {
        method: 'POST',
        body: {
          studentId: student.id,
          date: manualAttDate,
          status: manualAttStatus,
        },
      });
      await onRefreshData();
    } catch (err: any) {
      alert(err.message || 'Lỗi khi cập nhật điểm danh');
    } finally {
      setIsUpdatingAttendance(false);
    }
  };

  // ---------------- HANDLER: GRADES ----------------
  const handleSaveGrade = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(gradeScore);
    if (isNaN(num) || num < 0 || num > 10) {
      alert('Điểm số phải là số từ 0 đến 10');
      return;
    }

    try {
      await apiRequest('/api/grades', {
        method: 'POST',
        body: {
          id: editingGrade ? editingGrade.id : undefined,
          studentId: student.id,
          subjectId: gradeSubjectId,
          semester: selectedSemester,
          scoreType: gradeScoreType,
          score: num,
          note: gradeNote,
        },
      });
      await onRefreshData();
      setIsAddingGrade(false);
      setEditingGrade(null);
      setGradeScore('');
      setGradeNote('');
    } catch (err: any) {
      alert(err.message || 'Lỗi khi lưu điểm');
    }
  };

  const handleDeleteGrade = async (id: string) => {
    if (!confirm('Xóa cột điểm này?')) return;
    try {
      await apiRequest(`/api/grades/${id}`, { method: 'DELETE' });
      await onRefreshData();
    } catch (err: any) {
      alert(err.message || 'Lỗi khi xóa điểm');
    }
  };

  const scoreTypeLabels: Record<string, string> = {
    diem_mieng: 'Điểm miệng',
    '15_phut': '15 phút',
    giua_ky: 'Giữa kỳ',
    cuoi_ky: 'Cuối kỳ',
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      {/* 1. TOP NAVIGATION & ACTION BAR (As in 8A3 sample) */}
      <div className="bg-white px-4 py-3 rounded-2xl border border-slate-200/90 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Quay lại</span>
            </button>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-bold text-slate-800">Hồ sơ học sinh:</span>
            <span className="text-sm font-extrabold text-sky-700 uppercase tracking-tight">
              {student.fullName}
            </span>
            <span className="text-xs font-mono font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200">
              Mã định danh: {student.studentCode}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {role === 'teacher' && (
            <button
              onClick={handleOpenEditModal}
              className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span>Sửa thông tin</span>
            </button>
          )}

          <button
            onClick={() => window.print()}
            className="px-3 py-1.5 text-xs font-semibold text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>In hồ sơ / Phiếu liên lạc</span>
          </button>
        </div>
      </div>

      {/* 2. CENTERED PROFILE HEADER & 4 STAT BOXES (8A3 Style) */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-5">
        {/* Centered Identity */}
        <div className="flex flex-col items-center text-center">
          <div
            className={`w-16 h-16 rounded-full flex items-center justify-center font-extrabold text-2xl shadow-sm ${
              student.gender === 'Nữ'
                ? 'bg-rose-50 text-rose-600 border border-rose-200'
                : 'bg-sky-50 text-sky-700 border border-sky-200'
            }`}
          >
            {student.fullName.charAt(0)}
          </div>

          <h1 className="mt-3 text-lg font-extrabold text-slate-900 uppercase tracking-tight">
            {student.fullName}
          </h1>

          <div className="mt-1 flex flex-wrap items-center justify-center gap-2 text-xs font-medium text-slate-500">
            <span>{student.gender}</span>
            <span className="text-slate-300">•</span>
            <span>Ngày sinh: <strong className="font-mono text-slate-700">{student.dob}</strong></span>
            <span className="text-slate-300">•</span>
            <span className="font-mono bg-sky-50 text-sky-800 px-2 py-0.5 rounded border border-sky-100">
              Mã hồ sơ: {student.studentCode}
            </span>
          </div>
        </div>

        {/* 4 Equal-Sized Stat Boxes */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 pt-2 border-t border-slate-100">
          {/* Stat 1: Điểm danh */}
          <div className="bg-slate-50/80 rounded-xl border border-slate-200/80 p-3.5 text-center flex flex-col justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
              Điểm Danh
            </span>
            <div className="my-1.5">
              <div className="text-base font-bold text-slate-800">
                {overallAttendanceStats.present} buổi có mặt
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Vắng: <span className="font-semibold text-rose-600">{overallAttendanceStats.excused + overallAttendanceStats.unexcused}</span> (Có phép: {overallAttendanceStats.excused}, Không phép: {overallAttendanceStats.unexcused})
              </div>
            </div>
            <div className="text-[10px] text-amber-700 font-semibold bg-amber-50 py-0.5 rounded border border-amber-100/80">
              Đi muộn: {overallAttendanceStats.late} lần
            </div>
          </div>

          {/* Stat 2: Học tập */}
          <div className="bg-slate-50/80 rounded-xl border border-slate-200/80 p-3.5 text-center flex flex-col justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
              Học Tập
            </span>
            <div className="my-1.5">
              <div className="text-base font-bold text-sky-800">
                {averageGrade ? `ĐTB môn: ${averageGrade}` : 'Chưa có điểm'}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                {allStudentGrades.length > 0
                  ? `${allStudentGrades.length} cột điểm đã ghi nhận`
                  : 'Chưa có bài kiểm tra'}
              </div>
            </div>
            <div className="text-[10px] text-slate-600 bg-slate-100 py-0.5 rounded">
              Học kỳ 1 & 2
            </div>
          </div>

          {/* Stat 3: Điểm thi đua còn lại (9A2 base score) */}
          <div className="bg-sky-50/60 rounded-xl border border-sky-100 p-3.5 text-center flex flex-col justify-between">
            <span className="text-[11px] font-bold text-sky-900 uppercase tracking-wide">
              Điểm Thi Đua Còn Lại
            </span>
            <div className="my-1.5">
              <div className="text-2xl font-black font-mono text-sky-800">
                {overallDisciplineStats.totalScore}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Điểm nền: {data.settings.baseDisciplinePoints} (Biến động: {overallDisciplineStats.deltaPoints >= 0 ? `+${overallDisciplineStats.deltaPoints}` : overallDisciplineStats.deltaPoints})
              </div>
            </div>
            <div className="text-[10px] text-slate-500 bg-white/80 py-0.5 rounded border border-sky-100">
              {overallDisciplineStats.positiveCount} cộng / {overallDisciplineStats.negativeCount} trừ
            </div>
          </div>

          {/* Stat 4: Kết quả rèn luyện */}
          <div className="bg-slate-50/80 rounded-xl border border-slate-200/80 p-3.5 text-center flex flex-col justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
              Kết Quả Rèn Luyện
            </span>
            <div className="my-1.5">
              <span
                className={`inline-block px-3 py-1 rounded-xl text-xs font-bold ${overallConductEval.colorClass}`}
              >
                {overallConductEval.label}
              </span>
              <div className="text-[11px] text-slate-500 mt-1">
                Theo quy chế thi đua 9A2
              </div>
            </div>
            <div className="text-[10px] text-slate-500 bg-slate-100 py-0.5 rounded">
              Đánh giá tự động
            </div>
          </div>
        </div>
      </div>

      {/* 3. 5 HORIZONTAL TABS (As in 8A3 sample) */}
      <div className="flex bg-white p-1 rounded-2xl border border-slate-200/90 shadow-xs overflow-x-auto">
        {[
          { id: 'personal', label: 'Thông tin cá nhân', icon: User },
          { id: 'attendance', label: 'Điểm danh', icon: Calendar },
          { id: 'grades', label: 'Học tập & Điểm số', icon: BookOpen },
          { id: 'discipline', label: 'Thi đua & Kỷ luật', icon: Award },
          { id: 'handbook', label: 'Sổ tay & Liên hệ', icon: Contact2 },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as DetailTab)}
              className={`flex-1 min-w-[130px] py-2.5 px-3 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
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

      {/* ================= TAB 1: THÔNG TIN CÁ NHÂN ================= */}
      {activeTab === 'personal' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-xs space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-800">
              Chi Tiết Hồ Sơ Học Sinh
            </h3>
            {role === 'teacher' && (
              <button
                onClick={handleOpenEditModal}
                className="px-3 py-1.5 text-xs font-semibold text-sky-700 bg-sky-50 hover:bg-sky-100 rounded-xl flex items-center gap-1.5 cursor-pointer"
              >
                <Edit2 className="w-3.5 h-3.5" />
                Cập nhật thông tin
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-100 space-y-3">
              <span className="font-bold text-slate-700 block text-xs uppercase tracking-wider">
                Thông tin học sinh
              </span>
              <div className="space-y-2 text-slate-600">
                <div className="flex justify-between py-1 border-b border-slate-200/60">
                  <span className="text-slate-500">Mã học sinh:</span>
                  <span className="font-mono font-bold text-slate-800">{student.studentCode}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200/60">
                  <span className="text-slate-500">Họ và tên:</span>
                  <span className="font-bold text-slate-800">{student.fullName}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200/60">
                  <span className="text-slate-500">Giới tính:</span>
                  <span className="font-medium text-slate-800">{student.gender}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200/60">
                  <span className="text-slate-500">Ngày sinh:</span>
                  <span className="font-mono font-medium text-slate-800">{student.dob}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">Lớp hiện tại:</span>
                  <span className="font-bold text-sky-800">{data.settings.className} ({data.settings.academicYear})</span>
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-100 space-y-3">
              <span className="font-bold text-slate-700 block text-xs uppercase tracking-wider">
                Tài khoản & Liên hệ
              </span>
              <div className="space-y-2 text-slate-600">
                <div className="flex justify-between py-1 border-b border-slate-200/60">
                  <span className="text-slate-500">Số điện thoại liên hệ:</span>
                  <span className="font-mono font-bold text-slate-800">{student.phone || 'Chưa cập nhật'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200/60">
                  <span className="text-slate-500">Trạng thái tài khoản:</span>
                  <span>
                    {student.isLocked ? (
                      <span className="text-rose-600 font-semibold">Tạm khóa</span>
                    ) : student.isInitialPassword ? (
                      <span className="text-amber-600 font-semibold">Chưa đổi mật khẩu ban đầu</span>
                    ) : (
                      <span className="text-emerald-700 font-semibold">Đã kích hoạt bảo mật</span>
                    )}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200/60">
                  <span className="text-slate-500">Trường học:</span>
                  <span className="font-medium text-slate-800">{data.settings.schoolName}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">Giáo viên chủ nhiệm:</span>
                  <span className="font-bold text-slate-800">{data.settings.teacherName}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB 2: ĐIỂM DANH ================= */}
      {activeTab === 'attendance' && (
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-5">
          {/* Quick Mark Attendance (Teacher only) */}
          {role === 'teacher' && (
            <form
              onSubmit={handleUpdateAttendance}
              className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3"
            >
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-700">Điểm danh ngày:</span>
                <input
                  type="date"
                  value={manualAttDate}
                  onChange={(e) => setManualAttDate(e.target.value)}
                  className="px-2.5 py-1 text-xs font-mono bg-white border border-slate-200 rounded-lg"
                />
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={manualAttStatus}
                  onChange={(e: any) => setManualAttStatus(e.target.value)}
                  className="px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg cursor-pointer"
                >
                  <option value="present">Có mặt</option>
                  <option value="late">Đi muộn</option>
                  <option value="excused_absence">Vắng có phép</option>
                  <option value="unexcused_absence">Vắng không phép</option>
                </select>

                <button
                  type="submit"
                  disabled={isUpdatingAttendance}
                  className="px-3.5 py-1.5 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-lg cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {isUpdatingAttendance ? 'Đang lưu...' : 'Lưu Điểm Danh'}
                </button>
              </div>
            </form>
          )}

          {/* Attendance History Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                <tr>
                  <th className="py-2.5 px-4 w-36">Ngày</th>
                  <th className="py-2.5 px-4">Trạng thái</th>
                  <th className="py-2.5 px-4">Nguồn ghi nhận</th>
                  <th className="py-2.5 px-4 w-40 text-right">Cập nhật lúc</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.attendance.filter((a) => a.studentId === student.id).length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-slate-400">
                      Chưa có dữ liệu điểm danh
                    </td>
                  </tr>
                ) : (
                  data.attendance
                    .filter((a) => a.studentId === student.id)
                    .map((att) => (
                      <tr key={att.id} className="hover:bg-slate-50">
                        <td className="py-2.5 px-4 font-mono font-medium text-slate-800">
                          {att.date}
                        </td>
                        <td className="py-2.5 px-4">
                          {att.status === 'present' && (
                            <span className="text-emerald-700 font-semibold flex items-center gap-1.5">
                              <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                              Có mặt
                            </span>
                          )}
                          {att.status === 'late' && (
                            <span className="text-amber-700 font-semibold flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-amber-600" />
                              Đi muộn
                            </span>
                          )}
                          {att.status === 'excused_absence' && (
                            <span className="text-sky-700 font-semibold flex items-center gap-1.5">
                              <FileText className="w-3.5 h-3.5 text-sky-600" />
                              Vắng có phép
                            </span>
                          )}
                          {att.status === 'unexcused_absence' && (
                            <span className="text-rose-700 font-semibold flex items-center gap-1.5">
                              <XCircle className="w-3.5 h-3.5 text-rose-600" />
                              Vắng không phép
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-slate-500">
                          {att.source === 'discipline_sync'
                            ? 'Tự động từ mục Thi đua'
                            : 'Điểm danh thủ công'}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono text-slate-600 text-[11px]">
                          {att.updatedAt ? att.updatedAt.split('T')[0] : '-'}
                        </td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= TAB 3: HỌC TẬP & ĐIỂM SỐ ================= */}
      {activeTab === 'grades' && (
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-slate-800">Học kỳ:</span>
              <div className="flex bg-slate-100 p-1 rounded-xl text-xs">
                {(['HK1', 'HK2'] as const).map((hk) => (
                  <button
                    key={hk}
                    onClick={() => setSelectedSemester(hk)}
                    className={`px-3 py-1 font-semibold rounded-lg transition-colors cursor-pointer ${
                      selectedSemester === hk
                        ? 'bg-white text-sky-800 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {hk === 'HK1' ? 'Học kỳ 1' : 'Học kỳ 2'}
                  </button>
                ))}
              </div>
            </div>

            {role === 'teacher' && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => downloadGradeTemplate(data.subjects)}
                  className="px-2.5 py-1.5 text-xs text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center gap-1 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  Mẫu Excel Điểm
                </button>
                <button
                  onClick={() => {
                    setEditingGrade(null);
                    setGradeScore('');
                    setGradeNote('');
                    setIsAddingGrade(true);
                  }}
                  className="px-3 py-1.5 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-lg flex items-center gap-1 cursor-pointer shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Nhập Điểm Mới
                </button>
              </div>
            )}
          </div>

          {/* Add / Edit Grade Form (Teacher only) */}
          {role === 'teacher' && isAddingGrade && (
            <form
              onSubmit={handleSaveGrade}
              className="p-4 bg-sky-50/50 border border-sky-200 rounded-xl space-y-3 animate-in fade-in"
            >
              <h4 className="text-xs font-bold text-sky-900">
                {editingGrade ? 'Chỉnh Sửa Điểm Số' : 'Nhập Điểm Học Sinh'}
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Môn học
                  </label>
                  <select
                    value={gradeSubjectId}
                    onChange={(e) => setGradeSubjectId(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg"
                  >
                    {data.subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Loại điểm
                  </label>
                  <select
                    value={gradeScoreType}
                    onChange={(e: any) => setGradeScoreType(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg"
                  >
                    <option value="diem_mieng">Điểm miệng</option>
                    <option value="15_phut">Điểm 15 phút</option>
                    <option value="giua_ky">Điểm giữa kỳ</option>
                    <option value="cuoi_ky">Điểm cuối kỳ</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Điểm số (0 - 10) *
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="10"
                    value={gradeScore}
                    onChange={(e) => setGradeScore(e.target.value)}
                    placeholder="Ví dụ: 8.5"
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg font-mono font-bold"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Ghi chú
                  </label>
                  <input
                    type="text"
                    value={gradeNote}
                    onChange={(e) => setGradeNote(e.target.value)}
                    placeholder="Ghi chú bài thi..."
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddingGrade(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-200 rounded-lg"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-lg shadow-xs"
                >
                  Lưu Điểm
                </button>
              </div>
            </form>
          )}

          {/* Grades Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                <tr>
                  <th className="py-2.5 px-4">Môn học</th>
                  <th className="py-2.5 px-4">Loại điểm</th>
                  <th className="py-2.5 px-4 w-28 text-center">Điểm số</th>
                  <th className="py-2.5 px-4">Ghi chú</th>
                  {role === 'teacher' && (
                    <th className="py-2.5 px-4 w-24 text-right">Thao tác</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {studentGrades.length === 0 ? (
                  <tr>
                    <td
                      colSpan={role === 'teacher' ? 5 : 4}
                      className="py-8 text-center text-slate-400"
                    >
                      Chưa có dữ liệu điểm môn học cho kỳ này
                    </td>
                  </tr>
                ) : (
                  studentGrades.map((g) => (
                    <tr key={g.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-4 font-semibold text-slate-800">
                        {subjectMap.get(g.subjectId) || 'Môn học'}
                      </td>
                      <td className="py-2.5 px-4 text-slate-600">
                        {scoreTypeLabels[g.scoreType] || g.scoreType}
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        <span
                          className={`font-mono font-bold text-sm ${
                            g.score >= 8
                              ? 'text-emerald-700'
                              : g.score >= 6.5
                              ? 'text-blue-700'
                              : g.score >= 5
                              ? 'text-amber-700'
                              : 'text-rose-600'
                          }`}
                        >
                          {g.score}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-slate-500 italic">
                        {g.note || '-'}
                      </td>
                      {role === 'teacher' && (
                        <td className="py-2.5 px-4 text-right">
                          <button
                            onClick={() => handleDeleteGrade(g.id)}
                            className="p-1 text-rose-500 hover:bg-rose-50 rounded"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= TAB 4: THI ĐUA & KỶ LUẬT (2-COLUMN 1/3 & 2/3 LAYOUT) ================= */}
      {activeTab === 'discipline' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* CỘT TRÁI (~1/3 CHIỀU RỘNG): GHI NHẬN SỰ VIỆC THI ĐUA */}
          <div className={`${role === 'teacher' ? 'lg:col-span-4' : 'hidden'} space-y-4`}>
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs flex flex-col overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex items-center gap-2 bg-slate-50/50">
                <Award className="w-4 h-4 text-sky-600" />
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                  Ghi Nhận Sự Việc
                </h3>
              </div>

              {disciplineMessage && (
                <div className="m-4 mb-0 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>{disciplineMessage}</span>
                </div>
              )}

              <form onSubmit={handleSaveDisciplineEvent} className="p-4 flex flex-col flex-1">
                {/* Scrollable inputs container */}
                <div className="space-y-3.5 overflow-y-auto max-h-[440px] pr-1">
                  {/* 1. Ngày xảy ra */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Ngày xảy ra *
                    </label>
                    <input
                      type="date"
                      value={incidentDate}
                      onChange={(e) => setIncidentDate(e.target.value)}
                      className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                      required
                    />
                  </div>

                  {/* 2. Quy tắc thi đua with search & list */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Tìm/chọn quy tắc *
                    </label>
                    <div className="relative mb-2">
                      <input
                        type="text"
                        placeholder="Tìm quy tắc nhanh..."
                        value={ruleSearch}
                        onChange={(e) => setRuleSearch(e.target.value)}
                        className="w-full pl-7 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none"
                      />
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-2" />
                    </div>

                    <div className="max-h-36 overflow-y-auto border border-slate-200 rounded-xl p-1.5 space-y-1 bg-slate-50/60">
                      {filteredRules.length === 0 ? (
                        <p className="text-[11px] text-slate-400 text-center py-2">
                          Không tìm thấy quy tắc nào
                        </p>
                      ) : (
                        filteredRules.map((r) => {
                          const isSelected = selectedRuleId === r.id;
                          const isPositive = r.points >= 0;
                          return (
                            <div
                              key={r.id}
                              onClick={() => setSelectedRuleId(r.id)}
                              className={`p-2 rounded-lg flex items-center justify-between text-xs cursor-pointer transition-colors ${
                                isSelected
                                  ? 'bg-sky-100 text-sky-900 font-bold border border-sky-300'
                                  : 'hover:bg-white text-slate-700'
                              }`}
                            >
                              <span className="truncate pr-2">{r.name}</span>
                              <span
                                className={`font-mono font-bold shrink-0 text-[11px] ${
                                  isPositive ? 'text-emerald-700' : 'text-rose-600'
                                }`}
                              >
                                {isPositive ? `+${r.points}` : r.points} đ
                              </span>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* 3. Điểm tương ứng Preview */}
                  {selectedRule && (
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between text-xs">
                      <span className="text-slate-600 font-medium">Điểm áp dụng:</span>
                      <span
                        className={`font-mono font-extrabold ${
                          selectedRule.points >= 0 ? 'text-emerald-700' : 'text-rose-600'
                        }`}
                      >
                        {selectedRule.points >= 0 ? `+${selectedRule.points}` : selectedRule.points} điểm
                      </span>
                    </div>
                  )}

                  {/* 4. Nội dung ghi chú */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Nội dung ghi chú
                    </label>
                    <input
                      type="text"
                      value={incidentNote}
                      onChange={(e) => setIncidentNote(e.target.value)}
                      placeholder="Chi tiết sự việc (VD: Tiết 2 môn Hóa)..."
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none"
                    />
                  </div>
                </div>

                {/* 5. Sticky Save Button (Always visible at bottom of box) */}
                <div className="sticky bottom-0 bg-white pt-4 mt-2 border-t border-slate-100 z-10">
                  <button
                    type="submit"
                    disabled={isSubmittingDiscipline || !selectedRuleId}
                    className="w-full py-2.5 px-4 bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md shadow-sky-600/20 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    {isSubmittingDiscipline ? 'Đang lưu...' : 'LƯU GHI NHẬN'}
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* CỘT PHẢI (~2/3 CHIỀU RỘNG): TỔNG HỢP & LỊCH SỬ GHI NHẬN */}
          <div
            className={`${
              role === 'teacher' ? 'lg:col-span-8' : 'lg:col-span-12'
            } space-y-4`}
          >
            {/* THANH TỔNG HỢP GỌN PHÍA TRÊN */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2.5 pb-2.5 border-b border-slate-100">
                {/* Bộ lọc thời gian */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-700">Kỳ đánh giá:</span>
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none cursor-pointer"
                  >
                    <option value="all">Tất cả thời gian</option>
                    {Array.from({ length: 12 }, (_, i) => {
                      const m = i + 1;
                      const val = `${currentYear}-${String(m).padStart(2, '0')}`;
                      return (
                        <option key={m} value={val}>
                          Tháng {m}/{currentYear}
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* Nút Xuất Excel vi phạm theo từng học sinh */}
                <button
                  type="button"
                  onClick={handleExportStudentViolations}
                  title="Xuất danh sách vi phạm & ghi nhận thi đua của học sinh này ra Excel"
                  className="px-3 py-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/80 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Xuất Excel vi phạm</span>
                </button>
              </div>

              {/* Các thẻ chỉ số tổng hợp gọn theo kỳ */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center">
                <div className="p-2.5 rounded-xl bg-sky-50/70 border border-sky-100">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">
                    Điểm thi đua còn lại
                  </span>
                  <div className="text-xl font-black font-mono text-sky-800 mt-0.5">
                    {disciplineStats.totalScore}
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-100">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">
                    Tổng điểm thưởng
                  </span>
                  <div className="text-xl font-black font-mono text-emerald-700 mt-0.5">
                    +{disciplineStats.positivePoints}
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-rose-50/70 border border-rose-100">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">
                    Tổng điểm trừ
                  </span>
                  <div className="text-xl font-black font-mono text-rose-700 mt-0.5">
                    -{disciplineStats.negativePoints}
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-col justify-center">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">
                    Kết quả rèn luyện
                  </span>
                  <div className="mt-0.5">
                    <span
                      className={`inline-block px-2.5 py-0.5 rounded-lg text-xs font-bold ${conductEval.colorClass}`}
                    >
                      {conductEval.label}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* LỊCH SỬ GHI NHẬN SỰ VIỆC CHIẾM PHẦN LỚN CHIỀU CAO CÒN LẠI */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-sky-600" />
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                    Lịch Sử Ghi Nhận ({selectedPeriodLabel})
                  </h3>
                </div>
                <span className="text-xs text-slate-500 font-semibold">
                  {disciplineStats.filteredEvents.length} bản ghi
                </span>
              </div>

              {/* DEDICATED SMOOTH SCROLL CONTAINER */}
              <div className="mt-3 border border-slate-200/80 rounded-xl overflow-hidden">
                <div className="max-h-[360px] overflow-y-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50/90 sticky top-0 z-10 border-b border-slate-200 text-slate-600 font-semibold text-[11px]">
                      <tr>
                        <th className="py-2.5 px-3 w-28">Ngày</th>
                        <th className="py-2.5 px-3">Sự việc / Quy tắc</th>
                        <th className="py-2.5 px-3 w-24 text-center">Điểm</th>
                        {role === 'teacher' && (
                          <th className="py-2.5 px-3 w-16 text-right">Xóa</th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {disciplineStats.filteredEvents.length === 0 ? (
                        <tr>
                          <td
                            colSpan={role === 'teacher' ? 4 : 3}
                            className="py-10 text-center text-slate-400 text-xs"
                          >
                            Không có sự việc vi phạm hay thi đua nào trong kỳ này
                          </td>
                        </tr>
                      ) : (
                        disciplineStats.filteredEvents.map((ev) => {
                          const isPositive = ev.points >= 0;
                          return (
                            <tr
                              key={ev.id}
                              className="hover:bg-sky-50/30 transition-colors"
                            >
                              <td className="py-2.5 px-3 font-mono text-slate-600 whitespace-nowrap">
                                {ev.date}
                              </td>
                              <td className="py-2.5 px-3 font-medium text-slate-800">
                                <div>{ev.ruleName}</div>
                                {ev.note && (
                                  <div className="text-[11px] text-slate-500 italic mt-0.5">
                                    "{ev.note}"
                                  </div>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                <span
                                  className={`font-mono font-bold px-2 py-0.5 rounded ${
                                    isPositive
                                      ? 'text-emerald-700 bg-emerald-50'
                                      : 'text-rose-700 bg-rose-50'
                                  }`}
                                >
                                  {isPositive ? `+${ev.points}` : ev.points}
                                </span>
                              </td>
                              {role === 'teacher' && (
                                <td className="py-2.5 px-3 text-right">
                                  <button
                                    onClick={() =>
                                      handleDeleteDisciplineEvent(ev.id, ev.ruleName)
                                    }
                                    title="Xóa sự việc này"
                                    className="p-1 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              )}
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB 5: SỔ TAY & LIÊN HỆ ================= */}
      {activeTab === 'handbook' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-xs space-y-6">
          <div className="pb-3 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-800">
                Sổ Tay Chủ Nhiệm & Thông Tin Liên Lạc Gia Đình
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Học sinh: {student.fullName} · Lớp {data.settings.className} ({data.settings.academicYear})
              </p>
            </div>
            <button
              onClick={() => window.print()}
              className="px-3 py-1.5 text-xs font-semibold text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-xl flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              In Phiếu Liên Lạc
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            {/* Liên lạc phụ huynh */}
            <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-100 space-y-3">
              <span className="font-bold text-slate-700 block uppercase tracking-wider text-xs">
                Kênh liên lạc phụ huynh
              </span>
              <div className="space-y-2 text-slate-600">
                <div className="flex justify-between py-1 border-b border-slate-200/60">
                  <span className="text-slate-500">Số điện thoại liên hệ:</span>
                  <span className="font-mono font-bold text-slate-800">{student.phone || 'Chưa cập nhật'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200/60">
                  <span className="text-slate-500">Giáo viên chủ nhiệm:</span>
                  <span className="font-bold text-slate-800">{data.settings.teacherName}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">Kỳ cập nhật:</span>
                  <span className="font-mono text-slate-700">{new Date().toLocaleDateString('vi-VN')}</span>
                </div>
              </div>
            </div>

            {/* Tóm tắt tình hình học sinh */}
            <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-100 space-y-3">
              <span className="font-bold text-slate-700 block uppercase tracking-wider text-xs">
                Tóm tắt nề nếp & học tập
              </span>
              <div className="space-y-2 text-slate-600">
                <div className="flex justify-between py-1 border-b border-slate-200/60">
                  <span className="text-slate-500">Điểm thi đua hiện tại:</span>
                  <span className="font-mono font-bold text-sky-800">{overallDisciplineStats.totalScore} điểm</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200/60">
                  <span className="text-slate-500">Xếp loại rèn luyện:</span>
                  <span className={`font-bold ${overallConductEval.colorClass}`}>{overallConductEval.label}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">Chuyên cần:</span>
                  <span>{overallAttendanceStats.present} buổi có mặt / {overallAttendanceStats.late} lần muộn</span>
                </div>
              </div>
            </div>
          </div>

          {/* Nhận xét của GVCN */}
          <div className="p-4 rounded-xl bg-sky-50/50 border border-sky-100 space-y-2">
            <span className="text-xs font-bold text-slate-800">
              Nhận xét & Lời nhắn của Giáo viên Chủ nhiệm
            </span>
            {role === 'teacher' ? (
              <textarea
                rows={3}
                value={teacherFeedback}
                onChange={(e) => setTeacherFeedback(e.target.value)}
                placeholder="Nhập nhận xét gửi gia đình hoặc lưu sổ tay..."
                className="w-full p-2.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
            ) : (
              <p className="text-xs text-slate-700 bg-white p-3 rounded-lg border border-slate-200 italic">
                "{teacherFeedback}"
              </p>
            )}
          </div>
        </div>
      )}

      {/* ================= MODAL: EDIT STUDENT PROFILE ================= */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="text-sm font-bold text-slate-800">
                Cập Nhật Thông Tin Học Sinh
              </h3>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <XCircle className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveStudentInfo} className="p-5 space-y-3.5">
              {editError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
                  <span>{editError}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Mã học sinh *
                  </label>
                  <input
                    type="text"
                    value={editCode}
                    onChange={(e) => setEditCode(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 text-xs font-mono uppercase bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Giới tính
                  </label>
                  <select
                    value={editGender}
                    onChange={(e: any) => setEditGender(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                  >
                    <option value="Nam">Nam</option>
                    <option value="Nữ">Nữ</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Họ và tên *
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Ngày sinh (DD/MM/YYYY) *
                  </label>
                  <input
                    type="text"
                    value={editDob}
                    onChange={(e) => setEditDob(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Số điện thoại liên hệ
                  </label>
                  <input
                    type="tel"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="px-4 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-xl disabled:opacity-50 cursor-pointer shadow-xs"
                >
                  {isSavingEdit ? 'Đang lưu...' : 'Lưu Thay Đổi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
