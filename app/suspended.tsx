import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/contexts/AuthContext';
import { ShieldBan, LogOut } from 'lucide-react-native';

const C = {
  saffron: '#E8732A',
  error: '#C0392B',
  cream: '#FFF8F0',
  warmWhite: '#FFFDF9',
  textPrimary: '#2D1810',
  textSecondary: '#6B4C3B',
  textMuted: '#9B8578',
  border: '#E8D5C4',
};

export default function SuspendedScreen() {
  const { signOut } = useAuth();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <LinearGradient
        colors={['#7F1D1D', '#991B1B']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <View style={styles.iconWrap}>
          <ShieldBan color="#fff" size={32} />
        </View>
        <Text style={styles.headerTitle}>Account Suspended</Text>
      </LinearGradient>

      <View style={styles.body}>
        <Text style={styles.message}>
          Your Sebayat profile has been suspended by the administration.
        </Text>
        <Text style={styles.subtext}>
          You will not be able to access the Sebayat panel until an admin reactivates your profile. Please contact your group administrator or the Pratihari Nijog office for assistance.
        </Text>

        <TouchableOpacity style={styles.signOutBtn} onPress={signOut} activeOpacity={0.8}>
          <LogOut color="#fff" size={18} />
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.warmWhite },
  header: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 32,
    gap: 16,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 22,
    fontFamily: 'Poppins_700Bold',
    color: '#fff',
  },
  body: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 36,
    alignItems: 'center',
  },
  message: {
    fontSize: 17,
    fontFamily: 'Poppins_600SemiBold',
    color: C.textPrimary,
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 24,
  },
  subtext: {
    fontSize: 14,
    fontFamily: 'Poppins_400Regular',
    color: C.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 40,
  },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: C.error,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 14,
  },
  signOutText: {
    fontSize: 15,
    fontFamily: 'Poppins_600SemiBold',
    color: '#fff',
  },
});
