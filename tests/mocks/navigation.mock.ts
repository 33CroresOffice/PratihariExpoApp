/**
 * Expo Router navigation mocks
 */

export const mockPush = jest.fn();
export const mockReplace = jest.fn();
export const mockBack = jest.fn();
export const mockLocalSearchParams: Record<string, string> = {};

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
    back: mockBack,
  }),
  useLocalSearchParams: () => mockLocalSearchParams,
  useSegments: () => [],
  usePathname: () => '/',
  Link: ({ children }: any) => children,
  router: {
    push: mockPush,
    replace: mockReplace,
    back: mockBack,
  },
  Stack: {
    Screen: () => null,
  },
  Tabs: {
    Screen: () => null,
  },
}));
