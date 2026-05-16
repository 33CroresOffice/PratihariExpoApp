import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';

export function useNetworkStatus(): boolean {
  const [isOnline, setIsOnline] = useState<boolean>(true);

  useEffect(() => {
    let mounted = true;

    if (Platform.OS === 'web') {
      const update = () => {
        if (mounted) setIsOnline(typeof navigator !== 'undefined' ? navigator.onLine : true);
      };
      update();
      if (typeof window !== 'undefined') {
        window.addEventListener('online', update);
        window.addEventListener('offline', update);
        return () => {
          mounted = false;
          window.removeEventListener('online', update);
          window.removeEventListener('offline', update);
        };
      }
      return () => {
        mounted = false;
      };
    }

    NetInfo.fetch().then((state) => {
      if (mounted) setIsOnline(!!state.isConnected && state.isInternetReachable !== false);
    });
    const unsub = NetInfo.addEventListener((state) => {
      if (mounted) setIsOnline(!!state.isConnected && state.isInternetReachable !== false);
    });
    return () => {
      mounted = false;
      unsub();
    };
  }, []);

  return isOnline;
}
