import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Users, ChevronDown, ChevronUp, Phone, Star, CircleCheck as CheckCircle, User } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useOffline } from '@/contexts/OfflineContext';
import { hydrateFromCache, writeCache } from '@/lib/cachedQuery';
import { OfflineBanner } from '@/components/OfflineBanner';
import { useDrawer, DrawerPanel, MenuButton } from '@/components/SlideDrawer';
import { CachedImage } from '@/components/CachedImage';
import { prewarmImages } from '@/lib/imageCache';
import { useLanguage } from '@/contexts/LanguageContext';
import { pickLocalized } from '@/lib/i18n';

const C = {
  green: '#2B7A30',
  greenDark: '#1E5C22',
  greenLight: '#F0FDF4',
  saffron: '#E8732A',
  gold: '#D4A843',
  cream: '#FFF8F0',
  warmWhite: '#FFFDF9',
  textPrimary: '#2D1810',
  textSecondary: '#6B4C3B',
  textMuted: '#9B8578',
  border: '#E8D5C4',
};

interface CommitteeMember {
  id: string;
  name: string;
  name_or: string;
  role: string;
  role_or: string;
  role_order: number;
  photo_url: string;
  phone: string;
  bio: string;
  description_or: string;
}

interface Committee {
  id: string;
  year: number;
  title: string;
  title_or: string;
  description: string;
  description_or: string;
  is_active: boolean;
  committee_members: CommitteeMember[];
}

const ROLE_COLORS: Record<string, { bg: string; color: string }> = {
  'President':        { bg: '#FEF3C7', color: '#92400E' },
  'Vice President':   { bg: '#FEF9C3', color: '#713F12' },
  'Secretary':        { bg: '#DBEAFE', color: '#1E40AF' },
  'Joint Secretary':  { bg: '#EFF6FF', color: '#1D4ED8' },
  'Treasurer':        { bg: '#D1FAE5', color: '#065F46' },
  'Joint Treasurer':  { bg: '#ECFDF5', color: '#047857' },
  'Advisor':          { bg: '#F3E8FF', color: '#6B21A8' },
};

function getRoleStyle(role: string) {
  return ROLE_COLORS[role] ?? { bg: '#F3F4F6', color: '#374151' };
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export default function CommitteeScreen() {
  const drawer = useDrawer();
  const router = useRouter();
  const { user, profileStatus, profileStatusLoading } = useAuth();
  const { isOnline, offlineEnabled } = useOffline();
  const { t, language } = useLanguage();

  if (!profileStatusLoading && profileStatus !== 'approved') {
    router.replace('/(tabs)');
    return null;
  }
  const [committees, setCommittees] = useState<Committee[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchCommittees = useCallback(async (isRefresh = false) => {
    if (!isOnline) {
      if (isRefresh) setRefreshing(false); else setLoading(false);
      return;
    }
    if (isRefresh) setRefreshing(true); else if (committees.length === 0) setLoading(true);

    const { data } = await supabase
      .from('committees')
      .select('id, year, title, title_or, description, description_or, is_active, committee_members(id, name, name_or, role, role_or, role_order, photo_url, phone, bio, description_or)')
      .order('year', { ascending: false });

    if (isRefresh) setRefreshing(false); else setLoading(false);

    const sorted = (data as Committee[] ?? []).map((c) => ({
      ...c,
      committee_members: (c.committee_members || []).sort((a, b) => a.role_order - b.role_order),
    }));
    setCommittees(sorted);
    if (offlineEnabled && user) await writeCache(user.id, 'committee', sorted);
    prewarmImages(sorted.flatMap((c) => c.committee_members.map((m) => m.photo_url)));

    // Auto-expand the active committee
    const active = sorted.find((c) => c.is_active);
    if (active) setExpandedId(active.id);
  }, [isOnline, offlineEnabled, user, committees.length]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      if (offlineEnabled) {
        const res = await hydrateFromCache<Committee[]>(user.id, 'committee', (rows) => {
          setCommittees(rows);
          const active = rows.find((c) => c.is_active);
          if (active) setExpandedId(active.id);
        });
        if (res.cachedAt) setLoading(false);
      }
    })();
  }, [user, offlineEnabled]);

  useEffect(() => {
    fetchCommittees();
  }, [fetchCommittees]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <LinearGradient colors={['#2B7A30', '#1E5C22']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
            <ArrowLeft color="#fff" size={22} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Users color="rgba(255,255,255,0.85)" size={20} />
            <Text style={styles.headerTitle}>{t('committee.title')}</Text>
          </View>
        </LinearGradient>
        <View style={styles.center}>
          <ActivityIndicator color={C.green} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <OfflineBanner />
      <LinearGradient colors={['#2B7A30', '#1E5C22']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <ArrowLeft color="#fff" size={22} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Users color="rgba(255,255,255,0.85)" size={20} />
          <Text style={styles.headerTitle}>{t('committee.title')}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={styles.headerBadge}>
            <Text style={styles.headerBadgeText}>{t('committee.terms', { count: committees.length })}</Text>
          </View>
          <MenuButton onPress={drawer.open} />
        </View>
      </LinearGradient>

      <View style={styles.contentWrapper}>
      {committees.length === 0 ? (
        <View style={styles.center}>
          <View style={styles.emptyIcon}>
            <Users color={C.gold} size={36} />
          </View>
          <Text style={styles.emptyTitle}>{t('committee.noCommittees')}</Text>
          <Text style={styles.emptySub}>{t('committee.noCommitteesDesc')}</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchCommittees(true)}
              colors={[C.green]}
              tintColor={C.green}
            />
          }
        >
          <Text style={styles.pageSubtitle}>{t('committee.pageSubtitle')}</Text>

          {committees.map((committee) => {
            const isExpanded = expandedId === committee.id;
            const members = committee.committee_members;

            return (
              <View key={committee.id} style={[styles.committeeCard, committee.is_active && styles.committeeCardActive]}>
                {/* Card header — tap to expand/collapse */}
                <TouchableOpacity
                  style={styles.committeeCardHeader}
                  onPress={() => setExpandedId(isExpanded ? null : committee.id)}
                  activeOpacity={0.85}
                >
                  <View style={styles.committeeCardHeaderLeft}>
                    <View style={[styles.yearBadge, committee.is_active && styles.yearBadgeActive]}>
                      <Text style={[styles.yearBadgeText, committee.is_active && styles.yearBadgeTextActive]}>
                        {committee.year}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={styles.titleRow}>
                        <Text style={styles.committeeTitle} numberOfLines={2}>{pickLocalized(committee, 'title', language)}</Text>
                        {committee.is_active && (
                          <View style={styles.activePill}>
                            <CheckCircle color={C.green} size={11} />
                            <Text style={styles.activePillText}>{t('committee.active')}</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.memberCount}>{t('committee.members', { count: members.length })}</Text>
                    </View>
                  </View>
                  {isExpanded ? (
                    <ChevronUp color={C.textMuted} size={20} />
                  ) : (
                    <ChevronDown color={C.textMuted} size={20} />
                  )}
                </TouchableOpacity>

                {/* Description */}
                {isExpanded && !!(pickLocalized(committee, 'description', language)) && (
                  <View style={styles.descriptionBox}>
                    <Text style={styles.descriptionText}>{pickLocalized(committee, 'description', language)}</Text>
                  </View>
                )}

                {/* Members list */}
                {isExpanded && (
                  <View style={styles.membersWrap}>
                    {members.length === 0 ? (
                      <Text style={styles.noMembersText}>{t('committee.noMembers')}</Text>
                    ) : (
                      members.map((member, idx) => {
                        const rs = getRoleStyle(member.role);
                        const isLast = idx === members.length - 1;
                        const memberName = pickLocalized(member, 'name', language);
                        const memberRole = pickLocalized(member, 'role', language);
                        const memberBio = language === 'or' && member.description_or
                          ? member.description_or
                          : member.bio;
                        return (
                          <View
                            key={member.id}
                            style={[styles.memberRow, !isLast && styles.memberRowBorder]}
                          >
                            {/* Avatar */}
                            <CachedImage
                              uri={member.photo_url}
                              style={styles.avatar}
                              resizeMode="cover"
                              fallback={
                                <View style={styles.avatarPlaceholder}>
                                  <Text style={styles.avatarInitials}>{getInitials(member.name)}</Text>
                                </View>
                              }
                              containerStyle={styles.avatarPlaceholder}
                            />

                            {/* Info */}
                            <View style={styles.memberInfo}>
                              <View style={styles.memberNameRow}>
                                <Text style={styles.memberName}>{memberName}</Text>
                                {member.role === 'President' && (
                                  <Star color={C.gold} size={13} fill={C.gold} />
                                )}
                              </View>
                              <View style={[styles.rolePill, { backgroundColor: rs.bg }]}>
                                <Text style={[styles.rolePillText, { color: rs.color }]}>{memberRole}</Text>
                              </View>
                              {!!memberBio && (
                                <Text style={styles.memberBio} numberOfLines={2}>{memberBio}</Text>
                              )}
                              {!!member.phone && (
                                <View style={styles.phoneRow}>
                                  <Phone color={C.textMuted} size={11} />
                                  <Text style={styles.phoneText}>{member.phone}</Text>
                                </View>
                              )}
                            </View>
                          </View>
                        );
                      })
                    )}
                  </View>
                )}
              </View>
            );
          })}

          <View style={{ height: 40 }} />
        </ScrollView>
      )}
      </View>{/* end contentWrapper */}
      <DrawerPanel {...drawer} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.warmWhite },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: 12 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 52,
    gap: 12,
  },
  contentWrapper: { backgroundColor: '#FFFDF9', borderTopLeftRadius: 32, borderTopRightRadius: 32, marginTop: -28, flex: 1 },
  backBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 18, fontFamily: 'Poppins_700Bold', color: '#fff' },
  headerBadge: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4,
  },
  headerBadgeText: { fontSize: 12, fontFamily: 'Poppins_600SemiBold', color: '#fff' },

  pageSubtitle: {
    fontSize: 13, fontFamily: 'Poppins_400Regular',
    color: C.textMuted, lineHeight: 20,
    marginBottom: 16,
  },

  listContent: { padding: 16 },

  committeeCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 14,
    overflow: 'hidden',
  },
  committeeCardActive: {
    borderColor: C.green + '60',
    shadowColor: C.green,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },

  committeeCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  committeeCardHeaderLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  yearBadge: {
    width: 52, height: 52, borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  yearBadgeActive: { backgroundColor: C.greenLight },
  yearBadgeText: {
    fontSize: 14, fontFamily: 'Poppins_700Bold', color: C.textMuted,
  },
  yearBadgeTextActive: { color: C.green },

  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, flexWrap: 'wrap', marginBottom: 4 },
  committeeTitle: {
    fontSize: 14, fontFamily: 'Poppins_700Bold', color: C.textPrimary,
    lineHeight: 20, flex: 1,
  },
  activePill: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: C.greenLight,
    borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: C.green + '40',
  },
  activePillText: { fontSize: 10, fontFamily: 'Poppins_600SemiBold', color: C.green },

  memberCount: { fontSize: 12, fontFamily: 'Poppins_400Regular', color: C.textMuted },

  descriptionBox: {
    marginHorizontal: 16, marginBottom: 12,
    backgroundColor: '#F9FAFB', borderRadius: 10,
    padding: 12, borderWidth: 1, borderColor: C.border,
  },
  descriptionText: {
    fontSize: 13, fontFamily: 'Poppins_400Regular', color: C.textSecondary, lineHeight: 20,
  },

  membersWrap: {
    borderTopWidth: 1, borderTopColor: C.border,
  },
  noMembersText: {
    fontSize: 13, fontFamily: 'Poppins_400Regular',
    color: C.textMuted, textAlign: 'center',
    paddingVertical: 24,
  },

  memberRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 14,
  },
  memberRowBorder: { borderBottomWidth: 1, borderBottomColor: C.border },

  avatar: { width: 48, height: 48, borderRadius: 24, flexShrink: 0 },
  avatarPlaceholder: {
    width: 48, height: 48, borderRadius: 24, flexShrink: 0,
    backgroundColor: C.greenLight,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: C.green + '30',
  },
  avatarInitials: { fontSize: 16, fontFamily: 'Poppins_700Bold', color: C.green },

  memberInfo: { flex: 1 },
  memberNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 5 },
  memberName: { fontSize: 14, fontFamily: 'Poppins_600SemiBold', color: C.textPrimary },
  rolePill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 9, paddingVertical: 3,
    borderRadius: 20, marginBottom: 5,
  },
  rolePillText: { fontSize: 11, fontFamily: 'Poppins_600SemiBold' },
  memberBio: {
    fontSize: 12, fontFamily: 'Poppins_400Regular',
    color: C.textSecondary, lineHeight: 18, marginBottom: 4,
  },
  phoneRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  phoneText: { fontSize: 12, fontFamily: 'Poppins_400Regular', color: C.textMuted },

  emptyIcon: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: C.cream,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: C.border,
  },
  emptyTitle: { fontSize: 17, fontFamily: 'Poppins_700Bold', color: C.textSecondary },
  emptySub: {
    fontSize: 13, fontFamily: 'Poppins_400Regular',
    color: C.textMuted, textAlign: 'center', lineHeight: 20,
  },
});
