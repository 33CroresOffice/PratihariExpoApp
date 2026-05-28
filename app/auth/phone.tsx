import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Phone, MessageCircle, Globe } from 'lucide-react-native';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const COLORS = {
  saffron: '#E8732A',
  saffronDark: '#C75F1F',
  gold: '#D4A843',
  cream: '#FFF8F0',
  warmWhite: '#FFFDF9',
  textPrimary: '#2D1810',
  textSecondary: '#6B4C3B',
  textMuted: '#9B8578',
  border: '#E8D5C4',
  error: '#C0392B',
  whatsapp: '#25D366',
  whatsappDark: '#1DA851',
};

type Channel = 'sms' | 'whatsapp';

export default function PhoneScreen() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [channel, setChannel] = useState<Channel>('sms');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [smsEnabled, setSmsEnabled] = useState(true);
  const [whatsappEnabled, setWhatsappEnabled] = useState(true);
  const { sendOtp } = useAuth();
  const router = useRouter();
  const { t, language, setLanguage } = useLanguage();
  const insets = useSafeAreaInsets();

  const fullPhone = `91${phoneNumber}`;

  useEffect(() => {
    supabase
      .from('app_settings')
      .select('key,value')
      .in('key', ['otp_sms_enabled', 'otp_whatsapp_enabled'])
      .then(({ data }) => {
        if (!data) return;
        const map: Record<string, boolean> = {};
        for (const row of data) map[row.key] = row.value !== false;
        const sms = map.otp_sms_enabled !== false;
        const wa = map.otp_whatsapp_enabled !== false;
        setSmsEnabled(sms);
        setWhatsappEnabled(wa);
        // Auto-select the only available channel if one is disabled
        if (!sms && wa) setChannel('whatsapp');
        if (sms && !wa) setChannel('sms');
      });
  }, []);

  async function handleSendOtp() {
    setError('');

    if (phoneNumber.length !== 10) {
      setError(t('auth.invalidPhone'));
      return;
    }

    setLoading(true);
    const result = await sendOtp(fullPhone, channel);
    setLoading(false);

    if (result.success) {
      router.push({
        pathname: '/auth/verify',
        params: { phone: fullPhone, channel, testOtp: result.testOtp ?? '' },
      });
    } else {
      setError(result.error || t('auth.failedSend'));
    }
  }

  const showChannelSelector = smsEnabled && whatsappEnabled;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={[styles.langToggleRow, { top: insets.top + 12 }]}>
        <View style={styles.langToggle}>
          <Globe size={13} color={COLORS.textSecondary} />
          <TouchableOpacity
            style={[styles.langPill, language === 'en' && styles.langPillActive]}
            onPress={() => setLanguage('en')}
            activeOpacity={0.7}
          >
            <Text style={[styles.langPillText, language === 'en' && styles.langPillTextActive]}>
              English
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.langPill, language === 'or' && styles.langPillActive]}
            onPress={() => setLanguage('or')}
            activeOpacity={0.7}
          >
            <Text
              style={[
                language === 'or' ? styles.langPillTextOdiaActive : styles.langPillTextOdia,
              ]}
            >
              ଓଡ଼ିଆ
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <Text style={styles.omSymbol}>OM</Text>
          </View>
          <Text style={[styles.title, language === 'or' && styles.titleOdia]}>
            {t('auth.phoneTitle')}
          </Text>
          <Text style={[styles.subtitle, language === 'or' && styles.textOdia]}>
            {t('auth.phoneSubtitle')}
          </Text>
          <Text style={[styles.description, language === 'or' && styles.textOdia]}>
            {t('auth.phoneDescription')}
          </Text>
        </View>

        <View style={styles.form}>
          <Text style={[styles.label, language === 'or' && styles.textOdia]}>{t('auth.phoneLabel')}</Text>
          <View style={styles.inputRow}>
            <View style={styles.countryCode}>
              <Text style={styles.countryCodeText}>+91</Text>
            </View>
            <TextInput
              style={styles.phoneInput}
              placeholder={t('auth.phonePlaceholder')}
              placeholderTextColor={COLORS.textMuted}
              keyboardType="phone-pad"
              maxLength={10}
              value={phoneNumber}
              onChangeText={(text) => {
                setPhoneNumber(text.replace(/[^0-9]/g, ''));
                setError('');
              }}
            />
          </View>

          {showChannelSelector && (
            <>
              <Text style={[styles.label, language === 'or' && styles.textOdia]}>{t('auth.sendCodeVia')}</Text>
              <View style={styles.channelRow}>
                <TouchableOpacity
                  style={[
                    styles.channelOption,
                    channel === 'sms' && styles.channelOptionActive,
                  ]}
                  onPress={() => setChannel('sms')}
                  activeOpacity={0.7}
                >
                  <Phone
                    color={channel === 'sms' ? '#fff' : COLORS.textSecondary}
                    size={18}
                  />
                  <Text
                    style={[
                      styles.channelLabel,
                      channel === 'sms' && styles.channelLabelActive,
                    ]}
                  >
                    {t('auth.sms')}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.channelOption,
                    styles.channelOptionWhatsapp,
                    channel === 'whatsapp' && styles.channelOptionWhatsappActive,
                  ]}
                  onPress={() => setChannel('whatsapp')}
                  activeOpacity={0.7}
                >
                  <MessageCircle
                    color={channel === 'whatsapp' ? '#fff' : COLORS.whatsapp}
                    size={18}
                  />
                  <Text
                    style={[
                      styles.channelLabel,
                      styles.channelLabelWhatsapp,
                      channel === 'whatsapp' && styles.channelLabelActive,
                    ]}
                  >
                    {t('auth.whatsapp')}
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <TouchableOpacity
            style={[
              styles.button,
              channel === 'whatsapp' && styles.buttonWhatsapp,
              phoneNumber.length < 10 && styles.buttonDisabled,
            ]}
            onPress={handleSendOtp}
            disabled={loading || phoneNumber.length < 10}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                {channel === 'whatsapp' ? (
                  <MessageCircle color="#fff" size={20} />
                ) : (
                  <Phone color="#fff" size={20} />
                )}
                <Text style={[styles.buttonText, language === 'or' && styles.textOdia]}>
                  {channel === 'whatsapp' ? t('auth.sendViaWhatsapp') : t('auth.sendViaSms')}
                </Text>
              </>
            )}
          </TouchableOpacity>

          <Text style={[styles.hint, language === 'or' && styles.textOdia]}>
            {channel === 'whatsapp' ? t('auth.hintWhatsapp') : t('auth.hintSms')}
          </Text>
        </View>

        <View style={styles.footer}>
          <Text style={[styles.footerText, language === 'or' && styles.textOdia]}>
            {t('common.jayJagannath')}
          </Text>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.warmWhite,
  },
  content: {
    flex: 1,
    paddingHorizontal: 28,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 36,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.saffron,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  omSymbol: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    fontFamily: 'Poppins_700Bold',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.textPrimary,
    fontFamily: 'Poppins_700Bold',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.gold,
    fontFamily: 'Poppins_500Medium',
    marginBottom: 12,
  },
  description: {
    fontSize: 15,
    color: COLORS.textSecondary,
    fontFamily: 'Poppins_400Regular',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 12,
  },
  form: {
    marginBottom: 32,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
    fontFamily: 'Poppins_600SemiBold',
    marginBottom: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  countryCode: {
    height: 52,
    paddingHorizontal: 16,
    backgroundColor: COLORS.cream,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRightWidth: 0,
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  countryCodeText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
    fontFamily: 'Poppins_600SemiBold',
  },
  phoneInput: {
    flex: 1,
    height: 52,
    paddingHorizontal: 16,
    fontSize: 16,
    color: COLORS.textPrimary,
    fontFamily: 'Poppins_400Regular',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
    letterSpacing: 1,
  },
  channelRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  channelOption: {
    flex: 1,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: '#fff',
  },
  channelOptionActive: {
    backgroundColor: COLORS.saffron,
    borderColor: COLORS.saffron,
  },
  channelOptionWhatsapp: {
    borderColor: COLORS.whatsapp,
  },
  channelOptionWhatsappActive: {
    backgroundColor: COLORS.whatsapp,
    borderColor: COLORS.whatsapp,
  },
  channelLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
    fontFamily: 'Poppins_600SemiBold',
  },
  channelLabelWhatsapp: {
    color: COLORS.whatsapp,
  },
  channelLabelActive: {
    color: '#fff',
  },
  errorText: {
    fontSize: 13,
    color: COLORS.error,
    fontFamily: 'Poppins_400Regular',
    marginBottom: 8,
  },
  button: {
    height: 52,
    backgroundColor: COLORS.saffron,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 4,
  },
  buttonWhatsapp: {
    backgroundColor: COLORS.whatsapp,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    fontFamily: 'Poppins_600SemiBold',
  },
  hint: {
    fontSize: 13,
    color: COLORS.textMuted,
    fontFamily: 'Poppins_400Regular',
    textAlign: 'center',
    marginTop: 14,
  },
  footer: {
    alignItems: 'center',
    gap: 12,
  },
  footerText: {
    fontSize: 14,
    color: COLORS.gold,
    fontFamily: 'Poppins_500Medium',
    fontStyle: 'italic',
  },
  langToggleRow: {
    position: 'absolute',
    right: 16,
    zIndex: 10,
  },
  langToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.cream,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  langPill: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 14,
  },
  langPillActive: {
    backgroundColor: COLORS.saffron,
  },
  langPillText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontFamily: 'Poppins_600SemiBold',
  },
  langPillTextActive: {
    color: '#fff',
  },
  langPillTextOdia: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontFamily: 'NotoSansOriya_600SemiBold',
  },
  langPillTextOdiaActive: {
    fontSize: 12,
    color: '#fff',
    fontFamily: 'NotoSansOriya_600SemiBold',
  },
  textOdia: {
    fontFamily: 'NotoSansOriya_400Regular',
  },
  titleOdia: {
    fontFamily: 'NotoSansOriya_700Bold',
  },
});
