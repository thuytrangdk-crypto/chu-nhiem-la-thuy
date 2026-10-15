import React, { useState, useMemo } from 'react';
import {
  Users,
  UserCheck,
  UserX,
  AlertTriangle,
  Award,
  Calendar,
  ChevronRight,
  TrendingUp,
  Clock,
  Pin,
  CheckCircle,
  XCircle,
  FileText
} from 'lucide-react';
import { AppData, UserRole } from '../types';
import { calculateDisciplineScore, evaluateConduct } from '../utils/scoring';

interface DashboardViewProps {
  data: AppData;
  role: UserRole;
  onNavigateToStudent?: (studentId: string) => void;
  onNavigateToBoard?: (tabIndex: number) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  data,
  role,
  onNavigateToStudent,
  onNavigateToBoard,
}) => {
  const currentMonthNum = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();
  const defaultMonthStr = `${currentYear}-${String(currentMonthNum).padStart(2, '0')}`;

  const [selectedMonth, setSelectedMonth] = useState<string>(defaultMonthStr);
  const todayStr = new Date().toISOString().split('T')[0];

  // 1. Overall student stats
  const totalStudents = data.students.length;
  const boysCount = data.students.filter((s) => s.gender === 'Nam').length;
  const girlsCount = data.students.filter((s) => s.gender === 'Nữ').length;

  // 2. Today's attendance stats
  const todayAttendance = data.attendance.filter((a) => a.date === todayStr);
  const presentToday = todayAttendance.filter((a) => a.status === 'present').length;
  const excusedToday = todayAttendance.filter((a) => a.status === 'excused_absence').length;
  const unexcusedToday = todayAttendance.filter((a) => a.status === 'unexcused_absence').length;
  const lateToday = todayAttendance.filter((a) => a.status === 'late').length;
  const absentToday = excusedToday + unexcusedToday;

  // 3. Discipline events in selected month
  const monthEvents = useMemo(() => {
    return data.disciplineEvents.filter((e) => {
      if (selectedMonth === 'all') return true;
      return e.date.startsWith(selectedMonth);
    });
  }, [data.disciplineEvents, selectedMonth]);

  const infractionsCount = monthEvents.filter((e) => e.points < 0).length;
  const positivesCount = monthEvents.filter((e) => e.points > 0).length;

  // 4. Discipline group breakdown
  const groupStats = useMemo(() => {
    const map: Record<string, { positive: number; negative: number; points: number }> = {
      'Học tập': { positive: 0, negative: 0, points: 0 },
      'Nề nếp': { positive: 0, negative: 0, points: 0 },
      'Chuyên cần': { positive: 0, negative: 0, points: 0 },
      'Phong trào': { positive: 0, negative: 0, points: 0 },
      'Khác': { positive: 0, negative: 0, points: 0 },
    };

    monthEvents.forEach((ev) => {
      const rule = data.disciplineRules.find((r) => r.id === ev.ruleId);
      const groupName = rule?.group || 'Khác';
      if (!map[groupName]) map[groupName] = { positive: 0, negative: 0, points: 0 };

      if (ev.points > 0) map[groupName].positive++;
      if (ev.points < 0) map[groupName].negative++;
      map[groupName].points += ev.points;
    });

    return map;
  }, [monthEvents, data.disciplineRules]);

  // 5. Outstanding students (Top scores)
  const outstandingStudents = useMemo(() => {
    return data.students
      .map((st) => {
        const scoreData = calculateDisciplineScore(
          st.id,
          data.disciplineEvents,
          data.settings.baseDisciplinePoints,
          selectedMonth
        );
        return {
          student: st,
          ...scoreData,
          conduct: evaluateConduct(scoreData.totalScore, data.settings.conductThresholds),
        };
      })
      .sort((a, b) => b.totalScore - a.totalScore)
      .slice(0, 5);
  }, [data.students, data.disciplineEvents, data.settings, selectedMonth]);

  // 6. Recent announcements
  const latestAnnouncements = data.announcements.slice(0, 3);

  // 7. Recent discipline events
  const recentEvents = data.disciplineEvents.slice(0, 6);

  return (
    <div className="space-y-6">
      {/* Top filter bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-slate-800">
            Bảng Điều Khiển Lớp {data.settings.className}
          </h1>
          <p className="text-xs text-slate-500">
            Dữ liệu tổng hợp thi đua, điểm danh và hoạt động học tập
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
            <Calendar className="w-4 h-4 text-sky-600" />
            <span>Kỳ đánh giá:</span>
          </div>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 cursor-pointer"
          >
            <option value="all">Tất cả các tháng (Cả năm)</option>
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

      {/* 7 KPI Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3.5">
        {/* 1. Tổng sĩ số */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-500">Tổng sĩ số</span>
            <Users className="w-4 h-4 text-sky-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl font-bold text-slate-900 tabular-nums">
              {totalStudents}
            </span>
            <span className="text-[11px] text-slate-500">học sinh</span>
          </div>
        </div>

        {/* 2. Nam */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-500">Nam</span>
            <div className="w-2 h-2 rounded-full bg-blue-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl font-bold text-blue-700 tabular-nums">
              {boysCount}
            </span>
            <span className="text-[11px] text-slate-500">học sinh</span>
          </div>
        </div>

        {/* 3. Nữ */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-500">Nữ</span>
            <div className="w-2 h-2 rounded-full bg-pink-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl font-bold text-pink-600 tabular-nums">
              {girlsCount}
            </span>
            <span className="text-[11px] text-slate-500">học sinh</span>
          </div>
        </div>

        {/* 4. Có mặt hôm nay */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-500">Có mặt hôm nay</span>
            <UserCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl font-bold text-emerald-700 tabular-nums">
              {presentToday}
            </span>
            <span className="text-[11px] text-slate-500">em</span>
          </div>
        </div>

        {/* 5. Vắng hôm nay */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-500">Vắng hôm nay</span>
            <UserX className="w-4 h-4 text-rose-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl font-bold text-rose-600 tabular-nums">
              {absentToday}
            </span>
            <span className="text-[10px] text-slate-500">
              ({excusedToday} phép, {unexcusedToday} kp)
            </span>
          </div>
        </div>

        {/* 6. Vi phạm trong tháng */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-500">Vi phạm kỳ này</span>
            <AlertTriangle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl font-bold text-rose-600 tabular-nums">
              {infractionsCount}
            </span>
            <span className="text-[11px] text-slate-500">lượt</span>
          </div>
        </div>

        {/* 7. Khen thưởng trong tháng */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-500">Tích cực kỳ này</span>
            <Award className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl font-bold text-emerald-600 tabular-nums">
              {positivesCount}
            </span>
            <span className="text-[11px] text-slate-500">lượt</span>
          </div>
        </div>
      </div>

      {/* Middle Grid: Charts & Outstanding */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Tình hình thi đua theo nhóm */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-sky-600" />
              <h3 className="text-sm font-bold text-slate-800">Tình Hình Thi Đua Theo Nhóm</h3>
            </div>
            <span className="text-xs text-slate-500">
              {selectedMonth === 'all' ? 'Cả năm' : `Tháng ${selectedMonth.split('-')[1]}`}
            </span>
          </div>

          <div className="mt-4 space-y-3.5 flex-1">
            {Object.entries(groupStats).map(([group, val]) => {
              const totalEvents = val.positive + val.negative;
              const posPercent = totalEvents > 0 ? (val.positive / totalEvents) * 100 : 50;
              return (
                <div key={group} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-700">{group}</span>
                    <div className="flex items-center gap-2 font-mono tabular-nums text-[11px]">
                      <span className="text-emerald-700 font-semibold">+{val.positive}</span>
                      <span className="text-slate-300">/</span>
                      <span className="text-rose-600 font-semibold">-{val.negative}</span>
                    </div>
                  </div>
                  {/* Two-tone bar */}
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden flex">
                    {totalEvents > 0 ? (
                      <>
                        <div
                          style={{ width: `${posPercent}%` }}
                          className="bg-emerald-500 h-full transition-all"
                        />
                        <div
                          style={{ width: `${100 - posPercent}%` }}
                          className="bg-rose-500 h-full transition-all"
                        />
                      </>
                    ) : (
                      <div className="w-full bg-slate-200 h-full" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
              Ghi nhận tích cực
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />
              Vi phạm nề nếp
            </span>
          </div>
        </div>

        {/* Center Column: Thống kê Điểm Danh */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-sky-600" />
              <h3 className="text-sm font-bold text-slate-800">Điểm Danh Toàn Lớp Hôm Nay</h3>
            </div>
            <span className="text-xs text-slate-500 font-mono">{todayStr}</span>
          </div>

          <div className="mt-4 flex-1 flex flex-col justify-around space-y-3">
            <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-50/60 border border-emerald-100">
              <div className="flex items-center gap-2.5">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                <span className="text-xs font-semibold text-slate-700">Có mặt đúng giờ</span>
              </div>
              <span className="text-base font-bold text-emerald-700 font-mono tabular-nums">
                {presentToday} em
              </span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-amber-50/60 border border-amber-100">
              <div className="flex items-center gap-2.5">
                <Clock className="w-4 h-4 text-amber-600" />
                <span className="text-xs font-semibold text-slate-700">Đi muộn</span>
              </div>
              <span className="text-base font-bold text-amber-700 font-mono tabular-nums">
                {lateToday} em
              </span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-sky-50/60 border border-sky-100">
              <div className="flex items-center gap-2.5">
                <FileText className="w-4 h-4 text-sky-600" />
                <span className="text-xs font-semibold text-slate-700">Vắng có phép</span>
              </div>
              <span className="text-base font-bold text-sky-700 font-mono tabular-nums">
                {excusedToday} em
              </span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-rose-50/60 border border-rose-100">
              <div className="flex items-center gap-2.5">
                <XCircle className="w-4 h-4 text-rose-600" />
                <span className="text-xs font-semibold text-slate-700">Vắng không phép</span>
              </div>
              <span className="text-base font-bold text-rose-700 font-mono tabular-nums">
                {unexcusedToday} em
              </span>
            </div>
          </div>
        </div>

        {/* Right Column: Top học sinh xuất sắc / nổi bật */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-500" />
              <h3 className="text-sm font-bold text-slate-800">Học Sinh Dẫn Đầu Thi Đua</h3>
            </div>
            <span className="text-xs text-slate-500">Top 5</span>
          </div>

          <div className="mt-3 space-y-2.5 flex-1">
            {outstandingStudents.map((item, index) => (
              <div
                key={item.student.id}
                onClick={() => {
                  if (role === 'teacher' && onNavigateToStudent) {
                    onNavigateToStudent(item.student.id);
                  }
                }}
                className={`p-2.5 rounded-xl border border-slate-100 flex items-center justify-between transition-colors ${
                  role === 'teacher' ? 'hover:bg-sky-50/50 cursor-pointer' : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`w-6 h-6 rounded-lg text-xs font-bold flex items-center justify-center ${
                      index === 0
                        ? 'bg-amber-100 text-amber-800'
                        : index === 1
                        ? 'bg-slate-200 text-slate-700'
                        : index === 2
                        ? 'bg-orange-100 text-orange-800'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {index + 1}
                  </span>
                  <div>
                    <div className="text-xs font-semibold text-slate-800">
                      {item.student.fullName}
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono">
                      {item.student.studentCode} · Xếp loại: {item.conduct.label}
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-sm font-bold text-sky-800 font-mono tabular-nums">
                    {item.totalScore} đ
                  </div>
                  <div className="text-[10px] text-emerald-700">
                    +{item.deltaPoints >= 0 ? item.deltaPoints : 0} điểm
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Section: Announcements & Recent Events */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Latest Announcements */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-800">Thông Báo Mới Nhất</h3>
            {onNavigateToBoard && (
              <button
                onClick={() => onNavigateToBoard(0)}
                className="text-xs font-semibold text-sky-600 hover:text-sky-700 flex items-center gap-1 cursor-pointer"
              >
                Xem tất cả
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="mt-4 space-y-3">
            {latestAnnouncements.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">Chưa có thông báo nào</p>
            ) : (
              latestAnnouncements.map((ann) => (
                <div
                  key={ann.id}
                  className="p-3.5 rounded-xl bg-slate-50/70 border border-slate-100 hover:border-sky-200 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {ann.isPinned && (
                        <Pin className="w-3.5 h-3.5 text-amber-500 fill-amber-400 shrink-0" />
                      )}
                      <h4 className="text-xs font-bold text-slate-800">{ann.title}</h4>
                    </div>
                    <span className="text-[10px] text-slate-600 shrink-0">{ann.date}</span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1.5 line-clamp-2 leading-relaxed">
                    {ann.content}
                  </p>
                  <div className="mt-2 text-[11px] text-sky-700 font-medium">
                    {ann.author}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Discipline Events Log */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-800">Sự Việc Thi Đua Gần Đây</h3>
            <span className="text-xs text-slate-500 font-medium">Cập nhật tự động</span>
          </div>

          <div className="mt-4 space-y-2.5">
            {recentEvents.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">Chưa có sự việc thi đua nào</p>
            ) : (
              recentEvents.map((ev) => {
                const st = data.students.find((s) => s.id === ev.studentId);
                const isPositive = ev.points >= 0;
                return (
                  <div
                    key={ev.id}
                    className="p-2.5 rounded-xl border border-slate-100 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <div className="text-[11px] font-mono text-slate-600 shrink-0">
                        {ev.date}
                      </div>
                      <div>
                        <span className="font-semibold text-slate-800">
                          {st?.fullName || 'Học sinh'}
                        </span>
                        <span className="text-slate-400 mx-1.5">·</span>
                        <span className="text-slate-600">{ev.ruleName}</span>
                        {ev.note && (
                          <span className="text-[11px] text-slate-600 block mt-0.5 italic">
                            "{ev.note}"
                          </span>
                        )}
                      </div>
                    </div>
                    <span
                      className={`font-mono font-bold shrink-0 ${
                        isPositive ? 'text-emerald-700' : 'text-rose-600'
                      }`}
                    >
                      {isPositive ? `+${ev.points}` : ev.points} đ
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
