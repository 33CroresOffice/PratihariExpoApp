import { useEffect, useState } from 'react';
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
import { supabase } from '@/lib/supabase';
import { ArrowLeft, Plus, Pencil, X, Trash2, ToggleLeft, ToggleRight } from 'lucide-react-native';

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

interface Sahi {
  id: string;
  name: string;
  name_or: string | null;
  sort_order: number;
  is_active: boolean;
}

export default function AdminSahis() {
  const router = useRouter();
  const [sahis, setSahis] = useState<Sahi[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Sahi | null>(null);
  const [form, setForm] = useState({ name: '', name_or: '', sort_order: '0' });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const [deleteTarget, setDeleteTarget] = useState<Sahi | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [toggleTarget, setToggleTarget] = useState<Sahi | null>(null);
  const [toggling, setToggling] = useState(false);

  useEffect(() => { fetchSahis(); }, []);

  async function fetchSahis(isRefresh = false) {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    const { data } = await supabase
      .from('sahis')
      .select('id, name, name_or, sort_order, is_active')
      .order('is_active', { ascending: false })
      .order('sort_order')
      .order('name');
    setSahis(data || []);
    if (isRefresh) setRefreshing(false); else setLoading(false);
  }

  function openAdd() {
    setEditing(null);
    setForm({ name: '', name_or: '', sort_order: '0' });
    setFormError('');
    setModal(true);
  }

  function openEdit(s: Sahi) {
    setEditing(s);
    setForm({ name: s.name, name_or: s.name_or || '', sort_order: String(s.sort_order) });
    setFormError('');
    setModal(true);
  }

  async function save() {
    const name = form.name.trim();
    if (!name) { setFormError('Sahi name is required'); return; }
    setSaving(true);
    setFormError('');
    const payload = {
      name,
      name_or: form.name_or.trim() || null,
      sort_order: parseInt(form.sort_order, 10) || 0,
    };
    if (editing) {
      const { error } = await supabase.from('sahis').update(payload).eq('id', editing.id);
      if (error) { setFormError(error.message); setSaving(false); return; }
    } else {
      const { error } = await supabase.from('sahis').insert(payload);
      if (error) { setFormError(error.message); setSaving(false); return; }
    }
    setSaving(false);
    setModal(false);
    fetchSahis();
  }

  async function toggleActive(s: Sahi) {
    setToggleTarget(s);
  }

  async function confirmToggle() {
    if (!toggleTarget) return;
    setToggling(true);
    await supabase.from('sahis').update({ is_active: !toggleTarget.is_active }).eq('id', toggleTarget.id);
    setToggling(false);
    setToggleTarget(null);
    fetchSahis();
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    await supabase.from('sahis').delete().eq('id', deleteTarget.id);
    setDeleting(false);
    setDeleteTarget(null);
    fetchSahis();
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <ArrowLeft color={C.textPrimary} size={22} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerSub}>Admin</Text>
          <Text style={styles.headerTitle}>Sahi Management</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={openAdd} activeOpacity={0.8}>
          <Plus color="#fff" size={18} />
          <Text style={styles.addBtnText}>Add</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={C.saffron} size="large" /></View>
      ) : sahis.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>No Sahi records yet</Text>
          <Text style={styles.emptySub}>Tap "Add" to create your first Sahi.</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchSahis(true)} tintColor={C.saffron} />}
        >
          <Text style={styles.hintText}>
            Active Sahis appear in the registration form. Deactivate to hide without deleting.
          </Text>
          {sahis.map((s) => (
            <View key={s.id} style={[styles.card, !s.is_active && styles.cardInactive]}>
              <View style={styles.cardLeft}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardName}>{s.name}</Text>
                  {s.name_or ? (
                    <Text style={styles.cardNameOr}>{s.name_or}</Text>
                  ) : (
                    <Text style={styles.cardNameMissing}>Odia name not set</Text>
                  )}
                  {s.sort_order !== 0 && (
                    <Text style={styles.cardMeta}>Sort: {s.sort_order}</Text>
                  )}
                </View>
              </View>
              <View style={styles.cardActions}>
                <TouchableOpacity onPress={() => toggleActive(s)} style={styles.iconBtn} activeOpacity={0.7}>
                  {s.is_active
                    ? <ToggleRight color={C.success} size={26} />
                    : <ToggleLeft color={C.textMuted} size={26} />}
                </TouchableOpacity>
                <TouchableOpacity onPress={() => openEdit(s)} style={styles.iconBtn} activeOpacity={0.7}>
                  <Pencil color={C.saffron} size={16} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setDeleteTarget(s)} style={styles.iconBtn} activeOpacity={0.7}>
                  <Trash2 color={C.error} size={16} />
                </TouchableOpacity>
              </View>
            </View>
          ))}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {/* Add/Edit Modal */}
      <Modal visible={modal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{editing ? 'Edit Sahi' : 'Add Sahi'}</Text>
            <TouchableOpacity onPress={() => setModal(false)} style={styles.closeBtn}>
              <X color={C.textPrimary} size={22} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalContent}>
            <Text style={styles.fieldLabel}>Sahi Name (English) *</Text>
            <TextInput
              style={styles.input}
              value={form.name}
              onChangeText={(v) => setForm({ ...form, name: v })}
              placeholder="e.g. Markandeswar Sahi"
              placeholderTextColor={C.textMuted}
              autoFocus
            />
            <Text style={styles.fieldLabel}>Odia Name (ଓଡ଼ିଆ)</Text>
            <TextInput
              style={styles.input}
              value={form.name_or}
              onChangeText={(v) => setForm({ ...form, name_or: v })}
              placeholder="ଯଥା: ମାର୍କଣ୍ଡେଶ୍ୱର ଶାହି"
              placeholderTextColor={C.textMuted}
            />
            <Text style={styles.hintText}>Leave blank to show English when Odia is selected.</Text>
            <Text style={styles.fieldLabel}>Sort Order</Text>
            <TextInput
              style={styles.input}
              value={form.sort_order}
              onChangeText={(v) => setForm({ ...form, sort_order: v.replace(/[^0-9]/g, '') })}
              placeholder="0"
              placeholderTextColor={C.textMuted}
              keyboardType="numeric"
            />
            <Text style={styles.hintText}>Lower numbers appear first in the dropdown.</Text>

            {formError ? <Text style={styles.formError}>{formError}</Text> : null}

            <TouchableOpacity
              style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
              onPress={save}
              disabled={saving}
              activeOpacity={0.85}
            >
              {saving
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.saveBtnText}>{editing ? 'Update' : 'Create'}</Text>
              }
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Delete Confirmation */}
      <Modal visible={!!deleteTarget} animationType="fade" transparent>
        <View style={styles.overlay}>
          <View style={styles.confirmBox}>
            <Text style={styles.confirmTitle}>Delete Sahi</Text>
            <Text style={styles.confirmDesc}>
              Are you sure you want to delete "{deleteTarget?.name}"? This cannot be undone.
            </Text>
            <View style={styles.confirmActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setDeleteTarget(null)} disabled={deleting}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.confirmActionBtn, styles.deleteBtn]} onPress={confirmDelete} disabled={deleting}>
                {deleting ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.actionBtnText}>Delete</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Activate/Deactivate Confirmation */}
      <Modal visible={!!toggleTarget} animationType="fade" transparent>
        <View style={styles.overlay}>
          <View style={styles.confirmBox}>
            <Text style={styles.confirmTitle}>
              {toggleTarget?.is_active ? 'Deactivate Sahi' : 'Activate Sahi'}
            </Text>
            <Text style={styles.confirmDesc}>
              Are you sure you want to {toggleTarget?.is_active ? 'deactivate' : 'activate'} this Sahi?{' '}
              {toggleTarget?.is_active
                ? 'It will no longer appear in the registration form.'
                : 'It will appear in the registration form again.'}
            </Text>
            <View style={styles.confirmActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setToggleTarget(null)} disabled={toggling}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmActionBtn, toggleTarget?.is_active ? styles.deleteBtn : styles.activateBtn]}
                onPress={confirmToggle}
                disabled={toggling}
              >
                {toggling ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.actionBtnText}>{toggleTarget?.is_active ? 'Deactivate' : 'Activate'}</Text>}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    backgroundColor: '#fff',
  },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: C.cream, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1, marginLeft: 12 },
  headerSub: { fontSize: 11, fontFamily: 'Poppins_400Regular', color: C.textMuted },
  headerTitle: { fontSize: 17, fontFamily: 'Poppins_700Bold', color: C.textPrimary },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: C.saffron,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
  },
  addBtnText: { fontSize: 13, fontFamily: 'Poppins_600SemiBold', color: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  emptyTitle: { fontSize: 16, fontFamily: 'Poppins_600SemiBold', color: C.textSecondary },
  emptySub: { fontSize: 13, fontFamily: 'Poppins_400Regular', color: C.textMuted },
  listContent: { padding: 16 },
  hintText: { fontSize: 12, fontFamily: 'Poppins_400Regular', color: C.textMuted, marginBottom: 14, lineHeight: 18 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    padding: 14,
    marginBottom: 10,
  },
  cardInactive: { opacity: 0.55 },
  cardLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  cardName: { fontSize: 15, fontFamily: 'Poppins_600SemiBold', color: C.textPrimary },
  cardNameOr: { fontSize: 13, fontFamily: 'Poppins_400Regular', color: C.textSecondary, marginTop: 2 },
  cardNameMissing: { fontSize: 12, fontFamily: 'Poppins_400Regular', color: C.textMuted, marginTop: 2 },
  cardMeta: { fontSize: 11, fontFamily: 'Poppins_400Regular', color: C.textMuted, marginTop: 2 },
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  iconBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: C.cream, alignItems: 'center', justifyContent: 'center' },
  modal: { flex: 1, backgroundColor: C.warmWhite },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    backgroundColor: '#fff',
  },
  modalTitle: { fontSize: 17, fontFamily: 'Poppins_700Bold', color: C.textPrimary },
  closeBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: C.cream, alignItems: 'center', justifyContent: 'center' },
  modalContent: { padding: 20 },
  fieldLabel: { fontSize: 13, fontFamily: 'Poppins_500Medium', color: C.textSecondary, marginBottom: 6, marginTop: 16 },
  input: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: 'Poppins_400Regular',
    color: C.textPrimary,
    backgroundColor: '#fff',
  },
  formError: { fontSize: 13, fontFamily: 'Poppins_400Regular', color: C.error, marginTop: 12 },
  saveBtn: {
    backgroundColor: C.saffron,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 24,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { fontSize: 15, fontFamily: 'Poppins_700Bold', color: '#fff' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 32 },
  confirmBox: { backgroundColor: '#fff', borderRadius: 18, padding: 24, width: '100%' },
  confirmTitle: { fontSize: 18, fontFamily: 'Poppins_700Bold', color: C.textPrimary, marginBottom: 8 },
  confirmDesc: { fontSize: 14, fontFamily: 'Poppins_400Regular', color: C.textSecondary, lineHeight: 21, marginBottom: 20 },
  confirmActions: { flexDirection: 'row', gap: 12 },
  cancelBtn: { flex: 1, borderRadius: 12, paddingVertical: 13, alignItems: 'center', backgroundColor: C.cream },
  cancelBtnText: { fontSize: 14, fontFamily: 'Poppins_600SemiBold', color: C.textSecondary },
  confirmActionBtn: { flex: 1, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  deleteBtn: { backgroundColor: C.error },
  activateBtn: { backgroundColor: C.success },
  actionBtnText: { fontSize: 14, fontFamily: 'Poppins_600SemiBold', color: '#fff' },
});
