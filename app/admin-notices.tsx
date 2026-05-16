import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Modal,
  ScrollView,
  Platform,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { sendNotification } from '@/lib/pushNotifications';
import { ArrowLeft, Megaphone, Plus, Pencil, Trash2, Eye, EyeOff, Pin, PinOff, X, Check, TriangleAlert as AlertTriangle, Calendar, Briefcase, Bell, Info, MessageSquare, Send, Smartphone, Users, User, Search, ChevronDown, Clock, RefreshCw } from 'lucide-react-native';

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
  teal: '#1A7A6A',
};

const CATEGORIES = [
  { key: 'general', label: 'General', color: '#1D6FAE', bg: '#EBF5FB', icon: Info },
  { key: 'duty',    label: 'Duty',    color: '#B7770D', bg: '#FFF3CD', icon: Calendar },
  { key: 'event',   label: 'Event',   color: '#27AE60', bg: '#F0FFF4', icon: Briefcase },
  { key: 'urgent',  label: 'Urgent',  color: '#C0392B', bg: '#FFF5F5', icon: AlertTriangle },
];

const CHANNELS = [
  { key: 'sms',       label: 'SMS',        icon: MessageSquare },
  { key: 'whatsapp',  label: 'WhatsApp',   icon: Send },
  { key: 'push',      label: 'Push',       icon: Smartphone },
];

function getCat(key: string) {
  return CATEGORIES.find((c) => c.key === key) ?? CATEGORIES[0];
}

interface Notice {
  id: string;
  title: string;
  body: string;
  category: string;
  is_published: boolean;
  pinned: boolean;
  published_at: string | null;
  expires_at: string | null;
  created_at: string;
  target_type: string;
  target_ids: string[];
  channels: string[];
  notify_at: string | null;
  notification_sent_at: string | null;
}

interface SebayatOption {
  id: string;
  full_name: string;
  phone: string;
}

function formatTs(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDt(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const BLANK = {
  title: '',
  body: '',
  title_or: '',
  body_or: '',
  category: 'general',
  is_published: false,
  pinned: false,
  target_type: 'all',
  target_ids: [] as string[],
  channels: [] as string[],
  notify_when: 'on_publish' as 'on_publish' | 'custom',
  notify_at_date: '',
  notify_at_time: '',
};

export default function AdminNoticesScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'published' | 'draft'>('all');

  // Modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<Notice | null>(null);
  const [form, setForm] = useState({ ...BLANK });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Sebayat search for individual targeting
  const [sebayatSearch, setSebayatSearch] = useState('');
  const [sebayatResults, setSebayatResults] = useState<SebayatOption[]>([]);
  const [sebayatSearching, setSebayatSearching] = useState(false);
  const [selectedSebayats, setSelectedSebayats] = useState<SebayatOption[]>([]);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<Notice | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Read counts per notice
  const [readCounts, setReadCounts] = useState<Record<string, number>>({});

  // Resend state
  const [resending, setResending] = useState<string | null>(null);

  useEffect(() => { fetchNotices(); }, []);

  async function fetchNotices(isRefresh = false) {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    const { data } = await supabase
      .from('notices')
      .select('*')
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false });
    const list: Notice[] = data || [];
    setNotices(list);

    // Fetch read counts for all notices
    if (list.length > 0) {
      const ids = list.map((n) => n.id);
      const { data: reads } = await supabase
        .from('notice_reads')
        .select('notice_id')
        .in('notice_id', ids);
      const counts: Record<string, number> = {};
      (reads || []).forEach((r: any) => {
        counts[r.notice_id] = (counts[r.notice_id] ?? 0) + 1;
      });
      setReadCounts(counts);
    }

    if (isRefresh) setRefreshing(false); else setLoading(false);
  }

  // Sebayat search
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!sebayatSearch.trim()) { setSebayatResults([]); return; }
    searchTimer.current = setTimeout(async () => {
      setSebayatSearching(true);
      const q = sebayatSearch.trim();
      const { data } = await supabase
        .from('sebayats')
        .select('id, full_name, phone')
        .or(`full_name.ilike.%${q}%,phone.ilike.%${q}%`)
        .limit(10);
      setSebayatResults(data || []);
      setSebayatSearching(false);
    }, 300);
  }, [sebayatSearch]);

  function openCreate() {
    setEditing(null);
    setForm({ ...BLANK });
    setSelectedSebayats([]);
    setSebayatSearch('');
    setSebayatResults([]);
    setFormError('');
    setModalVisible(true);
  }

  function openEdit(n: Notice) {
    setEditing(n);
    setForm({
      title: n.title,
      body: n.body,
      title_or: (n as any).title_or ?? '',
      body_or: (n as any).body_or ?? '',
      category: n.category,
      is_published: n.is_published,
      pinned: n.pinned,
      target_type: n.target_type ?? 'all',
      target_ids: (n.target_ids as string[]) ?? [],
      channels: (n.channels as string[]) ?? [],
      notify_when: n.notify_at ? 'custom' : 'on_publish',
      notify_at_date: n.notify_at ? n.notify_at.split('T')[0] : '',
      notify_at_time: n.notify_at ? n.notify_at.split('T')[1]?.slice(0, 5) : '',
    });
    setSebayatSearch('');
    setSebayatResults([]);
    setFormError('');
    // Pre-load selected sebayats for individual targeting
    if (n.target_type === 'individual' && Array.isArray(n.target_ids) && n.target_ids.length > 0) {
      supabase.from('sebayats').select('id, full_name, phone').in('id', n.target_ids as string[]).then(({ data }) => {
        setSelectedSebayats(data || []);
      });
    } else {
      setSelectedSebayats([]);
    }
    setModalVisible(true);
  }

  function toggleChannel(key: string) {
    setForm((f) => ({
      ...f,
      channels: f.channels.includes(key) ? f.channels.filter((c) => c !== key) : [...f.channels, key],
    }));
  }

  function toggleGroupTarget(code: string) {
    setForm((f) => ({
      ...f,
      target_ids: f.target_ids.includes(code) ? f.target_ids.filter((id) => id !== code) : [...f.target_ids, code],
    }));
  }

  function addSebayat(s: SebayatOption) {
    if (!selectedSebayats.find((x) => x.id === s.id)) {
      const next = [...selectedSebayats, s];
      setSelectedSebayats(next);
      setForm((f) => ({ ...f, target_ids: next.map((x) => x.id) }));
    }
    setSebayatSearch('');
    setSebayatResults([]);
  }

  function removeSebayat(id: string) {
    const next = selectedSebayats.filter((s) => s.id !== id);
    setSelectedSebayats(next);
    setForm((f) => ({ ...f, target_ids: next.map((x) => x.id) }));
  }

  function buildNotifyAt(): string | null {
    if (form.notify_when === 'on_publish') return null;
    if (!form.notify_at_date) return null;
    const time = form.notify_at_time || '09:00';
    return `${form.notify_at_date}T${time}:00`;
  }

  async function handleSave() {
    if (!form.title.trim()) { setFormError('Title is required.'); return; }
    if (!form.body.trim()) { setFormError('Body is required.'); return; }
    if (form.target_type === 'group' && form.target_ids.length === 0) { setFormError('Select at least one group.'); return; }
    if (form.target_type === 'individual' && selectedSebayats.length === 0) { setFormError('Select at least one member.'); return; }

    setSaving(true);
    setFormError('');

    const payload: any = {
      title: form.title.trim(),
      body: form.body.trim(),
      title_or: form.title_or.trim() || null,
      body_or: form.body_or.trim() || null,
      category: form.category,
      is_published: form.is_published,
      pinned: form.pinned,
      target_type: form.target_type,
      target_ids: form.target_ids,
      channels: form.channels,
      notify_at: buildNotifyAt(),
      updated_at: new Date().toISOString(),
    };
    if (form.is_published && !editing?.published_at) {
      payload.published_at = new Date().toISOString();
    }

    if (editing) {
      const { error } = await supabase.from('notices').update(payload).eq('id', editing.id);
      if (error) { setFormError(error.message); setSaving(false); return; }
    } else {
      const { error } = await supabase.from('notices').insert({ ...payload, created_by: user!.id });
      if (error) { setFormError(error.message); setSaving(false); return; }
    }
    setSaving(false);
    setModalVisible(false);
    fetchNotices();
  }

  async function togglePublish(n: Notice) {
    const nowPublished = !n.is_published;
    await supabase.from('notices').update({
      is_published: nowPublished,
      published_at: nowPublished && !n.published_at ? new Date().toISOString() : n.published_at,
      updated_at: new Date().toISOString(),
    }).eq('id', n.id);

    if (nowPublished) {
      sendNotification('notice_published', null, {
        title: n.title ?? '',
        body: (n as any).body ?? (n as any).content ?? '',
        reference_type: 'notice',
        reference_id: n.id,
      }, 'sebayat');
    }

    fetchNotices();
  }

  async function togglePin(n: Notice) {
    await supabase.from('notices').update({ pinned: !n.pinned, updated_at: new Date().toISOString() }).eq('id', n.id);
    fetchNotices();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    await supabase.from('notices').delete().eq('id', deleteTarget.id);
    setDeleting(false);
    setDeleteTarget(null);
    fetchNotices();
  }

  async function handleResend(n: Notice) {
    setResending(n.id);
    await supabase.from('notices').update({
      notification_sent_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', n.id);
    setResending(null);
    fetchNotices();
  }

  const filtered = notices.filter((n) => {
    if (filter === 'published') return n.is_published;
    if (filter === 'draft') return !n.is_published;
    return true;
  });

  function targetLabel(n: Notice) {
    if (n.target_type === 'group') return (n.target_ids as string[]).join(', ') || 'Group';
    if (n.target_type === 'individual') {
      const c = (n.target_ids as string[]).length;
      return `${c} member${c !== 1 ? 's' : ''}`;
    }
    return 'All';
  }

  function renderItem({ item }: { item: Notice }) {
    const cat = getCat(item.category);
    const CatIcon = cat.icon;
    const reads = readCounts[item.id] ?? 0;
    const isResending = resending === item.id;
    return (
      <View style={styles.card}>
        <View style={styles.cardTopRow}>
          <View style={[styles.catBadge, { backgroundColor: cat.bg }]}>
            <CatIcon color={cat.color} size={11} />
            <Text style={[styles.catText, { color: cat.color }]}>{cat.label}</Text>
          </View>
          <View style={styles.cardBadges}>
            {item.pinned && <View style={styles.pinnedBadge}><Text style={styles.pinnedText}>Pinned</Text></View>}
            <View style={[styles.statusDot, { backgroundColor: item.is_published ? C.success : C.textMuted }]} />
            <Text style={[styles.statusText, { color: item.is_published ? C.success : C.textMuted }]}>
              {item.is_published ? 'Live' : 'Draft'}
            </Text>
          </View>
        </View>

        <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
        <Text style={styles.cardBody} numberOfLines={2}>{item.body}</Text>

        {/* Meta row */}
        <View style={styles.metaRow}>
          <View style={styles.metaChip}>
            <Users color={C.textMuted} size={11} />
            <Text style={styles.metaText}>{targetLabel(item)}</Text>
          </View>
          {reads > 0 && (
            <View style={styles.metaChip}>
              <Eye color={C.success} size={11} />
              <Text style={[styles.metaText, { color: C.success }]}>{reads} read</Text>
            </View>
          )}
          {item.notify_at && (
            <View style={styles.metaChip}>
              <Clock color={C.gold} size={11} />
              <Text style={[styles.metaText, { color: C.gold }]}>{formatTs(item.notify_at)}</Text>
            </View>
          )}
        </View>

        {(item.channels as string[]).length > 0 && (
          <View style={styles.channelRow}>
            {(item.channels as string[]).map((ch) => {
              const cfg = CHANNELS.find((c) => c.key === ch);
              if (!cfg) return null;
              const Icon = cfg.icon;
              return (
                <View key={ch} style={styles.channelChip}>
                  <Icon color={C.textMuted} size={11} />
                  <Text style={styles.channelText}>{cfg.label}</Text>
                </View>
              );
            })}
            {item.notification_sent_at && (
              <Text style={styles.sentAt}>Sent {formatTs(item.notification_sent_at)}</Text>
            )}
          </View>
        )}

        <Text style={styles.cardDate}>
          {item.is_published ? `Published ${formatTs(item.published_at)}` : `Created ${formatTs(item.created_at)}`}
        </Text>

        <View style={styles.cardActions}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => togglePin(item)} activeOpacity={0.7}>
            {item.pinned ? <PinOff color={C.gold} size={15} /> : <Pin color={C.textMuted} size={15} />}
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => togglePublish(item)} activeOpacity={0.7}>
            {item.is_published ? <EyeOff color={C.textMuted} size={15} /> : <Eye color={C.success} size={15} />}
            <Text style={[styles.actionBtnText, { color: item.is_published ? C.textMuted : C.success }]}>
              {item.is_published ? 'Unpublish' : 'Publish'}
            </Text>
          </TouchableOpacity>
          {item.is_published && (item.channels as string[]).length > 0 && (
            <TouchableOpacity style={styles.actionBtn} onPress={() => handleResend(item)} activeOpacity={0.7} disabled={isResending}>
              {isResending ? <ActivityIndicator size="small" color={C.teal} /> : <RefreshCw color={C.teal} size={15} />}
              <Text style={[styles.actionBtnText, { color: C.teal }]}>Resend</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.actionBtn} onPress={() => openEdit(item)} activeOpacity={0.7}>
            <Pencil color={C.saffron} size={15} />
            <Text style={[styles.actionBtnText, { color: C.saffron }]}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => setDeleteTarget(item)} activeOpacity={0.7}>
            <Trash2 color={C.error} size={15} />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ─── MODAL SECTIONS ────────────────────────────────────────────────────

  function renderTargetSection() {
    return (
      <>
        <Text style={styles.fieldLabel}>Target Audience</Text>
        <View style={styles.targetTypeRow}>
          {[
            { key: 'all', label: 'All Members', icon: Users },
            { key: 'group', label: 'By Group', icon: Users },
            { key: 'individual', label: 'Specific', icon: User },
          ].map(({ key, label, icon: Icon }) => {
            const active = form.target_type === key;
            return (
              <TouchableOpacity
                key={key}
                style={[styles.targetTypeOption, active && styles.targetTypeOptionActive]}
                onPress={() => setForm((f) => ({ ...f, target_type: key, target_ids: [] }))}
                activeOpacity={0.7}
              >
                <Icon color={active ? C.teal : C.textMuted} size={14} />
                <Text style={[styles.targetTypeText, active && styles.targetTypeTextActive]}>{label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {form.target_type === 'group' && (
          <View style={styles.groupCheckRow}>
            {['pratihari', 'gochhikar'].map((g) => {
              const checked = form.target_ids.includes(g);
              return (
                <TouchableOpacity
                  key={g}
                  style={[styles.groupCheck, checked && styles.groupCheckActive]}
                  onPress={() => toggleGroupTarget(g)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.checkbox, checked && styles.checkboxActive]}>
                    {checked && <Check color="#fff" size={10} />}
                  </View>
                  <Text style={[styles.groupCheckText, checked && { color: C.teal }]}>
                    {g.charAt(0).toUpperCase() + g.slice(1)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {form.target_type === 'individual' && (
          <View style={styles.sebayatPickerWrap}>
            <View style={styles.sebayatSearchRow}>
              <Search color={C.textMuted} size={14} />
              <TextInput
                style={styles.sebayatSearchInput}
                value={sebayatSearch}
                onChangeText={setSebayatSearch}
                placeholder="Search by name or phone..."
                placeholderTextColor={C.textMuted}
              />
              {sebayatSearching && <ActivityIndicator size="small" color={C.saffron} />}
            </View>

            {sebayatResults.length > 0 && (
              <View style={styles.sebayatDropdown}>
                {sebayatResults.map((s) => {
                  const already = selectedSebayats.some((x) => x.id === s.id);
                  return (
                    <TouchableOpacity
                      key={s.id}
                      style={[styles.sebayatDropdownItem, already && { opacity: 0.4 }]}
                      onPress={() => !already && addSebayat(s)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.sebayatDropdownName}>{s.full_name}</Text>
                      <Text style={styles.sebayatDropdownPhone}>{s.phone}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {selectedSebayats.length > 0 && (
              <View style={styles.selectedChips}>
                {selectedSebayats.map((s) => (
                  <View key={s.id} style={styles.selectedChip}>
                    <Text style={styles.selectedChipText}>{s.full_name}</Text>
                    <TouchableOpacity onPress={() => removeSebayat(s.id)} hitSlop={{ top: 4, right: 4, bottom: 4, left: 4 }}>
                      <X color={C.textMuted} size={12} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
      </>
    );
  }

  function renderChannelSection() {
    return (
      <>
        <Text style={styles.fieldLabel}>Notify via</Text>
        <View style={styles.channelToggleRow}>
          {CHANNELS.map(({ key, label, icon: Icon }) => {
            const active = form.channels.includes(key);
            return (
              <TouchableOpacity
                key={key}
                style={[styles.channelToggle, active && styles.channelToggleActive]}
                onPress={() => toggleChannel(key)}
                activeOpacity={0.7}
              >
                <Icon color={active ? C.teal : C.textMuted} size={16} />
                <Text style={[styles.channelToggleText, active && { color: C.teal }]}>{label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <Text style={styles.channelNote}>Delivery will be active when the notification system goes live.</Text>

        <Text style={[styles.fieldLabel, { marginTop: 20 }]}>Send Notification At</Text>
        <View style={styles.notifyWhenRow}>
          {[
            { key: 'on_publish', label: 'On Publish' },
            { key: 'custom', label: 'Custom Time' },
          ].map(({ key, label }) => {
            const active = form.notify_when === key;
            return (
              <TouchableOpacity
                key={key}
                style={[styles.notifyWhenOption, active && styles.notifyWhenOptionActive]}
                onPress={() => setForm((f) => ({ ...f, notify_when: key as any }))}
                activeOpacity={0.7}
              >
                <Text style={[styles.notifyWhenText, active && styles.notifyWhenTextActive]}>{label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {form.notify_when === 'custom' && (
          <View style={styles.dateTimeRow}>
            <View style={styles.dateTimeField}>
              <Text style={styles.dateTimeLabel}>Date</Text>
              <TextInput
                style={styles.dateTimeInput}
                value={form.notify_at_date}
                onChangeText={(v) => setForm((f) => ({ ...f, notify_at_date: v }))}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={C.textMuted}
                keyboardType="numeric"
              />
            </View>
            <View style={styles.dateTimeField}>
              <Text style={styles.dateTimeLabel}>Time (HH:MM)</Text>
              <TextInput
                style={styles.dateTimeInput}
                value={form.notify_at_time}
                onChangeText={(v) => setForm((f) => ({ ...f, notify_at_time: v }))}
                placeholder="09:00"
                placeholderTextColor={C.textMuted}
                keyboardType="numeric"
              />
            </View>
          </View>
        )}
      </>
    );
  }

  // ─── RENDER ────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <LinearGradient colors={['#1A7A6A', '#145E52']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <ArrowLeft color="#fff" size={22} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Megaphone color="rgba(255,255,255,0.85)" size={20} />
          <Text style={styles.headerTitle}>Manage Notices</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={openCreate} activeOpacity={0.8}>
          <Plus color="#fff" size={20} />
        </TouchableOpacity>
      </LinearGradient>

      <View style={styles.filterRow}>
        {([
          { key: 'all', getLabel: () => `All (${notices.length})` },
          { key: 'published', getLabel: () => `Live (${notices.filter(n => n.is_published).length})` },
          { key: 'draft', getLabel: () => `Draft (${notices.filter(n => !n.is_published).length})` },
        ] as const).map(({ key, getLabel }) => (
          <TouchableOpacity key={key} style={[styles.filterTab, filter === key && styles.filterTabActive]} onPress={() => setFilter(key)} activeOpacity={0.7}>
            <Text style={[styles.filterTabText, filter === key && styles.filterTabTextActive]}>{getLabel()}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={C.saffron} size="large" /></View>
      ) : filtered.length === 0 ? (
        <View style={styles.center}>
          <Bell color={C.textMuted} size={44} />
          <Text style={styles.emptyTitle}>No notices yet</Text>
          <TouchableOpacity style={styles.emptyCreateBtn} onPress={openCreate} activeOpacity={0.8}>
            <Plus color="#fff" size={16} />
            <Text style={styles.emptyCreateText}>Create First Notice</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchNotices(true)} colors={[C.saffron]} tintColor={C.saffron} />}
        />
      )}

      {/* Create / Edit Modal */}
      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setModalVisible(false)}>
        <SafeAreaView style={styles.modalContainer} edges={['top']}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{editing ? 'Edit Notice' : 'New Notice'}</Text>
            <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.modalCloseBtn} activeOpacity={0.7}>
              <X color={C.textSecondary} size={22} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalScroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {formError ? <Text style={styles.formError}>{formError}</Text> : null}

            <Text style={styles.fieldLabel}>Title *</Text>
            <TextInput
              style={styles.fieldInput}
              value={form.title}
              onChangeText={(v) => setForm((f) => ({ ...f, title: v }))}
              placeholder="Notice headline"
              placeholderTextColor={C.textMuted}
            />

            <Text style={styles.fieldLabel}>Body *</Text>
            <TextInput
              style={[styles.fieldInput, styles.bodyInput]}
              value={form.body}
              onChangeText={(v) => setForm((f) => ({ ...f, body: v }))}
              placeholder="Full notice content..."
              placeholderTextColor={C.textMuted}
              multiline
              textAlignVertical="top"
            />

            <Text style={[styles.fieldLabel, { marginTop: 8 }]}>
              Title (Odia) <Text style={{ color: C.textMuted, fontSize: 11 }}>— optional</Text>
            </Text>
            <TextInput
              style={[styles.fieldInput, { fontFamily: 'NotoSansOriya_400Regular' }]}
              value={form.title_or}
              onChangeText={(v) => setForm((f) => ({ ...f, title_or: v }))}
              placeholder="ଓଡ଼ିଆ ଶିରୋନାମା (ଖାଲି ଛାଡ଼ିଲେ ଇଂରାଜୀ ଦେଖାଯିବ)"
              placeholderTextColor={C.textMuted}
            />

            <Text style={styles.fieldLabel}>
              Body (Odia) <Text style={{ color: C.textMuted, fontSize: 11 }}>— optional</Text>
            </Text>
            <TextInput
              style={[styles.fieldInput, styles.bodyInput, { fontFamily: 'NotoSansOriya_400Regular' }]}
              value={form.body_or}
              onChangeText={(v) => setForm((f) => ({ ...f, body_or: v }))}
              placeholder="ଓଡ଼ିଆରେ ବିଷୟବସ୍ତୁ..."
              placeholderTextColor={C.textMuted}
              multiline
              textAlignVertical="top"
            />

            <Text style={styles.fieldLabel}>Category</Text>
            <View style={styles.catRow}>
              {CATEGORIES.map((cat) => {
                const CatIcon = cat.icon;
                const selected = form.category === cat.key;
                return (
                  <TouchableOpacity
                    key={cat.key}
                    style={[styles.catOption, selected && { backgroundColor: cat.bg, borderColor: cat.color }]}
                    onPress={() => setForm((f) => ({ ...f, category: cat.key }))}
                    activeOpacity={0.7}
                  >
                    <CatIcon color={selected ? cat.color : C.textMuted} size={14} />
                    <Text style={[styles.catOptionText, selected && { color: cat.color }]}>{cat.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.dividerSection} />

            {renderTargetSection()}

            <View style={styles.dividerSection} />

            {renderChannelSection()}

            <View style={styles.dividerSection} />

            <View style={styles.toggleRow}>
              <View style={styles.toggleInfo}>
                <Text style={styles.toggleLabel}>Publish immediately</Text>
                <Text style={styles.toggleSub}>Make this notice visible to all targeted members</Text>
              </View>
              <TouchableOpacity
                style={[styles.toggle, form.is_published && styles.toggleOn]}
                onPress={() => setForm((f) => ({ ...f, is_published: !f.is_published }))}
                activeOpacity={0.8}
              >
                <View style={[styles.toggleThumb, form.is_published && styles.toggleThumbOn]} />
              </TouchableOpacity>
            </View>

            <View style={styles.toggleRow}>
              <View style={styles.toggleInfo}>
                <Text style={styles.toggleLabel}>Pin to top</Text>
                <Text style={styles.toggleSub}>Pinned notices always appear first</Text>
              </View>
              <TouchableOpacity
                style={[styles.toggle, form.pinned && styles.toggleOn]}
                onPress={() => setForm((f) => ({ ...f, pinned: !f.pinned }))}
                activeOpacity={0.8}
              >
                <View style={[styles.toggleThumb, form.pinned && styles.toggleThumbOn]} />
              </TouchableOpacity>
            </View>

            <View style={{ height: 40 }} />
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity style={styles.cancelFooterBtn} onPress={() => setModalVisible(false)} activeOpacity={0.7}>
              <Text style={styles.cancelFooterText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveFooterBtn, saving && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.8}
            >
              {saving ? <ActivityIndicator color="#fff" size="small" /> : (
                <>
                  <Check color="#fff" size={16} />
                  <Text style={styles.saveFooterText}>{editing ? 'Save Changes' : 'Create Notice'}</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Delete Confirm Modal */}
      <Modal visible={!!deleteTarget} transparent animationType="fade" onRequestClose={() => setDeleteTarget(null)}>
        <View style={styles.deleteOverlay}>
          <View style={styles.deleteModal}>
            <View style={styles.deleteIconWrap}>
              <Trash2 color={C.error} size={28} />
            </View>
            <Text style={styles.deleteTitle}>Delete Notice?</Text>
            <Text style={styles.deleteBody} numberOfLines={2}>"{deleteTarget?.title}"</Text>
            <Text style={styles.deleteSubtext}>This action cannot be undone.</Text>
            <View style={styles.deleteActions}>
              <TouchableOpacity style={styles.deleteCancelBtn} onPress={() => setDeleteTarget(null)} activeOpacity={0.7}>
                <Text style={styles.deleteCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.deleteConfirmBtn, deleting && { opacity: 0.6 }]}
                onPress={handleDelete}
                disabled={deleting}
                activeOpacity={0.8}
              >
                {deleting ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.deleteConfirmText}>Delete</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.warmWhite },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20, gap: 12 },
  backBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 18, fontFamily: 'Poppins_700Bold', color: '#fff' },
  addBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },

  filterRow: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  filterTab: { flex: 1, paddingVertical: 7, borderRadius: 10, backgroundColor: '#fff', alignItems: 'center', borderWidth: 1, borderColor: C.border },
  filterTabActive: { backgroundColor: C.saffron, borderColor: C.saffron },
  filterTabText: { fontSize: 12, fontFamily: 'Poppins_600SemiBold', color: C.textMuted },
  filterTabTextActive: { color: '#fff' },

  listContent: { padding: 16, gap: 12 },

  card: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 16 },
  cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  catBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  catText: { fontSize: 11, fontFamily: 'Poppins_600SemiBold' },
  cardBadges: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pinnedBadge: { backgroundColor: '#FFF8E8', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: C.gold + '50' },
  pinnedText: { fontSize: 10, fontFamily: 'Poppins_600SemiBold', color: C.gold },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: 12, fontFamily: 'Poppins_500Medium' },
  cardTitle: { fontSize: 15, fontFamily: 'Poppins_700Bold', color: C.textPrimary, marginBottom: 6, lineHeight: 22 },
  cardBody: { fontSize: 13, fontFamily: 'Poppins_400Regular', color: C.textSecondary, lineHeight: 20, marginBottom: 8 },

  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 6 },
  metaChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F5F0EC', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8 },
  metaText: { fontSize: 11, fontFamily: 'Poppins_400Regular', color: C.textMuted },

  channelRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8, alignItems: 'center' },
  channelChip: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#EBF7F4', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8 },
  channelText: { fontSize: 11, fontFamily: 'Poppins_400Regular', color: C.teal },
  sentAt: { fontSize: 10, fontFamily: 'Poppins_400Regular', color: C.textMuted, marginLeft: 4 },

  cardDate: { fontSize: 11, fontFamily: 'Poppins_400Regular', color: C.textMuted, marginBottom: 12 },
  cardActions: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4, borderTopWidth: 1, borderTopColor: C.border, paddingTop: 12 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: '#F8F4F0', marginRight: 2 },
  actionBtnText: { fontSize: 11, fontFamily: 'Poppins_500Medium' },

  emptyTitle: { fontSize: 16, fontFamily: 'Poppins_600SemiBold', color: C.textSecondary },
  emptyCreateBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.saffron, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12, marginTop: 4 },
  emptyCreateText: { fontSize: 14, fontFamily: 'Poppins_600SemiBold', color: '#fff' },

  // Modal
  modalContainer: { flex: 1, backgroundColor: C.warmWhite },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: C.border },
  modalTitle: { fontSize: 18, fontFamily: 'Poppins_700Bold', color: C.textPrimary },
  modalCloseBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#F5F0EC', alignItems: 'center', justifyContent: 'center' },
  modalScroll: { flex: 1, paddingHorizontal: 20, paddingTop: 20 },
  formError: { fontSize: 13, fontFamily: 'Poppins_400Regular', color: C.error, marginBottom: 12, backgroundColor: '#FFF5F5', padding: 10, borderRadius: 8 },
  fieldLabel: { fontSize: 11, fontFamily: 'Poppins_600SemiBold', color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 },
  fieldInput: { borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: Platform.OS === 'ios' ? 12 : 9, fontSize: 15, fontFamily: 'Poppins_400Regular', color: C.textPrimary, backgroundColor: '#fff', marginBottom: 8 },
  bodyInput: { minHeight: 120, paddingTop: 12 },
  catRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 8 },
  catOption: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: '#F5F0EC', borderWidth: 1, borderColor: 'transparent' },
  catOptionText: { fontSize: 13, fontFamily: 'Poppins_500Medium', color: C.textMuted },

  dividerSection: { height: 1, backgroundColor: C.border, marginVertical: 20 },

  // Target
  targetTypeRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  targetTypeOption: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 9, borderRadius: 10, backgroundColor: '#F5F0EC', borderWidth: 1, borderColor: 'transparent' },
  targetTypeOptionActive: { backgroundColor: '#EBF7F4', borderColor: C.teal },
  targetTypeText: { fontSize: 12, fontFamily: 'Poppins_500Medium', color: C.textMuted },
  targetTypeTextActive: { color: C.teal },

  groupCheckRow: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  groupCheck: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 10, backgroundColor: '#F5F0EC', borderWidth: 1, borderColor: 'transparent' },
  groupCheckActive: { backgroundColor: '#EBF7F4', borderColor: C.teal },
  checkbox: { width: 18, height: 18, borderRadius: 5, borderWidth: 1.5, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  checkboxActive: { backgroundColor: C.teal, borderColor: C.teal },
  groupCheckText: { fontSize: 13, fontFamily: 'Poppins_600SemiBold', color: C.textMuted },

  sebayatPickerWrap: { marginBottom: 8 },
  sebayatSearchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#fff', marginBottom: 6 },
  sebayatSearchInput: { flex: 1, fontSize: 14, fontFamily: 'Poppins_400Regular', color: C.textPrimary },
  sebayatDropdown: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: C.border, overflow: 'hidden', marginBottom: 8 },
  sebayatDropdownItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border },
  sebayatDropdownName: { fontSize: 13, fontFamily: 'Poppins_500Medium', color: C.textPrimary },
  sebayatDropdownPhone: { fontSize: 12, fontFamily: 'Poppins_400Regular', color: C.textMuted },
  selectedChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  selectedChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#EBF7F4', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: C.teal + '40' },
  selectedChipText: { fontSize: 12, fontFamily: 'Poppins_500Medium', color: C.teal },

  // Channels
  channelToggleRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  channelToggle: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10, backgroundColor: '#F5F0EC', borderWidth: 1, borderColor: 'transparent' },
  channelToggleActive: { backgroundColor: '#EBF7F4', borderColor: C.teal },
  channelToggleText: { fontSize: 12, fontFamily: 'Poppins_500Medium', color: C.textMuted },
  channelNote: { fontSize: 11, fontFamily: 'Poppins_400Regular', color: C.textMuted, fontStyle: 'italic', marginBottom: 4 },

  notifyWhenRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  notifyWhenOption: { flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: 'center', backgroundColor: '#F5F0EC', borderWidth: 1, borderColor: 'transparent' },
  notifyWhenOptionActive: { backgroundColor: '#EBF7F4', borderColor: C.teal },
  notifyWhenText: { fontSize: 13, fontFamily: 'Poppins_500Medium', color: C.textMuted },
  notifyWhenTextActive: { color: C.teal },

  dateTimeRow: { flexDirection: 'row', gap: 12, marginBottom: 8 },
  dateTimeField: { flex: 1 },
  dateTimeLabel: { fontSize: 11, fontFamily: 'Poppins_500Medium', color: C.textMuted, marginBottom: 4 },
  dateTimeInput: { borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, fontSize: 14, fontFamily: 'Poppins_400Regular', color: C.textPrimary, backgroundColor: '#fff' },

  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.border },
  toggleInfo: { flex: 1, marginRight: 16 },
  toggleLabel: { fontSize: 14, fontFamily: 'Poppins_600SemiBold', color: C.textPrimary },
  toggleSub: { fontSize: 12, fontFamily: 'Poppins_400Regular', color: C.textMuted, marginTop: 2 },
  toggle: { width: 48, height: 28, borderRadius: 14, backgroundColor: C.border, justifyContent: 'center', paddingHorizontal: 3 },
  toggleOn: { backgroundColor: C.saffron },
  toggleThumb: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 2 },
  toggleThumbOn: { alignSelf: 'flex-end' },
  modalFooter: { flexDirection: 'row', gap: 12, paddingHorizontal: 20, paddingVertical: 16, borderTopWidth: 1, borderTopColor: C.border },
  cancelFooterBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: C.border, alignItems: 'center' },
  cancelFooterText: { fontSize: 15, fontFamily: 'Poppins_500Medium', color: C.textSecondary },
  saveFooterBtn: { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.saffron, paddingVertical: 14, borderRadius: 12 },
  saveFooterText: { fontSize: 15, fontFamily: 'Poppins_600SemiBold', color: '#fff' },

  deleteOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 32 },
  deleteModal: { backgroundColor: '#fff', borderRadius: 20, padding: 28, alignItems: 'center', width: '100%', maxWidth: 360 },
  deleteIconWrap: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#FFF5F5', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  deleteTitle: { fontSize: 18, fontFamily: 'Poppins_700Bold', color: C.textPrimary, marginBottom: 8 },
  deleteBody: { fontSize: 14, fontFamily: 'Poppins_500Medium', color: C.textSecondary, textAlign: 'center', marginBottom: 4 },
  deleteSubtext: { fontSize: 12, fontFamily: 'Poppins_400Regular', color: C.textMuted, marginBottom: 24 },
  deleteActions: { flexDirection: 'row', gap: 12, width: '100%' },
  deleteCancelBtn: { flex: 1, paddingVertical: 13, borderRadius: 12, borderWidth: 1, borderColor: C.border, alignItems: 'center' },
  deleteCancelText: { fontSize: 14, fontFamily: 'Poppins_500Medium', color: C.textSecondary },
  deleteConfirmBtn: { flex: 1, paddingVertical: 13, borderRadius: 12, backgroundColor: C.error, alignItems: 'center', justifyContent: 'center' },
  deleteConfirmText: { fontSize: 14, fontFamily: 'Poppins_600SemiBold', color: '#fff' },
});
