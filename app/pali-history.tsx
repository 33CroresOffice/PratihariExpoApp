import { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useOffline } from '@/contexts/OfflineContext';
import { hydrateFromCache, writeCache } from '@/lib/cachedQuery';
import { OfflineBanner } from '@/components/OfflineBanner';
import { useDrawer, DrawerPanel, MenuButton } from '@/components/SlideDrawer';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  ArrowLeft,
  CalendarDays,
  Clock,
  Timer,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react-native';

const C = {
  saffron: '#E8732A',
  gold: '#D4A843',
  cream: '#FFF8F0',
  warmWhite: '#FFFDF9',
  textPrimary: '#2D1810',
  textSecondary: '#6B4C3B',
  textMuted: '#9B8578',
  border: '#E8D5C4',
  error: '#C0392B',
  green: '#1A7A6A',
  greenLight: '#E8F5F2',
  maroon: '#B8294A',
};

const DAYS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS_EN = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

type HistoryEntry = {
  id: string;
  service_date: string;
  seba_name: string;
  beddha_number: number | null;
  is_absent: boolean;
  started_at: string | null;
  ended_at: string | null;
  duration_minutes: number | null;
  duration_seconds: number | null;
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-IN', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  });
}

function formatTime(ts: string) {
  return new Date(ts).toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

function formatDuration(seconds: number) {
  if (seconds < 60) return `${seconds}s`;
  const totalMinutes = Math.floor(seconds / 60);
  if (totalMinutes < 60) {
    const s = seconds % 60;
    return s > 0 ? `${totalMinutes}m ${s}s` : `${totalMinutes}m`;
  }
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatDurationFromMinutes(minutes: number) {
  return formatDuration(minutes * 60);
}

function totalSecondsDisplay(totalSeconds: number) {
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const m = Math.floor(totalSeconds / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem > 0 ? `${h}h ${rem}m` : `${h}h`;
}

function todayIso() {
  return new Date().toISOString().split('T')[0];
}

function isoDate(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export default function PaliHistoryScreen() {
  const drawer = useDrawer();
  const { user, profileStatus, profileStatusLoading } = useAuth();
  const { isOnline, offlineEnabled } = useOffline();
  const router = useRouter();
  const { t, language } = useLanguage();
  const DAYS = language === 'or'
    ? ['ରବି', 'ସୋମ', 'ମଙ୍ଗଳ', 'ବୁଧ', 'ଗୁରୁ', 'ଶୁକ୍ର', 'ଶନି']
    : DAYS_EN;
  const MONTHS = language === 'or'
    ? ['ଜାନୁଆରୀ', 'ଫେବ୍ରୁଆରୀ', 'ମାର୍ଚ୍ଚ', 'ଏପ୍ରିଲ', 'ମଇ', 'ଜୁନ', 'ଜୁଲାଇ', 'ଅଗଷ୍ଟ', 'ସେପ୍ଟେମ୍ବର', 'ଅକ୍ଟୋବର', 'ନଭେମ୍ବର', 'ଡିସେମ୍ବର']
    : MONTHS_EN;

  if (!profileStatusLoading && profileStatus !== 'approved') {
    router.replace('/(tabs)');
    return null;
  }
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [sebayatId, setSebayatId] = useState<string | null>(null);
  const [showCal, setShowCal] = useState(false);

  const today = todayIso();
  const todayDate = new Date();
  const [calYear, setCalYear] = useState(todayDate.getFullYear());
  const [calMonth, setCalMonth] = useState(todayDate.getMonth());

  // Date range — default to today for both
  const [dateFrom, setDateFrom] = useState<string>(today);
  const [dateTo, setDateTo] = useState<string>(today);
  // Which end of range is being picked: 'from' = first tap, 'to' = second tap
  const [rangePicking, setRangePicking] = useState<'from' | 'to'>('from');

  useEffect(() => {
    if (!user) return;
    (async () => {
      if (offlineEnabled) {
        const res = await hydrateFromCache<HistoryEntry[]>(user.id, 'pali_history', setHistory);
        if (res.cachedAt) setLoading(false);
      }
      if (isOnline) fetchSebayatId();
      else setLoading(false);
    })();
  }, [user, isOnline]);
  useEffect(() => { if (sebayatId && isOnline) fetchHistory(sebayatId); }, [sebayatId, isOnline]);

  async function fetchSebayatId() {
    const res1 = await supabase.from('sebayats').select('id').eq('auth_user_id', user!.id).maybeSingle();
    if (res1.data) { setSebayatId(res1.data.id); return; }
    const res2 = await supabase.from('sebayats').select('id').eq('id', user!.id).maybeSingle();
    if (res2.data) setSebayatId(res2.data.id);
  }

  async function fetchHistory(sid: string) {
    const [sessionResult, rosterResult] = await Promise.all([
      supabase
        .from('seba_sessions')
        .select('id, roster_id, seba_category_id, service_date, started_at, ended_at, duration_minutes, duration_seconds, beddha_number, seba_categories(name)')
        .eq('sebayat_id', sid)
        .not('ended_at', 'is', null)
        .lte('service_date', today)
        .order('started_at', { ascending: false }),
      supabase
        .from('seba_roster')
        .select('id, beddha_number, is_absent, seba_category_id, seba_schedule!inner(service_date), seba_categories!inner(name)')
        .eq('sebayat_id', sid)
        .lte('seba_schedule.service_date', today)
        .order('service_date', { referencedTable: 'seba_schedule', ascending: false })
        .limit(200),
    ]);

    const rosterByDateCat = new Map<string, any>();
    for (const r of (rosterResult.data ?? []) as any[]) {
      const key = `${r.seba_schedule.service_date}__${r.seba_category_id}`;
      if (!rosterByDateCat.has(key)) rosterByDateCat.set(key, r);
    }

    // Latest completed session per (service_date, seba_category_id)
    const latestByDateCat = new Map<string, any>();
    for (const s of (sessionResult.data ?? []) as any[]) {
      const key = `${s.service_date}__${s.seba_category_id}`;
      const ex = latestByDateCat.get(key);
      if (!ex || s.started_at > ex.started_at) latestByDateCat.set(key, s);
    }

    // Absent-only roster entries with no session
    const absentOnlyEntries: HistoryEntry[] = [];
    for (const r of (rosterResult.data ?? []) as any[]) {
      if (!r.is_absent) continue;
      const key = `${r.seba_schedule.service_date}__${r.seba_category_id}`;
      if (!latestByDateCat.has(key)) {
        absentOnlyEntries.push({
          id: r.id,
          service_date: r.seba_schedule.service_date,
          seba_name: r.seba_categories.name,
          beddha_number: r.beddha_number ?? null,
          is_absent: true,
          started_at: null,
          ended_at: null,
          duration_minutes: null,
          duration_seconds: null,
        });
      }
    }

    const sessionEntries: HistoryEntry[] = [...latestByDateCat.values()].map((s) => {
      const key = `${s.service_date}__${s.seba_category_id}`;
      const roster = rosterByDateCat.get(key);
      const beddha = s.beddha_number ?? roster?.beddha_number ?? null;
      // Prefer stored duration_seconds; fall back to computing from timestamps; then from minutes
      let durSec: number | null = s.duration_seconds ?? null;
      if (durSec == null && s.started_at && s.ended_at) {
        durSec = Math.floor((new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 1000);
      }
      if (durSec == null && s.duration_minutes != null) {
        durSec = s.duration_minutes * 60;
      }
      return {
        id: s.id,
        service_date: s.service_date,
        seba_name: s.seba_categories?.name ?? '—',
        beddha_number: beddha,
        is_absent: roster?.is_absent ?? false,
        started_at: s.started_at,
        ended_at: s.ended_at,
        duration_minutes: s.duration_minutes,
        duration_seconds: durSec,
      };
    });

    const all = [...sessionEntries, ...absentOnlyEntries].sort(
      (a, b) => b.service_date.localeCompare(a.service_date)
    );

    setHistory(all);
    if (offlineEnabled && user) await writeCache(user.id, 'pali_history', all);
    setLoading(false);
  }

  const datesWithDuty = useMemo(() => {
    const s = new Set<string>();
    for (const h of history) s.add(h.service_date);
    return s;
  }, [history]);

  const displayedHistory = useMemo(() => {
    const from = dateFrom || null;
    const to = dateTo || null;
    if (!from && !to) return history;
    return history.filter((h) => {
      if (from && h.service_date < from) return false;
      if (to && h.service_date > to) return false;
      return true;
    });
  }, [history, dateFrom, dateTo]);

  // Stats derived from the filtered range
  const filteredCompleted = useMemo(
    () => displayedHistory.filter((h) => !h.is_absent && (h.duration_seconds != null || h.duration_minutes != null)),
    [displayedHistory]
  );
  const filteredTotalSeconds = useMemo(
    () => filteredCompleted.reduce((acc, h) => {
      if (h.duration_seconds != null) return acc + h.duration_seconds;
      if (h.duration_minutes != null) return acc + h.duration_minutes * 60;
      return acc;
    }, 0),
    [filteredCompleted]
  );

  // ── Calendar ────────────────────────────────────────────────

  function prevMonth() {
    if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11); }
    else setCalMonth(m => m - 1);
  }
  function nextMonth() {
    if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0); }
    else setCalMonth(m => m + 1);
  }

  function buildCalendarDays() {
    const firstDow = new Date(calYear, calMonth, 1).getDay();
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const cells: (number | null)[] = [];
    for (let i = 0; i < firstDow; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    return cells;
  }

  function handleDayPress(iso: string) {
    if (rangePicking === 'from') {
      setDateFrom(iso);
      setDateTo(iso);
      setRangePicking('to');
    } else {
      if (iso < dateFrom) {
        // tapped before the start — restart range
        setDateFrom(iso);
        setDateTo(iso);
        setRangePicking('to');
      } else {
        setDateTo(iso);
        setRangePicking('from');
        setShowCal(false);
      }
    }
  }

  function renderCalendar() {
    const cells = buildCalendarDays();

    return (
      <View style={styles.calendarWrap}>
        {/* Range hint */}
        <View style={styles.calRangeHint}>
          <Text style={styles.calRangeHintText}>
            {rangePicking === 'from' ? t('paliHistory.tapStartDate') : t('paliHistory.tapEndDate')}
          </Text>
        </View>

        <View style={styles.calNav}>
          <TouchableOpacity onPress={prevMonth} style={styles.calNavBtn} activeOpacity={0.7}>
            <ChevronLeft color={C.textPrimary} size={20} />
          </TouchableOpacity>
          <Text style={styles.calMonthLabel}>{MONTHS[calMonth]} {calYear}</Text>
          <TouchableOpacity onPress={nextMonth} style={styles.calNavBtn} activeOpacity={0.7}>
            <ChevronRight color={C.textPrimary} size={20} />
          </TouchableOpacity>
        </View>

        <View style={styles.calDayHeaders}>
          {DAYS.map(d => (
            <Text key={d} style={styles.calDayHeader}>{d}</Text>
          ))}
        </View>

        <View style={styles.calGrid}>
          {cells.map((day, idx) => {
            if (day === null) return <View key={`e-${idx}`} style={styles.calCell} />;
            const iso = isoDate(calYear, calMonth, day);
            const hasDuty = datesWithDuty.has(iso);
            const isToday = iso === today;
            const isStart = iso === dateFrom;
            const isEnd = iso === dateTo;
            const inRange = dateFrom && dateTo && iso > dateFrom && iso < dateTo;
            const isSelected = isStart || isEnd;
            const dutyOnDay = history.filter(h => h.service_date === iso);
            const hasAbsent = dutyOnDay.some(h => h.is_absent);
            const hasCompleted = dutyOnDay.some(h => h.ended_at);
            const dotColor = (hasAbsent && !hasCompleted) ? C.error : C.green;

            return (
              <TouchableOpacity
                key={iso}
                style={[
                  styles.calCell,
                  isSelected && styles.calCellSelected,
                  isToday && !isSelected && styles.calCellToday,
                  inRange && styles.calCellInRange,
                ]}
                onPress={() => handleDayPress(iso)}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.calDayNum,
                  isSelected && styles.calDayNumSelected,
                  isToday && !isSelected && styles.calDayNumToday,
                  inRange && styles.calDayNumInRange,
                ]}>
                  {day}
                </Text>
                {hasDuty && <View style={[styles.calDot, { backgroundColor: isSelected ? '#fff' : dotColor }]} />}
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.calLegend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: C.green }]} />
            <Text style={styles.legendText}>{t('paliHistory.dutyRecorded')}</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: C.error }]} />
            <Text style={styles.legendText}>{t('paliHistory.absent')}</Text>
          </View>
        </View>
      </View>
    );
  }

  // ── Card renderer ────────────────────────────────────────────

  function renderItem({ item }: { item: HistoryEntry }) {
    const hasSession = item.started_at != null;
    const isCompleted = !!item.ended_at;
    const isAbsent = item.is_absent;

    const accentColor = isAbsent ? C.error : isCompleted ? C.green : C.saffron;
    const statusLabel = isAbsent ? t('paliHistory.absent') : isCompleted ? t('paliHistory.done') : t('paliHistory.inProgress');
    const statusBg = isAbsent ? '#FFF0F0' : isCompleted ? '#EAF6F3' : '#FFF6EE';
    const statusTextColor = isAbsent ? C.error : isCompleted ? C.green : C.saffron;

    return (
      <View style={styles.card}>
        {/* Left accent bar */}
        <View style={[styles.cardAccent, { backgroundColor: accentColor }]} />

        <View style={styles.cardBody}>
          {/* Top row: seba name + status badge */}
          <View style={styles.cardTopRow}>
            <Text style={styles.cardSebaName}>{item.seba_name}</Text>
            <View style={[styles.statusPill, { backgroundColor: statusBg }]}>
              <Text style={[styles.statusPillText, { color: statusTextColor }]}>{statusLabel}</Text>
            </View>
          </View>

          {/* Beddha row */}
          {item.beddha_number != null && (
            <View style={styles.cardBeddhaRow}>
              <View style={styles.beddhaChip}>
                <Text style={styles.beddhaChipText}>{t('paliHistory.beddha')} {item.beddha_number}</Text>
              </View>
            </View>
          )}

          {/* Time row */}
          {hasSession ? (
            <View style={styles.cardTimeRow}>
              <View style={styles.timeItem}>
                <Clock color={C.green} size={12} strokeWidth={2.5} />
                <Text style={styles.timeLabel}>{t('paliHistory.start')}</Text>
                <Text style={styles.timeValue}>{formatTime(item.started_at!)}</Text>
              </View>
              {item.ended_at && (
                <>
                  <View style={styles.timeSep} />
                  <View style={styles.timeItem}>
                    <Clock color={C.error} size={12} strokeWidth={2.5} />
                    <Text style={styles.timeLabel}>{t('paliHistory.end')}</Text>
                    <Text style={styles.timeValue}>{formatTime(item.ended_at)}</Text>
                  </View>
                </>
              )}
              {(item.duration_seconds != null || item.duration_minutes != null) && (
                <>
                  <View style={styles.timeSep} />
                  <View style={styles.timeItem}>
                    <Timer color={C.gold} size={12} strokeWidth={2.5} />
                    <Text style={[styles.timeValue, { color: C.gold, fontFamily: 'Poppins_700Bold' }]}>
                      {formatDuration(item.duration_seconds ?? (item.duration_minutes! * 60))}
                    </Text>
                  </View>
                </>
              )}
            </View>
          ) : !isAbsent ? (
            <Text style={styles.noRecordText}>{t('paliHistory.timingNotRecorded')}</Text>
          ) : null}
        </View>
      </View>
    );
  }

  // ── Main render ──────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container}>
      <OfflineBanner />
      <LinearGradient colors={['#B8294A', '#8A1F36']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <ArrowLeft color="#fff" size={22} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <CalendarDays color="rgba(255,255,255,0.85)" size={20} />
          <Text style={styles.headerTitle}>{t('paliHistory.title')}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {!loading && (
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>{history.length}</Text>
            </View>
          )}
          <MenuButton onPress={drawer.open} />
        </View>
      </LinearGradient>

      <View style={styles.contentWrapper}>
      {loading ? (
        <View style={styles.loadingWrap}><ActivityIndicator color={C.saffron} size="large" /></View>
      ) : (
        <FlatList
          data={displayedHistory}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <>
              {/* Date range filter bar — TOP */}
              <View style={styles.dateRangeWrap}>
                <TouchableOpacity
                  style={[styles.dateRangeField, rangePicking === 'from' && showCal && styles.dateRangeFieldActive]}
                  onPress={() => { setRangePicking('from'); setShowCal(true); }}
                  activeOpacity={0.8}
                >
                  <CalendarDays color={C.maroon} size={13} />
                  <View>
                    <Text style={styles.dateRangeFieldLabel}>{t('paliHistory.from')}</Text>
                    <Text style={styles.dateRangeFieldValue}>
                      {dateFrom === today ? t('paliHistory.today') : dateFrom ? formatDate(dateFrom) : t('paliHistory.select')}
                    </Text>
                  </View>
                </TouchableOpacity>

                <View style={styles.dateRangeSep}>
                  <ChevronRight color={C.textMuted} size={16} />
                </View>

                <TouchableOpacity
                  style={[styles.dateRangeField, rangePicking === 'to' && showCal && styles.dateRangeFieldActive]}
                  onPress={() => { setRangePicking('to'); setShowCal(true); }}
                  activeOpacity={0.8}
                >
                  <CalendarDays color={C.maroon} size={13} />
                  <View>
                    <Text style={styles.dateRangeFieldLabel}>{t('paliHistory.to')}</Text>
                    <Text style={styles.dateRangeFieldValue}>
                      {dateTo === today ? t('paliHistory.today') : dateTo ? formatDate(dateTo) : t('paliHistory.select')}
                    </Text>
                  </View>
                </TouchableOpacity>

                {(dateFrom !== today || dateTo !== today) && (
                  <TouchableOpacity
                    style={styles.dateRangeClear}
                    onPress={() => { setDateFrom(today); setDateTo(today); setShowCal(false); setRangePicking('from'); setCalYear(todayDate.getFullYear()); setCalMonth(todayDate.getMonth()); }}
                    activeOpacity={0.7}
                  >
                    <X color={C.textMuted} size={15} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Inline calendar */}
              {showCal && renderCalendar()}

              {/* Stats card — updates based on filtered range */}
              {history.length > 0 && (
                <View style={styles.summaryStrip}>
                  <View style={styles.summaryItem}>
                    <TrendingUp color={C.saffron} size={18} />
                    <Text style={styles.summaryValue}>{displayedHistory.length}</Text>
                    <Text style={styles.summaryLabel}>{t('paliHistory.totalDuties')}</Text>
                  </View>
                  <View style={styles.summaryDivider} />
                  <View style={styles.summaryItem}>
                    <Timer color={C.green} size={18} />
                    <Text style={styles.summaryValue}>{filteredCompleted.length}</Text>
                    <Text style={styles.summaryLabel}>{t('paliHistory.recorded')}</Text>
                  </View>
                  <View style={styles.summaryDivider} />
                  <View style={styles.summaryItem}>
                    <Clock color={C.gold} size={18} />
                    <Text style={styles.summaryValue}>{totalSecondsDisplay(filteredTotalSeconds)}</Text>
                    <Text style={styles.summaryLabel}>{t('paliHistory.hoursServed')}</Text>
                  </View>
                </View>
              )}

              {history.length > 0 && (
                <View style={styles.sectionLabelRow}>
                  <Text style={styles.sectionLabel}>{t('paliHistory.entry', { count: displayedHistory.length })}</Text>
                </View>
              )}
            </>
          }
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <CalendarDays color={C.textMuted} size={48} />
              <Text style={styles.emptyTitle}>{(dateFrom || dateTo) ? t('paliHistory.noDutiesRange') : t('paliHistory.noDutiesFound')}</Text>
              <Text style={styles.emptySubtitle}>{(dateFrom || dateTo) ? t('paliHistory.tryDifferentRange') : t('paliHistory.dutiesWillAppear')}</Text>
            </View>
          }
          contentContainerStyle={styles.listContent}
        />
      )}
      </View>{/* end contentWrapper */}
      <DrawerPanel {...drawer} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.warmWhite },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 52, gap: 10,
  },
  contentWrapper: { backgroundColor: '#FFFDF9', borderTopLeftRadius: 32, borderTopRightRadius: 32, marginTop: -28, flex: 1 },
  backBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center',
  },
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 18, fontFamily: 'Poppins_700Bold', color: '#fff' },
  viewToggle: {
    flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 10, padding: 3, gap: 2,
  },
  toggleBtn: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  toggleBtnActive: { backgroundColor: '#fff' },
  countBadge: {
    backgroundColor: '#fff', borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 4, minWidth: 34, alignItems: 'center',
  },
  countBadgeText: { fontSize: 14, fontFamily: 'Poppins_700Bold', color: C.maroon },

  listContent: { paddingHorizontal: 16, paddingBottom: 32 },

  summaryStrip: {
    flexDirection: 'row', backgroundColor: '#fff',
    marginTop: 16, marginBottom: 4, borderRadius: 14,
    paddingVertical: 14, paddingHorizontal: 8,
    borderWidth: 1, borderColor: C.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  summaryItem: { flex: 1, alignItems: 'center', gap: 3 },
  summaryDivider: { width: 1, backgroundColor: C.border, marginVertical: 4 },
  summaryValue: { fontSize: 20, fontFamily: 'Poppins_700Bold', color: C.textPrimary },
  summaryLabel: {
    fontSize: 10, fontFamily: 'Poppins_400Regular', color: C.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },

  // Date range bar
  dateRangeWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', marginTop: 10, borderRadius: 14,
    borderWidth: 1, borderColor: C.border,
    overflow: 'hidden',
  },
  dateRangeField: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 12, paddingVertical: 10,
  },
  dateRangeFieldActive: { backgroundColor: C.maroon + '0D' },
  dateRangeFieldLabel: {
    fontSize: 10, fontFamily: 'Poppins_400Regular', color: C.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  dateRangeFieldValue: {
    fontSize: 12, fontFamily: 'Poppins_600SemiBold', color: C.textPrimary,
  },
  dateRangeSep: { paddingHorizontal: 2 },
  dateRangeClear: {
    paddingHorizontal: 12, paddingVertical: 10,
    borderLeftWidth: 1, borderLeftColor: C.border,
  },

  // Calendar range styles
  calRangeHint: {
    alignItems: 'center', paddingVertical: 6, marginBottom: 2,
  },
  calRangeHintText: {
    fontSize: 12, fontFamily: 'Poppins_600SemiBold',
    color: C.maroon,
  },
  calCellInRange: { backgroundColor: C.maroon + '15', borderRadius: 0 },
  calDayNumInRange: { color: C.maroon },

  sectionLabelRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end',
    marginTop: 10, marginBottom: 2,
  },
  sectionLabel: {
    fontSize: 11, fontFamily: 'Poppins_400Regular', color: C.textMuted,
  },

  // Calendar
  calendarWrap: {
    backgroundColor: '#fff', borderRadius: 16, marginTop: 12, marginBottom: 4,
    paddingHorizontal: 12, paddingTop: 14, paddingBottom: 10,
    borderWidth: 1, borderColor: C.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 6, elevation: 3,
  },
  calNav: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 14,
  },
  calNavBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: C.cream, alignItems: 'center', justifyContent: 'center',
  },
  calMonthLabel: { fontSize: 15, fontFamily: 'Poppins_700Bold', color: C.textPrimary },
  calDayHeaders: { flexDirection: 'row', marginBottom: 6 },
  calDayHeader: {
    flex: 1, textAlign: 'center', fontSize: 10,
    fontFamily: 'Poppins_600SemiBold', color: C.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.4,
  },
  calGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calCell: {
    width: `${100 / 7}%` as any, aspectRatio: 1,
    alignItems: 'center', justifyContent: 'center',
    borderRadius: 10, marginVertical: 2,
  },
  calCellSelected: { backgroundColor: C.maroon },
  calCellToday: { backgroundColor: C.cream, borderWidth: 1.5, borderColor: C.maroon },
  calDayNum: { fontSize: 13, fontFamily: 'Poppins_400Regular', color: C.textPrimary },
  calDayNumSelected: { color: '#fff', fontFamily: 'Poppins_700Bold' },
  calDayNumToday: { color: C.maroon, fontFamily: 'Poppins_700Bold' },
  calDot: { width: 5, height: 5, borderRadius: 3, marginTop: 2 },
  calLegend: {
    flexDirection: 'row', gap: 16, marginTop: 12,
    paddingTop: 10, borderTopWidth: 1, borderTopColor: C.border,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, fontFamily: 'Poppins_400Regular', color: C.textMuted },

  // Empty state
  emptyWrap: {
    alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingHorizontal: 40, paddingTop: 48,
  },
  emptyTitle: { fontSize: 16, fontFamily: 'Poppins_600SemiBold', color: C.textSecondary },
  emptySubtitle: {
    fontSize: 13, fontFamily: 'Poppins_400Regular', color: C.textMuted,
    textAlign: 'center', lineHeight: 20,
  },

  // Card
  card: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 14,
    marginBottom: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: C.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardAccent: { width: 4, borderTopLeftRadius: 14, borderBottomLeftRadius: 14 },
  cardBody: { flex: 1, paddingHorizontal: 14, paddingVertical: 12 },
  cardTopRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 6,
  },
  cardSebaName: {
    fontSize: 15, fontFamily: 'Poppins_700Bold',
    color: C.textPrimary, flex: 1, marginRight: 8,
  },
  statusPill: {
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3,
  },
  statusPillText: { fontSize: 11, fontFamily: 'Poppins_600SemiBold' },
  cardBeddhaRow: { flexDirection: 'row', marginBottom: 8 },
  beddhaChip: {
    backgroundColor: '#F5F0EB', borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  beddhaChipText: { fontSize: 11, fontFamily: 'Poppins_600SemiBold', color: C.textSecondary },
  cardTimeRow: {
    flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 0,
    backgroundColor: '#F9F6F2', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  timeItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  timeSep: { width: 1, height: 14, backgroundColor: C.border, marginHorizontal: 10 },
  timeLabel: { fontSize: 11, fontFamily: 'Poppins_400Regular', color: C.textMuted },
  timeValue: { fontSize: 12, fontFamily: 'Poppins_600SemiBold', color: C.textPrimary },
  noRecordText: {
    fontSize: 11, fontFamily: 'Poppins_400Regular',
    color: C.textMuted, fontStyle: 'italic',
  },
});
