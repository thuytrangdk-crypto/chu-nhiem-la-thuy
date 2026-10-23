import { DisciplineEvent, AttendanceRecord, AppSettings } from '../types';

export interface DateRangeFilter {
  startDate?: string; // format: 'YYYY-MM-DD'
  endDate?: string;   // format: 'YYYY-MM-DD'
}

export function calculateDisciplineScore(
  studentId: string,
  events: DisciplineEvent[],
  basePoints: number,
  periodFilter?: string | DateRangeFilter // format: 'YYYY-MM' | 'all' | { startDate, endDate }
): {
  totalScore: number;
  deltaPoints: number;
  positivePoints: number;
  negativePoints: number; // positive number (e.g. 5 for -5 points)
  positiveCount: number;
  negativeCount: number;
  filteredEvents: DisciplineEvent[];
} {
  // Deduplicate events to ensure no duplicate event is processed
  const studentEvents: DisciplineEvent[] = [];
  const seenIds = new Set<string>();

  for (const e of events) {
    if (e.studentId === studentId) {
      if (e.id) {
        if (seenIds.has(e.id)) continue;
        seenIds.add(e.id);
      }
      studentEvents.push(e);
    }
  }

  const filteredEvents = studentEvents.filter((e) => {
    if (!periodFilter || periodFilter === 'all') return true;

    if (typeof periodFilter === 'string') {
      return e.date.startsWith(periodFilter);
    }

    // Object with startDate and/or endDate (inclusive, formatted as YYYY-MM-DD)
    const evDate = (e.date || '').slice(0, 10);
    if (!evDate) return false;

    if (periodFilter.startDate && evDate < periodFilter.startDate) return false;
    if (periodFilter.endDate && evDate > periodFilter.endDate) return false;

    return true;
  });

  let deltaPoints = 0;
  let positiveCount = 0;
  let negativeCount = 0;
  let positivePoints = 0;
  let negativePoints = 0;

  for (const ev of filteredEvents) {
    const pts = typeof ev.points === 'number' ? ev.points : Number(ev.points) || 0;
    deltaPoints += pts;
    if (pts > 0) {
      positiveCount++;
      positivePoints += pts;
    } else if (pts < 0) {
      negativeCount++;
      negativePoints += Math.abs(pts);
    }
  }

  const totalScore = basePoints + deltaPoints;

  return {
    totalScore,
    deltaPoints,
    positivePoints,
    negativePoints,
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
