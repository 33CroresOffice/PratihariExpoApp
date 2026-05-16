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
import { ArrowLeft, Pencil, X, Check, ChevronDown } from 'lucide-react-native';

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

interface SebaCategory {
  id: string;
  category_type: string;
  name: string;
  name_or: string | null;
  sort_order: number;
  is_active: boolean;
}

interface SebaGroup {
  id: string;
  code: string;
  name: string;
  name_or: string | null;
}

const TYPE_LABELS: Record<string, string> = {
  seba: 'Seba',
  bansa: 'Bansa',
  palia: 'Palia',
};

export default function AdminSebaCategories() {
  const router = useRouter();
  const [categories, setCategories] = useState<SebaCategory[]>([]);
  const [groups, setGroups] = useState<SebaGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'categories' | 'groups'>('categories');

  // Edit category modal
  const [editModal, setEditModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<SebaCategory | null>(null);
  const [editForm, setEditForm] = useState({ name_or: '' });
  const [saving, setSaving] = useState(false);

  // Edit group modal
  const [groupModal, setGroupModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState<SebaGroup | null>(null);
  const [groupForm, setGroupForm] = useState({ name_or: '' });
  const [savingGroup, setSavingGroup] = useState(false);

  // Filter
  const [filterType, setFilterType] = useState<string>('all');
  const [showFilterPicker, setShowFilterPicker] = useState(false);

  useEffect(() => { fetchData(); }, []);

  async function fetchData(isRefresh = false) {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    const [catRes, grpRes] = await Promise.all([
      supabase.from('seba_categories').select('id, category_type, name, name_or, sort_order, is_active').order('category_type').order('sort_order').order('name'),
      supabase.from('seba_groups').select('id, code, name, name_or').order('code'),
    ]);
    setCategories(catRes.data || []);
    setGroups(grpRes.data || []);
    if (isRefresh) setRefreshing(false); else setLoading(false);
  }

  function openEditCategory(cat: SebaCategory) {
    setEditingCategory(cat);
    setEditForm({ name_or: cat.name_or || '' });
    setEditModal(true);
  }

  async function saveCategory() {
    if (!editingCategory) return;
    setSaving(true);
    await supabase
      .from('seba_categories')
      .update({ name_or: editForm.name_or.trim() || null })
      .eq('id', editingCategory.id);
    setSaving(false);
    setEditModal(false);
    fetchData();
  }

  function openEditGroup(grp: SebaGroup) {
    setEditingGroup(grp);
    setGroupForm({ name_or: grp.name_or || '' });
    setGroupModal(true);
  }

  async function saveGroup() {
    if (!editingGroup) return;
    setSavingGroup(true);
    await supabase
      .from('seba_groups')
      .update({ name_or: groupForm.name_or.trim() || null })
      .eq('id', editingGroup.id);
    setSavingGroup(false);
    setGroupModal(false);
    fetchData();
  }

  const displayedCategories = filterType === 'all'
    ? categories
    : categories.filter((c) => c.category_type === filterType);

  const typeOptions = ['all', ...Object.keys(TYPE_LABELS)];

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <ArrowLeft color={C.textPrimary} size={22} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerSub}>Admin</Text>
          <Text style={styles.headerTitle}>Seba Categories</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'categories' && styles.tabActive]}
          onPress={() => setActiveTab('categories')}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabText, activeTab === 'categories' && styles.tabTextActive]}>Categories</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'groups' && styles.tabActive]}
          onPress={() => setActiveTab('groups')}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabText, activeTab === 'groups' && styles.tabTextActive]}>Groups</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={C.saffron} size="large" /></View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchData(true)} tintColor={C.saffron} />}
        >
          {activeTab === 'categories' && (
            <>
              {/* Filter */}
              <TouchableOpacity
                style={styles.filterBtn}
                onPress={() => setShowFilterPicker(true)}
                activeOpacity={0.8}
              >
                <Text style={styles.filterBtnText}>
                  {filterType === 'all' ? 'All Types' : TYPE_LABELS[filterType]}
                </Text>
                <ChevronDown color={C.textMuted} size={14} />
              </TouchableOpacity>

              <Text style={styles.hintText}>
                Tap the edit icon to add the Odia (ଓଡ଼ିଆ) name for each seba category.
              </Text>

              {displayedCategories.map((cat) => (
                <View key={cat.id} style={styles.card}>
                  <View style={styles.cardLeft}>
                    <View style={styles.typeBadge}>
                      <Text style={styles.typeBadgeText}>{TYPE_LABELS[cat.category_type] ?? cat.category_type}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardName}>{cat.name}</Text>
                      {cat.name_or ? (
                        <Text style={styles.cardNameOr}>{cat.name_or}</Text>
                      ) : (
                        <Text style={styles.cardNameMissing}>Odia name not set</Text>
                      )}
                    </View>
                  </View>
                  <TouchableOpacity style={styles.editBtn} onPress={() => openEditCategory(cat)} activeOpacity={0.7}>
                    <Pencil color={C.saffron} size={16} />
                  </TouchableOpacity>
                </View>
              ))}
            </>
          )}

          {activeTab === 'groups' && (
            <>
              <Text style={styles.hintText}>
                Set the Odia name for each seba group (e.g. Pratihari, Gochhikar).
              </Text>
              {groups.map((grp) => (
                <View key={grp.id} style={styles.card}>
                  <View style={styles.cardLeft}>
                    <View style={[styles.typeBadge, { backgroundColor: '#E8F5E9' }]}>
                      <Text style={[styles.typeBadgeText, { color: C.success }]}>{grp.code}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardName}>{grp.name}</Text>
                      {grp.name_or ? (
                        <Text style={styles.cardNameOr}>{grp.name_or}</Text>
                      ) : (
                        <Text style={styles.cardNameMissing}>Odia name not set</Text>
                      )}
                    </View>
                  </View>
                  <TouchableOpacity style={styles.editBtn} onPress={() => openEditGroup(grp)} activeOpacity={0.7}>
                    <Pencil color={C.saffron} size={16} />
                  </TouchableOpacity>
                </View>
              ))}
            </>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {/* Edit Category Modal */}
      <Modal visible={editModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Edit Odia Name</Text>
            <TouchableOpacity onPress={() => setEditModal(false)} style={styles.closeBtn}>
              <X color={C.textPrimary} size={22} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalContent}>
            <Text style={styles.modalSubtitle}>English</Text>
            <View style={styles.readonlyField}>
              <Text style={styles.readonlyText}>{editingCategory?.name}</Text>
            </View>
            <Text style={styles.fieldLabel}>Odia Name (ଓଡ଼ିଆ)</Text>
            <TextInput
              style={styles.input}
              value={editForm.name_or}
              onChangeText={(v) => setEditForm({ name_or: v })}
              placeholder="ଯଥା: ଦକ୍ଷିଣୀ"
              placeholderTextColor={C.textMuted}
              autoFocus
            />
            <Text style={styles.hintText}>Leave blank to show the English name when Odia is selected.</Text>
            <TouchableOpacity
              style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
              onPress={saveCategory}
              disabled={saving}
              activeOpacity={0.85}
            >
              {saving
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.saveBtnText}>Save</Text>
              }
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Edit Group Modal */}
      <Modal visible={groupModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Edit Odia Name</Text>
            <TouchableOpacity onPress={() => setGroupModal(false)} style={styles.closeBtn}>
              <X color={C.textPrimary} size={22} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalContent}>
            <Text style={styles.modalSubtitle}>English</Text>
            <View style={styles.readonlyField}>
              <Text style={styles.readonlyText}>{editingGroup?.name}</Text>
            </View>
            <Text style={styles.fieldLabel}>Odia Name (ଓଡ଼ିଆ)</Text>
            <TextInput
              style={styles.input}
              value={groupForm.name_or}
              onChangeText={(v) => setGroupForm({ name_or: v })}
              placeholder="ଯଥା: ପ୍ରତିହାର"
              placeholderTextColor={C.textMuted}
              autoFocus
            />
            <Text style={styles.hintText}>Leave blank to show the English name when Odia is selected.</Text>
            <TouchableOpacity
              style={[styles.saveBtn, savingGroup && styles.saveBtnDisabled]}
              onPress={saveGroup}
              disabled={savingGroup}
              activeOpacity={0.85}
            >
              {savingGroup
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.saveBtnText}>Save</Text>
              }
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Filter picker */}
      <Modal visible={showFilterPicker} animationType="slide" transparent>
        <TouchableOpacity style={styles.sheetOverlay} activeOpacity={1} onPress={() => setShowFilterPicker(false)}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Filter by Type</Text>
            <ScrollView>
              {typeOptions.map((opt) => (
                <TouchableOpacity
                  key={opt}
                  style={styles.sheetItem}
                  onPress={() => { setFilterType(opt); setShowFilterPicker(false); }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.sheetItemText, filterType === opt && styles.sheetItemTextActive]}>
                    {opt === 'all' ? 'All Types' : TYPE_LABELS[opt]}
                  </Text>
                  {filterType === opt && <Check color={C.saffron} size={16} />}
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

  tabRow: {
    flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: C.border,
    paddingHorizontal: 16,
  },
  tab: {
    flex: 1, paddingVertical: 12, alignItems: 'center',
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: C.saffron },
  tabText: { fontSize: 14, fontFamily: 'Poppins_600SemiBold', color: C.textMuted },
  tabTextActive: { color: C.saffron },

  listContent: { padding: 16 },
  filterBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    alignSelf: 'flex-start',
    backgroundColor: C.cream, borderRadius: 10, borderWidth: 1, borderColor: C.border,
    paddingHorizontal: 12, paddingVertical: 7, marginBottom: 12,
  },
  filterBtnText: { fontSize: 13, fontFamily: 'Poppins_600SemiBold', color: C.textSecondary },

  hintText: { fontSize: 12, fontFamily: 'Poppins_400Regular', color: C.textMuted, marginBottom: 14, lineHeight: 18 },

  card: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 14,
    borderWidth: 1, borderColor: C.border,
    padding: 14, marginBottom: 10, gap: 12,
  },
  cardLeft: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  typeBadge: {
    backgroundColor: '#FFF3E0', borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 3, flexShrink: 0, marginTop: 2,
  },
  typeBadgeText: { fontSize: 10, fontFamily: 'Poppins_700Bold', color: C.saffron, textTransform: 'uppercase' },
  cardName: { fontSize: 13, fontFamily: 'Poppins_600SemiBold', color: C.textPrimary, lineHeight: 18 },
  cardNameOr: { fontSize: 13, fontFamily: 'Poppins_400Regular', color: C.textSecondary, marginTop: 2 },
  cardNameMissing: { fontSize: 12, fontFamily: 'Poppins_400Regular', color: C.textMuted, fontStyle: 'italic', marginTop: 2 },
  editBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },

  modal: { flex: 1, backgroundColor: '#FFFDF9' },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  modalTitle: { fontSize: 20, fontFamily: 'Poppins_700Bold', color: C.textPrimary },
  modalSubtitle: { fontSize: 12, fontFamily: 'Poppins_600SemiBold', color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  closeBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: C.cream, alignItems: 'center', justifyContent: 'center' },
  modalContent: { padding: 20, paddingBottom: 48 },

  readonlyField: {
    backgroundColor: '#F3F4F6', borderRadius: 12, borderWidth: 1, borderColor: C.border,
    paddingHorizontal: 14, paddingVertical: 12, marginBottom: 20,
  },
  readonlyText: { fontSize: 14, fontFamily: 'Poppins_600SemiBold', color: C.textSecondary },
  fieldLabel: { fontSize: 13, fontFamily: 'Poppins_600SemiBold', color: C.textSecondary, marginBottom: 6 },
  input: {
    borderWidth: 1.5, borderColor: C.border, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 11,
    fontSize: 15, fontFamily: 'Poppins_400Regular', color: C.textPrimary,
    backgroundColor: '#fff', marginBottom: 10,
  },
  saveBtn: {
    backgroundColor: C.saffron, borderRadius: 14,
    paddingVertical: 15, alignItems: 'center', justifyContent: 'center', marginTop: 12,
  },
  saveBtnDisabled: { opacity: 0.45 },
  saveBtnText: { fontSize: 16, fontFamily: 'Poppins_600SemiBold', color: '#fff' },

  sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 40, maxHeight: '50%' },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#E5E7EB', alignSelf: 'center', marginTop: 12, marginBottom: 4 },
  sheetTitle: { fontSize: 16, fontFamily: 'Poppins_700Bold', color: C.textPrimary, textAlign: 'center', paddingVertical: 12 },
  sheetItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 24, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  sheetItemText: { fontSize: 15, fontFamily: 'Poppins_400Regular', color: C.textPrimary },
  sheetItemTextActive: { fontFamily: 'Poppins_600SemiBold', color: C.saffron },
});
