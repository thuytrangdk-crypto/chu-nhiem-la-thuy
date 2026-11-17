import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  Award,
  Download,
  Calendar,
  CheckCircle,
  AlertCircle,
  Clock,
  Users
} from 'lucide-react';
import { AppSettings, DisciplineEvent, Student, SemesterKey } from '../types';
import { exportDisciplineToExcel, DisciplineExportOptions } from '../utils/excel';
import {
  getActiveSemesterPeriod,
  getAvailableAcademicYears,
  getSemesterConfigForYear,
  parseAcademicYears,
  resolveEventPeriod,
} from '../utils/scoring';

interface DisciplineExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  students: Student[];
  events: DisciplineEvent[];
  settings: AppSettings;
}

type PeriodMode = 'week' | 'month' | 'semester' | 'year' | 'custom';

function toDateStr(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatVNDate(dStr: string): string {
  if (!dStr) return '';
  const parts = dStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dStr;
}

export const DisciplineExportModal: React.FC<DisciplineExportModalProps> = ({
  isOpen,
  onClose,
  students,
  events,
  settings,
}) => {
  const activePeriod = useMemo(() => getActiveSemesterPeriod(settings), [settings]);
  const availableYears = useMemo(
    () => getAvailableAcademicYears(settings, events),
    [settings, events]
  );

  const now = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => toDateStr(now), [now]);

  // Default mode: 'semester' or 'month' (keeping easy selection for HK1 / HK2 / Year)
  const [mode, setMode] = useState<PeriodMode>('semester');
  const [selectedAcademicYear, setSelectedAcademicYear] = useState<string>(
    activePeriod.academicYear
  );

  useEffect(() => {
    if (isOpen) {
      setSelectedAcademicYear(activePeriod.academicYear);
      setSemesterChoice(activePeriod.semester);
      setExportError(null);
      setExportSuccess(null);
    }
  }, [isOpen, activePeriod.academicYear, activePeriod.semester]);

  const yearConfig = useMemo(
    () => getSemesterConfigForYear(selectedAcademicYear, settings),
    [selectedAcademicYear, settings]
  );

  const { startYear, endYear } = useMemo(
    () => parseAcademicYears(selectedAcademicYear),
    [selectedAcademicYear]
  );

  // Week selection
  const [weekChoice, setWeekChoice] = useState<'thisWeek' | 'lastWeek' | 'customWeek'>('thisWeek');
  const [customWeekNum, setCustomWeekNum] = useState<number>(1);

  // Month selection
  const defaultMonthStr = useMemo(() => {
    const m = String(now.getMonth() + 1).padStart(2, '0');
    return `${now.getFullYear()}-${m}`;
  }, [now]);
  const [selectedMonth, setSelectedMonth] = useState<string>(defaultMonthStr);

  // Semester selection
  const [semesterChoice, setSemesterChoice] = useState<SemesterKey>(activePeriod.semester);

  // Custom date range inputs
  const [customStartDate, setCustomStartDate] = useState<string>(todayStr);
  const [customEndDate, setCustomEndDate] = useState<string>(todayStr);

  // Export status / message
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const { startDate, endDate, periodLabel } = useMemo(() => {
    if (mode === 'week') {
      const curr = new Date(now);
      const day = curr.getDay();
      const diffToMonday = curr.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(curr.setDate(diffToMonday));

      if (weekChoice === 'thisWeek') {
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        const sStr = toDateStr(monday);
        const eStr = toDateStr(sunday);
        return {
          startDate: sStr,
          endDate: eStr,
          periodLabel: `Tuần này (${formatVNDate(sStr)} - ${formatVNDate(eStr)})`,
        };
      } else if (weekChoice === 'lastWeek') {
        const lastMonday = new Date(monday);
        lastMonday.setDate(monday.getDate() - 7);
        const lastSunday = new Date(lastMonday);
        lastSunday.setDate(lastMonday.getDate() + 6);
        const sStr = toDateStr(lastMonday);
        const eStr = toDateStr(lastSunday);
        return {
          startDate: sStr,
          endDate: eStr,
          periodLabel: `Tuần trước (${formatVNDate(sStr)} - ${formatVNDate(eStr)})`,
        };
      } else {
        const [sy, sm, sd] = yearConfig.hk1Start.split('-').map((n) => parseInt(n, 10));
        const schoolStart = new Date(sy, (sm || 9) - 1, sd || 1);
        const schoolStartMonday = new Date(schoolStart);
        const sDay = schoolStart.getDay();
        const sDiff = schoolStart.getDate() - sDay + (sDay === 0 ? -6 : 1);
        schoolStartMonday.setDate(sDiff);

        const targetMonday = new Date(schoolStartMonday);
        targetMonday.setDate(schoolStartMonday.getDate() + (customWeekNum - 1) * 7);
        const targetSunday = new Date(targetMonday);
        targetSunday.setDate(targetMonday.getDate() + 6);

        const sStr = toDateStr(targetMonday);
        const eStr = toDateStr(targetSunday);
        return {
          startDate: sStr,
          endDate: eStr,
          periodLabel: `Tuần ${customWeekNum} (${formatVNDate(sStr)} - ${formatVNDate(eStr)})`,
        };
      }
    }

    if (mode === 'month') {
      const [yStr, mStr] = selectedMonth.split('-');
      const y = parseInt(yStr, 10) || now.getFullYear();
      const m = parseInt(mStr, 10) || now.getMonth() + 1;
      const lastDay = new Date(y, m, 0).getDate();
      const sStr = `${y}-${String(m).padStart(2, '0')}-01`;
      const eStr = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      return {
        startDate: sStr,
        endDate: eStr,
        periodLabel: `Tháng ${m}/${y} (${formatVNDate(sStr)} - ${formatVNDate(eStr)})`,
      };
    }

    if (mode === 'semester') {
      if (semesterChoice === 'HK1') {
        return {
          startDate: yearConfig.hk1Start,
          endDate: yearConfig.hk1End,
          periodLabel: `Học kỳ I - Năm học ${yearConfig.academicYear} (${formatVNDate(yearConfig.hk1Start)} - ${formatVNDate(yearConfig.hk1End)})`,
        };
      } else {
        return {
          startDate: yearConfig.hk2Start,
          endDate: yearConfig.hk2End,
          periodLabel: `Học kỳ II - Năm học ${yearConfig.academicYear} (${formatVNDate(yearConfig.hk2Start)} - ${formatVNDate(yearConfig.hk2End)})`,
        };
      }
    }

    if (mode === 'year') {
      return {
        startDate: yearConfig.hk1Start,
        endDate: yearConfig.hk2End,
        periodLabel: `Cả năm học ${yearConfig.academicYear} (HK I & HK II tách riêng)`,
      };
    }

    return {
      startDate: customStartDate,
      endDate: customEndDate,
      periodLabel: `Khoảng ngày tùy chọn (${formatVNDate(customStartDate)} - ${formatVNDate(customEndDate)})`,
    };
  }, [
    mode,
    weekChoice,
    customWeekNum,
    selectedMonth,
    semesterChoice,
    customStartDate,
    customEndDate,
    yearConfig,
    now,
  ]);

  const eventsInRangeCount = useMemo(() => {
    if (!events) return 0;
    return events.filter((ev) => {
      if (mode === 'year') {
        return resolveEventPeriod(ev, settings).academicYear === yearConfig.academicYear;
      }
      if (mode === 'semester') {
        const p = resolveEventPeriod(ev, settings);
        return p.academicYear === yearConfig.academicYear && p.semester === semesterChoice;
      }
      const d = (ev.date || '').slice(0, 10);
      return (!startDate || d >= startDate) && (!endDate || d <= endDate);
    }).length;
  }, [events, mode, settings, yearConfig.academicYear, semesterChoice, startDate, endDate]);

  const currentTimeStr = useMemo(() => {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(now.getHours())}:${pad(now.getMinutes())} ${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`;
  }, [now]);

  const handleExport = () => {
    setExportError(null);
    setExportSuccess(null);

    if (!students || students.length === 0) {
      setExportError('Lớp học chưa có dữ liệu học sinh để xuất thi đua.');
      return;
    }

    if (!startDate || !endDate) {
      setExportError('Vui lòng chọn đầy đủ ngày bắt đầu và kết thúc.');
      return;
    }

    if (startDate > endDate) {
      setExportError('Ngày bắt đầu không được lớn hơn ngày kết thúc.');
      return;
    }

    setIsExporting(true);

    try {
      const options: DisciplineExportOptions = {
        periodType: mode,
        periodLabel,
        startDate,
        endDate,
        academicYear: yearConfig.academicYear,
        semester: mode === 'semester' ? semesterChoice : undefined,
      };

      exportDisciplineToExcel(students, events || [], settings, options);

      const safeClassName = (settings.className || 'Lop').replace(/[\s/\\?%*:|"<>]/g, '_');
      const suffix =
        mode === 'year'
          ? `CaNam_${yearConfig.academicYear.replace(/\s+/g, '')}`
          : mode === 'semester'
          ? `${semesterChoice}_${yearConfig.academicYear.replace(/\s+/g, '')}`
          : `${startDate.split('-').reverse().join('-')}_${endDate.split('-').reverse().join('-')}`;
      const fileName = `Thi_dua_${safeClassName}_${suffix}.xlsx`;
      setExportSuccess(`Đã xuất thành công file "${fileName}" với đầy đủ 2 sheet: Tổng hợp thi đua & Chi tiết ghi nhận!`);
    } catch (err: any) {
      setExportError(err.message || 'Lỗi khi xuất file Excel thi đua');
    } finally {
      setIsExporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200/80 w-full max-w-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-gradient-to-r from-sky-700 via-sky-600 to-indigo-700 px-6 py-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center shadow-inner">
              <Award className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight">Xuất Excel Thi Đua Lớp {settings.className}</h2>
              <p className="text-sky-100 text-xs mt-0.5">
                Báo cáo tổng hợp theo học kỳ (200 điểm/học kỳ) & chi tiết ghi nhận
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors cursor-pointer text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Metadata Card */}
          <div className="bg-sky-50/70 border border-sky-100 rounded-2xl p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <span className="text-slate-400 block font-medium">Lớp học:</span>
              <span className="font-bold text-sky-900 text-sm">{settings.className || 'Chưa đặt'}</span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">Trường:</span>
              <span className="font-semibold text-slate-800 truncate block" title={settings.schoolName}>
                {settings.schoolName || 'Chưa đặt'}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">Giáo viên CN:</span>
              <span className="font-semibold text-slate-800">{settings.teacherName || 'Chưa đặt'}</span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">Thời gian xuất:</span>
              <span className="font-semibold text-slate-800 flex items-center gap-1">
                <Clock className="w-3 h-3 text-sky-600" />
                {currentTimeStr}
              </span>
            </div>
          </div>

          {/* Academic year + Period Selector Tabs */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                1. Chọn kỳ báo cáo thi đua:
              </label>

              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-500 font-medium">Năm học:</span>
                <select
                  value={selectedAcademicYear}
                  onChange={(e) => setSelectedAcademicYear(e.target.value)}
                  className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg font-semibold text-slate-800 cursor-pointer"
                >
                  {availableYears.map((yr) => (
                    <option key={yr} value={yr}>
                      {yr}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 bg-slate-100 p-1.5 rounded-2xl text-xs font-semibold">
              <button
                type="button"
                onClick={() => setMode('semester')}
                className={`py-2 px-3 rounded-xl transition-all cursor-pointer ${
                  mode === 'semester'
                    ? 'bg-white text-sky-800 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Theo Học Kỳ
              </button>
              <button
                type="button"
                onClick={() => setMode('year')}
                className={`py-2 px-3 rounded-xl transition-all cursor-pointer ${
                  mode === 'year'
                    ? 'bg-white text-sky-800 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Cả Năm Học
              </button>
              <button
                type="button"
                onClick={() => setMode('month')}
                className={`py-2 px-3 rounded-xl transition-all cursor-pointer ${
                  mode === 'month'
                    ? 'bg-white text-sky-800 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Theo Tháng
              </button>
              <button
                type="button"
                onClick={() => setMode('week')}
                className={`py-2 px-3 rounded-xl transition-all cursor-pointer ${
                  mode === 'week'
                    ? 'bg-white text-sky-800 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Theo Tuần
              </button>
              <button
                type="button"
                onClick={() => setMode('custom')}
                className={`py-2 px-3 rounded-xl transition-all cursor-pointer col-span-2 sm:col-span-1 ${
                  mode === 'custom'
                    ? 'bg-white text-sky-800 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Tùy Chọn Ngày
              </button>
            </div>
          </div>

          {/* Sub-selectors per mode */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 text-xs">
            {mode === 'week' && (
              <div className="space-y-3">
                <span className="font-bold text-slate-700 block">Lựa chọn tuần báo cáo:</span>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setWeekChoice('thisWeek')}
                    className={`px-3.5 py-2 rounded-xl font-medium border transition-colors cursor-pointer ${
                      weekChoice === 'thisWeek'
                        ? 'bg-sky-600 text-white border-sky-600 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Tuần này
                  </button>
                  <button
                    type="button"
                    onClick={() => setWeekChoice('lastWeek')}
                    className={`px-3.5 py-2 rounded-xl font-medium border transition-colors cursor-pointer ${
                      weekChoice === 'lastWeek'
                        ? 'bg-sky-600 text-white border-sky-600 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Tuần trước
                  </button>
                  <button
                    type="button"
                    onClick={() => setWeekChoice('customWeek')}
                    className={`px-3.5 py-2 rounded-xl font-medium border transition-colors cursor-pointer ${
                      weekChoice === 'customWeek'
                        ? 'bg-sky-600 text-white border-sky-600 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Chọn tuần trong năm học
                  </button>
                </div>

                {weekChoice === 'customWeek' && (
                  <div className="flex items-center gap-3 pt-2">
                    <span className="text-slate-600 font-medium">Tuần thứ:</span>
                    <select
                      value={customWeekNum}
                      onChange={(e) => setCustomWeekNum(Number(e.target.value))}
                      className="px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800"
                    >
                      {Array.from({ length: 38 }, (_, i) => i + 1).map((w) => (
                        <option key={w} value={w}>
                          Tuần {w}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}

            {mode === 'month' && (
              <div className="space-y-3">
                <span className="font-bold text-slate-700 block">
                  Chọn tháng trong năm học {yearConfig.academicYear}:
                </span>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                  {[
                    { label: `Tháng 9/${startYear}`, val: `${startYear}-09` },
                    { label: `Tháng 10/${startYear}`, val: `${startYear}-10` },
                    { label: `Tháng 11/${startYear}`, val: `${startYear}-11` },
                    { label: `Tháng 12/${startYear}`, val: `${startYear}-12` },
                    { label: `Tháng 1/${endYear}`, val: `${endYear}-01` },
                    { label: `Tháng 2/${endYear}`, val: `${endYear}-02` },
                    { label: `Tháng 3/${endYear}`, val: `${endYear}-03` },
                    { label: `Tháng 4/${endYear}`, val: `${endYear}-04` },
                    { label: `Tháng 5/${endYear}`, val: `${endYear}-05` },
                    { label: `Tháng 6/${endYear}`, val: `${endYear}-06` },
                  ].map((m) => (
                    <button
                      key={m.val}
                      type="button"
                      onClick={() => setSelectedMonth(m.val)}
                      className={`py-2 px-2.5 rounded-xl font-medium border text-center transition-colors cursor-pointer ${
                        selectedMonth === m.val
                          ? 'bg-sky-600 text-white border-sky-600 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {mode === 'semester' && (
              <div className="space-y-3">
                <span className="font-bold text-slate-700 block">
                  Chọn học kỳ (theo lịch năm học {yearConfig.academicYear}):
                </span>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setSemesterChoice('HK1')}
                    className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                      semesterChoice === 'HK1'
                        ? 'bg-sky-50 border-sky-500 shadow-xs text-sky-900'
                        : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <div className="font-bold text-sm">Học kỳ I</div>
                    <div className="text-[11px] text-slate-500 mt-1">
                      Từ {formatVNDate(yearConfig.hk1Start)} đến {formatVNDate(yearConfig.hk1End)} · 200 điểm đầu kỳ
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSemesterChoice('HK2')}
                    className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                      semesterChoice === 'HK2'
                        ? 'bg-sky-50 border-sky-500 shadow-xs text-sky-900'
                        : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <div className="font-bold text-sm">Học kỳ II</div>
                    <div className="text-[11px] text-slate-500 mt-1">
                      Từ {formatVNDate(yearConfig.hk2Start)} đến {formatVNDate(yearConfig.hk2End)} · 200 điểm đầu kỳ
                    </div>
                  </button>
                </div>
              </div>
            )}

            {mode === 'year' && (
              <div className="p-3 bg-white rounded-xl border border-slate-200 text-slate-700 space-y-1.5">
                <p className="font-bold text-sky-900">
                  Xuất báo cáo Cả Năm Học {yearConfig.academicYear} (Tách riêng HK I & HK II)
                </p>
                <p className="text-slate-600 text-[11px] leading-relaxed">
                  File Excel sẽ tách riêng các cột <strong>Điểm thi đua HK I</strong>, <strong>Tổng thưởng/trừ HK I</strong>,{' '}
                  <strong>Hạnh kiểm/Rèn luyện HK I</strong> và <strong>Điểm thi đua HK II</strong>, <strong>Tổng thưởng/trừ HK II</strong>,{' '}
                  <strong>Hạnh kiểm/Rèn luyện HK II</strong> (mỗi kỳ tính độc lập trên nền 200 điểm, không cộng dồn thành 400).
                </p>
                <div className="text-[11px] text-slate-500 pt-1">
                  HK I: {formatVNDate(yearConfig.hk1Start)} – {formatVNDate(yearConfig.hk1End)} · HK II: {formatVNDate(yearConfig.hk2Start)} – {formatVNDate(yearConfig.hk2End)}
                </div>
              </div>
            )}

            {mode === 'custom' && (
              <div className="space-y-3">
                <span className="font-bold text-slate-700 block">Chọn khoảng ngày tùy ý:</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-600 font-medium mb-1">Từ ngày:</label>
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 font-medium mb-1">Đến ngày:</label>
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Live Preview Box */}
          <div className="bg-gradient-to-br from-indigo-50/70 via-sky-50/70 to-emerald-50/70 border border-sky-200/80 rounded-2xl p-4 text-xs space-y-2.5">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="font-bold text-sky-950 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-sky-600" />
                Thông tin xuất báo cáo:
              </span>
              <span className="bg-sky-100 text-sky-800 px-2.5 py-0.5 rounded-full font-semibold text-[11px]">
                {periodLabel}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-slate-700 pt-1">
              <div className="bg-white/80 p-2.5 rounded-xl border border-sky-100">
                <span className="text-slate-400 block text-[11px]">Sĩ số lớp xuất báo cáo:</span>
                <span className="font-bold text-slate-900 text-sm flex items-center gap-1.5 mt-0.5">
                  <Users className="w-3.5 h-3.5 text-sky-600" />
                  {students.length} học sinh (đầy đủ 100%)
                </span>
              </div>
              <div className="bg-white/80 p-2.5 rounded-xl border border-sky-100">
                <span className="text-slate-400 block text-[11px]">Sự việc ghi nhận trong kỳ:</span>
                <span className="font-bold text-slate-900 text-sm flex items-center gap-1.5 mt-0.5">
                  <Award className="w-3.5 h-3.5 text-amber-500" />
                  {eventsInRangeCount} sự việc
                </span>
              </div>
            </div>

            <div className="text-[11px] text-slate-500 border-t border-sky-200/50 pt-2 flex items-center justify-between">
              <span>Định dạng: <strong>2 Sheet .xlsx</strong> (Tổng hợp thi đua & Chi tiết ghi nhận)</span>
              <span>Cố định tiêu đề & Bật bộ lọc</span>
            </div>
          </div>

          {exportError && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
              <span>{exportError}</span>
            </div>
          )}

          {exportSuccess && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-800 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{exportSuccess}</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="bg-slate-50 px-6 py-4 border-t border-slate-200/80 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 rounded-xl transition-colors cursor-pointer"
          >
            Đóng
          </button>

          <button
            type="button"
            onClick={handleExport}
            disabled={isExporting}
            className="px-5 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 rounded-xl flex items-center gap-2 shadow-md shadow-sky-600/20 transition-all cursor-pointer disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            {isExporting ? 'Đang xuất Excel...' : 'Xuất File Excel Thi Đua (.xlsx)'}
          </button>
        </div>
      </div>
    </div>
  );
};
