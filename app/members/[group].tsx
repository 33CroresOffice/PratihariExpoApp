import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Users, Hash } from 'lucide-react-native';
import { useDrawer, DrawerPanel, MenuButton } from '@/components/SlideDrawer';

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

type Member = {
  id: string;
  full_name: string;
  seba_name: string;
  beddha_number: number;
};

const GROUP_CONFIG: Record<string, { label: string; colors: [string, string]; iconColor: string }> = {
  pratihari: {
    label: 'Pratihari',
    colors: ['#2D8A5A', '#1A6642'],
    iconColor: '#2D8A5A',
  },
  gochhikar: {
    label: 'Gochhikar',
    colors: ['#1D7A96', '#145E73'],
    iconColor: '#1D7A96',
  },
};

export default function MembersScreen() {
  const drawer = useDrawer();
  const { group } = useLocalSearchParams<{ group: string }>();
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  const config = GROUP_CONFIG[group ?? 'pratihari'] ?? GROUP_CONFIG.pratihari;

  useEffect(() => {
    fetchMembers();
  }, [group]);

  async function fetchMembers() {
    setLoading(true);
    const { data: groups } = await supabase
      .from('seba_groups')
      .select('id, code')
      .eq('code', group ?? 'pratihari')
      .maybeSingle();

    if (!groups) {
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from('nijog_assignments')
      .select(
        'sebayat_id, beddha_number, seba_categories!inner(name, group_id), sebayats!inner(full_name, profile_status)'
      )
      .eq('seba_categories.group_id', groups.id)
      .eq('sebayats.profile_status', 'approved');

    if (data) {
      const seen = new Set<string>();
      const result: Member[] = [];
      for (const r of data as any[]) {
        if (!seen.has(r.sebayat_id)) {
          seen.add(r.sebayat_id);
          result.push({
            id: r.sebayat_id,
            full_name: r.sebayats.full_name || 'Unknown',
            seba_name: r.seba_categories.name,
            beddha_number: r.beddha_number,
          });
        }
      }
      result.sort((a, b) => a.full_name.localeCompare(b.full_name));
      setMembers(result);
    }
    setLoading(false);
  }

  function renderMember({ item, index }: { item: Member; index: number }) {
    return (
      <View
        style={[
          styles.memberRow,
          index < members.length - 1 && styles.memberRowBorder,
        ]}
      >
        <View style={styles.memberAvatar}>
          <Text style={[styles.memberAvatarText, { color: config.iconColor }]}>
            {item.full_name.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.memberInfo}>
          <Text style={styles.memberName}>{item.full_name}</Text>
          <Text style={styles.memberSeba}>{item.seba_name}</Text>
        </View>
        <View style={styles.memberBeddha}>
          <Hash color={C.textMuted} size={11} />
          <Text style={styles.memberBeddhaText}>{item.beddha_number}</Text>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={config.colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <ArrowLeft color="#fff" size={22} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Users color="rgba(255,255,255,0.85)" size={20} />
          <Text style={styles.headerTitle}>{config.label} Members</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {!loading && (
            <View style={styles.countBadge}>
              <Text style={[styles.countBadgeText, { color: config.iconColor }]}>
                {members.length}
              </Text>
            </View>
          )}
          <MenuButton onPress={drawer.open} />
        </View>
      </LinearGradient>

      <View style={styles.contentWrapper}>
      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={C.saffron} size="large" />
        </View>
      ) : members.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Users color={C.textMuted} size={48} />
          <Text style={styles.emptyText}>No members found</Text>
        </View>
      ) : (
        <FlatList
          data={members}
          keyExtractor={(item) => item.id}
          renderItem={renderMember}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
      </View>{/* end contentWrapper */}
      <DrawerPanel {...drawer} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.warmWhite },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyText: {
    fontSize: 15,
    fontFamily: 'Poppins_400Regular',
    color: C.textMuted,
  },

  // Header
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
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Poppins_700Bold',
    color: '#fff',
  },
  countBadge: {
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
    minWidth: 36,
    alignItems: 'center',
  },
  countBadgeText: {
    fontSize: 15,
    fontFamily: 'Poppins_700Bold',
  },

  listContent: {
    padding: 16,
  },

  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 12,
  },
  memberRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  memberAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: C.cream,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: C.border,
    flexShrink: 0,
  },
  memberAvatarText: {
    fontSize: 18,
    fontFamily: 'Poppins_700Bold',
  },
  memberInfo: { flex: 1 },
  memberName: {
    fontSize: 15,
    fontFamily: 'Poppins_600SemiBold',
    color: C.textPrimary,
    marginBottom: 2,
  },
  memberSeba: {
    fontSize: 12,
    fontFamily: 'Poppins_400Regular',
    color: C.textSecondary,
  },
  memberBeddha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: C.cream,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.border,
  },
  memberBeddhaText: {
    fontSize: 13,
    fontFamily: 'Poppins_600SemiBold',
    color: C.textMuted,
  },
});
