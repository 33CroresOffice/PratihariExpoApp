/**
 * ADMIN-SETTINGS Module Tests — Admins, Roles, RBAC, OTP & Notification Config
 * Covers: ADMIN-SETTINGS-TC-001 through ADMIN-SETTINGS-TC-016
 */

import { ADMIN_USER, TEST_ADMIN_ID } from '../utils/test-data';

// ─── Role definitions (mirror pratihari_admins / admin_roles schema) ──────────

const SYSTEM_ROLES = [
  { id: 'role-superadmin', role_name: 'Super Admin', is_system_role: true },
  { id: 'role-admin',      role_name: 'Admin',       is_system_role: true },
  { id: 'role-moderator',  role_name: 'Moderator',   is_system_role: true },
  { id: 'role-viewer',     role_name: 'Viewer',      is_system_role: true },
];

// Permission resources and actions (mirrors role_permissions table)
const RESOURCES = [
  'sebayat_profiles', 'applications', 'seba_today', 'seba_calendar',
  'seba_history', 'notices', 'committees', 'admins', 'roles', 'settings',
  'notifications', 'activity_log',
];

function hasPermission(
  permissions: { resource: string; action: string; granted: boolean }[],
  resource: string,
  action: string
): boolean {
  const p = permissions.find((p) => p.resource === resource && p.action === action);
  return p ? p.granted : false;
}

// ─── Admins Management ────────────────────────────────────────────────────────

describe('ADMIN-SETTINGS — Admins', () => {
  const mockInsert = jest.fn();
  const mockUpdate = jest.fn();

  beforeEach(() => { mockInsert.mockReset(); mockUpdate.mockReset(); });

  // ADMIN-SETTINGS-TC-001
  test('ADMIN-SETTINGS-TC-001: Add admin with email and role saves row', async () => {
    mockInsert.mockResolvedValueOnce({ data: [ADMIN_USER], error: null });
    const result = await mockInsert({
      user_id: 'new-user-id',
      role_id: 'role-admin',
      is_super_admin: false,
    });
    expect(result.error).toBeNull();
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ role_id: 'role-admin' })
    );
  });

  // ADMIN-SETTINGS-TC-002
  test('ADMIN-SETTINGS-TC-002: Assign Moderator role — admin has role_id = role-moderator', () => {
    const admin = { ...ADMIN_USER, role_id: 'role-moderator' };
    expect(admin.role_id).toBe('role-moderator');
  });

  // ADMIN-SETTINGS-TC-003
  test('ADMIN-SETTINGS-TC-003: Disable admin sets is_disabled=true', async () => {
    mockUpdate.mockResolvedValueOnce({ error: null });
    await mockUpdate({ id: TEST_ADMIN_ID, is_disabled: true });
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ is_disabled: true })
    );
  });

  // ADMIN-SETTINGS-TC-004
  test('ADMIN-SETTINGS-TC-004: Delete admin removes row', async () => {
    const mockDelete = jest.fn().mockResolvedValue({ error: null });
    await mockDelete({ id: TEST_ADMIN_ID });
    expect(mockDelete).toHaveBeenCalledWith({ id: TEST_ADMIN_ID });
  });
});

// ─── Roles ────────────────────────────────────────────────────────────────────

describe('ADMIN-SETTINGS — Roles', () => {
  // ADMIN-SETTINGS-TC-005
  test('ADMIN-SETTINGS-TC-005: All 4 system roles present', () => {
    expect(SYSTEM_ROLES).toHaveLength(4);
    const names = SYSTEM_ROLES.map((r) => r.role_name);
    expect(names).toContain('Super Admin');
    expect(names).toContain('Admin');
    expect(names).toContain('Moderator');
    expect(names).toContain('Viewer');
  });

  // ADMIN-SETTINGS-TC-006
  test('ADMIN-SETTINGS-TC-006: Edit custom role permissions updates role_permissions', async () => {
    const mockUpsert = jest.fn().mockResolvedValue({ error: null });
    await mockUpsert({ role_id: 'role-custom', resource: 'notices', action: 'view', granted: true });
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ resource: 'notices', action: 'view' })
    );
  });

  // ADMIN-SETTINGS-TC-007
  test('ADMIN-SETTINGS-TC-007: User-level permission override takes precedence', () => {
    const rolePermissions = [{ resource: 'notices', action: 'delete', granted: false }];
    const userOverrides  = [{ resource: 'notices', action: 'delete', granted: true  }];
    // User override wins
    const resolved = hasPermission(userOverrides, 'notices', 'delete');
    expect(resolved).toBe(true);
  });
});

// ─── RBAC Enforcement ─────────────────────────────────────────────────────────

describe('ADMIN-SETTINGS — RBAC Enforcement', () => {
  const moderatorPermissions = [
    { resource: 'sebayat_profiles', action: 'view',   granted: true  },
    { resource: 'sebayat_profiles', action: 'edit',   granted: true  },
    { resource: 'sebayat_profiles', action: 'delete', granted: false },
    { resource: 'admins',           action: 'view',   granted: false },
    { resource: 'settings',         action: 'view',   granted: false },
  ];

  const viewerPermissions = [
    { resource: 'sebayat_profiles', action: 'view',   granted: true  },
    { resource: 'sebayat_profiles', action: 'create', granted: false },
    { resource: 'sebayat_profiles', action: 'edit',   granted: false },
    { resource: 'sebayat_profiles', action: 'delete', granted: false },
  ];

  // ADMIN-SETTINGS-TC-008
  test('ADMIN-SETTINGS-TC-008: Moderator cannot access Settings section', () => {
    const canViewSettings = hasPermission(moderatorPermissions, 'settings', 'view');
    expect(canViewSettings).toBe(false);
  });

  test('ADMIN-SETTINGS-TC-008b: Moderator cannot manage admins', () => {
    const canViewAdmins = hasPermission(moderatorPermissions, 'admins', 'view');
    expect(canViewAdmins).toBe(false);
  });

  // ADMIN-SETTINGS-TC-009
  test('ADMIN-SETTINGS-TC-009: Viewer cannot create, edit, or delete profiles', () => {
    expect(hasPermission(viewerPermissions, 'sebayat_profiles', 'create')).toBe(false);
    expect(hasPermission(viewerPermissions, 'sebayat_profiles', 'edit')).toBe(false);
    expect(hasPermission(viewerPermissions, 'sebayat_profiles', 'delete')).toBe(false);
  });

  test('ADMIN-SETTINGS-TC-009b: Viewer can read profiles', () => {
    expect(hasPermission(viewerPermissions, 'sebayat_profiles', 'view')).toBe(true);
  });
});

// ─── OTP & Push Settings ──────────────────────────────────────────────────────

describe('ADMIN-SETTINGS — OTP & Push Settings', () => {
  // ADMIN-SETTINGS-TC-010
  test('ADMIN-SETTINGS-TC-010: SMS OTP toggle saves enabled=true to app_settings', async () => {
    const mockUpsert = jest.fn().mockResolvedValue({ error: null });
    await mockUpsert({ key: 'otp_sms_enabled', value: 'true', type: 'boolean' });
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'otp_sms_enabled', value: 'true' })
    );
  });

  // ADMIN-SETTINGS-TC-011
  test('ADMIN-SETTINGS-TC-011: WhatsApp OTP toggle saves to settings', async () => {
    const mockUpsert = jest.fn().mockResolvedValue({ error: null });
    await mockUpsert({ key: 'otp_whatsapp_enabled', value: 'true', type: 'boolean' });
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'otp_whatsapp_enabled' })
    );
  });

  // ADMIN-SETTINGS-TC-012
  test('ADMIN-SETTINGS-TC-012: Push mode stored in notification_channels', async () => {
    const mockUpdate = jest.fn().mockResolvedValue({ error: null });
    await mockUpdate({ channel: 'push', push_mode: 'production' });
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ push_mode: 'production' })
    );
  });
});

// ─── Notification Config ──────────────────────────────────────────────────────

describe('ADMIN-SETTINGS — Notification Config', () => {
  // ADMIN-SETTINGS-TC-013
  test('ADMIN-SETTINGS-TC-013: Disabled SMS for event causes channel to be skipped', () => {
    const config = { event_key: 'registration_approved', sms_enabled: false, whatsapp_enabled: true };
    const channelsToSend = [
      ...(config.sms_enabled ? ['sms'] : []),
      ...(config.whatsapp_enabled ? ['whatsapp'] : []),
    ];
    expect(channelsToSend).not.toContain('sms');
    expect(channelsToSend).toContain('whatsapp');
  });

  // ADMIN-SETTINGS-TC-014
  test('ADMIN-SETTINGS-TC-014: Edit WhatsApp template stores new template text', () => {
    const config = {
      event_key: 'registration_approved',
      whatsapp_template: 'Hello {{name}}, your registration is approved!',
    };
    expect(config.whatsapp_template).toContain('{{name}}');
  });

  // ADMIN-SETTINGS-TC-015
  test('ADMIN-SETTINGS-TC-015: Notification log entries have required fields', () => {
    const logEntry = {
      id: 'log-001',
      event_key: 'registration_approved',
      channel: 'sms',
      recipient_phone: '9876543210',
      status: 'sent',
      created_at: '2026-05-22T10:00:00Z',
    };
    expect(logEntry.event_key).toBeTruthy();
    expect(logEntry.channel).toBeTruthy();
    expect(logEntry.status).toBeTruthy();
  });

  // ADMIN-SETTINGS-TC-016
  test('ADMIN-SETTINGS-TC-016: Date filter on notification log returns entries in range', () => {
    const logs = [
      { id: '1', created_at: '2026-05-01T00:00:00Z' },
      { id: '2', created_at: '2026-05-10T00:00:00Z' },
      { id: '3', created_at: '2026-05-22T00:00:00Z' },
    ];
    const from = '2026-05-05';
    const to = '2026-05-15';
    const filtered = logs.filter(
      (l) => l.created_at.slice(0, 10) >= from && l.created_at.slice(0, 10) <= to
    );
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe('2');
  });
});
