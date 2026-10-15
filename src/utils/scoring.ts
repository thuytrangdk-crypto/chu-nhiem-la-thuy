import { DisciplineEvent, AttendanceRecord, AppSettings } from '../types';

export function calculateDisciplineScore(
  studentId: string,
  events: DisciplineEvent[],
  basePoints: number,
  selectedMonth?: string // format: 'YYYY-MM' or 'all'
): {
  totalScore: number;
  deltaPoints: number;
  positiveCount: number;
  negativeCount: number;
  filteredEvents: DisciplineEvent[];
} {
  const studentEvents = events.filter((e) => e.studentId === studentId);

  const filteredEvents = studentEvents.filter((e) => {
    if (!selectedMonth || selectedMonth === 'all') return true;
    return e.date.startsWith(selectedMonth);
  });

  let deltaPoints = 0;
  let positiveCount = 0;
  let negativeCount = 0;

  for (const ev of filteredEvents) {
    deltaPoints += ev.points;
    if (ev.points > 0) positiveCount++;
    if (ev.points < 0) negativeCount++;
  }

  const totalScore = basePoints + deltaPoints;

  return {
    totalScore,
    deltaPoints,
    positiveCount,
    negativeCount,
    filteredEvents,
  };
}

export function evaluateConduct(
  score: number,
  thresholds?: { label: string; minScore: number }[]
): {
  label: string;
  colorClass: string;
} {
  if (!thresholds || thresholds.length === 0) {
    return { label: 'Chưa thiết lập', colorClass: 'text-slate-500' };
  }

  // Sort descending by minScore
  const sorted = [...thresholds].sort((a, b) => b.minScore - a.minScore);

  for (const th of sorted) {
    if (score >= th.minScore) {
      if (th.label === 'Tốt') return { label: th.label, colorClass: 'text-emerald-700 bg-emerald-50' };
      if (th.label === 'Khá') return { label: th.label, colorClass: 'text-blue-700 bg-blue-50' };
      if (th.label === 'Đạt') return { label: th.label, colorClass: 'text-amber-700 bg-amber-50' };
      return { label: th.label, colorClass: 'text-rose-700 bg-rose-50' };
    }
  }

  return { label: sorted[sorted.length - 1].label, colorClass: 'text-rose-700 bg-rose-50' };
}

export function calculateAttendanceStats(
  studentId: string,
  records: AttendanceRecord[],
  selectedMonth?: string
): {
  present: number;
  excused: number;
  unexcused: number;
  late: number;
  total: number;
} {
  const studentRecords = records.filter((r) => r.studentId === studentId);
  const filtered = studentRecords.filter((r) => {
    if (!selectedMonth || selectedMonth === 'all') return true;
    return r.date.startsWith(selectedMonth);
  });

  let present = 0;
  let excused = 0;
  let unexcused = 0;
  let late = 0;

  for (const r of filtered) {
    if (r.status === 'present') present++;
    else if (r.status === 'excused_absence') excused++;
    else if (r.status === 'unexcused_absence') unexcused++;
    else if (r.status === 'late') late++;
  }

  return {
    present,
    excused,
    unexcused,
    late,
    total: filtered.length,
  };
}
