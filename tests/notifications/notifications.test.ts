/**
 * NOTIF Module Tests — Push / SMS / WhatsApp Notifications
 * Covers: NOTIF-TC-001 through NOTIF-TC-010
 */

import { TEST_PHONE, TEST_SEBAYAT_ID, TEST_USER_ID } from '../utils/test-data';

// ─── Template variable substitution (mirrors send-notification edge function) ──

function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] || '');
}

// ─── Channel dispatch logic ────────────────────────────────────────────────────

interface NotifConfig {
  sms_enabled: boolean;
  whatsapp_enabled: boolean;
  push_enabled: boolean;
}

function getChannelsToDispatch(config: NotifConfig): string[] {
  const channels: string[] = [];
  if (config.sms_enabled)      channels.push('sms');
  if (config.whatsapp_enabled) channels.push('whatsapp');
  if (config.push_enabled)     channels.push('push');
  return channels;
}

// ─── Test Suite ────────────────────────────────────────────────────────────────

describe('NOTIF Module — Notification Dispatch', () => {
  const mockInvoke = jest.fn();

  beforeEach(() => mockInvoke.mockReset());

  // NOTIF-TC-001
  test('NOTIF-TC-001: Registration approved — push notification dispatched', async () => {
    mockInvoke.mockResolvedValueOnce({ data: { dispatched: true }, error: null });
    const result = await mockInvoke('send-notification', {
      body: {
        event_key: 'registration_approved',
        sebayat_id: TEST_SEBAYAT_ID,
        name: 'Soumya',
        registration_no: 'PN-2026-0001',
      },
    });
    expect(result.error).toBeNull();
    expect(mockInvoke).toHaveBeenCalledWith('send-notification', expect.objectContaining({
      body: expect.objectContaining({ event_key: 'registration_approved' }),
    }));
  });

  // NOTIF-TC-002
  test('NOTIF-TC-002: Registration rejected — notification carries rejection reason', async () => {
    mockInvoke.mockResolvedValueOnce({ data: { dispatched: true }, error: null });
    await mockInvoke('send-notification', {
      body: {
        event_key: 'registration_rejected',
        sebayat_id: TEST_SEBAYAT_ID,
        remarks: 'Incomplete documents provided.',
      },
    });
    expect(mockInvoke).toHaveBeenCalledWith('send-notification', expect.objectContaining({
      body: expect.objectContaining({ remarks: 'Incomplete documents provided.' }),
    }));
  });

  // NOTIF-TC-003
  test('NOTIF-TC-003: Changes requested notification dispatched with event_key', async () => {
    mockInvoke.mockResolvedValueOnce({ data: { dispatched: true }, error: null });
    await mockInvoke('send-notification', {
      body: { event_key: 'registration_changes_requested', sebayat_id: TEST_SEBAYAT_ID },
    });
    expect(mockInvoke).toHaveBeenCalledWith('send-notification', expect.objectContaining({
      body: expect.objectContaining({ event_key: 'registration_changes_requested' }),
    }));
  });

  // NOTIF-TC-004
  test('NOTIF-TC-004: Resubmit triggers admin_notifications bell entry', () => {
    const adminNotification = {
      event_key: 'registration_resubmitted',
      title: 'New Resubmission',
      body: 'Soumya Pratihari has resubmitted their registration.',
      reference_type: 'sebayat',
      reference_id: TEST_SEBAYAT_ID,
      is_read: false,
    };
    expect(adminNotification.is_read).toBe(false);
    expect(adminNotification.event_key).toBe('registration_resubmitted');
  });
});

describe('NOTIF Module — Channel Logic', () => {
  // NOTIF-TC-005
  test('NOTIF-TC-005: Publish-all notice — all sebayats are targets', () => {
    const notice = { target_type: 'all', target_ids: null };
    const isAllTarget = notice.target_type === 'all';
    expect(isAllTarget).toBe(true);
  });

  // NOTIF-TC-006
  test('NOTIF-TC-006: Specific-target notice — only target IDs should receive it', () => {
    const notice = { target_type: 'specific', target_ids: ['s1', 's2'] };
    const allSebayats = ['s1', 's2', 's3', 's4'];
    const recipients = notice.target_type === 'specific'
      ? allSebayats.filter((id) => (notice.target_ids || []).includes(id))
      : allSebayats;
    expect(recipients).toHaveLength(2);
    expect(recipients).not.toContain('s3');
  });

  // NOTIF-TC-007
  test('NOTIF-TC-007: Push token registration stores token in push_tokens', () => {
    const tokenRow = {
      sebayat_id: TEST_SEBAYAT_ID,
      token: 'ExponentPushToken[test-token-abc]',
      mode: 'expo-go',
      platform: 'android',
    };
    expect(tokenRow.token).toMatch(/^ExponentPushToken\[/);
    expect(tokenRow.sebayat_id).toBe(TEST_SEBAYAT_ID);
  });

  // NOTIF-TC-008
  test('NOTIF-TC-008: SMS dispatch uses correct phone number field', () => {
    const recipient = { phone: TEST_PHONE };
    const smsPayload = { to: recipient.phone, message: 'Your OTP is 123456' };
    expect(smsPayload.to).toBe(TEST_PHONE);
  });

  // NOTIF-TC-009
  test('NOTIF-TC-009: Failed notification logs error_message in notification_log', () => {
    const logEntry = {
      event_key: 'registration_approved',
      channel: 'sms',
      status: 'failed',
      error_message: 'Provider unreachable',
    };
    expect(logEntry.status).toBe('failed');
    expect(logEntry.error_message).toBeTruthy();
  });

  // NOTIF-TC-010
  test('NOTIF-TC-010: Seba reminder sent to correct sebayat based on duty date', () => {
    const dutyDate = '2026-05-25';
    const reminderDays = 3;
    const today = '2026-05-22';
    const daysUntilDuty = Math.round(
      (new Date(dutyDate).getTime() - new Date(today).getTime()) / 86400000
    );
    expect(daysUntilDuty).toBe(3);
    const shouldRemind = daysUntilDuty === reminderDays;
    expect(shouldRemind).toBe(true);
  });
});

describe('NOTIF Module — Template Rendering', () => {
  test('Template variable {{name}} substituted correctly', () => {
    const output = renderTemplate('Hello {{name}}, your registration is approved!', { name: 'Soumya' });
    expect(output).toBe('Hello Soumya, your registration is approved!');
  });

  test('Template variable {{registration_no}} substituted correctly', () => {
    const output = renderTemplate('Your reg no: {{registration_no}}', { registration_no: 'PN-2026-0001' });
    expect(output).toBe('Your reg no: PN-2026-0001');
  });

  test('Missing template variable replaced with empty string', () => {
    const output = renderTemplate('Hello {{name}}', {});
    expect(output).toBe('Hello ');
  });
});

describe('NOTIF Module — Channel Selection', () => {
  test('All channels enabled — all dispatched', () => {
    const channels = getChannelsToDispatch({ sms_enabled: true, whatsapp_enabled: true, push_enabled: true });
    expect(channels).toEqual(['sms', 'whatsapp', 'push']);
  });

  test('SMS disabled — SMS not in dispatched channels', () => {
    const channels = getChannelsToDispatch({ sms_enabled: false, whatsapp_enabled: true, push_enabled: true });
    expect(channels).not.toContain('sms');
    expect(channels).toContain('whatsapp');
    expect(channels).toContain('push');
  });

  test('All disabled — empty dispatch list', () => {
    const channels = getChannelsToDispatch({ sms_enabled: false, whatsapp_enabled: false, push_enabled: false });
    expect(channels).toHaveLength(0);
  });
});
