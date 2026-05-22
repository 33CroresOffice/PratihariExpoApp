/**
 * Supabase client mock — intercepts all DB and auth calls in tests.
 * Returns configurable mock data via mockReturnValue / mockResolvedValue.
 */

export const mockSupabaseSelect = jest.fn();
export const mockSupabaseInsert = jest.fn();
export const mockSupabaseUpdate = jest.fn();
export const mockSupabaseUpsert = jest.fn();
export const mockSupabaseDelete = jest.fn();
export const mockSupabaseFrom = jest.fn();
export const mockSupabaseEq = jest.fn();
export const mockSupabaseMaybeSingle = jest.fn();
export const mockSupabaseSingle = jest.fn();
export const mockSupabaseSignInWithOtp = jest.fn();
export const mockSupabaseVerifyOtp = jest.fn();
export const mockSupabaseSignOut = jest.fn();
export const mockSupabaseGetSession = jest.fn();
export const mockSupabaseGetUser = jest.fn();
export const mockSupabaseOnAuthStateChange = jest.fn();
export const mockStorageUpload = jest.fn();
export const mockStorageGetPublicUrl = jest.fn();

const buildQueryChain = (resolvedValue: any = { data: null, error: null }) => {
  const chain: any = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    upsert: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    neq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    lte: jest.fn().mockReturnThis(),
    ilike: jest.fn().mockReturnThis(),
    filter: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(resolvedValue),
    maybeSingle: jest.fn().mockResolvedValue(resolvedValue),
    then: jest.fn().mockResolvedValue(resolvedValue),
  };
  // Make the chain itself thenable (awaitable)
  chain[Symbol.iterator] = undefined;
  Object.defineProperty(chain, 'then', {
    get: () => (resolve: any) => Promise.resolve(resolvedValue).then(resolve),
  });
  return chain;
};

export const createMockSupabase = (defaultData: any = null) => ({
  from: jest.fn(() => buildQueryChain({ data: defaultData, error: null })),
  auth: {
    signInWithOtp: mockSupabaseSignInWithOtp.mockResolvedValue({ data: {}, error: null }),
    verifyOtp: mockSupabaseVerifyOtp.mockResolvedValue({
      data: { user: { id: 'test-user-id', user_metadata: { phone: '9999999999' } }, session: { access_token: 'test-token' } },
      error: null,
    }),
    signOut: mockSupabaseSignOut.mockResolvedValue({ error: null }),
    getSession: mockSupabaseGetSession.mockResolvedValue({
      data: { session: { access_token: 'test-token', user: { id: 'test-user-id' } } },
      error: null,
    }),
    getUser: mockSupabaseGetUser.mockResolvedValue({
      data: { user: { id: 'test-user-id', user_metadata: { phone: '9999999999' } } },
      error: null,
    }),
    onAuthStateChange: mockSupabaseOnAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: jest.fn() } },
    }),
  },
  storage: {
    from: jest.fn(() => ({
      upload: mockStorageUpload.mockResolvedValue({ data: { path: 'test/path.jpg' }, error: null }),
      getPublicUrl: mockStorageGetPublicUrl.mockReturnValue({ data: { publicUrl: 'https://example.com/test.jpg' } }),
    })),
  },
  functions: {
    invoke: jest.fn().mockResolvedValue({ data: { success: true }, error: null }),
  },
});

export const mockSupabase = createMockSupabase();

jest.mock('../../lib/supabase', () => ({
  supabase: mockSupabase,
}));
