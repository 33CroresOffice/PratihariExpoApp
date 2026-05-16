import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Image,
  Dimensions,
  TextInput,
  Modal,
  Pressable,
  Platform,
  Animated,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useOffline } from '@/contexts/OfflineContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { pickLocalized, SUPPORTED_LANGUAGES } from '@/lib/i18n';
import { hydrateFromCache, writeCache } from '@/lib/cachedQuery';
import { OfflineBanner } from '@/components/OfflineBanner';
import { OfflineGateModal } from '@/components/OfflineGateModal';
import { FileText, Clock, Circle as XCircle, CircleAlert as AlertCircle, ChevronRight, CalendarDays, Star, Hash, Users, Calendar, Megaphone, Share2, SquareUser as UserSquare2, LayoutGrid, CirclePlay as PlayCircle, CircleStop as StopCircle, CalendarCheck, Search, Menu, X, Bell, Settings, LogOut, User, House, BookOpen, Pin, Lock } from 'lucide-react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DRAWER_W = Math.min(SCREEN_WIDTH * 0.78, 300);

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
  teal: '#1A7A6A',
};

type SearchResult = {
  id: string;
  full_name: string | null;
  phone: string | null;
  primary_phone: string | null;
  health_card_no: string | null;
  photo_url: string | null;
  profile_status: string | null;
  current_sahi: string | null;
  bansa_name: string | null;
};

type ProfileStatus =
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'changes_requested'
  | 'resubmitted';

const STATUS_CTA: Record<
  Exclude<ProfileStatus, 'approved'> | 'none',
  { icon: any; color: string; bg: string; title: string; body: string; action: string }
> = {
  none: {
    icon: FileText,
    color: C.saffron,
    bg: C.cream,
    title: 'Complete Your Registration',
    body: 'Submit your details to become an official member of Pratihari Nijog.',
    action: 'Start Registration',
  },
  draft: {
    icon: FileText,
    color: C.saffron,
    bg: C.cream,
    title: 'Finish Your Registration',
    body: 'Your registration is saved as a draft. Complete and submit it for approval.',
    action: 'Continue Registration',
  },
  submitted: {
    icon: Clock,
    color: '#1D6FAE',
    bg: '#EBF5FB',
    title: 'Application Submitted',
    body: 'Your registration is under review by the Pratihari Nijog admin.',
    action: 'View Status',
  },
  under_review: {
    icon: Clock,
    color: '#B7770D',
    bg: '#FFF3CD',
    title: 'Under Review',
    body: 'An admin is reviewing your application. You will be notified shortly.',
    action: 'View Status',
  },
  rejected: {
    icon: XCircle,
    color: C.error,
    bg: '#FFF5F5',
    title: 'Application Rejected',
    body: 'Your application was not approved. Check admin remarks and resubmit.',
    action: 'Update & Resubmit',
  },
  changes_requested: {
    icon: AlertCircle,
    color: '#C87612',
    bg: '#FFF3CD',
    title: 'Changes Requested',
    body: 'The admin has requested changes to your registration. Please update and resubmit.',
    action: 'Update Application',
  },
  resubmitted: {
    icon: Clock,
    color: '#1D6FAE',
    bg: '#EBF5FB',
    title: 'Resubmitted',
    body: 'Your updated application is awaiting review.',
    action: 'View Status',
  },
};

type DutyEntry = {
  service_date: string;
  seba_name: string;
  seba_name_or: string | null;
  beddha_number: number;
  is_nijog: boolean;
};

type NijogAssignment = {
  seba_name: string;
  seba_name_or: string | null;
  beddha_number: number;
  group_code: string;
};

type GroupCounts = {
  pratihari: number;
  gochhikar: number;
};

type TodayBeddha = {
  pratihari: number | null;
  gochhikar: number | null;
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

type CarouselSlide = { id: string; title: string; title_or: string | null; subtitle: string | null; subtitle_or: string | null; image_url: string };

export default function HomeScreen() {
  const { user, profileStatus } = useAuth();
  const isApproved = profileStatus === 'approved';
  const { isOnline, offlineEnabled } = useOffline();
  const { t, language, setLanguage, formatNumber } = useLanguage();
  const isOdia = language === 'or';
  const odiaFont = isOdia ? { fontFamily: 'NotoSansOriya_400Regular' as const } : {};

  const STATUS_CTA_I18N: typeof STATUS_CTA = {
    none: { ...STATUS_CTA.none, title: t('home.regBannerComplete'), body: t('home.regBannerCompleteDesc'), action: t('home.regBannerStart') },
    draft: { ...STATUS_CTA.draft, title: t('home.regBannerDraft'), body: t('home.regBannerDraftDesc'), action: t('home.regBannerContinue') },
    submitted: { ...STATUS_CTA.submitted, title: t('home.regBannerSubmitted'), body: t('home.regBannerSubmittedDesc'), action: t('home.viewStatus') },
    under_review: { ...STATUS_CTA.under_review, title: t('home.regBannerReview'), body: t('home.regBannerReviewDesc'), action: t('home.viewStatus') },
    rejected: { ...STATUS_CTA.rejected, title: t('home.regBannerRejected'), body: t('home.regBannerRejectedDesc'), action: t('home.regBannerUpdateResubmit') },
    changes_requested: { ...STATUS_CTA.changes_requested, title: t('home.regBannerChanges'), body: t('home.regBannerChangesDesc'), action: t('home.regBannerUpdateApp') },
    resubmitted: { ...STATUS_CTA.resubmitted, title: t('home.regBannerResubmitted'), body: t('home.regBannerResubmittedDesc'), action: t('home.viewStatus') },
  };
  const [showOfflineGate, setShowOfflineGate] = useState(false);
  const router = useRouter();
  const [status, setStatus] = useState<ProfileStatus | 'none'>('none');
  const [fullName, setFullName] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [userPhone, setUserPhone] = useState<string | null>(null);

  function formatPhone(raw: string | null | undefined): string | null {
    if (!raw) return null;
    const digits = raw.replace(/\D/g, '');
    return digits ? `+${digits}` : null;
  }
  const [loading, setLoading] = useState(true);
  const [sebayatId, setSebayatId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const drawerAnim = useRef(new Animated.Value(-DRAWER_W)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [todaysDuty, setTodaysDuty] = useState<DutyEntry | null>(null);
  const [todaysDutyAll, setTodaysDutyAll] = useState<DutyEntry[]>([]);
  const [nextDuty, setNextDuty] = useState<DutyEntry | null>(null);
  const [nijogAssignments, setNijogAssignments] = useState<NijogAssignment[]>([]);
  const [groupCounts, setGroupCounts] = useState<GroupCounts>({ pratihari: 0, gochhikar: 0 });
  const [todayBeddha, setTodayBeddha] = useState<TodayBeddha>({ pratihari: null, gochhikar: null });
  const [unreadNoticeCount, setUnreadNoticeCount] = useState(0);
  const [pendingAppCount, setPendingAppCount] = useState(0);
  const [adminRemarks, setAdminRemarks] = useState('');
  const [changeSection, setChangeSection] = useState('');

  // Startup notice modal
  type StartupNotice = { id: string; title: string; body: string; category: string; pinned: boolean; published_at: string | null };
  const [startupNotices, setStartupNotices] = useState<StartupNotice[]>([]);
  const [startupNoticeIndex, setStartupNoticeIndex] = useState(0);
  const [showStartupNotice, setShowStartupNotice] = useState(false);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [carouselSlides, setCarouselSlides] = useState<CarouselSlide[]>([]);
  const [carouselLoaded, setCarouselLoaded] = useState(false);
  const carouselRef = useRef<ScrollView>(null);
  const carouselTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Seba session tracking
  type SebaSession = { id: string; started_at: string; roster_id?: string | null; seba_category_id: string; service_date: string };
  const [activeSessions, setActiveSessions] = useState<Record<string, SebaSession>>({}); // key: seba_name+beddha_number — in progress
  const [doneSessions, setDoneSessions] = useState<Record<string, { started_at: string; ended_at: string; duration_minutes: number }>>({}); // key: completed today
  const [sessionElapsed, setSessionElapsed] = useState<Record<string, number>>({}); // seconds
  const sessionTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!user) return;
    // Seed phone immediately from auth metadata so it shows even before cache/fetch
    setUserPhone(formatPhone(user.user_metadata?.phone || user.phone));
    (async () => {
      if (offlineEnabled) {
        // Hydrate from cache immediately so UI paints with last-synced data
        const [prof, td, tb, nd, nj] = await Promise.all([
          hydrateFromCache<{ id: string; profile_status: ProfileStatus; full_name: string; photo_url: string | null; primary_phone?: string | null; phone?: string | null; admin_remarks?: string | null; change_section?: string | null } | null>(
            user.id, 'profile', (p) => {
              if (p) {
                setStatus(p.profile_status);
                setFullName(p.full_name || '');
                setPhotoUrl(p.photo_url || null);
                setSebayatId(p.id);
                setAdminRemarks(p.admin_remarks || '');
                setChangeSection(p.change_section || '');
                setUserPhone(formatPhone(p.primary_phone || p.phone) || formatPhone(user.user_metadata?.phone || user.phone));
              }
            }
          ),
          hydrateFromCache<DutyEntry[]>(user.id, 'today_duty', (d) => {
            if (d && d.length) { setTodaysDuty(d[0]); setTodaysDutyAll(d); }
          }),
          hydrateFromCache<TodayBeddha>(user.id, 'today_beddha', setTodayBeddha),
          hydrateFromCache<DutyEntry | null>(user.id, 'next_duty', (d) => d && setNextDuty(d)),
          hydrateFromCache<NijogAssignment[]>(user.id, 'nijog_assignments', (n) => {
            if (n) setNijogAssignments(n as any);
          }),
        ]);
        if (prof.cachedAt || td.cachedAt || tb.cachedAt) setLoading(false);
      }
      if (isOnline) {
        await fetchStatus();
      }
      setLoading(false);
    })();
  }, [user, isOnline]);

  useEffect(() => {
    if (!isOnline) return;
    if (sebayatId && status === 'approved') {
      fetchTodaysDuty(sebayatId);
      fetchNextDuty(sebayatId);
      fetchNijogAssignments(sebayatId);
    }
    if (status === 'approved') {
      fetchGroupCounts();
      fetchTodayBeddha();
    }
    fetchUnreadNoticeCount();
    if (sebayatId) fetchPendingAppCount(sebayatId);
    fetchStartupNotices(sebayatId);
  }, [sebayatId, status, isOnline]);

  useEffect(() => {
    supabase
      .from('event_images')
      .select('id, title, title_or, subtitle, subtitle_or, image_url')
      .eq('is_active', true)
      .order('display_order', { ascending: true })
      .then(({ data }) => {
        setCarouselSlides(data && data.length > 0 ? data : []);
        setCarouselLoaded(true);
      });
  }, []);

  const carouselCount = carouselSlides.length || 1;

  useEffect(() => {
    carouselTimer.current = setInterval(() => {
      setCarouselIndex((prev) => {
        const next = (prev + 1) % carouselCount;
        carouselRef.current?.scrollTo({ x: next * (SCREEN_WIDTH - 32), animated: true });
        return next;
      });
    }, 3500);
    return () => {
      if (carouselTimer.current) clearInterval(carouselTimer.current);
    };
  }, [carouselCount]);

  useEffect(() => {
    if (sebayatId && status === 'approved' && isOnline) fetchActiveSessions(sebayatId);
  }, [sebayatId, status, isOnline]);

  useEffect(() => {
    const hasActive = Object.keys(activeSessions).length > 0;
    if (!hasActive) {
      if (sessionTimerRef.current) clearInterval(sessionTimerRef.current);
      return;
    }
    sessionTimerRef.current = setInterval(() => {
      const now = Date.now();
      const updated: Record<string, number> = {};
      Object.entries(activeSessions).forEach(([key, session]) => {
        updated[key] = Math.floor((now - new Date(session.started_at).getTime()) / 1000);
      });
      setSessionElapsed(updated);
    }, 1000);
    return () => {
      if (sessionTimerRef.current) clearInterval(sessionTimerRef.current);
    };
  }, [activeSessions]);

  function openMenu() {
    setMenuVisible(true);
    Animated.parallel([
      Animated.spring(drawerAnim, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 180 }),
      Animated.timing(overlayAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
    ]).start();
  }

  function closeMenu() {
    Animated.parallel([
      Animated.spring(drawerAnim, { toValue: -DRAWER_W, useNativeDriver: true, damping: 20, stiffness: 200 }),
      Animated.timing(overlayAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start(() => setMenuVisible(false));
  }

  function menuNavigate(path: string) {
    closeMenu();
    setTimeout(() => router.push(path as any), 200);
  }

  async function fetchStatus() {
    let data: any = null;
    const res1 = await supabase
      .from('sebayats')
      .select('id, profile_status, full_name, photo_url, primary_phone, phone, admin_remarks, change_section')
      .eq('auth_user_id', user!.id)
      .maybeSingle();
    data = res1.data;

    if (!data) {
      const res2 = await supabase
        .from('sebayats')
        .select('id, profile_status, full_name, photo_url, primary_phone, phone, admin_remarks, change_section')
        .eq('id', user!.id)
        .maybeSingle();
      data = res2.data;
    }

    if (data) {
      setStatus(data.profile_status as ProfileStatus);
      setFullName(data.full_name || '');
      setPhotoUrl(data.photo_url || null);
      setSebayatId(data.id);
      setAdminRemarks(data.admin_remarks || '');
      setChangeSection(data.change_section || '');
      setUserPhone(formatPhone((data as any).primary_phone || (data as any).phone) || formatPhone(user!.user_metadata?.phone || user!.phone));
      if (offlineEnabled && user) await writeCache(user.id, 'profile', data);
    } else {
      setStatus('none');
    }
  }

  function sebaKey(sebaName: string, beddhaNumber: number) {
    return `${sebaName}__${beddhaNumber}`;
  }

  function formatElapsed(seconds: number) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  }

  function formatDuration(minutes: number) {
    if (minutes < 60) return `${minutes}m`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }

  async function fetchActiveSessions(sid: string) {
    const today = new Date().toISOString().split('T')[0];

    // Fetch today's sessions — beddha_number is stored directly on the row
    const { data } = await supabase
      .from('seba_sessions')
      .select('id, started_at, ended_at, duration_minutes, roster_id, seba_category_id, service_date, beddha_number, seba_categories!inner(name)')
      .eq('sebayat_id', sid)
      .eq('service_date', today)
      .order('started_at', { ascending: false });

    const active: Record<string, SebaSession> = {};
    const done: Record<string, { started_at: string; ended_at: string; duration_minutes: number }> = {};
    const elapsed: Record<string, number> = {};
    const now = Date.now();

    for (const row of (data ?? []) as any[]) {
      const name = row.seba_categories?.name ?? '';
      // Use beddha_number stored on the session row directly; fall back to 0 only if missing
      const beddha: number = row.beddha_number ?? 0;
      const key = sebaKey(name, beddha);
      if (row.ended_at) {
        // Only keep the most recent completed session per key (ordered by started_at desc)
        if (!done[key]) {
          done[key] = { started_at: row.started_at, ended_at: row.ended_at, duration_minutes: row.duration_minutes ?? 0 };
        }
      } else {
        // Only keep the latest in-progress session per key
        if (!active[key]) {
          active[key] = { id: row.id, started_at: row.started_at, roster_id: row.roster_id, seba_category_id: row.seba_category_id, service_date: row.service_date };
          elapsed[key] = Math.floor((now - new Date(row.started_at).getTime()) / 1000);
        }
      }
    }

    // Always update state — even if empty, this clears stale state from previous renders
    setActiveSessions(active);
    setDoneSessions(done);
    setSessionElapsed(elapsed);
  }

  async function startSeba(duty: { seba_name: string; beddha_number: number; service_date?: string; is_nijog: boolean }) {
    if (!sebayatId) return;
    const today = new Date().toISOString().split('T')[0];
    const key = sebaKey(duty.seba_name, duty.beddha_number);

    // Look up seba_category_id
    const { data: catData } = await supabase
      .from('seba_categories')
      .select('id')
      .eq('name', duty.seba_name)
      .maybeSingle();
    if (!catData) return;

    // Look up roster_id for today
    const { data: rosterData } = await supabase
      .from('seba_roster')
      .select('id, seba_schedule!inner(service_date)')
      .eq('sebayat_id', sebayatId)
      .eq('seba_category_id', catData.id)
      .eq('seba_schedule.service_date', today)
      .maybeSingle();

    const now = new Date().toISOString();
    const { data: inserted } = await supabase
      .from('seba_sessions')
      .insert({
        sebayat_id: sebayatId,
        roster_id: rosterData?.id ?? null,
        seba_category_id: catData.id,
        service_date: today,
        started_at: now,
        beddha_number: duty.beddha_number > 0 ? duty.beddha_number : null,
      })
      .select('id, started_at, roster_id, seba_category_id, service_date')
      .maybeSingle();

    if (inserted) {
      setActiveSessions((prev) => ({ ...prev, [key]: inserted as SebaSession }));
      setSessionElapsed((prev) => ({ ...prev, [key]: 0 }));
    }
  }

  async function endSeba(duty: { seba_name: string; beddha_number: number }) {
    const key = sebaKey(duty.seba_name, duty.beddha_number);
    const session = activeSessions[key];
    if (!session) return;

    const endedAt = new Date();
    const durationMinutes = Math.floor((endedAt.getTime() - new Date(session.started_at).getTime()) / 60000);

    await supabase
      .from('seba_sessions')
      .update({ ended_at: endedAt.toISOString(), duration_minutes: durationMinutes })
      .eq('id', session.id);

    setActiveSessions((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setSessionElapsed((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setDoneSessions((prev) => ({
      ...prev,
      [key]: { started_at: session.started_at, ended_at: endedAt.toISOString(), duration_minutes: durationMinutes },
    }));
  }

  function handleSearchChange(text: string) {
    setSearchQuery(text);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (text.trim().length < 2) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }
    setSearchLoading(true);
    searchTimeout.current = setTimeout(() => runSearch(text.trim()), 350);
  }

  async function runSearch(q: string) {
    const isPhone = /^\d+$/.test(q);
    let query = supabase
      .from('sebayats')
      .select('id, full_name, phone, primary_phone, health_card_no, photo_url, profile_status, current_sahi, bansa_name')
      .eq('profile_status', 'approved')
      .limit(20);

    if (isPhone) {
      query = query.or(`phone.ilike.%${q}%,primary_phone.ilike.%${q}%,health_card_no.ilike.%${q}%`);
    } else {
      query = query.ilike('full_name', `%${q}%`);
    }

    const { data } = await query;
    setSearchResults((data as SearchResult[]) ?? []);
    setSearchLoading(false);
  }

  async function mergedSelections(sid: string) {
    const [{ data: selections }, { data: nijogRows }] = await Promise.all([
      supabase
        .from('sebayat_seba_selections')
        .select('beddha_number, seba_categories!inner(name, name_or, group_id)')
        .eq('sebayat_id', sid),
      supabase
        .from('nijog_assignments')
        .select('beddha_number, seba_categories!inner(name, name_or, group_id)')
        .eq('sebayat_id', sid),
    ]);
    // Dedup by group_id+beddha_number+name — each unique (group, beddha, seba) slot is distinct
    const seen = new Set<string>();
    const all: any[] = [];
    for (const s of (selections ?? []) as any[]) {
      const key = `${s.seba_categories.group_id}:${s.beddha_number}:${s.seba_categories.name}`;
      if (!seen.has(key)) { seen.add(key); all.push({ ...s, is_nijog: false }); }
    }
    for (const s of (nijogRows ?? []) as any[]) {
      const key = `${s.seba_categories.group_id}:${s.beddha_number}:${s.seba_categories.name}`;
      if (!seen.has(key)) { seen.add(key); all.push({ ...s, is_nijog: true }); }
    }
    return all;
  }

  // Build an .or() filter string matching exact (group_id, beddha_number) pairs
  function buildPairFilter(allSel: any[]): string {
    const pairs = allSel.map(
      (s: any) => `and(group_id.eq.${s.seba_categories.group_id},beddha_number.eq.${s.beddha_number})`
    );
    return [...new Set(pairs)].join(',');
  }

  async function fetchTodaysDuty(sid: string) {
    const today = new Date().toISOString().split('T')[0];
    const allSel = await mergedSelections(sid);
    if (allSel.length === 0) return;

    const pairFilter = buildPairFilter(allSel);
    const { data: scheduleRows } = await supabase
      .from('seba_schedule')
      .select('beddha_number, group_id')
      .eq('service_date', today)
      .or(pairFilter);
    if (!scheduleRows || scheduleRows.length === 0) return;

    const matches: DutyEntry[] = [];
    for (const row of scheduleRows as any[]) {
      const matching = allSel.filter(
        (s: any) => s.seba_categories.group_id === row.group_id && s.beddha_number === row.beddha_number
      );
      for (const sel of matching) {
        matches.push({ service_date: today, seba_name: sel.seba_categories.name, seba_name_or: sel.seba_categories.name_or ?? null, beddha_number: row.beddha_number, is_nijog: sel.is_nijog });
      }
    }
    if (matches.length > 0) {
      setTodaysDuty(matches[0]);
      setTodaysDutyAll(matches);
      if (offlineEnabled && user) await writeCache(user.id, 'today_duty', matches);
    }
  }

  async function fetchNextDuty(sid: string) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    const allSel = await mergedSelections(sid);
    if (allSel.length === 0) return;

    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 120);
    const futureDateStr = futureDate.toISOString().split('T')[0];

    const pairFilter = buildPairFilter(allSel);
    const { data: scheduleRows } = await supabase
      .from('seba_schedule')
      .select('beddha_number, group_id, service_date')
      .gte('service_date', tomorrowStr)
      .lte('service_date', futureDateStr)
      .or(pairFilter)
      .order('service_date', { ascending: true })
      .limit(1);
    if (!scheduleRows || scheduleRows.length === 0) return;

    const row = (scheduleRows as any[])[0];
    const sel = allSel.find(
      (s) => s.seba_categories.group_id === row.group_id && s.beddha_number === row.beddha_number
    );
    if (sel) {
      const nd = { service_date: row.service_date, seba_name: sel.seba_categories.name, seba_name_or: sel.seba_categories.name_or ?? null, beddha_number: row.beddha_number, is_nijog: sel.is_nijog };
      setNextDuty(nd);
      if (offlineEnabled && user) await writeCache(user.id, 'next_duty', nd);
    }
  }

  async function fetchNijogAssignments(sid: string) {
    const year = new Date().getFullYear();
    const { data } = await supabase
      .from('nijog_assignments')
      .select('beddha_number, year, seba_categories!inner(name, name_or, seba_groups!inner(code))')
      .eq('sebayat_id', sid)
      .eq('year', year)
      .order('beddha_number', { ascending: true });

    if (data) {
      const mapped = data.map((r: any) => ({
        seba_name: r.seba_categories.name,
        seba_name_or: r.seba_categories.name_or ?? null,
        beddha_number: r.beddha_number,
        group_code: r.seba_categories.seba_groups.code,
      }));
      setNijogAssignments(mapped);
      if (offlineEnabled && user) await writeCache(user.id, 'nijog_assignments', mapped);
    }
  }

  async function fetchGroupCounts() {
    const { data: groups } = await supabase.from('seba_groups').select('id, code');
    if (!groups) return;

    const pratihariGroup = groups.find((g: any) => g.code === 'pratihari');
    const gochhikarGroup = groups.find((g: any) => g.code === 'gochhikar');

    const [pratihariRes, gochhikarRes] = await Promise.all([
      pratihariGroup
        ? supabase
            .from('nijog_assignments')
            .select('sebayat_id, seba_categories!inner(group_id)')
            .eq('seba_categories.group_id', pratihariGroup.id)
        : Promise.resolve({ data: [] }),
      gochhikarGroup
        ? supabase
            .from('nijog_assignments')
            .select('sebayat_id, seba_categories!inner(group_id)')
            .eq('seba_categories.group_id', gochhikarGroup.id)
        : Promise.resolve({ data: [] }),
    ]);

    const pratihariCount = pratihariRes.data
      ? new Set((pratihariRes.data as any[]).map((r) => r.sebayat_id)).size
      : 0;
    const gochhikarCount = gochhikarRes.data
      ? new Set((gochhikarRes.data as any[]).map((r) => r.sebayat_id)).size
      : 0;

    setGroupCounts({ pratihari: pratihariCount, gochhikar: gochhikarCount });
  }

  async function fetchTodayBeddha() {
    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase
      .from('seba_schedule')
      .select('beddha_number, seba_groups!inner(code)')
      .eq('service_date', today);
    if (!data) return;
    const result: TodayBeddha = { pratihari: null, gochhikar: null };
    for (const row of data as any[]) {
      const code = row.seba_groups?.code;
      if (code === 'pratihari') result.pratihari = row.beddha_number;
      else if (code === 'gochhikar') result.gochhikar = row.beddha_number;
    }
    setTodayBeddha(result);
    if (offlineEnabled && user) await writeCache(user.id, 'today_beddha', result);
  }

  async function fetchPendingAppCount(sid: string) {
    const { count } = await supabase
      .from('applications')
      .select('id', { count: 'exact', head: true })
      .eq('sebayat_id', sid)
      .in('status', ['pending', 'more_info_required']);
    setPendingAppCount(count ?? 0);
  }

  async function fetchUnreadNoticeCount() {
    if (!user) return;
    // Get the sebayat row for this user
    const { data: s } = await supabase
      .from('sebayats')
      .select('id')
      .eq('auth_user_id', user.id)
      .maybeSingle();

    // Fetch all published notices
    const { data: allNotices } = await supabase
      .from('notices')
      .select('id, target_type, target_ids')
      .eq('is_published', true);
    if (!allNotices || allNotices.length === 0) { setUnreadNoticeCount(0); return; }

    // Determine which groups this user belongs to
    let userGroups: string[] = [];
    if (s) {
      const { data: assignments } = await supabase
        .from('nijog_assignments')
        .select('seba_category_id')
        .eq('sebayat_id', s.id);
      if (assignments && assignments.length > 0) {
        const catIds = assignments.map((a: any) => a.seba_category_id);
        const { data: cats } = await supabase
          .from('seba_categories')
          .select('group_id')
          .in('id', catIds);
        if (cats && cats.length > 0) {
          const groupIds = [...new Set(cats.map((c: any) => c.group_id).filter(Boolean))];
          const { data: groups } = await supabase
            .from('seba_groups')
            .select('code')
            .in('id', groupIds);
          userGroups = (groups || []).map((g: any) => g.code);
        }
      }
    }

    // Filter to notices targeted at this user
    const targeted = allNotices.filter((n: any) => {
      if (n.target_type === 'all') return true;
      if (n.target_type === 'group') return (n.target_ids as string[]).some((g: string) => userGroups.includes(g));
      if (n.target_type === 'individual') return s ? (n.target_ids as string[]).includes(s.id) : false;
      return true;
    });

    if (targeted.length === 0 || !s) { setUnreadNoticeCount(targeted.length); return; }

    // Subtract already-read notices
    const targetedIds = targeted.map((n: any) => n.id);
    const { data: reads } = await supabase
      .from('notice_reads')
      .select('notice_id')
      .eq('sebayat_id', s.id)
      .in('notice_id', targetedIds);
    const readCount = (reads || []).length;
    setUnreadNoticeCount(targeted.length - readCount);
  }

  async function fetchStartupNotices(sid: string | null) {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const storageKey = `notice_modal_shown_${sid ?? 'anon'}`;

    // Read what we already showed today
    let shownToday: string[] = [];
    try {
      const raw = await AsyncStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        // Only keep if it was saved today
        if (parsed.date === today) {
          shownToday = parsed.ids ?? [];
        }
      }
    } catch (_) {}

    const now = new Date().toISOString();
    const { data: allNotices } = await supabase
      .from('notices')
      .select('id, title, body, category, pinned, published_at, target_type, target_ids, expires_at')
      .eq('is_published', true)
      .lte('published_at', now)
      .order('pinned', { ascending: false })
      .order('published_at', { ascending: false });

    if (!allNotices || allNotices.length === 0) return;

    // Filter out expired notices
    const active = allNotices.filter((n: any) => !n.expires_at || new Date(n.expires_at) >= new Date());

    // Resolve user groups for targeting
    let userGroupCodes: string[] = [];
    if (sid) {
      const { data: assignments } = await supabase
        .from('nijog_assignments')
        .select('seba_category_id')
        .eq('sebayat_id', sid);
      if (assignments && assignments.length > 0) {
        const catIds = assignments.map((a: any) => a.seba_category_id);
        const { data: cats } = await supabase
          .from('seba_categories')
          .select('group_id')
          .in('id', catIds);
        if (cats && cats.length > 0) {
          const groupIds = [...new Set(cats.map((c: any) => c.group_id).filter(Boolean))];
          const { data: groups } = await supabase
            .from('seba_groups')
            .select('code')
            .in('id', groupIds);
          userGroupCodes = (groups || []).map((g: any) => g.code);
        }
      }
    }

    // Apply targeting filter
    const targeted = active.filter((n: any) => {
      if (n.target_type === 'all') return true;
      if (n.target_type === 'group') return (n.target_ids as string[]).some((g: string) => userGroupCodes.includes(g));
      if (n.target_type === 'individual') return sid ? (n.target_ids as string[]).includes(sid) : false;
      return true;
    });

    if (targeted.length === 0) return;

    // Filter to unread notices only
    let unreadNotices = targeted;
    if (sid) {
      const ids = targeted.map((n: any) => n.id);
      const { data: reads } = await supabase
        .from('notice_reads')
        .select('notice_id')
        .eq('sebayat_id', sid)
        .in('notice_id', ids);
      const readSet = new Set((reads || []).map((r: any) => r.notice_id));
      unreadNotices = targeted.filter((n: any) => !readSet.has(n.id));
    }

    if (unreadNotices.length === 0) return;

    // Only show notices not already shown in this calendar day's session
    const toShow = unreadNotices.filter((n: any) => !shownToday.includes(n.id));

    if (toShow.length === 0) return;

    setStartupNotices(toShow);
    setStartupNoticeIndex(0);
    setShowStartupNotice(true);

    // Persist that we've shown these notice IDs today
    try {
      const newShown = [...new Set([...shownToday, ...toShow.map((n: any) => n.id)])];
      await AsyncStorage.setItem(storageKey, JSON.stringify({ date: today, ids: newShown }));
    } catch (_) {}
  }

  async function markStartupNoticeRead(noticeId: string, sid: string | null) {
    if (!sid || !isOnline) return;
    await supabase.from('notice_reads').upsert(
      { notice_id: noticeId, sebayat_id: sid, read_at: new Date().toISOString() },
      { onConflict: 'notice_id,sebayat_id' }
    );
    setUnreadNoticeCount((prev) => Math.max(0, prev - 1));
  }

  function dismissStartupNotice() {
    const current = startupNotices[startupNoticeIndex];
    if (current) markStartupNoticeRead(current.id, sebayatId);
    if (startupNoticeIndex + 1 < startupNotices.length) {
      setStartupNoticeIndex((i) => i + 1);
    } else {
      setShowStartupNotice(false);
    }
  }

  function handleCta() {
    if (
      status === 'none' ||
      status === 'draft' ||
      status === 'rejected' ||
      status === 'changes_requested'
    ) {
      if ((status === 'rejected' || status === 'changes_requested') && adminRemarks) {
        router.push({
          pathname: '/register',
          params: {
            admin_remarks: adminRemarks,
            change_section: changeSection || '',
          },
        } as any);
      } else {
        router.push('/register');
      }
    } else {
      router.push('/(tabs)/profile');
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={C.saffron} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Search Overlay */}
      <Modal visible={searchOpen} transparent animationType="fade" onRequestClose={() => { setSearchOpen(false); setSearchQuery(''); setSearchResults([]); }}>
        <View style={styles.searchOverlay}>
          {/* Search header */}
          <LinearGradient colors={['#E8732A', '#D4A843']} style={styles.searchOverlayHeader}>
            <View style={styles.searchOverlayBar}>
              <Search color="rgba(255,255,255,0.8)" size={17} />
              <TextInput
                style={styles.searchOverlayInput}
                placeholder={t('home.searchPlaceholder')}
                placeholderTextColor="rgba(255,255,255,0.55)"
                value={searchQuery}
                onChangeText={handleSearchChange}
                autoFocus
                returnKeyType="search"
                clearButtonMode="never"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => { setSearchQuery(''); setSearchResults([]); }} activeOpacity={0.7}>
                  <X color="rgba(255,255,255,0.8)" size={17} />
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity onPress={() => { setSearchOpen(false); setSearchQuery(''); setSearchResults([]); }} activeOpacity={0.8} style={styles.searchCancelBtn}>
              <Text style={[styles.searchCancelText, odiaFont]}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </LinearGradient>

          {/* Results */}
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.searchResultsList}>
            {searchLoading && (
              <View style={styles.searchStateWrap}>
                <ActivityIndicator color={C.saffron} size="small" />
                <Text style={[styles.searchStateText, odiaFont]}>{t('home.searching')}</Text>
              </View>
            )}
            {!searchLoading && searchQuery.trim().length >= 2 && searchResults.length === 0 && (
              <View style={styles.searchStateWrap}>
                <Text style={[styles.searchEmptyTitle, odiaFont]}>{t('home.noSebayatsFound')}</Text>
                <Text style={[styles.searchStateText, odiaFont]}>{t('home.noSebayatsSub')}</Text>
              </View>
            )}
            {!searchLoading && searchQuery.trim().length < 2 && searchQuery.length > 0 && (
              <View style={styles.searchStateWrap}>
                <Text style={[styles.searchStateText, odiaFont]}>{t('home.typeToSearch')}</Text>
              </View>
            )}
            {searchResults.map((r) => {
              const initials = r.full_name ? r.full_name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase() : '?';
              const phone = r.primary_phone || r.phone;
              return (
                <TouchableOpacity
                  key={r.id}
                  style={styles.searchResultCard}
                  activeOpacity={0.75}
                  onPress={() => { setSearchOpen(false); setSearchQuery(''); setSearchResults([]); router.push(`/sebayat/${r.id}`); }}
                >
                  {r.photo_url
                    ? <Image source={{ uri: r.photo_url }} style={styles.searchResultAvatar} />
                    : (
                      <View style={styles.searchResultAvatarFallback}>
                        <Text style={styles.searchResultInitials}>{initials}</Text>
                      </View>
                    )
                  }
                  <View style={styles.searchResultInfo}>
                    <Text style={styles.searchResultName} numberOfLines={1}>{r.full_name || '—'}</Text>
                    <View style={styles.searchResultMeta}>
                      {phone && (
                        <View style={styles.searchResultChip}>
                          <Text style={styles.searchResultChipText}>{phone}</Text>
                        </View>
                      )}
                      {r.health_card_no && (
                        <View style={[styles.searchResultChip, { backgroundColor: C.gold + '15' }]}>
                          <Text style={[styles.searchResultChipText, { color: C.gold }]}>HC: {r.health_card_no}</Text>
                        </View>
                      )}
                      {r.bansa_name && (
                        <View style={[styles.searchResultChip, { backgroundColor: C.saffron + '12' }]}>
                          <Text style={[styles.searchResultChipText, { color: C.saffron }]}>{r.bansa_name}</Text>
                        </View>
                      )}
                    </View>
                    {r.current_sahi && (
                      <Text style={styles.searchResultSahi} numberOfLines={1}>{r.current_sahi}</Text>
                    )}
                  </View>
                  <ChevronRight color={C.textMuted} size={16} />
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </Modal>

      <OfflineBanner />
      <OfflineGateModal
        visible={showOfflineGate}
        onClose={() => setShowOfflineGate(false)}
        title={t('home.offlineApps')}
        message={t('home.offlineAppsDesc')}
      />

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Gradient Header */}
        <LinearGradient
          colors={['#E8732A', '#D4A843']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerGradient}
        >
          {/* Row 1: Search bar + Menu button */}
          <View style={styles.headerTopRow}>
            <TouchableOpacity
              style={styles.searchBar}
              onPress={() => setSearchOpen(true)}
              activeOpacity={0.85}
            >
              <Search color="rgba(255,255,255,0.7)" size={16} />
              <Text style={[styles.searchPlaceholder, odiaFont]}>{t('home.searchSebayats')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuBtn} onPress={openMenu} activeOpacity={0.8}>
              <Menu color="#fff" size={22} />
            </TouchableOpacity>
          </View>

          {/* Row 2: Welcome text (left) + Avatar (right) */}
          <View style={styles.headerWelcomeRow}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={[styles.welcomeSmall, odiaFont]}>{t('home.welcomeBack')}</Text>
              <Text style={[styles.headerName, isOdia && { fontFamily: 'NotoSansOriya_700Bold' }]}>{fullName || t('common.jayJagannath')}</Text>
              {userPhone ? (
                <Text style={styles.headerPhone}>({userPhone.replace(/^\+91/, '')})</Text>
              ) : null}
            </View>
            <TouchableOpacity onPress={() => router.push('/(tabs)/profile')} activeOpacity={0.85}>
              {photoUrl
                ? <Image source={{ uri: photoUrl }} style={styles.headerAvatar} />
                : (
                  <View style={styles.headerAvatarFallback}>
                    <Text style={styles.headerAvatarInitial}>
                      {fullName ? fullName.charAt(0).toUpperCase() : 'J'}
                    </Text>
                  </View>
                )
              }
            </TouchableOpacity>
          </View>
        </LinearGradient>

        {/* Inward curve content wrapper */}
        <View style={styles.contentWrapper}>

        {status === 'approved' ? (
          <>
            {/* Today's Date + Present Beddha Banner — always on top */}
            <TouchableOpacity
              activeOpacity={0.92}
              onPress={() => router.push('/(tabs)/schedule')}
              style={styles.beddhaBanner}
            >
              <LinearGradient
                colors={['#0D2B1E', '#132E22', '#0A2016']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.beddhaBannerGradient}
              >
                {/* Left: date + title */}
                <View style={styles.beddhaBannerLeft}>
                  <View style={styles.beddhaBannerDateRow}>
                    <CalendarCheck color="#4ADE80" size={13} />
                    <Text style={styles.beddhaBannerDateText} numberOfLines={1}>
                      {new Date().toLocaleDateString('en-IN', {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      }).toUpperCase()}
                    </Text>
                  </View>
                  <Text style={[styles.beddhaBannerTitle, odiaFont]}>{t('home.todaysBeddha')}</Text>
                </View>

                {/* Right: beddha chips */}
                <View style={styles.beddhaBannerChips}>
                  <View style={styles.beddhaChip}>
                    <Text style={[styles.beddhaChipLabel, odiaFont]}>{t('home.pratihari')}</Text>
                    <Text style={styles.beddhaChipNum}>
                      {todayBeddha.pratihari != null ? `#${formatNumber(todayBeddha.pratihari)}` : '—'}
                    </Text>
                  </View>
                  <View style={styles.beddhaChip}>
                    <Text style={[styles.beddhaChipLabel, odiaFont]}>{t('home.gochhikar')}</Text>
                    <Text style={styles.beddhaChipNum}>
                      {todayBeddha.gochhikar != null ? `#${formatNumber(todayBeddha.gochhikar)}` : '—'}
                    </Text>
                  </View>
                </View>
              </LinearGradient>
            </TouchableOpacity>

            {/* Today's Active Duty Banners — hereditary + nijog-assigned, all grouped together */}
            {(() => {
              const today = new Date().toISOString().split('T')[0];
              const nijogToday = nijogAssignments.filter(
                (a) =>
                  ((a.group_code === 'pratihari' && todayBeddha.pratihari != null && a.beddha_number === todayBeddha.pratihari) ||
                    (a.group_code === 'gochhikar' && todayBeddha.gochhikar != null && a.beddha_number === todayBeddha.gochhikar)) &&
                  !todaysDutyAll.some((d) => d.seba_name === a.seba_name && d.beddha_number === a.beddha_number)
              );
              const allToday: Array<{ seba_name: string; seba_name_or: string | null; beddha_number: number; service_date?: string; is_nijog: boolean }> = [
                ...todaysDutyAll,
                ...nijogToday.map((a) => ({ seba_name: a.seba_name, seba_name_or: a.seba_name_or ?? null, beddha_number: a.beddha_number, service_date: today, is_nijog: true })),
              ];
              return allToday.map((duty, idx) => {
                const key = sebaKey(duty.seba_name, duty.beddha_number);
                const activeSession = activeSessions[key];
                const doneSession = doneSessions[key];
                const elapsed = sessionElapsed[key] ?? 0;

                let gradientColors: [string, string, string];
                if (doneSession) gradientColors = ['#1A5C2A', '#246B34', '#1A5C2A'];
                else if (activeSession) gradientColors = ['#0D4A2B', '#155E37', '#0A3D22'];
                else gradientColors = ['#E8732A', '#F5A623', '#D4A843'];

                return (
                  <LinearGradient
                    key={idx}
                    colors={gradientColors}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[styles.activeDutyBanner, { marginTop: 8 }]}
                  >
                    <View style={styles.activeDutyLeft}>
                      <View style={styles.activeDutyTitleRow}>
                        <Text style={styles.activeDutyTitle}>{isOdia && duty.seba_name_or ? duty.seba_name_or : duty.seba_name}</Text>
                        {duty.is_nijog && (
                          <View style={styles.nijogBadge}>
                            <Text style={[styles.nijogBadgeText, odiaFont]}>{t('home.nijog')}</Text>
                          </View>
                        )}
                        {activeSession && (
                          <View style={styles.inProgressBadge}>
                            <Text style={[styles.inProgressBadgeText, odiaFont]}>{t('home.inProgress')}</Text>
                          </View>
                        )}
                        {doneSession && (
                          <View style={styles.doneBadge}>
                            <Text style={[styles.doneBadgeText, odiaFont]}>{t('home.done')}</Text>
                          </View>
                        )}
                      </View>
                      <View style={styles.activeDutyMeta}>
                        <CalendarDays color="rgba(255,255,255,0.85)" size={13} />
                        <Text style={styles.activeDutyMetaText}>{formatDate(today)}</Text>
                        <View style={styles.activeDutyDot} />
                        <Users color="rgba(255,255,255,0.85)" size={13} />
                        <Text style={[styles.activeDutyMetaText, odiaFont]}>{t('home.beddha')}: {formatNumber(duty.beddha_number)}</Text>
                      </View>
                      {activeSession && (
                        <View style={styles.elapsedRow}>
                          <Clock color="rgba(255,255,255,0.9)" size={12} />
                          <Text style={styles.elapsedText}>{formatElapsed(elapsed)}</Text>
                        </View>
                      )}
                      {doneSession && (
                        <View style={styles.elapsedRow}>
                          <Clock color="rgba(255,255,255,0.7)" size={12} />
                          <Text style={styles.elapsedText}>
                            {formatDuration(doneSession.duration_minutes)}
                          </Text>
                        </View>
                      )}
                    </View>
                    {!doneSession && (
                      <TouchableOpacity
                        style={[styles.activeDutyBtn, activeSession && styles.activeDutyBtnEnd, !isOnline && { opacity: 0.5 }]}
                        disabled={!isOnline}
                        onPress={() => activeSession ? endSeba(duty) : startSeba(duty)}
                        activeOpacity={0.85}
                      >
                        {activeSession
                          ? <StopCircle color="#fff" size={15} />
                          : <PlayCircle color={C.saffron} size={15} />
                        }
                        <Text style={[styles.activeDutyBtnText, activeSession && { color: '#fff' }, odiaFont]}>
                          {activeSession ? t('home.end') : t('home.start')}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </LinearGradient>
                );
              });
            })()}

            {/* Next Duty */}
            {nextDuty && (
              <>
                <View style={styles.sectionHeader}>
                  <CalendarDays color={C.gold} size={15} />
                  <Text style={[styles.sectionTitle, odiaFont]}>{t('home.nextDuty')}</Text>
                </View>
                <TouchableOpacity
                  style={[styles.dutyCard, styles.nextCard]}
                  onPress={() => router.push('/(tabs)/schedule')}
                  activeOpacity={0.85}
                >
                  <View style={styles.dutyCardLeft}>
                    <Text style={styles.nextDateLabel}>{formatDate(nextDuty.service_date)}</Text>
                    <Text style={styles.dutySebaName}>{isOdia && nextDuty.seba_name_or ? nextDuty.seba_name_or : nextDuty.seba_name}</Text>
                    <View style={styles.beddhaRow}>
                      <Hash color={C.gold} size={13} />
                      <Text style={[styles.beddhaText, { color: C.gold }, odiaFont]}>
                        {t('home.beddha')} {nextDuty.beddha_number}
                      </Text>
                    </View>
                  </View>
                  <ChevronRight color={C.textMuted} size={20} />
                </TouchableOpacity>
              </>
            )}

            {/* Feature Grid Row 1 */}
            <View style={styles.featureGrid}>
              <TouchableOpacity
                style={[styles.featureCard, { backgroundColor: '#F0F0FA' }]}
                onPress={() => router.push('/(tabs)/schedule')}
                activeOpacity={0.85}
              >
                <View style={[styles.featureIconWrap, { backgroundColor: '#D8D8F5' }]}>
                  <Clock color="#5B5BBA" size={22} />
                </View>
                <Text style={[styles.featureTitle, { color: '#3A3A8A' }, odiaFont]}>{t('home.upcomingPali')}</Text>
                <Text style={[styles.featureDesc, odiaFont]}>{t('home.upcomingPaliDesc')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.featureCard, { backgroundColor: '#FFF0F3' }]}
                onPress={() => router.push('/pali-history')}
                activeOpacity={0.85}
              >
                <View style={[styles.featureIconWrap, { backgroundColor: '#FFD6DE' }]}>
                  <Calendar color="#B8294A" size={22} />
                </View>
                <Text style={[styles.featureTitle, { color: '#8A1F36' }, odiaFont]}>{t('home.paliHistory')}</Text>
                <Text style={[styles.featureDesc, odiaFont]}>{t('home.paliHistoryDesc')}</Text>
              </TouchableOpacity>
            </View>

            {/* Feature Grid Row 2 */}
            <View style={styles.featureGrid}>
              <TouchableOpacity
                style={[styles.featureCard, { backgroundColor: '#F0FAF8' }]}
                onPress={() => router.push('/notice')}
                activeOpacity={0.85}
              >
                <View style={styles.featureIconWithBadge}>
                  <View style={[styles.featureIconWrap, { backgroundColor: '#C3ECE5', marginBottom: 0 }]}>
                    <Megaphone color="#1A7A6A" size={22} />
                  </View>
                  {unreadNoticeCount > 0 && (
                    <View style={styles.noticeBadge}>
                      <Text style={styles.noticeBadgeText}>{unreadNoticeCount}</Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.featureTitle, { color: '#145E52' }, odiaFont]}>{t('home.notice')}</Text>
                <Text style={[styles.featureDesc, odiaFont]}>{t('home.noticeDesc')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.featureCard, { backgroundColor: '#FFFBF0' }]}
                onPress={() => router.push('/social-profile')}
                activeOpacity={0.85}
              >
                <View style={[styles.featureIconWrap, { backgroundColor: '#FFE9B0' }]}>
                  <Share2 color="#A07010" size={22} />
                </View>
                <Text style={[styles.featureTitle, { color: '#7A5408' }, odiaFont]}>{t('home.socialMedia')}</Text>
                <Text style={[styles.featureDesc, odiaFont]}>{t('home.socialMediaDesc')}</Text>
              </TouchableOpacity>
            </View>

            {/* Feature Grid Row 3 */}
            <View style={styles.featureGrid}>
              <TouchableOpacity
                style={[styles.featureCard, { backgroundColor: '#EDF7EE' }]}
                onPress={() => router.push('/committee')}
                activeOpacity={0.85}
              >
                <View style={[styles.featureIconWrap, { backgroundColor: '#C5E8C7' }]}>
                  <UserSquare2 color="#2B7A30" size={22} />
                </View>
                <Text style={[styles.featureTitle, { color: '#1E5C22' }, odiaFont]}>{t('home.committee')}</Text>
                <Text style={[styles.featureDesc, odiaFont]}>{t('home.committeeDesc')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.featureCard, { backgroundColor: '#FFF0F0' }]}
                onPress={() => { if (!isOnline) { setShowOfflineGate(true); return; } router.push('/application'); }}
                activeOpacity={0.85}
              >
                <View style={styles.featureIconWithBadge}>
                  <View style={[styles.featureIconWrap, { backgroundColor: '#FFD0D0', marginBottom: 0 }]}>
                    <LayoutGrid color="#B83030" size={22} />
                  </View>
                  {pendingAppCount > 0 && (
                    <View style={styles.noticeBadge}>
                      <Text style={styles.noticeBadgeText}>{pendingAppCount}</Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.featureTitle, { color: '#8A2020' }, odiaFont]}>{t('home.application')}</Text>
                <Text style={[styles.featureDesc, odiaFont]}>{t('home.applicationDesc')}</Text>
              </TouchableOpacity>
            </View>

            {/* Pratihari Seba Banner */}
            <TouchableOpacity
              onPress={() => router.push('/(tabs)/profile')}
              activeOpacity={0.9}
              style={styles.sebaBannerWrap}
            >
              <LinearGradient
                colors={['#E8732A', '#F5A623', '#D4A843']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.sebaBanner}
              >
                <Text style={[styles.sebaBannerTitle, isOdia && { fontFamily: 'NotoSansOriya_700Bold' }]}>{t('home.pratihariSeba')}</Text>
                <Text style={[styles.sebaBannerSub, odiaFont]}>{t('home.pratihariSebaDesc')}</Text>
              </LinearGradient>
            </TouchableOpacity>

            {/* Temple Image Carousel — only shown when images exist */}
            {carouselLoaded && carouselSlides.length > 0 && (
              <View style={styles.carouselWrap}>
                <ScrollView
                  ref={carouselRef}
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  scrollEventThrottle={16}
                  onMomentumScrollEnd={(e) => {
                    const idx = Math.round(
                      e.nativeEvent.contentOffset.x / (SCREEN_WIDTH - 32)
                    );
                    setCarouselIndex(idx);
                  }}
                >
                  {carouselSlides.map((slide) => (
                    <View key={slide.id} style={styles.carouselSlide}>
                      <Image source={{ uri: slide.image_url }} style={styles.carouselImage} resizeMode="cover" />
                      <LinearGradient
                        colors={['transparent', 'rgba(0,0,0,0.65)']}
                        style={styles.carouselOverlay}
                      >
                        <Text style={styles.carouselTitle}>{pickLocalized(slide, 'title', language)}</Text>
                        {pickLocalized(slide, 'subtitle', language) ? (
                          <Text style={styles.carouselSubtitle}>{pickLocalized(slide, 'subtitle', language)}</Text>
                        ) : null}
                      </LinearGradient>
                    </View>
                  ))}
                </ScrollView>
                <View style={styles.dotRow}>
                  {carouselSlides.map((_, i) => (
                    <View key={i} style={[styles.dot, i === carouselIndex && styles.dotActive]} />
                  ))}
                </View>
              </View>
            )}
          </>
        ) : (
          (() => {
            const cta = STATUS_CTA_I18N[status as keyof typeof STATUS_CTA_I18N];
            const CtaIcon = cta.icon;
            return (
              <TouchableOpacity
                style={[styles.ctaCard, { backgroundColor: cta.bg, borderColor: cta.color + '40' }]}
                onPress={handleCta}
                activeOpacity={0.85}
              >
                <View style={[styles.ctaIconWrap, { backgroundColor: cta.color + '20' }]}>
                  <CtaIcon color={cta.color} size={26} />
                </View>
                <View style={styles.ctaBody}>
                  <Text style={[styles.ctaTitle, { color: cta.color }, isOdia && { fontFamily: 'NotoSansOriya_700Bold' }]}>{cta.title}</Text>
                  <Text style={[styles.ctaDesc, odiaFont]}>{cta.body}</Text>
                  {(status === 'rejected' || status === 'changes_requested') && adminRemarks ? (
                    <View style={[styles.ctaRemarkBox, { borderLeftColor: cta.color }]}>
                      <Text style={styles.ctaRemarkLabel}>Admin Remark:</Text>
                      <Text style={styles.ctaRemarkText}>{adminRemarks}</Text>
                    </View>
                  ) : null}
                  <View style={styles.ctaActionRow}>
                    <Text style={[styles.ctaAction, { color: cta.color }, odiaFont]}>{cta.action}</Text>
                    <ChevronRight color={cta.color} size={16} />
                  </View>
                </View>
              </TouchableOpacity>
            );
          })()
        )}

        <View style={styles.infoSection}>
          <Text style={[styles.infoTitle, isOdia && { fontFamily: 'NotoSansOriya_700Bold' }]}>{t('home.aboutTitle')}</Text>
          <Text style={[styles.infoText, odiaFont]}>{t('home.aboutBody')}</Text>
        </View>

        </View>{/* end contentWrapper */}
      </ScrollView>

      {/* Slide-in Drawer Menu — after ScrollView so it renders on top */}
      {menuVisible && (
        <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
          <Animated.View style={[styles.menuBackdrop, { opacity: overlayAnim }]} pointerEvents="auto">
            <Pressable style={StyleSheet.absoluteFillObject} onPress={closeMenu} />
          </Animated.View>

          <Animated.View style={[styles.menuSheet, { transform: [{ translateX: drawerAnim }] }]}>
            <LinearGradient colors={['#E8732A', '#D4A843']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.menuHeader}>
              <View style={styles.menuHeaderInner}>
                <View style={styles.menuAvatarWrap}>
                  {photoUrl
                    ? <Image source={{ uri: photoUrl }} style={styles.menuAvatar} />
                    : (
                      <View style={styles.menuAvatarFallback}>
                        <Text style={styles.menuAvatarInitial}>
                          {fullName ? fullName.charAt(0).toUpperCase() : 'J'}
                        </Text>
                      </View>
                    )
                  }
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.menuName, isOdia && { fontFamily: 'NotoSansOriya_700Bold' }]} numberOfLines={1}>{fullName || t('common.jayJagannath')}</Text>
                  {userPhone ? <Text style={styles.menuPhone}>{userPhone}</Text> : null}
                  <Text style={[styles.menuNijog, odiaFont]}>{t('common.pratihariNijog')}</Text>
                </View>
                <TouchableOpacity onPress={closeMenu} style={styles.menuCloseBtn} activeOpacity={0.7}>
                  <X color="#fff" size={20} />
                </TouchableOpacity>
              </View>
            </LinearGradient>

            <ScrollView style={styles.menuLinks} contentContainerStyle={styles.menuLinksContent}>
              <Text style={styles.menuSectionLabel}>{t('drawer.navigate')}</Text>

              <TouchableOpacity style={styles.menuItem} onPress={() => menuNavigate('/(tabs)')} activeOpacity={0.75}>
                <View style={[styles.menuItemIcon, { backgroundColor: '#FFF0E8' }]}>
                  <House color={C.saffron} size={18} />
                </View>
                <Text style={[styles.menuItemText, odiaFont]}>{t('drawer.home')}</Text>
                <ChevronRight color={C.textMuted} size={16} />
              </TouchableOpacity>

              <TouchableOpacity style={styles.menuItem} onPress={() => menuNavigate('/(tabs)/profile')} activeOpacity={0.75}>
                <View style={[styles.menuItemIcon, { backgroundColor: '#EBF5FB' }]}>
                  <User color="#1D6FAE" size={18} />
                </View>
                <Text style={[styles.menuItemText, odiaFont]}>{t('drawer.myProfile')}</Text>
                <ChevronRight color={C.textMuted} size={16} />
              </TouchableOpacity>

              {isApproved ? (
                <>
                  <TouchableOpacity style={styles.menuItem} onPress={() => menuNavigate('/(tabs)/schedule')} activeOpacity={0.75}>
                    <View style={[styles.menuItemIcon, { backgroundColor: '#EBF5FB' }]}>
                      <Calendar color="#1D6FAE" size={18} />
                    </View>
                    <Text style={[styles.menuItemText, odiaFont]}>{t('drawer.sebaSchedule')}</Text>
                    <ChevronRight color={C.textMuted} size={16} />
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.menuItem} onPress={() => menuNavigate('/notice')} activeOpacity={0.75}>
                    <View style={[styles.menuItemIcon, { backgroundColor: '#EBF7F4' }]}>
                      <Bell color="#1A7A6A" size={18} />
                    </View>
                    <Text style={[styles.menuItemText, odiaFont]}>{t('drawer.notices')}</Text>
                    {unreadNoticeCount > 0 && (
                      <View style={styles.menuBadge}><Text style={styles.menuBadgeText}>{unreadNoticeCount}</Text></View>
                    )}
                    <ChevronRight color={C.textMuted} size={16} />
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.menuItem} onPress={() => menuNavigate('/committee')} activeOpacity={0.75}>
                    <View style={[styles.menuItemIcon, { backgroundColor: '#F0FFF4' }]}>
                      <Users color="#27AE60" size={18} />
                    </View>
                    <Text style={[styles.menuItemText, odiaFont]}>{t('drawer.committee')}</Text>
                    <ChevronRight color={C.textMuted} size={16} />
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.menuItem} onPress={() => menuNavigate('/application')} activeOpacity={0.75}>
                    <View style={[styles.menuItemIcon, { backgroundColor: '#FFF8F0' }]}>
                      <FileText color={C.gold} size={18} />
                    </View>
                    <Text style={[styles.menuItemText, odiaFont]}>{t('drawer.application')}</Text>
                    <ChevronRight color={C.textMuted} size={16} />
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.menuItem} onPress={() => menuNavigate('/pali-history')} activeOpacity={0.75}>
                    <View style={[styles.menuItemIcon, { backgroundColor: '#FFF3CD' }]}>
                      <BookOpen color="#B7770D" size={18} />
                    </View>
                    <Text style={[styles.menuItemText, odiaFont]}>{t('drawer.paliHistory')}</Text>
                    <ChevronRight color={C.textMuted} size={16} />
                  </TouchableOpacity>
                </>
              ) : (
                <View style={styles.langSection}>
                  <View style={styles.langSectionHeader}>
                    <Settings color={C.saffron} size={15} />
                    <Text style={[styles.langSectionTitle, odiaFont]}>{t('profile.languageLabel')}</Text>
                  </View>
                  <Text style={[styles.langSectionHint, odiaFont]}>{t('profile.languageHint')}</Text>
                  <View style={styles.langOptions}>
                    {SUPPORTED_LANGUAGES.map((lang) => {
                      const active = language === lang.code;
                      return (
                        <TouchableOpacity
                          key={lang.code}
                          style={[styles.langOption, active && styles.langOptionActive]}
                          onPress={() => setLanguage(lang.code as any)}
                          activeOpacity={0.75}
                        >
                          <Text style={[styles.langOptionText, active && styles.langOptionTextActive]}>
                            {lang.nativeLabel}
                          </Text>
                          {active && <ChevronRight color={C.saffron} size={14} style={{ opacity: 0 }} />}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  <View style={styles.pendingNote}>
                    <Lock color={C.textMuted} size={12} />
                    <Text style={[styles.pendingNoteText, odiaFont]}>{t('drawer.availableAfterApproval')}</Text>
                  </View>
                </View>
              )}

              <View style={styles.menuDivider} />
              <Text style={styles.menuSectionLabel}>{t('drawer.account')}</Text>

              <TouchableOpacity style={styles.menuItem} onPress={() => menuNavigate('/(tabs)/profile')} activeOpacity={0.75}>
                <View style={[styles.menuItemIcon, { backgroundColor: '#F5F5F5' }]}>
                  <Settings color={C.textSecondary} size={18} />
                </View>
                <Text style={[styles.menuItemText, odiaFont]}>{t('drawer.settings')}</Text>
                <ChevronRight color={C.textMuted} size={16} />
              </TouchableOpacity>
            </ScrollView>
          </Animated.View>
        </View>
      )}

      {/* Startup Notice Modal */}
      {showStartupNotice && startupNotices[startupNoticeIndex] && (() => {
        const notice = startupNotices[startupNoticeIndex];
        const total = startupNotices.length;
        const current = startupNoticeIndex + 1;
        const catColors: Record<string, { color: string; bg: string; label: string }> = {
          general: { color: '#1D6FAE', bg: '#EBF5FB', label: 'General' },
          duty:    { color: '#B7770D', bg: '#FFF3CD', label: 'Duty' },
          event:   { color: '#27AE60', bg: '#F0FFF4', label: 'Event' },
          urgent:  { color: '#C0392B', bg: '#FFF5F5', label: 'Urgent' },
        };
        const cat = catColors[notice.category] ?? catColors.general;
        const isUrgent = notice.category === 'urgent';
        return (
          <Modal
            visible={showStartupNotice}
            transparent
            animationType="fade"
            onRequestClose={dismissStartupNotice}
          >
            <Pressable style={styles.noticeOverlay} onPress={dismissStartupNotice}>
              <Pressable style={styles.noticeModal} onPress={(e) => e.stopPropagation()}>
                {/* Header bar */}
                <LinearGradient
                  colors={isUrgent ? ['#C0392B', '#922B21'] : ['#1A7A6A', '#145E52']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.noticeModalHeader}
                >
                  <View style={styles.noticeModalHeaderLeft}>
                    <Bell color="rgba(255,255,255,0.9)" size={18} />
                    <Text style={[styles.noticeModalHeaderTitle, odiaFont]}>{t('home.notice')}</Text>
                    {total > 1 && (
                      <View style={styles.noticeCounter}>
                        <Text style={styles.noticeCounterText}>{current}/{total}</Text>
                      </View>
                    )}
                  </View>
                  <TouchableOpacity onPress={dismissStartupNotice} style={styles.noticeCloseBtn} activeOpacity={0.7}>
                    <X color="#fff" size={18} />
                  </TouchableOpacity>
                </LinearGradient>

                {/* Body */}
                <ScrollView style={styles.noticeModalBody} showsVerticalScrollIndicator={false}>
                  {/* Category + pinned */}
                  <View style={styles.noticeMetaRow}>
                    <View style={[styles.noticeCatBadge, { backgroundColor: cat.bg }]}>
                      <Text style={[styles.noticeCatText, { color: cat.color }]}>{cat.label}</Text>
                    </View>
                    {notice.pinned && (
                      <View style={styles.noticePinBadge}>
                        <Pin color={C.gold} size={10} />
                        <Text style={styles.noticePinText}>Pinned</Text>
                      </View>
                    )}
                    <Text style={styles.noticeTime}>
                      {notice.published_at
                        ? new Date(notice.published_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                        : ''}
                    </Text>
                  </View>

                  <Text style={[styles.noticeTitle, isUrgent && { color: '#C0392B' }, odiaFont]}>{pickLocalized(notice as any, 'title', language)}</Text>
                  <View style={[styles.noticeDivider, { backgroundColor: cat.color + '30' }]} />
                  <Text style={[styles.noticeBody, odiaFont]}>{pickLocalized(notice as any, 'body', language)}</Text>
                  <View style={{ height: 8 }} />
                </ScrollView>

                {/* Footer */}
                <View style={styles.noticeModalFooter}>
                  {total > 1 && (
                    <View style={styles.noticeDots}>
                      {startupNotices.map((_, i) => (
                        <View
                          key={i}
                          style={[styles.noticeDot, i === startupNoticeIndex && styles.noticeDotActive]}
                        />
                      ))}
                    </View>
                  )}
                  <TouchableOpacity
                    style={[styles.noticeDismissBtn, isUrgent && { backgroundColor: '#C0392B' }]}
                    onPress={dismissStartupNotice}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.noticeDismissText, odiaFont]}>
                      {current < total ? t('common.next') : t('home.gotIt')}
                    </Text>
                    {current < total && <ChevronRight color="#fff" size={16} />}
                  </TouchableOpacity>
                </View>
              </Pressable>
            </Pressable>
          </Modal>
        );
      })()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.warmWhite },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Menu modal
  menuBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  menuSheet: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: DRAWER_W,
    backgroundColor: C.warmWhite,
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 20,
  },
  menuHeader: {
    paddingTop: Platform.OS === 'ios' ? 52 : 16,
    paddingBottom: 20,
    paddingHorizontal: 16,
  },
  menuHeaderInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuAvatarWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    flexShrink: 0,
  },
  menuAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  menuAvatarFallback: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuAvatarInitial: {
    fontSize: 22,
    fontFamily: 'Poppins_700Bold',
    color: '#fff',
  },
  menuName: {
    fontSize: 15,
    fontFamily: 'Poppins_700Bold',
    color: '#fff',
  },
  menuPhone: {
    fontSize: 12,
    fontFamily: 'Poppins_400Regular',
    color: 'rgba(255,255,255,0.85)',
    marginTop: 1,
  },
  menuNijog: {
    fontSize: 11,
    fontFamily: 'Poppins_400Regular',
    color: 'rgba(255,255,255,0.75)',
    marginTop: 1,
  },
  menuCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  menuLinks: { flex: 1 },
  menuLinksContent: { paddingVertical: 12, paddingHorizontal: 12 },
  menuSectionLabel: {
    fontSize: 10,
    fontFamily: 'Poppins_700Bold',
    color: C.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingHorizontal: 8,
    marginBottom: 6,
    marginTop: 4,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 12,
    marginBottom: 2,
  },
  menuItemIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  menuItemText: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Poppins_500Medium',
    color: C.textPrimary,
  },
  menuBadge: {
    backgroundColor: C.error,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  menuBadgeText: {
    fontSize: 11,
    fontFamily: 'Poppins_700Bold',
    color: '#fff',
  },
  menuDivider: {
    height: 1,
    backgroundColor: C.border,
    marginVertical: 10,
    marginHorizontal: 8,
  },
  langSection: {
    marginTop: 8,
    marginHorizontal: 8,
    backgroundColor: '#FFF8F0',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(232,115,42,0.15)',
  },
  langSectionHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 7,
    marginBottom: 4,
  },
  langSectionTitle: {
    fontSize: 13,
    fontFamily: 'Poppins_600SemiBold',
    color: C.textPrimary,
  },
  langSectionHint: {
    fontSize: 11,
    fontFamily: 'Poppins_400Regular',
    color: C.textMuted,
    marginBottom: 12,
  },
  langOptions: {
    flexDirection: 'row' as const,
    gap: 8,
  },
  langOption: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: C.border,
  },
  langOptionActive: {
    borderColor: C.saffron,
    backgroundColor: 'rgba(232,115,42,0.06)',
  },
  langOptionText: {
    fontSize: 13,
    fontFamily: 'Poppins_500Medium',
    color: C.textSecondary,
  },
  langOptionTextActive: {
    color: C.saffron,
    fontFamily: 'Poppins_600SemiBold',
  },
  pendingNote: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 5,
    marginTop: 10,
  },
  pendingNoteText: {
    fontSize: 11,
    fontFamily: 'Poppins_400Regular',
    color: C.textMuted,
    fontStyle: 'italic' as const,
  },

  // Header
  headerGradient: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 52,
  },
  contentWrapper: {
    backgroundColor: C.warmWhite,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    marginTop: -28,
    paddingTop: 8,
    flex: 1,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 20,
  },
  headerWelcomeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2.5,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  headerAvatarFallback: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderWidth: 2.5,
    borderColor: 'rgba(255,255,255,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatarInitial: {
    fontSize: 26,
    fontFamily: 'Poppins_700Bold',
    color: '#fff',
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 28,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  searchPlaceholder: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Poppins_400Regular',
    color: 'rgba(255,255,255,0.6)',
  },

  // Search overlay
  searchOverlay: {
    flex: 1,
    backgroundColor: C.warmWhite,
  },
  searchOverlayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 14,
  },
  searchOverlayBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  searchOverlayInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Poppins_400Regular',
    color: '#fff',
    padding: 0,
  },
  searchCancelBtn: {
    paddingVertical: 6,
    paddingLeft: 4,
  },
  searchCancelText: {
    fontSize: 14,
    fontFamily: 'Poppins_600SemiBold',
    color: '#fff',
  },
  searchResultsList: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 40,
  },
  searchStateWrap: {
    alignItems: 'center',
    paddingTop: 60,
    gap: 8,
  },
  searchEmptyTitle: {
    fontSize: 17,
    fontFamily: 'Poppins_600SemiBold',
    color: C.textPrimary,
  },
  searchStateText: {
    fontSize: 13,
    fontFamily: 'Poppins_400Regular',
    color: C.textMuted,
    textAlign: 'center',
    maxWidth: 280,
  },
  searchResultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginTop: 10,
    borderWidth: 1,
    borderColor: C.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  searchResultAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: C.border,
  },
  searchResultAvatarFallback: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: C.saffron + '20',
    borderWidth: 1.5,
    borderColor: C.saffron + '40',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchResultInitials: {
    fontSize: 17,
    fontFamily: 'Poppins_700Bold',
    color: C.saffron,
  },
  searchResultInfo: {
    flex: 1,
    gap: 4,
  },
  searchResultName: {
    fontSize: 15,
    fontFamily: 'Poppins_600SemiBold',
    color: C.textPrimary,
  },
  searchResultMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  searchResultChip: {
    backgroundColor: C.textMuted + '18',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  searchResultChipText: {
    fontSize: 11,
    fontFamily: 'Poppins_500Medium',
    color: C.textSecondary,
  },
  searchResultSahi: {
    fontSize: 11,
    fontFamily: 'Poppins_400Regular',
    color: C.textMuted,
  },
  menuBtn: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  welcomeSmall: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
    fontFamily: 'Poppins_400Regular',
    marginBottom: 4,
  },
  headerName: {
    fontSize: 24,
    fontFamily: 'Poppins_700Bold',
    color: '#fff',
    lineHeight: 32,
  },
  headerPhone: {
    fontSize: 14,
    fontFamily: 'Poppins_400Regular',
    color: 'rgba(255,255,255,0.85)',
    marginTop: 4,
  },
  headerNijog: {
    fontSize: 13,
    fontFamily: 'Poppins_400Regular',
    color: 'rgba(255,255,255,0.75)',
    marginTop: 2,
  },

  // Active duty banner
  activeDutyBanner: {
    marginHorizontal: 16,
    marginTop: -16,
    borderRadius: 18,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: C.saffron,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  activeDutyLeft: { flex: 1 },
  activeDutyTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 6,
  },
  activeDutyTitle: {
    fontSize: 20,
    fontFamily: 'Poppins_700Bold',
    color: '#fff',
  },
  nijogBadge: {
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  nijogBadgeText: {
    fontSize: 9,
    fontFamily: 'Poppins_700Bold',
    color: '#fff',
    letterSpacing: 1.2,
  },
  activeDutyMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flexWrap: 'wrap',
  },
  activeDutyMetaText: {
    fontSize: 12,
    fontFamily: 'Poppins_400Regular',
    color: 'rgba(255,255,255,0.9)',
  },
  activeDutyDot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  activeDutyBtn: {
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flexShrink: 0,
    marginLeft: 12,
  },
  activeDutyBtnEnd: {
    backgroundColor: '#C0392B',
  },
  activeDutyBtnText: {
    fontSize: 13,
    fontFamily: 'Poppins_700Bold',
    color: C.saffron,
  },
  inProgressBadge: {
    backgroundColor: 'rgba(74,222,128,0.25)',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: 'rgba(74,222,128,0.5)',
  },
  inProgressBadgeText: {
    fontSize: 9,
    fontFamily: 'Poppins_700Bold',
    color: '#4ADE80',
    letterSpacing: 0.8,
  },
  doneBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  doneBadgeText: {
    fontSize: 9,
    fontFamily: 'Poppins_700Bold',
    color: '#fff',
    letterSpacing: 0.8,
  },
  elapsedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  elapsedText: {
    fontSize: 13,
    fontFamily: 'Poppins_700Bold',
    color: '#4ADE80',
  },

  // Today beddha banner
  beddhaBanner: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
  },
  beddhaBannerGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 20,
    paddingHorizontal: 20,
    gap: 12,
  },
  beddhaBannerLeft: { flex: 1, gap: 6 },
  beddhaBannerDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  beddhaBannerDateText: {
    fontSize: 10,
    fontFamily: 'Poppins_600SemiBold',
    color: '#4ADE80',
    letterSpacing: 0.5,
  },
  beddhaBannerTitle: {
    fontSize: 22,
    fontFamily: 'Poppins_700Bold',
    color: '#fff',
    lineHeight: 28,
  },
  beddhaBannerChips: {
    flexDirection: 'row',
    gap: 8,
    flexShrink: 0,
  },
  beddhaChip: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
    minWidth: 72,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  beddhaChipLabel: {
    fontSize: 9,
    fontFamily: 'Poppins_600SemiBold',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  beddhaChipNum: {
    fontSize: 26,
    fontFamily: 'Poppins_700Bold',
    color: '#4ADE80',
    lineHeight: 30,
  },

  // Section header
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginHorizontal: 16,
    marginTop: 20,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: 'Poppins_600SemiBold',
    color: C.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },

  // Duty cards
  dutyCard: {
    marginHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
    marginBottom: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  nextCard: {
    backgroundColor: '#FFFDF5',
    borderColor: C.gold + '55',
  },
  dutyCardLeft: { flex: 1 },
  nextDateLabel: {
    fontSize: 12,
    fontFamily: 'Poppins_600SemiBold',
    color: C.gold,
    marginBottom: 4,
  },
  dutySebaName: {
    fontSize: 17,
    fontFamily: 'Poppins_700Bold',
    color: C.textPrimary,
    marginBottom: 6,
  },
  beddhaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  beddhaText: {
    fontSize: 13,
    fontFamily: 'Poppins_500Medium',
  },


  // Feature grid
  featureGrid: {
    flexDirection: 'row',
    gap: 12,
    marginHorizontal: 16,
    marginTop: 12,
  },
  featureCard: {
    flex: 1,
    borderRadius: 18,
    padding: 16,
  },
  featureIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  featureIconWithBadge: {
    position: 'relative',
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  noticeBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: C.error,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  noticeBadgeText: {
    fontSize: 10,
    fontFamily: 'Poppins_700Bold',
    color: '#fff',
  },
  featureTitle: {
    fontSize: 15,
    fontFamily: 'Poppins_700Bold',
    marginBottom: 4,
  },
  featureDesc: {
    fontSize: 12,
    fontFamily: 'Poppins_400Regular',
    color: C.textSecondary,
    lineHeight: 17,
  },

  // Pratihari Seba banner
  sebaBannerWrap: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 18,
    overflow: 'hidden',
  },
  sebaBanner: {
    paddingVertical: 22,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  sebaBannerTitle: {
    fontSize: 22,
    fontFamily: 'Poppins_700Bold',
    color: '#fff',
    marginBottom: 4,
  },
  sebaBannerSub: {
    fontSize: 13,
    fontFamily: 'Poppins_400Regular',
    color: 'rgba(255,255,255,0.85)',
  },

  // Carousel
  carouselWrap: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: 4,
  },
  carouselSlide: {
    width: SCREEN_WIDTH - 32,
    height: 200,
    position: 'relative',
    overflow: 'hidden',
  },
  carouselImage: {
    width: '100%',
    height: '100%',
  },
  carouselOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingVertical: 20,
    paddingHorizontal: 20,
  },
  carouselTitle: {
    fontSize: 20,
    fontFamily: 'Poppins_700Bold',
    color: '#fff',
  },
  carouselSubtitle: {
    fontSize: 13,
    fontFamily: 'Poppins_400Regular',
    color: 'rgba(255,255,255,0.85)',
  },
  dotRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    backgroundColor: '#1C1C1C',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  dotActive: {
    backgroundColor: '#fff',
    width: 20,
    borderRadius: 3,
  },

  // Non-approved CTA card
  ctaCard: {
    marginHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
    marginBottom: 12,
    marginTop: 8,
  },
  ctaIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  ctaBody: { flex: 1 },
  ctaTitle: { fontSize: 16, fontFamily: 'Poppins_700Bold', marginBottom: 4 },
  ctaDesc: {
    fontSize: 13,
    fontFamily: 'Poppins_400Regular',
    color: C.textSecondary,
    lineHeight: 20,
    marginBottom: 8,
  },
  ctaActionRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  ctaAction: { fontSize: 13, fontFamily: 'Poppins_600SemiBold' },
  ctaRemarkBox: {
    borderLeftWidth: 3,
    paddingLeft: 10,
    paddingVertical: 8,
    paddingRight: 8,
    backgroundColor: 'rgba(0,0,0,0.04)',
    borderRadius: 6,
    marginBottom: 10,
  },
  ctaRemarkLabel: {
    fontSize: 10,
    fontFamily: 'Poppins_700Bold',
    color: C.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  ctaRemarkText: {
    fontSize: 13,
    fontFamily: 'Poppins_400Regular',
    color: C.textPrimary,
    lineHeight: 20,
  },

  // About section
  infoSection: {
    marginHorizontal: 16,
    marginTop: 8,
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    padding: 18,
    marginBottom: 32,
  },
  infoTitle: {
    fontSize: 14,
    fontFamily: 'Poppins_700Bold',
    color: C.textPrimary,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 13,
    fontFamily: 'Poppins_400Regular',
    color: C.textSecondary,
    lineHeight: 22,
  },

  // Startup notice modal
  noticeOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  noticeModal: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: C.warmWhite,
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 20,
  },
  noticeModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  noticeModalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  noticeModalHeaderTitle: {
    fontSize: 16,
    fontFamily: 'Poppins_700Bold',
    color: '#fff',
  },
  noticeCounter: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  noticeCounterText: {
    fontSize: 11,
    fontFamily: 'Poppins_600SemiBold',
    color: '#fff',
  },
  noticeCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  noticeModalBody: {
    paddingHorizontal: 20,
    paddingTop: 18,
    maxHeight: 320,
  },
  noticeMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  noticeCatBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
  },
  noticeCatText: {
    fontSize: 11,
    fontFamily: 'Poppins_600SemiBold',
  },
  noticePinBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FFF8E8',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: C.gold + '50',
  },
  noticePinText: {
    fontSize: 10,
    fontFamily: 'Poppins_600SemiBold',
    color: C.gold,
  },
  noticeTime: {
    fontSize: 11,
    fontFamily: 'Poppins_400Regular',
    color: C.textMuted,
    marginLeft: 'auto',
  },
  noticeTitle: {
    fontSize: 19,
    fontFamily: 'Poppins_700Bold',
    color: C.textPrimary,
    lineHeight: 26,
    marginBottom: 14,
  },
  noticeDivider: {
    height: 2,
    borderRadius: 1,
    marginBottom: 14,
  },
  noticeBody: {
    fontSize: 14,
    fontFamily: 'Poppins_400Regular',
    color: C.textSecondary,
    lineHeight: 24,
  },
  noticeModalFooter: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: C.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  noticeDots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  noticeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: C.border,
  },
  noticeDotActive: {
    backgroundColor: C.teal,
    width: 18,
  },
  noticeDismissBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#1A7A6A',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 11,
    marginLeft: 'auto',
  },
  noticeDismissText: {
    fontSize: 14,
    fontFamily: 'Poppins_600SemiBold',
    color: '#fff',
  },
});
