import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Image,
  ActivityIndicator,
  RefreshControl,
  Platform,
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
  Eye,
  EyeOff,
  X,
  Image as ImageIcon,
  ChevronUp,
  ChevronDown,
  Upload,
  Link,
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
};

interface EventImage {
  id: string;
  title: string;
  title_or: string | null;
  subtitle: string | null;
  subtitle_or: string | null;
  image_url: string;
  display_order: number;
  is_active: boolean;
  created_at: string;
}

export default function AdminEventImages() {
  const { user } = useAuth();
  const router = useRouter();
  const [images, setImages] = useState<EventImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<EventImage | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewError, setPreviewError] = useState(false);

  const [form, setForm] = useState({ title: '', title_or: '', subtitle: '', subtitle_or: '', image_url: '' });
  const [uploading, setUploading] = useState(false);

  async function pickAndUploadImage() {
    if (Platform.OS !== 'web') return;
    return new Promise<void>((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/jpeg,image/png,image/webp';
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) { resolve(); return; }
        setUploading(true);
        const ext = file.name.split('.').pop() || 'jpg';
        const path = `event-images/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error } = await supabase.storage
          .from('profile-photos')
          .upload(path, file, { upsert: true, contentType: file.type });
        if (!error) {
          const { data } = supabase.storage.from('profile-photos').getPublicUrl(path);
          setForm((f) => ({ ...f, image_url: data.publicUrl }));
          setPreviewUrl(data.publicUrl);
          setPreviewError(false);
        }
        setUploading(false);
        resolve();
      };
      input.click();
    });
  }

  useEffect(() => {
    fetchImages();
  }, []);

  async function fetchImages(isRefresh = false) {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    const { data } = await supabase
      .from('event_images')
      .select('*')
      .order('display_order', { ascending: true });
    setImages(data || []);
    if (isRefresh) setRefreshing(false);
    else setLoading(false);
  }

  function openAdd() {
    setEditing(null);
    setForm({ title: '', title_or: '', subtitle: '', subtitle_or: '', image_url: '' });
    setPreviewUrl('');
    setPreviewError(false);
    setModalVisible(true);
  }

  function openEdit(img: EventImage) {
    setEditing(img);
    setForm({ title: img.title, title_or: img.title_or || '', subtitle: img.subtitle || '', subtitle_or: img.subtitle_or || '', image_url: img.image_url });
    setPreviewUrl(img.image_url);
    setPreviewError(false);
    setModalVisible(true);
  }

  async function save() {
    if (!form.title.trim()) return;
    if (!form.image_url.trim()) return;
    setSaving(true);

    if (editing) {
      await supabase
        .from('event_images')
        .update({
          title: form.title.trim(),
          title_or: form.title_or.trim() || null,
          subtitle: form.subtitle.trim() || null,
          subtitle_or: form.subtitle_or.trim() || null,
          image_url: form.image_url.trim(),
        })
        .eq('id', editing.id);
    } else {
      const maxOrder = images.length > 0 ? Math.max(...images.map((i) => i.display_order)) + 1 : 0;
      await supabase.from('event_images').insert({
        title: form.title.trim(),
        title_or: form.title_or.trim() || null,
        subtitle: form.subtitle.trim() || null,
        subtitle_or: form.subtitle_or.trim() || null,
        image_url: form.image_url.trim(),
        display_order: maxOrder,
        is_active: true,
        created_by: user!.id,
      });
    }

    setSaving(false);
    setModalVisible(false);
    fetchImages();
  }

  async function toggleActive(img: EventImage) {
    await supabase.from('event_images').update({ is_active: !img.is_active }).eq('id', img.id);
    setImages((prev) => prev.map((i) => (i.id === img.id ? { ...i, is_active: !i.is_active } : i)));
  }

  async function deleteImage(id: string) {
    setDeleting(id);
    await supabase.from('event_images').delete().eq('id', id);
    setImages((prev) => prev.filter((i) => i.id !== id));
    setDeleting(null);
  }

  async function moveOrder(img: EventImage, direction: 'up' | 'down') {
    const sorted = [...images].sort((a, b) => a.display_order - b.display_order);
    const idx = sorted.findIndex((i) => i.id === img.id);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;

    const a = sorted[idx];
    const b = sorted[swapIdx];
    const aOrder = a.display_order;
    const bOrder = b.display_order;

    await Promise.all([
      supabase.from('event_images').update({ display_order: bOrder }).eq('id', a.id),
      supabase.from('event_images').update({ display_order: aOrder }).eq('id', b.id),
    ]);

    setImages((prev) =>
      prev.map((i) => {
        if (i.id === a.id) return { ...i, display_order: bOrder };
        if (i.id === b.id) return { ...i, display_order: aOrder };
        return i;
      })
    );
  }

  const sorted = [...images].sort((a, b) => a.display_order - b.display_order);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <ArrowLeft color={C.textPrimary} size={22} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerSub}>Admin</Text>
          <Text style={styles.headerTitle}>Event Images</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={openAdd} activeOpacity={0.8}>
          <Plus color="#fff" size={20} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingCenter}>
          <ActivityIndicator color={C.saffron} size="large" />
        </View>
      ) : (
        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => fetchImages(true)} tintColor={C.saffron} />
          }
        >
          {sorted.length === 0 ? (
            <View style={styles.emptyState}>
              <ImageIcon color={C.textMuted} size={48} />
              <Text style={styles.emptyTitle}>No event images yet</Text>
              <Text style={styles.emptyDesc}>Tap the + button to add your first carousel slide</Text>
            </View>
          ) : (
            sorted.map((img, idx) => (
              <View key={img.id} style={[styles.card, !img.is_active && styles.cardInactive]}>
                <Image
                  source={{ uri: img.image_url }}
                  style={styles.thumb}
                  resizeMode="cover"
                />
                <View style={styles.cardBody}>
                  <View style={styles.cardTop}>
                    <Text style={styles.cardTitle} numberOfLines={1}>{img.title}</Text>
                    {!img.is_active && (
                      <View style={styles.hiddenBadge}>
                        <Text style={styles.hiddenBadgeText}>Hidden</Text>
                      </View>
                    )}
                  </View>
                  {img.subtitle ? (
                    <Text style={styles.cardSub} numberOfLines={1}>{img.subtitle}</Text>
                  ) : null}
                  <View style={styles.cardActions}>
                    <TouchableOpacity
                      style={styles.iconBtn}
                      onPress={() => moveOrder(img, 'up')}
                      disabled={idx === 0}
                      activeOpacity={0.7}
                    >
                      <ChevronUp color={idx === 0 ? C.border : C.textMuted} size={18} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.iconBtn}
                      onPress={() => moveOrder(img, 'down')}
                      disabled={idx === sorted.length - 1}
                      activeOpacity={0.7}
                    >
                      <ChevronDown color={idx === sorted.length - 1 ? C.border : C.textMuted} size={18} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.iconBtn} onPress={() => toggleActive(img)} activeOpacity={0.7}>
                      {img.is_active
                        ? <Eye color={C.success} size={18} />
                        : <EyeOff color={C.textMuted} size={18} />}
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.iconBtn} onPress={() => openEdit(img)} activeOpacity={0.7}>
                      <Pencil color={C.saffron} size={18} />
                    </TouchableOpacity>
                    {deleting === img.id ? (
                      <ActivityIndicator color={C.error} size="small" style={styles.iconBtn} />
                    ) : (
                      <TouchableOpacity style={styles.iconBtn} onPress={() => deleteImage(img.id)} activeOpacity={0.7}>
                        <Trash2 color={C.error} size={18} />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </View>
            ))
          )}
          <View style={{ height: 32 }} />
        </ScrollView>
      )}

      {/* Add / Edit Modal */}
      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{editing ? 'Edit Image' : 'Add Image'}</Text>
            <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeBtn}>
              <X color={C.textPrimary} size={22} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalContent}>
            {/* Image preview */}
            <View style={styles.previewWrap}>
              {previewUrl && !previewError ? (
                <Image
                  source={{ uri: previewUrl }}
                  style={styles.preview}
                  resizeMode="cover"
                  onError={() => setPreviewError(true)}
                />
              ) : (
                <View style={styles.previewPlaceholder}>
                  <ImageIcon color={C.textMuted} size={36} />
                  <Text style={styles.previewPlaceholderText}>
                    {previewError ? 'Could not load image' : 'Enter URL below to preview'}
                  </Text>
                </View>
              )}
            </View>

            <Text style={styles.fieldLabel}>Image *</Text>
            <TouchableOpacity
              style={styles.uploadBtn}
              onPress={pickAndUploadImage}
              activeOpacity={0.8}
              disabled={uploading}
            >
              {uploading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Upload color="#fff" size={16} strokeWidth={2} />
                  <Text style={styles.uploadBtnText}>
                    {form.image_url ? 'Replace Image' : 'Upload Image'}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <View style={styles.orRow}>
              <View style={styles.orLine} />
              <Text style={styles.orText}>or paste URL</Text>
              <View style={styles.orLine} />
            </View>

            <View style={styles.urlInputRow}>
              <Link color={C.textMuted} size={15} style={{ flexShrink: 0 }} />
              <TextInput
                style={styles.urlInput}
                value={form.image_url}
                onChangeText={(v) => {
                  setForm((f) => ({ ...f, image_url: v }));
                  setPreviewError(false);
                  setPreviewUrl(v);
                }}
                placeholder="https://..."
                placeholderTextColor={C.textMuted}
                autoCapitalize="none"
                keyboardType="url"
              />
            </View>

            <Text style={styles.fieldLabel}>Title *</Text>
            <TextInput
              style={styles.input}
              value={form.title}
              onChangeText={(v) => setForm((f) => ({ ...f, title: v }))}
              placeholder="e.g. Rath Yatra 2026"
              placeholderTextColor={C.textMuted}
            />
            <Text style={styles.fieldLabel}>Title (ଓଡ଼ିଆ)</Text>
            <TextInput
              style={styles.input}
              value={form.title_or}
              onChangeText={(v) => setForm((f) => ({ ...f, title_or: v }))}
              placeholder="ଯଥା: ରଥ ଯାତ୍ରା ୨୦୨୬"
              placeholderTextColor={C.textMuted}
            />

            <Text style={styles.fieldLabel}>Subtitle (optional)</Text>
            <TextInput
              style={styles.input}
              value={form.subtitle}
              onChangeText={(v) => setForm((f) => ({ ...f, subtitle: v }))}
              placeholder="e.g. Join us for the grand procession"
              placeholderTextColor={C.textMuted}
            />
            <Text style={styles.fieldLabel}>Subtitle (ଓଡ଼ିଆ)</Text>
            <TextInput
              style={styles.input}
              value={form.subtitle_or}
              onChangeText={(v) => setForm((f) => ({ ...f, subtitle_or: v }))}
              placeholder="ଯଥା: ମହା ଶୋଭାଯାତ୍ରା"
              placeholderTextColor={C.textMuted}
            />

            <TouchableOpacity
              style={[styles.saveBtn, (!form.title.trim() || !form.image_url.trim() || saving) && styles.saveBtnDisabled]}
              onPress={save}
              disabled={!form.title.trim() || !form.image_url.trim() || saving}
              activeOpacity={0.85}
            >
              {saving ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.saveBtnText}>{editing ? 'Save Changes' : 'Add Image'}</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.warmWhite },
  loadingCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    gap: 12,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: C.cream,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: { flex: 1 },
  headerSub: { fontSize: 11, fontFamily: 'Poppins_400Regular', color: C.gold, fontStyle: 'italic' },
  headerTitle: { fontSize: 20, fontFamily: 'Poppins_700Bold', color: C.textPrimary },
  addBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: C.saffron,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: { flex: 1 },
  listContent: { padding: 16 },
  emptyState: { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyTitle: { fontSize: 17, fontFamily: 'Poppins_600SemiBold', color: C.textSecondary },
  emptyDesc: { fontSize: 13, fontFamily: 'Poppins_400Regular', color: C.textMuted, textAlign: 'center', paddingHorizontal: 32 },
  card: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 12,
    overflow: 'hidden',
  },
  cardInactive: { opacity: 0.6 },
  thumb: { width: 96, height: 96 },
  cardBody: { flex: 1, padding: 12, justifyContent: 'space-between' },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { fontSize: 14, fontFamily: 'Poppins_600SemiBold', color: C.textPrimary, flex: 1 },
  cardSub: { fontSize: 12, fontFamily: 'Poppins_400Regular', color: C.textMuted },
  hiddenBadge: {
    backgroundColor: '#F5F0EC',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  hiddenBadgeText: { fontSize: 10, fontFamily: 'Poppins_600SemiBold', color: C.textMuted },
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  iconBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
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
  modalTitle: { fontSize: 20, fontFamily: 'Poppins_700Bold', color: C.textPrimary },
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
  previewWrap: { marginBottom: 20, borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: C.border },
  preview: { width: '100%', height: 180 },
  previewPlaceholder: {
    width: '100%',
    height: 180,
    backgroundColor: C.cream,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  previewPlaceholderText: { fontSize: 13, fontFamily: 'Poppins_400Regular', color: C.textMuted },
  fieldLabel: {
    fontSize: 13,
    fontFamily: 'Poppins_600SemiBold',
    color: C.textSecondary,
    marginBottom: 6,
    marginTop: 4,
  },
  input: {
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    fontFamily: 'Poppins_400Regular',
    color: C.textPrimary,
    backgroundColor: '#fff',
    marginBottom: 16,
  },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: C.saffron,
    borderRadius: 12,
    paddingVertical: 13,
    marginBottom: 12,
  },
  uploadBtnText: { fontSize: 14, fontFamily: 'Poppins_600SemiBold', color: '#fff' },
  orRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  orLine: { flex: 1, height: 1, backgroundColor: C.border },
  orText: { fontSize: 12, fontFamily: 'Poppins_400Regular', color: C.textMuted },
  urlInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 4,
    backgroundColor: '#fff',
    marginBottom: 16,
  },
  urlInput: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'Poppins_400Regular',
    color: C.textPrimary,
    paddingVertical: 8,
  },
  saveBtn: {
    backgroundColor: C.saffron,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  saveBtnDisabled: { opacity: 0.45 },
  saveBtnText: { fontSize: 16, fontFamily: 'Poppins_600SemiBold', color: '#fff' },
});
