import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useOffline } from '@/contexts/OfflineContext';
import { hydrateFromCache, writeCache } from '@/lib/cachedQuery';
import { OfflineBanner } from '@/components/OfflineBanner';
import { formatRelative } from '@/lib/offlineCache';
import { useDrawer, DrawerPanel, MenuButton } from '@/components/SlideDrawer';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatNumber } from '@/lib/i18n';
import { useTranslation } from 'react-i18next';
import {
  Calendar,
  Star,
  Lock,
  Hash,
  ChevronRight,
  ChevronLeft,
  List,
  CalendarDays,
  X,
  Search,
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
  success: '#27AE60',
};

const PAGE_SIZE = 5;
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

type MyPali = {
  service_date: string;
  seba_name: string;
  seba_name_or: string | null;
  group_name: string;
  group_name_or: string | null;
  beddha_number: number;
  is_nijog: boolean;
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  return {
    weekday: d.toLocaleDateString('en-IN', { weekday: 'short' }),
    day: d.getDate(),
    month: d.toLocaleDateString('en-IN', { month: 'short' }),
    year: d.getFullYear(),
  };
}

function isToday(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toDateString() === new Date().toDateString();
}

function isPast(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d < today;
}

function GoToDateModal({
  visible, onClose, onGo,
}: {
  visible: boolean;
  onClose: () => void;
  onGo: (year: number, month: number) => void;
}) {
  const now = new Date();
  const [inputYear, setInputYear] = useState(String(now.getFullYear()));
  const [inputMonth, setInputMonth] = useState(now.getMonth());
  const [error, setError] = useState('');
  const { t, i18n } = useTranslation();
  const isOdia = i18n.language === 'or';
  const odiaFont = isOdia ? { fontFamily: 'NotoSansOriya_400Regular' as const } : {};
  const MONTHS_LOC: string[] = t('schedule.months', { returnObjects: true }) as any;

  function handleGo() {
    const y = parseInt(inputYear, 10);
    if (isNaN(y) || y < 2000 || y > 2100) {
      setError(t('schedule.invalidYear'));
      return;
    }
    setError('');
    onGo(y, inputMonth);
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={modalStyles.backdrop} onPress={onClose}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable style={modalStyles.sheet} onPress={() => {}}>
            <View style={modalStyles.header}>
              <Text style={[modalStyles.headerTitle, odiaFont]}>{t('schedule.goToDate')}</Text>
              <TouchableOpacity onPress={onClose} style={modalStyles.closeBtn} activeOpacity={0.7}>
                <X color={C.textSecondary} size={20} />
              </TouchableOpacity>
            </View>

            <Text style={[modalStyles.label, odiaFont]}>{t('schedule.month')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={modalStyles.monthScroll} contentContainerStyle={modalStyles.monthScrollContent}>
              {MONTHS_LOC.map((m, i) => (
                <TouchableOpacity
                  key={m}
                  style={[modalStyles.monthChip, inputMonth === i && modalStyles.monthChipActive]}
                  onPress={() => setInputMonth(i)}
                  activeOpacity={0.7}
                >
                  <Text style={[modalStyles.monthChipText, inputMonth === i && modalStyles.monthChipTextActive]}>
                    {m.slice(0, 3)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={[modalStyles.label, odiaFont]}>{t('schedule.year')}</Text>
            <TextInput
              style={[modalStyles.yearInput, error ? modalStyles.yearInputError : null]}
              value={inputYear}
              onChangeText={(t) => { setInputYear(t); setError(''); }}
              keyboardType="number-pad"
              maxLength={4}
              placeholder={t('schedule.yearPlaceholder')}
              placeholderTextColor={C.textMuted}
            />
            {error ? <Text style={modalStyles.errorText}>{error}</Text> : null}

            <TouchableOpacity style={modalStyles.goBtn} onPress={handleGo} activeOpacity={0.85}>
              <Search color="#fff" size={16} />
              <Text style={[modalStyles.goBtnText, odiaFont]}>{t('schedule.goToDate')} {MONTHS_LOC[inputMonth]} {inputYear}</Text>
            </TouchableOpacity>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

function DutyDetailModal({
  duties,
  dateStr,
  onClose,
}: {
  duties: MyPali[];
  dateStr: string | null;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const isOdia = i18n.language === 'or';
  const odiaFont = isOdia ? { fontFamily: 'NotoSansOriya_400Regular' as const } : {};
  const DAYS_LOC: string[] = t('schedule.days', { returnObjects: true }) as any;
  const MONTHS_LOC: string[] = t('schedule.months', { returnObjects: true }) as any;
  if (!dateStr || duties.length === 0) return null;
  const dateObj = new Date(dateStr + 'T00:00:00');
  const label = isOdia
    ? `${DAYS_LOC[dateObj.getDay()]}, ${formatNumber(dateObj.getDate(), 'or')} ${MONTHS_LOC[dateObj.getMonth()]} ${formatNumber(dateObj.getFullYear(), 'or')}`
    : dateObj.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  return (
    <Modal visible={duties.length > 0 && !!dateStr} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={modalStyles.backdrop} onPress={onClose}>
        <Pressable style={modalStyles.dutySheet} onPress={() => {}}>
          {/* Handle */}
          <View style={modalStyles.handle} />
          <View style={modalStyles.dutyHeader}>
            <View style={modalStyles.dutyHeaderLeft}>
              <CalendarDays color={C.saffron} size={16} />
              <Text style={[modalStyles.dutyHeaderDate, odiaFont]}>{label}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={modalStyles.closeBtn} activeOpacity={0.7}>
              <X color={C.textSecondary} size={20} />
            </TouchableOpacity>
          </View>
          {duties.map((d, i) => {
            const isGochhikar = d.group_name.toLowerCase().includes('gochhikar');
            const accent = isGochhikar ? C.gold : C.saffron;
            const sebaName = isOdia && d.seba_name_or ? d.seba_name_or : d.seba_name;
            const groupName = isOdia && d.group_name_or ? d.group_name_or : d.group_name;
            return (
              <View
                key={i}
                style={[modalStyles.dutyRow, i > 0 && { borderTopWidth: 1, borderTopColor: C.border }]}
              >
                <LinearGradient
                  colors={[accent + '12', accent + '06']}
                  style={modalStyles.dutyRowGradient}
                >
                  <View style={modalStyles.dutyNameRow}>
                    <Text style={[modalStyles.dutySebaName, isOdia ? { fontFamily: 'NotoSansOriya_700Bold' as const } : {}]}>{sebaName}</Text>
                    {d.is_nijog && (
                      <View style={[modalStyles.nijogBadge, { backgroundColor: accent + '20', borderColor: accent + '50' }]}>
                        <Text style={[modalStyles.nijogBadgeText, { color: accent }, odiaFont]}>{t('schedule.nijog')}</Text>
                      </View>
                    )}
                  </View>
                  <View style={modalStyles.dutyMeta}>
                    <View style={[modalStyles.groupChip, { backgroundColor: accent + '20' }]}>
                      <Text style={[modalStyles.groupChipText, { color: accent }]}>{groupName}</Text>
                    </View>
                    <View style={modalStyles.beddhaRow}>
                      <Hash color={accent} size={13} />
                      <Text style={[modalStyles.beddhaText, { color: accent }, odiaFont]}>{t('schedule.beddha')} {formatNumber(d.beddha_number, i18n.language as any)}</Text>
                    </View>
                  </View>
                </LinearGradient>
              </View>
            );
          })}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function CalendarView({ palis }: { palis: MyPali[] }) {
  const { t, i18n } = useTranslation();
  const isOdia = i18n.language === 'or';
  const odiaFont = isOdia ? { fontFamily: 'NotoSansOriya_400Regular' as const } : {};
  const DAYS_LOC: string[] = t('schedule.days', { returnObjects: true }) as any;
  const MONTHS_LOC: string[] = t('schedule.months', { returnObjects: true }) as any;
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showGoTo, setShowGoTo] = useState(false);

  const dutyDateSet = new Set(palis.map((p) => p.service_date));

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
  }
  function goToDate(y: number, m: number) {
    setYear(y);
    setMonth(m);
  }

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayStr = now.toISOString().split('T')[0];

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  function makeDateStr(day: number) {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  const selectedDuties = selectedDate ? palis.filter((p) => p.service_date === selectedDate) : [];

  return (
    <>
      <GoToDateModal
        visible={showGoTo}
        onClose={() => setShowGoTo(false)}
        onGo={goToDate}
      />
      <DutyDetailModal
        duties={selectedDuties}
        dateStr={selectedDate}
        onClose={() => setSelectedDate(null)}
      />

      <View style={calStyles.wrap}>
        {/* Month navigator */}
        <View style={calStyles.nav}>
          <TouchableOpacity onPress={prevMonth} style={calStyles.navBtn} activeOpacity={0.7}>
            <ChevronLeft color={C.textSecondary} size={20} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowGoTo(true)} activeOpacity={0.75}>
            <Text style={[calStyles.navTitle, odiaFont]}>{MONTHS_LOC[month]} {formatNumber(year, i18n.language as any)}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={nextMonth} style={calStyles.navBtn} activeOpacity={0.7}>
            <ChevronRight color={C.textSecondary} size={20} />
          </TouchableOpacity>
        </View>

        {/* Go to date hint */}
        <TouchableOpacity style={calStyles.goToHint} onPress={() => setShowGoTo(true)} activeOpacity={0.7}>
          <Search color={C.textMuted} size={12} />
          <Text style={[calStyles.goToHintText, odiaFont]}>{t('schedule.tapToJump')}</Text>
        </TouchableOpacity>

        {/* Day headers */}
        <View style={calStyles.dayHeaderRow}>
          {DAYS_LOC.map((d) => (
            <Text key={d} style={[calStyles.dayHeader, odiaFont]}>{d}</Text>
          ))}
        </View>

        {/* Grid */}
        <View style={calStyles.grid}>
          {cells.map((day, i) => {
            if (day === null) return <View key={`blank-${i}`} style={calStyles.cell} />;
            const ds = makeDateStr(day);
            const hasDuty = dutyDateSet.has(ds);
            const isTodayCell = ds === todayStr;
            const isSelected = ds === selectedDate;
            return (
              <TouchableOpacity
                key={ds}
                style={[
                  calStyles.cell,
                  isTodayCell && calStyles.cellToday,
                  isSelected && calStyles.cellSelected,
                ]}
                onPress={() => hasDuty ? setSelectedDate(ds) : null}
                activeOpacity={hasDuty ? 0.75 : 1}
              >
                <Text
                  style={[
                    calStyles.cellText,
                    isTodayCell && calStyles.cellTextToday,
                    isSelected && calStyles.cellTextSelected,
                    isOdia && { fontFamily: 'NotoSansOriya_400Regular' as const },
                  ]}
                >
                  {formatNumber(day, i18n.language as any)}
                </Text>
                {hasDuty && (
                  <View style={[calStyles.dutyDot, isSelected && { backgroundColor: '#fff' }]} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Legend */}
        <View style={calStyles.legend}>
          <View style={calStyles.legendItem}>
            <View style={[calStyles.dutyDot, { marginTop: 0 }]} />
            <Text style={[calStyles.legendText, odiaFont]}>{t('schedule.dutyDay')}</Text>
          </View>
        </View>
      </View>
    </>
  );
}

export default function ScheduleScreen() {
  const drawer = useDrawer();
  const router = useRouter();
  const { user, profileStatus, profileStatusLoading } = useAuth();
  const { isOnline, offlineEnabled } = useOffline();
  const { t, language } = useLanguage();
  const isOdia = language === 'or';
  const odiaFont = isOdia ? { fontFamily: 'NotoSansOriya_400Regular' as const } : {};
  const DAYS_LOC: string[] = t('schedule.days', { returnObjects: true }) as any;
  const MONTHS_LOC: string[] = t('schedule.months', { returnObjects: true }) as any;

  if (!profileStatusLoading && profileStatus !== 'approved') {
    router.replace('/(tabs)');
    return null;
  }
  const [loading, setLoading] = useState(true);
  const [approved, setApproved] = useState(false);
  const [myPalis, setMyPalis] = useState<MyPali[]>([]);
  const [showPast, setShowPast] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [calendarMode, setCalendarMode] = useState(false);
  const [syncedAt, setSyncedAt] = useState<number | null>(null);

  useEffect(() => {
    if (user) {
      hydrate().then(() => {
        if (isOnline) checkApprovalAndLoad();
        else setLoading(false);
      });
    }
  }, [user, isOnline]);

  async function hydrate() {
    if (!user || !offlineEnabled) return;
    const res = await hydrateFromCache<MyPali[]>(user.id, 'schedule_5yr', (rows) => {
      setMyPalis(rows);
      setApproved(true);
    });
    if (res.cachedAt) {
      setSyncedAt(res.cachedAt);
      setLoading(false);
    }
  }

  async function checkApprovalAndLoad() {
    if (myPalis.length === 0) setLoading(true);
    let sid: string | null = null;
    let isApproved = false;

    const res1 = await supabase
      .from('sebayats')
      .select('id, profile_status')
      .eq('auth_user_id', user!.id)
      .maybeSingle();

    if (res1.data) {
      sid = res1.data.id;
      isApproved = res1.data.profile_status === 'approved';
    } else {
      const res2 = await supabase
        .from('sebayats')
        .select('id, profile_status')
        .eq('id', user!.id)
        .maybeSingle();
      if (res2.data) {
        sid = res2.data.id;
        isApproved = res2.data.profile_status === 'approved';
      }
    }

    setApproved(isApproved);
    if (isApproved && sid) await fetchMyPalis(sid);
    setLoading(false);
  }

  async function fetchMyPalis(sid: string) {
    const [{ data: selections }, { data: nijogRows }] = await Promise.all([
      supabase
        .from('sebayat_seba_selections')
        .select('beddha_number, seba_categories!inner(name, name_or, group_id, seba_groups!inner(name, name_or, code))')
        .eq('sebayat_id', sid),
      supabase
        .from('nijog_assignments')
        .select('beddha_number, seba_categories!inner(name, name_or, group_id, seba_groups!inner(name, name_or, code))')
        .eq('sebayat_id', sid),
    ]);

    // Merge hereditary + nijog-assigned sebas, dedup by group_id+beddha_number+name
    const seen = new Set<string>();
    const allSelections: any[] = [];
    for (const s of (selections ?? []) as any[]) {
      const key = `${s.seba_categories.group_id}:${s.beddha_number}:${s.seba_categories.name}`;
      if (!seen.has(key)) { seen.add(key); allSelections.push({ ...s, is_nijog: false }); }
    }
    for (const s of (nijogRows ?? []) as any[]) {
      const key = `${s.seba_categories.group_id}:${s.beddha_number}:${s.seba_categories.name}`;
      if (!seen.has(key)) { seen.add(key); allSelections.push({ ...s, is_nijog: true }); }
    }
    if (allSelections.length === 0) return;

    // Build exact (group_id, beddha_number) pair filter — prevents cross-group beddha confusion
    const pairFilter = [...new Set(
      allSelections.map(
        (s) => `and(group_id.eq.${s.seba_categories.group_id},beddha_number.eq.${s.beddha_number})`
      )
    )].join(',');

    // Fetch 5 years future + 2 years past for upcoming + history
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 5);
    const pastDate = new Date();
    pastDate.setFullYear(pastDate.getFullYear() - 2);

    const { data: scheduleRows } = await supabase
      .from('seba_schedule')
      .select('beddha_number, group_id, service_date')
      .gte('service_date', pastDate.toISOString().split('T')[0])
      .lte('service_date', futureDate.toISOString().split('T')[0])
      .or(pairFilter)
      .order('service_date', { ascending: true });

    if (!scheduleRows) return;

    const palis: MyPali[] = [];
    for (const row of scheduleRows as any[]) {
      // All categories for this group+beddha are on duty on this date
      const matching = allSelections.filter(
        (s) => s.seba_categories.group_id === row.group_id && s.beddha_number === row.beddha_number
      );
      for (const sel of matching) {
        palis.push({
          service_date: row.service_date,
          seba_name: sel.seba_categories.name,
          seba_name_or: sel.seba_categories.name_or ?? null,
          group_name: sel.seba_categories.seba_groups.name,
          group_name_or: sel.seba_categories.seba_groups.name_or ?? null,
          beddha_number: row.beddha_number,
          is_nijog: sel.is_nijog,
        });
      }
    }

    setMyPalis(palis);
    if (offlineEnabled && user) await writeCache(user.id, 'schedule_5yr', palis);
    setSyncedAt(Date.now());
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.headerBar}>
          <Text style={[styles.title, odiaFont]}>{t('schedule.title')}</Text>
        </View>
        <View style={styles.centerState}>
          <ActivityIndicator color={C.saffron} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (!approved) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.headerBar}>
          <Text style={[styles.title, odiaFont]}>{t('schedule.title')}</Text>
        </View>
        <View style={styles.centerState}>
          <Lock color={C.textMuted} size={44} />
          <Text style={[styles.emptyTitle, odiaFont]}>{t('schedule.membersOnly')}</Text>
          <Text style={[styles.emptyDescription, odiaFont]}>{t('schedule.membersOnlyDesc')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const upcoming = myPalis.filter((p) => !isPast(p.service_date) || isToday(p.service_date));
  const past = myPalis.filter((p) => isPast(p.service_date) && !isToday(p.service_date));
  const todayEntry = upcoming.find((p) => isToday(p.service_date));

  // Group by date so same-day sebas share one card
  function groupByDate(palis: MyPali[]) {
    const map = new Map<string, MyPali[]>();
    for (const p of palis) {
      const arr = map.get(p.service_date) ?? [];
      arr.push(p);
      map.set(p.service_date, arr);
    }
    return Array.from(map.entries()).map(([date, duties]) => ({ date, duties }));
  }

  const upcomingGroups = groupByDate(upcoming);
  const pastGroups = groupByDate(past);
  // Exclude today from the list — it's already shown in the TODAY banner
  const nonTodayGroups = upcomingGroups.filter(({ date }) => !isToday(date));
  const visibleGroups = nonTodayGroups.slice(0, visibleCount);
  const hasMore = visibleCount < nonTodayGroups.length;

  return (
    <SafeAreaView style={styles.container}>
      <OfflineBanner />
      {/* Header */}
      <LinearGradient
        colors={['#E8732A', '#D4A843']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.headerGradient}
      >
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <Text style={[styles.headerTitle, isOdia && { fontFamily: 'NotoSansOriya_700Bold' }]}>{t('schedule.title')}</Text>
            <Text style={[styles.headerSub, odiaFont]}>
              {!isOnline && syncedAt ? `Offline · ${formatRelative(syncedAt)}` : t('schedule.subtitle')}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TouchableOpacity
              style={styles.viewToggleBtn}
              onPress={() => setCalendarMode((v) => !v)}
              activeOpacity={0.8}
            >
              {calendarMode
                ? <List color="#fff" size={20} />
                : <Calendar color="#fff" size={20} />}
              <Text style={[styles.viewToggleText, odiaFont]}>{calendarMode ? t('schedule.list') : t('schedule.calendar')}</Text>
            </TouchableOpacity>
            <MenuButton onPress={drawer.open} />
          </View>
        </View>
      </LinearGradient>

      <View style={styles.contentWrapper}>
      {calendarMode ? (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.listContent}>
          <CalendarView palis={myPalis} />
          <View style={{ height: 32 }} />
        </ScrollView>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.listContent}>
          {/* Today's duty highlight */}
          {todayEntry && (
            <View style={styles.todayBanner}>
              <View style={[styles.todayBannerLeft, { flex: 1 }]}>
                <View style={styles.todayBadge}>
                  <Text style={[styles.todayBadgeText, odiaFont]}>{t('schedule.today')}</Text>
                </View>
                {upcoming.filter((p) => isToday(p.service_date)).map((duty, i) => (
                  <View key={i} style={i > 0 ? styles.todayDivider : undefined}>
                    <View style={styles.todayNameRow}>
                      <Text style={styles.todaySebaName}>{isOdia && duty.seba_name_or ? duty.seba_name_or : duty.seba_name}</Text>
                      {duty.is_nijog && (
                        <View style={styles.nijogBadge}>
                          <Text style={[styles.nijogBadgeText, odiaFont]}>{t('schedule.nijog')}</Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.todayMeta}>
                      <Text style={styles.todayGroup}>{isOdia && duty.group_name_or ? duty.group_name_or : duty.group_name}</Text>
                      <View style={styles.todayBeddha}>
                        <Hash color={C.saffron} size={13} />
                        <Text style={[styles.todayBeddhaText, odiaFont]}>{t('schedule.beddha')} {formatNumber(duty.beddha_number, language)}</Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
              <Star color={C.saffron} size={28} fill={C.saffron} />
            </View>
          )}

          {/* Summary */}
          {nonTodayGroups.length > 0 && (
            <View style={styles.summaryRow}>
              <Calendar color={C.gold} size={14} />
              <Text style={[styles.summaryText, odiaFont]}>
                <Text style={styles.summaryBold}>{nonTodayGroups.length}</Text>
                {nonTodayGroups.length === 1 ? ` ${t('schedule.upcomingDays_one', { count: '' }).trim()}` : ` ${t('schedule.upcomingDays_other', { count: '' }).trim()}`}
              </Text>
            </View>
          )}

          {nonTodayGroups.length === 0 && !todayEntry ? (
            <View style={styles.emptyInline}>
              <Calendar color={C.textMuted} size={40} />
              <Text style={[styles.emptyInlineTitle, odiaFont]}>{t('schedule.noUpcoming')}</Text>
              <Text style={[styles.emptyInlineText, odiaFont]}>{t('schedule.noUpcomingDesc')}</Text>
            </View>
          ) : nonTodayGroups.length === 0 ? null : (
            <>
              {visibleGroups.map(({ date, duties }) => {
                const fd = formatDate(date);
                const today = isToday(date);
                const firstAccent = duties[0].group_name.toLowerCase().includes('gochhikar') ? C.gold : C.saffron;

                return (
                  <View
                    key={date}
                    style={[styles.paliCard, today && styles.paliCardToday]}
                  >
                    <View style={[styles.dateCol, today && { borderRightColor: firstAccent + '60' }]}>
                      <Text style={[styles.dateWeekday, today && { color: firstAccent }, isOdia && { fontFamily: 'NotoSansOriya_400Regular' as const }]}>
                        {isOdia ? DAYS_LOC[new Date(date + 'T00:00:00').getDay()].slice(0, 3) : fd.weekday}
                      </Text>
                      <Text style={[styles.dateDay, today && { color: firstAccent }, isOdia && { fontFamily: 'NotoSansOriya_400Regular' as const }]}>
                        {formatNumber(fd.day, language)}
                      </Text>
                      <Text style={[styles.dateMonth, today && { color: firstAccent }, isOdia && { fontFamily: 'NotoSansOriya_400Regular' as const }]}>
                        {isOdia ? MONTHS_LOC[new Date(date + 'T00:00:00').getMonth()].slice(0, 3) : fd.month}
                      </Text>
                      {today && <View style={[styles.todayDot, { backgroundColor: firstAccent }]} />}
                    </View>
                    <View style={[styles.paliContent, { flex: 1 }]}>
                      {duties.map((row, ri) => {
                        const isGochhikar = row.group_name.toLowerCase().includes('gochhikar');
                        const accentColor = isGochhikar ? C.gold : C.saffron;
                        const displaySebaName = isOdia && row.seba_name_or ? row.seba_name_or : row.seba_name;
                        const displayGroupName = isOdia && row.group_name_or ? row.group_name_or : row.group_name;
                        return (
                          <View
                            key={`${row.seba_name}-${ri}`}
                            style={[styles.sebaRow, ri > 0 && styles.sebaRowDivider]}
                          >
                            <View style={styles.sebaNameRow}>
                              <Text style={styles.sebaName} numberOfLines={2}>{displaySebaName}</Text>
                              {row.is_nijog && (
                                <View style={[styles.nijogBadge, { backgroundColor: accentColor + '18', borderColor: accentColor + '50' }]}>
                                  <Text style={[styles.nijogBadgeText, { color: accentColor }, odiaFont]}>{t('schedule.nijog')}</Text>
                                </View>
                              )}
                            </View>
                            <View style={styles.paliMeta}>
                              <View style={[styles.groupChip, { backgroundColor: accentColor + '15' }]}>
                                <Text style={[styles.groupChipText, { color: accentColor }]}>{displayGroupName}</Text>
                              </View>
                              <View style={styles.beddhaRow}>
                                <Hash color={accentColor} size={12} />
                                <Text style={[styles.beddhaText, { color: accentColor }, odiaFont]}>{t('schedule.beddha')} {formatNumber(row.beddha_number, language)}</Text>
                              </View>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                    {today && (
                      <View style={styles.activePill}>
                        <Text style={[styles.activePillText, odiaFont]}>{t('home.inProgress')}</Text>
                      </View>
                    )}
                  </View>
                );
              })}

              {hasMore && (
                <TouchableOpacity
                  style={styles.loadMoreBtn}
                  onPress={() => setVisibleCount((v) => v + PAGE_SIZE)}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.loadMoreText, odiaFont]}>{t('schedule.loadMore')}</Text>
                  <ChevronRight color={C.saffron} size={16} />
                </TouchableOpacity>
              )}
            </>
          )}

          {/* Past duties */}
          {past.length > 0 && (
            <>
              <TouchableOpacity
                style={styles.pastToggle}
                onPress={() => setShowPast((v) => !v)}
                activeOpacity={0.7}
              >
                <Text style={[styles.pastToggleText, odiaFont]}>
                  {showPast ? t('schedule.hide') : t('schedule.show')} {t('schedule.pastDuties')} ({formatNumber(past.length, language)})
                </Text>
                <ChevronRight
                  color={C.textMuted}
                  size={16}
                  style={{ transform: [{ rotate: showPast ? '90deg' : '0deg' }] }}
                />
              </TouchableOpacity>

              {showPast && pastGroups.map(({ date, duties }) => {
                const fd = formatDate(date);
                return (
                  <View
                    key={`past-${date}`}
                    style={[styles.paliCard, styles.paliCardPast]}
                  >
                    <View style={styles.dateCol}>
                      <Text style={[styles.dateWeekday, isOdia && { fontFamily: 'NotoSansOriya_400Regular' as const }]}>
                        {isOdia ? DAYS_LOC[new Date(date + 'T00:00:00').getDay()].slice(0, 3) : fd.weekday}
                      </Text>
                      <Text style={[styles.dateDay, isOdia && { fontFamily: 'NotoSansOriya_400Regular' as const }]}>
                        {formatNumber(fd.day, language)}
                      </Text>
                      <Text style={[styles.dateMonth, isOdia && { fontFamily: 'NotoSansOriya_400Regular' as const }]}>
                        {isOdia ? MONTHS_LOC[new Date(date + 'T00:00:00').getMonth()].slice(0, 3) : fd.month}
                      </Text>
                    </View>
                    <View style={[styles.paliContent, { flex: 1 }]}>
                      {duties.map((row, ri) => (
                        <View
                          key={`${row.seba_name}-${ri}`}
                          style={[styles.sebaRow, ri > 0 && styles.sebaRowDivider]}
                        >
                          <View style={styles.sebaNameRow}>
                            <Text style={[styles.sebaName, styles.pastText]} numberOfLines={2}>{isOdia && row.seba_name_or ? row.seba_name_or : row.seba_name}</Text>
                            {row.is_nijog && (
                              <View style={[styles.nijogBadge, { backgroundColor: C.textMuted + '15', borderColor: C.textMuted + '40' }]}>
                                <Text style={[styles.nijogBadgeText, { color: C.textMuted }, odiaFont]}>{t('schedule.nijog')}</Text>
                              </View>
                            )}
                          </View>
                          <View style={styles.paliMeta}>
                            <View style={[styles.groupChip, { backgroundColor: C.textMuted + '15' }]}>
                              <Text style={[styles.groupChipText, { color: C.textMuted }]}>{isOdia && row.group_name_or ? row.group_name_or : row.group_name}</Text>
                            </View>
                            <View style={styles.beddhaRow}>
                              <Hash color={C.textMuted} size={12} />
                              <Text style={[styles.beddhaText, { color: C.textMuted }, odiaFont]}>{t('schedule.beddha')} {formatNumber(row.beddha_number, language)}</Text>
                            </View>
                          </View>
                        </View>
                      ))}
                    </View>
                  </View>
                );
              })}
            </>
          )}

          <View style={{ height: 32 }} />
        </ScrollView>
      )}
      </View>
      <DrawerPanel {...drawer} />
    </SafeAreaView>
  );
}

const calStyles = StyleSheet.create({
  wrap: {
    backgroundColor: '#fff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
    marginBottom: 16,
  },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  navBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: C.cream,
  },
  navTitle: {
    fontSize: 16,
    fontFamily: 'Poppins_700Bold',
    color: C.textPrimary,
  },
  dayHeaderRow: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingTop: 10,
    paddingBottom: 4,
  },
  dayHeader: {
    flex: 1,
    textAlign: 'center',
    fontSize: 10,
    fontFamily: 'Poppins_600SemiBold',
    color: C.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 8,
    paddingBottom: 12,
  },
  cell: {
    width: `${100 / 7}%` as any,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    padding: 2,
  },
  cellToday: {
    backgroundColor: C.cream,
    borderWidth: 1.5,
    borderColor: C.saffron + '60',
  },
  cellSelected: {
    backgroundColor: C.saffron,
  },
  cellText: {
    fontSize: 13,
    fontFamily: 'Poppins_500Medium',
    color: C.textPrimary,
  },
  cellTextToday: {
    color: C.saffron,
    fontFamily: 'Poppins_700Bold',
  },
  cellTextSelected: {
    color: '#fff',
    fontFamily: 'Poppins_700Bold',
  },
  dutyDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: C.saffron,
    marginTop: 1,
  },
  goToHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  goToHintText: {
    fontSize: 11,
    fontFamily: 'Poppins_400Regular',
    color: C.textMuted,
  },
  legend: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 10,
  },
  legendText: {
    fontSize: 11,
    fontFamily: 'Poppins_400Regular',
    color: C.textMuted,
  },
});

const modalStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 36,
    paddingTop: 8,
  },
  dutySheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 36,
    paddingTop: 8,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: C.border,
    alignSelf: 'center',
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Poppins_700Bold',
    color: C.textPrimary,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: C.cream,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 12,
    fontFamily: 'Poppins_600SemiBold',
    color: C.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  monthScroll: {
    marginBottom: 20,
  },
  monthScrollContent: {
    gap: 8,
    paddingRight: 4,
  },
  monthChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.cream,
  },
  monthChipActive: {
    backgroundColor: C.saffron,
    borderColor: C.saffron,
  },
  monthChipText: {
    fontSize: 13,
    fontFamily: 'Poppins_600SemiBold',
    color: C.textSecondary,
  },
  monthChipTextActive: {
    color: '#fff',
  },
  yearInput: {
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    fontFamily: 'Poppins_500Medium',
    color: C.textPrimary,
    backgroundColor: C.cream,
    marginBottom: 8,
  },
  yearInputError: {
    borderColor: '#C0392B',
  },
  errorText: {
    fontSize: 12,
    fontFamily: 'Poppins_400Regular',
    color: '#C0392B',
    marginBottom: 8,
  },
  goBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: C.saffron,
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: 8,
  },
  goBtnText: {
    fontSize: 15,
    fontFamily: 'Poppins_700Bold',
    color: '#fff',
  },
  dutyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  dutyHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  dutyHeaderDate: {
    fontSize: 14,
    fontFamily: 'Poppins_600SemiBold',
    color: C.textPrimary,
    flex: 1,
  },
  dutyRow: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 8,
  },
  dutyRowGradient: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 8,
  },
  dutyNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  dutySebaName: {
    fontSize: 18,
    fontFamily: 'Poppins_700Bold',
    color: C.textPrimary,
  },
  nijogBadge: {
    borderRadius: 5,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderWidth: 1,
  },
  nijogBadgeText: {
    fontSize: 10,
    fontFamily: 'Poppins_700Bold',
    letterSpacing: 1,
  },
  dutyMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  groupChip: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 7,
  },
  groupChipText: {
    fontSize: 12,
    fontFamily: 'Poppins_600SemiBold',
  },
  beddhaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  beddhaText: {
    fontSize: 14,
    fontFamily: 'Poppins_700Bold',
  },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.warmWhite },

  headerGradient: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 52,
  },
  contentWrapper: {
    backgroundColor: '#FFFDF9',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    marginTop: -28,
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerLeft: { flex: 1 },
  headerTitle: {
    fontSize: 22,
    fontFamily: 'Poppins_700Bold',
    color: '#fff',
    marginBottom: 2,
  },
  headerSub: {
    fontSize: 13,
    fontFamily: 'Poppins_400Regular',
    color: 'rgba(255,255,255,0.8)',
  },
  viewToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  viewToggleText: {
    fontSize: 13,
    fontFamily: 'Poppins_600SemiBold',
    color: '#fff',
  },

  headerBar: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 12,
  },
  title: {
    fontSize: 24,
    fontFamily: 'Poppins_700Bold',
    color: C.textPrimary,
  },

  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 100,
    paddingHorizontal: 40,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: 'Poppins_600SemiBold',
    color: C.textPrimary,
  },
  emptyDescription: {
    fontSize: 14,
    fontFamily: 'Poppins_400Regular',
    color: C.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },

  listContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 32 },

  todayBanner: {
    backgroundColor: C.cream,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: C.saffron + '60',
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  todayBannerLeft: { flex: 1, gap: 6 },
  todayDivider: {
    borderTopWidth: 1,
    borderTopColor: C.saffron + '30',
    marginTop: 10,
    paddingTop: 10,
  },
  todayBadge: {
    alignSelf: 'flex-start',
    backgroundColor: C.saffron,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  todayBadgeText: {
    fontSize: 10,
    fontFamily: 'Poppins_700Bold',
    color: '#fff',
    letterSpacing: 1,
  },
  todayNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 2,
  },
  todaySebaName: {
    fontSize: 20,
    fontFamily: 'Poppins_700Bold',
    color: C.textPrimary,
    lineHeight: 26,
  },
  todayMeta: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  todayGroup: {
    fontSize: 12,
    fontFamily: 'Poppins_500Medium',
    color: C.textSecondary,
  },
  todayBeddha: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  todayBeddhaText: {
    fontSize: 13,
    fontFamily: 'Poppins_600SemiBold',
    color: C.saffron,
  },

  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  summaryText: {
    fontSize: 13,
    fontFamily: 'Poppins_400Regular',
    color: C.textSecondary,
  },
  summaryBold: {
    fontFamily: 'Poppins_700Bold',
    color: C.gold,
  },

  paliCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 8,
    overflow: 'hidden',
  },
  paliCardToday: {
    borderColor: C.saffron + '70',
    borderWidth: 1.5,
    backgroundColor: '#FFF9F4',
  },
  paliCardPast: {
    opacity: 0.55,
  },

  dateCol: {
    width: 56,
    alignItems: 'center',
    paddingVertical: 14,
    borderRightWidth: 1,
    borderRightColor: C.border,
  },
  dateWeekday: {
    fontSize: 10,
    fontFamily: 'Poppins_600SemiBold',
    color: C.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  dateDay: {
    fontSize: 24,
    fontFamily: 'Poppins_700Bold',
    color: C.textPrimary,
    lineHeight: 28,
  },
  dateMonth: {
    fontSize: 10,
    fontFamily: 'Poppins_400Regular',
    color: C.textMuted,
    textTransform: 'uppercase',
  },
  todayDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    marginTop: 4,
  },

  sebaRow: {
    gap: 5,
    paddingVertical: 4,
  },
  sebaRowDivider: {
    borderTopWidth: 1,
    borderTopColor: '#E8D5C4',
    paddingTop: 10,
    marginTop: 4,
  },

  paliContent: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 6,
  },
  sebaNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 2,
  },
  sebaName: {
    fontSize: 15,
    fontFamily: 'Poppins_600SemiBold',
    color: C.textPrimary,
    lineHeight: 20,
  },
  nijogBadge: {
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
  },
  nijogBadgeText: {
    fontSize: 9,
    fontFamily: 'Poppins_700Bold',
    letterSpacing: 1,
  },
  pastText: { color: C.textMuted },
  paliMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  groupChip: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  groupChipText: {
    fontSize: 11,
    fontFamily: 'Poppins_600SemiBold',
  },
  beddhaRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  beddhaText: {
    fontSize: 12,
    fontFamily: 'Poppins_600SemiBold',
  },

  activePill: {
    backgroundColor: C.success,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginRight: 12,
  },
  activePillText: {
    fontSize: 11,
    fontFamily: 'Poppins_700Bold',
    color: '#fff',
  },

  loadMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 14,
    marginTop: 4,
    backgroundColor: C.cream,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.saffron + '40',
    marginBottom: 8,
  },
  loadMoreText: {
    fontSize: 14,
    fontFamily: 'Poppins_600SemiBold',
    color: C.saffron,
  },

  pastToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    marginTop: 4,
  },
  pastToggleText: {
    fontSize: 13,
    fontFamily: 'Poppins_500Medium',
    color: C.textMuted,
  },

  emptyInline: {
    alignItems: 'center',
    paddingTop: 60,
    gap: 12,
    paddingHorizontal: 32,
  },
  emptyInlineTitle: {
    fontSize: 16,
    fontFamily: 'Poppins_600SemiBold',
    color: C.textSecondary,
  },
  emptyInlineText: {
    fontSize: 13,
    fontFamily: 'Poppins_400Regular',
    color: C.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
});
