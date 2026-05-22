/**
 * React Context mocks for AuthContext, LanguageContext, OfflineContext
 */

export const mockUser = {
  id: 'test-user-id',
  phone: '+919999999999',
  user_metadata: { phone: '9999999999' },
  app_metadata: {},
  aud: 'authenticated',
  created_at: '2026-01-01T00:00:00Z',
};

export const mockSignOut = jest.fn();

jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: mockUser,
    signOut: mockSignOut,
    loading: false,
  }),
  AuthProvider: ({ children }: any) => children,
}));

jest.mock('../../contexts/LanguageContext', () => ({
  useLanguage: () => ({
    language: 'en',
    setLanguage: jest.fn(),
  }),
  LanguageProvider: ({ children }: any) => children,
}));

jest.mock('../../contexts/OfflineContext', () => ({
  useOffline: () => ({
    isOnline: true,
    offlineEnabled: false,
    setOfflineEnabled: jest.fn(),
  }),
  OfflineProvider: ({ children }: any) => children,
}));
