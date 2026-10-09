import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { ArrowLeft, FolderOpen, FileText, ExternalLink } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { pickLocalized } from '@/lib/i18n';
import { MenuButton, useDrawer, DrawerPanel } from '@/components/SlideDrawer';
import { OfflineBanner } from '@/components/OfflineBanner';
import { useOffline } from '@/contexts/OfflineContext';

const C = {
  purple: '#7C3AED',
  purpleDark: '#5B21B6',
  saffron: '#E8732A',
  gold: '#D4A843',
  cream: '#FFF8F0',
  warmWhite: '#FFFDF9',
  textPrimary: '#2D1810',
  textSecondary: '#6B4C3B',
  textMuted: '#9B8578',
  border: '#E8D5C4',
};

interface Document {
  id: string;
  title: string;
  title_or: string | null;
  description: string | null;
  description_or: string | null;
  file_url: string;
  file_name: string;
  file_size: number;
  category: string;
  display_order: number;
}

const CATEGORY_LABELS: Record<string, string> = {
  ror: 'ROR',
  temple: 'Temple',
  legal: 'Legal',
  other: 'Other',
};

function formatFileSize(bytes: number): string {
  if (!bytes) return '';
  if (bytes > 1048576) return (bytes / 1048576).toFixed(1) + ' MB';
  return Math.ceil(bytes / 1024) + ' KB';
}

export default function DocumentsScreen() {
  const drawer = useDrawer();
  const router = useRouter();
  const { user, profileStatus, profileStatusLoading } = useAuth();
  const { isOnline } = useOffline();
  const { t, language } = useLanguage();

  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  if (!profileStatusLoading && profileStatus !== 'approved') {
    router.replace('/(tabs)');
    return null;
  }

  const fetchDocuments = useCallback(async (isRefresh = false) => {
    if (!isOnline) {
      if (isRefresh) setRefreshing(false); else setLoading(false);
      return;
    }
    if (isRefresh) setRefreshing(true); else if (documents.length === 0) setLoading(true);

    const { data } = await supabase
      .from('documents')
      .select('id, title, title_or, description, description_or, file_url, file_name, file_size, category, display_order')
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (isRefresh) setRefreshing(false); else setLoading(false);
    setDocuments((data as Document[]) ?? []);
  }, [isOnline, documents.length]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  function openPdf(url: string) {
    Linking.openURL(url).catch(() => {});
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <LinearGradient colors={[C.purple, C.purpleDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
            <ArrowLeft color="#fff" size={22} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <FolderOpen color="rgba(255,255,255,0.85)" size={20} />
            <Text style={styles.headerTitle}>{t('documents.title')}</Text>
          </View>
        </LinearGradient>
        <View style={styles.center}>
          <ActivityIndicator color={C.purple} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <OfflineBanner />
      <LinearGradient colors={[C.purple, C.purpleDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <ArrowLeft color="#fff" size={22} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <FolderOpen color="rgba(255,255,255,0.85)" size={20} />
          <Text style={styles.headerTitle}>{t('documents.title')}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={styles.headerBadge}>
            <Text style={styles.headerBadgeText}>{documents.length}</Text>
          </View>
          <MenuButton onPress={drawer.open} />
        </View>
      </LinearGradient>

      <DrawerPanel {...drawer} />

      {documents.length === 0 ? (
        <View style={styles.center}>
          <View style={styles.emptyIcon}>
            <FileText color={C.gold} size={36} />
          </View>
          <Text style={styles.emptyTitle}>{t('documents.noDocuments')}</Text>
          <Text style={styles.emptySub}>{t('documents.noDocumentsDesc')}</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchDocuments(true)}
              colors={[C.purple]}
              tintColor={C.purple}
            />
          }
        >
          <Text style={styles.pageSubtitle}>{t('documents.pageSubtitle')}</Text>
          {documents.map((doc) => {
            const title = pickLocalized(doc, 'title', language);
            const description = pickLocalized(doc, 'description', language);
            const catLabel = CATEGORY_LABELS[doc.category] ?? doc.category;
            return (
              <TouchableOpacity
                key={doc.id}
                style={styles.docCard}
                onPress={() => openPdf(doc.file_url)}
                activeOpacity={0.75}
              >
                <View style={styles.docIconWrap}>
                  <FileText color={C.purple} size={24} />
                </View>
                <View style={styles.docInfo}>
                  <Text style={styles.docTitle} numberOfLines={2}>{title}</Text>
                  {!!description && (
                    <Text style={styles.docDesc} numberOfLines={2}>{description}</Text>
                  )}
                  <View style={styles.docMetaRow}>
                    <View style={styles.catPill}>
                      <Text style={styles.catPillText}>{catLabel}</Text>
                    </View>
                    {!!doc.file_size && (
                      <Text style={styles.docSize}>{formatFileSize(doc.file_size)}</Text>
                    )}
                  </View>
                </View>
                <View style={styles.openBtn}>
                  <ExternalLink color={C.purple} size={18} />
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.warmWhite },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 14,
    gap: 8,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerCenter: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  headerTitle: {
    fontSize: 18, fontFamily: 'Poppins_700Bold', color: '#fff',
  },
  headerBadge: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 12, minWidth: 28, height: 24,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8,
  },
  headerBadgeText: {
    fontSize: 12, fontFamily: 'Poppins_600SemiBold', color: '#fff',
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  emptyIcon: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: '#FFF3CD', alignItems: 'center', justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 16, fontFamily: 'Poppins_600SemiBold', color: C.textPrimary,
    marginBottom: 6,
  },
  emptySub: {
    fontSize: 13, fontFamily: 'Poppins_400Regular', color: C.textMuted,
    textAlign: 'center',
  },
  listContent: { padding: 16, paddingTop: 8 },
  pageSubtitle: {
    fontSize: 13, fontFamily: 'Poppins_400Regular', color: C.textSecondary,
    marginBottom: 16, lineHeight: 20,
  },
  docCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#fff', borderRadius: 16,
    padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: C.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  docIconWrap: {
    width: 48, height: 48, borderRadius: 12,
    backgroundColor: '#F5F0FF', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  docInfo: { flex: 1, minWidth: 0 },
  docTitle: {
    fontSize: 15, fontFamily: 'Poppins_600SemiBold', color: C.textPrimary,
    marginBottom: 4,
  },
  docDesc: {
    fontSize: 12, fontFamily: 'Poppins_400Regular', color: C.textMuted,
    marginBottom: 8, lineHeight: 18,
  },
  docMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  catPill: {
    backgroundColor: '#F5F0FF', borderRadius: 8,
    paddingVertical: 3, paddingHorizontal: 8,
  },
  catPillText: {
    fontSize: 10, fontFamily: 'Poppins_600SemiBold', color: C.purple,
  },
  docSize: {
    fontSize: 11, fontFamily: 'Poppins_400Regular', color: C.textMuted,
  },
  openBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: '#F5F0FF', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
});
