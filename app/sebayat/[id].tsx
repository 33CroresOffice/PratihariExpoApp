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

type Sebayat = {
  id: string;
  full_name: string | null;
  phone: string | null;
  primary_phone: string | null;
  whatsapp_number: string | null;
  extra_phones: string[] | null;
  photo_url: string | null;
  bansa_name: string | null;
  palia_number: string | null;
  seba_name: string | null;
  registration_no: string | null;
  health_card_no: string | null;
  blood_group: string | null;
  date_of_birth: string | null;
  gender: string | null;
  father_name: string | null;
  mother_name: string | null;
  current_sahi: string | null;
  current_district: string | null;
  current_state: string | null;
  address_village: string | null;
  address_district: string | null;
  joining_date: string | null;
  joining_year: string | null;
  occupations: string[] | null;
  is_bhagari: boolean | null;
  is_baristha_bhai_pua: boolean | null;
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

export default function SebayatDetailScreen() {
  const drawer = useDrawer();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [sebayat, setSebayat] = useState<Sebayat | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) fetchSebayat();
  }, [id]);

  async function fetchSebayat() {
    const { data } = await supabase
      .from('sebayats')
      .select(
        'id, full_name, phone, primary_phone, whatsapp_number, extra_phones, photo_url, bansa_name, palia_number, seba_name, registration_no, health_card_no, blood_group, date_of_birth, gender, father_name, mother_name, current_sahi, current_district, current_state, address_village, address_district, joining_date, joining_year, occupations, is_bhagari, is_baristha_bhai_pua, profile_status'
      )
      .eq('id', id!)
      .maybeSingle();
    setSebayat(data as Sebayat | null);
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
  const joiningLabel = sebayat.joining_date
    ? new Date(sebayat.joining_date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
    : sebayat.joining_year
    ? sebayat.joining_year
    : null;

  const dobLabel = sebayat.date_of_birth
    ? new Date(sebayat.date_of_birth + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;

  const address = [sebayat.current_sahi, sebayat.current_district, sebayat.current_state]
    .filter(Boolean)
    .join(', ') || [sebayat.address_village, sebayat.address_district].filter(Boolean).join(', ');

  const allPhones = [primaryPhone, sebayat.whatsapp_number, ...(sebayat.extra_phones ?? [])]
    .filter((p, i, arr) => p && arr.indexOf(p) === i) as string[];

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
            </View>
          </View>

        </LinearGradient>

        <View style={styles.contentWrapper}>
        <View style={styles.body}>
          {/* Contact */}
          {allPhones.length > 0 && (
            <Section title="Contact">
              {allPhones.map((p, i) => (
                <Row
                  key={i}
                  icon={<Phone color={C.saffron} size={16} />}
                  label={i === 0 ? 'Primary Phone' : i === 1 && sebayat.whatsapp_number === p ? 'WhatsApp' : `Phone ${i + 1}`}
                  value={p}
                />
              ))}
            </Section>
          )}

          {/* Personal */}
          <Section title="Personal Details">
            <Row icon={<UserRound color={C.saffron} size={16} />} label="Gender" value={sebayat.gender} />
            <Row icon={<Calendar color={C.saffron} size={16} />} label="Date of Birth" value={dobLabel} />
            <Row icon={<Heart color={C.saffron} size={16} />} label="Father's Name" value={sebayat.father_name} />
            <Row icon={<Heart color={C.gold} size={16} />} label="Mother's Name" value={sebayat.mother_name} />
          </Section>

        </View>
        </View>{/* end contentWrapper */}
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
  quickPills: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginTop: 20,
    flexWrap: 'wrap',
  },
  quickPill: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignItems: 'center',
    minWidth: 72,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  quickPillLabel: {
    fontSize: 10,
    fontFamily: 'Poppins_400Regular',
    color: 'rgba(255,255,255,0.7)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  quickPillValue: {
    fontSize: 14,
    fontFamily: 'Poppins_700Bold',
    color: '#fff',
    marginTop: 1,
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
