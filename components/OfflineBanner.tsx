import { View, Text, StyleSheet } from 'react-native';
import { CloudOff } from 'lucide-react-native';
import { useOffline } from '@/contexts/OfflineContext';
import { useTranslation } from 'react-i18next';

export function OfflineBanner() {
  const { isOnline, offlineEnabled } = useOffline();
  const { t, i18n } = useTranslation();
  if (isOnline || !offlineEnabled) return null;
  const odia = i18n.language === 'or';
  return (
    <View style={styles.wrap}>
      <CloudOff color="#fff" size={13} />
      <Text style={[styles.text, odia && { fontFamily: 'NotoSansOriya_400Regular' }]}>
        {t('offline.youAreOffline')} — {t('offline.cachedData')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#6B4C3B',
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  text: {
    color: '#fff',
    fontSize: 12,
    fontFamily: 'Poppins_500Medium',
  },
});
