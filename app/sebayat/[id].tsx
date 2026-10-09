import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/lib/supabase';
import { useDrawer, DrawerPanel, MenuButton } from '@/components/SlideDrawer';
import {
  ArrowLeft,
  Phone,
  Heart,
  Calendar,
  BadgeCheck,
  Star,
  UserRound,
  MapPin,
  Briefcase,
  Globe,
  Users,
  Home,
  MessageCircle,
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
  success: '#2D8A5A',
};

type Child = {
  child_name: string;
  date_of_birth: string | null;
  gender: string | null;
  marital_status: string | null;
};

type Occupation = {
  occupation: string;
  extra_curriculum_activity: string;
};

type SebaSelection = {
  seba_category_id: string;
  beddha_number: number;
  category_name: string;
  category_name_or: string | null;
};

type Sebayat = {
  id: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  alias_name: string | null;
  phone: string | null;
  primary_phone: string | null;
  whatsapp_number: string | null;
  extra_phones: string[] | null;
  email: string | null;
  photo_url: string | null;
  bansa_name: string | null;
  palia_number: string | null;
  seba_name: string | null;
  registration_no: string | null;
  health_card_no: string | null;
  blood_group: string | null;
  date_of_birth: string | null;
  gender: string | null;
  marital_status: string | null;
  spouse_name: string | null;
  father_name: string | null;
  father_dob: string | null;
  mother_name: string | null;
  mother_dob: string | null;
  hobby: string | null;
  permanent_sahi: string | null;
  permanent_landmark: string | null;
  permanent_post_office: string | null;
  permanent_police_station: string | null;
  permanent_pincode: string | null;
  permanent_district: string | null;
  permanent_state: string | null;
  current_sahi: string | null;
  current_district: string | null;
  current_state: string | null;
  address_village: string | null;
  address_district: string | null;
  joining_date: string | null;
  joining_year: string | null;
  joining_date_exact: boolean | null;
  occupations: Occupation[] | null;
  social_facebook: string | null;
  social_twitter: string | null;
  social_instagram: string | null;
  social_linkedin: string | null;
  social_youtube: string | null;
  is_bhagari: boolean | null;
  is_baristha_bhai_pua: boolean | null;
  is_bhai_pua: boolean | null;
  is_palia: boolean | null;
  profile_status: string | null;
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionCard}>{children}</View>
    </View>
  );
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <View style={styles.row}>
      <View style={styles.rowIcon}>{icon}</View>
      <View style={styles.rowContent}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowValue}>{value}</Text>
      </View>
    </View>
  );
}

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function SebayatDetailScreen() {
  const drawer = useDrawer();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [sebayat, setSebayat] = useState<Sebayat | null>(null);
  const [children, setChildren] = useState<Child[]>([]);
  const [sebaSelections, setSebaSelections] = useState<SebaSelection[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) fetchSebayat();
  }, [id]);

  async function fetchSebayat() {
    const { data } = await supabase
      .from('sebayats')
      .select(
        'id, full_name, first_name, last_name, alias_name, phone, primary_phone, whatsapp_number, extra_phones, email, photo_url, bansa_name, palia_number, seba_name, registration_no, health_card_no, blood_group, date_of_birth, gender, marital_status, spouse_name, father_name, father_dob, mother_name, mother_dob, hobby, permanent_sahi, permanent_landmark, permanent_post_office, permanent_police_station, permanent_pincode, permanent_district, permanent_state, current_sahi, current_district, current_state, address_village, address_district, joining_date, joining_year, joining_date_exact, occupations, social_facebook, social_twitter, social_instagram, social_linkedin, social_youtube, is_bhagari, is_baristha_bhai_pua, is_bhai_pua, is_palia, profile_status'
      )
      .eq('id', id!)
      .maybeSingle();
    setSebayat(data as Sebayat | null);

    if (data) {
      const [childRes, sebaRes] = await Promise.all([
        supabase.from('children').select('child_name, date_of_birth, gender, marital_status').eq('sebayat_id', id!),
        supabase
          .from('sebayat_seba_selections')
          .select('seba_category_id, beddha_number, seba_categories!inner(name, name_or)')
          .eq('sebayat_id', id!)
          .order('beddha_number', { ascending: true }),
      ]);
      if (childRes.data) setChildren(childRes.data as Child[]);
      if (sebaRes.data) {
        const sels = (sebaRes.data as any[]).map((r) => ({
          seba_category_id: r.seba_category_id,
          beddha_number: r.beddha_number,
          category_name: r.seba_categories?.name || '',
          category_name_or: r.seba_categories?.name_or ?? null,
        }));
        setSebaSelections(sels);
      }
    }
    setLoading(false);
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

  if (!sebayat) {
    return (
      <SafeAreaView style={styles.container}>
        <TouchableOpacity style={styles.backBtnStandalone} onPress={() => router.back()} activeOpacity={0.7}>
          <ArrowLeft color={C.textPrimary} size={22} />
        </TouchableOpacity>
        <View style={styles.loadingWrap}>
          <UserRound color={C.textMuted} size={48} />
          <Text style={styles.notFoundText}>Sebayat not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const displayName = sebayat.full_name || 'Unknown';
  const initials = displayName.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  const primaryPhone = sebayat.primary_phone || sebayat.phone;
  const joiningLabel = sebayat.joining_date_exact
    ? formatDate(sebayat.joining_date)
    : sebayat.joining_year || sebayat.joining_date;

  const dobLabel = formatDate(sebayat.date_of_birth);

  const permanentAddr = [
    sebayat.permanent_sahi,
    sebayat.permanent_landmark,
    sebayat.permanent_post_office && `P.O. ${sebayat.permanent_post_office}`,
    sebayat.permanent_police_station && `P.S. ${sebayat.permanent_police_station}`,
    sebayat.permanent_pincode,
    sebayat.permanent_district,
    sebayat.permanent_state,
  ].filter(Boolean).join(', ') || [sebayat.address_village, sebayat.address_district].filter(Boolean).join(', ');

  const allPhones = [primaryPhone, sebayat.whatsapp_number, ...(sebayat.extra_phones ?? [])]
    .filter((p, i, arr) => p && arr.indexOf(p) === i) as string[];

  const occupations = (sebayat.occupations || []).filter((o) => o.occupation || o.extra_curriculum_activity);
  const sons = children.filter((c) => c.gender === 'Male');

  const hasSocial = sebayat.social_facebook || sebayat.social_twitter || sebayat.social_instagram ||
    sebayat.social_linkedin || sebayat.social_youtube;
  const hasFamily = sebayat.father_name || sebayat.mother_name || sebayat.spouse_name || children.length > 0;
  const hasSeba = sebayat.bansa_name || sebayat.seba_name || sebayat.palia_number || joiningLabel || sebaSelections.length > 0;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <LinearGradient
          colors={['#E8732A', '#D4A843']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
              <ArrowLeft color="#fff" size={22} />
            </TouchableOpacity>
            <MenuButton onPress={drawer.open} />
          </View>

          <View style={styles.heroSection}>
            {sebayat.photo_url ? (
              <Image source={{ uri: sebayat.photo_url }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarInitials}>{initials}</Text>
              </View>
            )}
            <Text style={styles.heroName}>{displayName}</Text>
            {sebayat.alias_name ? <Text style={styles.heroAlias}>aka {sebayat.alias_name}</Text> : null}
            {sebayat.seba_name && <Text style={styles.heroSeba}>{sebayat.seba_name}</Text>}

            <View style={styles.heroBadges}>
              {sebayat.is_bhagari && (
                <View style={styles.heroBadge}>
                  <Star color={C.gold} size={12} fill={C.gold} />
                  <Text style={[styles.heroBadgeText, { color: C.gold }]}>Bhagari</Text>
                </View>
              )}
              {sebayat.is_baristha_bhai_pua && (
                <View style={[styles.heroBadge, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                  <BadgeCheck color="#fff" size={12} />
                  <Text style={[styles.heroBadgeText, { color: '#fff' }]}>Baristha Bhai Pua</Text>
                </View>
              )}
              {sebayat.is_bhai_pua && (
                <View style={[styles.heroBadge, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                  <BadgeCheck color="#fff" size={12} />
                  <Text style={[styles.heroBadgeText, { color: '#fff' }]}>Bhai Pua</Text>
                </View>
              )}
              {sebayat.is_palia && (
                <View style={[styles.heroBadge, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                  <BadgeCheck color="#fff" size={12} />
                  <Text style={[styles.heroBadgeText, { color: '#fff' }]}>Palia</Text>
                </View>
              )}
            </View>
          </View>

          {sebayat.registration_no && (
            <View style={styles.regNoPill}>
              <Text style={styles.regNoText}>Reg. No. {sebayat.registration_no}</Text>
            </View>
          )}
        </LinearGradient>

        <View style={styles.contentWrapper}>
        <View style={styles.body}>
          {/* Personal Details */}
          <Section title="Personal Details">
            <Row icon={<UserRound color={C.saffron} size={16} />} label="Gender" value={sebayat.gender} />
            <Row icon={<Calendar color={C.saffron} size={16} />} label="Date of Birth" value={dobLabel} />
            <Row icon={<Heart color={C.saffron} size={16} />} label="Blood Group" value={sebayat.blood_group} />
            <Row icon={<BadgeCheck color={C.saffron} size={16} />} label="Health Card No." value={sebayat.health_card_no} />
            <Row icon={<Heart color={C.saffron} size={16} />} label="Marital Status" value={sebayat.marital_status} />
          </Section>

          {/* Contact Info */}
          {allPhones.length > 0 || sebayat.email ? (
            <Section title="Contact Info">
              {allPhones.map((p, i) => (
                <Row
                  key={`phone-${i}`}
                  icon={<Phone color={C.saffron} size={16} />}
                  label={i === 0 ? 'Primary Phone' : sebayat.whatsapp_number === p ? 'WhatsApp' : `Phone ${i + 1}`}
                  value={p}
                />
              ))}
              {sebayat.whatsapp_number && !allPhones.includes(sebayat.whatsapp_number) && (
                <Row icon={<MessageCircle color={C.saffron} size={16} />} label="WhatsApp" value={sebayat.whatsapp_number} />
              )}
              {sebayat.email && (
                <Row icon={<MessageCircle color={C.saffron} size={16} />} label="Email" value={sebayat.email} />
              )}
            </Section>
          ) : null}

          {/* Family */}
          {hasFamily && (
            <Section title="Family">
              <Row icon={<Heart color={C.saffron} size={16} />} label="Father's Name" value={sebayat.father_name} />
              {sebayat.father_dob && (
                <Row icon={<Calendar color={C.saffron} size={16} />} label="Father's DOB" value={formatDate(sebayat.father_dob)} />
              )}
              <Row icon={<Heart color={C.gold} size={16} />} label="Mother's Name" value={sebayat.mother_name} />
              {sebayat.mother_dob && (
                <Row icon={<Calendar color={C.gold} size={16} />} label="Mother's DOB" value={formatDate(sebayat.mother_dob)} />
              )}
              {sebayat.spouse_name && (
                <Row icon={<Heart color={C.saffron} size={16} />} label="Spouse" value={sebayat.spouse_name} />
              )}
              {sons.map((c, i) => (
                <View key={`son-${i}`}>
                  <Row icon={<Users color={C.saffron} size={16} />} label="Son's Name" value={c.child_name} />
                  {c.date_of_birth && (
                    <Row icon={<Calendar color={C.saffron} size={16} />} label="Son's DOB" value={formatDate(c.date_of_birth)} />
                  )}
                </View>
              ))}
              {children.filter((c) => c.gender !== 'Male').map((c, i) => (
                <View key={`child-${i}`}>
                  <Row icon={<Users color={C.gold} size={16} />} label={c.gender === 'Female' ? "Daughter's Name" : "Child's Name"} value={c.child_name} />
                  {c.date_of_birth && (
                    <Row icon={<Calendar color={C.gold} size={16} />} label="Date of Birth" value={formatDate(c.date_of_birth)} />
                  )}
                </View>
              ))}
            </Section>
          )}

          {/* Seba Details */}
          {hasSeba && (
            <Section title="Seba Details">
              <Row icon={<Star color={C.saffron} size={16} />} label="Bansa" value={sebayat.bansa_name} />
              <Row icon={<Star color={C.gold} size={16} />} label="Palia Number" value={sebayat.palia_number} />
              <Row icon={<Star color={C.saffron} size={16} />} label="Seba Name" value={sebayat.seba_name} />
              <Row icon={<Calendar color={C.saffron} size={16} />} label="Joining" value={joiningLabel} />
              {sebaSelections.map((s, i) => (
                <Row
                  key={`seba-${i}`}
                  icon={<Star color={C.gold} size={16} />}
                  label={s.category_name}
                  value={`Beddha ${s.beddha_number}`}
                />
              ))}
            </Section>
          )}

          {/* Hobby */}
          {sebayat.hobby && (
            <Section title="Hobby">
              <Row icon={<Heart color={C.saffron} size={16} />} label="Hobby" value={sebayat.hobby} />
            </Section>
          )}

          {/* Social Media */}
          {hasSocial && (
            <Section title="Social Media">
              {sebayat.social_facebook && <Row icon={<Globe color={C.saffron} size={16} />} label="Facebook" value={sebayat.social_facebook} />}
              {sebayat.social_twitter && <Row icon={<Globe color={C.saffron} size={16} />} label="Twitter / X" value={sebayat.social_twitter} />}
              {sebayat.social_instagram && <Row icon={<Globe color={C.saffron} size={16} />} label="Instagram" value={sebayat.social_instagram} />}
              {sebayat.social_linkedin && <Row icon={<Globe color={C.saffron} size={16} />} label="LinkedIn" value={sebayat.social_linkedin} />}
              {sebayat.social_youtube && <Row icon={<Globe color={C.saffron} size={16} />} label="YouTube" value={sebayat.social_youtube} />}
            </Section>
          )}

          {/* Occupation */}
          {occupations.length > 0 && (
            <Section title="Occupation">
              {occupations.map((o, i) => (
                <View key={`occ-${i}`}>
                  <Row icon={<Briefcase color={C.saffron} size={16} />} label="Occupation" value={o.occupation || undefined} />
                  {o.extra_curriculum_activity && (
                    <Row icon={<Briefcase color={C.gold} size={16} />} label="Extra Activity" value={o.extra_curriculum_activity} />
                  )}
                </View>
              ))}
            </Section>
          )}

          {/* Address */}
          {permanentAddr ? (
            <Section title="Address">
              <Row icon={<Home color={C.saffron} size={16} />} label="Permanent Address" value={permanentAddr} />
              {sebayat.current_sahi && sebayat.current_sahi !== sebayat.permanent_sahi && (
                <Row
                  icon={<MapPin color={C.saffron} size={16} />}
                  label="Current Address"
                  value={[sebayat.current_sahi, sebayat.current_district, sebayat.current_state].filter(Boolean).join(', ')}
                />
              )}
            </Section>
          ) : null}

        </View>
        </View>
      </ScrollView>
      <DrawerPanel {...drawer} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.warmWhite },
  scrollContent: { paddingBottom: 48 },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  notFoundText: { fontSize: 15, fontFamily: 'Poppins_400Regular', color: C.textMuted },
  backBtnStandalone: { padding: 20 },

  // Header
  header: {
    paddingTop: 16,
    paddingBottom: 52,
    paddingHorizontal: 20,
  },
  contentWrapper: { backgroundColor: '#FFFDF9', borderTopLeftRadius: 32, borderTopRightRadius: 32, marginTop: -28 },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
    marginBottom: 20,
  },
  heroSection: {
    alignItems: 'center',
    gap: 6,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.7)',
    marginBottom: 4,
  },
  avatarFallback: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  avatarInitials: {
    fontSize: 34,
    fontFamily: 'Poppins_700Bold',
    color: '#fff',
  },
  heroName: {
    fontSize: 22,
    fontFamily: 'Poppins_700Bold',
    color: '#fff',
    textAlign: 'center',
  },
  heroAlias: {
    fontSize: 13,
    fontFamily: 'Poppins_400Regular',
    color: 'rgba(255,255,255,0.72)',
    textAlign: 'center',
  },
  heroSeba: {
    fontSize: 13,
    fontFamily: 'Poppins_400Regular',
    color: 'rgba(255,255,255,0.82)',
    textAlign: 'center',
  },
  heroBadges: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  heroBadgeText: {
    fontSize: 11,
    fontFamily: 'Poppins_600SemiBold',
  },
  regNoPill: {
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 5,
    marginTop: 12,
  },
  regNoText: {
    fontSize: 12,
    fontFamily: 'Poppins_600SemiBold',
    color: 'rgba(255,255,255,0.85)',
  },

  // Body
  body: {
    paddingHorizontal: 16,
    paddingTop: 20,
    gap: 4,
  },

  // Section
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: 'Poppins_600SemiBold',
    color: C.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
    marginLeft: 4,
  },
  sectionCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
  },

  // Row
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
    gap: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  rowIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: C.cream,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  rowContent: { flex: 1 },
  rowLabel: {
    fontSize: 11,
    fontFamily: 'Poppins_400Regular',
    color: C.textMuted,
    marginBottom: 1,
  },
  rowValue: {
    fontSize: 14,
    fontFamily: 'Poppins_600SemiBold',
    color: C.textPrimary,
  },
});
