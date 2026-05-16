import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  TextInput,
  Modal,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/lib/supabase';
import {
  ArrowLeft,
  Search,
  X,
  Clock,
  Timer,
  CalendarDays,
  Hash,
  User,
  CircleAlert as AlertCircle,
  ChevronRight,
  CreditCard as Edit2,
  Save,
  History,
  Users,
  TrendingUp,
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
  blue: '#1D6FAE',
  blueLight: '#EBF5FB',
};

type ViewMode = 'sessions' | 'members';
type FilterType = 'all' | 'completed' | 'in_progress' | 'absent' | 'no_session';

type SessionEntry = {
  session_id: string | null;
  roster_id: string;
  sebayat_id: string;
  sebayat_name: string;
  phone: string;
  service_date: string;
  seba_name: string;
  beddha_number: number;
  is_absent: boolean;
  started_at: string | null;
  ended_at: string | null;
  duration_minutes: number | null;
};

type MemberSummary = {
  id: string;
  name: string;
  phone: string;
  total_duties: number;
  completed: number;
  absent: number;
  total_minutes: number;
};

type MemberHistoryEntry = {
  id: string;
  service_date: string;
  seba_name: string;
  beddha_number: number;
  is_absent: boolean;
  started_at: string | null;
  ended_at: string | null;
  duration_minutes: number | null;
};

const FILTER_TABS: { key: FilterType; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'completed', label: 'Completed' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'absent', label: 'Absent' },
  { key: 'no_session', label: 'No Record' },
];

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatTime(ts: string) {
  return new Date(ts).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function toLocalDatetimeString(ts: string) {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function AdminSebaHistoryScreen() {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<ViewMode>('sessions');

  // --- Sessions view state ---
  const [entries, setEntries] = useState<SessionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEntry, setSelectedEntry] = useState<SessionEntry | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editStarted, setEditStarted] = useState('');
  const [editEnded, setEditEnded] = useState('');
  const [saving, setSaving] = useState(false);

  // --- Members view state ---
  const [members, setMembers] = useState<MemberSummary[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');

  // --- Member pali history modal ---
  const [selectedMember, setSelectedMember] = useState<MemberSummary | null>(null);
  const [memberHistory, setMemberHistory] = useState<MemberHistoryEntry[]>([]);
  const [memberHistoryLoading, setMemberHistoryLoading] = useState(false);

  useEffect(() => {
    loadEntries();
  }, []);

  useEffect(() => {
    if (viewMode === 'members' && members.length === 0) loadMembers();
  }, [viewMode]);

  async function loadEntries() {
    setLoading(true);
    await fetchEntries();
    setLoading(false);
  }

  async function fetchEntries() {
    const today = new Date().toISOString().split('T')[0];
    const [rosterResult, sessionResult] = await Promise.all([
      supabase
        .from('seba_roster')
        .select(
          'id, beddha_number, is_absent, sebayat_id, sebayats!inner(full_name, phone), seba_schedule!inner(service_date), seba_categories!inner(name)'
        )
        .lte('seba_schedule.service_date', today)
        .order('service_date', { referencedTable: 'seba_schedule', ascending: false })
        .limit(500),
      supabase
        .from('seba_sessions')
        .select('id, roster_id, sebayat_id, seba_category_id, service_date, started_at, ended_at, duration_minutes')
        .lte('service_date', today)
        .order('started_at', { ascending: false }),
    ]);

    const sessionByRosterId = new Map<string, any>();
    const sessionByDateCatSebayat = new Map<string, any>();
    if (sessionResult.data) {
      for (const s of sessionResult.data as any[]) {
        if (s.roster_id) {
          const ex = sessionByRosterId.get(s.roster_id);
          if (!ex || s.started_at > ex.started_at) sessionByRosterId.set(s.roster_id, s);
        } else {
          const key = `${s.service_date}__${s.seba_category_id}__${s.sebayat_id}`;
          const ex = sessionByDateCatSebayat.get(key);
          if (!ex || s.started_at > ex.started_at) sessionByDateCatSebayat.set(key, s);
        }
      }
    }

    if (rosterResult.data) {
      const mapped: SessionEntry[] = (rosterResult.data as any[]).map((r) => {
        const fallbackKey = `${r.seba_schedule.service_date}__${r.seba_category_id}__${r.sebayat_id}`;
        const session =
          sessionByRosterId.get(r.id) ??
          sessionByDateCatSebayat.get(fallbackKey) ??
          null;
        return {
          session_id: session?.id ?? null,
          roster_id: r.id,
          sebayat_id: r.sebayat_id,
          sebayat_name: r.sebayats?.full_name ?? '—',
          phone: r.sebayats?.phone ?? '',
          service_date: r.seba_schedule.service_date,
          seba_name: r.seba_categories.name,
          beddha_number: r.beddha_number,
          is_absent: r.is_absent,
          started_at: session?.started_at ?? null,
          ended_at: session?.ended_at ?? null,
          duration_minutes: session?.duration_minutes ?? null,
        };
      });
      setEntries(mapped);
    }
  }

  async function loadMembers() {
    setMembersLoading(true);
    const today = new Date().toISOString().split('T')[0];

    const [rosterResult, sessionResult] = await Promise.all([
      supabase
        .from('seba_roster')
        .select('id, sebayat_id, is_absent, sebayats!inner(full_name, phone), seba_schedule!inner(service_date)')
        .lte('seba_schedule.service_date', today),
      supabase
        .from('seba_sessions')
        .select('sebayat_id, duration_minutes, ended_at')
        .lte('service_date', today)
        .not('ended_at', 'is', null),
    ]);

    const durationBySebayat = new Map<string, number>();
    const completedBySebayat = new Map<string, number>();
    if (sessionResult.data) {
      for (const s of sessionResult.data as any[]) {
        durationBySebayat.set(s.sebayat_id, (durationBySebayat.get(s.sebayat_id) ?? 0) + (s.duration_minutes ?? 0));
        completedBySebayat.set(s.sebayat_id, (completedBySebayat.get(s.sebayat_id) ?? 0) + 1);
      }
    }

    if (rosterResult.data) {
      const byMember = new Map<string, { name: string; phone: string; total: number; absent: number }>();
      for (const r of rosterResult.data as any[]) {
        const sid = r.sebayat_id;
        const existing = byMember.get(sid) ?? { name: r.sebayats?.full_name ?? '—', phone: r.sebayats?.phone ?? '', total: 0, absent: 0 };
        existing.total += 1;
        if (r.is_absent) existing.absent += 1;
        byMember.set(sid, existing);
      }

      const summaries: MemberSummary[] = Array.from(byMember.entries()).map(([id, v]) => ({
        id,
        name: v.name,
        phone: v.phone,
        total_duties: v.total,
        completed: completedBySebayat.get(id) ?? 0,
        absent: v.absent,
        total_minutes: durationBySebayat.get(id) ?? 0,
      }));

      summaries.sort((a, b) => a.name.localeCompare(b.name));
      setMembers(summaries);
    }
    setMembersLoading(false);
  }

  async function openMemberHistory(member: MemberSummary) {
    setSelectedMember(member);
    setMemberHistoryLoading(true);
    const today = new Date().toISOString().split('T')[0];

    const [rosterResult, sessionResult] = await Promise.all([
      supabase
        .from('seba_roster')
        .select('id, beddha_number, is_absent, seba_category_id, seba_schedule!inner(service_date), seba_categories!inner(name)')
        .eq('sebayat_id', member.id)
        .lte('seba_schedule.service_date', today)
        .order('service_date', { referencedTable: 'seba_schedule', ascending: false })
        .limit(200),
      supabase
        .from('seba_sessions')
        .select('id, roster_id, seba_category_id, service_date, started_at, ended_at, duration_minutes')
        .eq('sebayat_id', member.id)
        .not('ended_at', 'is', null)
        .lte('service_date', today)
        .order('started_at', { ascending: false }),
    ]);

    const sessionByRosterId = new Map<string, any>();
    const sessionByDateAndCat = new Map<string, any>();
    if (sessionResult.data) {
      for (const s of sessionResult.data as any[]) {
        if (s.roster_id) {
          const ex = sessionByRosterId.get(s.roster_id);
          if (!ex || s.started_at > ex.started_at) sessionByRosterId.set(s.roster_id, s);
        } else {
          const key = `${s.service_date}__${s.seba_category_id}`;
          const ex = sessionByDateAndCat.get(key);
          if (!ex || s.started_at > ex.started_at) sessionByDateAndCat.set(key, s);
        }
      }
    }

    if (rosterResult.data) {
      setMemberHistory(
        (rosterResult.data as any[]).map((r) => {
          const fallbackKey = `${r.seba_schedule.service_date}__${r.seba_category_id}`;
          const session = sessionByRosterId.get(r.id) ?? sessionByDateAndCat.get(fallbackKey) ?? null;
          return {
            id: r.id,
            service_date: r.seba_schedule.service_date,
            seba_name: r.seba_categories.name,
            beddha_number: r.beddha_number,
            is_absent: r.is_absent,
            started_at: session?.started_at ?? null,
            ended_at: session?.ended_at ?? null,
            duration_minutes: session?.duration_minutes ?? null,
          };
        })
      );
    }
    setMemberHistoryLoading(false);
  }

  async function handleRefresh() {
    setRefreshing(true);
    await fetchEntries();
    if (viewMode === 'members') await loadMembers();
    setRefreshing(false);
  }

  function applyFilter(list: SessionEntry[]): SessionEntry[] {
    let filtered = list;
    if (filter === 'completed') filtered = filtered.filter((e) => e.ended_at != null);
    else if (filter === 'in_progress') filtered = filtered.filter((e) => e.started_at != null && e.ended_at == null);
    else if (filter === 'absent') filtered = filtered.filter((e) => e.is_absent);
    else if (filter === 'no_session') filtered = filtered.filter((e) => !e.is_absent && e.started_at == null);

    if (searchQuery.trim().length >= 2) {
      const q = searchQuery.trim().toLowerCase();
      filtered = filtered.filter(
        (e) =>
          e.sebayat_name.toLowerCase().includes(q) ||
          e.phone.includes(q) ||
          e.seba_name.toLowerCase().includes(q)
      );
    }
    return filtered;
  }

  const displayed = applyFilter(entries);
  const filteredMembers = memberSearch.trim().length >= 2
    ? members.filter((m) => m.name.toLowerCase().includes(memberSearch.trim().toLowerCase()) || m.phone.includes(memberSearch.trim()))
    : members;

  const total = entries.length;
  const completedCount = entries.filter((e) => e.ended_at != null).length;
  const inProgressCount = entries.filter((e) => e.started_at != null && e.ended_at == null).length;
  const absentCount = entries.filter((e) => e.is_absent).length;

  function openDetail(entry: SessionEntry) {
    setSelectedEntry(entry);
    setEditMode(false);
    setEditStarted(entry.started_at ? toLocalDatetimeString(entry.started_at) : '');
    setEditEnded(entry.ended_at ? toLocalDatetimeString(entry.ended_at) : '');
  }

  async function saveSession() {
    if (!selectedEntry) return;
    setSaving(true);

    const startedAt = editStarted ? new Date(editStarted).toISOString() : null;
    const endedAt = editEnded ? new Date(editEnded).toISOString() : null;
    const durationMinutes =
      startedAt && endedAt
        ? Math.floor((new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 60000)
        : null;

    if (selectedEntry.session_id) {
      await supabase
        .from('seba_sessions')
        .update({ started_at: startedAt, ended_at: endedAt, duration_minutes: durationMinutes })
        .eq('id', selectedEntry.session_id);
    } else if (startedAt) {
      const { data: catData } = await supabase
        .from('seba_categories')
        .select('id')
        .eq('name', selectedEntry.seba_name)
        .maybeSingle();

      if (catData) {
        await supabase.from('seba_sessions').insert({
          sebayat_id: selectedEntry.sebayat_id,
          roster_id: selectedEntry.roster_id,
          seba_category_id: catData.id,
          service_date: selectedEntry.service_date,
          started_at: startedAt,
          ended_at: endedAt,
          duration_minutes: durationMinutes,
        });
      }
    }

    await fetchEntries();
    setSaving(false);
    setEditMode(false);
    setSelectedEntry(null);
  }

  function renderEntry({ item }: { item: SessionEntry }) {
    const hasSession = item.started_at != null;
    const isInProgress = hasSession && item.ended_at == null;
    const isCompleted = hasSession && item.ended_at != null;

    let statusColor = C.border;
    if (item.is_absent) statusColor = C.error;
    else if (isCompleted) statusColor = C.green;
    else if (isInProgress) statusColor = C.blue;

    return (
      <TouchableOpacity
        style={[styles.entryCard, { borderLeftColor: statusColor }]}
        onPress={() => openDetail(item)}
        activeOpacity={0.78}
      >
        <View style={styles.entryTop}>
          <View style={styles.entryMeta}>
            <View style={styles.dateChip}>
              <CalendarDays color={C.gold} size={11} />
              <Text style={styles.dateChipText}>{formatDate(item.service_date)}</Text>
            </View>
            {item.is_absent && <View style={styles.absentBadge}><Text style={styles.absentBadgeText}>Absent</Text></View>}
            {isInProgress && <View style={styles.progressBadge}><Text style={styles.progressBadgeText}>In Progress</Text></View>}
            {isCompleted && <View style={styles.completedBadge}><Text style={styles.completedBadgeText}>Completed</Text></View>}
          </View>
          <ChevronRight color={C.textMuted} size={14} />
        </View>
        <Text style={styles.sebaName}>{item.seba_name}</Text>
        <View style={styles.entryNameRow}>
          <User color={C.textMuted} size={12} />
          <Text style={styles.sebayatName}>{item.sebayat_name}</Text>
          <View style={styles.beddhaChip}>
            <Hash color={C.textMuted} size={10} />
            <Text style={styles.beddhaChipText}>{item.beddha_number}</Text>
          </View>
        </View>
        {hasSession && (
          <View style={styles.timingRow}>
            <View style={styles.timingItem}>
              <Clock color={C.green} size={11} />
              <Text style={styles.timingText}>{formatTime(item.started_at!)}</Text>
            </View>
            {item.ended_at && (
              <>
                <Text style={styles.timingArrow}>→</Text>
                <View style={styles.timingItem}>
                  <Clock color={C.error} size={11} />
                  <Text style={styles.timingText}>{formatTime(item.ended_at)}</Text>
                </View>
              </>
            )}
            {item.duration_minutes != null && (
              <View style={styles.durationChip}>
                <Timer color={C.gold} size={10} />
                <Text style={styles.durationText}>{formatDuration(item.duration_minutes)}</Text>
              </View>
            )}
          </View>
        )}
        {!hasSession && !item.is_absent && <Text style={styles.noRecordText}>No session recorded</Text>}
      </TouchableOpacity>
    );
  }

  function renderMember({ item }: { item: MemberSummary }) {
    return (
      <TouchableOpacity
        style={styles.memberCard}
        onPress={() => openMemberHistory(item)}
        activeOpacity={0.78}
      >
        <View style={styles.memberAvatar}>
          <Text style={styles.memberAvatarText}>
            {item.name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()}
          </Text>
        </View>
        <View style={styles.memberInfo}>
          <Text style={styles.memberName}>{item.name}</Text>
          <Text style={styles.memberPhone}>{item.phone}</Text>
          <View style={styles.memberStats}>
            <View style={styles.memberStatChip}>
              <TrendingUp color={C.saffron} size={10} />
              <Text style={styles.memberStatText}>{item.total_duties} duties</Text>
            </View>
            <View style={styles.memberStatChip}>
              <Clock color={C.green} size={10} />
              <Text style={[styles.memberStatText, { color: C.green }]}>{item.completed} recorded</Text>
            </View>
            {item.absent > 0 && (
              <View style={styles.memberStatChip}>
                <AlertCircle color={C.error} size={10} />
                <Text style={[styles.memberStatText, { color: C.error }]}>{item.absent} absent</Text>
              </View>
            )}
            {item.total_minutes > 0 && (
              <View style={styles.memberStatChip}>
                <Timer color={C.gold} size={10} />
                <Text style={[styles.memberStatText, { color: C.gold }]}>{formatDuration(item.total_minutes)}</Text>
              </View>
            )}
          </View>
        </View>
        <ChevronRight color={C.textMuted} size={16} />
      </TouchableOpacity>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={['#1A5276', '#154360']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <ArrowLeft color="#fff" size={22} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Clock color="rgba(255,255,255,0.85)" size={20} />
          <Text style={styles.headerTitle}>Seba History</Text>
        </View>
        {!loading && (
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{entries.length}</Text>
          </View>
        )}
      </LinearGradient>

      {/* View mode toggle */}
      <View style={styles.modeToggle}>
        <TouchableOpacity
          style={[styles.modeBtn, viewMode === 'sessions' && styles.modeBtnActive]}
          onPress={() => setViewMode('sessions')}
          activeOpacity={0.75}
        >
          <History color={viewMode === 'sessions' ? '#fff' : C.textSecondary} size={14} />
          <Text style={[styles.modeBtnText, viewMode === 'sessions' && styles.modeBtnTextActive]}>Sessions</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeBtn, viewMode === 'members' && styles.modeBtnActive]}
          onPress={() => setViewMode('members')}
          activeOpacity={0.75}
        >
          <Users color={viewMode === 'members' ? '#fff' : C.textSecondary} size={14} />
          <Text style={[styles.modeBtnText, viewMode === 'members' && styles.modeBtnTextActive]}>By Member</Text>
        </TouchableOpacity>
      </View>

      {viewMode === 'sessions' ? (
        <>
          {/* Stats row */}
          {!loading && (
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: C.saffron }]}>{total}</Text>
                <Text style={styles.statLabel}>Total</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: C.green }]}>{completedCount}</Text>
                <Text style={styles.statLabel}>Completed</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: C.blue }]}>{inProgressCount}</Text>
                <Text style={styles.statLabel}>In Progress</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: C.error }]}>{absentCount}</Text>
                <Text style={styles.statLabel}>Absent</Text>
              </View>
            </View>
          )}

          {/* Search */}
          <View style={styles.searchWrap}>
            <Search color={C.textMuted} size={15} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by name, phone or seba..."
              placeholderTextColor={C.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} activeOpacity={0.7}>
                <X color={C.textMuted} size={14} />
              </TouchableOpacity>
            )}
          </View>

          {/* Filter tabs */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
            {FILTER_TABS.map((tab) => (
              <TouchableOpacity
                key={tab.key}
                style={[styles.filterTab, filter === tab.key && styles.filterTabActive]}
                onPress={() => setFilter(tab.key)}
                activeOpacity={0.75}
              >
                <Text style={[styles.filterTabText, filter === tab.key && styles.filterTabTextActive]}>{tab.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {loading ? (
            <View style={styles.loadingWrap}><ActivityIndicator color={C.saffron} size="large" /></View>
          ) : displayed.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Clock color={C.textMuted} size={44} />
              <Text style={styles.emptyTitle}>No entries found</Text>
              <Text style={styles.emptySubtitle}>Try a different filter or search term.</Text>
            </View>
          ) : (
            <FlatList
              data={displayed}
              keyExtractor={(item) => item.roster_id}
              renderItem={renderEntry}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={C.saffron} />}
            />
          )}
        </>
      ) : (
        <>
          {/* Members search */}
          <View style={styles.searchWrap}>
            <Search color={C.textMuted} size={15} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by name or phone..."
              placeholderTextColor={C.textMuted}
              value={memberSearch}
              onChangeText={setMemberSearch}
            />
            {memberSearch.length > 0 && (
              <TouchableOpacity onPress={() => setMemberSearch('')} activeOpacity={0.7}>
                <X color={C.textMuted} size={14} />
              </TouchableOpacity>
            )}
          </View>

          {membersLoading ? (
            <View style={styles.loadingWrap}><ActivityIndicator color={C.saffron} size="large" /></View>
          ) : filteredMembers.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Users color={C.textMuted} size={44} />
              <Text style={styles.emptyTitle}>No members found</Text>
              <Text style={styles.emptySubtitle}>Try a different search term.</Text>
            </View>
          ) : (
            <FlatList
              data={filteredMembers}
              keyExtractor={(item) => item.id}
              renderItem={renderMember}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={C.saffron} />}
            />
          )}
        </>
      )}

      {/* Session detail modal */}
      <Modal
        visible={selectedEntry != null}
        transparent
        animationType="slide"
        onRequestClose={() => { setSelectedEntry(null); setEditMode(false); }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <LinearGradient colors={['#1A5276', '#154360']} style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>{selectedEntry?.seba_name}</Text>
                <Text style={styles.modalSub}>{selectedEntry?.sebayat_name}</Text>
              </View>
              <TouchableOpacity onPress={() => { setSelectedEntry(null); setEditMode(false); }} style={styles.modalClose} activeOpacity={0.7}>
                <X color="#fff" size={20} />
              </TouchableOpacity>
            </LinearGradient>

            <ScrollView style={styles.modalBody} contentContainerStyle={{ gap: 16 }}>
              <View style={styles.detailSection}>
                <DetailRow icon={<CalendarDays color={C.gold} size={14} />} label="Service Date" value={selectedEntry ? formatDate(selectedEntry.service_date) : ''} />
                <DetailRow icon={<Hash color={C.textMuted} size={14} />} label="Beddha" value={`#${selectedEntry?.beddha_number}`} />
                <DetailRow icon={<User color={C.textMuted} size={14} />} label="Phone" value={selectedEntry?.phone || '—'} />
                <DetailRow
                  icon={<AlertCircle color={selectedEntry?.is_absent ? C.error : C.green} size={14} />}
                  label="Attendance"
                  value={selectedEntry?.is_absent ? 'Absent' : 'Present'}
                  valueColor={selectedEntry?.is_absent ? C.error : C.green}
                />
              </View>

              <Text style={styles.sectionTitle}>Session Timing</Text>
              {editMode ? (
                <View style={styles.editBox}>
                  <Text style={styles.editLabel}>Start Time</Text>
                  <TextInput style={styles.editInput} value={editStarted} onChangeText={setEditStarted} placeholder="YYYY-MM-DDTHH:MM" placeholderTextColor={C.textMuted} />
                  <Text style={styles.editLabel}>End Time</Text>
                  <TextInput style={styles.editInput} value={editEnded} onChangeText={setEditEnded} placeholder="YYYY-MM-DDTHH:MM" placeholderTextColor={C.textMuted} />
                  <View style={styles.editActions}>
                    <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditMode(false)} activeOpacity={0.75}>
                      <Text style={styles.cancelBtnText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.saveBtn} onPress={saveSession} activeOpacity={0.85} disabled={saving}>
                      {saving ? <ActivityIndicator color="#fff" size="small" /> : <><Save color="#fff" size={14} /><Text style={styles.saveBtnText}>Save</Text></>}
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View style={styles.detailSection}>
                  {selectedEntry?.started_at ? (
                    <>
                      <DetailRow icon={<Clock color={C.green} size={14} />} label="Started At" value={formatTime(selectedEntry.started_at)} />
                      {selectedEntry.ended_at
                        ? <DetailRow icon={<Clock color={C.error} size={14} />} label="Ended At" value={formatTime(selectedEntry.ended_at)} />
                        : <DetailRow icon={<Clock color={C.blue} size={14} />} label="Status" value="In Progress" valueColor={C.blue} />
                      }
                      {selectedEntry.duration_minutes != null && (
                        <DetailRow icon={<Timer color={C.gold} size={14} />} label="Duration" value={formatDuration(selectedEntry.duration_minutes)} valueColor={C.gold} />
                      )}
                    </>
                  ) : (
                    <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
                      <Text style={styles.noRecordText}>No session recorded for this duty.</Text>
                    </View>
                  )}
                  <TouchableOpacity style={styles.editBtn} onPress={() => setEditMode(true)} activeOpacity={0.8}>
                    <Edit2 color={C.blue} size={14} />
                    <Text style={styles.editBtnText}>{selectedEntry?.started_at ? 'Edit Session' : 'Add Session'}</Text>
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Member pali history modal */}
      <Modal
        visible={selectedMember != null}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedMember(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { maxHeight: '92%' }]}>
            <LinearGradient colors={['#B8294A', '#8A1F36']} style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>{selectedMember?.name}</Text>
                <Text style={styles.modalSub}>Pali History</Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedMember(null)} style={styles.modalClose} activeOpacity={0.7}>
                <X color="#fff" size={20} />
              </TouchableOpacity>
            </LinearGradient>

            {/* Member summary strip */}
            {selectedMember && (
              <View style={styles.memberSummaryStrip}>
                <View style={styles.summaryItem}>
                  <TrendingUp color={C.saffron} size={16} />
                  <Text style={styles.summaryVal}>{selectedMember.total_duties}</Text>
                  <Text style={styles.summaryLbl}>Duties</Text>
                </View>
                <View style={styles.summaryDiv} />
                <View style={styles.summaryItem}>
                  <Clock color={C.green} size={16} />
                  <Text style={styles.summaryVal}>{selectedMember.completed}</Text>
                  <Text style={styles.summaryLbl}>Recorded</Text>
                </View>
                <View style={styles.summaryDiv} />
                <View style={styles.summaryItem}>
                  <AlertCircle color={C.error} size={16} />
                  <Text style={styles.summaryVal}>{selectedMember.absent}</Text>
                  <Text style={styles.summaryLbl}>Absent</Text>
                </View>
                <View style={styles.summaryDiv} />
                <View style={styles.summaryItem}>
                  <Timer color={C.gold} size={16} />
                  <Text style={styles.summaryVal}>
                    {selectedMember.total_minutes >= 60 ? `${Math.round(selectedMember.total_minutes / 60)}h` : `${selectedMember.total_minutes}m`}
                  </Text>
                  <Text style={styles.summaryLbl}>Served</Text>
                </View>
              </View>
            )}

            {memberHistoryLoading ? (
              <View style={styles.loadingWrap}><ActivityIndicator color={C.saffron} size="large" /></View>
            ) : memberHistory.length === 0 ? (
              <View style={styles.emptyWrap}>
                <CalendarDays color={C.textMuted} size={40} />
                <Text style={styles.emptyTitle}>No duties found</Text>
              </View>
            ) : (
              <FlatList
                data={memberHistory}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                renderItem={({ item, index }) => {
                  const hasSession = item.started_at != null;
                  const borderColor = item.is_absent ? C.error : hasSession ? C.green : C.border;
                  return (
                    <View style={[styles.historyCard, { borderLeftColor: borderColor }, index < memberHistory.length - 1 && styles.historyCardBorder]}>
                      <View style={styles.dateRow}>
                        <View style={[styles.dateChip, item.is_absent && styles.dateChipAbsent]}>
                          <CalendarDays color={item.is_absent ? C.error : C.gold} size={11} />
                          <Text style={[styles.dateChipText, item.is_absent && { color: C.error }]}>{formatDate(item.service_date)}</Text>
                        </View>
                        {item.is_absent && <View style={styles.absentBadge}><Text style={styles.absentBadgeText}>Absent</Text></View>}
                      </View>
                      <Text style={styles.sebaName}>{item.seba_name}</Text>
                      <View style={styles.entryNameRow}>
                        <Hash color={C.textMuted} size={11} />
                        <Text style={styles.beddhaText}>Beddha {item.beddha_number}</Text>
                      </View>
                      {hasSession ? (
                        <View style={styles.sessionBox}>
                          <View style={styles.timingRow}>
                            <View style={styles.timingItem}>
                              <Clock color={C.green} size={11} />
                              <Text style={styles.timingText}>{formatTime(item.started_at!)}</Text>
                            </View>
                            {item.ended_at && (
                              <>
                                <Text style={styles.timingArrow}>→</Text>
                                <View style={styles.timingItem}>
                                  <Clock color={C.error} size={11} />
                                  <Text style={styles.timingText}>{formatTime(item.ended_at)}</Text>
                                </View>
                              </>
                            )}
                            {item.duration_minutes != null && (
                              <View style={styles.durationChip}>
                                <Timer color={C.gold} size={10} />
                                <Text style={styles.durationText}>{formatDuration(item.duration_minutes)}</Text>
                              </View>
                            )}
                          </View>
                        </View>
                      ) : !item.is_absent ? (
                        <Text style={styles.noRecordText}>Timing not recorded</Text>
                      ) : null}
                    </View>
                  );
                }}
              />
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function DetailRow({ icon, label, value, valueColor }: { icon: React.ReactNode; label: string; value: string; valueColor?: string }) {
  return (
    <View style={styles.detailRow}>
      {icon}
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, valueColor ? { color: valueColor } : {}]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.warmWhite },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 16, fontFamily: 'Poppins_600SemiBold', color: C.textSecondary },
  emptySubtitle: { fontSize: 13, fontFamily: 'Poppins_400Regular', color: C.textMuted, textAlign: 'center' },

  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20, gap: 12 },
  backBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 18, fontFamily: 'Poppins_700Bold', color: '#fff' },
  countBadge: { backgroundColor: '#fff', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4, minWidth: 36, alignItems: 'center' },
  countBadgeText: { fontSize: 15, fontFamily: 'Poppins_700Bold', color: '#154360' },

  modeToggle: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 14,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    padding: 4,
    gap: 4,
  },
  modeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 9,
  },
  modeBtnActive: { backgroundColor: '#154360' },
  modeBtnText: { fontSize: 13, fontFamily: 'Poppins_600SemiBold', color: C.textSecondary },
  modeBtnTextActive: { color: '#fff' },

  statsRow: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: C.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  statItem: { flex: 1, alignItems: 'center', gap: 2 },
  statDivider: { width: 1, backgroundColor: C.border, marginVertical: 4 },
  statValue: { fontSize: 18, fontFamily: 'Poppins_700Bold' },
  statLabel: { fontSize: 10, fontFamily: 'Poppins_400Regular', color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 },

  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: C.border,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 14, fontFamily: 'Poppins_400Regular', color: C.textPrimary, padding: 0 },

  filterRow: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 4, gap: 8 },
  filterTab: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: C.border },
  filterTabActive: { backgroundColor: '#154360', borderColor: '#154360' },
  filterTabText: { fontSize: 12, fontFamily: 'Poppins_500Medium', color: C.textSecondary },
  filterTabTextActive: { color: '#fff' },

  listContent: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 32 },

  entryCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderWidth: 1,
    borderColor: C.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  entryTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  entryMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  dateChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FFF8E8', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2, borderWidth: 1, borderColor: C.gold + '40' },
  dateChipAbsent: { backgroundColor: '#FFF5F5', borderColor: C.error + '40' },
  dateChipText: { fontSize: 10, fontFamily: 'Poppins_600SemiBold', color: C.gold },
  absentBadge: { backgroundColor: '#FFF5F5', borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: C.error + '40' },
  absentBadgeText: { fontSize: 10, fontFamily: 'Poppins_600SemiBold', color: C.error },
  progressBadge: { backgroundColor: C.blueLight, borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: C.blue + '40' },
  progressBadgeText: { fontSize: 10, fontFamily: 'Poppins_600SemiBold', color: C.blue },
  completedBadge: { backgroundColor: C.greenLight, borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: C.green + '40' },
  completedBadgeText: { fontSize: 10, fontFamily: 'Poppins_600SemiBold', color: C.green },
  sebaName: { fontSize: 15, fontFamily: 'Poppins_600SemiBold', color: C.textPrimary, marginBottom: 3 },
  entryNameRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 6 },
  sebayatName: { flex: 1, fontSize: 12, fontFamily: 'Poppins_400Regular', color: C.textSecondary },
  beddhaText: { fontSize: 12, fontFamily: 'Poppins_400Regular', color: C.textMuted },
  beddhaChip: { flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: C.textMuted + '15', borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 },
  beddhaChipText: { fontSize: 10, fontFamily: 'Poppins_500Medium', color: C.textMuted },
  timingRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 2 },
  timingItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  timingText: { fontSize: 11, fontFamily: 'Poppins_500Medium', color: C.textSecondary },
  timingArrow: { fontSize: 11, color: C.textMuted },
  durationChip: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2, backgroundColor: C.gold + '20' },
  durationText: { fontSize: 11, fontFamily: 'Poppins_600SemiBold', color: C.gold },
  noRecordText: { fontSize: 11, fontFamily: 'Poppins_400Regular', color: C.textMuted, fontStyle: 'italic', marginTop: 2 },

  // Member cards
  memberCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: C.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  memberAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#154360' + '20',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#154360' + '40',
    flexShrink: 0,
  },
  memberAvatarText: { fontSize: 15, fontFamily: 'Poppins_700Bold', color: '#154360' },
  memberInfo: { flex: 1, gap: 3 },
  memberName: { fontSize: 14, fontFamily: 'Poppins_600SemiBold', color: C.textPrimary },
  memberPhone: { fontSize: 12, fontFamily: 'Poppins_400Regular', color: C.textMuted },
  memberStats: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 4 },
  memberStatChip: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: C.textMuted + '12', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  memberStatText: { fontSize: 10, fontFamily: 'Poppins_500Medium', color: C.textSecondary },

  // History card (inside member pali history modal)
  historyCard: { paddingVertical: 12, paddingLeft: 12, borderLeftWidth: 3, marginBottom: 2 },
  historyCardBorder: { borderBottomWidth: 1, borderBottomColor: C.border },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 5 },
  sessionBox: { backgroundColor: C.greenLight, borderRadius: 8, padding: 8, marginTop: 4 },

  // Member summary strip
  memberSummaryStrip: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: C.border,
  },
  summaryItem: { flex: 1, alignItems: 'center', gap: 2 },
  summaryDiv: { width: 1, backgroundColor: C.border, marginVertical: 4 },
  summaryVal: { fontSize: 16, fontFamily: 'Poppins_700Bold', color: C.textPrimary },
  summaryLbl: { fontSize: 9, fontFamily: 'Poppins_400Regular', color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: C.warmWhite, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '85%', overflow: 'hidden' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 18, gap: 12 },
  modalTitle: { fontSize: 17, fontFamily: 'Poppins_700Bold', color: '#fff' },
  modalSub: { fontSize: 13, fontFamily: 'Poppins_400Regular', color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  modalClose: { width: 34, height: 34, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  modalBody: { padding: 20 },

  detailSection: { backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: C.border },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  detailLabel: { flex: 1, fontSize: 13, fontFamily: 'Poppins_400Regular', color: C.textMuted },
  detailValue: { fontSize: 13, fontFamily: 'Poppins_600SemiBold', color: C.textPrimary },

  sectionTitle: { fontSize: 13, fontFamily: 'Poppins_600SemiBold', color: C.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },

  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 12 },
  editBtnText: { fontSize: 13, fontFamily: 'Poppins_600SemiBold', color: C.blue },

  editBox: { backgroundColor: '#fff', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: C.border, gap: 10 },
  editLabel: { fontSize: 12, fontFamily: 'Poppins_500Medium', color: C.textSecondary },
  editInput: { borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, fontFamily: 'Poppins_400Regular', color: C.textPrimary, backgroundColor: C.cream },
  editActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  cancelBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: C.border, alignItems: 'center' },
  cancelBtnText: { fontSize: 13, fontFamily: 'Poppins_600SemiBold', color: C.textSecondary },
  saveBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: '#154360', alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 },
  saveBtnText: { fontSize: 13, fontFamily: 'Poppins_700Bold', color: '#fff' },
});
