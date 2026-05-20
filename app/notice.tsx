import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowLeft, Megaphone, Bell, Pin, TriangleAlert as AlertTriangle, Calendar, Briefcase, Info, X, ChevronRight } from 'lucide-react-native';
import { useOffline } from '@/contexts/OfflineContext';
import { hydrateFromCache, writeCache } from '@/lib/cachedQuery';
import { OfflineBanner } from '@/components/OfflineBanner';
import { useDrawer, DrawerPanel, MenuButton } from '@/components/SlideDrawer';
import { useLanguage } from '@/contexts/LanguageContext';
import { pickLocalized } from '@/lib/i18n';

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

const CATEGORIES = [
  { key: 'general', labelKey: 'notice.general', color: '#1D6FAE', bg: '#EBF5FB', icon: Info },
  { key: 'duty',    labelKey: 'notice.duty',    color: '#B7770D', bg: '#FFF3CD', icon: Calendar },
  { key: 'event',   labelKey: 'notice.event',   color: '#27AE60', bg: '#F0FFF4', icon: Briefcase },
  { key: 'urgent',  labelKey: 'notice.urgent',  color: '#C0392B', bg: '#FFF5F5', icon: AlertTriangle },
];

function getCat(key: string) {
  return CATEGORIES.find((c) => c.key === key) ?? CATEGORIES[0];
}

interface Notice {
  id: string;
  title: string;
  title_or: string | null;
  body: string;
  body_or: string | null;
  category: string;
  pinned: boolean;
  published_at: string | null;
  target_type: string;
  target_ids: string[];
}

function timeAgo(iso: string | null, t: (key: string, opts?: any) => string) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return t('notice.today');
  if (days === 1) return t('notice.yesterday');
  if (days < 7) return t('notice.daysAgo', { count: days });
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function NoticeScreen() {
  const drawer = useDrawer();
  const router = useRouter();
  const { user, profileStatus, profileStatusLoading } = useAuth();
  const { isOnline, offlineEnabled } = useOffline();
  const { language, t } = useLanguage();

  if (!profileStatusLoading && profileStatus !== 'approved') {
    router.replace('/(tabs)');
    return null;
  }
  const [notices, setNotices] = useState<Notice[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<string>('all');
  const [selected, setSelected] = useState<Notice | null>(null);
  const [sebayatId, setSebayatId] = useState<string | null>(null);
  const [userGroups, setUserGroups] = useState<string[]>([]);

  // Resolve sebayat row and group membership
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: s } = await supabase
        .from('sebayats')
        .select('id')
        .eq('auth_user_id', user.id)
        .maybeSingle();
      if (!s) return;
      setSebayatId(s.id);

      // Resolve group codes via nijog_assignments → seba_categories → seba_groups
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
          setUserGroups((groups || []).map((g: any) => g.code));
        }
      }
    })();
  }, [user]);

  const fetchNotices = useCallback(async (isRefresh = false) => {
    if (!user) return;
    if (!isOnline) {
      if (isRefresh) setRefreshing(false); else setLoading(false);
      return;
    }
    if (isRefresh) setRefreshing(true); else if (notices.length === 0) setLoading(true);

    const { data } = await supabase
      .from('notices')
      .select('id, title, title_or, body, body_or, category, pinned, published_at, target_type, target_ids')
      .eq('is_published', true)
      .order('pinned', { ascending: false })
      .order('published_at', { ascending: false });

    if (isRefresh) setRefreshing(false); else setLoading(false);
    if (!data) return;

    // Client-side targeting filter
    const filtered = data.filter((n: Notice) => {
      if (n.target_type === 'all') return true;
      if (n.target_type === 'group') {
        return (n.target_ids as string[]).some((g) => userGroups.includes(g));
      }
      if (n.target_type === 'individual') {
        return sebayatId ? (n.target_ids as string[]).includes(sebayatId) : false;
      }
      return true;
    });

    setNotices(filtered);
    if (offlineEnabled) await writeCache(user.id, 'notices', filtered);

    // Fetch read state for these notices
    if (filtered.length > 0 && sebayatId) {
      const ids = filtered.map((n: Notice) => n.id);
      const { data: reads } = await supabase
        .from('notice_reads')
        .select('notice_id')
        .eq('sebayat_id', sebayatId)
        .in('notice_id', ids);
      const readSet = new Set((reads || []).map((r: any) => r.notice_id));
      setReadIds(readSet);
      if (offlineEnabled) await writeCache(user.id, 'notice_reads', Array.from(readSet));
    }
  }, [user, sebayatId, userGroups, isOnline, offlineEnabled, notices.length]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      if (offlineEnabled) {
        const [n, r] = await Promise.all([
          hydrateFromCache<Notice[]>(user.id, 'notices', setNotices),
          hydrateFromCache<string[]>(user.id, 'notice_reads', (ids) => setReadIds(new Set(ids))),
        ]);
        if (n.cachedAt || r.cachedAt) setLoading(false);
      }
    })();
  }, [user, offlineEnabled]);

  useEffect(() => {
    fetchNotices();
  }, [fetchNotices]);

  async function markRead(notice: Notice) {
    if (readIds.has(notice.id) || !sebayatId) return;
    if (!isOnline) return; // skip write while offline
    setReadIds((prev) => new Set([...prev, notice.id]));
    await supabase.from('notice_reads').upsert(
      { notice_id: notice.id, sebayat_id: sebayatId, read_at: new Date().toISOString() },
      { onConflict: 'notice_id,sebayat_id' }
    );
  }

  function openDetail(item: Notice) {
    setSelected(item);
    markRead(item);
  }

  const filtered = filter === 'all' ? notices : notices.filter((n) => n.category === filter);
  const unreadCount = notices.filter((n) => !readIds.has(n.id)).length;

  function renderItem({ item }: { item: Notice }) {
    const cat = getCat(item.category);
    const CatIcon = cat.icon;
    const isUrgent = item.category === 'urgent';
    const isUnread = !readIds.has(item.id);

    return (
      <TouchableOpacity
        style={[styles.card, isUrgent && styles.cardUrgent, item.pinned && styles.cardPinned]}
        onPress={() => openDetail(item)}
        activeOpacity={0.85}
      >
        <View style={styles.cardTopRow}>
          <View style={[styles.catBadge, { backgroundColor: cat.bg }]}>
            <CatIcon color={cat.color} size={11} />
            <Text style={[styles.catText, { color: cat.color }]}>{t(cat.labelKey)}</Text>
          </View>
          <View style={styles.cardTopRight}>
            {item.pinned && (
              <View style={styles.pinBadge}>
                <Pin color={C.gold} size={10} />
                <Text style={styles.pinText}>{t('notice.pinned')}</Text>
              </View>
            )}
            {isUnread && <View style={styles.unreadDot} />}
            <Text style={styles.cardTime}>{timeAgo(item.published_at, t)}</Text>
          </View>
        </View>

        <Text style={[styles.cardTitle, isUrgent && { color: C.error }, isUnread && { fontFamily: 'Poppins_700Bold' }]} numberOfLines={2}>
          {pickLocalized(item as any, 'title', language)}
        </Text>
        <Text style={styles.cardPreview} numberOfLines={2}>{pickLocalized(item as any, 'body', language)}</Text>

        <View style={styles.readMore}>
          <Text style={[styles.readMoreText, { color: cat.color }]}>{t('notice.readMore')}</Text>
          <ChevronRight color={cat.color} size={14} />
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <OfflineBanner />
      <LinearGradient colors={['#1A7A6A', '#145E52']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <ArrowLeft color="#fff" size={22} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Megaphone color="rgba(255,255,255,0.85)" size={20} />
          <Text style={styles.headerTitle}>{t('notice.title')}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {!loading && unreadCount > 0 && (
            <View style={styles.unreadHeaderBadge}>
              <Text style={styles.unreadHeaderText}>{t('notice.newBadge', { count: unreadCount })}</Text>
            </View>
          )}
          <MenuButton onPress={drawer.open} />
        </View>
      </LinearGradient>

      <View style={styles.contentWrapper}>
      {/* Category filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterContent}
      >
        <TouchableOpacity
          style={[styles.filterChip, filter === 'all' && styles.filterChipActive]}
          onPress={() => setFilter('all')}
          activeOpacity={0.7}
        >
          <Text style={[styles.filterChipText, filter === 'all' && styles.filterChipTextActive]}>{t('notice.all')}</Text>
        </TouchableOpacity>
        {CATEGORIES.map((cat) => {
          const CatIcon = cat.icon;
          const active = filter === cat.key;
          return (
            <TouchableOpacity
              key={cat.key}
              style={[styles.filterChip, active && { backgroundColor: cat.bg, borderColor: cat.color }]}
              onPress={() => setFilter(cat.key)}
              activeOpacity={0.7}
            >
              <CatIcon color={active ? cat.color : C.textMuted} size={13} />
              <Text style={[styles.filterChipText, active && { color: cat.color }]}>{t(cat.labelKey)}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={C.saffron} size="large" /></View>
      ) : filtered.length === 0 ? (
        <View style={styles.center}>
          <View style={styles.emptyIcon}><Bell color={C.gold} size={40} /></View>
          <Text style={styles.emptyTitle}>{t('notice.noNotices')}</Text>
          <Text style={styles.emptySub}>
            {filter === 'all'
              ? t('notice.noNoticesAll')
              : t('notice.noNoticesCategory', { category: t(getCat(filter).labelKey).toLowerCase() })}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchNotices(true)}
              colors={[C.saffron]}
              tintColor={C.saffron}
            />
          }
        />
      )}
      </View>{/* end contentWrapper */}

      {/* Detail Modal */}
      <Modal
        visible={!!selected}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSelected(null)}
      >
        {selected && (() => {
          const cat = getCat(selected.category);
          const CatIcon = cat.icon;
          return (
            <SafeAreaView style={styles.detailContainer} edges={['top']}>
              <View style={styles.detailHeader}>
                <TouchableOpacity onPress={() => setSelected(null)} style={styles.detailCloseBtn} activeOpacity={0.7}>
                  <X color={C.textSecondary} size={22} />
                </TouchableOpacity>
                <View style={[styles.catBadge, { backgroundColor: cat.bg }]}>
                  <CatIcon color={cat.color} size={12} />
                  <Text style={[styles.catText, { color: cat.color }]}>{t(cat.labelKey)}</Text>
                </View>
                {selected.pinned && (
                  <View style={styles.pinBadge}>
                    <Pin color={C.gold} size={11} />
                    <Text style={styles.pinText}>{t('notice.pinned')}</Text>
                  </View>
                )}
              </View>
              <ScrollView style={styles.detailScroll} showsVerticalScrollIndicator={false}>
                <Text style={styles.detailTime}>{timeAgo(selected.published_at, t)}</Text>
                <Text style={[styles.detailTitle, selected.category === 'urgent' && { color: C.error }]}>
                  {pickLocalized(selected as any, 'title', language)}
                </Text>
                <View style={[styles.detailDivider, { backgroundColor: cat.color + '30' }]} />
                <Text style={styles.detailBody}>{pickLocalized(selected as any, 'body', language)}</Text>
                <View style={{ height: 48 }} />
              </ScrollView>
            </SafeAreaView>
          );
        })()}
      </Modal>
      <DrawerPanel {...drawer} unreadNoticeCount={unreadCount} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.warmWhite },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: 12 },

  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 52, gap: 12 },
  contentWrapper: { backgroundColor: '#FFFDF9', borderTopLeftRadius: 32, borderTopRightRadius: 32, marginTop: -28, flex: 1 },
  backBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 18, fontFamily: 'Poppins_700Bold', color: '#fff' },
  unreadHeaderBadge: { backgroundColor: C.saffron, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  unreadHeaderText: { fontSize: 12, fontFamily: 'Poppins_600SemiBold', color: '#fff' },

  filterScroll: { maxHeight: 52 },
  filterContent: { paddingHorizontal: 16, paddingVertical: 10, gap: 8, flexDirection: 'row', alignItems: 'center' },
  filterChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: C.border },
  filterChipActive: { backgroundColor: C.teal, borderColor: C.teal },
  filterChipText: { fontSize: 12, fontFamily: 'Poppins_500Medium', color: C.textMuted },
  filterChipTextActive: { color: '#fff' },

  listContent: { padding: 16, gap: 12 },

  card: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 16 },
  cardUrgent: { borderColor: '#C0392B40', backgroundColor: '#FFFBFB' },
  cardPinned: { borderColor: C.gold + '60' },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  catBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  catText: { fontSize: 11, fontFamily: 'Poppins_600SemiBold' },
  cardTopRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pinBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#FFF8E8', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: C.gold + '50' },
  pinText: { fontSize: 10, fontFamily: 'Poppins_600SemiBold', color: C.gold },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.saffron },
  cardTime: { fontSize: 11, fontFamily: 'Poppins_400Regular', color: C.textMuted },
  cardTitle: { fontSize: 15, fontFamily: 'Poppins_600SemiBold', color: C.textPrimary, marginBottom: 6, lineHeight: 22 },
  cardPreview: { fontSize: 13, fontFamily: 'Poppins_400Regular', color: C.textSecondary, lineHeight: 20, marginBottom: 10 },
  readMore: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  readMoreText: { fontSize: 12, fontFamily: 'Poppins_600SemiBold' },

  emptyIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: C.cream, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.border },
  emptyTitle: { fontSize: 17, fontFamily: 'Poppins_700Bold', color: C.textSecondary },
  emptySub: { fontSize: 13, fontFamily: 'Poppins_400Regular', color: C.textMuted, textAlign: 'center', lineHeight: 20 },

  detailContainer: { flex: 1, backgroundColor: C.warmWhite },
  detailHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.border, gap: 10 },
  detailCloseBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#F5F0EC', alignItems: 'center', justifyContent: 'center', marginRight: 4 },
  detailScroll: { flex: 1, paddingHorizontal: 24, paddingTop: 24 },
  detailTime: { fontSize: 12, fontFamily: 'Poppins_400Regular', color: C.textMuted, marginBottom: 8 },
  detailTitle: { fontSize: 22, fontFamily: 'Poppins_700Bold', color: C.textPrimary, lineHeight: 30, marginBottom: 16 },
  detailDivider: { height: 2, borderRadius: 1, marginBottom: 20 },
  detailBody: { fontSize: 15, fontFamily: 'Poppins_400Regular', color: C.textSecondary, lineHeight: 26 },
});
