import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useOffline } from '@/contexts/OfflineContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useDrawer, DrawerPanel, MenuButton } from '@/components/SlideDrawer';
import { OfflineBanner } from '@/components/OfflineBanner';
import {
  Bell,
  BellRing,
  CheckCheck,
  ChevronRight,
  Calendar,
  FileText,
  Megaphone,
  UserCheck,
  CircleAlert as AlertCircle,
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
  teal: '#1A7A6A',
};

type SebayatNotification = {
  id: string;
  event_key: string;
  title: string;
  body: string;
  reference_type: string | null;
  reference_id: string | null;
  is_read: boolean;
  created_at: string;
};

function getEventIcon(eventKey: string) {
  if (eventKey.startsWith('seba_')) return Calendar;
  if (eventKey === 'notice_published') return Megaphone;
  if (eventKey === 'registration_approved' || eventKey === 'registration_rejected' || eventKey === 'registration_changes_requested') return UserCheck;
  if (eventKey === 'application_status_changed') return FileText;
  if (eventKey === 'manual_broadcast') return Megaphone;
  return Bell;
}

function getEventColor(eventKey: string): string {
  if (eventKey.startsWith('seba_')) return C.saffron;
  if (eventKey === 'notice_published') return C.teal;
  if (eventKey === 'registration_approved') return '#27AE60';
  if (eventKey === 'registration_rejected') return C.error;
  if (eventKey === 'registration_changes_requested') return '#C87612';
  if (eventKey === 'application_status_changed') return '#1D6FAE';
  if (eventKey === 'manual_broadcast') return C.gold;
  return C.saffron;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export default function NotificationsScreen() {
  const { user, profileStatus } = useAuth();
  const { isOnline } = useOffline();
  const { t, language } = useLanguage();
  const isOdia = language === 'or';
  const odiaFont = isOdia ? { fontFamily: 'NotoSansOriya_400Regular' as const } : {};
  const drawer = useDrawer();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notifications, setNotifications] = useState<SebayatNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [sebayatId, setSebayatId] = useState<string | null>(null);

  useEffect(() => {
    if (user) fetchSebayatId();
  }, [user]);

  async function fetchSebayatId() {
    const { data } = await supabase
      .from('sebayats')
      .select('id')
      .eq('auth_user_id', user!.id)
      .maybeSingle();
    if (data) {
      setSebayatId(data.id);
      fetchNotifications(data.id);
    } else {
      const { data: data2 } = await supabase
        .from('sebayats')
        .select('id')
        .eq('id', user!.id)
        .maybeSingle();
      if (data2) {
        setSebayatId(data2.id);
        fetchNotifications(data2.id);
      } else {
        setLoading(false);
      }
    }
  }

  async function fetchNotifications(sid: string) {
    const { data, error } = await supabase
      .from('sebayat_notifications')
      .select('*')
      .eq('sebayat_id', sid)
      .order('created_at', { ascending: false })
      .limit(100);

    if (!error && data) {
      setNotifications(data as SebayatNotification[]);
      setUnreadCount((data as SebayatNotification[]).filter((n) => !n.is_read).length);
    }
    setLoading(false);
    setRefreshing(false);
  }

  async function markAsRead(id: string) {
    await supabase
      .from('sebayat_notifications')
      .update({ is_read: true })
      .eq('id', id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
  }

  async function markAllRead() {
    if (!sebayatId) return;
    await supabase
      .from('sebayat_notifications')
      .update({ is_read: true })
      .eq('sebayat_id', sebayatId)
      .eq('is_read', false);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
  }

  function handleNotificationTap(notification: SebayatNotification) {
    if (!notification.is_read) markAsRead(notification.id);
    if (notification.reference_type === 'notice' && notification.reference_id) {
      router.push('/notice');
    } else if (notification.reference_type === 'application' && notification.reference_id) {
      router.push('/application');
    }
  }

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    if (sebayatId) fetchNotifications(sebayatId);
  }, [sebayatId]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.headerBar}>
          <Text style={[styles.title, odiaFont]}>{t('notifications.title')}</Text>
        </View>
        <View style={styles.centerState}>
          <ActivityIndicator color={C.saffron} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <OfflineBanner />
      <LinearGradient
        colors={['#E8732A', '#D4A843']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.headerGradient}
      >
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <Text style={[styles.headerTitle, isOdia && { fontFamily: 'NotoSansOriya_700Bold' }]}>
              {t('notifications.title')}
            </Text>
            <Text style={[styles.headerSub, odiaFont]}>
              {unreadCount > 0 ? `${unreadCount} ${t('notifications.unread')}` : t('notifications.all')}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {unreadCount > 0 && (
              <TouchableOpacity
                style={styles.markAllBtn}
                onPress={markAllRead}
                activeOpacity={0.8}
              >
                <CheckCheck color="#fff" size={16} />
                <Text style={[styles.markAllText, odiaFont]}>{t('notifications.markAllRead')}</Text>
              </TouchableOpacity>
            )}
            <MenuButton onPress={drawer.open} />
          </View>
        </View>
      </LinearGradient>

      <View style={styles.contentWrapper}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[C.saffron]} />
          }
        >
          {notifications.length === 0 ? (
            <View style={styles.emptyState}>
              <BellRing color={C.textMuted} size={48} />
              <Text style={[styles.emptyTitle, odiaFont]}>{t('notifications.noNotifications')}</Text>
              <Text style={[styles.emptyDesc, odiaFont]}>{t('notifications.noNotificationsDesc')}</Text>
            </View>
          ) : (
            notifications.map((n) => {
              const Icon = getEventIcon(n.event_key);
              const color = getEventColor(n.event_key);
              return (
                <TouchableOpacity
                  key={n.id}
                  style={[styles.notifCard, !n.is_read && styles.notifCardUnread]}
                  onPress={() => handleNotificationTap(n)}
                  activeOpacity={0.75}
                >
                  <View style={[styles.notifIcon, { backgroundColor: color + '15' }]}>
                    <Icon color={color} size={20} />
                  </View>
                  <View style={styles.notifBody}>
                    <View style={styles.notifHeader}>
                      <Text style={[styles.notifTitle, !n.is_read && styles.notifTitleUnread, odiaFont]} numberOfLines={2}>
                        {n.title}
                      </Text>
                      {!n.is_read && <View style={styles.unreadDot} />}
                    </View>
                    <Text style={[styles.notifText, odiaFont]} numberOfLines={3}>
                      {n.body}
                    </Text>
                    <Text style={styles.notifTime}>{timeAgo(n.created_at)}</Text>
                  </View>
                  {n.reference_type && <ChevronRight color={C.textMuted} size={16} />}
                </TouchableOpacity>
              );
            })
          )}
          <View style={{ height: 32 }} />
        </ScrollView>
      </View>
      <DrawerPanel {...drawer} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.warmWhite },
  headerBar: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 12 },
  title: { fontSize: 24, fontFamily: 'Poppins_700Bold', color: C.textPrimary },
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  headerGradient: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 52,
  },
  contentWrapper: {
    backgroundColor: C.warmWhite,
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
  markAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  markAllText: {
    fontSize: 12,
    fontFamily: 'Poppins_600SemiBold',
    color: '#fff',
  },

  listContent: { paddingHorizontal: 16, paddingTop: 16 },

  emptyState: {
    alignItems: 'center',
    paddingTop: 80,
    gap: 12,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: 'Poppins_600SemiBold',
    color: C.textSecondary,
  },
  emptyDesc: {
    fontSize: 14,
    fontFamily: 'Poppins_400Regular',
    color: C.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },

  notifCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    padding: 14,
    marginBottom: 8,
    gap: 12,
  },
  notifCardUnread: {
    borderColor: C.saffron + '40',
    backgroundColor: '#FFF9F4',
    borderWidth: 1.5,
  },
  notifIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  notifBody: { flex: 1, gap: 4 },
  notifHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  notifTitle: {
    fontSize: 14,
    fontFamily: 'Poppins_600SemiBold',
    color: C.textPrimary,
    flex: 1,
  },
  notifTitleUnread: {
    fontFamily: 'Poppins_700Bold',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.saffron,
    flexShrink: 0,
  },
  notifText: {
    fontSize: 13,
    fontFamily: 'Poppins_400Regular',
    color: C.textSecondary,
    lineHeight: 19,
  },
  notifTime: {
    fontSize: 11,
    fontFamily: 'Poppins_400Regular',
    color: C.textMuted,
    marginTop: 2,
  },
});
