import {
  DisciplineEvent,
  AttendanceRecord,
  AppSettings,
  SemesterCalendarConfig,
  SemesterKey,
} from '../types';

export const SEMESTER_BASE_DISCIPLINE_POINTS = 200;

export interface DateRangeFilter {
  startDate?: string; // format: 'YYYY-MM-DD'
  endDate?: string;   // format: 'YYYY-MM-DD'
}

export interface DisciplineScoreResult {
  basePoints: number;
  totalScore: number;
  deltaPoints: number;
  positivePoints: number;
  negativePoints: number; // positive number (e.g. 5 for -5 points)
  positiveCount: number;
  negativeCount: number;
  filteredEvents: DisciplineEvent[];
}

export interface ResolvedEventPeriod {
  academicYear: string;
  semester: SemesterKey;
  isWithinConfiguredRange: boolean;
  matchedConfig?: SemesterCalendarConfig;
}

export interface ActiveSemesterPeriod {
  academicYear: string;
  semester: SemesterKey;
  config: SemesterCalendarConfig;
  isWithinConfiguredRange: boolean;
}

/**
 * Format local Date as YYYY-MM-DD (avoiding UTC off-by-one shifts).
 */
export function toLocalDateString(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Normalize an academic year string such as "2026-2027" -> "2026 - 2027".
 */
export function normalizeAcademicYear(raw?: string): string {
  const clean = (raw || '').trim();
  const match = clean.match(/(\d{4})\s*[-–/]\s*(\d{4})/);
  if (match) {
    return `${match[1]} - ${match[2]}`;
  }
  const currentYear = new Date().getFullYear();
  return clean || `${currentYear} - ${currentYear + 1}`;
}

/**
 * Parse academic year into start/end calendar years.
 */
export function parseAcademicYears(academicYear?: string): { startYear: number; endYear: number } {
  const match = (academicYear || '').match(/(\d{4})\s*[-–/]\s*(\d{4})/);
  if (match) {
    return {
      startYear: parseInt(match[1], 10),
      endYear: parseInt(match[2], 10),
    };
  }
  const now = new Date();
  const y = now.getMonth() + 1 >= 8 ? now.getFullYear() : now.getFullYear() - 1;
  return { startYear: y, endYear: y + 1 };
}

/**
 * Build default semester boundaries for an academic year (used only when not yet customized in settings).
 */
export function buildDefaultSemesterConfig(academicYear: string): SemesterCalendarConfig {
  const normalized = normalizeAcademicYear(academicYear);
  const { startYear, endYear } = parseAcademicYears(normalized);
  return {
    academicYear: normalized,
    hk1Start: `${startYear}-09-01`,
    hk1End: `${endYear}-01-15`,
    hk2Start: `${endYear}-01-16`,
    hk2End: `${endYear}-05-31`,
  };
}

/**
 * Return the per-semester base discipline points (200 by rule).
 * Ignores legacy 100 default so existing class data transitions cleanly to the 200-point per-semester scale.
 */
export function getSemesterBasePoints(settings?: Partial<AppSettings>): number {
  if (
    settings &&
    typeof settings.baseDisciplinePoints === 'number' &&
    settings.baseDisciplinePoints > 0 &&
    settings.baseDisciplinePoints !== 100
  ) {
    return settings.baseDisciplinePoints;
  }
  return SEMESTER_BASE_DISCIPLINE_POINTS;
}

/**
 * Retrieve all configured semester calendars, guaranteeing the active academic year exists.
 */
export function getSemesterConfigs(settings?: Partial<AppSettings>): SemesterCalendarConfig[] {
  const map = new Map<string, SemesterCalendarConfig>();

  if (Array.isArray(settings?.semesterConfigs)) {
    for (const cfg of settings.semesterConfigs) {
      if (!cfg || !cfg.academicYear) continue;
      const normYear = normalizeAcademicYear(cfg.academicYear);
      const fallback = buildDefaultSemesterConfig(normYear);
      map.set(normYear, {
        academicYear: normYear,
        hk1Start: (cfg.hk1Start || fallback.hk1Start).slice(0, 10),
        hk1End: (cfg.hk1End || fallback.hk1End).slice(0, 10),
        hk2Start: (cfg.hk2Start || fallback.hk2Start).slice(0, 10),
        hk2End: (cfg.hk2End || fallback.hk2End).slice(0, 10),
      });
    }
  }

  const activeYear = normalizeAcademicYear(settings?.academicYear);
  if (!map.has(activeYear)) {
    map.set(activeYear, buildDefaultSemesterConfig(activeYear));
  }

  return Array.from(map.values()).sort((a, b) => a.academicYear.localeCompare(b.academicYear));
}

/**
 * Get the calendar config for a specific academic year.
 */
export function getSemesterConfigForYear(
  academicYear: string,
  settings?: Partial<AppSettings>
): SemesterCalendarConfig {
  const norm = normalizeAcademicYear(academicYear);
  const configs = getSemesterConfigs(settings);
  return configs.find((c) => c.academicYear === norm) || buildDefaultSemesterConfig(norm);
}

/**
 * Determine which academic year & semester a YYYY-MM-DD date falls into based on configured calendars.
 */
export function resolveDateToSemester(
  dateStr: string,
  settings?: Partial<AppSettings>
): ResolvedEventPeriod {
  const cleanDate = (dateStr || '').slice(0, 10);
  const configs = getSemesterConfigs(settings);
  const activeYear = normalizeAcademicYear(settings?.academicYear);

  // Check active academic year first, then others
  const orderedConfigs = [
    ...configs.filter((c) => c.academicYear === activeYear),
    ...configs.filter((c) => c.academicYear !== activeYear),
  ];

  for (const cfg of orderedConfigs) {
    if (cleanDate >= cfg.hk1Start && cleanDate <= cfg.hk1End) {
      return {
        academicYear: cfg.academicYear,
        semester: 'HK1',
        isWithinConfiguredRange: true,
        matchedConfig: cfg,
      };
    }
    if (cleanDate >= cfg.hk2Start && cleanDate <= cfg.hk2End) {
      return {
        academicYear: cfg.academicYear,
        semester: 'HK2',
        isWithinConfiguredRange: true,
        matchedConfig: cfg,
      };
    }
  }

  // Date is outside all configured semester ranges. Infer best-match year/semester and flag warning.
  const yearMatch = cleanDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (yearMatch) {
    const y = parseInt(yearMatch[1], 10);
    const m = parseInt(yearMatch[2], 10);

    // Check if date falls inside the configured calendar year's span (e.g. gap between HK1 and HK2, or shortly before/after)
    for (const cfg of orderedConfigs) {
      const { startYear, endYear } = parseAcademicYears(cfg.academicYear);
      // Between HK1 end and HK2 start
      if (cleanDate > cfg.hk1End && cleanDate < cfg.hk2Start) {
        return {
          academicYear: cfg.academicYear,
          semester: 'HK1',
          isWithinConfiguredRange: false,
          matchedConfig: cfg,
        };
      }
      // Shortly before HK1 start in same academic year (e.g. Aug of startYear)
      if (cleanDate >= `${startYear}-07-01` && cleanDate < cfg.hk1Start) {
        return {
          academicYear: cfg.academicYear,
          semester: 'HK1',
          isWithinConfiguredRange: false,
          matchedConfig: cfg,
        };
      }
      // Shortly after HK2 end in same academic year (e.g. June of endYear)
      if (cleanDate > cfg.hk2End && cleanDate <= `${endYear}-06-30`) {
        return {
          academicYear: cfg.academicYear,
          semester: 'HK2',
          isWithinConfiguredRange: false,
          matchedConfig: cfg,
        };
      }
    }

    const inferredStartYear = m >= 8 ? y : y - 1;
    const inferredYear = `${inferredStartYear} - ${inferredStartYear + 1}`;
    const inferredSem: SemesterKey = m >= 8 || m === 1 ? 'HK1' : 'HK2';
    const matchedConfig = configs.find((c) => c.academicYear === inferredYear);

    return {
      academicYear: inferredYear,
      semester: inferredSem,
      isWithinConfiguredRange: false,
      matchedConfig,
    };
  }

  const activeConfig = getSemesterConfigForYear(activeYear, settings);
  return {
    academicYear: activeYear,
    semester: 'HK1',
    isWithinConfiguredRange: false,
    matchedConfig: activeConfig,
  };
}

/**
 * Resolve an existing DisciplineEvent's academicYear & semester.
 * Respects stored academicYear/semester if valid; otherwise infers from date and configured calendar.
 */
export function resolveEventPeriod(
  ev: DisciplineEvent,
  settings?: Partial<AppSettings>
): { academicYear: string; semester: SemesterKey } {
  if (ev.academicYear && (ev.semester === 'HK1' || ev.semester === 'HK2')) {
    return {
      academicYear: normalizeAcademicYear(ev.academicYear),
      semester: ev.semester,
    };
  }
  const resolved = resolveDateToSemester(ev.date, settings);
  return {
    academicYear: resolved.academicYear,
    semester: resolved.semester,
  };
}

/**
 * Determine which semester is currently active based on settings.academicYear and configured start/end dates.
 * Transition from HK1 -> HK2 occurs automatically once date reaches configured hk2Start.
 */
export function getActiveSemesterPeriod(
  settings?: Partial<AppSettings>,
  referenceDateStr?: string
): ActiveSemesterPeriod {
  const refDate = (referenceDateStr || toLocalDateString()).slice(0, 10);
  const activeYear = normalizeAcademicYear(settings?.academicYear);
  const config = getSemesterConfigForYear(activeYear, settings);

  if (refDate >= config.hk2Start && refDate <= config.hk2End) {
    return {
      academicYear: config.academicYear,
      semester: 'HK2',
      config,
      isWithinConfiguredRange: true,
    };
  }

  if (refDate >= config.hk1Start && refDate <= config.hk1End) {
    return {
      academicYear: config.academicYear,
      semester: 'HK1',
      config,
      isWithinConfiguredRange: true,
    };
  }

  if (refDate > config.hk2End) {
    return {
      academicYear: config.academicYear,
      semester: 'HK2',
      config,
      isWithinConfiguredRange: false,
    };
  }

  if (refDate > config.hk1End && refDate < config.hk2Start) {
    return {
      academicYear: config.academicYear,
      semester: 'HK1',
      config,
      isWithinConfiguredRange: false,
    };
  }

  // Before HK1 starts
  return {
    academicYear: config.academicYear,
    semester: 'HK1',
    config,
    isWithinConfiguredRange: false,
  };
}

/**
 * List all academic years present in settings or recorded discipline events (sorted newest first for dropdowns).
 */
export function getAvailableAcademicYears(
  settings?: Partial<AppSettings>,
  events: DisciplineEvent[] = []
): string[] {
  const years = new Set<string>();
  const configs = getSemesterConfigs(settings);
  configs.forEach((c) => years.add(c.academicYear));
  if (settings?.academicYear) {
    years.add(normalizeAcademicYear(settings.academicYear));
  }
  for (const ev of events) {
    const resolved = resolveEventPeriod(ev, settings);
    years.add(resolved.academicYear);
  }
  return Array.from(years).sort((a, b) => b.localeCompare(a));
}

/**
 * Deduplicate events by id so each event is strictly counted once.
 */
export function deduplicateDisciplineEvents(events: DisciplineEvent[]): DisciplineEvent[] {
  const seenIds = new Set<string>();
  const result: DisciplineEvent[] = [];
  for (const ev of events || []) {
    if (ev.id) {
      if (seenIds.has(ev.id)) continue;
      seenIds.add(ev.id);
    }
    result.push(ev);
  }
  return result;
}

/**
 * Calculate discipline score for a generic date/month filter with explicit base points.
 */
export function calculateDisciplineScore(
  studentId: string,
  events: DisciplineEvent[],
  basePoints: number,
  periodFilter?: string | DateRangeFilter // format: 'YYYY-MM' | 'all' | { startDate, endDate }
): DisciplineScoreResult {
  const studentEvents = deduplicateDisciplineEvents(events).filter(
    (e) => e.studentId === studentId
  );

  const filteredEvents = studentEvents.filter((e) => {
    if (!periodFilter || periodFilter === 'all') return true;

    if (typeof periodFilter === 'string') {
      return (e.date || '').startsWith(periodFilter);
    }

    const evDate = (e.date || '').slice(0, 10);
    if (!evDate) return false;

    if (periodFilter.startDate && evDate < periodFilter.startDate) return false;
    if (periodFilter.endDate && evDate > periodFilter.endDate) return false;

    return true;
  });

  filteredEvents.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

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

  const totalScore = basePoints + positivePoints - negativePoints;

  return {
    basePoints,
    totalScore,
    deltaPoints,
    positivePoints,
    negativePoints,
    positiveCount,
    negativeCount,
    filteredEvents,
  };
}

/**
 * Calculate independent per-semester discipline score using 200 initial points for that semester.
 * Formula: Diem thi dua hoc ky = 200 + Tong diem thuong trong hoc ky - Tong diem tru trong hoc ky.
 */
export function calculateSemesterDisciplineScore(
  studentId: string,
  events: DisciplineEvent[],
  academicYear: string,
  semester: SemesterKey,
  settings?: Partial<AppSettings>,
  monthFilter?: string // optional 'YYYY-MM' or 'all'
): DisciplineScoreResult {
  const basePoints = getSemesterBasePoints(settings);
  const normYear = normalizeAcademicYear(academicYear);

  const deduped = deduplicateDisciplineEvents(events);
  const filteredEvents = deduped.filter((ev) => {
    if (ev.studentId !== studentId) return false;
    const period = resolveEventPeriod(ev, settings);
    if (period.academicYear !== normYear || period.semester !== semester) return false;
    if (monthFilter && monthFilter !== 'all') {
      return (ev.date || '').startsWith(monthFilter);
    }
    return true;
  });

  filteredEvents.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

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

  const totalScore = basePoints + positivePoints - negativePoints;

  return {
    basePoints,
    totalScore,
    deltaPoints,
    positivePoints,
    negativePoints,
    positiveCount,
    negativeCount,
    filteredEvents,
  };
}

/**
 * Calculate independent HK1 and HK2 summaries for an entire academic year (never combines 200+200 into 400).
 */
export function calculateFullYearDisciplineSummary(
  studentId: string,
  events: DisciplineEvent[],
  academicYear: string,
  settings?: Partial<AppSettings>
): {
  academicYear: string;
  hk1: DisciplineScoreResult;
  hk2: DisciplineScoreResult;
  combinedEvents: (DisciplineEvent & { resolvedSemester: SemesterKey })[];
} {
  const normYear = normalizeAcademicYear(academicYear);
  const hk1 = calculateSemesterDisciplineScore(studentId, events, normYear, 'HK1', settings);
  const hk2 = calculateSemesterDisciplineScore(studentId, events, normYear, 'HK2', settings);

  const combinedEvents = [
    ...hk1.filteredEvents.map((ev) => ({ ...ev, resolvedSemester: 'HK1' as SemesterKey })),
    ...hk2.filteredEvents.map((ev) => ({ ...ev, resolvedSemester: 'HK2' as SemesterKey })),
  ].sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  return {
    academicYear: normYear,
    hk1,
    hk2,
    combinedEvents,
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
