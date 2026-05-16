import { useEffect, useState } from 'react';
import { Image, ImageStyle, StyleProp, View, ViewStyle } from 'react-native';
import { getCachedImageUri } from '@/lib/imageCache';

interface Props {
  uri: string | null | undefined;
  style?: StyleProp<ImageStyle>;
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'center';
  fallback?: React.ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
}

/**
 * Drop-in for <Image source={{ uri }}> that serves from the local FileSystem cache
 * when available, downloads and caches on first load, and falls back to the remote
 * URL or a placeholder when the URI is missing.
 */
export function CachedImage({ uri, style, resizeMode = 'cover', fallback, containerStyle }: Props) {
  const [resolvedUri, setResolvedUri] = useState<string | null>(uri ?? null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!uri) {
      setResolvedUri(null);
      return;
    }
    setFailed(false);
    // Synchronously set the remote URI so we paint immediately, then replace with local
    setResolvedUri(uri);
    getCachedImageUri(uri).then((local) => {
      if (local) setResolvedUri(local);
    });
  }, [uri]);

  if (!resolvedUri || failed) {
    if (fallback) {
      return <View style={containerStyle}>{fallback}</View>;
    }
    return null;
  }

  const img = (
    <Image
      source={{ uri: resolvedUri }}
      style={containerStyle ? [{ width: '100%', height: '100%' }, style] : style}
      resizeMode={resizeMode}
      onError={() => {
        if (resolvedUri !== uri && uri) {
          setResolvedUri(uri);
        } else {
          setFailed(true);
        }
      }}
    />
  );

  if (containerStyle) {
    return <View style={[containerStyle, { overflow: 'hidden' }]}>{img}</View>;
  }
  return img;
}
