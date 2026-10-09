import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Modal,
  Pressable,
  Switch,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import {
  Bell,
  Send,
  Settings as SettingsIcon,
  List as ListIcon,
  ChevronRight,
  ChevronDown,
  X,
  MessageSquare,
  MessageCircle,
  CheckCircle,
  Circle as XCircle,
  CircleAlert as AlertCircle,
  Users,
  Hash,
  Mail,
  Smartphone,
  Globe,
} from 'lucide-react-native';

const C = {
  saffron: '#E8732A',
  gold: '#D4A843',
  cream: '#FFF8F0',
  warmWhite: '#FFFDF9',
  textPrimary: '#2D1810',
  textSecondary: '#6B4C3B',
  textMuted: '#9B8578',
  border: '#E8D5C4',
  error: '#C0392B',
  teal: '#1A7A6A',
  success: '#27AE60',
};

type Channel = {
  channel: string;
  enabled: boolean;
};

type FeatureConfig = {
  event_key: string;
  label: string;
  sms_enabled: boolean;
  whatsapp_enabled: boolean;
  push_enabled: boolean;
  inapp_enabled: boolean;
  admin_notification_enabled: boolean;
};

type LogEntry = {
  id: string;
  event_key: string;
  channel: string;
  recipient_type: string;
  recipient_sebayat_id: string | null;
  status: string;
  created_at: string;
};

type ReminderConfig = {
  id: number;
  five_day_reminder_enabled: boolean;
  five_day_reminder_time: string;
  three_day_reminder_enabled: boolean;
  three_day_reminder_time: string;
  one_day_reminder_enabled: boolean;
  one_day_reminder_time: string;
  morning_reminder_enabled: boolean;
  morning_reminder_time: string;
};

type Tab = 'channels' | 'events' | 'compose' | 'logs' | 'reminders' | 'otp';

const CHANNEL_ICONS: Record<string, any> = {
  inapp: Bell,
  push: Send,
  sms: Smartphone,
  whatsapp: Globe,
};

const CHANNEL_COLORS: Record<string, string> = {
  inapp: C.saffron,
  push: '#1D6FAE',
  sms: C.teal,
  whatsapp: '#27AE60',
};

export default function AdminNotificationsScreen() {
  const { user } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('channels');
  const [channels, setChannels] = useState<Channel[]>([]);
  const [featureConfigs, setFeatureConfigs] = useState<FeatureConfig[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [reminderConfig, setReminderConfig] = useState<ReminderConfig | null>(null);
  const [savingReminder, setSavingReminder] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [otpSmsEnabled, setOtpSmsEnabled] = useState(true);
  const [otpWhatsappEnabled, setOtpWhatsappEnabled] = useState(true);
  const [otpSaving, setOtpSaving] = useState(false);
  const [otpMsg, setOtpMsg] = useState('');

  // Compose state
  const [composeTitle, setComposeTitle] = useState('');
  const [composeMessage, setComposeMessage] = useState('');
  const [recipientType, setRecipientType] = useState<'all' | 'group' | 'individual' | 'beddha'>('all');
  const [selectedGroup, setSelectedGroup] = useState<'pratihari' | 'gochhikar' | null>(null);
  const [selectedChannels, setSelectedChannels] = useState<string[]>(['inapp']);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<string | null>(null);

  useEffect(() => {
    fetchAll();
  }, []);

  async function fetchAll(isRefresh = false) {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    const [chRes, fcRes, logRes, rcRes, otpRes] = await Promise.all([
      supabase.from('notification_channels').select('channel, enabled').order('channel'),
      supabase.from('notification_feature_config').select('*').order('sort_order'),
      supabase.from('notification_log').select('*').order('created_at', { ascending: false }).limit(50),
      supabase.from('seba_notification_config').select('*').eq('id', 1).maybeSingle(),
      supabase.from('app_settings').select('key,value').in('key', ['otp_sms_enabled', 'otp_whatsapp_enabled']),
    ]);

    if (chRes.data) setChannels(chRes.data as Channel[]);
    if (fcRes.data) setFeatureConfigs(fcRes.data as FeatureConfig[]);
    if (logRes.data) setLogs(logRes.data as LogEntry[]);
    if (rcRes.data) setReminderConfig(rcRes.data as ReminderConfig);
    if (otpRes.data) {
      const map: Record<string, boolean> = {};
      for (const row of otpRes.data) map[row.key] = row.value !== false;
      setOtpSmsEnabled(map.otp_sms_enabled !== false);
      setOtpWhatsappEnabled(map.otp_whatsapp_enabled !== false);
    }

    if (isRefresh) setRefreshing(false);
    else setLoading(false);
  }

  async function toggleOtpChannel(key: 'otp_sms_enabled' | 'otp_whatsapp_enabled', value: boolean) {
    if (!value && key === 'otp_sms_enabled' && !otpWhatsappEnabled) {
      setOtpMsg('At least one OTP channel must remain enabled');
      setTimeout(() => setOtpMsg(''), 3000);
      return;
    }
    if (!value && key === 'otp_whatsapp_enabled' && !otpSmsEnabled) {
      setOtpMsg('At least one OTP channel must remain enabled');
      setTimeout(() => setOtpMsg(''), 3000);
      return;
    }
    setOtpSaving(true);
    setOtpMsg('');
    const { error } = await supabase
      .from('app_settings')
      .update({ value, updated_at: new Date().toISOString(), updated_by: user?.id })
      .eq('key', key);
    if (error) {
      setOtpMsg('Failed to update OTP setting');
    } else {
      if (key === 'otp_sms_enabled') setOtpSmsEnabled(value);
      else setOtpWhatsappEnabled(value);
      setOtpMsg('OTP setting updated');
    }
    setOtpSaving(false);
    setTimeout(() => setOtpMsg(''), 3000);
  }

  async function toggleChannel(channel: string, enabled: boolean) {
    await supabase
      .from('notification_channels')
      .update({ enabled, updated_at: new Date().toISOString() })
      .eq('channel', channel);
    setChannels((prev) => prev.map((c) => (c.channel === channel ? { ...c, enabled } : c)));
  }

  async function toggleFeatureChannel(
    eventKey: string,
    field: 'sms_enabled' | 'whatsapp_enabled' | 'push_enabled' | 'inapp_enabled' | 'admin_notification_enabled',
    value: boolean
  ) {
    await supabase
      .from('notification_feature_config')
      .update({ [field]: value, updated_at: new Date().toISOString() })
      .eq('event_key', eventKey);
    setFeatureConfigs((prev) =>
      prev.map((f) => (f.event_key === eventKey ? { ...f, [field]: value } : f))
    );
  }

  async function toggleReminderSetting(field: keyof ReminderConfig, value: boolean) {
    if (!reminderConfig) return;
    const updated = { ...reminderConfig, [field]: value };
    setReminderConfig(updated);
  }

  async function saveReminderSettings() {
    if (!reminderConfig) return;
    setSavingReminder(true);
    setSaveMsg('');
    const { error } = await supabase
      .from('seba_notification_config')
      .update({
        five_day_reminder_enabled: reminderConfig.five_day_reminder_enabled,
        three_day_reminder_enabled: reminderConfig.three_day_reminder_enabled,
        one_day_reminder_enabled: reminderConfig.one_day_reminder_enabled,
        morning_reminder_enabled: reminderConfig.morning_reminder_enabled,
        updated_at: new Date().toISOString(),
      })
      .eq('id', 1);

    if (error) {
      setSaveMsg('Failed to save settings');
    } else {
      setSaveMsg('Settings saved successfully');
      // Also reschedule cron jobs
      await supabase.rpc('reschedule_seba_reminder_jobs');
    }
    setSavingReminder(false);
    setTimeout(() => setSaveMsg(''), 3000);
  }

  async function sendBroadcast() {
    if (!composeTitle || !composeMessage || selectedChannels.length === 0) return;
    setSending(true);
    setSendResult(null);

    try {
      const API_BASE = process.env.EXPO_PUBLIC_SUPABASE_URL!;
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;

      const body: Record<string, unknown> = {
        title: composeTitle,
        message: composeMessage,
        channels: selectedChannels,
        recipient_type: recipientType,
      };
      if (recipientType === 'group' && selectedGroup) body.recipient_group = selectedGroup;

      const resp = await fetch(`${API_BASE}/functions/v1/broadcast-notification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      if (resp.ok) {
        const data = await resp.json();
        setSendResult(`Sent to ${data.notified || 0} recipients`);
        setComposeTitle('');
        setComposeMessage('');
      } else {
        setSendResult('Failed to send notification');
      }
    } catch {
      setSendResult('Failed to send notification');
    }
    setSending(false);
    setTimeout(() => setSendResult(null), 4000);
  }

  const onRefresh = useCallback(() => fetchAll(true), []);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingCenter}>
          <ActivityIndicator color={C.saffron} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  const tabs: { key: Tab; label: string; icon: any }[] = [
    { key: 'channels', label: 'Channels', icon: SettingsIcon },
    { key: 'events', label: 'Events', icon: ListIcon },
    { key: 'compose', label: 'Compose', icon: Send },
    { key: 'reminders', label: 'Reminders', icon: Bell },
    { key: 'logs', label: 'Logs', icon: ListIcon },
    { key: 'otp', label: 'OTP', icon: Smartphone },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <ChevronRight color={C.textSecondary} size={22} style={{ transform: [{ rotate: '180deg' }] }} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerSub}>Pratihari Nijog</Text>
          <Text style={styles.headerTitle}>Notification Center</Text>
        </View>
        <Bell color={C.saffron} size={22} />
      </View>

      {/* Tab bar */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabBar} contentContainerStyle={styles.tabBarContent}>
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, active && styles.tabActive]}
              onPress={() => setActiveTab(tab.key)}
              activeOpacity={0.7}
            >
              <Icon color={active ? C.saffron : C.textMuted} size={15} />
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{tab.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentInner}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[C.saffron]} />}
      >
        {/* ── CHANNELS TAB ─────────────────────────────────────────── */}
        {activeTab === 'channels' && (
          <View>
            <Text style={styles.sectionLabel}>Notification Channels</Text>
            <Text style={styles.sectionDesc}>Enable or disable notification channels globally</Text>
            {channels.map((ch) => {
              const Icon = CHANNEL_ICONS[ch.channel] || Bell;
              const color = CHANNEL_COLORS[ch.channel] || C.saffron;
              return (
                <View key={ch.channel} style={styles.toggleRow}>
                  <View style={[styles.toggleIcon, { backgroundColor: color + '15' }]}>
                    <Icon color={color} size={18} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.toggleLabel}>
                      {ch.channel === 'inapp' ? 'In-App' : ch.channel === 'push' ? 'Push' : ch.channel === 'sms' ? 'SMS' : 'WhatsApp'}
                    </Text>
                    <Text style={styles.toggleStatus}>{ch.enabled ? 'Enabled' : 'Disabled'}</Text>
                  </View>
                  <Switch
                    value={ch.enabled}
                    onValueChange={(v) => toggleChannel(ch.channel, v)}
                    trackColor={{ false: '#E0D5C8', true: C.saffron + '60' }}
                    thumbColor={ch.enabled ? C.saffron : '#fff'}
                  />
                </View>
              );
            })}
          </View>
        )}

        {/* ── EVENTS TAB ───────────────────────────────────────────── */}
        {activeTab === 'events' && (
          <View>
            <Text style={styles.sectionLabel}>Event Configuration</Text>
            <Text style={styles.sectionDesc}>Choose which channels each event uses</Text>
            {featureConfigs.map((fc) => (
              <View key={fc.event_key} style={styles.eventCard}>
                <Text style={styles.eventLabel}>{fc.label}</Text>
                <Text style={styles.eventKey}>{fc.event_key}</Text>
                <View style={styles.eventToggles}>
                  {(['inapp_enabled', 'push_enabled', 'sms_enabled', 'whatsapp_enabled', 'admin_notification_enabled'] as const).map((field) => {
                    const label = field === 'inapp_enabled' ? 'In-App' : field === 'push_enabled' ? 'Push' : field === 'sms_enabled' ? 'SMS' : field === 'whatsapp_enabled' ? 'WhatsApp' : 'Admin';
                    return (
                      <View key={field} style={styles.eventToggleItem}>
                        <Text style={styles.eventToggleLabel}>{label}</Text>
                        <Switch
                          value={fc[field] as boolean}
                          onValueChange={(v) => toggleFeatureChannel(fc.event_key, field, v)}
                          trackColor={{ false: '#E0D5C8', true: C.saffron + '60' }}
                          thumbColor={fc[field] ? C.saffron : '#fff'}
                          style={{ transform: [{ scale: 0.85 }] }}
                        />
                      </View>
                    );
                  })}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* ── COMPOSE TAB ──────────────────────────────────────────── */}
        {activeTab === 'compose' && (
          <View>
            <Text style={styles.sectionLabel}>Compose Notification</Text>
            <Text style={styles.sectionDesc}>Send a custom notification to selected recipients</Text>

            <Text style={styles.inputLabel}>Title</Text>
            <TextInput
              style={styles.textInput}
              value={composeTitle}
              onChangeText={setComposeTitle}
              placeholder="Notification title..."
              placeholderTextColor={C.textMuted}
            />

            <Text style={styles.inputLabel}>Message</Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              value={composeMessage}
              onChangeText={setComposeMessage}
              placeholder="Notification message..."
              placeholderTextColor={C.textMuted}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            <Text style={styles.inputLabel}>Recipient Type</Text>
            <View style={styles.recipientTypes}>
              {([
                { key: 'all', label: 'All Sebayats' },
                { key: 'group', label: 'Specific Group' },
                { key: 'individual', label: 'Specific Individuals' },
                { key: 'beddha', label: 'Specific Beddha' },
              ] as const).map((rt) => (
                <TouchableOpacity
                  key={rt.key}
                  style={[styles.recipientChip, recipientType === rt.key && styles.recipientChipActive]}
                  onPress={() => setRecipientType(rt.key)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.recipientChipText, recipientType === rt.key && styles.recipientChipTextActive]}>
                    {rt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {recipientType === 'group' && (
              <View style={styles.groupSelector}>
                {(['pratihari', 'gochhikar'] as const).map((g) => (
                  <TouchableOpacity
                    key={g}
                    style={[styles.groupChip, selectedGroup === g && styles.groupChipActive]}
                    onPress={() => setSelectedGroup(g)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.groupChipText, selectedGroup === g && styles.groupChipTextActive]}>
                      {g === 'pratihari' ? 'Pratihari' : 'Gochhikar'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <Text style={styles.inputLabel}>Channels</Text>
            <View style={styles.channelSelector}>
              {(['inapp', 'push', 'sms', 'whatsapp'] as const).map((ch) => {
                const Icon = CHANNEL_ICONS[ch] || Bell;
                const color = CHANNEL_COLORS[ch] || C.saffron;
                const selected = selectedChannels.includes(ch);
                return (
                  <TouchableOpacity
                    key={ch}
                    style={[styles.channelChip, selected && { backgroundColor: color + '15', borderColor: color }]}
                    onPress={() => {
                      setSelectedChannels((prev) =>
                        selected ? prev.filter((c) => c !== ch) : [...prev, ch]
                      );
                    }}
                    activeOpacity={0.7}
                  >
                    <Icon color={color} size={14} />
                    <Text style={[styles.channelChipText, selected && { color }]}>
                      {ch === 'inapp' ? 'In-App' : ch === 'push' ? 'Push' : ch === 'sms' ? 'SMS' : 'WhatsApp'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {sendResult && (
              <View style={[styles.resultBox, sendResult.includes('Sent') ? styles.resultSuccess : styles.resultError]}>
                <Text style={styles.resultText}>{sendResult}</Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.sendBtn, (!composeTitle || !composeMessage || selectedChannels.length === 0 || sending) && styles.sendBtnDisabled]}
              onPress={sendBroadcast}
              disabled={!composeTitle || !composeMessage || selectedChannels.length === 0 || sending}
              activeOpacity={0.85}
            >
              {sending ? (
                <ActivityIndicator color="#fff" size={18} />
              ) : (
                <Send color="#fff" size={18} />
              )}
              <Text style={styles.sendBtnText}>{sending ? 'Sending...' : 'Send Notification'}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── REMINDERS TAB ────────────────────────────────────────── */}
        {activeTab === 'reminders' && reminderConfig && (
          <View>
            <Text style={styles.sectionLabel}>Beddha Reminder Settings</Text>
            <Text style={styles.sectionDesc}>Multi-stage reminders at 5, 3, 1 days before (8 PM) and day-of (4 AM)</Text>

            {[
              { field: 'five_day_reminder_enabled' as const, time: reminderConfig.five_day_reminder_time, label: '5-Day Reminder', desc: '8 PM IST, 5 days before beddha' },
              { field: 'three_day_reminder_enabled' as const, time: reminderConfig.three_day_reminder_time, label: '3-Day Reminder', desc: '8 PM IST, 3 days before beddha' },
              { field: 'one_day_reminder_enabled' as const, time: reminderConfig.one_day_reminder_time, label: '1-Day Reminder', desc: '8 PM IST, 1 day before beddha' },
              { field: 'morning_reminder_enabled' as const, time: reminderConfig.morning_reminder_time, label: 'Day-Of Reminder', desc: '4 AM IST, on the day of seba' },
            ].map((r) => (
              <View key={r.field} style={styles.toggleRow}>
                <View style={[styles.toggleIcon, { backgroundColor: C.saffron + '15' }]}>
                  <Bell color={C.saffron} size={18} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.toggleLabel}>{r.label}</Text>
                  <Text style={styles.toggleStatus}>{r.desc}</Text>
                </View>
                <Switch
                  value={reminderConfig[r.field] as boolean}
                  onValueChange={(v) => toggleReminderSetting(r.field, v)}
                  trackColor={{ false: '#E0D5C8', true: C.saffron + '60' }}
                  thumbColor={reminderConfig[r.field] ? C.saffron : '#fff'}
                />
              </View>
            ))}

            {saveMsg && (
              <View style={[styles.resultBox, saveMsg.includes('success') ? styles.resultSuccess : styles.resultError]}>
                <Text style={styles.resultText}>{saveMsg}</Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.sendBtn, savingReminder && styles.sendBtnDisabled]}
              onPress={saveReminderSettings}
              disabled={savingReminder}
              activeOpacity={0.85}
            >
              {savingReminder ? <ActivityIndicator color="#fff" size={18} /> : <CheckCircle color="#fff" size={18} />}
              <Text style={styles.sendBtnText}>{savingReminder ? 'Saving...' : 'Save Settings'}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── LOGS TAB ─────────────────────────────────────────────── */}
        {activeTab === 'logs' && (
          <View>
            <Text style={styles.sectionLabel}>Delivery Log</Text>
            <Text style={styles.sectionDesc}>Recent notification delivery history</Text>
            {logs.length === 0 ? (
              <View style={styles.emptyState}>
                <ListIcon color={C.textMuted} size={40} />
                <Text style={styles.emptyText}>No notification logs yet</Text>
              </View>
            ) : (
              logs.map((log) => {
                const statusIcon = log.status === 'sent' ? CheckCircle : log.status === 'failed' ? XCircle : AlertCircle;
                const statusColor = log.status === 'sent' ? C.success : log.status === 'failed' ? C.error : C.textMuted;
                const StatusIcon = statusIcon;
                const channelColor = CHANNEL_COLORS[log.channel] || C.saffron;
                return (
                  <View key={log.id} style={styles.logRow}>
                    <View style={[styles.logChannelBadge, { backgroundColor: channelColor + '15' }]}>
                      <Text style={[styles.logChannelText, { color: channelColor }]}>
                        {log.channel === 'inapp' ? 'In-App' : log.channel === 'push' ? 'Push' : log.channel === 'sms' ? 'SMS' : log.channel === 'whatsapp' ? 'WhatsApp' : log.channel}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.logEvent}>{log.event_key}</Text>
                      <Text style={styles.logTime}>
                        {new Date(log.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </View>
                    <View style={styles.logStatus}>
                      <StatusIcon color={statusColor} size={14} />
                      <Text style={[styles.logStatusText, { color: statusColor }]}>{log.status}</Text>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        )}

        {/* ── OTP TAB ─────────────────────────────────────────────── */}
        {activeTab === 'otp' && (
          <View>
            <Text style={styles.sectionLabel}>OTP Delivery Channels</Text>
            <Text style={styles.sectionDesc}>Choose how users receive their login verification code</Text>

            <View style={styles.toggleRow}>
              <View style={[styles.toggleIcon, { backgroundColor: C.teal + '15' }]}>
                <Smartphone color={C.teal} size={18} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.toggleLabel}>SMS</Text>
                <Text style={styles.toggleStatus}>{otpSmsEnabled ? 'Enabled' : 'Disabled'}</Text>
              </View>
              <Switch
                value={otpSmsEnabled}
                onValueChange={(v) => toggleOtpChannel('otp_sms_enabled', v)}
                trackColor={{ false: '#E0D5C8', true: C.saffron + '60' }}
                thumbColor={otpSmsEnabled ? C.saffron : '#fff'}
              />
            </View>

            <View style={styles.toggleRow}>
              <View style={[styles.toggleIcon, { backgroundColor: '#27AE60' + '15' }]}>
                <MessageCircle color="#27AE60" size={18} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.toggleLabel}>WhatsApp</Text>
                <Text style={styles.toggleStatus}>{otpWhatsappEnabled ? 'Enabled' : 'Disabled'}</Text>
              </View>
              <Switch
                value={otpWhatsappEnabled}
                onValueChange={(v) => toggleOtpChannel('otp_whatsapp_enabled', v)}
                trackColor={{ false: '#E0D5C8', true: C.saffron + '60' }}
                thumbColor={otpWhatsappEnabled ? C.saffron : '#fff'}
              />
            </View>

            {otpMsg && (
              <View style={[styles.resultBox, otpMsg.includes('updated') ? styles.resultSuccess : styles.resultError]}>
                <Text style={styles.resultText}>{otpMsg}</Text>
              </View>
            )}

            <View style={styles.otpInfoBox}>
              <Text style={styles.otpInfoText}>
                When both are enabled, users can choose between SMS and WhatsApp on the login screen. When only one is enabled, that channel is used automatically.
              </Text>
            </View>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.warmWhite },
  loadingCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    gap: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: C.cream,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSub: { fontSize: 11, fontFamily: 'Poppins_400Regular', color: C.textMuted },
  headerTitle: { fontSize: 20, fontFamily: 'Poppins_700Bold', color: C.textPrimary },

  tabBar: {
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    maxHeight: 50,
  },
  tabBarContent: { paddingHorizontal: 12, gap: 6 },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: C.saffron },
  tabText: { fontSize: 13, fontFamily: 'Poppins_500Medium', color: C.textMuted },
  tabTextActive: { color: C.saffron, fontFamily: 'Poppins_600SemiBold' },

  content: { flex: 1 },
  contentInner: { paddingHorizontal: 16, paddingTop: 16 },

  sectionLabel: { fontSize: 18, fontFamily: 'Poppins_700Bold', color: C.textPrimary, marginBottom: 4 },
  sectionDesc: { fontSize: 13, fontFamily: 'Poppins_400Regular', color: C.textMuted, marginBottom: 16, lineHeight: 19 },

  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    padding: 14,
    marginBottom: 8,
    gap: 12,
  },
  toggleIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleLabel: { fontSize: 15, fontFamily: 'Poppins_600SemiBold', color: C.textPrimary },
  toggleStatus: { fontSize: 12, fontFamily: 'Poppins_400Regular', color: C.textMuted, marginTop: 2 },

  eventCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    padding: 14,
    marginBottom: 8,
  },
  eventLabel: { fontSize: 14, fontFamily: 'Poppins_600SemiBold', color: C.textPrimary },
  eventKey: { fontSize: 11, fontFamily: 'Poppins_400Regular', color: C.textMuted, marginTop: 2, marginBottom: 10 },
  eventToggles: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  eventToggleItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  eventToggleLabel: { fontSize: 12, fontFamily: 'Poppins_500Medium', color: C.textSecondary },

  inputLabel: { fontSize: 13, fontFamily: 'Poppins_600SemiBold', color: C.textSecondary, marginTop: 14, marginBottom: 6 },
  textInput: {
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: 'Poppins_400Regular',
    color: C.textPrimary,
    backgroundColor: '#fff',
  },
  textArea: { minHeight: 80, textAlignVertical: 'top' as const },

  recipientTypes: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  recipientChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: C.border,
    backgroundColor: '#fff',
  },
  recipientChipActive: { borderColor: C.saffron, backgroundColor: C.saffron + '08' },
  recipientChipText: { fontSize: 13, fontFamily: 'Poppins_500Medium', color: C.textSecondary },
  recipientChipTextActive: { color: C.saffron, fontFamily: 'Poppins_600SemiBold' },

  groupSelector: { flexDirection: 'row', gap: 8, marginTop: 8 },
  groupChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: C.border,
    backgroundColor: '#fff',
  },
  groupChipActive: { borderColor: C.saffron, backgroundColor: C.saffron + '08' },
  groupChipText: { fontSize: 13, fontFamily: 'Poppins_500Medium', color: C.textSecondary },
  groupChipTextActive: { color: C.saffron, fontFamily: 'Poppins_600SemiBold' },

  channelSelector: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  channelChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: C.border,
    backgroundColor: '#fff',
  },
  channelChipText: { fontSize: 13, fontFamily: 'Poppins_500Medium', color: C.textSecondary },

  resultBox: {
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 14,
  },
  resultSuccess: { backgroundColor: '#F0FFF4', borderWidth: 1, borderColor: C.success + '30' },
  resultError: { backgroundColor: '#FFF5F5', borderWidth: 1, borderColor: C.error + '30' },
  resultText: { fontSize: 13, fontFamily: 'Poppins_500Medium', color: C.textPrimary },

  sendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: C.saffron,
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: 18,
  },
  sendBtnDisabled: { opacity: 0.5 },
  sendBtnText: { fontSize: 15, fontFamily: 'Poppins_700Bold', color: '#fff' },

  logRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    padding: 12,
    marginBottom: 6,
    gap: 10,
  },
  logChannelBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  logChannelText: { fontSize: 11, fontFamily: 'Poppins_600SemiBold' },
  logEvent: { fontSize: 12, fontFamily: 'Poppins_500Medium', color: C.textPrimary },
  logTime: { fontSize: 10, fontFamily: 'Poppins_400Regular', color: C.textMuted, marginTop: 2 },
  logStatus: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  logStatusText: { fontSize: 11, fontFamily: 'Poppins_600SemiBold' },

  emptyState: { alignItems: 'center', paddingTop: 40, gap: 12 },
  emptyText: { fontSize: 14, fontFamily: 'Poppins_500Medium', color: C.textMuted },

  otpInfoBox: {
    backgroundColor: C.cream,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 14,
    borderWidth: 1,
    borderColor: C.border,
  },
  otpInfoText: {
    fontSize: 12,
    fontFamily: 'Poppins_400Regular',
    color: C.textSecondary,
    lineHeight: 18,
  },
});
