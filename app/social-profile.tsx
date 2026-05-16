import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Linking,
  Platform,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { CachedImage } from '@/components/CachedImage';
import { useDrawer, DrawerPanel, MenuButton } from '@/components/SlideDrawer';
import { ArrowLeft, Share2, ExternalLink, Facebook, Twitter, Instagram, Linkedin, Youtube, Globe, User } from 'lucide-react-native';
import { useLanguage } from '@/contexts/LanguageContext';

const C = {
  saffron: '#E8732A',
  gold: '#D4A843',
  cream: '#FFF8F0',
  warmWhite: '#FFFDF9',
  textPrimary: '#2D1810',
  textSecondary: '#6B4C3B',
  textMuted: '#9B8578',
  border: '#E8D5C4',
};

interface Profile {
  id: string;
  full_name: string;
  first_name: string;
  last_name: string;
  alias_name: string;
  photo_url: string;
  bansa_name: string;
  registration_no: string;
  social_facebook: string;
  social_twitter: string;
  social_instagram: string;
  social_linkedin: string;
  social_youtube: string;
}

const NETWORKS = [
  {
    key: 'social_facebook' as keyof Profile,
    label: 'Facebook',
    Icon: Facebook,
    color: '#1877F2',
    bg: '#EBF3FE',
    baseUrl: 'https://facebook.com/',
  },
  {
    key: 'social_twitter' as keyof Profile,
    label: 'Twitter / X',
    Icon: Twitter,
    color: '#000000',
    bg: '#F3F4F6',
    baseUrl: 'https://x.com/',
  },
  {
    key: 'social_instagram' as keyof Profile,
    label: 'Instagram',
    Icon: Instagram,
    color: '#E1306C',
    bg: '#FEF0F4',
    baseUrl: 'https://instagram.com/',
  },
  {
    key: 'social_linkedin' as keyof Profile,
    label: 'LinkedIn',
    Icon: Linkedin,
    color: '#0A66C2',
    bg: '#EBF4FE',
    baseUrl: 'https://linkedin.com/in/',
  },
  {
    key: 'social_youtube' as keyof Profile,
    label: 'YouTube',
    Icon: Youtube,
    color: '#FF0000',
    bg: '#FFF0F0',
    baseUrl: 'https://youtube.com/',
  },
];

function resolveUrl(value: string, baseUrl: string) {
  if (!value) return '';
  if (value.startsWith('http://') || value.startsWith('https://')) return value;
  return baseUrl + value.replace(/^@/, '');
}

export default function SocialProfileScreen() {
  const drawer = useDrawer();
  const { user } = useAuth();
  const router = useRouter();
  const { t } = useLanguage();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!user) return;
      const { data } = await supabase
        .from('sebayats')
        .select('id, full_name, first_name, last_name, alias_name, photo_url, bansa_name, registration_no, social_facebook, social_twitter, social_instagram, social_linkedin, social_youtube')
        .eq('auth_user_id', user.id)
        .maybeSingle();
      if (!data) {
        const { data: d2 } = await supabase
          .from('sebayats')
          .select('id, full_name, first_name, last_name, alias_name, photo_url, bansa_name, registration_no, social_facebook, social_twitter, social_instagram, social_linkedin, social_youtube')
          .eq('id', user.id)
          .maybeSingle();
        setProfile(d2);
      } else {
        setProfile(data);
      }
      setLoading(false);
    }
    load();
  }, [user]);

  const displayName = profile
    ? (profile.full_name || [profile.first_name, profile.last_name].filter(Boolean).join(' ') || 'Sebayat')
    : '';

  const hasSocial = profile && NETWORKS.some((n) => !!profile[n.key]);

  async function handleShare() {
    if (!profile) return;
    const lines: string[] = [`${displayName}'s Social Media Profiles`];
    for (const n of NETWORKS) {
      const val = profile[n.key] as string;
      if (val) lines.push(`${n.label}: ${resolveUrl(val, n.baseUrl)}`);
    }
    const message = lines.join('\n');
    if (Platform.OS === 'web') {
      if (navigator.share) {
        navigator.share({ title: `${displayName} — Social Profiles`, text: message });
      } else {
        await navigator.clipboard.writeText(message);
        alert('Copied to clipboard!');
      }
    } else {
      Share.share({ message });
    }
  }

  async function openLink(value: string, baseUrl: string) {
    const url = resolveUrl(value, baseUrl);
    if (!url) return;
    try { await Linking.openURL(url); } catch {}
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <LinearGradient colors={['#A07010', '#7A5408']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
            <ArrowLeft color="#fff" size={22} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Globe color="rgba(255,255,255,0.85)" size={18} />
            <Text style={styles.headerTitle}>{t('socialMedia.title')}</Text>
          </View>
          <MenuButton onPress={drawer.open} />
        </LinearGradient>
        <View style={styles.contentWrapper}>
          <View style={styles.center}><ActivityIndicator color={C.saffron} size="large" /></View>
        </View>
        <DrawerPanel {...drawer} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <LinearGradient colors={['#A07010', '#7A5408']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <ArrowLeft color="#fff" size={22} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Globe color="rgba(255,255,255,0.85)" size={18} />
          <Text style={styles.headerTitle}>{t('socialMedia.title')}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {hasSocial && (
            <TouchableOpacity style={styles.shareBtn} onPress={handleShare} activeOpacity={0.8}>
              <Share2 color="#fff" size={18} />
            </TouchableOpacity>
          )}
          <MenuButton onPress={drawer.open} />
        </View>
      </LinearGradient>

      <View style={styles.contentWrapper}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Profile card */}
          <View style={styles.profileCard}>
            <CachedImage
              uri={profile?.photo_url}
              style={styles.avatar}
              resizeMode="cover"
              fallback={
                <View style={styles.avatarFallback}>
                  <User color={C.saffron} size={28} />
                </View>
              }
              containerStyle={styles.avatarFallback}
            />
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{displayName}</Text>
              {profile?.alias_name ? <Text style={styles.profileAlias}>"{profile.alias_name}"</Text> : null}
              {profile?.bansa_name ? <Text style={styles.profileSub}>{profile.bansa_name}</Text> : null}
              {profile?.registration_no ? (
                <Text style={styles.profileReg}>{t('socialMedia.reg')} {profile.registration_no}</Text>
              ) : null}
            </View>
          </View>

          {!hasSocial ? (
            <View style={styles.emptyState}>
              <Globe color={C.textMuted} size={48} />
              <Text style={styles.emptyTitle}>{t('socialMedia.noSocialProfiles')}</Text>
              <Text style={styles.emptySub}>{t('socialMedia.noSocialDesc')}</Text>
            </View>
          ) : (
            <View style={styles.networkList}>
              <Text style={styles.sectionTitle}>{t('socialMedia.profiles')}</Text>
              {NETWORKS.map(({ key, label, Icon, color, bg, baseUrl }) => {
                const value = profile?.[key] as string;
                if (!value) return null;
                const url = resolveUrl(value, baseUrl);
                return (
                  <TouchableOpacity
                    key={key}
                    style={styles.networkCard}
                    onPress={() => openLink(value, baseUrl)}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.networkIcon, { backgroundColor: bg }]}>
                      <Icon color={color} size={22} strokeWidth={1.8} />
                    </View>
                    <View style={styles.networkInfo}>
                      <Text style={styles.networkLabel}>{label}</Text>
                      <Text style={styles.networkValue} numberOfLines={1}>{value}</Text>
                    </View>
                    <ExternalLink color={C.textMuted} size={16} />
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {hasSocial && (
            <TouchableOpacity style={styles.shareBtnLarge} onPress={handleShare} activeOpacity={0.85}>
              <Share2 color="#fff" size={18} />
              <Text style={styles.shareBtnText}>{t('socialMedia.shareSocialProfiles')}</Text>
            </TouchableOpacity>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
      <DrawerPanel {...drawer} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.warmWhite },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 52, gap: 12,
  },
  contentWrapper: {
    backgroundColor: '#FFFDF9',
    borderTopLeftRadius: 32, borderTopRightRadius: 32,
    marginTop: -28, flex: 1,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 18, fontFamily: 'Poppins_700Bold', color: '#fff' },
  shareBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },

  content: { padding: 20 },

  profileCard: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    backgroundColor: '#fff', borderRadius: 18, padding: 18,
    borderWidth: 1, borderColor: C.border,
    marginBottom: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  avatar: { width: 64, height: 64, borderRadius: 32 },
  avatarFallback: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: C.cream, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: C.border,
  },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 17, fontFamily: 'Poppins_700Bold', color: C.textPrimary, lineHeight: 22 },
  profileAlias: { fontSize: 12, fontFamily: 'Poppins_400Regular', color: C.textMuted, fontStyle: 'italic' },
  profileSub: { fontSize: 12, fontFamily: 'Poppins_400Regular', color: C.textSecondary, marginTop: 2 },
  profileReg: { fontSize: 11, fontFamily: 'Poppins_600SemiBold', color: C.saffron, marginTop: 2 },

  sectionTitle: { fontSize: 12, fontFamily: 'Poppins_600SemiBold', color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 },

  networkList: { gap: 10, marginBottom: 24 },
  networkCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#fff', borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: C.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  networkIcon: {
    width: 44, height: 44, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  networkInfo: { flex: 1 },
  networkLabel: { fontSize: 11, fontFamily: 'Poppins_600SemiBold', color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  networkValue: { fontSize: 14, fontFamily: 'Poppins_600SemiBold', color: C.textPrimary, marginTop: 2 },

  shareBtnLarge: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: C.saffron, borderRadius: 14,
    paddingVertical: 15, marginBottom: 8,
  },
  shareBtnText: { fontSize: 15, fontFamily: 'Poppins_600SemiBold', color: '#fff' },

  emptyState: { alignItems: 'center', paddingTop: 60, gap: 14 },
  emptyTitle: { fontSize: 17, fontFamily: 'Poppins_700Bold', color: C.textSecondary },
  emptySub: { fontSize: 13, fontFamily: 'Poppins_400Regular', color: C.textMuted, textAlign: 'center', lineHeight: 20, paddingHorizontal: 20 },
});
