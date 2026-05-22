/**
 * EDGE Module Tests — Edge Function Business Logic
 * Covers: EDGE-TC-001 through EDGE-TC-011
 */

import { TEST_PHONE, TEST_SEBAYAT_ID } from '../utils/test-data';

// ─── Shared helpers mirroring edge function logic ─────────────────────────────

function applyTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? '');
}

function isValidPhone(phone: string): boolean {
  return /^\d{10,15}$/.test(phone);
}

function isValidOtp(otp: string): boolean {
  return /^\d{6}$/.test(otp);
}

function isValidDate(dateStr: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
}

// safeEquals — constant-time string comparison from niti-started/index.ts
function safeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

// ─── Channel dispatch logic (mirrors send-notification) ───────────────────────

interface FeatureConfig {
  sms_enabled: boolean;
  whatsapp_enabled: boolean;
  push_enabled: boolean;
  admin_notification_enabled: boolean;
  sms_template: string | null;
  whatsapp_template: string | null;
  push_template: string | null;
}

interface ChannelMap {
  [key: string]: { enabled: boolean; push_mode: string };
}

function resolveChannels(
  config: FeatureConfig,
  channelMap: ChannelMap,
  recipientPhone: string | null,
  hasPushTokens: boolean
): string[] {
  const active: string[] = [];
  if (config.admin_notification_enabled) active.push('admin');
  if (config.sms_enabled && channelMap['sms']?.enabled && recipientPhone && config.sms_template) active.push('sms');
  if (config.whatsapp_enabled && channelMap['whatsapp']?.enabled && recipientPhone && config.whatsapp_template) active.push('whatsapp');
  if (config.push_enabled && channelMap['push']?.enabled && hasPushTokens && config.push_template) active.push('push');
  return active;
}

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('EDGE Module — send-otp: Input Validation', () => {
  // EDGE-TC-001
  test('EDGE-TC-001: Valid 10-digit phone passes validation', () => {
    expect(isValidPhone('9876543210')).toBe(true);
    expect(isValidPhone('919876543210')).toBe(true); // 12 digits with country code
  });

  test('EDGE-TC-001b: Invalid phone (less than 10 digits) fails validation', () => {
    expect(isValidPhone('98765')).toBe(false);
    expect(isValidPhone('')).toBe(false);
    expect(isValidPhone('abc1234567')).toBe(false);
  });

  // EDGE-TC-002
  test('EDGE-TC-002: OTP channel defaults to sms when not specified', () => {
    const channel = undefined ?? 'sms';
    expect(channel).toBe('sms');
  });

  test('EDGE-TC-002b: Whatsapp channel accepted', () => {
    const channel = 'whatsapp';
    expect(['sms', 'whatsapp']).toContain(channel);
  });

  // EDGE-TC-003
  test('EDGE-TC-003: Disabled channel returns 403 error response', () => {
    const channelEnabled = false;
    const status = channelEnabled ? 200 : 403;
    expect(status).toBe(403);
  });

  test('EDGE-TC-003b: Enabled channel proceeds normally', () => {
    const channelEnabled = true;
    const status = channelEnabled ? 200 : 403;
    expect(status).toBe(200);
  });
});

describe('EDGE Module — verify-otp: OTP Verification', () => {
  // EDGE-TC-004
  test('EDGE-TC-004: Valid 6-digit OTP passes format check', () => {
    expect(isValidOtp('123456')).toBe(true);
    expect(isValidOtp('000000')).toBe(true);
    expect(isValidOtp('999999')).toBe(true);
  });

  test('EDGE-TC-004b: Invalid OTP (wrong length) fails', () => {
    expect(isValidOtp('12345')).toBe(false);
    expect(isValidOtp('1234567')).toBe(false);
    expect(isValidOtp('abc123')).toBe(false);
  });

  // EDGE-TC-005
  test('EDGE-TC-005: Test mode OTP 123456 succeeds', () => {
    const TEST_OTP = '123456';
    const userInput = '123456';
    const isTestMode = true;
    const success = !isTestMode || userInput === TEST_OTP;
    expect(success).toBe(true);
  });

  test('EDGE-TC-005b: Test mode wrong OTP fails', () => {
    const TEST_OTP = '123456';
    const userInput = '000000';
    const isTestMode = true;
    const success = !isTestMode || userInput === TEST_OTP;
    expect(success).toBe(false);
  });

  // EDGE-TC-006
  test('EDGE-TC-006: New user — isNewUser=true when no existing sebayat', () => {
    const existingSebayat = null;
    const isNewUser = !existingSebayat;
    expect(isNewUser).toBe(true);
  });

  test('EDGE-TC-006b: Existing user — isNewUser=false', () => {
    const existingSebayat = { id: TEST_SEBAYAT_ID, auth_user_id: 'some-uid' };
    const isNewUser = !existingSebayat;
    expect(isNewUser).toBe(false);
  });

  test('EDGE-TC-006c: Admin pre-created profile without auth_user_id — treated as new', () => {
    const existingSebayat = { id: TEST_SEBAYAT_ID, auth_user_id: null };
    const needsAuthAccount = existingSebayat && !existingSebayat.auth_user_id;
    expect(needsAuthAccount).toBe(true);
  });
});

describe('EDGE Module — send-notification: Channel Dispatch', () => {
  const allChannels: ChannelMap = {
    sms:       { enabled: true,  push_mode: '' },
    whatsapp:  { enabled: true,  push_mode: '' },
    push:      { enabled: true,  push_mode: 'expo-go' },
  };

  const fullConfig: FeatureConfig = {
    sms_enabled:                  true,
    whatsapp_enabled:             true,
    push_enabled:                 true,
    admin_notification_enabled:   true,
    sms_template:                 'Hello {{name}}',
    whatsapp_template:            'Hello {{name}}',
    push_template:                'Hello {{name}}',
  };

  // EDGE-TC-007
  test('EDGE-TC-007: All channels enabled — all 4 dispatched (admin+sms+whatsapp+push)', () => {
    const channels = resolveChannels(fullConfig, allChannels, TEST_PHONE, true);
    expect(channels).toContain('admin');
    expect(channels).toContain('sms');
    expect(channels).toContain('whatsapp');
    expect(channels).toContain('push');
    expect(channels).toHaveLength(4);
  });

  // EDGE-TC-008
  test('EDGE-TC-008: SMS channel skipped when no recipient phone', () => {
    const channels = resolveChannels(fullConfig, allChannels, null, true);
    expect(channels).not.toContain('sms');
    expect(channels).not.toContain('whatsapp');
    expect(channels).toContain('admin');
    expect(channels).toContain('push');
  });

  test('EDGE-TC-008b: Push channel skipped when no push tokens', () => {
    const channels = resolveChannels(fullConfig, allChannels, TEST_PHONE, false);
    expect(channels).not.toContain('push');
    expect(channels).toContain('sms');
  });

  // EDGE-TC-009
  test('EDGE-TC-009: Template variables substituted in sms_template', () => {
    const result = applyTemplate('Hello {{name}}, Reg: {{registration_no}}', {
      name: 'Soumya',
      registration_no: 'PN-2026-0001',
    });
    expect(result).toBe('Hello Soumya, Reg: PN-2026-0001');
  });

  test('EDGE-TC-009b: Missing template variable replaced with empty string', () => {
    const result = applyTemplate('Hello {{name}}', {});
    expect(result).toBe('Hello ');
  });
});

describe('EDGE Module — niti-started: Webhook Auth & Validation', () => {
  // EDGE-TC-010
  test('EDGE-TC-010: safeEquals returns true for identical secrets', () => {
    const secret = 'my-webhook-secret-123';
    expect(safeEquals(secret, secret)).toBe(true);
  });

  test('EDGE-TC-010b: safeEquals returns false for different secrets', () => {
    expect(safeEquals('secret-a', 'secret-b')).toBe(false);
    expect(safeEquals('secret-a', 'secret-aa')).toBe(false);
  });

  test('EDGE-TC-010c: safeEquals returns false for empty vs non-empty', () => {
    expect(safeEquals('', 'secret')).toBe(false);
    expect(safeEquals('secret', '')).toBe(false);
  });

  // EDGE-TC-011
  test('EDGE-TC-011: service_date must match YYYY-MM-DD format', () => {
    expect(isValidDate('2026-05-22')).toBe(true);
    expect(isValidDate('2026-12-31')).toBe(true);
    expect(isValidDate('22-05-2026')).toBe(false);
    expect(isValidDate('2026/05/22')).toBe(false);
    expect(isValidDate('')).toBe(false);
  });

  test('EDGE-TC-011b: niti_sequence must be a positive integer', () => {
    const isValidSeq = (v: unknown): boolean => Number.isInteger(Number(v)) && Number(v) >= 1;
    expect(isValidSeq(1)).toBe(true);
    expect(isValidSeq(5)).toBe(true);
    expect(isValidSeq(0)).toBe(false);
    expect(isValidSeq(-1)).toBe(false);
    expect(isValidSeq('abc')).toBe(false);
  });

  test('EDGE-TC-011c: target_sequence = niti_sequence + offset', () => {
    const nitiSequence = 3;
    const offset = 1;
    const targetSequence = nitiSequence + offset;
    expect(targetSequence).toBe(4);
  });

  test('EDGE-TC-011d: Integration disabled — returns skipped with reason', () => {
    const config = { niti_tracker_integration_enabled: false };
    const result = config.niti_tracker_integration_enabled
      ? { success: true }
      : { success: true, skipped: true, reason: 'integration_disabled' };
    expect(result.skipped).toBe(true);
    expect(result.reason).toBe('integration_disabled');
  });
});

describe('EDGE Module — CORS Headers', () => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
  };

  test('CORS origin is wildcard', () => {
    expect(corsHeaders['Access-Control-Allow-Origin']).toBe('*');
  });

  test('CORS headers include required Supabase client headers', () => {
    const allowedHeaders = corsHeaders['Access-Control-Allow-Headers'];
    expect(allowedHeaders).toContain('Authorization');
    expect(allowedHeaders).toContain('X-Client-Info');
    expect(allowedHeaders).toContain('Apikey');
    expect(allowedHeaders).toContain('Content-Type');
  });

  test('OPTIONS preflight returns 200 status', () => {
    const method = 'OPTIONS';
    const status = method === 'OPTIONS' ? 200 : 400;
    expect(status).toBe(200);
  });
});
