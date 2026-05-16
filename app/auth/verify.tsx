import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowLeft, RefreshCw } from 'lucide-react-native';

const COLORS = {
  saffron: '#E8732A',
  gold: '#D4A843',
  cream: '#FFF8F0',
  warmWhite: '#FFFDF9',
  textPrimary: '#2D1810',
  textSecondary: '#6B4C3B',
  textMuted: '#9B8578',
  border: '#E8D5C4',
  error: '#C0392B',
};

const OTP_LENGTH = 6;

export default function VerifyScreen() {
  const { phone, testOtp } = useLocalSearchParams<{ phone: string; testOtp?: string }>();
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendTimer, setResendTimer] = useState(30);
  const [resending, setResending] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const { verifyOtp, resendOtp } = useAuth();
  const router = useRouter();
  const verifyCalledRef = useRef(false);

  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 300);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (resendTimer <= 0) return;
    const interval = setInterval(() => setResendTimer((t) => t - 1), 1000);
    return () => clearInterval(interval);
  }, [resendTimer]);

  // Auto-verify when all digits entered
  useEffect(() => {
    if (otp.length === OTP_LENGTH && !verifyCalledRef.current) {
      verifyCalledRef.current = true;
      handleVerify(otp);
    }
  }, [otp]);

  async function handleVerify(otpValue: string) {
    setLoading(true);
    setError('');
    const result = await verifyOtp(phone!, otpValue);
    setLoading(false);

    if (result.success) {
      router.replace('/(tabs)');
    } else {
      setError(result.error || 'Verification failed');
      setOtp('');
      verifyCalledRef.current = false;
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }

  function handleChange(text: string) {
    const cleaned = text.replace(/[^0-9]/g, '').slice(0, OTP_LENGTH);
    setOtp(cleaned);
    setError('');
    if (cleaned.length < OTP_LENGTH) {
      verifyCalledRef.current = false;
    }
  }

  async function handleResend() {
    setResending(true);
    setError('');
    const result = await resendOtp(phone!);
    setResending(false);
    if (result.success) {
      setResendTimer(30);
      setOtp('');
      verifyCalledRef.current = false;
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setError(result.error || 'Failed to resend OTP');
    }
  }

  const displayPhone = phone
    ? `+${phone.slice(0, 2)} ${phone.slice(2, 7)} ${phone.slice(7)}`
    : '';

  const digits = otp.split('');

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <ArrowLeft color={COLORS.textPrimary} size={24} />
        </TouchableOpacity>

        <View style={styles.header}>
          <Text style={styles.title}>Verify Phone</Text>
          <Text style={styles.subtitle}>Enter the 6-digit code sent to</Text>
          <Text style={styles.phoneDisplay}>{displayPhone}</Text>
        </View>

        {testOtp ? (
          <View style={styles.testBanner}>
            <Text style={styles.testBannerTitle}>Test Mode</Text>
            <Text style={styles.testBannerText}>
              Use code <Text style={styles.testBannerCode}>{testOtp}</Text> to sign in
            </Text>
          </View>
        ) : null}

        {/* Hidden real input — captures keyboard */}
        <TextInput
          ref={inputRef}
          value={otp}
          onChangeText={handleChange}
          keyboardType="number-pad"
          maxLength={OTP_LENGTH}
          style={styles.hiddenInput}
          caretHidden
          autoComplete="one-time-code"
        />

        {/* Visual digit boxes */}
        <Pressable style={styles.otpRow} onPress={() => inputRef.current?.focus()}>
          {Array.from({ length: OTP_LENGTH }).map((_, i) => {
            const filled = i < digits.length;
            const active = i === digits.length && !loading;
            return (
              <View
                key={i}
                style={[
                  styles.digitBox,
                  filled && styles.digitBoxFilled,
                  active && styles.digitBoxActive,
                  error && styles.digitBoxError,
                ]}
              >
                {loading && i === digits.length - 1 ? (
                  <ActivityIndicator color={COLORS.saffron} size="small" />
                ) : (
                  <Text style={[styles.digitText, filled && styles.digitTextFilled]}>
                    {filled ? digits[i] : ''}
                  </Text>
                )}
              </View>
            );
          })}
        </Pressable>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {loading ? (
          <View style={styles.verifyingRow}>
            <ActivityIndicator color={COLORS.saffron} size="small" />
            <Text style={styles.verifyingText}>Verifying...</Text>
          </View>
        ) : null}

        <View style={styles.resendRow}>
          {resendTimer > 0 ? (
            <Text style={styles.resendTimer}>Resend code in {resendTimer}s</Text>
          ) : (
            <TouchableOpacity
              style={styles.resendButton}
              onPress={handleResend}
              disabled={resending}
              activeOpacity={0.7}
            >
              {resending ? (
                <ActivityIndicator color={COLORS.saffron} size="small" />
              ) : (
                <>
                  <RefreshCw color={COLORS.saffron} size={16} />
                  <Text style={styles.resendText}>Resend OTP</Text>
                </>
              )}
            </TouchableOpacity>
          )}
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
    paddingTop: 60,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: COLORS.cream,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  header: {
    marginBottom: 28,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.textPrimary,
    fontFamily: 'Poppins_700Bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: COLORS.textSecondary,
    fontFamily: 'Poppins_400Regular',
    lineHeight: 22,
  },
  phoneDisplay: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.saffron,
    fontFamily: 'Poppins_600SemiBold',
    marginTop: 4,
  },
  hiddenInput: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
  },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 20,
  },
  digitBox: {
    flex: 1,
    height: 60,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 14,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  digitBoxActive: {
    borderColor: COLORS.saffron,
    borderWidth: 2,
    backgroundColor: COLORS.cream,
  },
  digitBoxFilled: {
    borderColor: COLORS.saffron,
    backgroundColor: COLORS.cream,
  },
  digitBoxError: {
    borderColor: COLORS.error,
    backgroundColor: '#FFF5F5',
  },
  digitText: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.textPrimary,
    fontFamily: 'Poppins_700Bold',
  },
  digitTextFilled: {
    color: COLORS.textPrimary,
  },
  errorText: {
    fontSize: 13,
    color: COLORS.error,
    fontFamily: 'Poppins_400Regular',
    textAlign: 'center',
    marginBottom: 12,
  },
  verifyingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
  },
  verifyingText: {
    fontSize: 14,
    color: COLORS.textMuted,
    fontFamily: 'Poppins_400Regular',
  },
  resendRow: {
    alignItems: 'center',
    marginTop: 16,
  },
  resendTimer: {
    fontSize: 14,
    color: COLORS.textMuted,
    fontFamily: 'Poppins_400Regular',
  },
  resendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  resendText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.saffron,
    fontFamily: 'Poppins_600SemiBold',
  },
  testBanner: {
    backgroundColor: '#FFF3CD',
    borderWidth: 1,
    borderColor: '#FBBF24',
    borderRadius: 10,
    padding: 14,
    marginBottom: 20,
  },
  testBannerTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#92400E',
    fontFamily: 'Poppins_700Bold',
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  testBannerText: {
    fontSize: 14,
    color: '#78350F',
    fontFamily: 'Poppins_400Regular',
  },
  testBannerCode: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 16,
    color: '#92400E',
    letterSpacing: 2,
  },
});
