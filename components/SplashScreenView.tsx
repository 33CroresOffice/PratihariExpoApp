import { useEffect, useRef } from 'react';
import { Animated, Image, StyleSheet, View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';

interface Props {
  onFinished?: () => void;
  /** If true, fade out and call onFinished. If false/undefined, stay visible. */
  shouldHide?: boolean;
}

export default function SplashScreenView({ onFinished, shouldHide }: Props) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const { t, i18n } = useTranslation();
  const isOdia = i18n.language === 'or';

  useEffect(() => {
    // Fade + scale in on mount
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 6,
        tension: 80,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  useEffect(() => {
    if (!shouldHide) return;
    // Short hold then fade out
    const timer = setTimeout(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }).start(() => onFinished?.());
    }, 300);
    return () => clearTimeout(timer);
  }, [shouldHide]);

  return (
    <View style={styles.container}>
      {/* Background glow circle */}
      <View style={styles.glowOuter}>
        <View style={styles.glowInner} />
      </View>

      <Animated.View
        style={[
          styles.content,
          { opacity: fadeAnim, transform: [{ scale: scaleAnim }] },
        ]}
      >
        <View style={styles.logoWrapper}>
          <Image
            source={require('../assets/images/image.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        <Text style={[styles.appName, isOdia && { fontFamily: 'NotoSansOriya_700Bold' }]}>
          {t('splash.title')}
        </Text>
        <Text style={[styles.subtitle, isOdia && { fontFamily: 'NotoSansOriya_400Regular' }]}>
          {t('splash.tagline')}
        </Text>

        <View style={styles.dividerRow}>
          {[0, 1, 2].map(i => (
            <View key={i} style={[styles.dot, i === 1 && styles.dotCenter]} />
          ))}
        </View>
      </Animated.View>

      {/* Bottom tagline */}
      <Animated.Text style={[styles.footer, isOdia && { fontFamily: 'NotoSansOriya_400Regular' }, { opacity: fadeAnim }]}>
        {t('common.jayJagannath')}
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFDF9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowOuter: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: 'rgba(232,115,42,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowInner: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(232,115,42,0.09)',
  },
  content: {
    alignItems: 'center',
  },
  logoWrapper: {
    width: 100,
    height: 100,
    borderRadius: 24,
    backgroundColor: '#fff',
    shadowColor: '#E8732A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
    overflow: 'hidden',
  },
  logo: {
    width: 88,
    height: 88,
  },
  appName: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 26,
    color: '#1A1207',
    letterSpacing: 0.3,
    marginBottom: 6,
  },
  subtitle: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
    color: '#8C6A3F',
    letterSpacing: 0.2,
    marginBottom: 24,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(232,115,42,0.35)',
  },
  dotCenter: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#E8732A',
  },
  footer: {
    position: 'absolute',
    bottom: 48,
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
    color: '#B89070',
    letterSpacing: 0.4,
  },
});
