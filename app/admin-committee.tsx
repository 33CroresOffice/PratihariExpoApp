import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import {
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  X,
  Users,
  ChevronDown,
  ChevronUp,
  Check,
  Search,
  User,
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
  success: '#27AE60',
  green: '#2B7A30',
};

const ROLES = [
  'President', 'Vice President', 'Secretary', 'Joint Secretary',
  'Treasurer', 'Joint Treasurer', 'Advisor', 'Member',
];

interface CommitteeMember {
  id: string;
  committee_id: string;
  sebayat_id: string | null;
  name: string;
  name_or: string;
  role: string;
  role_or: string;
  role_order: number;
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

interface SebayatOption {
  id: string;
  full_name: string;
  first_name: string;
  last_name: string;
  phone: string;
  primary_phone: string;
}

function getName(s: SebayatOption) {
  return s.full_name || [s.first_name, s.last_name].filter(Boolean).join(' ') || '—';
}

export default function AdminCommittee() {
  const { user } = useAuth();
  const router = useRouter();

  const [committees, setCommittees] = useState<Committee[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Committee form modal
  const [committeeModal, setCommitteeModal] = useState(false);
  const [editingCommittee, setEditingCommittee] = useState<Committee | null>(null);
  const [committeeForm, setCommitteeForm] = useState({ year: '', title: '', title_or: '', description: '', description_or: '', is_active: false });
  const [savingCommittee, setSavingCommittee] = useState(false);

  // Member form modal
  const [memberModal, setMemberModal] = useState(false);
  const [editingMember, setEditingMember] = useState<CommitteeMember | null>(null);
  const [targetCommitteeId, setTargetCommitteeId] = useState<string | null>(null);
  const [memberForm, setMemberForm] = useState({
    name: '', name_or: '', role: '', role_or: '', role_order: '', phone: '', bio: '', bio_or: '', sebayat_id: '',
  });
  const [savingMember, setSavingMember] = useState(false);
  const [deletingMember, setDeletingMember] = useState<string | null>(null);
  const [memberError, setMemberError] = useState<string | null>(null);
  const [togglingActive, setTogglingActive] = useState<string | null>(null);

  // Sebayat search
  const [sebayats, setSebayats] = useState<SebayatOption[]>([]);
  const [sebayatSearch, setSebayatSearch] = useState('');
  const [showSebayatDropdown, setShowSebayatDropdown] = useState(false);
  const [selectedSebayat, setSelectedSebayat] = useState<SebayatOption | null>(null);

  // Role picker
  const [showRolePicker, setShowRolePicker] = useState(false);

  useEffect(() => { fetchCommittees(); }, []);

  useEffect(() => {
    supabase
      .from('sebayats')
      .select('id, full_name, first_name, last_name, phone, primary_phone')
      .eq('profile_status', 'approved')
      .order('full_name', { nullsLast: true })
      .order('first_name', { nullsLast: true })
      .then(({ data }) => setSebayats(data || []));
  }, []);

  async function fetchCommittees(isRefresh = false) {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    const { data } = await supabase
      .from('committees')
      .select('id, year, title, title_or, description, description_or, is_active, committee_members(id, committee_id, sebayat_id, name, name_or, role, role_or, role_order, phone, bio, description_or)')
      .order('year', { ascending: false });
    const sorted = (data as Committee[] ?? []).map((c) => ({
      ...c,
      committee_members: (c.committee_members || []).sort((a, b) => a.role_order - b.role_order),
    }));
    setCommittees(sorted);
    if (isRefresh) setRefreshing(false); else setLoading(false);
    const active = sorted.find((c) => c.is_active);
    if (active && !expandedId) setExpandedId(active.id);
  }

  // ── Committee CRUD ──────────────────────────────────────────

  function openAddCommittee() {
    setEditingCommittee(null);
    setCommitteeForm({ year: String(new Date().getFullYear()), title: '', title_or: '', description: '', description_or: '', is_active: false });
    setCommitteeModal(true);
  }

  function openEditCommittee(c: Committee) {
    setEditingCommittee(c);
    setCommitteeForm({ year: String(c.year), title: c.title, title_or: c.title_or || '', description: c.description || '', description_or: c.description_or || '', is_active: c.is_active });
    setCommitteeModal(true);
  }

  async function saveCommittee() {
    if (!committeeForm.title.trim() || !committeeForm.year) return;
    setSavingCommittee(true);
    if (editingCommittee) {
      await supabase.from('committees').update({
        year: Number(committeeForm.year),
        title: committeeForm.title.trim(),
        title_or: committeeForm.title_or.trim() || null,
        description: committeeForm.description.trim() || null,
        description_or: committeeForm.description_or.trim() || null,
        is_active: committeeForm.is_active,
      }).eq('id', editingCommittee.id);
    } else {
      await supabase.from('committees').insert({
        year: Number(committeeForm.year),
        title: committeeForm.title.trim(),
        title_or: committeeForm.title_or.trim() || null,
        description: committeeForm.description.trim() || null,
        description_or: committeeForm.description_or.trim() || null,
        is_active: committeeForm.is_active,
        created_by: user!.id,
      });
    }
    setSavingCommittee(false);
    setCommitteeModal(false);
    fetchCommittees();
  }

  async function deleteCommittee(id: string) {
    await supabase.from('committee_members').delete().eq('committee_id', id);
    await supabase.from('committees').delete().eq('id', id);
    setCommittees((prev) => prev.filter((c) => c.id !== id));
  }

  // ── Member CRUD ──────────────────────────────────────────────

  function openAddMember(committeeId: string) {
    const committee = committees.find((c) => c.id === committeeId);
    const nextOrder = committee ? (committee.committee_members.length + 1) : 1;
    setEditingMember(null);
    setTargetCommitteeId(committeeId);
    setMemberForm({ name: '', name_or: '', role: 'Member', role_or: '', role_order: String(nextOrder), phone: '', bio: '', bio_or: '', sebayat_id: '' });
    setSelectedSebayat(null);
    setSebayatSearch('');
    setShowSebayatDropdown(false);
    setMemberError(null);
    setMemberModal(true);
  }

  function openEditMember(m: CommitteeMember) {
    setEditingMember(m);
    setTargetCommitteeId(m.committee_id);
    setMemberForm({
      name: m.name, name_or: m.name_or || '',
      role: m.role, role_or: m.role_or || '',
      role_order: String(m.role_order),
      phone: m.phone || '',
      bio: m.bio || '',
      bio_or: m.description_or || '',
      sebayat_id: m.sebayat_id || '',
    });
    const linked = m.sebayat_id ? sebayats.find((s) => s.id === m.sebayat_id) ?? null : null;
    setSelectedSebayat(linked);
    setSebayatSearch(linked ? getName(linked) : '');
    setShowSebayatDropdown(false);
    setMemberError(null);
    setMemberModal(true);
  }

  async function saveMember() {
    if (!memberForm.name.trim() || !memberForm.role || !targetCommitteeId) return;
    setMemberError(null);

    // Duplicate check: same sebayat + same role in the same committee
    if (memberForm.sebayat_id) {
      const committee = committees.find((c) => c.id === targetCommitteeId);
      const conflict = committee?.committee_members.find(
        (m) => m.sebayat_id === memberForm.sebayat_id &&
               m.role === memberForm.role &&
               m.id !== editingMember?.id
      );
      if (conflict) {
        setMemberError(`${memberForm.name.trim()} is already added as ${memberForm.role} in this committee.`);
        return;
      }
    }

    setSavingMember(true);
    const payload = {
      committee_id: targetCommitteeId,
      sebayat_id: memberForm.sebayat_id || null,
      name: memberForm.name.trim(),
      name_or: memberForm.name_or.trim() || null,
      role: memberForm.role,
      role_or: memberForm.role_or.trim() || null,
      role_order: Number(memberForm.role_order) || 99,
      phone: memberForm.phone.trim() || null,
      bio: memberForm.bio.trim() || null,
      description_or: memberForm.bio_or.trim() || null,
    };
    if (editingMember) {
      await supabase.from('committee_members').update(payload).eq('id', editingMember.id);
    } else {
      await supabase.from('committee_members').insert(payload);
    }
    setSavingMember(false);
    setMemberModal(false);
    fetchCommittees();
  }

  async function toggleCommitteeActive(committee: Committee) {
    setTogglingActive(committee.id);
    await supabase.from('committees').update({ is_active: !committee.is_active }).eq('id', committee.id);
    setCommittees((prev) => prev.map((c) => c.id === committee.id ? { ...c, is_active: !c.is_active } : c));
    setTogglingActive(null);
  }

  async function deleteMember(id: string, committeeId: string) {
    setDeletingMember(id);
    await supabase.from('committee_members').delete().eq('id', id);
    setCommittees((prev) => prev.map((c) =>
      c.id === committeeId
        ? { ...c, committee_members: c.committee_members.filter((m) => m.id !== id) }
        : c
    ));
    setDeletingMember(null);
  }

  function selectSebayat(s: SebayatOption) {
    setSelectedSebayat(s);
    setSebayatSearch(getName(s));
    setShowSebayatDropdown(false);
    const phone = s.phone || s.primary_phone || '';
    setMemberForm((prev) => ({
      ...prev,
      sebayat_id: s.id,
      name: getName(s),
      phone,
    }));
  }

  const filteredSebayats = sebayatSearch.length >= 2
    ? sebayats.filter((s) => {
        const q = sebayatSearch.toLowerCase();
        return getName(s).toLowerCase().includes(q) || (s.phone || '').includes(q) || (s.primary_phone || '').includes(q);
      }).slice(0, 12)
    : [];

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <ArrowLeft color={C.textPrimary} size={22} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerSub}>Admin</Text>
          <Text style={styles.headerTitle}>Committee Management</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={openAddCommittee} activeOpacity={0.8}>
          <Plus color="#fff" size={20} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={C.saffron} size="large" /></View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchCommittees(true)} tintColor={C.saffron} />}
        >
          {committees.length === 0 ? (
            <View style={styles.emptyState}>
              <Users color={C.textMuted} size={48} />
              <Text style={styles.emptyTitle}>No committees yet</Text>
              <Text style={styles.emptyDesc}>Tap + to create the first committee term</Text>
            </View>
          ) : committees.map((committee) => {
            const isExpanded = expandedId === committee.id;
            return (
              <View key={committee.id} style={[styles.card, committee.is_active && styles.cardActive]}>
                {/* Committee header */}
                <View style={styles.cardHeader}>
                  <TouchableOpacity
                    style={styles.cardHeaderLeft}
                    onPress={() => setExpandedId(isExpanded ? null : committee.id)}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.yearBadge, committee.is_active && styles.yearBadgeActive]}>
                      <Text style={[styles.yearText, committee.is_active && styles.yearTextActive]}>{committee.year}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={styles.titleRow}>
                        <Text style={styles.cardTitle} numberOfLines={1}>{committee.title}</Text>
                        {committee.is_active && (
                          <View style={styles.activePill}>
                            <Text style={styles.activePillText}>Active</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.memberCount}>{committee.committee_members.length} member{committee.committee_members.length !== 1 ? 's' : ''}</Text>
                    </View>
                  </TouchableOpacity>
                  <View style={styles.cardActions}>
                    <TouchableOpacity
                      style={[styles.activeToggleBtn, committee.is_active && styles.activeToggleBtnActive]}
                      onPress={() => toggleCommitteeActive(committee)}
                      activeOpacity={0.8}
                      disabled={togglingActive === committee.id}
                    >
                      {togglingActive === committee.id
                        ? <ActivityIndicator size="small" color={committee.is_active ? C.green : C.textMuted} />
                        : <Text style={[styles.activeToggleBtnText, committee.is_active && styles.activeToggleBtnTextActive]}>
                            {committee.is_active ? 'Deactivate' : 'Activate'}
                          </Text>
                      }
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.iconBtn} onPress={() => openEditCommittee(committee)} activeOpacity={0.7}>
                      <Pencil color={C.saffron} size={16} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.iconBtn} onPress={() => deleteCommittee(committee.id)} activeOpacity={0.7}>
                      <Trash2 color={C.error} size={16} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setExpandedId(isExpanded ? null : committee.id)} activeOpacity={0.7} style={styles.iconBtn}>
                      {isExpanded ? <ChevronUp color={C.textMuted} size={18} /> : <ChevronDown color={C.textMuted} size={18} />}
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Members */}
                {isExpanded && (
                  <View style={styles.membersSection}>
                    <View style={styles.membersSectionHeader}>
                      <Text style={styles.membersSectionTitle}>Members</Text>
                      <TouchableOpacity
                        style={styles.addMemberBtn}
                        onPress={() => openAddMember(committee.id)}
                        activeOpacity={0.8}
                      >
                        <Plus color="#fff" size={14} />
                        <Text style={styles.addMemberBtnText}>Add Member</Text>
                      </TouchableOpacity>
                    </View>
                    {committee.committee_members.length === 0 ? (
                      <Text style={styles.noMembersText}>No members added yet.</Text>
                    ) : (
                      committee.committee_members.map((m, idx) => (
                        <View key={m.id} style={[styles.memberRow, idx < committee.committee_members.length - 1 && styles.memberRowBorder]}>
                          <View style={styles.memberAvatar}>
                            <Text style={styles.memberAvatarText}>
                              {m.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
                            </Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.memberName}>{m.name}</Text>
                            <Text style={styles.memberRole}>{m.role}</Text>
                            {!!m.phone && <Text style={styles.memberPhone}>{m.phone}</Text>}
                          </View>
                          <View style={styles.memberActions}>
                            <TouchableOpacity style={styles.iconBtn} onPress={() => openEditMember(m)} activeOpacity={0.7}>
                              <Pencil color={C.saffron} size={15} />
                            </TouchableOpacity>
                            {deletingMember === m.id ? (
                              <ActivityIndicator size="small" color={C.error} style={styles.iconBtn} />
                            ) : (
                              <TouchableOpacity style={styles.iconBtn} onPress={() => deleteMember(m.id, committee.id)} activeOpacity={0.7}>
                                <Trash2 color={C.error} size={15} />
                              </TouchableOpacity>
                            )}
                          </View>
                        </View>
                      ))
                    )}
                  </View>
                )}
              </View>
            );
          })}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {/* ── Committee Modal ── */}
      <Modal visible={committeeModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{editingCommittee ? 'Edit Committee' : 'New Committee'}</Text>
            <TouchableOpacity onPress={() => setCommitteeModal(false)} style={styles.closeBtn}>
              <X color={C.textPrimary} size={22} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalContent}>
            <Text style={styles.fieldLabel}>Year *</Text>
            <TextInput
              style={styles.input}
              value={committeeForm.year}
              onChangeText={(v) => setCommitteeForm((f) => ({ ...f, year: v.replace(/\D/g, '') }))}
              placeholder="e.g. 2026"
              placeholderTextColor={C.textMuted}
              keyboardType="number-pad"
              maxLength={4}
            />
            <Text style={styles.fieldLabel}>Title *</Text>
            <TextInput
              style={styles.input}
              value={committeeForm.title}
              onChangeText={(v) => setCommitteeForm((f) => ({ ...f, title: v }))}
              placeholder="e.g. Executive Committee 2026"
              placeholderTextColor={C.textMuted}
            />
            <Text style={styles.fieldLabel}>Title (ଓଡ଼ିଆ)</Text>
            <TextInput
              style={styles.input}
              value={committeeForm.title_or}
              onChangeText={(v) => setCommitteeForm((f) => ({ ...f, title_or: v }))}
              placeholder="ଯଥା: କାର୍ଯ୍ୟ ସମିତି ୨୦୨୬"
              placeholderTextColor={C.textMuted}
            />
            <Text style={styles.fieldLabel}>Description</Text>
            <TextInput
              style={[styles.input, styles.inputMulti]}
              value={committeeForm.description}
              onChangeText={(v) => setCommitteeForm((f) => ({ ...f, description: v }))}
              placeholder="Optional description…"
              placeholderTextColor={C.textMuted}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
            <Text style={styles.fieldLabel}>Description (ଓଡ଼ିଆ)</Text>
            <TextInput
              style={[styles.input, styles.inputMulti]}
              value={committeeForm.description_or}
              onChangeText={(v) => setCommitteeForm((f) => ({ ...f, description_or: v }))}
              placeholder="ଐଚ୍ଛିକ ବର୍ଣ୍ଣନା…"
              placeholderTextColor={C.textMuted}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
            <TouchableOpacity
              style={styles.toggleRow}
              onPress={() => setCommitteeForm((f) => ({ ...f, is_active: !f.is_active }))}
              activeOpacity={0.8}
            >
              <View>
                <Text style={styles.toggleLabel}>Mark as Active Committee</Text>
                <Text style={styles.toggleSub}>Only one committee should be active at a time</Text>
              </View>
              <View style={[styles.checkbox, committeeForm.is_active && styles.checkboxOn]}>
                {committeeForm.is_active && <Check color="#fff" size={13} strokeWidth={3} />}
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveBtn, (!committeeForm.title.trim() || !committeeForm.year || savingCommittee) && styles.saveBtnDisabled]}
              onPress={saveCommittee}
              disabled={!committeeForm.title.trim() || !committeeForm.year || savingCommittee}
              activeOpacity={0.85}
            >
              {savingCommittee
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.saveBtnText}>{editingCommittee ? 'Save Changes' : 'Create Committee'}</Text>
              }
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* ── Member Modal ── */}
      <Modal visible={memberModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{editingMember ? 'Edit Member' : 'Add Member'}</Text>
            <TouchableOpacity onPress={() => setMemberModal(false)} style={styles.closeBtn}>
              <X color={C.textPrimary} size={22} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">

            {/* Sebayat search */}
            <Text style={styles.fieldLabel}>Link to Sebayat (approved)</Text>
            <View style={styles.searchInputRow}>
              <Search color={C.textMuted} size={15} />
              <TextInput
                style={styles.searchInput}
                value={sebayatSearch}
                onChangeText={(v) => {
                  setSebayatSearch(v);
                  setShowSebayatDropdown(v.length >= 2);
                  if (!v) {
                    setSelectedSebayat(null);
                    setMemberForm((f) => ({ ...f, sebayat_id: '' }));
                  }
                }}
                placeholder="Search by name or phone…"
                placeholderTextColor={C.textMuted}
              />
              {selectedSebayat && (
                <TouchableOpacity onPress={() => {
                  setSelectedSebayat(null);
                  setSebayatSearch('');
                  setMemberForm((f) => ({ ...f, sebayat_id: '', name: '', phone: '' }));
                }}>
                  <X color={C.textMuted} size={15} />
                </TouchableOpacity>
              )}
            </View>
            {selectedSebayat && (
              <View style={styles.selectedBadge}>
                <User color={C.green} size={13} />
                <Text style={styles.selectedBadgeText}>{getName(selectedSebayat)} — auto-filled</Text>
              </View>
            )}
            {showSebayatDropdown && filteredSebayats.length > 0 && (
              <View style={styles.dropdown}>
                {filteredSebayats.map((s) => (
                  <TouchableOpacity
                    key={s.id}
                    style={styles.dropdownItem}
                    onPress={() => selectSebayat(s)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.dropdownAvatar}>
                      <Text style={styles.dropdownAvatarText}>
                        {getName(s).split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
                      </Text>
                    </View>
                    <View>
                      <Text style={styles.dropdownName}>{getName(s)}</Text>
                      {(s.phone || s.primary_phone) && (
                        <Text style={styles.dropdownPhone}>{s.phone || s.primary_phone}</Text>
                      )}
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <Text style={styles.fieldLabel}>Name *</Text>
            <TextInput
              style={styles.input}
              value={memberForm.name}
              onChangeText={(v) => setMemberForm((f) => ({ ...f, name: v }))}
              placeholder="Full name"
              placeholderTextColor={C.textMuted}
            />
            <Text style={styles.fieldLabel}>Name (ଓଡ଼ିଆ)</Text>
            <TextInput
              style={styles.input}
              value={memberForm.name_or}
              onChangeText={(v) => setMemberForm((f) => ({ ...f, name_or: v }))}
              placeholder="ପୂର୍ଣ ନାମ"
              placeholderTextColor={C.textMuted}
            />

            <Text style={styles.fieldLabel}>Role *</Text>
            <TouchableOpacity
              style={styles.rolePickerBtn}
              onPress={() => setShowRolePicker(true)}
              activeOpacity={0.8}
            >
              <Text style={memberForm.role ? styles.rolePickerValue : styles.rolePickerPlaceholder}>
                {memberForm.role || 'Select role…'}
              </Text>
              <ChevronDown color={C.textMuted} size={16} />
            </TouchableOpacity>

            <Text style={styles.fieldLabel}>Role (ଓଡ଼ିଆ)</Text>
            <TextInput
              style={styles.input}
              value={memberForm.role_or}
              onChangeText={(v) => setMemberForm((f) => ({ ...f, role_or: v }))}
              placeholder="ଯଥା: ସଭାପତି"
              placeholderTextColor={C.textMuted}
            />

            <Text style={styles.fieldLabel}>Role Order</Text>
            <TextInput
              style={styles.input}
              value={memberForm.role_order}
              onChangeText={(v) => setMemberForm((f) => ({ ...f, role_order: v.replace(/\D/g, '') }))}
              placeholder="Display order (1 = top)"
              placeholderTextColor={C.textMuted}
              keyboardType="number-pad"
            />

            <Text style={styles.fieldLabel}>Phone</Text>
            <TextInput
              style={styles.input}
              value={memberForm.phone}
              onChangeText={(v) => setMemberForm((f) => ({ ...f, phone: v }))}
              placeholder="Contact number"
              placeholderTextColor={C.textMuted}
              keyboardType="phone-pad"
            />

            <Text style={styles.fieldLabel}>Bio</Text>
            <TextInput
              style={[styles.input, styles.inputMulti]}
              value={memberForm.bio}
              onChangeText={(v) => setMemberForm((f) => ({ ...f, bio: v }))}
              placeholder="Short bio (optional)"
              placeholderTextColor={C.textMuted}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
            <Text style={styles.fieldLabel}>Bio (ଓଡ଼ିଆ)</Text>
            <TextInput
              style={[styles.input, styles.inputMulti]}
              value={memberForm.bio_or}
              onChangeText={(v) => setMemberForm((f) => ({ ...f, bio_or: v }))}
              placeholder="ସଂକ୍ଷିପ୍ତ ପରିଚୟ (ଐଚ୍ଛିକ)"
              placeholderTextColor={C.textMuted}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />

            {memberError && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{memberError}</Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.saveBtn, (!memberForm.name.trim() || !memberForm.role || savingMember) && styles.saveBtnDisabled]}
              onPress={saveMember}
              disabled={!memberForm.name.trim() || !memberForm.role || savingMember}
              activeOpacity={0.85}
            >
              {savingMember
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.saveBtnText}>{editingMember ? 'Save Changes' : 'Add Member'}</Text>
              }
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Role picker sheet */}
      <Modal visible={showRolePicker} animationType="slide" transparent>
        <TouchableOpacity style={styles.sheetOverlay} activeOpacity={1} onPress={() => setShowRolePicker(false)}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Select Role</Text>
            <ScrollView>
              {ROLES.map((r) => (
                <TouchableOpacity
                  key={r}
                  style={styles.sheetItem}
                  onPress={() => { setMemberForm((f) => ({ ...f, role: r })); setShowRolePicker(false); }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.sheetItemText, memberForm.role === r && styles.sheetItemTextActive]}>{r}</Text>
                  {memberForm.role === r && <Check color={C.saffron} size={16} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFDF9' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: C.border, gap: 12,
  },
  backBtn: { width: 38, height: 38, borderRadius: 10, backgroundColor: C.cream, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1 },
  headerSub: { fontSize: 11, fontFamily: 'Poppins_400Regular', color: C.gold, fontStyle: 'italic' },
  headerTitle: { fontSize: 18, fontFamily: 'Poppins_700Bold', color: C.textPrimary },
  addBtn: { width: 38, height: 38, borderRadius: 10, backgroundColor: C.saffron, alignItems: 'center', justifyContent: 'center' },

  listContent: { padding: 16 },
  emptyState: { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyTitle: { fontSize: 17, fontFamily: 'Poppins_600SemiBold', color: C.textSecondary },
  emptyDesc: { fontSize: 13, fontFamily: 'Poppins_400Regular', color: C.textMuted, textAlign: 'center' },

  card: {
    backgroundColor: '#fff', borderRadius: 16,
    borderWidth: 1, borderColor: C.border, marginBottom: 14, overflow: 'hidden',
  },
  cardActive: { borderColor: C.green + '60' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 10 },
  cardHeaderLeft: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  yearBadge: {
    width: 50, height: 50, borderRadius: 10, backgroundColor: '#F3F4F6',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  yearBadgeActive: { backgroundColor: '#F0FDF4' },
  yearText: { fontSize: 13, fontFamily: 'Poppins_700Bold', color: C.textMuted },
  yearTextActive: { color: C.green },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 2 },
  cardTitle: { fontSize: 14, fontFamily: 'Poppins_700Bold', color: C.textPrimary, flex: 1 },
  activePill: {
    backgroundColor: '#D1FAE5', borderRadius: 20,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  activePillText: { fontSize: 10, fontFamily: 'Poppins_600SemiBold', color: C.green },
  memberCount: { fontSize: 12, fontFamily: 'Poppins_400Regular', color: C.textMuted },
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  iconBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },

  membersSection: { borderTopWidth: 1, borderTopColor: C.border },
  membersSectionHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 10,
  },
  membersSectionTitle: { fontSize: 12, fontFamily: 'Poppins_600SemiBold', color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  addMemberBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: C.saffron, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 6,
  },
  addMemberBtnText: { fontSize: 12, fontFamily: 'Poppins_600SemiBold', color: '#fff' },
  noMembersText: { fontSize: 13, fontFamily: 'Poppins_400Regular', color: C.textMuted, textAlign: 'center', paddingVertical: 16 },
  memberRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, gap: 12 },
  memberRowBorder: { borderBottomWidth: 1, borderBottomColor: C.border },
  memberAvatar: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: '#FFF3E0',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  memberAvatarText: { fontSize: 13, fontFamily: 'Poppins_700Bold', color: C.saffron },
  memberName: { fontSize: 13, fontFamily: 'Poppins_600SemiBold', color: C.textPrimary },
  memberRole: { fontSize: 11, fontFamily: 'Poppins_400Regular', color: C.textMuted },
  memberPhone: { fontSize: 11, fontFamily: 'Poppins_400Regular', color: C.textMuted },
  memberActions: { flexDirection: 'row', alignItems: 'center' },

  // Modal
  modal: { flex: 1, backgroundColor: '#FFFDF9' },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  modalTitle: { fontSize: 20, fontFamily: 'Poppins_700Bold', color: C.textPrimary },
  closeBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: C.cream, alignItems: 'center', justifyContent: 'center' },
  modalContent: { padding: 20, paddingBottom: 48 },

  fieldLabel: { fontSize: 13, fontFamily: 'Poppins_600SemiBold', color: C.textSecondary, marginBottom: 6, marginTop: 4 },
  input: {
    borderWidth: 1.5, borderColor: C.border, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 11,
    fontSize: 14, fontFamily: 'Poppins_400Regular', color: C.textPrimary,
    backgroundColor: '#fff', marginBottom: 16,
  },
  inputMulti: { height: 88, paddingTop: 11 },

  toggleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: C.cream, borderRadius: 12, borderWidth: 1, borderColor: C.border,
    padding: 14, marginBottom: 20,
  },
  toggleLabel: { fontSize: 14, fontFamily: 'Poppins_600SemiBold', color: C.textPrimary },
  toggleSub: { fontSize: 11, fontFamily: 'Poppins_400Regular', color: C.textMuted, marginTop: 2 },
  checkbox: {
    width: 22, height: 22, borderRadius: 6,
    borderWidth: 2, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: C.saffron, borderColor: C.saffron },

  // Sebayat search
  searchInputRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1.5, borderColor: C.border, borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 4,
    backgroundColor: '#fff', marginBottom: 8,
  },
  searchInput: {
    flex: 1, fontSize: 14, fontFamily: 'Poppins_400Regular',
    color: C.textPrimary, paddingVertical: 9,
  },
  selectedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#F0FDF4', borderRadius: 8, borderWidth: 1,
    borderColor: C.green + '40', paddingHorizontal: 10, paddingVertical: 6,
    marginBottom: 12,
  },
  selectedBadgeText: { fontSize: 12, fontFamily: 'Poppins_600SemiBold', color: C.green },
  dropdown: {
    borderWidth: 1.5, borderColor: C.border, borderRadius: 12,
    backgroundColor: '#fff', marginBottom: 12, overflow: 'hidden',
    maxHeight: 220,
  },
  dropdownItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 11,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  dropdownAvatar: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: '#FFF3E0',
    alignItems: 'center', justifyContent: 'center',
  },
  dropdownAvatarText: { fontSize: 11, fontFamily: 'Poppins_700Bold', color: C.saffron },
  dropdownName: { fontSize: 13, fontFamily: 'Poppins_600SemiBold', color: C.textPrimary },
  dropdownPhone: { fontSize: 11, fontFamily: 'Poppins_400Regular', color: C.textMuted },

  // Role picker
  rolePickerBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1.5, borderColor: C.border, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 13,
    backgroundColor: '#fff', marginBottom: 16,
  },
  rolePickerValue: { fontSize: 14, fontFamily: 'Poppins_400Regular', color: C.textPrimary },
  rolePickerPlaceholder: { fontSize: 14, fontFamily: 'Poppins_400Regular', color: C.textMuted },

  activeToggleBtn: {
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, minWidth: 78,
    backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB',
    alignItems: 'center', justifyContent: 'center',
  },
  activeToggleBtnActive: {
    backgroundColor: '#FEF2F2', borderColor: C.error + '50',
  },
  activeToggleBtnText: { fontSize: 11, fontFamily: 'Poppins_600SemiBold', color: C.textMuted },
  activeToggleBtnTextActive: { color: C.error },

  errorBox: {
    backgroundColor: '#FEF2F2', borderRadius: 10, borderWidth: 1,
    borderColor: C.error + '40', padding: 12, marginBottom: 12,
  },
  errorText: { fontSize: 13, fontFamily: 'Poppins_500Medium', color: C.error, lineHeight: 19 },

  saveBtn: {
    backgroundColor: C.saffron, borderRadius: 14,
    paddingVertical: 15, alignItems: 'center', justifyContent: 'center', marginTop: 8,
  },
  saveBtnDisabled: { opacity: 0.45 },
  saveBtnText: { fontSize: 16, fontFamily: 'Poppins_600SemiBold', color: '#fff' },

  // Role sheet
  sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingBottom: 40, maxHeight: '70%',
  },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#E5E7EB', alignSelf: 'center', marginTop: 12, marginBottom: 4 },
  sheetTitle: { fontSize: 16, fontFamily: 'Poppins_700Bold', color: C.textPrimary, textAlign: 'center', paddingVertical: 12 },
  sheetItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 24, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  sheetItemText: { fontSize: 15, fontFamily: 'Poppins_400Regular', color: C.textPrimary },
  sheetItemTextActive: { fontFamily: 'Poppins_600SemiBold', color: C.saffron },
});
