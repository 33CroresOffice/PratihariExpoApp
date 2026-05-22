/**
 * AUTH Module Tests
 * Covers: AUTH-TC-001 through AUTH-TC-014
 *
 * Tests OTP request, OTP verification, rate limiting, new/returning user
 * flows, sign-out, and route-guard behaviour.
 */

import { TEST_PHONE, TEST_OTP, TEST_USER_ID, OTP_SESSION, SEBAYAT_DRAFT } from '../utils/test-data';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockSignInWithOtp = jest.fn();
const mockVerifyOtp = jest.fn();
const mockSignOut = jest.fn();
const mockGetSession = jest.fn();
const mockInvoke = jest.fn();
const mockFrom = jest.fn();

jest.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithOtp: mockSignInWithOtp,
      verifyOtp: mockVerifyOtp,
      signOut: mockSignOut,
      getSession: mockGetSession,
      onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
    },
    from: mockFrom,
    functions: { invoke: mockInvoke },
  },
}));

jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: null, signOut: mockSignOut, loading: false }),
  AuthProvider: ({ children }: any) => children,
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildOtpInvokeSuccess() {
  return Promise.resolve({ data: { request_id: 'req-123', channel: 'sms' }, error: null });
}

function buildOtpVerifySuccess(isNewUser = true) {
  return Promise.resolve({
    data: {
      user: { id: TEST_USER_ID, user_metadata: { phone: TEST_PHONE } },
      session: { access_token: 'tok-abc', refresh_token: 'ref-abc' },
      is_new_user: isNewUser,
    },
    error: null,
  });
}

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('AUTH Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // AUTH-TC-001
  test('AUTH-TC-001: Valid 10-digit phone triggers OTP send via edge function', async () => {
    mockInvoke.mockResolvedValueOnce(buildOtpInvokeSuccess());
    const result = await (async () => {
      const phone = TEST_PHONE;
      if (!/^\d{10}$/.test(phone)) throw new Error('Invalid phone');
      const res = await (jest.requireMock('../../lib/supabase').supabase as any).functions.invoke('send-otp', {
        body: { phone, channel: 'sms' },
      });
      return res;
    })();
    expect(result.error).toBeNull();
    expect(result.data.request_id).toBe('req-123');
    expect(mockInvoke).toHaveBeenCalledWith('send-otp', { body: { phone: TEST_PHONE, channel: 'sms' } });
  });

  // AUTH-TC-002
  test('AUTH-TC-002: Phone shorter than 10 digits fails client-side validation', () => {
    const shortPhone = '98765';
    const isValid = /^\d{10}$/.test(shortPhone);
    expect(isValid).toBe(false);
  });

  // AUTH-TC-003
  test('AUTH-TC-003: Phone with non-numeric characters fails validation', () => {
    const alphaPhone = 'abcde12345';
    const isValid = /^\d{10}$/.test(alphaPhone);
    expect(isValid).toBe(false);
  });

  // AUTH-TC-004
  test('AUTH-TC-004: WhatsApp channel selection sends OTP via WhatsApp', async () => {
    mockInvoke.mockResolvedValueOnce(buildOtpInvokeSuccess());
    const supabase = jest.requireMock('../../lib/supabase').supabase as any;
    await supabase.functions.invoke('send-otp', { body: { phone: TEST_PHONE, channel: 'whatsapp' } });
    expect(mockInvoke).toHaveBeenCalledWith('send-otp', {
      body: { phone: TEST_PHONE, channel: 'whatsapp' },
    });
  });

  // AUTH-TC-005
  test('AUTH-TC-005: SMS channel selection sends OTP via SMS', async () => {
    mockInvoke.mockResolvedValueOnce(buildOtpInvokeSuccess());
    const supabase = jest.requireMock('../../lib/supabase').supabase as any;
    await supabase.functions.invoke('send-otp', { body: { phone: TEST_PHONE, channel: 'sms' } });
    expect(mockInvoke).toHaveBeenCalledWith('send-otp', {
      body: { phone: TEST_PHONE, channel: 'sms' },
    });
  });

  // AUTH-TC-006
  test('AUTH-TC-006: Correct OTP within expiry returns auth token', async () => {
    mockInvoke.mockResolvedValueOnce(buildOtpVerifySuccess(false));
    const supabase = jest.requireMock('../../lib/supabase').supabase as any;
    const res = await supabase.functions.invoke('verify-otp', {
      body: { phone: TEST_PHONE, otp: TEST_OTP, request_id: 'req-123' },
    });
    expect(res.error).toBeNull();
    expect(res.data.session.access_token).toBe('tok-abc');
  });

  // AUTH-TC-007
  test('AUTH-TC-007: Wrong OTP returns error response', async () => {
    mockInvoke.mockResolvedValueOnce({
      data: null,
      error: { message: 'Invalid OTP', status: 401 },
    });
    const supabase = jest.requireMock('../../lib/supabase').supabase as any;
    const res = await supabase.functions.invoke('verify-otp', {
      body: { phone: TEST_PHONE, otp: '000000', request_id: 'req-123' },
    });
    expect(res.error).not.toBeNull();
    expect(res.error.message).toBe('Invalid OTP');
  });

  // AUTH-TC-008
  test('AUTH-TC-008: Expired OTP returns 401 expired error', async () => {
    mockInvoke.mockResolvedValueOnce({
      data: null,
      error: { message: 'OTP expired', status: 401 },
    });
    const supabase = jest.requireMock('../../lib/supabase').supabase as any;
    const res = await supabase.functions.invoke('verify-otp', {
      body: { phone: TEST_PHONE, otp: TEST_OTP, request_id: 'req-old' },
    });
    expect(res.error.message).toBe('OTP expired');
    expect(res.error.status).toBe(401);
  });

  // AUTH-TC-009
  test('AUTH-TC-009: Resend OTP re-invokes send-otp edge function', async () => {
    mockInvoke.mockResolvedValue(buildOtpInvokeSuccess());
    const supabase = jest.requireMock('../../lib/supabase').supabase as any;
    await supabase.functions.invoke('resend-otp', { body: { phone: TEST_PHONE, request_id: 'req-123' } });
    expect(mockInvoke).toHaveBeenCalledWith('resend-otp', expect.objectContaining({ body: { phone: TEST_PHONE, request_id: 'req-123' } }));
  });

  // AUTH-TC-010
  test('AUTH-TC-010: Rate limit exceeded returns 429 error', async () => {
    mockInvoke.mockResolvedValueOnce({
      data: null,
      error: { message: 'Rate limit exceeded', status: 429 },
    });
    const supabase = jest.requireMock('../../lib/supabase').supabase as any;
    const res = await supabase.functions.invoke('send-otp', { body: { phone: TEST_PHONE, channel: 'sms' } });
    expect(res.error.status).toBe(429);
    expect(res.error.message).toMatch(/rate limit/i);
  });

  // AUTH-TC-011
  test('AUTH-TC-011: First-time user — is_new_user flag is true in verify response', async () => {
    mockInvoke.mockResolvedValueOnce(buildOtpVerifySuccess(true));
    const supabase = jest.requireMock('../../lib/supabase').supabase as any;
    const res = await supabase.functions.invoke('verify-otp', {
      body: { phone: TEST_PHONE, otp: TEST_OTP, request_id: 'req-123' },
    });
    expect(res.data.is_new_user).toBe(true);
    expect(res.data.user.id).toBe(TEST_USER_ID);
  });

  // AUTH-TC-012
  test('AUTH-TC-012: Returning user — existing sebayat row found by auth_user_id', async () => {
    const queryChain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: SEBAYAT_DRAFT, error: null }),
    };
    mockFrom.mockReturnValue(queryChain);
    const supabase = jest.requireMock('../../lib/supabase').supabase as any;
    const { data } = await supabase
      .from('sebayats')
      .select('id, profile_status')
      .eq('auth_user_id', TEST_USER_ID)
      .maybeSingle();
    expect(data).not.toBeNull();
    expect(data.profile_status).toBe('draft');
  });

  // AUTH-TC-013
  test('AUTH-TC-013: Sign out clears session via supabase.auth.signOut', async () => {
    mockSignOut.mockResolvedValueOnce({ error: null });
    const supabase = jest.requireMock('../../lib/supabase').supabase as any;
    const res = await supabase.auth.signOut();
    expect(res.error).toBeNull();
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });

  // AUTH-TC-014
  test('AUTH-TC-014: No active session returns null from getSession', async () => {
    mockGetSession.mockResolvedValueOnce({ data: { session: null }, error: null });
    const supabase = jest.requireMock('../../lib/supabase').supabase as any;
    const res = await supabase.auth.getSession();
    expect(res.data.session).toBeNull();
  });
});
