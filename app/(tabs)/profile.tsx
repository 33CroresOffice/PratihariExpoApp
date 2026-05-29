import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Image,
  Animated,
  Dimensions,
  Platform,
  Modal,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useOffline } from '@/contexts/OfflineContext';
import { hydrateFromCache, writeCache } from '@/lib/cachedQuery';
import { OfflineBanner } from '@/components/OfflineBanner';
import { CachedImage } from '@/components/CachedImage';
import { prewarmImages } from '@/lib/imageCache';
import { formatRelative } from '@/lib/offlineCache';
import {
  LogOut,
  User,
  Clock,
  CircleCheck as CheckCircle,
  Circle as XCircle,
  CircleAlert as AlertCircle,
  RefreshCw,
  CreditCard as Edit,
  ChevronRight,
  FileText,
  Phone,
  Mail,
  MapPin,
  Hash,
  Star,
  Users,
  Briefcase,
  Globe,
  Heart,
  Baby,
  IdCard,
  Camera,
  CloudOff,
  Trash2,
  RotateCw,
  Menu,
  X,
  House,
  Calendar,
  Bell,
  UserCog,
  BookOpen,
  Info,
} from 'lucide-react-native';
import { Switch } from 'react-native';
import { useDrawer, DrawerPanel } from '@/components/SlideDrawer';
import { useLanguage } from '@/contexts/LanguageContext';
import { SUPPORTED_LANGUAGES } from '@/lib/i18n';
import { Check, Languages } from 'lucide-react-native';

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
  success: '#27AE60',
};

type ProfileStatus =
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'changes_requested'
  | 'resubmitted';

interface SebayatProfile {
  id: string;
  full_name: string;
  first_name: string;
  middle_name: string;
  last_name: string;
  alias_name: string;
  phone: string;
  primary_phone: string;
  whatsapp_number: string;
  email: string;
  extra_phones: string[] | null;
  occupations: { occupation: string; extra_curriculum_activity: string }[] | null;
  children: { child_name: string; date_of_birth: string; gender: string; marital_status: string; photo_url?: string }[] | null;
  profile_status: ProfileStatus;
  registration_no: string;
  bansa_name: string;
  palia_number: string;
  seba_name: string;
  admin_remarks: string;
  submitted_at: string | null;
  reviewed_at: string | null;
  date_of_birth: string | null;
  gender: string;
  father_name: string;
  father_sebayat_id: string | null;
  mother_name: string;
  marital_status: string;
  spouse_name: string;
  spouse_father_name: string;
  spouse_mother_name: string;
  spouse_photo_url: string;
  spouse_father_photo_url: string;
  spouse_mother_photo_url: string;
  blood_group: string;
  joining_year: string;
  joining_date: string;
  joining_date_exact: boolean;
  health_card_no: string;
  health_card_photo_url: string;
  photo_url: string;
  permanent_sahi: string;
  permanent_landmark: string;
  permanent_post_office: string;
  permanent_police_station: string;
  permanent_pincode: string;
  permanent_district: string;
  permanent_state: string;
  permanent_country: string;
  permanent_address_text: string;
  is_permanent_different: boolean;
  current_sahi: string;
  current_landmark: string;
  current_post_office: string;
  current_police_station: string;
  current_pincode: string;
  current_district: string;
  current_state: string;
  current_country: string;
  current_address_text: string;
  social_facebook: string;
  social_twitter: string;
  social_instagram: string;
  social_linkedin: string;
  social_youtube: string;
  is_bhagari: boolean;
  is_baristha_bhai_pua: boolean;
}

interface IdentityDoc {
  id: string;
  id_type: string;
  photo_url: string;
}

interface NijogAssignment {
  seba_name: string;
  seba_name_or: string | null;
  group_name: string;
  group_name_or: string | null;
  beddha_number: number;
}

interface SebaSelection {
  seba_category_id: string;
  beddha_number: number;
  category_name: string;
  category_name_or: string | null;
}

const STATUS_CONFIG_BASE: Record<
  ProfileStatus,
  { color: string; bg: string; icon: any; labelKey: string; descKey: string }
> = {
  draft: { color: C.textMuted, bg: '#F5F0EC', icon: FileText, labelKey: 'profile.draft', descKey: 'profile.draftDesc' },
  submitted: { color: '#1D6FAE', bg: '#EBF5FB', icon: Clock, labelKey: 'profile.submitted', descKey: 'profile.submittedDesc' },
  under_review: { color: '#B7770D', bg: '#FFF3CD', icon: Clock, labelKey: 'profile.underReview', descKey: 'profile.underReviewDesc' },
  approved: { color: C.success, bg: '#F0FFF4', icon: CheckCircle, labelKey: 'profile.approved', descKey: 'profile.approvedDesc' },
  rejected: { color: C.error, bg: '#FFF5F5', icon: XCircle, labelKey: 'profile.rejected', descKey: 'profile.rejectedDesc' },
  changes_requested: { color: '#C87612', bg: '#FFF3CD', icon: AlertCircle, labelKey: 'profile.changesRequested', descKey: 'profile.changesRequestedDesc' },
  resubmitted: { color: '#1D6FAE', bg: '#EBF5FB', icon: RefreshCw, labelKey: 'profile.resubmitted', descKey: 'profile.resubmittedDesc' },
};

function formatDate(val?: string | null): string | null {
  if (!val) return null;
  // ISO YYYY-MM-DD → readable
  const iso = val.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const d = new Date(`${iso[1]}-${iso[2]}-${iso[3]}T12:00:00`);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
  }
  // DD/MM/YYYY → readable
  const dmy = val.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) {
    const d = new Date(`${dmy[3]}-${dmy[2].padStart(2,'0')}-${dmy[1].padStart(2,'0')}T12:00:00`);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
  }
  return val;
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function BadgeRow({ label, value, color }: { label: string; value?: string | boolean | null; color?: string }) {
  if (value === null || value === undefined || value === false || value === '') return null;
  const display = typeof value === 'boolean' ? 'Yes' : value;
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <View style={[styles.pill, { backgroundColor: (color || C.saffron) + '18' }]}>
        <Text style={[styles.pillText, { color: color || C.saffron }]}>{display}</Text>
      </View>
    </View>
  );
}

function SectionCard({ title, icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  const Icon = icon;
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Icon color={C.saffron} size={15} />
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function PhotoThumb({ uri, label, onPress }: { uri?: string | null; label: string; onPress?: (uri: string) => void }) {
  if (!uri) return null;
  return (
    <TouchableOpacity style={styles.photoThumb} onPress={() => onPress?.(uri)} activeOpacity={0.8}>
      <CachedImage uri={uri} style={styles.photoThumbImg} resizeMode="cover" />
      <Text style={styles.photoThumbLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function LinkRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  const handlePress = () => {
    const url = value.startsWith('http') ? value : `https://${value}`;
    Linking.openURL(url).catch(() => {});
  };
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <TouchableOpacity onPress={handlePress} activeOpacity={0.7} style={{ flex: 2 }}>
        <Text style={[styles.infoValue, styles.linkValue]} numberOfLines={1}>{value}</Text>
      </TouchableOpacity>
    </View>
  );
}

const SCREEN_W = Dimensions.get('window').width;
const DRAWER_W = Math.min(SCREEN_W * 0.78, 300);

const ID_TYPE_KEY_MAP: Record<string, string> = {
  'Aadhar Card': 'profile.idTypeAadhar',
  'Aadhaar Card': 'profile.idTypeAadhar',
  'PAN Card': 'profile.idTypePAN',
  'Passport': 'profile.idTypePassport',
  'Voter ID': 'profile.idTypeVoterID',
};

function translateIdType(idType: string, t: (key: string) => string): string {
  const key = ID_TYPE_KEY_MAP[idType];
  return key ? t(key) : idType;
}

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const { isOnline, offlineEnabled } = useOffline();
  const router = useRouter();
  const [profile, setProfile] = useState<SebayatProfile | null>(null);
  const [idDocs, setIdDocs] = useState<IdentityDoc[]>([]);
  const [nijogAssignments, setNijogAssignments] = useState<NijogAssignment[]>([]);
  const [sebaSelections, setSebaSelections] = useState<SebaSelection[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncedAt, setSyncedAt] = useState<number | null>(null);
  const [lightboxUri, setLightboxUri] = useState<string | null>(null);
  const [langModalOpen, setLangModalOpen] = useState(false);
  const { language, setLanguage, t } = useLanguage();

  const drawer = useDrawer();

  useEffect(() => {
    if (user) {
      hydrate().then(() => {
        if (isOnline) {
          fetchProfile();
        } else {
          setLoading(false);
        }
      });
    }
  }, [user, isOnline]);

  async function hydrate() {
    if (!user || !offlineEnabled) return;
    const [p, d, n, s] = await Promise.all([
      hydrateFromCache<SebayatProfile | null>(user.id, 'profile', setProfile),
      hydrateFromCache<IdentityDoc[]>(user.id, 'identity_docs', setIdDocs),
      hydrateFromCache<NijogAssignment[]>(user.id, 'nijog_assignments', setNijogAssignments),
      hydrateFromCache<SebaSelection[]>(user.id, 'seba_selections', setSebaSelections),
    ]);
    const ts = p.cachedAt ?? d.cachedAt ?? n.cachedAt ?? s.cachedAt;
    if (ts) {
      setSyncedAt(ts);
      setLoading(false);
    }
  }

  async function fetchProfile() {
    if (!profile) setLoading(true);
    let data: any = null;

    const res1 = await supabase.from('sebayats').select('*').eq('auth_user_id', user!.id).maybeSingle();
    data = res1.data;
    if (!data) {
      const res2 = await supabase.from('sebayats').select('*').eq('id', user!.id).maybeSingle();
      data = res2.data;
    }

    setProfile(data);
    if (offlineEnabled) await writeCache(user!.id, 'profile', data);
    if (data) {
      // Prewarm image cache for all profile photos in the background
      prewarmImages([
        data.photo_url,
        data.health_card_photo_url,
        data.spouse_photo_url,
        data.spouse_father_photo_url,
        data.spouse_mother_photo_url,
        ...((data.children || []) as any[]).map((c: any) => c.photo_url),
      ]);
      await Promise.all([
        fetchIdDocs(data.id),
        fetchNijogAssignments(data.id),
        fetchSebaSelections(data.id),
      ]);
    }
    setSyncedAt(Date.now());
    setLoading(false);
  }

  async function fetchIdDocs(sid: string) {
    const { data } = await supabase
      .from('identity_documents')
      .select('id, id_type, photo_url')
      .eq('sebayat_id', sid);
    const rows = data || [];
    setIdDocs(rows);
    if (offlineEnabled) await writeCache(user!.id, 'identity_docs', rows);
    prewarmImages(rows.map((d: any) => d.photo_url));
  }

  async function fetchNijogAssignments(sid: string) {
    const year = new Date().getFullYear();
    const { data } = await supabase
      .from('nijog_assignments')
      .select('beddha_number, year, seba_categories!inner(name, name_or, seba_groups!inner(name, name_or))')
      .eq('sebayat_id', sid)
      .eq('year', year)
      .order('beddha_number', { ascending: true });

    if (data) {
      const rows = (data as any[]).map((r) => ({
        seba_name: r.seba_categories.name,
        seba_name_or: r.seba_categories.name_or ?? null,
        group_name: r.seba_categories.seba_groups.name,
        group_name_or: r.seba_categories.seba_groups.name_or ?? null,
        beddha_number: r.beddha_number,
      }));
      setNijogAssignments(rows);
      if (offlineEnabled) await writeCache(user!.id, 'nijog_assignments', rows);
    }
  }

  async function fetchSebaSelections(sid: string) {
    const { data } = await supabase
      .from('sebayat_seba_selections')
      .select('seba_category_id, beddha_number, seba_categories!inner(name, name_or)')
      .eq('sebayat_id', sid)
      .order('beddha_number', { ascending: true });

    if (data) {
      const rows = (data as any[]).map((r) => ({
        seba_category_id: r.seba_category_id,
        beddha_number: r.beddha_number,
        category_name: r.seba_categories.name,
        category_name_or: r.seba_categories.name_or ?? null,
      }));
      setSebaSelections(rows);
      if (offlineEnabled) await writeCache(user!.id, 'seba_selections', rows);
    }
  }

  function OfflineSettingsSection({ syncedAt, onSyncNow }: { syncedAt: number | null; onSyncNow: () => Promise<void> }) {
    const { isOnline, offlineEnabled, setOfflineEnabled, clearCache } = useOffline();
    const [syncing, setSyncing] = useState(false);
    return (
      <SectionCard title={t('offlineSection.title')} icon={CloudOff}>
        <View style={styles.infoRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.infoLabel}>{t('offlineSection.enableLabel')}</Text>
            <Text style={{ fontSize: 11, fontFamily: 'Poppins_400Regular', color: C.textMuted, marginTop: 2 }}>
              {t('offlineSection.enableHint')}
            </Text>
          </View>
          <Switch
            value={offlineEnabled}
            onValueChange={setOfflineEnabled}
            trackColor={{ false: C.border, true: C.saffron + '60' }}
            thumbColor={offlineEnabled ? C.saffron : '#f4f3f4'}
          />
        </View>
        <InfoRow label={t('offlineSection.lastSynced')} value={syncedAt ? formatRelative(syncedAt) : t('offlineSection.never')} />
        <InfoRow label={t('offlineSection.network')} value={isOnline ? t('offlineSection.online') : t('offlineSection.offline')} />
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
          <TouchableOpacity
            style={[
              {
                flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
                backgroundColor: isOnline ? C.saffron + '18' : C.border, borderRadius: 10, paddingVertical: 10,
                borderWidth: 1, borderColor: isOnline ? C.saffron + '40' : C.border,
              },
            ]}
            disabled={!isOnline || syncing}
            onPress={async () => { setSyncing(true); await onSyncNow(); setSyncing(false); }}
            activeOpacity={0.75}
          >
            <RotateCw color={isOnline ? C.saffron : C.textMuted} size={13} />
            <Text style={{ fontSize: 12, fontFamily: 'Poppins_600SemiBold', color: isOnline ? C.saffron : C.textMuted }}>
              {syncing ? t('offlineSection.syncing') : t('offlineSection.syncNow')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={{
              flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
              backgroundColor: '#FFF5F5', borderRadius: 10, paddingVertical: 10,
              borderWidth: 1, borderColor: C.error + '30',
            }}
            onPress={clearCache}
            activeOpacity={0.75}
          >
            <Trash2 color={C.error} size={13} />
            <Text style={{ fontSize: 12, fontFamily: 'Poppins_600SemiBold', color: C.error }}>{t('offlineSection.clearCache')}</Text>
          </TouchableOpacity>
        </View>
      </SectionCard>
    );
  }

  async function handleSignOut() {
    await signOut();
    router.replace('/auth/phone');
  }

  const phone = profile?.primary_phone || profile?.phone || user?.user_metadata?.phone || '';
  const status: ProfileStatus = profile?.profile_status ?? 'draft';
  const cfgBase = STATUS_CONFIG_BASE[status];
  const cfg = { ...cfgBase, label: t(cfgBase.labelKey), description: t(cfgBase.descKey) };
  const StatusIcon = cfg.icon;
  const canEdit = !profile || status === 'draft' || status === 'rejected' || status === 'changes_requested';
  const displayName = profile?.full_name ||
    [profile?.first_name, profile?.middle_name, profile?.last_name].filter(Boolean).join(' ') ||
    'Sebayat';

  // Group seba selections by category (use Odia name as key when language is Odia)
  const sebaSelByCategory: Record<string, { nameOr: string | null; beddhas: number[] }> = {};
  sebaSelections.forEach((s) => {
    const key = s.category_name;
    if (!sebaSelByCategory[key]) sebaSelByCategory[key] = { nameOr: s.category_name_or, beddhas: [] };
    sebaSelByCategory[key].beddhas.push(s.beddha_number);
  });

  const joiningDisplay = profile?.joining_date_exact
    ? profile?.joining_date
    : profile?.joining_year || profile?.joining_date;

  const permanentAddr = [
    profile?.permanent_sahi,
    profile?.permanent_landmark,
    profile?.permanent_post_office && `P.O. ${profile.permanent_post_office}`,
    profile?.permanent_police_station && `P.S. ${profile.permanent_police_station}`,
    profile?.permanent_district,
    profile?.permanent_state,
    profile?.permanent_pincode,
    profile?.permanent_country,
  ].filter(Boolean).join(', ');

  const currentAddr = [
    profile?.current_sahi,
    profile?.current_landmark,
    profile?.current_post_office && `P.O. ${profile.current_post_office}`,
    profile?.current_police_station && `P.S. ${profile.current_police_station}`,
    profile?.current_district,
    profile?.current_state,
    profile?.current_pincode,
    profile?.current_country,
  ].filter(Boolean).join(', ');

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingCenter}>
          <ActivityIndicator color={C.saffron} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <OfflineBanner />
      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Gradient Header */}
        <LinearGradient
          colors={['#E8732A', '#D4A843']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerGradient}
        >
          <View style={styles.headerTopRow}>
            <Text style={styles.headerTitle}>{t('profile.myProfile')}</Text>
            <TouchableOpacity style={styles.menuBtn} onPress={drawer.open} activeOpacity={0.8}>
              <Menu color="#fff" size={22} />
            </TouchableOpacity>
          </View>

          <View style={styles.avatarRow}>
            <CachedImage
              uri={profile?.photo_url}
              style={styles.avatarImg}
              fallback={<View style={styles.avatar}><User color={C.saffron} size={34} /></View>}
              containerStyle={styles.avatar}
            />
            <View style={styles.avatarInfo}>
              <Text style={styles.headerName}>{displayName}</Text>
              {profile?.alias_name ? (
                <Text style={styles.headerAlias}>"{profile.alias_name}"</Text>
              ) : null}
              {phone ? (
                <View style={styles.headerPhoneRow}>
                  <Phone color="rgba(255,255,255,0.75)" size={12} />
                  <Text style={styles.headerPhone}>{phone}</Text>
                </View>
              ) : null}
              {profile?.registration_no ? (
                <View style={styles.headerPhoneRow}>
                  <Hash color="rgba(255,255,255,0.75)" size={12} />
                  <Text style={styles.headerPhone}>{t('profile.reg')} {profile.registration_no}</Text>
                </View>
              ) : null}
            </View>
          </View>
        </LinearGradient>

        <View style={styles.contentWrapper}>
        {/* Status card */}
        <View style={[styles.statusCard, { backgroundColor: cfg.bg, borderColor: cfg.color + '40' }]}>
          <View style={styles.statusRow}>
            <StatusIcon color={cfg.color} size={20} />
            <Text style={[styles.statusLabel, { color: cfg.color }]}>{cfg.label}</Text>
          </View>
          <Text style={styles.statusDesc}>{cfg.description}</Text>
          {status === 'approved' && profile?.reviewed_at ? (
            <View style={styles.statusDateRow}>
              <Calendar color={cfg.color} size={13} />
              <Text style={[styles.statusDateText, { color: cfg.color }]}>
                {t('profile.approvedOn') + ' '}
                {new Date(profile.reviewed_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
              </Text>
            </View>
          ) : null}
          {(status === 'submitted' || status === 'resubmitted' || status === 'under_review') && profile?.submitted_at ? (
            <View style={styles.statusDateRow}>
              <Calendar color={cfg.color} size={13} />
              <Text style={[styles.statusDateText, { color: cfg.color }]}>
                {t('profile.submittedOn') + ' '}
                {new Date(profile.submitted_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
              </Text>
            </View>
          ) : null}
          {profile?.admin_remarks && (status === 'rejected' || status === 'changes_requested') ? (
            <View style={styles.remarksBox}>
              <Text style={styles.remarksTitle}>{t('profile.adminRemarks')}</Text>
              <Text style={styles.remarksText}>{profile.admin_remarks}</Text>
            </View>
          ) : null}
        </View>


        {/* ── TAB 1: Personal ── */}
        {profile && (
          <SectionCard title={t('profile.personalDetails')} icon={User}>
            <InfoRow label={t('profile.fullName')} value={displayName} />
            {profile.alias_name ? <InfoRow label={t('profile.knownAs')} value={profile.alias_name} /> : null}
            <InfoRow label={t('profile.dateOfBirth')} value={formatDate(profile.date_of_birth)} />
            <InfoRow label={t('profile.gender')} value={profile.gender} />
            <InfoRow label={t('profile.bloodGroup')} value={profile.blood_group} />
            {(profile.is_bhagari || profile.is_baristha_bhai_pua) && (
              <BadgeRow
                label={t('profile.sebayatStatus')}
                value={profile.is_bhagari ? t('profile.bhagari') : t('profile.baristhaBhaiPua')}
                color={profile.is_bhagari ? C.success : C.gold}
              />
            )}
            {(profile.health_card_no || profile.health_card_photo_url) && (
              <>
                <InfoRow label={t('profile.healthCardNo')} value={profile.health_card_no} />
                {profile.health_card_photo_url && (
                  <View style={styles.photoRowSingle}>
                    <PhotoThumb uri={profile.health_card_photo_url} label={t('profile.healthCard')} onPress={setLightboxUri} />
                  </View>
                )}
              </>
            )}
            {profile.photo_url && (
              <View style={styles.photoRowSingle}>
                <PhotoThumb uri={profile.photo_url} label={t('profile.profilePhoto')} onPress={setLightboxUri} />
              </View>
            )}
          </SectionCard>
        )}

        {/* ── TAB 2: Contact & IDs ── */}
        {profile && (
          <SectionCard title={t('profile.contactIdentity')} icon={Phone}>
            <InfoRow label={t('profile.primaryPhone')} value={phone} />
            {profile.whatsapp_number && profile.whatsapp_number !== phone.replace(/^\+/, '') && (
              <InfoRow label={t('profile.whatsapp')} value={profile.whatsapp_number} />
            )}
            <InfoRow label={t('profile.email')} value={profile.email} />
            {(profile.extra_phones || []).filter(Boolean).map((p, i) => (
              <InfoRow key={i} label={`${t('profile.primaryPhone').replace('Primary ','Phone ')} ${i + 2}`} value={p} />
            ))}
            {idDocs.length > 0 && (
              <>
                <View style={styles.subSectionLabel}>
                  <IdCard color={C.textMuted} size={13} />
                  <Text style={styles.subSectionText}>{t('profile.identityDocuments')}</Text>
                </View>
                {idDocs.map((doc, i) => (
                  <View key={doc.id} style={[styles.infoRow, { alignItems: 'flex-start' }]}>
                    <Text style={styles.infoLabel}>{translateIdType(doc.id_type, t)}</Text>
                    {doc.photo_url ? (
                      <TouchableOpacity style={styles.photoThumbInline} onPress={() => setLightboxUri(doc.photo_url)} activeOpacity={0.8}>
                        <CachedImage uri={doc.photo_url} style={styles.photoThumbImgSm} resizeMode="cover" />
                      </TouchableOpacity>
                    ) : (
                      <Text style={[styles.infoValue, { color: C.textMuted }]}>{t('profile.noPhoto')}</Text>
                    )}
                  </View>
                ))}
              </>
            )}
          </SectionCard>
        )}

        {/* ── TAB 3: Family ── */}
        {profile && (profile.father_name || profile.mother_name || profile.marital_status) && (
          <SectionCard title={t('profile.family')} icon={Users}>
            <InfoRow label={t('profile.fathersName')} value={profile.father_name} />
            <InfoRow label={t('profile.mothersName')} value={profile.mother_name} />
            <InfoRow label={t('profile.maritalStatus')} value={profile.marital_status} />
            {profile.marital_status?.toLowerCase() === 'married' && (
              <>
                <InfoRow label={t('profile.spousesName')} value={profile.spouse_name} />
                <InfoRow label={t('profile.spousesFather')} value={profile.spouse_father_name} />
                <InfoRow label={t('profile.spousesMother')} value={profile.spouse_mother_name} />
                {(profile.spouse_photo_url || profile.spouse_father_photo_url || profile.spouse_mother_photo_url) && (
                  <View style={styles.photoRow}>
                    <PhotoThumb uri={profile.spouse_photo_url} label={t('profile.spousesName')} onPress={setLightboxUri} />
                    <PhotoThumb uri={profile.spouse_father_photo_url} label={t('profile.spousesFather')} onPress={setLightboxUri} />
                    <PhotoThumb uri={profile.spouse_mother_photo_url} label={t('profile.spousesMother')} onPress={setLightboxUri} />
                  </View>
                )}
              </>
            )}
            {/* Children */}
            {(profile.children || []).length > 0 && (
              <>
                <View style={styles.subSectionLabel}>
                  <Baby color={C.textMuted} size={13} />
                  <Text style={styles.subSectionText}>{t('profile.children')}</Text>
                </View>
                {(profile.children || []).map((child, i) => (
                  <View key={i} style={[styles.childCard, i > 0 && { marginTop: 8 }]}>
                    <View style={styles.childLeft}>
                      <CachedImage
                        uri={child.photo_url}
                        style={styles.childAvatar}
                        resizeMode="cover"
                        fallback={<View style={styles.childAvatarPlaceholder}><User color={C.textMuted} size={14} /></View>}
                        containerStyle={styles.childAvatar}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.childName}>{child.child_name || `${t('profile.child')} ${i + 1}`}</Text>
                        <Text style={styles.childMeta}>
                          {[child.gender, child.date_of_birth, child.marital_status].filter(Boolean).join(' · ')}
                        </Text>
                      </View>
                    </View>
                  </View>
                ))}
              </>
            )}
          </SectionCard>
        )}

        {/* ── TAB 4: Address ── */}
        {profile && (permanentAddr || currentAddr) && (
          <SectionCard title={t('profile.address')} icon={MapPin}>
            {permanentAddr ? (
              <>
                <Text style={styles.addressSubtitle}>{t('profile.permanentAddress')}</Text>
                <Text style={styles.addressText}>{permanentAddr}</Text>
                {profile.permanent_address_text ? (
                  <Text style={styles.addressNote}>{profile.permanent_address_text}</Text>
                ) : null}
              </>
            ) : null}
            {profile.is_permanent_different && currentAddr ? (
              <>
                <View style={[styles.addressDivider]} />
                <Text style={styles.addressSubtitle}>{t('profile.currentAddress')}</Text>
                <Text style={styles.addressText}>{currentAddr}</Text>
                {profile.current_address_text ? (
                  <Text style={styles.addressNote}>{profile.current_address_text}</Text>
                ) : null}
              </>
            ) : null}
          </SectionCard>
        )}

        {/* ── TAB 5: Occupation ── */}
        {profile && ((profile.occupations || []).length > 0 || joiningDisplay) && (
          <SectionCard title={t('profile.occupationJoining')} icon={Briefcase}>
            <InfoRow label={t('profile.joining')} value={joiningDisplay ?? undefined} />
            {(profile.occupations || []).filter(o => o.occupation).map((occ, i) => (
              <View key={i} style={[styles.occCard, i > 0 && { marginTop: 8 }]}>
                <Text style={styles.occTitle}>{occ.occupation}</Text>
                {occ.extra_curriculum_activity ? (
                  <Text style={styles.occSub}>{occ.extra_curriculum_activity}</Text>
                ) : null}
              </View>
            ))}
          </SectionCard>
        )}

        {/* ── TAB 6: Social ── */}
        {profile && (profile.social_facebook || profile.social_twitter || profile.social_instagram || profile.social_linkedin || profile.social_youtube) && (
          <SectionCard title={t('profile.socialProfiles')} icon={Globe}>
            <LinkRow label="Facebook" value={profile.social_facebook} />
            <LinkRow label="Twitter / X" value={profile.social_twitter} />
            <LinkRow label="Instagram" value={profile.social_instagram} />
            <LinkRow label="LinkedIn" value={profile.social_linkedin} />
            <LinkRow label="YouTube" value={profile.social_youtube} />
          </SectionCard>
        )}

        {/* ── TAB 7: Seba Heritage & Selections ── */}
        {profile && (profile.bansa_name || profile.seba_name || Object.keys(sebaSelByCategory).length > 0 || nijogAssignments.length > 0) && (
          <SectionCard title={t('profile.sebaHeritage')} icon={Star}>
            <InfoRow label={t('profile.bansa')} value={profile.bansa_name} />
            <InfoRow label={t('profile.paliaNo')} value={profile.palia_number} />
            <InfoRow label={t('profile.sebaName')} value={profile.seba_name} />
            <InfoRow label={t('profile.joining')} value={joiningDisplay} />

            {nijogAssignments.length > 0 && (
              <>
                <View style={styles.subSectionLabel}>
                  <Star color={C.saffron} size={13} />
                  <Text style={[styles.subSectionText, { color: C.saffron }]}>
                    {t('profile.nijogAssignments')} {new Date().getFullYear()}
                  </Text>
                </View>
                {nijogAssignments.map((a, i) => (
                  <View key={i} style={[styles.nijogAssignRow, i < nijogAssignments.length - 1 && styles.rowBorder]}>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={styles.nijogAssignSeba}>{language === 'or' && a.seba_name_or ? a.seba_name_or : a.seba_name}</Text>
                      <Text style={styles.nijogAssignGroup}>{language === 'or' && a.group_name_or ? a.group_name_or : a.group_name}</Text>
                    </View>
                    <View style={styles.nijogBeddhaTag}>
                      <Hash color={C.saffron} size={11} />
                      <Text style={styles.nijogBeddhaText}>{t('schedule.beddha')} {a.beddha_number}</Text>
                    </View>
                  </View>
                ))}
              </>
            )}

            {Object.keys(sebaSelByCategory).length > 0 && (
              <>
                <View style={styles.subSectionLabel}>
                  <Star color={C.textMuted} size={13} />
                  <Text style={styles.subSectionText}>{t('profile.sebaClaims')}</Text>
                </View>
                {Object.entries(sebaSelByCategory).map(([catName, { nameOr, beddhas }]) => (
                  <View key={catName} style={styles.sebaClaimRow}>
                    <Text style={styles.sebaClaimName}>{language === 'or' && nameOr ? nameOr : catName}</Text>
                    <View style={styles.beddhaChips}>
                      {beddhas.map((b) => (
                        <View key={b} style={styles.beddhaChip}>
                          <Text style={styles.beddhaChipText}>{b}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                ))}
              </>
            )}
          </SectionCard>
        )}

        {/* Language */}
        <SectionCard title={t('profile.languageLabel')} icon={Languages}>
          <TouchableOpacity
            style={styles.infoRow}
            onPress={() => setLangModalOpen(true)}
            activeOpacity={0.7}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.infoLabel}>{t('profile.languageLabel')}</Text>
              <Text style={{ fontSize: 11, fontFamily: 'Poppins_400Regular', color: C.textMuted, marginTop: 2 }}>
                {t('profile.languageHint')}
              </Text>
            </View>
            <Text style={{
              fontSize: 14,
              color: C.saffron,
              fontFamily: language === 'or' ? 'NotoSansOriya_600SemiBold' : 'Poppins_600SemiBold',
              marginRight: 6,
            }}>
              {language === 'or' ? 'ଓଡ଼ିଆ' : 'English'}
            </Text>
            <ChevronRight color={C.textMuted} size={16} />
          </TouchableOpacity>
        </SectionCard>

        {/* Offline Mode */}
        <OfflineSettingsSection syncedAt={syncedAt} onSyncNow={fetchProfile} />

        {/* Actions */}
        <View style={styles.actionsSection}>
          {canEdit && (
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => router.push('/register')}
              activeOpacity={0.8}
            >
              {!profile ? (
                <>
                  <FileText color="#fff" size={18} />
                  <Text style={styles.editButtonText}>{t('profile.completeRegistration')}</Text>
                </>
              ) : (
                <>
                  <Edit color="#fff" size={18} />
                  <Text style={styles.editButtonText}>
                    {status === 'changes_requested' || status === 'rejected' ? t('profile.updateResubmit') : t('profile.editRegistration')}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut} activeOpacity={0.7}>
            <LogOut color={C.error} size={18} />
            <Text style={styles.signOutText}>{t('profile.signOut')}</Text>
          </TouchableOpacity>
        </View>

        </View>{/* end contentWrapper */}
      </ScrollView>

      <DrawerPanel {...drawer} />

      {/* ── Language Picker Modal ──────────────────────────── */}
      <Modal visible={langModalOpen} transparent animationType="fade" onRequestClose={() => setLangModalOpen(false)}>
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 24 }}
          activeOpacity={1}
          onPress={() => setLangModalOpen(false)}
        >
          <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 18 }}>
            <Text style={{
              fontSize: 16,
              fontFamily: language === 'or' ? 'NotoSansOriya_700Bold' : 'Poppins_700Bold',
              color: C.textPrimary,
              marginBottom: 12,
            }}>
              {t('profile.selectLanguage')}
            </Text>
            {SUPPORTED_LANGUAGES.map((lng) => {
              const selected = lng.code === language;
              return (
                <TouchableOpacity
                  key={lng.code}
                  style={{
                    flexDirection: 'row', alignItems: 'center', paddingVertical: 12,
                    paddingHorizontal: 12, borderRadius: 10,
                    backgroundColor: selected ? C.saffron + '14' : 'transparent',
                    marginBottom: 4,
                  }}
                  onPress={async () => {
                    await setLanguage(lng.code);
                    setLangModalOpen(false);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={{
                    flex: 1,
                    fontSize: 15,
                    color: C.textPrimary,
                    fontFamily: lng.code === 'or' ? 'NotoSansOriya_600SemiBold' : 'Poppins_600SemiBold',
                  }}>
                    {lng.nativeLabel}
                  </Text>
                  {selected && <Check color={C.saffron} size={18} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Photo Lightbox ─────────────────────────────────── */}
      <Modal visible={!!lightboxUri} transparent animationType="fade" onRequestClose={() => setLightboxUri(null)}>
        <TouchableOpacity style={styles.lightboxOverlay} activeOpacity={1} onPress={() => setLightboxUri(null)}>
          <View style={styles.lightboxContent}>
            {lightboxUri && (
              <Image source={{ uri: lightboxUri }} style={styles.lightboxImage} resizeMode="contain" />
            )}
            <TouchableOpacity style={styles.lightboxClose} onPress={() => setLightboxUri(null)} activeOpacity={0.8}>
              <X color="#fff" size={20} strokeWidth={2.5} />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.warmWhite },
  loadingCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  headerGradient: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 52 },
  contentWrapper: { backgroundColor: '#FFFDF9', borderTopLeftRadius: 32, borderTopRightRadius: 32, marginTop: -28, flex: 1 },
  headerTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  headerTitle: { fontSize: 22, fontFamily: 'Poppins_700Bold', color: '#fff' },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  avatar: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.5)', flexShrink: 0,
  },
  avatarImg: {
    width: 72, height: 72, borderRadius: 36,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.5)', flexShrink: 0,
  },
  avatarInfo: { flex: 1, gap: 2 },
  headerName: { fontSize: 20, fontFamily: 'Poppins_700Bold', color: '#fff', lineHeight: 26 },
  headerAlias: { fontSize: 13, fontFamily: 'Poppins_400Regular', color: 'rgba(255,255,255,0.8)', fontStyle: 'italic' },
  headerPhoneRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  headerPhone: { fontSize: 12, fontFamily: 'Poppins_400Regular', color: 'rgba(255,255,255,0.85)' },

  statusCard: {
    marginHorizontal: 16, marginTop: -14, borderRadius: 16, borderWidth: 1,
    padding: 16, marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 3,
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  statusLabel: { fontSize: 15, fontFamily: 'Poppins_700Bold' },
  statusDesc: { fontSize: 13, fontFamily: 'Poppins_400Regular', color: C.textSecondary, lineHeight: 20 },
  statusDateRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 },
  statusDateText: { fontSize: 12, fontFamily: 'Poppins_600SemiBold', opacity: 0.85 },
  remarksBox: { marginTop: 12, backgroundColor: '#fff', borderRadius: 10, padding: 12 },
  remarksTitle: { fontSize: 11, fontFamily: 'Poppins_700Bold', color: C.error, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  remarksText: { fontSize: 13, fontFamily: 'Poppins_400Regular', color: C.textPrimary, lineHeight: 20 },

  section: {
    marginHorizontal: 16, backgroundColor: '#fff', borderRadius: 16,
    borderWidth: 1, borderColor: C.border,
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10, marginBottom: 12,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 12 },
  sectionTitle: { fontSize: 12, fontFamily: 'Poppins_700Bold', color: C.textPrimary, textTransform: 'uppercase', letterSpacing: 0.6 },

  infoRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  infoLabel: { fontSize: 13, fontFamily: 'Poppins_400Regular', color: C.textMuted, flex: 1 },
  infoValue: { fontSize: 13, fontFamily: 'Poppins_500Medium', color: C.textPrimary, flex: 2, textAlign: 'right' },

  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, alignSelf: 'flex-end' },
  pillText: { fontSize: 12, fontFamily: 'Poppins_600SemiBold' },

  subSectionLabel: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, marginBottom: 6 },
  subSectionText: { fontSize: 12, fontFamily: 'Poppins_600SemiBold', color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 },

  photoRow: { flexDirection: 'row', gap: 10, marginTop: 12, flexWrap: 'wrap' },
  photoRowSingle: { marginTop: 12 },
  photoThumb: { alignItems: 'center', gap: 4 },
  photoThumbImg: { width: 80, height: 80, borderRadius: 10, borderWidth: 1, borderColor: C.border },
  photoThumbLabel: { fontSize: 11, fontFamily: 'Poppins_400Regular', color: C.textMuted },
  photoThumbInline: { alignSelf: 'flex-end' },
  photoThumbImgSm: { width: 60, height: 44, borderRadius: 6, borderWidth: 1, borderColor: C.border },

  assignmentRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: C.border },
  assignmentSeba: { fontSize: 14, fontFamily: 'Poppins_600SemiBold', color: C.textPrimary },
  beddhaTag: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  beddhaTagText: { fontSize: 13, fontFamily: 'Poppins_600SemiBold' },

  addressSubtitle: { fontSize: 12, fontFamily: 'Poppins_600SemiBold', color: C.textMuted, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.4 },
  addressText: { fontSize: 14, fontFamily: 'Poppins_400Regular', color: C.textPrimary, lineHeight: 22 },
  addressNote: { fontSize: 12, fontFamily: 'Poppins_400Regular', color: C.textMuted, marginTop: 4, fontStyle: 'italic' },
  addressDivider: { height: 1, backgroundColor: C.border, marginVertical: 12 },

  childCard: {
    backgroundColor: C.cream, borderRadius: 10, borderWidth: 1, borderColor: C.border, padding: 12,
  },
  childLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  childAvatar: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: C.border },
  childAvatarPlaceholder: { backgroundColor: '#F5F0EC', alignItems: 'center', justifyContent: 'center' },
  childName: { fontSize: 14, fontFamily: 'Poppins_600SemiBold', color: C.textPrimary },
  childMeta: { fontSize: 12, fontFamily: 'Poppins_400Regular', color: C.textMuted, marginTop: 1 },

  occCard: { backgroundColor: C.cream, borderRadius: 10, borderWidth: 1, borderColor: C.border, padding: 12 },
  occTitle: { fontSize: 14, fontFamily: 'Poppins_600SemiBold', color: C.textPrimary },
  occSub: { fontSize: 12, fontFamily: 'Poppins_400Regular', color: C.textMuted, marginTop: 2 },

  nijogAssignRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 },
  nijogAssignSeba: { fontSize: 13, fontFamily: 'Poppins_600SemiBold', color: C.textPrimary },
  nijogAssignGroup: { fontSize: 11, fontFamily: 'Poppins_400Regular', color: C.textMuted },
  nijogBeddhaTag: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  nijogBeddhaText: { fontSize: 13, fontFamily: 'Poppins_700Bold', color: C.saffron },

  sebaClaimRow: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.border },
  sebaClaimName: { fontSize: 13, fontFamily: 'Poppins_500Medium', color: C.textPrimary, marginBottom: 6 },
  beddhaChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  beddhaChip: {
    paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8,
    backgroundColor: C.saffron + '18', borderWidth: 1, borderColor: C.saffron + '40',
  },
  beddhaChipText: { fontSize: 12, fontFamily: 'Poppins_700Bold', color: C.saffron },

  lightboxOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center',
  },
  lightboxContent: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  lightboxImage: { width: '100%', height: '85%' },
  lightboxClose: {
    position: 'absolute', top: 48, right: 20,
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
  },

  linkValue: { color: C.saffron, textDecorationLine: 'underline' },

  actionsSection: { paddingHorizontal: 16, paddingBottom: 40, gap: 12, marginTop: 4 },
  editButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: C.saffron, paddingVertical: 15, borderRadius: 14,
  },
  editButtonText: { fontSize: 16, fontFamily: 'Poppins_600SemiBold', color: '#fff' },
  signOutButton: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 15, paddingHorizontal: 20,
    backgroundColor: '#fff', borderRadius: 14,
    borderWidth: 1, borderColor: C.border, justifyContent: 'center',
  },
  signOutText: { fontSize: 15, color: C.error, fontFamily: 'Poppins_500Medium' },

  menuBtn: {
    width: 38, height: 38, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },

});
