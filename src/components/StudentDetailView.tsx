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
  UserCheck
} from 'lucide-react';
import { AppData, Student, UserRole, Grade } from '../types';
import { apiRequest } from '../utils/api';
import { calculateDisciplineScore, evaluateConduct, calculateAttendanceStats } from '../utils/scoring';
import { downloadGradeTemplate, parseGradeExcel } from '../utils/excel';

interface StudentDetailViewProps {
  student: Student;
  data: AppData;
  role: UserRole;
  onBack?: () => void;
  onRefreshData: () => Promise<void>;
  onEditStudentInfo?: (student: Student) => void;
}

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

  const [activeTab, setActiveTab] = useState<'attendance' | 'grades' | 'discipline' | 'summary'>('discipline');
  const [selectedMonth, setSelectedMonth] = useState<string>(defaultMonth);
  const [selectedSemester, setSelectedSemester] = useState<'HK1' | 'HK2'>('HK1');

  // --- ZONE 1: THI ĐUA GHI NHẬN SỰ VIỆC STATE ---
  const todayDateStr = new Date().toISOString().split('T')[0];
  const [incidentDate, setIncidentDate] = useState(todayDateStr);
  const [selectedRuleId, setSelectedRuleId] = useState<string>(data.disciplineRules[0]?.id || '');
  const [incidentNote, setIncidentNote] = useState('');
  const [ruleSearch, setRuleSearch] = useState('');
  const [isSubmittingDiscipline, setIsSubmittingDiscipline] = useState(false);
  const [disciplineMessage, setDisciplineMessage] = useState<string | null>(null);

  // --- TAB ĐIỂM DANH STATE ---
  const [manualAttDate, setManualAttDate] = useState(todayDateStr);
  const [manualAttStatus, setManualAttStatus] = useState<'present' | 'excused_absence' | 'unexcused_absence' | 'late'>('present');
  const [isUpdatingAttendance, setIsUpdatingAttendance] = useState(false);

  // --- TAB HỌC TẬP STATE ---
  const [isAddingGrade, setIsAddingGrade] = useState(false);
  const [gradeSubjectId, setGradeSubjectId] = useState(data.subjects[0]?.id || '');
  const [gradeScoreType, setGradeScoreType] = useState<'diem_mieng' | '15_phut' | 'giua_ky' | 'cuoi_ky'>('giua_ky');
  const [gradeScore, setGradeScore] = useState('');
  const [gradeNote, setGradeNote] = useState('');
  const [editingGrade, setEditingGrade] = useState<Grade | null>(null);

  // Teacher feedback notes in Summary
  const [teacherFeedback, setTeacherFeedback] = useState('Học sinh có ý thức kỷ luật tốt, tích cực trong các giờ học.');

  // Subject map
  const subjectMap = useMemo(() => {
    const map = new Map<string, string>();
    data.subjects.forEach((s) => map.set(s.id, s.name));
    return map;
  }, [data.subjects]);

  // Discipline score calculation for current period
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

  // Attendance statistics
  const attendanceStats = useMemo(() => {
    return calculateAttendanceStats(student.id, data.attendance, selectedMonth);
  }, [student.id, data.attendance, selectedMonth]);

  // Student's grades filtered by semester
  const studentGrades = useMemo(() => {
    return data.grades.filter(
      (g) => g.studentId === student.id && g.semester === selectedSemester
    );
  }, [data.grades, student.id, selectedSemester]);

  // Active discipline rules filtered by search
  const filteredRules = useMemo(() => {
    return data.disciplineRules
      .filter((r) => r.isActive !== false)
      .filter((r) => r.name.toLowerCase().includes(ruleSearch.toLowerCase()) || r.group.toLowerCase().includes(ruleSearch.toLowerCase()));
  }, [data.disciplineRules, ruleSearch]);

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
    if (!confirm(`Bạn có chắc muốn xóa bản ghi "${name}"? Tổng điểm và điểm danh liên kết sẽ được tự động tính lại.`)) {
      return;
    }

    try {
      await apiRequest(`/api/discipline/event/${id}`, { method: 'DELETE' });
      await onRefreshData();
    } catch (err: any) {
      alert(err.message || 'Lỗi khi xóa bản ghi thi đua');
    }
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
    <div className="space-y-4">
      {/* Back button for teacher */}
      {onBack && role === 'teacher' && (
        <button
          onClick={onBack}
          className="text-xs font-semibold text-slate-600 hover:text-sky-700 flex items-center gap-1 cursor-pointer transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Quay lại danh sách học sinh</span>
        </button>
      )}

      {/* VII. ULTRA-COMPACT STUDENT HEADER (STRICTLY COMPACT: 1-2 LINES) */}
      <div className="bg-white px-4 py-2.5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center font-bold text-sm">
            {student.fullName.charAt(0)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-slate-900 leading-none">
                {student.fullName}
              </h2>
              <span className="font-mono text-xs font-semibold text-sky-700 bg-sky-50 px-1.5 py-0.5 rounded border border-sky-100">
                {student.studentCode}
              </span>
              <span className="text-[11px] font-medium text-slate-500">
                ({student.gender})
              </span>
            </div>
            <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-3">
              <span>Ngày sinh: <strong className="font-mono text-slate-700">{student.dob}</strong></span>
              <span>·</span>
              <span>SĐT: <strong className="font-mono text-slate-700">{student.phone || 'Chưa cập nhật'}</strong></span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {role === 'teacher' && onEditStudentInfo && (
            <button
              onClick={() => onEditStudentInfo(student)}
              className="px-2.5 py-1 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center gap-1 cursor-pointer"
            >
              <Edit2 className="w-3 h-3" />
              Sửa
            </button>
          )}
          <button
            onClick={() => window.print()}
            className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center gap-1 cursor-pointer"
          >
            <Printer className="w-3 h-3" />
            In hồ sơ
          </button>
        </div>
      </div>

      {/* 4 MAIN TABS */}
      <div className="flex bg-white p-1 rounded-2xl border border-slate-200/80 shadow-xs">
        {[
          { id: 'discipline', label: 'THI ĐUA', icon: Award },
          { id: 'attendance', label: 'ĐIỂM DANH', icon: Calendar },
          { id: 'grades', label: 'HỌC TẬP', icon: BookOpen },
          { id: 'summary', label: 'TỔNG HỢP', icon: BarChart3 },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 py-2 text-xs font-semibold rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer ${
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

      {/* ================= X. TAB THI ĐUA (THE MOST IMPORTANT TAB) ================= */}
      {activeTab === 'discipline' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* KHU VỰC 1: GHI NHẬN SỰ VIỆC (BÊN TRÁI MÀN HÌNH - TEACHER ONLY) */}
          <div className={`${role === 'teacher' ? 'lg:col-span-5' : 'hidden'} space-y-4`}>
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                <Award className="w-4 h-4 text-sky-600" />
                <h3 className="text-sm font-bold text-slate-800">Ghi Nhận Sự Việc Thi Đua</h3>
              </div>

              {disciplineMessage && (
                <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>{disciplineMessage}</span>
                </div>
              )}

              <form onSubmit={handleSaveDisciplineEvent} className="mt-4 space-y-3.5">
                {/* 1. Ngày xảy ra */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Ngày xảy ra *
                  </label>
                  <input
                    type="date"
                    value={incidentDate}
                    onChange={(e) => setIncidentDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                    required
                  />
                </div>

                {/* 2. Quy tắc thi đua with search */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Quy tắc thi đua *
                  </label>
                  <div className="relative mb-2">
                    <input
                      type="text"
                      placeholder="Tìm quy tắc thi đua..."
                      value={ruleSearch}
                      onChange={(e) => setRuleSearch(e.target.value)}
                      className="w-full pl-7 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white"
                    />
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-2" />
                  </div>

                  <div className="max-h-44 overflow-y-auto border border-slate-200 rounded-xl p-1.5 space-y-1 bg-slate-50/50">
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
                                ? 'bg-sky-100 text-sky-900 font-semibold border border-sky-300'
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

                {/* 3. Ghi chú */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Ghi chú chi tiết (nếu có)
                  </label>
                  <input
                    type="text"
                    value={incidentNote}
                    onChange={(e) => setIncidentNote(e.target.value)}
                    placeholder="Ví dụ: Tiết 1 môn Toán, giải đúng bài khó..."
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white"
                  />
                </div>

                {/* 4. Nút LƯU GHI NHẬN (LỚN, MÀU XANH NỔI BẬT) */}
                <button
                  type="submit"
                  disabled={isSubmittingDiscipline || !selectedRuleId}
                  className="w-full py-3 px-4 bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md shadow-sky-600/20 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  {isSubmittingDiscipline ? 'Đang lưu...' : 'LƯU GHI NHẬN'}
                </button>
              </form>
            </div>
          </div>

          {/* RIGHT SIDE: KHU VỰC 2 & KHU VỰC 3 */}
          <div className={`${role === 'teacher' ? 'lg:col-span-7' : 'lg:col-span-12'} space-y-4`}>
            {/* KHU VỰC 2: BẢNG KỲ ĐÁNH GIÁ (NẰM BÊN PHẢI PHÍA TRÊN) */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                  Bảng Kỳ Đánh Giá Thi Đua
                </span>

                {/* Time filter */}
                <div className="flex items-center gap-2">
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
              </div>

              {/* Large Score Numbers Display */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-4 text-center">
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="text-[11px] font-medium text-slate-500">Điểm nền</div>
                  <div className="text-xl font-bold font-mono text-slate-700 mt-1">
                    {data.settings.baseDisciplinePoints}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-sky-50/60 border border-sky-100">
                  <div className="text-[11px] font-medium text-slate-500">TỔNG ĐIỂM THI ĐUA</div>
                  <div className="text-3xl font-extrabold font-mono text-sky-800 mt-1 tabular-nums">
                    {disciplineStats.totalScore}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    (Biến động: {disciplineStats.deltaPoints >= 0 ? `+${disciplineStats.deltaPoints}` : disciplineStats.deltaPoints})
                  </div>
                </div>

                <div className="col-span-2 sm:col-span-1 p-3.5 rounded-xl bg-slate-50 border border-slate-100 flex flex-col justify-center">
                  <div className="text-[11px] font-medium text-slate-500">Kết quả rèn luyện</div>
                  <div className="mt-1">
                    <span
                      className={`inline-block px-3 py-1 rounded-lg text-xs font-bold ${conductEval.colorClass}`}
                    >
                      {conductEval.label}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* KHU VỰC 3: LỊCH SỬ GHI NHẬN (THANH CUỘN RIÊNG, CHIỀU CAO GIỚI HẠN) */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-sky-600" />
                  <h3 className="text-sm font-bold text-slate-800">Lịch Sử Ghi Nhận Thi Đua</h3>
                </div>
                <span className="text-xs text-slate-500">
                  {disciplineStats.filteredEvents.length} bản ghi
                </span>
              </div>

              {/* DEDICATED SCROLLABLE CONTAINER WITH FIXED HEADER */}
              <div className="mt-3 border border-slate-200 rounded-xl overflow-hidden">
                <div className="max-h-64 overflow-y-auto custom-scrollbar">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200 text-slate-600 font-semibold text-[11px]">
                      <tr>
                        <th className="py-2.5 px-3 w-28">Ngày</th>
                        <th className="py-2.5 px-3">Sự việc</th>
                        <th className="py-2.5 px-3 w-20 text-center">Điểm</th>
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
                            className="py-8 text-center text-slate-400 text-xs"
                          >
                            Chưa có sự việc thi đua nào trong kỳ này
                          </td>
                        </tr>
                      ) : (
                        disciplineStats.filteredEvents.map((ev) => {
                          const isPositive = ev.points >= 0;
                          return (
                            <tr key={ev.id} className="hover:bg-slate-50 transition-colors">
                              <td className="py-2.5 px-3 font-mono text-slate-600 whitespace-nowrap">
                                {ev.date}
                              </td>
                              <td className="py-2.5 px-3 font-medium text-slate-800">
                                <div>{ev.ruleName}</div>
                                {ev.note && (
                                  <div className="text-[11px] text-slate-600 italic">
                                    "{ev.note}"
                                  </div>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                <span
                                  className={`font-mono font-bold ${
                                    isPositive ? 'text-emerald-700' : 'text-rose-600'
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
                                    className="p-1 text-rose-500 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
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

      {/* ================= VIII. TAB ĐIỂM DANH ================= */}
      {activeTab === 'attendance' && (
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-5">
          {/* Attendance Stats Counters */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-100 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-medium text-slate-500">Có mặt</span>
                <div className="text-xl font-bold font-mono text-emerald-700">
                  {attendanceStats.present} buổi
                </div>
              </div>
              <CheckCircle className="w-5 h-5 text-emerald-600" />
            </div>

            <div className="p-3 rounded-xl bg-amber-50/60 border border-amber-100 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-medium text-slate-500">Đi muộn</span>
                <div className="text-xl font-bold font-mono text-amber-700">
                  {attendanceStats.late} lần
                </div>
              </div>
              <Clock className="w-5 h-5 text-amber-600" />
            </div>

            <div className="p-3 rounded-xl bg-sky-50/60 border border-sky-100 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-medium text-slate-500">Vắng có phép</span>
                <div className="text-xl font-bold font-mono text-sky-700">
                  {attendanceStats.excused} buổi
                </div>
              </div>
              <FileText className="w-5 h-5 text-sky-600" />
            </div>

            <div className="p-3 rounded-xl bg-rose-50/60 border border-rose-100 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-medium text-slate-500">Vắng không phép</span>
                <div className="text-xl font-bold font-mono text-rose-700">
                  {attendanceStats.unexcused} buổi
                </div>
              </div>
              <XCircle className="w-5 h-5 text-rose-600" />
            </div>
          </div>

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

      {/* ================= IX. TAB HỌC TẬP (BẢNG ĐIỂM) ================= */}
      {activeTab === 'grades' && (
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
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

      {/* ================= XI. TAB TỔNG HỢP ================= */}
      {activeTab === 'summary' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-6">
          <div className="pb-3 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-800">
                Báo Cáo Tổng Hợp Học Sinh: {student.fullName}
              </h3>
              <p className="text-xs text-slate-500">
                Năm học {data.settings.academicYear} · Lớp {data.settings.className}
              </p>
            </div>
            <button
              onClick={() => window.print()}
              className="px-3 py-1.5 text-xs font-semibold text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-xl flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              In Báo Cáo
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 1. Điểm thi đua & Rèn luyện */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-2">
              <span className="text-xs font-bold text-slate-700">Thi Đua & Rèn Luyện</span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold font-mono text-sky-800">
                  {disciplineStats.totalScore}
                </span>
                <span className="text-xs text-slate-500">điểm</span>
              </div>
              <div className="text-xs">
                Xếp loại thi đua:{' '}
                <strong className={`font-semibold ${conductEval.colorClass}`}>
                  {conductEval.label}
                </strong>
              </div>
            </div>

            {/* 2. Điểm danh */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-2">
              <span className="text-xs font-bold text-slate-700">Chuyên Cần Điểm Danh</span>
              <div className="text-xs space-y-1 mt-1 text-slate-600">
                <div>Có mặt: <strong className="text-emerald-700">{attendanceStats.present} buổi</strong></div>
                <div>Đi muộn: <strong className="text-amber-700">{attendanceStats.late} lần</strong></div>
                <div>Vắng: <strong className="text-rose-600">{attendanceStats.excused + attendanceStats.unexcused} buổi ({attendanceStats.excused} phép)</strong></div>
              </div>
            </div>

            {/* 3. Học tập */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-2">
              <span className="text-xs font-bold text-slate-700">Học Tập ({selectedSemester})</span>
              <div className="text-xs space-y-1 mt-1 text-slate-600">
                <div>Tổng số cột điểm đã có: <strong>{studentGrades.length}</strong></div>
                <div>
                  Điểm cao nhất:{' '}
                  <strong className="text-sky-700 font-mono">
                    {studentGrades.length > 0 ? Math.max(...studentGrades.map((g) => g.score)) : '-'}
                  </strong>
                </div>
              </div>
            </div>
          </div>

          {/* Teacher comments */}
          <div className="p-4 rounded-xl bg-sky-50/50 border border-sky-100 space-y-2">
            <span className="text-xs font-bold text-slate-800">
              Nhận xét của Giáo viên Chủ nhiệm
            </span>
            {role === 'teacher' ? (
              <textarea
                rows={3}
                value={teacherFeedback}
                onChange={(e) => setTeacherFeedback(e.target.value)}
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
    </div>
  );
};
