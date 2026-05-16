import { useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Animated,
  Pressable,
  Dimensions,
  Platform,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { SUPPORTED_LANGUAGES } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';
import {
  X,
  User,
  Calendar,
  Bell,
  Users,
  FileText,
  BookOpen,
  Settings,
  ChevronRight,
  Menu,
  House,
  Lock,
  Check,
  Globe,
} from 'lucide-react-native';

export const DRAWER_W = Math.min(Dimensions.get('window').width * 0.78, 300);

const C = {
  saffron: '#E8732A',
  gold: '#D4A843',
  warmWhite: '#FFFDF9',
  textPrimary: '#2D1810',
  textSecondary: '#6B4C3B',
  textMuted: '#9B8578',
  border: '#E8D5C4',
  error: '#C0392B',
};

export interface DrawerControls {
  open: () => void;
  close: () => void;
  menuVisible: boolean;
  drawerAnim: Animated.Value;
  overlayAnim: Animated.Value;
}

export function useDrawer(): DrawerControls {
  const [menuVisible, setMenuVisible] = useState(false);
  const drawerAnim = useRef(new Animated.Value(-DRAWER_W)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;

  function open() {
    setMenuVisible(true);
    Animated.parallel([
      Animated.spring(drawerAnim, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 180 }),
      Animated.timing(overlayAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
    ]).start();
  }

  function close() {
    Animated.parallel([
      Animated.spring(drawerAnim, { toValue: -DRAWER_W, useNativeDriver: true, damping: 20, stiffness: 200 }),
      Animated.timing(overlayAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start(() => setMenuVisible(false));
  }

  return { menuVisible, drawerAnim, overlayAnim, open, close };
}

interface DrawerPanelProps extends DrawerControls {
  unreadNoticeCount?: number;
}

function LanguageSection({
  language, setLanguage, odiaFont, t,
}: {
  language: string;
  setLanguage: (lang: any) => Promise<void>;
  odiaFont: object | null;
  t: (key: string) => string;
}) {
  return (
    <View style={s.langSection}>
      <View style={s.langSectionHeader}>
        <Globe color={C.saffron} size={15} />
        <Text style={[s.langSectionTitle, odiaFont]}>{t('profile.languageLabel')}</Text>
      </View>
      <Text style={[s.langSectionHint, odiaFont]}>{t('profile.languageHint')}</Text>
      <View style={s.langOptions}>
        {SUPPORTED_LANGUAGES.map((lang) => {
          const active = language === lang.code;
          return (
            <TouchableOpacity
              key={lang.code}
              style={[s.langOption, active && s.langOptionActive]}
              onPress={() => setLanguage(lang.code)}
              activeOpacity={0.75}
            >
              <Text style={[s.langOptionText, active && s.langOptionTextActive]}>
                {lang.nativeLabel}
              </Text>
              {active && <Check color={C.saffron} size={14} />}
            </TouchableOpacity>
          );
        })}
      </View>
      <View style={s.pendingNote}>
        <Lock color={C.textMuted} size={12} />
        <Text style={[s.pendingNoteText, odiaFont]}>{t('drawer.availableAfterApproval')}</Text>
      </View>
    </View>
  );
}

export function DrawerPanel({ menuVisible, drawerAnim, overlayAnim, close, unreadNoticeCount = 0 }: DrawerPanelProps) {
  const { user, profileStatus } = useAuth();
  const { t, language, setLanguage } = useLanguage();
  const router = useRouter();
  const isOdia = language === 'or';
  const odiaFont = isOdia ? { fontFamily: 'NotoSansOriya_400Regular' as const } : null;
  const odiaBoldFont = isOdia ? { fontFamily: 'NotoSansOriya_700Bold' as const } : null;
  const [fullName, setFullName] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [userPhone, setUserPhone] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const isApproved = profileStatus === 'approved';

  async function loadProfile() {
    if (loaded || !user) return;
    setLoaded(true);
    const { data } = await supabase
      .from('sebayats')
      .select('full_name, photo_url, primary_phone, phone')
      .eq('auth_user_id', user.id)
      .maybeSingle();
    if (data) {
      setFullName(data.full_name ?? '');
      setPhotoUrl(data.photo_url ?? null);
      const raw = data.primary_phone ?? data.phone ?? null;
      if (raw) {
        const digits = raw.replace(/\D/g, '');
        setUserPhone(digits ? `+${digits}` : null);
      }
    }
  }

  if (menuVisible && !loaded) {
    loadProfile();
  }

  function menuNavigate(path: string, requiresApproval = false) {
    if (requiresApproval && !isApproved) return;
    close();
    setTimeout(() => router.push(path as any), 200);
  }

  if (!menuVisible) return null;

  function LockedItem({ iconBg, icon, label }: { iconBg: string; icon: React.ReactNode; label: string }) {
    return (
      <View style={[s.item, s.itemLocked]}>
        <View style={[s.icon, { backgroundColor: iconBg, opacity: 0.45 }]}>{icon}</View>
        <Text style={[s.itemText, s.itemTextLocked, odiaFont]}>{label}</Text>
        <Lock color={C.textMuted} size={13} style={{ opacity: 0.5 }} />
      </View>
    );
  }

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
      <Animated.View style={[s.backdrop, { opacity: overlayAnim }]} pointerEvents="auto">
        <Pressable style={StyleSheet.absoluteFillObject} onPress={close} />
      </Animated.View>

      <Animated.View style={[s.sheet, { transform: [{ translateX: drawerAnim }] }]}>
        <LinearGradient
          colors={['#E8732A', '#D4A843']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={s.header}
        >
          <View style={s.headerInner}>
            <View style={s.avatarWrap}>
              {photoUrl
                ? <Image source={{ uri: photoUrl }} style={s.avatar} />
                : (
                  <View style={s.avatarFallback}>
                    <Text style={s.avatarInitial}>
                      {fullName ? fullName.charAt(0).toUpperCase() : 'J'}
                    </Text>
                  </View>
                )
              }
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.name, odiaBoldFont]} numberOfLines={1}>{fullName || t('common.jayJagannath')}</Text>
              {userPhone ? <Text style={s.phone}>{userPhone}</Text> : null}
              <Text style={[s.nijog, odiaFont]}>{t('common.pratihariNijog')}</Text>
            </View>
            <TouchableOpacity onPress={close} style={s.closeBtn} activeOpacity={0.7}>
              <X color="#fff" size={20} />
            </TouchableOpacity>
          </View>
        </LinearGradient>

        <ScrollView style={s.links} contentContainerStyle={s.linksContent}>
          <Text style={s.sectionLabel}>{t('drawer.navigate')}</Text>

          <TouchableOpacity style={s.item} onPress={() => menuNavigate('/(tabs)')} activeOpacity={0.75}>
            <View style={[s.icon, { backgroundColor: '#FFF0E8' }]}>
              <House color={C.saffron} size={18} />
            </View>
            <Text style={[s.itemText, odiaFont]}>{t('drawer.home')}</Text>
            <ChevronRight color={C.textMuted} size={16} />
          </TouchableOpacity>

          <TouchableOpacity style={s.item} onPress={() => menuNavigate('/(tabs)/profile')} activeOpacity={0.75}>
            <View style={[s.icon, { backgroundColor: '#EBF5FB' }]}>
              <User color="#1D6FAE" size={18} />
            </View>
            <Text style={[s.itemText, odiaFont]}>{t('drawer.myProfile')}</Text>
            <ChevronRight color={C.textMuted} size={16} />
          </TouchableOpacity>

          {isApproved ? (
            <>
              <TouchableOpacity style={s.item} onPress={() => menuNavigate('/(tabs)/schedule')} activeOpacity={0.75}>
                <View style={[s.icon, { backgroundColor: '#EBF5FB' }]}>
                  <Calendar color="#1D6FAE" size={18} />
                </View>
                <Text style={[s.itemText, odiaFont]}>{t('drawer.sebaSchedule')}</Text>
                <ChevronRight color={C.textMuted} size={16} />
              </TouchableOpacity>

              <TouchableOpacity style={s.item} onPress={() => menuNavigate('/notice')} activeOpacity={0.75}>
                <View style={[s.icon, { backgroundColor: '#EBF7F4' }]}>
                  <Bell color="#1A7A6A" size={18} />
                </View>
                <Text style={[s.itemText, odiaFont]}>{t('drawer.notices')}</Text>
                {unreadNoticeCount > 0 && (
                  <View style={s.badge}><Text style={s.badgeText}>{unreadNoticeCount}</Text></View>
                )}
                <ChevronRight color={C.textMuted} size={16} />
              </TouchableOpacity>

              <TouchableOpacity style={s.item} onPress={() => menuNavigate('/committee')} activeOpacity={0.75}>
                <View style={[s.icon, { backgroundColor: '#F0FFF4' }]}>
                  <Users color="#27AE60" size={18} />
                </View>
                <Text style={[s.itemText, odiaFont]}>{t('drawer.committee')}</Text>
                <ChevronRight color={C.textMuted} size={16} />
              </TouchableOpacity>

              <TouchableOpacity style={s.item} onPress={() => menuNavigate('/application')} activeOpacity={0.75}>
                <View style={[s.icon, { backgroundColor: '#FFF8F0' }]}>
                  <FileText color={C.gold} size={18} />
                </View>
                <Text style={[s.itemText, odiaFont]}>{t('drawer.application')}</Text>
                <ChevronRight color={C.textMuted} size={16} />
              </TouchableOpacity>

              <TouchableOpacity style={s.item} onPress={() => menuNavigate('/pali-history')} activeOpacity={0.75}>
                <View style={[s.icon, { backgroundColor: '#FFF3CD' }]}>
                  <BookOpen color="#B7770D" size={18} />
                </View>
                <Text style={[s.itemText, odiaFont]}>{t('drawer.paliHistory')}</Text>
                <ChevronRight color={C.textMuted} size={16} />
              </TouchableOpacity>
            </>
          ) : (
            <LanguageSection language={language} setLanguage={setLanguage} odiaFont={odiaFont} t={t} />
          )}

          <View style={s.divider} />
          <Text style={s.sectionLabel}>{t('drawer.account')}</Text>

          <TouchableOpacity style={s.item} onPress={() => menuNavigate('/(tabs)/profile')} activeOpacity={0.75}>
            <View style={[s.icon, { backgroundColor: '#F5F5F5' }]}>
              <Settings color={C.textSecondary} size={18} />
            </View>
            <Text style={[s.itemText, odiaFont]}>{t('drawer.settings')}</Text>
            <ChevronRight color={C.textMuted} size={16} />
          </TouchableOpacity>
        </ScrollView>
      </Animated.View>
    </View>
  );
}

export function MenuButton({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity style={s.menuBtn} onPress={onPress} activeOpacity={0.8}>
      <Menu color="#fff" size={22} />
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
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
  header: {
    paddingTop: Platform.OS === 'ios' ? 52 : 16,
    paddingBottom: 20,
    paddingHorizontal: 16,
  },
  headerInner: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatarWrap: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.5)',
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden', flexShrink: 0,
  },
  avatar: { width: 52, height: 52, borderRadius: 26 },
  avatarFallback: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.5)',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarInitial: { fontSize: 22, fontFamily: 'Poppins_700Bold', color: '#fff' },
  name: { fontSize: 15, fontFamily: 'Poppins_700Bold', color: '#fff' },
  phone: { fontSize: 12, fontFamily: 'Poppins_400Regular', color: 'rgba(255,255,255,0.85)', marginTop: 1 },
  nijog: { fontSize: 11, fontFamily: 'Poppins_400Regular', color: 'rgba(255,255,255,0.75)', marginTop: 1 },
  closeBtn: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  links: { flex: 1 },
  linksContent: { paddingVertical: 12, paddingHorizontal: 12 },
  sectionLabel: {
    fontSize: 10, fontFamily: 'Poppins_700Bold',
    color: C.textMuted, textTransform: 'uppercase',
    letterSpacing: 1, paddingHorizontal: 8,
    marginBottom: 6, marginTop: 4,
  },
  item: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 10, paddingHorizontal: 8,
    borderRadius: 12, marginBottom: 2,
  },
  itemLocked: {
    opacity: 0.45,
  },
  itemTextLocked: {
    color: C.textMuted,
  },
  pendingNote: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    marginTop: 4, marginBottom: 2, paddingHorizontal: 8,
  },
  pendingNoteText: {
    fontSize: 11, fontFamily: 'Poppins_400Regular',
    color: C.textMuted, fontStyle: 'italic',
  },
  icon: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  itemText: { flex: 1, fontSize: 14, fontFamily: 'Poppins_500Medium', color: C.textPrimary },
  badge: {
    backgroundColor: C.error, borderRadius: 10,
    minWidth: 20, height: 20,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5,
  },
  badgeText: { fontSize: 11, fontFamily: 'Poppins_700Bold', color: '#fff' },
  divider: { height: 1, backgroundColor: C.border, marginVertical: 10, marginHorizontal: 8 },
  menuBtn: {
    width: 38, height: 38, borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
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
    flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 4,
  },
  langSectionTitle: {
    fontSize: 13, fontFamily: 'Poppins_600SemiBold', color: C.textPrimary,
  },
  langSectionHint: {
    fontSize: 11, fontFamily: 'Poppins_400Regular', color: C.textMuted, marginBottom: 12,
  },
  langOptions: {
    flexDirection: 'row', gap: 8,
  },
  langOption: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 9, paddingHorizontal: 10, borderRadius: 10,
    backgroundColor: '#fff', borderWidth: 1.5, borderColor: C.border,
  },
  langOptionActive: {
    borderColor: C.saffron, backgroundColor: 'rgba(232,115,42,0.06)',
  },
  langOptionText: {
    fontSize: 13, fontFamily: 'Poppins_500Medium', color: C.textSecondary,
  },
  langOptionTextActive: {
    color: C.saffron, fontFamily: 'Poppins_600SemiBold',
  },
});
