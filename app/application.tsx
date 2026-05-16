import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  TextInput,
  Platform,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useOffline } from '@/contexts/OfflineContext';
import { OfflineGateModal } from '@/components/OfflineGateModal';
import { useDrawer, DrawerPanel, MenuButton } from '@/components/SlideDrawer';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatNumber } from '@/lib/i18n';
import { ArrowLeft, LayoutGrid, Plus, ChevronRight, ChevronLeft, Clock, CircleCheck as CheckCircle, Circle as XCircle, CircleAlert as AlertCircle, Search, FileText, Send, X, User, Star, Paperclip, Trash2, ExternalLink } from 'lucide-react-native';

const C = {
  red: '#B83030',
  redDark: '#8A2020',
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

type Screen = 'list' | 'detail' | 'new_step1' | 'new_step2' | 'new_step3' | 'new_confirm';

interface AppType {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  form_fields: FormField[];
  requires_documents: boolean;
  is_active: boolean;
}

interface UploadedFile {
  name: string;
  path: string;
  url: string;
  size: number;
}

interface FormField {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'date' | 'select' | 'checkbox';
  required: boolean;
  options?: string[];
}

interface Application {
  id: string;
  application_type_id: string;
  status: string;
  priority: string;
  title: string;
  description: string;
  metadata: Record<string, any>;
  attachments: UploadedFile[];
  admin_remarks: string | null;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
  application_types?: { name: string; icon: string; color: string };
}

interface AppComment {
  id: string;
  message: string;
  is_internal: boolean;
  created_at: string;
  author_role: string;
}

interface AppHistory {
  id: string;
  from_status: string | null;
  to_status: string;
  created_at: string;
  remarks: string | null;
}

const STATUS_META: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  pending:           { label: 'Pending',          color: '#B7770D', bg: '#FFF8E0', icon: Clock },
  under_review:      { label: 'Under Review',     color: '#1D6FAE', bg: '#EBF5FB', icon: Search },
  approved:          { label: 'Approved',          color: '#27AE60', bg: '#F0FFF4', icon: CheckCircle },
  rejected:          { label: 'Rejected',          color: '#C0392B', bg: '#FFF5F5', icon: XCircle },
  more_info_required:{ label: 'More Info Needed', color: '#8B5CF6', bg: '#F5F0FF', icon: AlertCircle },
};

function getStatusMeta(key: string) {
  return STATUS_META[key] ?? STATUS_META.pending;
}

function timeAgoLocalized(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function ApplicationScreen() {
  const drawer = useDrawer();
  const router = useRouter();
  const { user, profileStatus, profileStatusLoading } = useAuth();
  const { isOnline } = useOffline();
  const { t, language } = useLanguage();
  const isOdia = language === 'or';
  const odiaFont = isOdia ? { fontFamily: 'NotoSansOriya_400Regular' as const } : {};
  const odiaBoldFont = isOdia ? { fontFamily: 'NotoSansOriya_700Bold' as const } : {};

  function getStatusMeta(key: string) {
    const labels: Record<string, string> = isOdia ? {
      pending: t('application.statusPending'),
      under_review: t('application.statusUnderReview'),
      approved: t('application.statusApproved'),
      rejected: t('application.statusRejected'),
      more_info_required: t('application.statusMoreInfo'),
    } : {
      pending: 'Pending',
      under_review: 'Under Review',
      approved: 'Approved',
      rejected: 'Rejected',
      more_info_required: 'More Info Needed',
    };
    return {
      ...(STATUS_META[key] ?? STATUS_META.pending),
      label: labels[key] ?? (STATUS_META[key]?.label ?? STATUS_META.pending.label),
    };
  }

  function timeAgoLocalized(iso: string) {
    const diff = Date.now() - new Date(iso).getTime();
    const days = Math.floor(diff / 86400000);
    if (!isOdia) {
      if (days === 0) return 'Today';
      if (days === 1) return 'Yesterday';
      if (days < 7) return `${days} days ago`;
      return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    }
    if (days === 0) return t('application.timeToday');
    if (days === 1) return t('application.timeYesterday');
    if (days < 30) return t('application.timeDaysAgo', { count: days }).replace(String(days), formatNumber(days, 'or'));
    return new Date(iso).toLocaleDateString('or-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  if (!profileStatusLoading && profileStatus !== 'approved') {
    router.replace('/(tabs)');
    return null;
  }

  if (!isOnline) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <OfflineGateModal
          visible
          onClose={() => router.back()}
          title={t('application.offlineTitle')}
          message={t('application.offlineMessage')}
        />
      </SafeAreaView>
    );
  }

  const [screen, setScreen] = useState<Screen>('list');
  const [sebayatId, setSebayatId] = useState<string | null>(null);

  // List state
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Detail state
  const [selected, setSelected] = useState<Application | null>(null);
  const [comments, setComments] = useState<AppComment[]>([]);
  const [history, setHistory] = useState<AppHistory[]>([]);
  const [commentText, setCommentText] = useState('');
  const [posting, setPosting] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  // New application flow state
  const [appTypes, setAppTypes] = useState<AppType[]>([]);
  const [typesLoading, setTypesLoading] = useState(false);
  const [selectedType, setSelectedType] = useState<AppType | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [appTitle, setAppTitle] = useState('');
  const [appDescription, setAppDescription] = useState('');
  const [appPriority, setAppPriority] = useState<'normal' | 'urgent'>('normal');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Document upload state
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef<any>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('sebayats')
      .select('id')
      .eq('auth_user_id', user.id)
      .maybeSingle()
      .then(({ data }) => setSebayatId(data?.id ?? null));
  }, [user]);

  const fetchApplications = useCallback(async (isRefresh = false) => {
    if (!sebayatId) return;
    if (isRefresh) setRefreshing(true); else setLoading(true);

    const { data } = await supabase
      .from('applications')
      .select('id, application_type_id, status, priority, title, description, metadata, attachments, admin_remarks, submitted_at, created_at, updated_at, application_types(name, icon, color)')
      .eq('sebayat_id', sebayatId)
      .order('created_at', { ascending: false });

    if (isRefresh) setRefreshing(false); else setLoading(false);
    setApps((data as Application[]) ?? []);
  }, [sebayatId]);

  useEffect(() => {
    fetchApplications();
  }, [fetchApplications]);

  async function loadAppTypes() {
    setTypesLoading(true);
    const { data } = await supabase
      .from('application_types')
      .select('id, name, description, icon, color, form_fields, requires_documents, is_active')
      .eq('is_active', true)
      .order('name');
    setTypesLoading(false);
    setAppTypes((data as AppType[]) ?? []);
  }

  async function handleFileUpload(file: File) {
    if (!sebayatId) return;
    setUploading(true);
    setUploadError('');
    const ext = file.name.split('.').pop();
    const path = `${sebayatId}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const { error } = await supabase.storage
      .from('application-attachments')
      .upload(path, file, { contentType: file.type });
    if (error) {
      setUploadError(error.message || 'Upload failed');
      setUploading(false);
      return;
    }
    const { data: urlData } = supabase.storage.from('application-attachments').getPublicUrl(path);
    setUploadedFiles((prev) => [
      ...prev,
      { name: file.name, path, url: urlData.publicUrl, size: file.size },
    ]);
    setUploading(false);
  }

  function removeFile(path: string) {
    setUploadedFiles((prev) => prev.filter((f) => f.path !== path));
    supabase.storage.from('application-attachments').remove([path]);
  }

  async function openDetail(app: Application) {
    setSelected(app);
    setDetailLoading(true);
    setScreen('detail');

    const [commentsRes, historyRes] = await Promise.all([
      supabase
        .from('application_comments')
        .select('id, message, is_internal, created_at, author_role')
        .eq('application_id', app.id)
        .eq('is_internal', false)
        .order('created_at', { ascending: true }),
      supabase
        .from('application_status_history')
        .select('id, from_status, to_status, created_at, remarks')
        .eq('application_id', app.id)
        .order('created_at', { ascending: true }),
    ]);

    setComments((commentsRes.data as AppComment[]) ?? []);
    setHistory((historyRes.data as AppHistory[]) ?? []);
    setDetailLoading(false);
  }

  async function postComment() {
    if (!commentText.trim() || !selected || !sebayatId) return;
    setPosting(true);
    const { error } = await supabase.from('application_comments').insert({
      application_id: selected.id,
      author_role: 'sebayat',
      author_id: sebayatId,
      message: commentText.trim(),
      is_internal: false,
    });
    if (!error) {
      setCommentText('');
      const { data } = await supabase
        .from('application_comments')
        .select('id, message, is_internal, created_at, author_role')
        .eq('application_id', selected.id)
        .eq('is_internal', false)
        .order('created_at', { ascending: true });
      setComments((data as AppComment[]) ?? []);
    }
    setPosting(false);
  }

  function startNewApplication() {
    setSelectedType(null);
    setFormData({});
    setAppTitle('');
    setAppDescription('');
    setAppPriority('normal');
    setFormErrors({});
    setSubmitError('');
    setUploadedFiles([]);
    setUploadError('');
    loadAppTypes();
    setScreen('new_step1');
  }

  function selectType(type: AppType) {
    setSelectedType(type);
    setFormData({});
    setFormErrors({});
    setAppTitle('');
    setAppDescription('');
    setScreen('new_step2');
  }

  function validateStep2() {
    if (!appTitle.trim()) return { title: 'Title is required' };
    const errors: Record<string, string> = {};
    if (selectedType) {
      for (const field of selectedType.form_fields) {
        if (field.required && !formData[field.id]) {
          errors[field.id] = `${field.label} is required`;
        }
      }
    }
    return errors;
  }

  async function submitApplication() {
    if (!selectedType || !sebayatId) return;
    setSubmitting(true);
    setSubmitError('');

    const { error } = await supabase.from('applications').insert({
      sebayat_id: sebayatId,
      application_type_id: selectedType.id,
      title: appTitle.trim(),
      description: appDescription.trim(),
      priority: appPriority,
      metadata: formData,
      attachments: uploadedFiles.map((f) => ({ name: f.name, path: f.path, url: f.url, size: f.size })),
      status: 'pending',
      submitted_at: new Date().toISOString(),
    });

    setSubmitting(false);
    if (error) {
      setSubmitError(error.message || 'Failed to submit application');
    } else {
      fetchApplications();
      setScreen('list');
    }
  }

  const filteredApps = filterStatus === 'all' ? apps : apps.filter((a) => a.status === filterStatus);

  // ── SCREENS ──────────────────────────────────────────────────────────────

  if (screen === 'new_step1') {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <LinearGradient colors={['#B83030', '#8A2020']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.header}>
          <TouchableOpacity onPress={() => setScreen('list')} style={styles.backBtn} activeOpacity={0.7}>
            <X color="#fff" size={22} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>{t('application.newApplication')}</Text>
          </View>
          <View style={styles.stepBadge}><Text style={styles.stepText}>1 / 3</Text></View>
        </LinearGradient>

        <View style={styles.stepHeader}>
          <Text style={styles.stepTitle}>{t('application.selectType')}</Text>
          <Text style={styles.stepSubtitle}>{t('application.selectTypeDesc')}</Text>
        </View>

        {typesLoading ? (
          <View style={styles.center}><ActivityIndicator color={C.saffron} size="large" /></View>
        ) : appTypes.length === 0 ? (
          <View style={styles.center}>
            <View style={styles.emptyIcon}><LayoutGrid color={C.gold} size={36} /></View>
            <Text style={styles.emptyTitle}>{t('application.noAppTypes')}</Text>
            <Text style={styles.emptySub}>{t('application.noAppTypesDesc')}</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.typeList} showsVerticalScrollIndicator={false}>
            {appTypes.map((type) => (
              <TouchableOpacity
                key={type.id}
                style={styles.typeCard}
                onPress={() => selectType(type)}
                activeOpacity={0.85}
              >
                <View style={[styles.typeIconBox, { backgroundColor: type.color + '20' }]}>
                  <Text style={[styles.typeIconText, { color: type.color }]}>{type.icon}</Text>
                </View>
                <View style={styles.typeCardBody}>
                  <Text style={styles.typeCardName}>{type.name}</Text>
                  {!!type.description && (
                    <Text style={styles.typeCardDesc} numberOfLines={2}>{type.description}</Text>
                  )}
                </View>
                <ChevronRight color={C.textMuted} size={18} />
              </TouchableOpacity>
            ))}
            <View style={{ height: 32 }} />
          </ScrollView>
        )}
      </SafeAreaView>
    );
  }

  if (screen === 'new_step2' && selectedType) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <LinearGradient colors={['#B83030', '#8A2020']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.header}>
          <TouchableOpacity onPress={() => setScreen('new_step1')} style={styles.backBtn} activeOpacity={0.7}>
            <ChevronLeft color="#fff" size={22} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>{t('application.fillApplication')}</Text>
          </View>
          <View style={styles.stepBadge}><Text style={styles.stepText}>2 / 3</Text></View>
        </LinearGradient>

        <ScrollView contentContainerStyle={styles.formScroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={[styles.typePillRow, { backgroundColor: selectedType.color + '15' }]}>
            <Text style={[styles.typePillIcon, { color: selectedType.color }]}>{selectedType.icon}</Text>
            <Text style={[styles.typePillName, { color: selectedType.color }]}>{selectedType.name}</Text>
          </View>

          <Text style={styles.fieldLabel}>{t('application.appTitle')} <Text style={styles.required}>*</Text></Text>
          <TextInput
            style={[styles.input, !!formErrors.title && styles.inputError]}
            placeholder={t('application.appTitlePlaceholder')}
            placeholderTextColor={C.textMuted}
            value={appTitle}
            onChangeText={setAppTitle}
          />
          {!!formErrors.title && <Text style={styles.fieldError}>{formErrors.title}</Text>}

          <Text style={styles.fieldLabel}>{t('application.description')}</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            placeholder={t('application.descriptionPlaceholder')}
            placeholderTextColor={C.textMuted}
            value={appDescription}
            onChangeText={setAppDescription}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />

          {selectedType.form_fields.map((field) => (
            <View key={field.id}>
              <Text style={styles.fieldLabel}>
                {field.label}{field.required && <Text style={styles.required}> *</Text>}
              </Text>
              {field.type === 'textarea' ? (
                <TextInput
                  style={[styles.input, styles.textarea, !!formErrors[field.id] && styles.inputError]}
                  placeholder={`Enter ${field.label.toLowerCase()}`}
                  placeholderTextColor={C.textMuted}
                  value={formData[field.id] ?? ''}
                  onChangeText={(v) => setFormData((p) => ({ ...p, [field.id]: v }))}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              ) : field.type === 'select' ? (
                <View style={styles.selectRow}>
                  {(field.options ?? []).map((opt) => (
                    <TouchableOpacity
                      key={opt}
                      style={[styles.selectOption, formData[field.id] === opt && styles.selectOptionActive]}
                      onPress={() => setFormData((p) => ({ ...p, [field.id]: opt }))}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.selectOptionText, formData[field.id] === opt && styles.selectOptionTextActive]}>
                        {opt}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : field.type === 'checkbox' ? (
                <TouchableOpacity
                  style={styles.checkboxRow}
                  onPress={() => setFormData((p) => ({ ...p, [field.id]: !p[field.id] }))}
                  activeOpacity={0.7}
                >
                  <View style={[styles.checkbox, !!formData[field.id] && styles.checkboxChecked]}>
                    {!!formData[field.id] && <CheckCircle color="#fff" size={14} />}
                  </View>
                  <Text style={styles.checkboxLabel}>{field.label}</Text>
                </TouchableOpacity>
              ) : (
                <TextInput
                  style={[styles.input, !!formErrors[field.id] && styles.inputError]}
                  placeholder={`Enter ${field.label.toLowerCase()}`}
                  placeholderTextColor={C.textMuted}
                  value={formData[field.id] ?? ''}
                  onChangeText={(v) => setFormData((p) => ({ ...p, [field.id]: v }))}
                  keyboardType={field.type === 'number' ? 'numeric' : 'default'}
                />
              )}
              {!!formErrors[field.id] && <Text style={styles.fieldError}>{formErrors[field.id]}</Text>}
            </View>
          ))}

          <Text style={styles.fieldLabel}>{t('application.priority')}</Text>
          <View style={styles.priorityRow}>
            <TouchableOpacity
              style={[styles.priorityBtn, appPriority === 'normal' && styles.priorityBtnActive]}
              onPress={() => setAppPriority('normal')}
              activeOpacity={0.7}
            >
              <Text style={[styles.priorityBtnText, appPriority === 'normal' && styles.priorityBtnTextActive]}>{t('application.normal')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.priorityBtn, appPriority === 'urgent' && styles.priorityBtnUrgent]}
              onPress={() => setAppPriority('urgent')}
              activeOpacity={0.7}
            >
              <Star color={appPriority === 'urgent' ? '#fff' : C.textMuted} size={13} />
              <Text style={[styles.priorityBtnText, appPriority === 'urgent' && { color: '#fff' }]}>{t('application.urgent')}</Text>
            </TouchableOpacity>
          </View>

          {/* Document upload – shown when type requires documents */}
          {selectedType.requires_documents && (
            <View style={styles.uploadSection}>
              <View style={styles.uploadHeader}>
                <Paperclip color={C.saffron} size={16} />
                <Text style={styles.uploadTitle}>{t('application.supportingDocs')}</Text>
                <Text style={styles.uploadRequired}>*</Text>
              </View>
              <Text style={styles.uploadHint}>{t('application.uploadHint')}</Text>

              {uploadedFiles.map((f) => (
                <View key={f.path} style={styles.fileRow}>
                  <FileText color={C.saffron} size={16} />
                  <Text style={styles.fileName} numberOfLines={1}>{f.name}</Text>
                  <Text style={styles.fileSize}>{(f.size / 1024).toFixed(0)} KB</Text>
                  <TouchableOpacity onPress={() => removeFile(f.path)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Trash2 color={C.error} size={15} />
                  </TouchableOpacity>
                </View>
              ))}

              {!!uploadError && <Text style={styles.fieldError}>{uploadError}</Text>}

              {Platform.OS === 'web' ? (
                <View>
                  {/* Hidden native file input for web */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx"
                    style={{ display: 'none' }}
                    onChange={async (e) => {
                      const files = Array.from(e.target.files || []);
                      for (const file of files) {
                        await handleFileUpload(file);
                      }
                      e.target.value = '';
                    }}
                  />
                  <TouchableOpacity
                    style={[styles.uploadBtn, uploading && styles.uploadBtnDisabled]}
                    onPress={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    activeOpacity={0.8}
                  >
                    {uploading ? (
                      <ActivityIndicator color={C.saffron} size="small" />
                    ) : (
                      <Paperclip color={C.saffron} size={16} />
                    )}
                    <Text style={styles.uploadBtnText}>
                      {uploading ? t('application.uploading') : t('application.chooseFiles')}
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.uploadNativeNote}>
                  <Text style={styles.uploadNativeNoteText}>{t('application.fileUploadWebOnly')}</Text>
                </View>
              )}
            </View>
          )}

          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => {
              const errors = validateStep2();
              if (Object.keys(errors).length > 0) { setFormErrors(errors); return; }
              if (selectedType.requires_documents && uploadedFiles.length === 0) {
                setUploadError(t('application.uploadAtLeastOne'));
                return;
              }
              setFormErrors({});
              setUploadError('');
              setScreen('new_confirm');
            }}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryBtnText}>{t('application.reviewSubmit')}</Text>
            <ChevronRight color="#fff" size={18} />
          </TouchableOpacity>
          <View style={{ height: 32 }} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (screen === 'new_confirm' && selectedType) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <LinearGradient colors={['#B83030', '#8A2020']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.header}>
          <TouchableOpacity onPress={() => setScreen('new_step2')} style={styles.backBtn} activeOpacity={0.7}>
            <ChevronLeft color="#fff" size={22} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>{t('application.reviewSubmit')}</Text>
          </View>
          <View style={styles.stepBadge}><Text style={styles.stepText}>3 / 3</Text></View>
        </LinearGradient>

        <ScrollView contentContainerStyle={styles.formScroll} showsVerticalScrollIndicator={false}>
          <View style={styles.confirmSection}>
            <Text style={styles.confirmSectionLabel}>{t('application.applicationType')}</Text>
            <View style={[styles.typePillRow, { backgroundColor: selectedType.color + '15' }]}>
              <Text style={[styles.typePillIcon, { color: selectedType.color }]}>{selectedType.icon}</Text>
              <Text style={[styles.typePillName, { color: selectedType.color }]}>{selectedType.name}</Text>
            </View>
          </View>

          <View style={styles.confirmSection}>
            <Text style={styles.confirmSectionLabel}>{t('application.titleLabel')}</Text>
            <Text style={styles.confirmValue}>{appTitle}</Text>
          </View>

          {!!appDescription && (
            <View style={styles.confirmSection}>
              <Text style={styles.confirmSectionLabel}>{t('application.descriptionLabel')}</Text>
              <Text style={styles.confirmValue}>{appDescription}</Text>
            </View>
          )}

          {selectedType.form_fields.filter((f) => formData[f.id] !== undefined && formData[f.id] !== '').map((field) => (
            <View key={field.id} style={styles.confirmSection}>
              <Text style={styles.confirmSectionLabel}>{field.label}</Text>
              <Text style={styles.confirmValue}>
                {field.type === 'checkbox' ? (formData[field.id] ? 'Yes' : 'No') : String(formData[field.id])}
              </Text>
            </View>
          ))}

          <View style={styles.confirmSection}>
            <Text style={styles.confirmSectionLabel}>{t('application.priorityLabel')}</Text>
            <View style={[styles.priorityChip, appPriority === 'urgent' && styles.priorityChipUrgent]}>
              <Text style={[styles.priorityChipText, appPriority === 'urgent' && { color: '#C0392B' }]}>
                {appPriority === 'urgent' ? t('application.urgent') : t('application.normal')}
              </Text>
            </View>
          </View>

          {uploadedFiles.length > 0 && (
            <View style={styles.confirmSection}>
              <Text style={styles.confirmSectionLabel}>{t('application.documentsLabel')} ({uploadedFiles.length})</Text>
              {uploadedFiles.map((f) => (
                <View key={f.path} style={styles.fileRow}>
                  <FileText color={C.saffron} size={15} />
                  <Text style={styles.fileName} numberOfLines={1}>{f.name}</Text>
                  <Text style={styles.fileSize}>{(f.size / 1024).toFixed(0)} KB</Text>
                </View>
              ))}
            </View>
          )}

          {!!submitError && (
            <View style={styles.errorBanner}>
              <AlertCircle color={C.error} size={16} />
              <Text style={styles.errorBannerText}>{submitError}</Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.primaryBtn, submitting && styles.primaryBtnDisabled]}
            onPress={submitApplication}
            disabled={submitting}
            activeOpacity={0.85}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Send color="#fff" size={17} />
                <Text style={styles.primaryBtnText}>{t('application.submitApplication')}</Text>
              </>
            )}
          </TouchableOpacity>
          <View style={{ height: 32 }} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (screen === 'detail' && selected) {
    const st = getStatusMeta(selected.status);
    const StIcon = st.icon;

    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <LinearGradient colors={['#B83030', '#8A2020']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.header}>
          <TouchableOpacity onPress={() => setScreen('list')} style={styles.backBtn} activeOpacity={0.7}>
            <ArrowLeft color="#fff" size={22} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={[styles.headerTitle, odiaFont]} numberOfLines={1}>{selected.title}</Text>
          </View>
        </LinearGradient>

        {detailLoading ? (
          <View style={styles.center}><ActivityIndicator color={C.saffron} size="large" /></View>
        ) : (
          <ScrollView contentContainerStyle={styles.detailScroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* Status card */}
            <View style={[styles.statusCard, { backgroundColor: st.bg, borderColor: st.color + '40' }]}>
              <StIcon color={st.color} size={22} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.statusCardLabel, { color: st.color }, odiaFont]}>{st.label}</Text>
                <Text style={[styles.statusCardDate, odiaFont]}>{timeAgoLocalized(selected.updated_at)}</Text>
              </View>
              {selected.priority === 'urgent' && (
                <View style={styles.urgentChip}>
                  <Star color="#C0392B" size={11} />
                  <Text style={styles.urgentChipText}>{t('application.urgentLabel')}</Text>
                </View>
              )}
            </View>

            {/* Type + meta */}
            {selected.application_types && (
              <View style={[styles.typePillRow, { backgroundColor: (selected.application_types.color || C.saffron) + '15', marginHorizontal: 16, marginBottom: 12 }]}>
                <Text style={[styles.typePillIcon, { color: selected.application_types.color || C.saffron }]}>
                  {selected.application_types.icon}
                </Text>
                <Text style={[styles.typePillName, { color: selected.application_types.color || C.saffron }, odiaFont]}>
                  {selected.application_types.name}
                </Text>
              </View>
            )}

            {/* Description */}
            {!!selected.description && (
              <View style={styles.detailSection}>
                <Text style={[styles.detailSectionTitle, odiaFont]}>{t('application.descriptionLabel')}</Text>
                <Text style={[styles.detailBody, odiaFont]}>{selected.description}</Text>
              </View>
            )}

            {/* Form data */}
            {Object.keys(selected.metadata || {}).length > 0 && (
              <View style={styles.detailSection}>
                <Text style={[styles.detailSectionTitle, odiaFont]}>{t('application.appDetails')}</Text>
                {Object.entries(selected.metadata).map(([key, value]) => (
                  <View key={key} style={styles.formDataRow}>
                    <Text style={[styles.formDataKey, odiaFont]}>{key}</Text>
                    <Text style={[styles.formDataValue, odiaFont]}>{String(value)}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Attachments */}
            {(selected.attachments || []).length > 0 && (
              <View style={styles.detailSection}>
                <Text style={[styles.detailSectionTitle, odiaFont]}>{t('application.documents')}</Text>
                {(selected.attachments || []).map((f, i) => (
                  <TouchableOpacity
                    key={i}
                    style={styles.attachmentRow}
                    onPress={async () => {
                      if (f.path) {
                        const { data } = await supabase.storage
                          .from('application-attachments')
                          .createSignedUrl(f.path, 3600);
                        if (data?.signedUrl) { Linking.openURL(data.signedUrl); return; }
                      }
                      if (f.url) Linking.openURL(f.url);
                    }}
                    activeOpacity={0.7}
                  >
                    <FileText color={C.saffron} size={16} />
                    <Text style={styles.attachmentName} numberOfLines={1}>{f.name}</Text>
                    <Text style={styles.attachmentSize}>{(f.size / 1024).toFixed(0)} KB</Text>
                    <ExternalLink color={C.textMuted} size={14} />
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Admin remarks */}
            {!!selected.admin_remarks && (
              <View style={[styles.detailSection, styles.remarksSection]}>
                <Text style={[styles.detailSectionTitle, odiaFont]}>{t('application.adminRemarks')}</Text>
                <Text style={[styles.detailBody, odiaFont]}>{selected.admin_remarks}</Text>
              </View>
            )}

            {/* Status history */}
            {history.length > 0 && (
              <View style={styles.detailSection}>
                <Text style={[styles.detailSectionTitle, odiaFont]}>{t('application.statusHistory')}</Text>
                {history.map((h, i) => {
                  const s = getStatusMeta(h.to_status);
                  const SIcon = s.icon;
                  return (
                    <View key={h.id} style={styles.historyRow}>
                      <View style={styles.historyLine}>
                        <View style={[styles.historyDot, { backgroundColor: s.color }]}>
                          <SIcon color="#fff" size={10} />
                        </View>
                        {i < history.length - 1 && <View style={styles.historyConnector} />}
                      </View>
                      <View style={styles.historyContent}>
                        <Text style={[styles.historyStatus, { color: s.color }, odiaFont]}>{s.label}</Text>
                        <Text style={[styles.historyDate, odiaFont]}>{timeAgoLocalized(h.created_at)}</Text>
                        {!!h.remarks && <Text style={[styles.historyRemarks, odiaFont]}>{h.remarks}</Text>}
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            {/* Comments */}
            <View style={styles.detailSection}>
              <Text style={[styles.detailSectionTitle, odiaFont]}>
                {t('application.comments')}{comments.length > 0 ? ` (${isOdia ? formatNumber(comments.length, 'or') : comments.length})` : ''}
              </Text>
              {comments.length === 0 ? (
                <Text style={[styles.noComments, odiaFont]}>{t('application.noComments')}</Text>
              ) : (
                comments.map((c) => (
                  <View key={c.id} style={[styles.commentBubble, c.author_role === 'sebayat' ? styles.commentSelf : styles.commentAdmin]}>
                    <View style={styles.commentHeader}>
                      {c.author_role === 'admin' ? (
                        <View style={styles.commentAuthorBadge}>
                          <User color={C.red} size={11} />
                          <Text style={[styles.commentAuthor, { color: C.red }, odiaFont]}>{t('application.admin')}</Text>
                        </View>
                      ) : (
                        <View style={styles.commentAuthorBadge}>
                          <User color={C.textMuted} size={11} />
                          <Text style={[styles.commentAuthor, odiaFont]}>{t('application.you')}</Text>
                        </View>
                      )}
                      <Text style={[styles.commentDate, odiaFont]}>{timeAgoLocalized(c.created_at)}</Text>
                    </View>
                    <Text style={[styles.commentText, odiaFont]}>{c.message}</Text>
                  </View>
                ))
              )}

              {/* Comment input */}
              <View style={styles.commentInputRow}>
                <TextInput
                  style={styles.commentInput}
                  placeholder={t('application.writeMessage')}
                  placeholderTextColor={C.textMuted}
                  value={commentText}
                  onChangeText={setCommentText}
                  multiline
                />
                <TouchableOpacity
                  style={[styles.commentSendBtn, (!commentText.trim() || posting) && styles.commentSendBtnDisabled]}
                  onPress={postComment}
                  disabled={!commentText.trim() || posting}
                  activeOpacity={0.85}
                >
                  {posting ? <ActivityIndicator color="#fff" size="small" /> : <Send color="#fff" size={16} />}
                </TouchableOpacity>
              </View>
            </View>

            <View style={{ height: 32 }} />
          </ScrollView>
        )}
      </SafeAreaView>
    );
  }

  // ── LIST (default) ────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <LinearGradient colors={['#B83030', '#8A2020']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <ArrowLeft color="#fff" size={22} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <LayoutGrid color="rgba(255,255,255,0.85)" size={20} />
          <Text style={styles.headerTitle}>{t('application.title')}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TouchableOpacity style={styles.newBtn} onPress={startNewApplication} activeOpacity={0.8}>
            <Plus color="#fff" size={20} />
          </TouchableOpacity>
          <MenuButton onPress={drawer.open} />
        </View>
      </LinearGradient>

      <View style={styles.contentWrapper}>
      {/* Status filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterContent}
      >
        <TouchableOpacity
          style={[styles.filterChip, filterStatus === 'all' && styles.filterChipActive]}
          onPress={() => setFilterStatus('all')}
          activeOpacity={0.7}
        >
          <Text style={[styles.filterChipText, filterStatus === 'all' && styles.filterChipTextActive, odiaFont]}>{t('application.all')}</Text>
        </TouchableOpacity>
        {Object.entries(STATUS_META).map(([key, meta]) => {
          const active = filterStatus === key;
          return (
            <TouchableOpacity
              key={key}
              style={[styles.filterChip, active && { backgroundColor: meta.bg, borderColor: meta.color }]}
              onPress={() => setFilterStatus(key)}
              activeOpacity={0.7}
            >
              <Text style={[styles.filterChipText, active && { color: meta.color }, odiaFont]}>{meta.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {!sebayatId && !loading ? (
        <View style={styles.center}>
          <Text style={styles.emptySub}>{t('application.noProfile')}</Text>
        </View>
      ) : loading ? (
        <View style={styles.center}><ActivityIndicator color={C.saffron} size="large" /></View>
      ) : filteredApps.length === 0 ? (
        <View style={styles.center}>
          <View style={styles.emptyIcon}><FileText color={C.gold} size={36} /></View>
          <Text style={styles.emptyTitle}>{t('application.noApplications')}</Text>
          <Text style={styles.emptySub}>
            {filterStatus === 'all'
              ? t('application.noApplicationsDesc')
              : `${t('application.all')} — ${STATUS_META[filterStatus]?.label?.toLowerCase()}`}
          </Text>
          {filterStatus === 'all' && (
            <TouchableOpacity style={styles.emptyNewBtn} onPress={startNewApplication} activeOpacity={0.85}>
              <Plus color="#fff" size={16} />
              <Text style={styles.emptyNewBtnText}>{t('application.newApplication')}</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={filteredApps}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const st = getStatusMeta(item.status);
            const StIcon = st.icon;
            return (
              <TouchableOpacity
                style={styles.appCard}
                onPress={() => openDetail(item)}
                activeOpacity={0.85}
              >
                <View style={styles.appCardTop}>
                  {item.application_types && (
                    <View style={[styles.appTypeChip, { backgroundColor: (item.application_types.color || C.saffron) + '18' }]}>
                      <Text style={{ fontSize: 12 }}>{item.application_types.icon}</Text>
                      <Text style={[styles.appTypeChipText, { color: item.application_types.color || C.saffron }]}>
                        {item.application_types.name}
                      </Text>
                    </View>
                  )}
                  <View style={[styles.statusBadge, { backgroundColor: st.bg }]}>
                    <StIcon color={st.color} size={11} />
                    <Text style={[styles.statusBadgeText, { color: st.color }, odiaFont]}>{st.label}</Text>
                  </View>
                </View>
                <Text style={[styles.appCardTitle, odiaFont]} numberOfLines={2}>{item.title}</Text>
                <View style={styles.appCardFooter}>
                  <Text style={[styles.appCardDate, odiaFont]}>{timeAgoLocalized(item.created_at)}</Text>
                  {item.priority === 'urgent' && (
                    <View style={styles.urgentChipSmall}>
                      <Star color="#C0392B" size={10} />
                      <Text style={styles.urgentChipSmallText}>{t('application.urgentLabel')}</Text>
                    </View>
                  )}
                  <ChevronRight color={C.textMuted} size={16} />
                </View>
              </TouchableOpacity>
            );
          }}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchApplications(true)}
              colors={[C.saffron]}
              tintColor={C.saffron}
            />
          }
        />
      )}
      </View>{/* end contentWrapper */}
      <DrawerPanel {...drawer} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.warmWhite },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: 12 },

  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 52, gap: 12 },
  contentWrapper: { backgroundColor: '#FFFDF9', borderTopLeftRadius: 32, borderTopRightRadius: 32, marginTop: -28, flex: 1 },
  backBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 18, fontFamily: 'Poppins_700Bold', color: '#fff', flex: 1 },
  newBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  stepBadge: { backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  stepText: { fontSize: 12, fontFamily: 'Poppins_600SemiBold', color: '#fff' },

  // Filter chips
  filterScroll: { maxHeight: 52 },
  filterContent: { paddingHorizontal: 16, paddingVertical: 10, gap: 8, flexDirection: 'row', alignItems: 'center' },
  filterChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: C.border },
  filterChipActive: { backgroundColor: C.red, borderColor: C.red },
  filterChipText: { fontSize: 12, fontFamily: 'Poppins_500Medium', color: C.textMuted },
  filterChipTextActive: { color: '#fff' },

  // List
  listContent: { padding: 16, gap: 12 },
  appCard: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 16 },
  appCardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  appTypeChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  appTypeChipText: { fontSize: 11, fontFamily: 'Poppins_600SemiBold' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  statusBadgeText: { fontSize: 11, fontFamily: 'Poppins_600SemiBold' },
  appCardTitle: { fontSize: 15, fontFamily: 'Poppins_600SemiBold', color: C.textPrimary, lineHeight: 22, marginBottom: 10 },
  appCardFooter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  appCardDate: { flex: 1, fontSize: 12, fontFamily: 'Poppins_400Regular', color: C.textMuted },
  urgentChipSmall: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#FFF0EE', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  urgentChipSmallText: { fontSize: 10, fontFamily: 'Poppins_600SemiBold', color: '#C0392B' },

  // Empty
  emptyIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: C.cream, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.border },
  emptyTitle: { fontSize: 17, fontFamily: 'Poppins_700Bold', color: C.textSecondary },
  emptySub: { fontSize: 13, fontFamily: 'Poppins_400Regular', color: C.textMuted, textAlign: 'center', lineHeight: 20 },
  emptyNewBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.red, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 10, marginTop: 4 },
  emptyNewBtnText: { fontSize: 14, fontFamily: 'Poppins_600SemiBold', color: '#fff' },

  // Step header
  stepHeader: { padding: 20, paddingBottom: 12 },
  stepTitle: { fontSize: 18, fontFamily: 'Poppins_700Bold', color: C.textPrimary, marginBottom: 4 },
  stepSubtitle: { fontSize: 13, fontFamily: 'Poppins_400Regular', color: C.textMuted },

  // Type selection
  typeList: { padding: 16, gap: 12 },
  typeCard: { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: C.border, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14 },
  typeIconBox: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  typeIconText: { fontSize: 22 },
  typeCardBody: { flex: 1 },
  typeCardName: { fontSize: 15, fontFamily: 'Poppins_600SemiBold', color: C.textPrimary, marginBottom: 3 },
  typeCardDesc: { fontSize: 12, fontFamily: 'Poppins_400Regular', color: C.textMuted, lineHeight: 18 },

  // Form
  formScroll: { padding: 16 },
  typePillRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, marginBottom: 20 },
  typePillIcon: { fontSize: 18 },
  typePillName: { fontSize: 14, fontFamily: 'Poppins_600SemiBold' },
  fieldLabel: { fontSize: 13, fontFamily: 'Poppins_600SemiBold', color: C.textPrimary, marginBottom: 6, marginTop: 12 },
  required: { color: C.error },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, fontFamily: 'Poppins_400Regular', color: C.textPrimary },
  inputError: { borderColor: C.error },
  textarea: { minHeight: 96, paddingTop: 10 },
  fieldError: { fontSize: 11, fontFamily: 'Poppins_400Regular', color: C.error, marginTop: 4 },
  selectRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  selectOption: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: C.border },
  selectOptionActive: { backgroundColor: C.red, borderColor: C.red },
  selectOptionText: { fontSize: 13, fontFamily: 'Poppins_500Medium', color: C.textMuted },
  selectOptionTextActive: { color: '#fff' },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  checkboxChecked: { backgroundColor: C.red, borderColor: C.red },
  checkboxLabel: { fontSize: 14, fontFamily: 'Poppins_400Regular', color: C.textPrimary },
  priorityRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  priorityBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10, backgroundColor: '#fff', borderWidth: 1, borderColor: C.border },
  priorityBtnActive: { backgroundColor: '#EBF5F0', borderColor: C.success },
  priorityBtnUrgent: { backgroundColor: C.error, borderColor: C.error },
  priorityBtnText: { fontSize: 14, fontFamily: 'Poppins_500Medium', color: C.textMuted },
  priorityBtnTextActive: { color: C.success },
  primaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.red, borderRadius: 12, paddingVertical: 14, marginTop: 24 },
  primaryBtnDisabled: { opacity: 0.6 },
  primaryBtnText: { fontSize: 16, fontFamily: 'Poppins_600SemiBold', color: '#fff' },

  // Confirm
  confirmSection: { marginBottom: 16 },
  confirmSectionLabel: { fontSize: 11, fontFamily: 'Poppins_600SemiBold', color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  confirmValue: { fontSize: 14, fontFamily: 'Poppins_400Regular', color: C.textPrimary, lineHeight: 22, backgroundColor: '#fff', borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 12 },
  priorityChip: { alignSelf: 'flex-start', backgroundColor: '#F0F9F4', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  priorityChipUrgent: { backgroundColor: '#FFF0EE' },
  priorityChipText: { fontSize: 13, fontFamily: 'Poppins_600SemiBold', color: C.success },
  errorBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFF5F5', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: C.error + '40', marginTop: 8 },
  errorBannerText: { fontSize: 13, fontFamily: 'Poppins_400Regular', color: C.error, flex: 1 },

  // Detail
  detailScroll: { paddingTop: 16 },
  statusCard: { marginHorizontal: 16, marginBottom: 16, borderRadius: 14, borderWidth: 1, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  statusCardLabel: { fontSize: 15, fontFamily: 'Poppins_700Bold' },
  statusCardDate: { fontSize: 12, fontFamily: 'Poppins_400Regular', color: C.textMuted, marginTop: 2 },
  urgentChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FFF0EE', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  urgentChipText: { fontSize: 11, fontFamily: 'Poppins_600SemiBold', color: '#C0392B' },
  detailSection: { marginHorizontal: 16, marginBottom: 20 },
  detailSectionTitle: { fontSize: 13, fontFamily: 'Poppins_700Bold', color: C.textSecondary, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  detailBody: { fontSize: 14, fontFamily: 'Poppins_400Regular', color: C.textSecondary, lineHeight: 22 },
  remarksSection: { backgroundColor: '#FFF8E0', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#D4A84340' },
  formDataRow: { flexDirection: 'row', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.border },
  formDataKey: { flex: 1, fontSize: 13, fontFamily: 'Poppins_600SemiBold', color: C.textMuted },
  formDataValue: { flex: 2, fontSize: 13, fontFamily: 'Poppins_400Regular', color: C.textPrimary, textAlign: 'right' },

  // History timeline
  historyRow: { flexDirection: 'row', gap: 12, minHeight: 56 },
  historyLine: { alignItems: 'center', width: 24 },
  historyDot: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  historyConnector: { flex: 1, width: 2, backgroundColor: C.border, marginVertical: 2 },
  historyContent: { flex: 1, paddingBottom: 16 },
  historyStatus: { fontSize: 13, fontFamily: 'Poppins_600SemiBold' },
  historyDate: { fontSize: 11, fontFamily: 'Poppins_400Regular', color: C.textMuted, marginTop: 2 },
  historyRemarks: { fontSize: 12, fontFamily: 'Poppins_400Regular', color: C.textSecondary, marginTop: 4 },

  // Comments
  noComments: { fontSize: 13, fontFamily: 'Poppins_400Regular', color: C.textMuted, marginBottom: 12 },
  commentBubble: { borderRadius: 12, padding: 12, marginBottom: 10, borderWidth: 1 },
  commentSelf: { backgroundColor: '#FFF5F0', borderColor: C.saffron + '40', marginLeft: 24 },
  commentAdmin: { backgroundColor: '#F0F5FF', borderColor: '#1D6FAE40', marginRight: 24 },
  commentHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  commentAuthorBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  commentAuthor: { fontSize: 11, fontFamily: 'Poppins_600SemiBold', color: C.textMuted },
  commentDate: { fontSize: 11, fontFamily: 'Poppins_400Regular', color: C.textMuted },
  commentText: { fontSize: 13, fontFamily: 'Poppins_400Regular', color: C.textPrimary, lineHeight: 20 },
  commentInputRow: { flexDirection: 'row', gap: 10, marginTop: 12, alignItems: 'flex-end' },
  commentInput: { flex: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, fontFamily: 'Poppins_400Regular', color: C.textPrimary, maxHeight: 100 },
  commentSendBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: C.red, alignItems: 'center', justifyContent: 'center' },
  commentSendBtnDisabled: { opacity: 0.5 },

  // Document upload
  uploadSection: { marginTop: 16, backgroundColor: '#FFF8F0', borderRadius: 12, borderWidth: 1, borderColor: C.border, padding: 14 },
  uploadHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  uploadTitle: { fontSize: 13, fontFamily: 'Poppins_600SemiBold', color: C.textPrimary, flex: 1 },
  uploadRequired: { color: C.error, fontSize: 13, fontFamily: 'Poppins_600SemiBold' },
  uploadHint: { fontSize: 12, fontFamily: 'Poppins_400Regular', color: C.textMuted, marginBottom: 10, lineHeight: 18 },
  uploadBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1.5, borderColor: C.saffron, borderStyle: 'dashed', borderRadius: 10, paddingVertical: 12, backgroundColor: '#fff', marginTop: 8 },
  uploadBtnDisabled: { opacity: 0.5 },
  uploadBtnText: { fontSize: 13, fontFamily: 'Poppins_600SemiBold', color: C.saffron },
  uploadNativeNote: { backgroundColor: '#fff', borderRadius: 8, padding: 10, marginTop: 8, borderWidth: 1, borderColor: C.border },
  uploadNativeNoteText: { fontSize: 12, fontFamily: 'Poppins_400Regular', color: C.textMuted, textAlign: 'center' },
  fileRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: C.border, padding: 10, marginBottom: 6 },
  fileName: { flex: 1, fontSize: 12, fontFamily: 'Poppins_500Medium', color: C.textPrimary },
  fileSize: { fontSize: 11, fontFamily: 'Poppins_400Regular', color: C.textMuted },

  // Attachments in detail
  attachmentRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFF8F0', borderRadius: 10, borderWidth: 1, borderColor: C.border, padding: 12, marginBottom: 8 },
  attachmentName: { flex: 1, fontSize: 13, fontFamily: 'Poppins_500Medium', color: C.textPrimary },
  attachmentSize: { fontSize: 11, fontFamily: 'Poppins_400Regular', color: C.textMuted },
});
