/**
 * Shared test fixtures used across all test modules.
 */

export const TEST_PHONE = '9876543210';
export const TEST_PHONE_WITH_CODE = '+919876543210';
export const TEST_OTP = '123456';
export const TEST_USER_ID = 'usr-test-0001';
export const TEST_SEBAYAT_ID = 'seb-test-0001';
export const TEST_ADMIN_ID = 'adm-test-0001';
export const TEST_REG_NUMBER = 'PN-2026-0001';

export const SEBAYAT_DRAFT: Record<string, any> = {
  id: TEST_SEBAYAT_ID,
  auth_user_id: TEST_USER_ID,
  profile_status: 'draft',
  first_name: 'Soumya',
  middle_name: 'Ranjan',
  last_name: 'Pratihari',
  full_name: 'Soumya Ranjan Pratihari',
  alias_name: '',
  date_of_birth: '1990-01-15',
  gender: 'Male',
  blood_group: 'A+',
  is_bhagari: true,
  is_baristha_bhai_pua: false,
  health_card_no: 'HC001',
  health_card_photo_url: 'https://example.com/hc.jpg',
  photo_url: 'https://example.com/photo.jpg',
  primary_phone: '9876543210',
  whatsapp_number: '9876543210',
  email: 'soumya@example.com',
  extra_phones: [],
  father_name: 'Ranjan Pratihari',
  mother_name: 'Malati Pratihari',
  marital_status: 'Married',
  spouse_name: 'Sunita Pratihari',
  spouse_father_name: 'Govind Das',
  spouse_mother_name: 'Kamala Das',
  bansa_name: 'Badu',
  palia_number: '3',
  seba_name: 'Singha Dwara',
  permanent_sahi: 'Grand Road Sahi',
  permanent_landmark: 'Near Temple Gate',
  permanent_post_office: 'Puri HO',
  permanent_police_station: 'Puri Town',
  permanent_pincode: '752001',
  permanent_district: 'Puri',
  permanent_state: 'Odisha',
  permanent_country: 'India',
  admin_remarks: '',
  change_section: null,
  change_sections: null,
};

export const SEBAYAT_SUBMITTED: Record<string, any> = {
  ...SEBAYAT_DRAFT,
  profile_status: 'submitted',
  submitted_at: '2026-05-01T10:00:00Z',
};

export const SEBAYAT_APPROVED: Record<string, any> = {
  ...SEBAYAT_SUBMITTED,
  profile_status: 'approved',
  registration_no: TEST_REG_NUMBER,
  reviewed_at: '2026-05-05T10:00:00Z',
};

export const SEBAYAT_CHANGES_REQUESTED: Record<string, any> = {
  ...SEBAYAT_SUBMITTED,
  profile_status: 'changes_requested',
  admin_remarks:
    '• Profile photo needs to be re-uploaded.\n• Personal details (name, DOB, etc.) need updating.\n• Address details are incomplete or incorrect.\n• Identity documents need to be re-uploaded.',
  change_section: 'personal',
  change_sections: ['personal', 'address', 'documents'],
};

export const SEBAYAT_REJECTED: Record<string, any> = {
  ...SEBAYAT_SUBMITTED,
  profile_status: 'rejected',
  admin_remarks: 'Incomplete documents provided.',
  reviewed_at: '2026-05-05T10:00:00Z',
};

export const IDENTITY_DOCS = [
  { id: 'doc-001', sebayat_id: TEST_SEBAYAT_ID, id_type: 'Aadhar Card', photo_url: 'https://example.com/aadhar.jpg' },
];

export const SEBA_CATEGORY = {
  id: 'cat-001',
  name: 'Pratihari',
  name_or: 'ପ୍ରତିହାରୀ',
  category_type: 'seba',
  beddha_count: 4,
  is_active: true,
};

export const NOTICE = {
  id: 'notice-001',
  title: 'Annual Festival Notice',
  title_or: 'ବାର୍ଷିକ ଉତ୍ସବ',
  body: 'The annual Rath Yatra festival will be held on June 20.',
  body_or: null,
  category: 'festival',
  pinned: false,
  published_at: '2026-05-01T00:00:00Z',
  target_type: 'all',
};

export const COMMITTEE = {
  id: 'com-001',
  year: 2026,
  title: 'Managing Committee 2026',
  title_or: null,
  description: 'Annual managing committee',
  is_active: true,
};

export const ADMIN_USER = {
  id: TEST_ADMIN_ID,
  user_id: TEST_USER_ID,
  is_super_admin: true,
  is_disabled: false,
  role_id: 'role-admin',
};

export const OTP_SESSION = {
  id: 'otp-001',
  phone: TEST_PHONE,
  request_id: 'req-001',
  verified: false,
  channel: 'sms',
  expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
};

export const DUTY_ENTRY = {
  service_date: '2026-05-22',
  seba_name: 'Pratihari',
  seba_name_or: 'ପ୍ରତିହାରୀ',
  beddha_number: 2,
  is_nijog: false,
};

export const SEBA_SESSION = {
  id: 'sess-001',
  sebayat_id: TEST_SEBAYAT_ID,
  seba_category_id: 'cat-001',
  service_date: '2026-05-22',
  started_at: '2026-05-22T06:00:00Z',
  ended_at: null,
  duration_minutes: null,
};
