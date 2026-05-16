import { Modal, View, Text, TouchableOpacity, StyleSheet, Pressable } from 'react-native';
import { CloudOff } from 'lucide-react-native';

interface Props {
  visible: boolean;
  onClose: () => void;
  title?: string;
  message?: string;
}

export function OfflineGateModal({ visible, onClose, title, message }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={() => {}}>
          <View style={styles.iconWrap}>
            <CloudOff color="#E8732A" size={32} />
          </View>
          <Text style={styles.title}>{title ?? 'You are offline'}</Text>
          <Text style={styles.msg}>
            {message ?? 'Please connect to the internet to continue. This feature needs an online connection.'}
          </Text>
          <TouchableOpacity style={styles.btn} onPress={onClose} activeOpacity={0.85}>
            <Text style={styles.btnText}>Got it</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    gap: 12,
    width: '100%',
    maxWidth: 360,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFF3E8',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 18,
    fontFamily: 'Poppins_700Bold',
    color: '#2D1810',
    textAlign: 'center',
  },
  msg: {
    fontSize: 13,
    fontFamily: 'Poppins_400Regular',
    color: '#6B4C3B',
    textAlign: 'center',
    lineHeight: 20,
  },
  btn: {
    backgroundColor: '#E8732A',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 40,
    marginTop: 8,
  },
  btnText: {
    color: '#fff',
    fontSize: 14,
    fontFamily: 'Poppins_700Bold',
  },
});
