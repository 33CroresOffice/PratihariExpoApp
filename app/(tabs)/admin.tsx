import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Modal,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { CircleCheck as CheckCircle, Circle as XCircle, CircleAlert as AlertCircle, ChevronRight, Users, Clock, Search, X, Megaphone, History, Image as ImageIcon, UserCog, List } from 'lucide-react-native';

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
  approved: '#27AE60',
};

type FilterStatus = 'all' | 'submitted' | 'resubmitted' | 'under_review' | 'approved' | 'rejected' | 'changes_requested';

interface Sebayat {
  id: string;
  full_name: string;
  phone: string;
  profile_status: string;
  bansa_name: string;
  palia_number: string;
  seba_name: string;
  father_name: string;
  date_of_birth: string;
  gender: string;
  address_village: string;
  address_district: string;
  address_state: string;
  marital_status: string;
  spouse_name: string;
  admin_remarks: string;
  submitted_at: string | null;
  reviewed_at: string | null;
  registration_no: string;
}

const STATUS_COLORS: Record<string, { color: string; bg: string }> = {
  draft: { color: C.textMuted, bg: '#F5F0EC' },
  submitted: { color: '#1D6FAE', bg: '#EBF5FB' },
  resubmitted: { color: '#1D6FAE', bg: '#EBF5FB' },
  under_review: { color: '#B7770D', bg: '#FFF3CD' },
  approved: { color: C.approved, bg: '#F0FFF4' },
  rejected: { color: C.error, bg: '#FFF5F5' },
  changes_requested: { color: '#C87612', bg: '#FFF3CD' },
};

const FILTER_TABS: { key: FilterStatus; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'submitted', label: 'Pending' },
  { key: 'resubmitted', label: 'Resubmitted' },
  { key: 'under_review', label: 'Reviewing' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
];

function StatCard({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <View style={[statStyles.card, { borderTopColor: color }]}>
      <Text style={[statStyles.count, { color }]}>{count}</Text>
      <Text style={statStyles.label}>{label}</Text>
    </View>
  );
}

const statStyles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderTopWidth: 3,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },
  count: { fontSize: 24, fontFamily: 'Poppins_700Bold' },
  label: { fontSize: 11, fontFamily: 'Poppins_400Regular', color: C.textMuted, textAlign: 'center' },
});

export default function AdminScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [sebayats, setSebayats] = useState<Sebayat[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterStatus>('submitted');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Sebayat | null>(null);
  const [actionModal, setActionModal] = useState<'approve' | 'reject' | 'changes' | null>(null);
  const [remarks, setRemarks] = useState('');
  const [regNo, setRegNo] = useState('');
  const [actioning, setActioning] = useState(false);

  useEffect(() => {
    fetchAll();
  }, []);

  async function fetchAll(isRefresh = false) {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    const { data } = await supabase
      .from('sebayats')
      .select('*')
      .order('submitted_at', { ascending: false });

    setSebayats(data || []);
    if (isRefresh) setRefreshing(false);
    else setLoading(false);
  }

  async function performAction(action: 'approve' | 'reject' | 'changes') {
    if (!selected) return;
    setActioning(true);

    const statusMap = {
      approve: 'approved',
      reject: 'rejected',
      changes: 'changes_requested',
    };
    const newStatus = statusMap[action];

    const updates: Partial<Sebayat> & { reviewed_by?: string } = {
      profile_status: newStatus,
      admin_remarks: remarks,
      reviewed_at: new Date().toISOString(),
      reviewed_by: user!.id,
    };
    if (action === 'approve' && regNo.trim()) {
      updates.registration_no = regNo.trim();
    }

    await supabase.from('sebayats').update(updates).eq('id', selected.id);

    await supabase.from('profile_review_history').insert({
      sebayat_id: selected.id,
      from_status: selected.profile_status,
      to_status: newStatus,
      remarks: remarks || '',
      changed_by: user!.id,
    });

    setActioning(false);
    setActionModal(null);
    setSelected(null);
    setRemarks('');
    setRegNo('');
    fetchAll();
  }

  const filtered = sebayats.filter((s) => {
    const matchStatus = filter === 'all' || s.profile_status === filter;
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      s.full_name?.toLowerCase().includes(q) ||
      s.phone?.includes(q) ||
      s.bansa_name?.toLowerCase().includes(q) ||
      s.seba_name?.toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  const counts = {
    total: sebayats.length,
    pending: sebayats.filter((s) => s.profile_status === 'submitted' || s.profile_status === 'resubmitted').length,
    approved: sebayats.filter((s) => s.profile_status === 'approved').length,
    rejected: sebayats.filter((s) => s.profile_status === 'rejected').length,
  };

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
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerSub}>Pratihari Nijog</Text>
          <Text style={styles.headerTitle}>Admin Panel</Text>
        </View>
        <TouchableOpacity
          style={styles.noticesBtn}
          onPress={() => router.push('/admin-notices')}
          activeOpacity={0.8}
        >
          <Megaphone color="#1A7A6A" size={16} />
          <Text style={styles.noticesBtnText}>Notices</Text>
        </TouchableOpacity>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <StatCard label="Total" count={counts.total} color={C.textMuted} />
        <StatCard label="Pending" count={counts.pending} color="#1D6FAE" />
        <StatCard label="Approved" count={counts.approved} color={C.approved} />
        <StatCard label="Rejected" count={counts.rejected} color={C.error} />
      </View>

      {/* Quick Actions */}
      <Text style={styles.quickActionsLabel}>Quick Actions</Text>
      <View style={styles.quickGrid}>
        <TouchableOpacity style={[styles.quickTile, { borderColor: '#1A7A6A30' }]} onPress={() => router.push('/admin-notices')} activeOpacity={0.85}>
          <View style={[styles.quickTileIcon, { backgroundColor: '#EAF7F5' }]}><Megaphone color="#1A7A6A" size={20} /></View>
          <Text style={[styles.quickTileTitle, { color: '#0E5C50' }]}>Notices</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.quickTile, { borderColor: '#1D6FAE30' }]} onPress={() => router.push('/admin-seba-history')} activeOpacity={0.85}>
          <View style={[styles.quickTileIcon, { backgroundColor: '#EBF5FB' }]}><History color="#1D6FAE" size={20} /></View>
          <Text style={[styles.quickTileTitle, { color: '#1D6FAE' }]}>Seba History</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.quickTile, { borderColor: '#C8780030' }]} onPress={() => router.push('/admin-event-images')} activeOpacity={0.85}>
          <View style={[styles.quickTileIcon, { backgroundColor: '#FFF3E0' }]}><ImageIcon color="#C87800" size={20} /></View>
          <Text style={[styles.quickTileTitle, { color: '#9A5A00' }]}>Event Images</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.quickTile, { borderColor: '#2B7A3020' }]} onPress={() => router.push('/admin-committee')} activeOpacity={0.85}>
          <View style={[styles.quickTileIcon, { backgroundColor: '#F0FDF4' }]}><UserCog color="#2B7A30" size={20} /></View>
          <Text style={[styles.quickTileTitle, { color: '#1E5C22' }]}>Committee</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.quickTile, { borderColor: '#E8732A30' }]} onPress={() => router.push('/admin-seba-categories')} activeOpacity={0.85}>
          <View style={[styles.quickTileIcon, { backgroundColor: '#FFF8F0' }]}><List color="#E8732A" size={20} /></View>
          <Text style={[styles.quickTileTitle, { color: '#C05A1A' }]}>Seba Categories</Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchRow}>
        <Search color={C.textMuted} size={16} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search name, phone, bansa..."
          placeholderTextColor={C.textMuted}
        />
        {search ? (
          <TouchableOpacity onPress={() => setSearch('')}>
            <X color={C.textMuted} size={16} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Filter tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterRow}
      >
        {FILTER_TABS.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.filterTab, filter === tab.key && styles.filterTabActive]}
            onPress={() => setFilter(tab.key)}
            activeOpacity={0.7}
          >
            <Text style={[styles.filterTabText, filter === tab.key && styles.filterTabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* List */}
      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => fetchAll(true)} tintColor={C.saffron} />
        }
      >
        {filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <Users color={C.textMuted} size={40} />
            <Text style={styles.emptyText}>No applications found</Text>
          </View>
        ) : (
          filtered.map((s) => {
            const sc = STATUS_COLORS[s.profile_status] || STATUS_COLORS.draft;
            return (
              <TouchableOpacity
                key={s.id}
                style={styles.card}
                onPress={() => setSelected(s)}
                activeOpacity={0.85}
              >
                <View style={styles.cardMain}>
                  <View style={styles.cardTop}>
                    <Text style={styles.cardName}>{s.full_name || 'Unnamed'}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
                      <Text style={[styles.statusBadgeText, { color: sc.color }]}>
                        {s.profile_status.replace('_', ' ')}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.cardPhone}>+{s.phone}</Text>
                  {s.seba_name ? (
                    <Text style={styles.cardSeba}>{s.seba_name} · {s.bansa_name}</Text>
                  ) : null}
                </View>
                <ChevronRight color={C.textMuted} size={18} />
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* Detail modal */}
      <Modal visible={!!selected} animationType="slide" presentationStyle="pageSheet">
        {selected && (
          <SafeAreaView style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{selected.full_name || 'Sebayat'}</Text>
              <TouchableOpacity onPress={() => setSelected(null)} style={styles.closeBtn}>
                <X color={C.textPrimary} size={22} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalContent}>
              {/* Status */}
              {(() => {
                const sc = STATUS_COLORS[selected.profile_status] || STATUS_COLORS.draft;
                return (
                  <View style={[styles.detailStatusCard, { backgroundColor: sc.bg, borderColor: sc.color + '40' }]}>
                    <Text style={[styles.detailStatusText, { color: sc.color }]}>
                      {selected.profile_status.replace(/_/g, ' ').toUpperCase()}
                    </Text>
                  </View>
                );
              })()}

              <DetailSection title="Personal Details">
                <DetailRow label="Phone" value={'+' + selected.phone} />
                <DetailRow label="Gender" value={selected.gender} />
                <DetailRow label="Date of Birth" value={selected.date_of_birth} />
                <DetailRow label="Marital Status" value={selected.marital_status} />
                {selected.spouse_name ? <DetailRow label="Spouse" value={selected.spouse_name} /> : null}
              </DetailSection>

              <DetailSection title="Family">
                <DetailRow label="Father" value={selected.father_name} />
                <DetailRow label="Mother" value={selected.mother_name} />
              </DetailSection>

              <DetailSection title="Address">
                <DetailRow label="Village / City" value={selected.address_village} />
                <DetailRow label="District" value={selected.address_district} />
                <DetailRow label="State" value={selected.address_state} />
              </DetailSection>

              <DetailSection title="Seba Details">
                <DetailRow label="Bansa" value={selected.bansa_name} />
                <DetailRow label="Palia" value={selected.palia_number} />
                <DetailRow label="Seba" value={selected.seba_name} />
                {selected.registration_no ? (
                  <DetailRow label="Reg. No." value={selected.registration_no} />
                ) : null}
              </DetailSection>

              {selected.admin_remarks ? (
                <DetailSection title="Previous Remarks">
                  <Text style={styles.remarksText}>{selected.admin_remarks}</Text>
                </DetailSection>
              ) : null}

              {/* Action buttons */}
              {(selected.profile_status === 'submitted' ||
                selected.profile_status === 'resubmitted' ||
                selected.profile_status === 'under_review') && (
                <View style={styles.actionButtons}>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.approveBtn]}
                    onPress={() => { setActionModal('approve'); setRemarks(''); setRegNo(''); }}
                    activeOpacity={0.8}
                  >
                    <CheckCircle color="#fff" size={18} />
                    <Text style={styles.actionBtnText}>Approve</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.changesBtn]}
                    onPress={() => { setActionModal('changes'); setRemarks(''); }}
                    activeOpacity={0.8}
                  >
                    <AlertCircle color="#fff" size={18} />
                    <Text style={styles.actionBtnText}>Request Changes</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.rejectBtn]}
                    onPress={() => { setActionModal('reject'); setRemarks(''); }}
                    activeOpacity={0.8}
                  >
                    <XCircle color="#fff" size={18} />
                    <Text style={styles.actionBtnText}>Reject</Text>
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
          </SafeAreaView>
        )}
      </Modal>

      {/* Action confirmation modal */}
      <Modal visible={!!actionModal} animationType="fade" transparent>
        <View style={styles.overlay}>
          <View style={styles.confirmBox}>
            <Text style={styles.confirmTitle}>
              {actionModal === 'approve'
                ? 'Approve Application'
                : actionModal === 'reject'
                ? 'Reject Application'
                : 'Request Changes'}
            </Text>
            <Text style={styles.confirmDesc}>
              {actionModal === 'approve'
                ? 'Optionally assign a registration number and add remarks.'
                : 'Please provide remarks to help the applicant understand the decision.'}
            </Text>

            {actionModal === 'approve' && (
              <TextInput
                style={styles.confirmInput}
                value={regNo}
                onChangeText={setRegNo}
                placeholder="Registration No. (optional)"
                placeholderTextColor={C.textMuted}
              />
            )}

            <TextInput
              style={[styles.confirmInput, styles.confirmTextArea]}
              value={remarks}
              onChangeText={setRemarks}
              placeholder={
                actionModal === 'approve'
                  ? 'Remarks (optional)'
                  : actionModal === 'reject'
                  ? 'Reason for rejection (required)'
                  : 'Describe what needs to be changed (required)'
              }
              placeholderTextColor={C.textMuted}
              multiline
              numberOfLines={4}
            />

            <View style={styles.confirmActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setActionModal(null)}
                disabled={actioning}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.confirmActionBtn,
                  actionModal === 'approve' && styles.approveBtn,
                  actionModal === 'reject' && styles.rejectBtn,
                  actionModal === 'changes' && styles.changesBtn,
                ]}
                onPress={() => actionModal && performAction(actionModal)}
                disabled={actioning}
              >
                {actioning ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.actionBtnText}>Confirm</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={detailStyles.section}>
      <Text style={detailStyles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <View style={detailStyles.row}>
      <Text style={detailStyles.label}>{label}</Text>
      <Text style={detailStyles.value}>{value}</Text>
    </View>
  );
}

const detailStyles = StyleSheet.create({
  section: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    padding: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 13,
    fontFamily: 'Poppins_700Bold',
    color: C.textPrimary,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  label: { fontSize: 13, fontFamily: 'Poppins_400Regular', color: C.textMuted, flex: 1 },
  value: { fontSize: 13, fontFamily: 'Poppins_500Medium', color: C.textPrimary, flex: 2, textAlign: 'right' },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.warmWhite },
  loadingCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  headerLeft: {
    flex: 1,
  },
  noticesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EBF7F4',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#1A7A6A30',
  },
  noticesBtnText: {
    fontSize: 13,
    fontFamily: 'Poppins_600SemiBold',
    color: '#1A7A6A',
  },
  noticesQuickAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: '#EBF7F4',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1A7A6A30',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  noticesQuickLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  noticesQuickIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#C3ECE5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  noticesQuickTitle: {
    fontSize: 14,
    fontFamily: 'Poppins_600SemiBold',
    color: '#145E52',
  },
  noticesQuickSub: {
    fontSize: 12,
    fontFamily: 'Poppins_400Regular',
    color: '#1A7A6A99',
  },
  quickActionsLabel: {
    fontSize: 11,
    fontFamily: 'Poppins_600SemiBold',
    color: C.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    marginHorizontal: 16,
    marginBottom: 8,
    marginTop: 4,
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: 12,
    gap: 8,
    marginBottom: 12,
  },
  quickTile: {
    width: '31%',
    flexGrow: 1,
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    alignItems: 'center',
    gap: 8,
  },
  quickTileIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickTileTitle: {
    fontSize: 11,
    fontFamily: 'Poppins_600SemiBold',
    textAlign: 'center',
    lineHeight: 15,
  },
  headerSub: {
    fontSize: 12,
    fontFamily: 'Poppins_400Regular',
    color: C.gold,
    fontStyle: 'italic',
  },
  headerTitle: {
    fontSize: 22,
    fontFamily: 'Poppins_700Bold',
    color: C.textPrimary,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: C.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Poppins_400Regular',
    color: C.textPrimary,
  },
  filterScroll: { maxHeight: 48 },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    alignItems: 'center',
    paddingBottom: 8,
  },
  filterTab: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: C.border,
    backgroundColor: '#fff',
  },
  filterTabActive: { borderColor: C.saffron, backgroundColor: C.cream },
  filterTabText: { fontSize: 13, fontFamily: 'Poppins_500Medium', color: C.textMuted },
  filterTabTextActive: { color: C.saffron, fontFamily: 'Poppins_600SemiBold' },
  list: { flex: 1 },
  listContent: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24 },
  emptyState: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 15, fontFamily: 'Poppins_400Regular', color: C.textMuted },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    padding: 16,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cardMain: { flex: 1 },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
    gap: 8,
  },
  cardName: {
    fontSize: 15,
    fontFamily: 'Poppins_600SemiBold',
    color: C.textPrimary,
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  statusBadgeText: { fontSize: 11, fontFamily: 'Poppins_600SemiBold', textTransform: 'capitalize' },
  cardPhone: { fontSize: 12, fontFamily: 'Poppins_400Regular', color: C.textMuted },
  cardSeba: { fontSize: 12, fontFamily: 'Poppins_400Regular', color: C.textSecondary, marginTop: 2 },
  modal: { flex: 1, backgroundColor: C.warmWhite },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  modalTitle: { fontSize: 20, fontFamily: 'Poppins_700Bold', color: C.textPrimary, flex: 1 },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: C.cream,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalScroll: { flex: 1 },
  modalContent: { padding: 20, paddingBottom: 40 },
  detailStatusCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  detailStatusText: {
    fontSize: 14,
    fontFamily: 'Poppins_700Bold',
    letterSpacing: 0.5,
  },
  remarksText: { fontSize: 13, fontFamily: 'Poppins_400Regular', color: C.textPrimary, lineHeight: 20 },
  actionButtons: { gap: 10, marginTop: 8 },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
  },
  approveBtn: { backgroundColor: C.approved },
  rejectBtn: { backgroundColor: C.error },
  changesBtn: { backgroundColor: '#C87612' },
  actionBtnText: { fontSize: 15, fontFamily: 'Poppins_600SemiBold', color: '#fff' },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  confirmBox: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  confirmTitle: { fontSize: 18, fontFamily: 'Poppins_700Bold', color: C.textPrimary, marginBottom: 8 },
  confirmDesc: {
    fontSize: 13,
    fontFamily: 'Poppins_400Regular',
    color: C.textSecondary,
    lineHeight: 20,
    marginBottom: 16,
  },
  confirmInput: {
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: 'Poppins_400Regular',
    color: C.textPrimary,
    marginBottom: 12,
  },
  confirmTextArea: { height: 100, textAlignVertical: 'top', paddingTop: 10 },
  confirmActions: { flexDirection: 'row', gap: 10 },
  cancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: { fontSize: 15, fontFamily: 'Poppins_500Medium', color: C.textSecondary },
  confirmActionBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
