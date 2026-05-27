/* ============================================================
   Pratihari Nijog — Admin Dashboard
   Web-first vanilla JS application
   ============================================================ */

const SUPABASE_URL = 'https://zqmuniemheltatarumbp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpxbXVuaWVtaGVsdGF0YXJ1bWJwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2OTg4NDIsImV4cCI6MjA5MjI3NDg0Mn0.W-6bEQvSJnhMDYr9mDBAHmF5pf_p9BcVaGnZ-mRWPzs';

const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, storage: window.localStorage },
});

// ── Notification helper ──────────────────────────────────────────────────────
async function dispatchNotification(event, recipientSebayatId, templateVars = {}, recipientType = 'sebayat') {
  try {
    const session = (await db.auth.getSession()).data.session;
    await fetch(`${SUPABASE_URL}/functions/v1/send-notification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token || SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        event,
        recipient_sebayat_id: recipientSebayatId,
        recipient_type: recipientType,
        template_vars: templateVars,
      }),
    });
  } catch (_) { /* best-effort */ }
}

const STATUS_LABELS = {
  draft: 'Draft', submitted: 'Submitted', resubmitted: 'Resubmitted',
  approved: 'Approved', rejected: 'Rejected', changes_requested: 'Changes Requested',
};
const ALL_STATUSES = ['draft','submitted','resubmitted','approved','rejected','changes_requested'];

// ── State ──
const state = {
  user: null,
  isSuperAdmin: false,
  adminRole: null,          // { id, role_name, color }
  permissions: new Set(),   // Set of "resource:action" strings
  view: 'overview',
  filter: 'all',
  search: '',
  sort: { key: 'submitted_at', dir: 'desc' },
  page: 1,
  pageSize: 25,
  selectedIds: new Set(),
  sebayats: [],
  history: [],
  admins: [],
  sebaCategories: [],
  sebaBeddhas: {},   // { [seba_category_id]: { [beddha_number]: 'hereditary'|'nijog_assigned' } }
  sebaCatTab: 'seba',
  currentSebayat: null,
  drawerTab: 'overview',
  pendingAction: null,
  pollTimer: null,
  lastSnapshot: 0,
  activityFilter: { from: '', to: '', admin: 'all' },
  addProfileStep: 0,
  newProfile: {},
  fatherSearchResults: [],
  fatherSearching: false,
  // Seba Assign page
  saYear: new Date().getFullYear(),
  saSearchQ: '',
  saSearchResults: [],
  saSearching: false,
  saSelectedSebayat: null,
  saAssignments: {},       // { [seba_category_id]: Set of beddha_number }
  saExpanded: {},          // { [seba_category_id]: bool }
  saSaving: false,
  saLoading: false,
  // Seba Calendar page
  sebaGroups: [],
  scheduleToday: {},      // { [group_id]: { service_date, beddha_number } }
  rosterToday: [],        // [{ schedule_id, sebayat_id, seba_category_id, beddha_number }]
  anchorHistory: [],      // [{ group_id, old_*, new_*, changed_at, reason }]
  scPreviewDate: new Date().toISOString().slice(0,10),
  scSaving: {},           // { [group_id]: bool }
  scAnchorEdits: {},      // { [group_id]: { anchor_date, anchor_beddha } }
  scCalYear: new Date().getFullYear(),
  scCalMonth: new Date().getMonth(),  // 0-11
  scCalRosterCache: {},   // { [isoDate]: { scheds: [], roster: [] } }
  // Seba History
  sebaHistoryEntries: [],
  sebaHistoryLoading: false,
  sebaHistoryLoaded: false,
  sebaHistoryFilter: 'all',   // 'all'|'completed'|'in_progress'|'absent'|'no_session'
  sebaHistorySearch: '',
  sebaHistoryViewMode: 'sessions', // 'sessions'|'members'
  sebaHistoryMembers: [],
  sebaHistoryMemberSearch: '',
  sebaHistoryMember: null,         // selected member for drill-down
  sebaHistoryMemberEntries: [],
  sebaHistoryMemberLoading: false,
  sebaHistoryDateFrom: new Date().toISOString().split('T')[0],  // default to today
  sebaHistoryDateTo: new Date().toISOString().split('T')[0],    // default to today
  sebaHistoryRangePicking: 'from',  // 'from'|'to'
  sebaHistoryCalYear: new Date().getFullYear(),
  sebaHistoryCalMonth: new Date().getMonth(),
  sebaHistoryShowCal: false,
  sebaSelectionsByCat: {},  // { [sebayat_id]: { [seba_category_id]: [beddha_number] } }
  // Notices
  notices: [],
  noticesLoading: false,
  noticesLoaded: false,
  noticesFilter: 'all',     // 'all' | 'published' | 'draft'
  noticesForm: null,        // null = list, object = editing/creating
  noticesFormError: '',
  noticesFormSaving: false,
  noticesDeleteTarget: null,
  noticesSebayatSearch: '',
  noticesSebayatResults: [],
  noticesSebayatSearching: false,
  noticesSelectedSebayats: [],  // [{id,full_name,phone}]
  noticesReadCounts: {},    // { [notice_id]: number }
  // Application Types
  appTypes: [],
  appTypesLoading: false,
  appTypesLoaded: false,
  appTypeFormError: '',
  appTypeFormSaving: false,
  // Manage Applications
  manageApps: [],
  manageAppsLoading: false,
  manageAppsLoaded: false,
  manageAppsFilter: 'all',
  manageAppsSearch: '',
  manageAppsDetail: null,
  manageAppsComments: [],
  manageAppsHistory: [],
  manageAppsCommenting: false,
  manageAppsCommentText: '',
  manageAppsCommentInternal: false,
  // Committees
  committees: [],
  committeesLoading: false,
  committeesLoaded: false,
  eventImages: [],
  eventImagesLoading: false,
  eventImagesLoaded: false,
  committeeDetail: null,        // committee being viewed/edited
  committeeSebayats: [],
  // Roles management
  roles: [],
  otpSettings: { otp_sms_enabled: true, otp_whatsapp_enabled: true },
  rolesLoading: false,
  rolesLoaded: false,
  roleEditTarget: null,         // role being edited
  rolePermissions: {},          // { [role_id]: Set<"resource:action"> }
  // Unified activity log
  unifiedLog: [],
  unifiedLogLoading: false,
  unifiedLogLoaded: false,
  unifiedLogPage: 1,
  unifiedLogTotal: 0,
  unifiedLogFilter: {
    from: '', to: '', admin: 'all', actionType: 'all', resourceType: 'all', search: '',
  },
  // Notifications
  notifChannels: [],       // [{ channel, enabled, push_mode }]
  notifFeatures: [],       // [{ event_key, label, sms_enabled, whatsapp_enabled, push_enabled, admin_notification_enabled, sms_template, whatsapp_template, push_template, sort_order }]
  notifLog: [],            // [{ id, event_key, channel, recipient_type, status, created_at, ... }]
  notifLogPage: 1,
  notifLogTotal: 0,
  adminNotifs: [],         // [{ id, title, body, event_key, is_read, created_at, reference_type, reference_id }]
  adminNotifsUnread: 0,
  notifBellOpen: false,
  notifTab: 'channels',    // 'channels' | 'features' | 'log'
  notifSaving: false,
};

// ── DOM helpers ──
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
const esc = s => s == null ? '' : String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

// ── Permission helper ────────────────────────────────────────────────────────
function can(resource, action) {
  if (state.isSuperAdmin) return true;
  const key = `${resource}:${action}`;
  // Per-user deny overrides beat role permissions
  if (state.permDenyOverrides && state.permDenyOverrides.has(key)) return false;
  // Per-user grant overrides add access beyond role
  if (state.permGrantOverrides && state.permGrantOverrides.has(key)) return true;
  return state.permissions.has(key);
}

// ── Activity Logging ─────────────────────────────────────────────────────────
async function logActivity(actionType, resourceType = '', resourceId = null, resourceLabel = '', oldValue = null, newValue = null, metadata = null) {
  if (!state.user) return;
  try {
    const entry = {
      actor_id: state.user.id,
      actor_email: state.user.email || '',
      role_snapshot: state.adminRole?.role_name || (state.isSuperAdmin ? 'Super Admin' : 'Admin'),
      action_type: actionType,
      resource_type: resourceType,
      resource_id: resourceId ? String(resourceId) : null,
      resource_label: resourceLabel,
      old_value: oldValue || null,
      new_value: newValue || null,
      ip_address: '',
      user_agent: navigator.userAgent || '',
      session_id: (await db.auth.getSession()).data?.session?.access_token?.slice(-16) || '',
      metadata: metadata || null,
    };
    // Fire-and-forget: never block the calling action
    db.from('admin_activity_log').insert(entry).then(({ error }) => {
      if (error) console.warn('[activity_log]', error.message);
    });
  } catch (e) {
    console.warn('[activity_log]', e);
  }
}

function renderBeddhaBadge(cat) {
  if (cat.beddha_count == null) return `<span style="color:var(--ink4);font-size:12px">—</span>`;
  const map = state.sebaBeddhas[cat.id] || {};
  let h = 0, n = 0;
  for (let i = 1; i <= cat.beddha_count; i++) {
    if (map[i] === 'hereditary') h++;
    else if (map[i] === 'nijog_assigned') n++;
  }
  const assigned = h + n;
  if (assigned === 0) {
    return `<span class="sc-beddha-badge">${cat.beddha_count}</span>`;
  }
  return `<span class="sc-beddha-badge" title="${cat.beddha_count} total: ${h} Hereditary, ${n} Nijog Assigned"
    style="display:inline-flex;align-items:center;gap:4px;padding:2px 6px">
    <span style="color:#166534;font-weight:700">${h}H</span>
    <span style="color:var(--ink4)">/</span>
    <span style="color:#1e40af;font-weight:700">${n}N</span>
  </span>`;
}

function fmtDate(iso, withTime = false) {
  if (!iso) return '—';
  let normalized = typeof iso === 'string' ? iso.trim() : String(iso);
  // Handle DD/MM/YYYY format stored by user registration form
  const ddmmyyyy = normalized.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (ddmmyyyy) {
    normalized = `${ddmmyyyy[3]}-${ddmmyyyy[2].padStart(2,'0')}-${ddmmyyyy[1].padStart(2,'0')}`;
  }
  // For date-only strings (YYYY-MM-DD), append T12:00:00 to avoid UTC midnight timezone shifts
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    normalized = normalized + 'T12:00:00';
  } else {
    // Normalize postgres timestamptz: space→T, +00→+00:00
    normalized = normalized.replace(' ', 'T').replace(/([+-]\d{2})$/, '$1:00');
  }
  const d = new Date(normalized);
  if (isNaN(d)) return '—';
  const opts = withTime
    ? { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }
    : { day: '2-digit', month: 'short', year: 'numeric' };
  return d.toLocaleString('en-IN', opts);
}
function fmtRelative(iso) {
  if (!iso) return '';
  const ms = Date.now() - new Date(typeof iso === 'string' ? iso.replace(' ', 'T').replace(/([+-]\d{2})$/, '$1:00') : iso).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return Math.floor(s/60) + 'm ago';
  if (s < 86400) return Math.floor(s/3600) + 'h ago';
  if (s < 86400*7) return Math.floor(s/86400) + 'd ago';
  return fmtDate(iso);
}
function getName(s) {
  if (!s) return 'Unnamed';
  return s.full_name || [s.first_name, s.middle_name, s.last_name].filter(Boolean).join(' ') || 'Unnamed';
}
function getInitials(s) {
  const name = getName(s);
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || '?';
}
function setLoading(on) { $('#loading-bar').classList.toggle('active', on); }
function showToast(msg, type = 'info', duration = 3200) {
  const stack = $('#toast-stack');
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.textContent = msg;
  stack.appendChild(el);
  setTimeout(() => { el.classList.add('fade-out'); setTimeout(() => el.remove(), 200); }, duration);
}

// ============================================================
// AUTH
// ============================================================
async function loadRoleAndPermissions(userId) {
  const { data: adminRow } = await db
    .from('pratihari_admins')
    .select('id, is_super_admin, role_id')
    .eq('user_id', userId)
    .maybeSingle();
  if (!adminRow) return null;
  state.isSuperAdmin = adminRow.is_super_admin === true;
  state.adminId = adminRow.id;
  // Load role details and permissions separately (avoids RLS join recursion)
  state.adminRole = null;
  state.permissions = new Set();
  state.permGrantOverrides = new Set();
  state.permDenyOverrides = new Set();
  if (adminRow.role_id) {
    const [roleRes, permsRes, overridesRes] = await Promise.all([
      db.from('admin_roles').select('id, role_name, color').eq('id', adminRow.role_id).maybeSingle(),
      db.from('role_permissions').select('resource, action').eq('role_id', adminRow.role_id),
      db.from('admin_user_permissions').select('resource, action, granted').eq('admin_id', adminRow.id),
    ]);
    state.adminRole = roleRes.data || null;
    for (const p of (permsRes.data || [])) {
      state.permissions.add(`${p.resource}:${p.action}`);
    }
    for (const o of (overridesRes.data || [])) {
      const key = `${o.resource}:${o.action}`;
      if (o.granted) state.permGrantOverrides.add(key);
      else state.permDenyOverrides.add(key);
    }
  } else {
    // No role but still load overrides
    const { data: overridesData } = await db
      .from('admin_user_permissions')
      .select('resource, action, granted')
      .eq('admin_id', adminRow.id);
    for (const o of (overridesData || [])) {
      const key = `${o.resource}:${o.action}`;
      if (o.granted) state.permGrantOverrides.add(key);
      else state.permDenyOverrides.add(key);
    }
  }
  return adminRow;
}

async function signIn(email, password) {
  setLoading(true);
  const { data, error } = await db.auth.signInWithPassword({ email, password });
  if (error) { setLoading(false); return { error: error.message }; }
  const adminRow = await loadRoleAndPermissions(data.user.id);
  if (!adminRow) {
    await db.auth.signOut();
    setLoading(false);
    return { error: 'Access denied. This account does not have administrator privileges.' };
  }
  setLoading(false);
  // Log login (fire-and-forget; state.user not set yet so we pass user directly)
  state.user = data.user;
  logActivity('login', 'auth', null, 'Admin signed in');
  return { user: data.user };
}

async function signOut() {
  logActivity('logout', 'auth', null, 'Admin signed out');
  await db.auth.signOut();
  state.user = null;
  state.adminRole = null;
  state.permissions = new Set();
  if (state.pollTimer) clearInterval(state.pollTimer);
  $('#app').classList.remove('visible');
  $('#login-screen').style.display = 'flex';
}

async function bootstrap() {
  $('#login-screen').style.display = 'flex';
  const { data: { session } } = await db.auth.getSession();
  if (session) {
    const adminRow = await loadRoleAndPermissions(session.user.id);
    if (adminRow) { showApp(session.user); return; }
    await db.auth.signOut();
  }
}

function showApp(user) {
  state.user = user;
  $('#login-screen').style.display = 'none';
  $('#app').classList.add('visible');
  const label = user.email || (user.phone ? '+' + user.phone : 'Admin');
  $('#user-name').textContent = label;
  $('#user-avatar').textContent = (user.email?.[0] || user.phone?.[0] || 'A').toUpperCase();
  // Show role badge in topbar
  const roleEl = $('#user-role-display');
  if (roleEl) {
    const roleName = state.adminRole?.role_name || (state.isSuperAdmin ? 'Super Admin' : 'Admin');
    const roleColor = state.adminRole?.color || '#6B7280';
    roleEl.textContent = roleName;
    roleEl.style.color = roleColor;
  }
  // Settings section visible to super admins and admins with settings permission
  const settingsSection = $('#nav-settings-section');
  if (settingsSection) settingsSection.style.display = (state.isSuperAdmin || can('admins', 'view')) ? '' : 'none';
  // Roles nav item: super admin only
  const rolesNavItem = $('#nav-roles-item');
  if (rolesNavItem) rolesNavItem.style.display = state.isSuperAdmin ? '' : 'none';
  loadAll();
  state.pollTimer = setInterval(pollForChanges, 30_000);
  attachNotifBellHandlers();
  startNotifPolling();
}

// ============================================================
// DATA
// ============================================================
async function loadAll() {
  setLoading(true);
  const [seb, hist, adm, cats, beddhas, roles, appSettings] = await Promise.all([
    db.from('sebayats').select('*').order('submitted_at', { ascending: false, nullsLast: true }).order('created_at', { ascending: false }),
    db.from('profile_review_history').select('*').order('created_at', { ascending: false }).limit(200),
    db.from('admin_users_view').select('*').order('created_at', { ascending: true }),
    db.from('seba_categories').select('*').order('category_type').order('sort_order').order('name'),
    db.from('seba_beddhas').select('seba_category_id,beddha_number,beddha_type'),
    db.from('admin_roles').select('*').order('created_at', { ascending: true }),
    db.from('app_settings').select('key,value').in('key', ['otp_sms_enabled', 'otp_whatsapp_enabled']),
  ]);
  setLoading(false);
  if (seb.error) { showToast('Failed to load sebayats', 'error'); return; }
  state.sebayats = seb.data || [];
  state.history = hist.data || [];
  state.admins = adm.data || [];
  // Load override counts for the Custom badge
  const { data: overrideCounts } = await db
    .from('admin_user_permissions')
    .select('admin_id');
  const countMap = {};
  for (const row of (overrideCounts || [])) {
    countMap[row.admin_id] = (countMap[row.admin_id] || 0) + 1;
  }
  state.adminOverrideCounts = countMap;
  state.sebaCategories = cats.data || [];
  state.sebaBeddhas = buildBeddhaMap(beddhas.data || []);
  state.roles = roles.data || [];
  const settingsMap = {};
  for (const row of (appSettings.data || [])) settingsMap[row.key] = row.value;
  state.otpSettings = {
    otp_sms_enabled: settingsMap.otp_sms_enabled !== false,
    otp_whatsapp_enabled: settingsMap.otp_whatsapp_enabled !== false,
  };
  await loadSebaCalendar();
  // Load today's sessions for the overview live indicators (non-blocking)
  const today = new Date().toISOString().slice(0, 10);
  db.from('seba_sessions').select('id,roster_id,sebayat_id,seba_category_id,service_date,started_at,ended_at,duration_minutes,beddha_number').eq('service_date', today).then(({ data }) => {
    state.sebaTodaySessions = data || [];
    state.sebaTodayDate = today;
    const inProgress = (data || []).filter(s => s.started_at && !s.ended_at).length;
    const badge = document.getElementById('seba-today-inprogress-badge');
    if (badge) badge.style.display = inProgress > 0 ? 'block' : 'none';
  });
  state.lastSnapshot = state.sebayats.length;
  updateBadges();
  render();
}

async function loadSebaCalendar() {
  const today = new Date().toISOString().slice(0,10);
  const [groups, sched, history] = await Promise.all([
    db.from('seba_groups').select('*').order('name'),
    db.from('seba_schedule').select('id,group_id,service_date,beddha_number').eq('service_date', today),
    db.from('seba_group_anchor_history').select('*').order('changed_at', { ascending: false }).limit(50),
  ]);
  state.sebaGroups = groups.data || [];
  state.scheduleToday = {};
  for (const r of (sched.data || [])) state.scheduleToday[r.group_id] = r;
  state.anchorHistory = history.data || [];

  // Build today's roster from sebayat_seba_selections matched against today's beddha numbers
  // Each group has a beddha_number today; sebayats who claimed that beddha in a category serve today
  const schedRows = sched.data || [];
  if (schedRows.length) {
    // Collect all (beddha_number, group_id) pairs for today, then find matching selections
    // selections don't store group_id directly, so we match via seba_categories -> seba_group linkage
    // Simpler: load all selections for today's beddha numbers and resolve group via category
    const todayBeddhas = schedRows.map(r => r.beddha_number);
    const { data: selData } = await db
      .from('sebayat_seba_selections')
      .select('sebayat_id, seba_category_id, beddha_number')
      .in('beddha_number', todayBeddhas);

    // Load seba_category -> seba_group mapping to filter by the right group's beddha
    const { data: catGroupData } = await db
      .from('seba_categories')
      .select('id, group_id');
    const catGroupMap = {};
    for (const c of (catGroupData || [])) catGroupMap[c.id] = c.group_id;

    // Build synthetic roster: only include selections where the category's group beddha matches today
    const groupBeddhaMap = {};
    for (const r of schedRows) groupBeddhaMap[r.group_id] = r.beddha_number;

    state.rosterToday = (selData || []).filter(sel => {
      const groupId = catGroupMap[sel.seba_category_id];
      return groupId && groupBeddhaMap[groupId] === sel.beddha_number;
    }).map(sel => ({
      // Mimic seba_roster shape used by renderOverview
      schedule_id: (schedRows.find(r => r.group_id === catGroupMap[sel.seba_category_id]) || {}).id,
      sebayat_id: sel.sebayat_id,
      seba_category_id: sel.seba_category_id,
      beddha_number: sel.beddha_number,
      is_absent: false,
    }));
  } else {
    state.rosterToday = [];
  }
}

function buildBeddhaMap(rows) {
  const map = {};
  for (const row of rows) {
    if (!map[row.seba_category_id]) map[row.seba_category_id] = {};
    map[row.seba_category_id][row.beddha_number] = row.beddha_type;
  }
  return map;
}

async function reloadBeddhas() {
  const { data } = await db.from('seba_beddhas').select('seba_category_id,beddha_number,beddha_type');
  state.sebaBeddhas = buildBeddhaMap(data || []);
}

async function pollForChanges() {
  const { count } = await db.from('sebayats').select('*', { count: 'exact', head: true });
  if (count != null && count !== state.lastSnapshot) {
    const diff = count - state.lastSnapshot;
    if (diff > 0) showRealtimeBanner(diff);
    state.lastSnapshot = count;
  }
}

function showRealtimeBanner(n) {
  const main = $('#main');
  let banner = $('#realtime-banner');
  if (banner) banner.remove();
  banner = document.createElement('div');
  banner.id = 'realtime-banner';
  banner.className = 'realtime-banner';
  banner.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
    <span>${n} new application${n > 1 ? 's' : ''} received. <strong>Click to refresh</strong></span>
  `;
  banner.onclick = () => { banner.remove(); loadAll(); };
  main.insertBefore(banner, main.firstChild);
}

function updateBadges() {
  const counts = { all: state.sebayats.length };
  ALL_STATUSES.forEach(s => counts[s] = state.sebayats.filter(x => x.profile_status === s).length);
  $$('[data-badge]').forEach(el => {
    const k = el.getAttribute('data-badge');
    el.textContent = counts[k] ?? 0;
    el.style.display = (counts[k] ?? 0) > 0 ? '' : 'none';
  });
}

// ============================================================
// FILTERING + SORTING
// ============================================================
function filteredSebayats() {
  const q = state.search.trim().toLowerCase();
  const startOfToday = new Date(); startOfToday.setHours(0,0,0,0);
  const todayMs = startOfToday.getTime();
  return state.sebayats.filter(s => {
    if (state.filter === 'today') {
      const t = new Date(s.created_at || 0).getTime();
      if (t < todayMs) return false;
    } else if (state.filter === 'incomplete') {
      if (s.profile_status !== 'draft' && s.profile_status !== 'changes_requested') return false;
    } else if (state.filter !== 'all' && s.profile_status !== state.filter) return false;
    if (!q) return true;
    return ['full_name','first_name','last_name','phone','email','bansa_name','seba_name','registration_no','palia_number']
      .some(k => (s[k] || '').toString().toLowerCase().includes(q));
  });
}
function sortedSebayats(list) {
  const { key, dir } = state.sort;
  const mul = dir === 'asc' ? 1 : -1;
  return [...list].sort((a, b) => {
    let av = a[key], bv = b[key];
    if (key === 'name') { av = getName(a).toLowerCase(); bv = getName(b).toLowerCase(); }
    if (av == null) av = '';
    if (bv == null) bv = '';
    if (typeof av === 'string') return av.localeCompare(bv) * mul;
    return (av < bv ? -1 : av > bv ? 1 : 0) * mul;
  });
}

// ============================================================
// VIEWS / ROUTING
// ============================================================
function render() {
  // Mark active nav
  const appsViews = ['manage_applications', 'app_types'];
  const appsActive = appsViews.includes(state.view);
  $$('.nav-item').forEach(n => {
    const v = n.dataset.view;
    const f = n.dataset.filter;
    const af = n.dataset.appfilter;
    let active = v === state.view;
    if (v === 'applications') active = state.view === 'applications' && f === state.filter;
    if (v === 'manage_applications') active = state.view === 'manage_applications' && af === state.manageAppsFilter;
    n.classList.toggle('active', active);
  });
  // Parent Applications toggle: highlight when a child is active
  const appsToggle = document.getElementById('nav-apps-toggle');
  if (appsToggle) appsToggle.classList.toggle('active', appsActive);
  // Auto-expand Applications children when navigating to an apps view
  const appsChildren = document.getElementById('nav-apps-children');
  const appsChevron = document.getElementById('nav-apps-chevron');
  if (appsChildren && appsChevron) {
    if (appsActive && appsChildren.style.display === 'none') {
      appsChildren.style.display = 'flex';
      appsChevron.style.transform = 'rotate(0deg)';
    }
  }
  // Parent Seba toggle: highlight when a child is active
  const sebaViews = ['seba_categories', 'seba_assign', 'seba_calendar', 'nijog_view', 'seba_history', 'seba_today'];
  const sebaActive = sebaViews.includes(state.view);
  const sebaToggle = document.getElementById('nav-seba-toggle');
  if (sebaToggle) sebaToggle.classList.toggle('active', sebaActive);
  const sebaChildren = document.getElementById('nav-seba-children');
  const sebaChevron = document.getElementById('nav-seba-chevron');
  if (sebaChildren && sebaChevron) {
    if (sebaActive && sebaChildren.style.display === 'none') {
      sebaChildren.style.display = 'flex';
      sebaChevron.style.transform = 'rotate(0deg)';
    }
  }

  // Parent Sebayat Profiles toggle: highlight when a child is active
  const sebayatViews = ['applications', 'add_profile', 'manage_profiles', 'activity'];
  const sebayatActive = sebayatViews.includes(state.view);
  const sebayatToggle = document.getElementById('nav-sebayat-toggle');
  if (sebayatToggle) sebayatToggle.classList.toggle('active', sebayatActive);
  // Auto-expand Sebayat Profiles children when navigating to a sebayat view
  const sebayatChildren = document.getElementById('nav-sebayat-children');
  const sebayatChevron = document.getElementById('nav-sebayat-chevron');
  if (sebayatChildren && sebayatChevron) {
    if (sebayatActive && sebayatChildren.style.display === 'none') {
      sebayatChildren.style.display = 'flex';
      sebayatChevron.style.transform = 'rotate(0deg)';
    }
  }
  // Parent Management toggle: highlight when a child is active
  const mgmtViews = ['notices', 'notices_form', 'committees', 'event_images'];
  const mgmtActive = mgmtViews.includes(state.view);
  const mgmtToggle = document.getElementById('nav-mgmt-toggle');
  if (mgmtToggle) mgmtToggle.classList.toggle('active', mgmtActive);
  const mgmtChildren = document.getElementById('nav-mgmt-children');
  const mgmtChevron = document.getElementById('nav-mgmt-chevron');
  if (mgmtChildren && mgmtChevron) {
    if (mgmtActive && mgmtChildren.style.display === 'none') {
      mgmtChildren.style.display = 'flex';
      mgmtChevron.style.transform = 'rotate(0deg)';
    }
  }
  // Parent Settings toggle: highlight when a child is active
  const settingsViews = ['admins', 'roles', 'settings', 'notifications'];
  const settingsNavActive = settingsViews.includes(state.view);
  const settingsToggle = document.getElementById('nav-settings-toggle');
  if (settingsToggle) settingsToggle.classList.toggle('active', settingsNavActive);
  const settingsChildren = document.getElementById('nav-settings-children');
  const settingsChevron = document.getElementById('nav-settings-chevron');
  if (settingsChildren && settingsChevron) {
    if (settingsNavActive && settingsChildren.style.display === 'none') {
      settingsChildren.style.display = 'flex';
      settingsChevron.style.transform = 'rotate(0deg)';
    }
  }
  // Breadcrumb
  let crumb = '';
  if (state.view === 'overview') crumb = '<span class="breadcrumb-current">Dashboard</span>';
  else if (state.view === 'applications') {
    const label = state.filter === 'all' ? 'All Sebayats' : state.filter === 'today' ? "Today's Registrations" : state.filter === 'incomplete' ? 'Incomplete Profiles' : STATUS_LABELS[state.filter] || 'Sebayat Profiles';
    crumb = `<span>Sebayat Profiles</span><span class="breadcrumb-sep">/</span><span class="breadcrumb-current">${label}</span>`;
  } else if (state.view === 'activity') crumb = '<span class="breadcrumb-current">Activity Log</span>';
  else if (state.view === 'admins') crumb = `<span>Settings</span><span class="breadcrumb-sep">/</span><span class="breadcrumb-current">Admin Users</span>`;
  else if (state.view === 'roles') crumb = `<span>Settings</span><span class="breadcrumb-sep">/</span><span class="breadcrumb-current">Roles &amp; Permissions</span>`;
  else if (state.view === 'add_profile') crumb = `<span>Management</span><span class="breadcrumb-sep">/</span><span class="breadcrumb-current">Add Profile</span>`;
  else if (state.view === 'seba_categories') crumb = `<span>Management</span><span class="breadcrumb-sep">/</span><span class="breadcrumb-current">Seba Categories</span>`;
  else if (state.view === 'seba_assign') crumb = `<span>Management</span><span class="breadcrumb-sep">/</span><span class="breadcrumb-current">Seba Assign</span>`;
  else if (state.view === 'seba_calendar') crumb = `<span>Management</span><span class="breadcrumb-sep">/</span><span class="breadcrumb-current">Seba Calendar</span>`;
  else if (state.view === 'nijog_view') crumb = `<span>Management</span><span class="breadcrumb-sep">/</span><span class="breadcrumb-current">Nijog Assignments</span>`;
  else if (state.view === 'manage_profiles') crumb = `<span>Management</span><span class="breadcrumb-sep">/</span><span class="breadcrumb-current">Manage Profiles</span>`;
  else if (state.view === 'mp_edit_page') crumb = `<span>Management</span><span class="breadcrumb-sep">/</span><button class="breadcrumb-link" onclick="state.view='manage_profiles';render()">Manage Profiles</button><span class="breadcrumb-sep">/</span><span class="breadcrumb-current">Edit — ${state.currentSebayat ? esc(getName(state.currentSebayat)) : ''}</span>`;
  else if (state.view === 'mp_view_page') crumb = `<span>Management</span><span class="breadcrumb-sep">/</span><button class="breadcrumb-link" onclick="state.view='manage_profiles';render()">Manage Profiles</button><span class="breadcrumb-sep">/</span><span class="breadcrumb-current">View — ${state.currentSebayat ? esc(getName(state.currentSebayat)) : ''}</span>`;
  else if (state.view === 'notices') crumb = `<span>Management</span><span class="breadcrumb-sep">/</span><span class="breadcrumb-current">Notices</span>`;
  else if (state.view === 'notices_form') crumb = `<span>Management</span><span class="breadcrumb-sep">/</span><button class="breadcrumb-link" onclick="state.noticesForm=null;state.view='notices';render()">Notices</button><span class="breadcrumb-sep">/</span><span class="breadcrumb-current">${state.noticesForm?.id ? 'Edit Notice' : 'New Notice'}</span>`;
  else if (state.view === 'committees') crumb = `<span>Management</span><span class="breadcrumb-sep">/</span><span class="breadcrumb-current">Committee</span>`;
  else if (state.view === 'event_images') crumb = `<span>Management</span><span class="breadcrumb-sep">/</span><span class="breadcrumb-current">Event Images</span>`;
  else if (state.view === 'seba_today') crumb = `<span>Seba</span><span class="breadcrumb-sep">/</span><span class="breadcrumb-current">Today's Seba</span>`;
  else if (state.view === 'seba_history') crumb = `<span>Management</span><span class="breadcrumb-sep">/</span><span class="breadcrumb-current">Seba History</span>`;
  else if (state.view === 'seba_history_member') crumb = `<span>Management</span><span class="breadcrumb-sep">/</span><button class="breadcrumb-link" onclick="state.view='seba_history';render()">Seba History</button><span class="breadcrumb-sep">/</span><span class="breadcrumb-current">${state.sebaHistoryMember ? esc(state.sebaHistoryMember.full_name || '') : ''}</span>`;
  else if (state.view === 'settings') crumb = `<span>System</span><span class="breadcrumb-sep">/</span><span class="breadcrumb-current">Settings</span>`;
  else if (state.view === 'notifications') crumb = `<span>Settings</span><span class="breadcrumb-sep">/</span><span class="breadcrumb-current">Notifications</span>`;
  else if (state.view === 'app_types') crumb = `<span>Applications</span><span class="breadcrumb-sep">/</span><span class="breadcrumb-current">Application Types</span>`;
  else if (state.view === 'manage_applications') {
    const lbl = { all:'All Applications', pending:'Pending', under_review:'Under Review', approved:'Approved', rejected:'Rejected', more_info_required:'More Info Required' };
    crumb = `<span>Applications</span><span class="breadcrumb-sep">/</span><span class="breadcrumb-current">${lbl[state.manageAppsFilter] || 'Applications'}</span>`;
  }
  $('#breadcrumb').innerHTML = crumb;

  const c = $('#view-container');
  if (state.view === 'overview') { c.innerHTML = renderOverview(); _initDashboardSebaPanel(); }
  else if (state.view === 'applications') c.innerHTML = renderApplications();
  else if (state.view === 'activity') c.innerHTML = renderActivity();
  else if (state.view === 'admins') { c.innerHTML = renderAdmins(); attachAdminsHandlers(); return; }
  else if (state.view === 'roles') {
    if (!state.isSuperAdmin) { c.innerHTML = `<div class="page"><div class="empty">Access denied. Super admin privileges required.</div></div>`; return; }
    c.innerHTML = renderRolesView(); attachRolesHandlers(); return;
  }
  else if (state.view === 'add_profile') c.innerHTML = renderAddProfile();
  else if (state.view === 'seba_categories') c.innerHTML = renderSebaCategories();
  else if (state.view === 'seba_assign') c.innerHTML = renderSebaAssign();
  else if (state.view === 'seba_calendar') { c.innerHTML = renderSebaCalendar(); attachSebaCalendarHandlers(); return; }
  else if (state.view === 'nijog_view') { c.innerHTML = renderNijogView(); attachNijogViewHandlers(); return; }
  else if (state.view === 'manage_profiles') { c.innerHTML = renderManageProfiles(); attachManageProfilesHandlers(); return; }
  else if (state.view === 'mp_edit_page') { c.innerHTML = renderMpEditPage(); attachManageProfilesHandlers(); return; }
  else if (state.view === 'mp_view_page') { renderMpViewPageShell(c); return; }
  else if (state.view === 'notices') { c.innerHTML = renderNoticesView(); attachNoticesHandlers(); return; }
  else if (state.view === 'notices_form') { c.innerHTML = renderNoticesFormPage(); attachNoticesFormHandlers(); return; }
  else if (state.view === 'committees') { c.innerHTML = renderCommitteesView(); attachCommitteesHandlers(); return; }
  else if (state.view === 'event_images') { renderEventImagesView(c); return; }
  else if (state.view === 'seba_today') { renderSebaTodayView(c); return; }
  else if (state.view === 'seba_history') { renderSebaHistoryView(c); return; }
  else if (state.view === 'seba_history_member') { renderSebaHistoryMemberView(c); return; }
  else if (state.view === 'app_types') { c.innerHTML = renderAppTypesView(); attachAppTypesHandlers(); return; }
  else if (state.view === 'manage_applications') { c.innerHTML = renderManageApplicationsView(); attachManageApplicationsHandlers(); return; }
  else if (state.view === 'settings') {
    if (!can('settings', 'view')) { c.innerHTML = `<div class="page"><div class="empty">Access denied. Insufficient permissions.</div></div>`; return; }
    c.innerHTML = renderSettingsView(); attachSettingsHandlers(); return;
  }
  else if (state.view === 'notifications') {
    if (!can('notifications', 'view')) { c.innerHTML = `<div class="page"><div class="empty">Access denied. Insufficient permissions.</div></div>`; return; }
    renderNotificationsView(c); return;
  }

  attachViewHandlers();
}

// ============================================================
// OVERVIEW
// ============================================================
function renderOverview() {
  const s = state.sebayats;
  const counts = {
    total: s.length,
    pending: s.filter(x => x.profile_status === 'submitted' || x.profile_status === 'resubmitted').length,
    approved: s.filter(x => x.profile_status === 'approved').length,
    rejected: s.filter(x => x.profile_status === 'rejected').length,
    changes: s.filter(x => x.profile_status === 'changes_requested').length,
  };

  const startOfToday = new Date(); startOfToday.setHours(0,0,0,0);
  const todayMs = startOfToday.getTime();
  const todayRegs = s.filter(x => {
    const t = new Date(x.created_at || 0).getTime();
    return t >= todayMs;
  }).length;
  const incomplete = s.filter(x =>
    x.profile_status === 'draft' || x.profile_status === 'changes_requested'
  ).length;
  const recentPending = s
    .filter(x => x.profile_status === 'submitted' || x.profile_status === 'resubmitted')
    .slice(0, 5);

  const recentActivity = state.history.slice(0, 10);

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  const today = new Date().toISOString().slice(0,10);
  const todayFmt = new Date().toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long', year:'numeric' }).toUpperCase();
  const sorted = [...state.sebaGroups].sort((a,b) => a.code === 'pratihari' ? -1 : b.code === 'pratihari' ? 1 : 0);

  // Build pill chips per group showing beddha number + serving count
  const groupChips = sorted.map(g => {
    const sched = state.scheduleToday[g.id];
    const beddha = sched ? sched.beddha_number : beddhaForDate(g, today);
    const isPrat = g.code === 'pratihari';
    const color = isPrat ? '#4ADE80' : '#60A5FA';
    const servingCount = sched ? state.rosterToday.filter(r => r.schedule_id === sched.id && !r.is_absent).length : 0;
    return `<div style="display:flex;align-items:center;gap:8px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:20px;padding:5px 14px 5px 10px">
      <span style="font-size:18px;font-weight:800;color:${color};line-height:1">#${beddha != null ? beddha : '—'}</span>
      <div>
        <div style="font-size:11px;font-weight:700;color:${color};letter-spacing:0.5px">${esc(g.name)}</div>
        <div style="font-size:10px;color:rgba(255,255,255,0.4)">${servingCount} serving</div>
      </div>
    </div>`;
  }).join('');

  // Roster grid per group — rendered inside collapsible
  const rosterGrid = sorted.map(g => {
    const sched = state.scheduleToday[g.id];
    const roster = sched ? state.rosterToday.filter(r => r.schedule_id === sched.id) : [];
    const isPrat = g.code === 'pratihari';
    const accentColor = isPrat ? '#4ADE80' : '#60A5FA';
    const byCat = {};
    for (const r of roster) {
      const cat = state.sebaCategories.find(c => c.id === r.seba_category_id);
      const catName = cat ? cat.name : 'Other';
      if (!byCat[catName]) byCat[catName] = [];
      const seb = state.sebayats.find(s => s.id === r.sebayat_id);
      byCat[catName].push({ id: r.sebayat_id, name: seb ? getName(seb) : 'Unknown', absent: r.is_absent });
    }
    const catKeys = Object.keys(byCat).sort();
    const catCards = catKeys.length
      ? catKeys.map(k => `
          <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.07);border-radius:10px;padding:12px 14px">
            <div style="font-size:9px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:rgba(255,255,255,0.35);margin-bottom:8px">${esc(k)}</div>
            <div style="display:flex;flex-direction:column;gap:5px">
              ${byCat[k].map(p => {
                const todaySessions = state.sebaTodaySessions || [];
                const sess = todaySessions.find(s => s.sebayat_id === p.id && s.service_date === today);
                const sessStatus = sess?.ended_at ? 'done' : sess?.started_at ? 'inprogress' : null;
                const statusDot = sessStatus === 'done'
                  ? `<span style="width:7px;height:7px;border-radius:50%;background:#4ADE80;flex-shrink:0;margin-left:auto" title="Done"></span>`
                  : sessStatus === 'inprogress'
                  ? `<span style="width:7px;height:7px;border-radius:50%;background:#E8732A;flex-shrink:0;margin-left:auto;animation:pulse 1.5s infinite" title="In Progress"></span>`
                  : '';
                return `
                <div onclick="actions.openSebayat('${esc(p.id)}')" style="cursor:pointer;display:flex;align-items:center;gap:8px;padding:4px 0">
                  <div style="width:28px;height:28px;border-radius:50%;background:${p.absent ? 'rgba(239,68,68,0.15)' : sessStatus === 'done' ? 'rgba(74,222,128,0.12)' : sessStatus === 'inprogress' ? 'rgba(232,115,42,0.15)' : 'rgba(255,255,255,0.08)'};border:1px solid ${p.absent ? 'rgba(239,68,68,0.3)' : sessStatus === 'done' ? 'rgba(74,222,128,0.3)' : sessStatus === 'inprogress' ? 'rgba(232,115,42,0.3)' : 'rgba(255,255,255,0.12)'};display:flex;align-items:center;justify-content:center;flex-shrink:0">
                    <span style="font-size:11px;font-weight:700;color:${p.absent ? '#FCA5A5' : sessStatus === 'done' ? '#4ADE80' : sessStatus === 'inprogress' ? '#E8732A' : accentColor}">${esc(p.name).charAt(0).toUpperCase()}</span>
                  </div>
                  <div style="flex:1;min-width:0">
                    <div style="font-size:13px;font-weight:500;color:${p.absent ? 'rgba(255,255,255,0.3)' : '#fff'};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(p.name)}</div>
                    ${p.absent ? `<div style="font-size:9px;font-weight:700;color:#FCA5A5;letter-spacing:0.5px">ABSENT</div>` : sessStatus === 'inprogress' ? `<div style="font-size:9px;font-weight:700;color:#E8732A;letter-spacing:0.5px">IN PROGRESS</div>` : sessStatus === 'done' ? `<div style="font-size:9px;font-weight:700;color:#4ADE80;letter-spacing:0.5px">DONE</div>` : ''}
                  </div>
                  ${statusDot}
                </div>`;
              }).join('')}
            </div>
          </div>`)
        .join('')
      : `<div style="background:rgba(255,255,255,0.03);border:1px dashed rgba(255,255,255,0.08);border-radius:10px;padding:16px;text-align:center;font-size:12px;color:rgba(255,255,255,0.2);font-style:italic">No roster assigned</div>`;
    return `
      <div>
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
          <div style="width:3px;height:16px;border-radius:2px;background:${accentColor}"></div>
          <span style="font-size:13px;font-weight:700;color:${accentColor};letter-spacing:0.5px">${esc(g.name)}</span>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:8px">
          ${catCards}
        </div>
      </div>`;
  }).join('');

  const sebaBanner = sorted.length ? `
    <!-- Beddha info card — always visible, no toggle -->
    <div style="background:linear-gradient(135deg,#0c2318 0%,#152d1f 100%);border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:14px 20px;margin-bottom:8px;display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap">
      <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
        <div style="display:flex;align-items:center;gap:7px">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#4ADE80" stroke-width="2.5"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          <span style="font-size:12px;font-weight:700;color:#4ADE80;letter-spacing:0.5px">Today's Seba</span>
        </div>
        <span style="font-size:11px;color:rgba(255,255,255,0.35);font-weight:500">${todayFmt}</span>
        <div style="display:flex;gap:8px;flex-wrap:wrap">${groupChips}</div>
      </div>
      <button onclick="actions.go('seba_today')" style="background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.12);color:rgba(255,255,255,0.6);border-radius:7px;padding:5px 12px;font-size:11px;font-weight:600;cursor:pointer;white-space:nowrap">Manage →</button>
    </div>
    <!-- Collapsible roster segment — separate card below -->
    <div style="margin-bottom:20px">
      <div onclick="(function(){var p=document.getElementById('seba-today-panel');var a=document.getElementById('seba-today-arrow');var open=p.style.display!=='none';p.style.display=open?'none':'block';a.style.transform=open?'rotate(0deg)':'rotate(180deg)';})()" style="background:linear-gradient(135deg,#0c2318 0%,#152d1f 100%);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:11px 18px;display:flex;align-items:center;justify-content:space-between;cursor:pointer;user-select:none;transition:filter 0.15s" onmouseover="this.style.filter='brightness(1.15)'" onmouseout="this.style.filter='brightness(1)'">
        <div style="display:flex;align-items:center;gap:8px">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#4ADE80" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
          <span style="font-size:12px;font-weight:600;color:rgba(255,255,255,0.8)">Serving Sebayats Roster</span>
        </div>
        <svg id="seba-today-arrow" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="2.5" style="transform:rotate(0deg);transition:transform 0.2s"><polyline points="6 9 12 15 18 9"/></svg>
      </div>
      <div id="seba-today-panel" style="display:none;border:1px solid rgba(255,255,255,0.08);border-top:none;border-radius:0 0 10px 10px;padding:16px 20px 20px;background:linear-gradient(135deg,#091a11 0%,#0f2018 100%)">
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:20px">
          ${rosterGrid}
        </div>
      </div>
    </div>` : '';

  return `
    ${sebaBanner}
    <div class="page-header">
      <div>
        <h1>${greeting}</h1>
        <p>Welcome back. Here's what's happening with sebayat applications today.</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-secondary btn-sm" onclick="actions.gotoApplications('submitted')">View pending</button>
      </div>
    </div>

    <div class="stats-grid">
      ${statCard('saffron', "Today's Registrations", todayRegs, 'New profiles created', iconUserPlus(), 'today')}
      ${statCard('blue', 'Incomplete Profiles', incomplete, 'Need more info', iconClipboard(), 'incomplete')}
      ${statCard('saffron', 'Registered Sebayats', counts.total, 'All registered profiles', iconUsers(), 'all')}
      ${statCard('blue', 'Pending Review', counts.pending, 'Awaiting decision', iconClock(), 'submitted')}
      ${statCard('green', 'Total Sebayats', counts.approved, 'Total Approved Sebayats', iconCheck(), 'approved')}
      ${statCard('red', 'Rejected', counts.rejected, 'Not approved', iconX(), 'rejected')}
      ${statCard('amber', 'Changes Req.', counts.changes, 'Awaiting resubmission', iconAlert(), 'changes_requested')}
    </div>

    <div style="margin-top:8px;display:grid;grid-template-columns:1fr 320px;gap:16px;align-items:start">

      <!-- Left: Today's Seba -->
      <div class="panel" style="padding:0;overflow:hidden">
        <div class="panel-header" style="padding:16px 20px 12px">
          <div>
            <div class="panel-title">Today's Seba</div>
            <div class="panel-sub">${new Date().toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long', year:'numeric' })}</div>
          </div>
          <div style="display:flex;gap:8px;align-items:center">
            <button class="btn btn-ghost btn-sm" id="dash-st-refresh-btn">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
              Refresh
            </button>
            <button class="btn btn-primary btn-sm" id="dash-st-walkin-btn">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Add Walk-in
            </button>
            <button class="link-action" onclick="actions.go('seba_today')">Full view</button>
          </div>
        </div>
        <div style="padding:0 20px 12px;display:flex;gap:10px;flex-wrap:wrap;border-bottom:1px solid #F3EDE6" id="dash-st-stats"></div>
        <div id="dash-st-table-wrap" style="padding:0 0 4px"></div>
      </div>

      <!-- Right: Needs attention -->
      <div class="panel">
        <div class="panel-header">
          <div>
            <div class="panel-title">Needs attention</div>
            <div class="panel-sub">Awaiting review</div>
          </div>
        </div>
        ${recentPending.length === 0 ? emptyState('All caught up', 'No pending applications right now.') : `
        <div class="activity-list">
          ${recentPending.map(seb => `
            <div class="activity-item" onclick="actions.openSebayat('${esc(seb.id)}')">
              <div class="row-avatar" ${seb.photo_url ? `style="background-image:url('${esc(seb.photo_url)}')"` : ''}>
                ${seb.photo_url ? '' : esc(getInitials(seb))}
              </div>
              <div class="activity-content">
                <div class="activity-line1"><strong>${esc(getName(seb))}</strong></div>
                <div class="activity-line2">${seb.seba_name ? esc(seb.seba_name) + ' · ' : ''}${seb.bansa_name ? esc(seb.bansa_name) : '—'}</div>
              </div>
              <div class="activity-time">${fmtRelative(seb.submitted_at || seb.created_at)}</div>
            </div>
          `).join('')}
        </div>`}
      </div>

    </div>
  `;
}

function statCard(accent, label, value, sub, icon, filter) {
  const clickable = filter ? ` clickable" onclick="actions.gotoApplications('${filter}')` : '';
  return `<div class="stat-card accent-${accent}${clickable}">
    <div class="stat-top">
      <div class="stat-label">${esc(label)}</div>
      <div class="stat-icon">${icon}</div>
    </div>
    <div class="stat-value">${value}</div>
    <div class="stat-sub">${esc(sub)}</div>
  </div>`;
}

function emptyState(title, msg, icon = iconInbox()) {
  return `<div class="empty-state">
    <div class="empty-icon">${icon}</div>
    <h3>${esc(title)}</h3>
    <p>${esc(msg)}</p>
  </div>`;
}

// ============================================================
// DASHBOARD SEBA PANEL
// ============================================================
async function _initDashboardSebaPanel() {
  await loadSebaTodayData();
  const statsEl = document.getElementById('dash-st-stats');
  const tableEl = document.getElementById('dash-st-table-wrap');
  if (!statsEl || !tableEl) return;

  const roster = state.sebaTodayRoster || [];
  const sessions = state.sebaTodaySessions || [];
  const totalScheduled = roster.length;
  const totalDone = roster.filter(r => { const s = sessionForRoster(r); return s && s.ended_at; }).length;
  const totalInProgress = roster.filter(r => { const s = sessionForRoster(r); return s && s.started_at && !s.ended_at; }).length;
  const totalAbsent = roster.filter(r => r.is_absent).length;
  const rosterSessionIds = new Set(roster.map(r => { const s = sessionForRoster(r); return s?.id; }).filter(Boolean));
  const walkins = sessions.filter(s => !rosterSessionIds.has(s.id) && s.ended_at);

  statsEl.innerHTML = '';
  statsEl.style.display = 'none';

  tableEl.innerHTML = _buildSebaTodayTable(roster, walkins, true);
  _attachDashSebaHandlers();
}

function _attachDashSebaHandlers() {
  const refreshBtn = document.getElementById('dash-st-refresh-btn');
  if (refreshBtn) refreshBtn.onclick = async () => { refreshBtn.disabled = true; await _initDashboardSebaPanel(); refreshBtn.disabled = false; };

  const walkinBtn = document.getElementById('dash-st-walkin-btn');
  if (walkinBtn) walkinBtn.onclick = () => openSebaTodayWalkinModal();

  // Wire up table action buttons (start/done/undo)
  _attachSebaTodayHandlers(document.getElementById('dash-st-table-wrap') || document.body);
}

// ============================================================
// APPLICATIONS
// ============================================================
function renderApplications() {
  const filtered = filteredSebayats();
  const sorted = sortedSebayats(filtered);
  const total = sorted.length;
  const pageStart = (state.page - 1) * state.pageSize;
  const pageEnd = Math.min(pageStart + state.pageSize, total);
  const pageItems = sorted.slice(pageStart, pageEnd);
  const headerLabel = state.filter === 'all' ? 'All Sebayats' : state.filter === 'today' ? "Today's Registrations" : state.filter === 'incomplete' ? 'Incomplete Profiles' : STATUS_LABELS[state.filter] || 'Applications';

  const counts = ALL_STATUSES.reduce((acc, s) => { acc[s] = state.sebayats.filter(x => x.profile_status === s).length; return acc; }, { all: state.sebayats.length });

  const sortArrow = (key) => {
    if (state.sort.key !== key) return '<span class="sort-arrow">↕</span>';
    return `<span class="sort-arrow">${state.sort.dir === 'asc' ? '↑' : '↓'}</span>`;
  };
  const sortClass = (key) => state.sort.key === key ? 'sortable sorted' : 'sortable';

  return `
    <div class="page-header">
      <div>
        <h1>${esc(headerLabel)}</h1>
        <p>Review and process sebayat applications</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-ghost btn-sm" onclick="actions.exportCsv()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Export CSV
        </button>
        <button class="btn btn-secondary btn-sm" onclick="actions.refresh()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10"/></svg>
          Refresh
        </button>
      </div>
    </div>

    <div class="toolbar">
      <div class="search-box">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input id="search-input" type="text" placeholder="Search name, phone, email, bansa, seba, reg. no…" value="${esc(state.search)}" />
        <kbd>/</kbd>
      </div>
      <div class="filter-tabs">
        ${['all', ...ALL_STATUSES].map(f => `
          <button class="filter-tab ${state.filter === f ? 'active' : ''}" data-filter="${f}">
            ${f === 'all' ? 'All' : esc(STATUS_LABELS[f])}
            <span class="count">${counts[f] ?? 0}</span>
          </button>
        `).join('')}
      </div>
    </div>

    <div id="bulk-bar" class="bulk-bar ${state.selectedIds.size > 0 ? 'active' : ''}">
      <span class="bulk-count">${state.selectedIds.size} selected</span>
      <span class="bulk-spacer"></span>
      <button class="btn btn-success btn-sm" onclick="actions.openBulk('approve')">Approve</button>
      <button class="btn btn-warning btn-sm" onclick="actions.openBulk('changes')">Request Changes</button>
      <button class="btn btn-danger btn-sm" onclick="actions.openBulk('reject')">Reject</button>
      <button class="btn btn-ghost btn-sm" onclick="actions.clearSelection()">Clear</button>
    </div>

    <div class="panel">
      <div class="data-table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th style="width:32px"><input type="checkbox" class="cb" id="select-all" ${pageItems.length > 0 && pageItems.every(s => state.selectedIds.has(s.id)) ? 'checked' : ''} /></th>
              <th class="${sortClass('name')}" data-sort="name">Applicant ${sortArrow('name')}</th>
              <th>Contact</th>
              <th>Seba</th>
              <th class="${sortClass('joining_year')}" data-sort="joining_year">Joining ${sortArrow('joining_year')}</th>
              <th>Status</th>
              <th class="${sortClass('submitted_at')}" data-sort="submitted_at">Submitted ${sortArrow('submitted_at')}</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${pageItems.length === 0 ? `<tr><td colspan="8">${emptyState('No applications found', state.search ? 'Try adjusting your search or filter.' : 'There are no applications matching this filter.')}</td></tr>` :
              pageItems.map(s => renderRow(s)).join('')}
          </tbody>
        </table>
      </div>
      <div class="table-footer">
        <span class="table-count">Showing <strong>${total === 0 ? 0 : pageStart + 1}</strong>–<strong>${pageEnd}</strong> of <strong>${total}</strong> applications</span>
        <div class="page-size">
          <span>Rows:</span>
          <select id="page-size">
            ${[25,50,100].map(n => `<option value="${n}" ${state.pageSize === n ? 'selected' : ''}>${n}</option>`).join('')}
          </select>
        </div>
        ${renderPagination(total)}
      </div>
    </div>
  `;
}

function renderRow(s) {
  const status = s.profile_status || 'draft';
  const canAct = ['submitted','resubmitted'].includes(status);
  const joining = s.joining_year || (s.joining_date ? s.joining_date.slice(0,4) : '—');
  const checked = state.selectedIds.has(s.id);
  return `<tr ${checked ? 'class="row-selected"' : ''} data-id="${esc(s.id)}">
    <td><input type="checkbox" class="cb row-cb" data-id="${esc(s.id)}" ${checked ? 'checked' : ''} /></td>
    <td>
      <div class="row-name" onclick="actions.openSebayat('${esc(s.id)}')" style="cursor:pointer">
        <div class="row-avatar" ${s.photo_url ? `style="background-image:url('${esc(s.photo_url)}')"` : ''}>${s.photo_url ? '' : esc(getInitials(s))}</div>
        <div class="row-name-main">
          <div class="row-name-text">${esc(getName(s))}</div>
          ${s.registration_no ? `<div class="row-name-sub">Reg: ${esc(s.registration_no)}</div>` : (s.alias_name ? `<div class="row-name-sub">${esc(s.alias_name)}</div>` : '')}
        </div>
      </div>
    </td>
    <td>
      <div class="cell-stack">
        <div class="cell-stack-main">${s.phone ? '+' + esc(s.phone) : '—'}</div>
        ${s.email ? `<div class="cell-stack-sub">${esc(s.email)}</div>` : ''}
      </div>
    </td>
    <td>
      <div class="cell-stack">
        <div class="cell-stack-main">${esc(s.seba_name || '—')}</div>
        ${s.bansa_name ? `<div class="cell-stack-sub">${esc(s.bansa_name)}${s.palia_number ? ' · Palia ' + esc(s.palia_number) : ''}</div>` : ''}
      </div>
    </td>
    <td>${esc(joining)}</td>
    <td><span class="status-badge status-${esc(status)}">${esc(STATUS_LABELS[status] || status)}</span></td>
    <td>${s.submitted_at ? fmtDate(s.submitted_at) : '—'}</td>
    <td>
      <div class="row-actions">
        <button class="btn btn-ghost btn-xs" onclick="actions.openSebayat('${esc(s.id)}')">View</button>
        ${canAct ? `
          <button class="btn btn-success btn-xs" onclick="actions.openAction('${esc(s.id)}','approve')">Approve</button>
          <button class="btn btn-danger btn-xs" onclick="actions.openAction('${esc(s.id)}','reject')">Reject</button>
        ` : ''}
      </div>
    </td>
  </tr>`;
}

function renderPagination(total) {
  const totalPages = Math.max(1, Math.ceil(total / state.pageSize));
  if (state.page > totalPages) state.page = totalPages;
  const cur = state.page;
  const pages = [];
  const push = p => pages.push(p);
  push(1);
  if (cur - 2 > 2) push('…');
  for (let i = Math.max(2, cur - 1); i <= Math.min(totalPages - 1, cur + 1); i++) push(i);
  if (cur + 2 < totalPages - 1) push('…');
  if (totalPages > 1) push(totalPages);
  return `<div class="pagination">
    <button ${cur === 1 ? 'disabled' : ''} data-page="${cur - 1}">‹</button>
    ${pages.map(p => p === '…' ? '<button disabled>…</button>' : `<button class="${p === cur ? 'active' : ''}" data-page="${p}">${p}</button>`).join('')}
    <button ${cur === totalPages ? 'disabled' : ''} data-page="${cur + 1}">›</button>
  </div>`;
}

// ============================================================
// ACTIVITY LOG (Unified)
// ============================================================
const ACTION_TYPE_CONFIG = {
  login:           { label: 'Login',           color: '#065F46', bg: '#ECFDF5' },
  logout:          { label: 'Logout',          color: '#6B7280', bg: '#F9FAFB' },
  session_expired: { label: 'Session Expired', color: '#92400E', bg: '#FFF3E8' },
  access_denied:   { label: 'Access Denied',   color: '#991B1B', bg: '#FEF2F2' },
  login_failed:    { label: 'Login Failed',    color: '#991B1B', bg: '#FEF2F2' },
  create:          { label: 'Created',         color: '#1D4ED8', bg: '#EFF6FF' },
  update:          { label: 'Updated',         color: '#1D4ED8', bg: '#EFF6FF' },
  delete:          { label: 'Deleted',         color: '#991B1B', bg: '#FEF2F2' },
  approve:         { label: 'Approved',        color: '#065F46', bg: '#ECFDF5' },
  reject:          { label: 'Rejected',        color: '#991B1B', bg: '#FEF2F2' },
  export:          { label: 'Exported',        color: '#7C3AED', bg: '#F5F3FF' },
  admin_added:     { label: 'Admin Added',     color: '#065F46', bg: '#ECFDF5' },
  admin_removed:   { label: 'Admin Removed',   color: '#991B1B', bg: '#FEF2F2' },
  role_assigned:   { label: 'Role Assigned',   color: '#92400E', bg: '#FFF3E8' },
  settings_changed:{ label: 'Settings',        color: '#92400E', bg: '#FFF3E8' },
  anchor_changed:  { label: 'Anchor Changed',  color: '#92400E', bg: '#FFF3E8' },
  mark_start:      { label: 'Started',         color: '#1D4ED8', bg: '#EFF6FF' },
  mark_done:       { label: 'Completed',       color: '#065F46', bg: '#ECFDF5' },
  mark_absent:     { label: 'Marked Absent',   color: '#92400E', bg: '#FFF3E8' },
  notice_published:{ label: 'Published',       color: '#065F46', bg: '#ECFDF5' },
};

function getActionBadge(actionType) {
  const cfg = ACTION_TYPE_CONFIG[actionType] || { label: actionType, color: '#6B7280', bg: '#F9FAFB' };
  return `<span style="display:inline-block;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:600;background:${cfg.bg};color:${cfg.color};white-space:nowrap">${esc(cfg.label)}</span>`;
}

function renderActivity() {
  const f = state.unifiedLogFilter;
  const logs = state.unifiedLog;
  const adminOptions = state.admins.map(a => {
    const seb = state.sebayats.find(x => x.id === a.user_id);
    return `<option value="${esc(a.user_id)}" ${f.admin === a.user_id ? 'selected' : ''}>${seb ? esc(getName(seb)) : esc(a.actor_email || a.user_id?.slice(0,12) || '?')}</option>`;
  }).join('');
  const actionTypeOptions = Object.entries(ACTION_TYPE_CONFIG).map(([k, v]) =>
    `<option value="${esc(k)}" ${f.actionType === k ? 'selected' : ''}>${esc(v.label)}</option>`
  ).join('');
  const resourceTypeOptions = ROLE_RESOURCES.map(r =>
    `<option value="${esc(r.id)}" ${f.resourceType === r.id ? 'selected' : ''}>${esc(r.label)}</option>`
  ).join('');
  const loading = state.unifiedLogLoading;
  const canExport = can('activity_log', 'export');

  return `
    <div class="page-header">
      <div>
        <h1>Activity Log</h1>
        <p>Complete audit trail of every admin action — logins, approvals, edits, deletions, and more</p>
      </div>
      <div class="page-actions">
        ${canExport ? `<button class="btn btn-ghost btn-sm" onclick="actions.exportActivityLog()">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Export CSV
        </button>` : ''}
        <button class="btn btn-ghost btn-sm" onclick="actions.clearUnifiedLogFilters()">Clear filters</button>
        <button class="btn btn-primary btn-sm" onclick="actions.loadUnifiedLog()">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
          Refresh
        </button>
      </div>
    </div>
    <div class="toolbar" style="flex-wrap:wrap;gap:8px">
      <div class="field" style="margin:0;display:flex;align-items:center;gap:6px">
        <label style="margin:0;font-size:12px;white-space:nowrap">From</label>
        <input id="ulog-from" type="date" value="${esc(f.from)}" style="padding:7px 10px;border:1.5px solid var(--border);border-radius:8px;background:var(--surface)" />
      </div>
      <div class="field" style="margin:0;display:flex;align-items:center;gap:6px">
        <label style="margin:0;font-size:12px;white-space:nowrap">To</label>
        <input id="ulog-to" type="date" value="${esc(f.to)}" style="padding:7px 10px;border:1.5px solid var(--border);border-radius:8px;background:var(--surface)" />
      </div>
      <select id="ulog-admin" style="padding:7px 10px;border:1.5px solid var(--border);border-radius:8px;background:var(--surface);font-size:13px">
        <option value="all">All admins</option>
        ${adminOptions}
      </select>
      <select id="ulog-action" style="padding:7px 10px;border:1.5px solid var(--border);border-radius:8px;background:var(--surface);font-size:13px">
        <option value="all">All actions</option>
        ${actionTypeOptions}
      </select>
      <select id="ulog-resource" style="padding:7px 10px;border:1.5px solid var(--border);border-radius:8px;background:var(--surface);font-size:13px">
        <option value="all">All resources</option>
        ${resourceTypeOptions}
      </select>
      <input id="ulog-search" type="text" value="${esc(f.search)}" placeholder="Search label…"
        style="padding:7px 10px;border:1.5px solid var(--border);border-radius:8px;background:var(--surface);font-size:13px;min-width:160px" />
      <span class="toolbar-spacer"></span>
      <span style="font-size:13px;color:var(--ink3);white-space:nowrap">
        Showing <strong>${logs.length}</strong>${state.unifiedLogTotal > logs.length ? ` of ${state.unifiedLogTotal}` : ''} entries
      </span>
    </div>
    <div class="panel">
      ${loading ? `<div style="padding:40px;text-align:center;color:var(--ink3)">Loading activity log…</div>` : ''}
      ${!loading && !state.unifiedLogLoaded ? `<div style="padding:40px;text-align:center">
        <button class="btn btn-primary" onclick="actions.loadUnifiedLog()">Load Activity Log</button>
        <div style="margin-top:8px;color:var(--ink3);font-size:13px">Click to load the audit trail</div>
      </div>` : ''}
      ${!loading && state.unifiedLogLoaded ? `
        <div class="data-table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Admin</th>
                <th>Action</th>
                <th>Resource</th>
                <th>Detail</th>
                <th style="text-align:center">Info</th>
              </tr>
            </thead>
            <tbody>
              ${logs.length === 0 ? `<tr><td colspan="6">${emptyState('No activity matches', 'Try adjusting the filters or date range.')}</td></tr>` :
                logs.map((entry, idx) => {
                  const adminSeb = state.sebayats.find(x => x.id === entry.actor_id);
                  const adminName = adminSeb ? getName(adminSeb) : (entry.actor_email || (entry.actor_id ? entry.actor_id.slice(0,12) + '…' : '—'));
                  const roleColor = state.roles.find(r => r.role_name === entry.role_snapshot)?.color || '#6B7280';
                  const hasDetails = (entry.old_value || entry.new_value || entry.metadata || entry.ip_address);
                  return `<tr style="vertical-align:top">
                    <td style="white-space:nowrap;color:var(--ink2);font-size:12px">
                      <div style="font-weight:500">${fmtRelative(entry.created_at)}</div>
                      <div style="color:var(--ink4);font-size:11px">${fmtDate(entry.created_at, true)}</div>
                    </td>
                    <td>
                      <div style="font-weight:500;font-size:13px">${esc(adminName)}</div>
                      <span style="display:inline-block;padding:1px 7px;border-radius:20px;font-size:10px;font-weight:600;background:${esc(roleColor)}18;color:${esc(roleColor)};border:1px solid ${esc(roleColor)}30;margin-top:2px">${esc(entry.role_snapshot || '—')}</span>
                    </td>
                    <td>${getActionBadge(entry.action_type)}</td>
                    <td style="color:var(--ink2);font-size:13px">
                      <div style="font-weight:500">${esc(ROLE_RESOURCES.find(r => r.id === entry.resource_type)?.label || entry.resource_type || '—')}</div>
                      ${entry.resource_id ? `<div style="font-family:monospace;font-size:10px;color:var(--ink4)">${esc(entry.resource_id.slice(0,12))}…</div>` : ''}
                    </td>
                    <td style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--ink2);font-size:13px">
                      ${esc(entry.resource_label || '—')}
                    </td>
                    <td style="text-align:center">
                      ${hasDetails ? `<button class="btn btn-ghost btn-xs" onclick="actions.toggleLogDetail('ulog-detail-${idx}')">Details</button>` : '—'}
                    </td>
                  </tr>
                  ${hasDetails ? `<tr id="ulog-detail-${idx}" style="display:none;background:var(--surface2)">
                    <td colspan="6" style="padding:12px 20px">
                      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;font-size:12px">
                        ${entry.old_value ? `<div>
                          <div style="font-weight:600;color:#B91C1C;margin-bottom:8px;display:flex;align-items:center;gap:6px">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                            Before
                          </div>
                          <div style="background:#FEF2F2;border:1px solid #FCA5A5;border-radius:8px;padding:10px 12px;display:flex;flex-direction:column;gap:8px">
                            ${formatActivityData(entry.old_value)}
                          </div>
                        </div>` : '<div></div>'}
                        ${entry.new_value ? `<div>
                          <div style="font-weight:600;color:#065F46;margin-bottom:8px;display:flex;align-items:center;gap:6px">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><polyline points="9 12 11 14 15 10"/></svg>
                            After
                          </div>
                          <div style="background:#ECFDF5;border:1px solid #6EE7B7;border-radius:8px;padding:10px 12px;display:flex;flex-direction:column;gap:8px">
                            ${formatActivityData(entry.new_value)}
                          </div>
                        </div>` : '<div></div>'}
                      </div>
                      ${(entry.ip_address || entry.user_agent) ? `<div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border-light);display:flex;gap:24px;font-size:11px;color:var(--ink3)">
                        ${entry.ip_address ? `<div><span style="font-weight:600">IP:</span> ${esc(entry.ip_address)}</div>` : ''}
                        ${entry.user_agent ? `<div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:480px"><span style="font-weight:600">UA:</span> ${esc(entry.user_agent)}</div>` : ''}
                      </div>` : ''}
                    </td>
                  </tr>` : ''}`;
                }).join('')}
            </tbody>
          </table>
        </div>
        ${state.unifiedLogTotal > 50 ? `<div class="table-footer" style="justify-content:space-between">
          <span class="table-count">${state.unifiedLogTotal} total entries</span>
          <div style="display:flex;gap:8px;align-items:center">
            <button class="btn btn-ghost btn-sm" onclick="actions.loadUnifiedLog(${state.unifiedLogPage - 1})" ${state.unifiedLogPage <= 1 ? 'disabled' : ''}>← Previous</button>
            <span style="font-size:13px;color:var(--ink3)">Page ${state.unifiedLogPage}</span>
            <button class="btn btn-ghost btn-sm" onclick="actions.loadUnifiedLog(${state.unifiedLogPage + 1})" ${logs.length < 50 ? 'disabled' : ''}>Next →</button>
          </div>
        </div>` : `<div class="table-footer"><span class="table-count">${logs.length} entries</span></div>`}
      ` : ''}
    </div>
  `;
}

// ============================================================
// ACTIVITY LOG HELPERS
// ============================================================

const ACTIVITY_FIELD_LABELS = {
  status: 'Status',
  remarks: 'Remarks',
  profile_status: 'Profile Status',
  role: 'Role',
  role_name: 'Role Name',
  email: 'Email',
  phone: 'Phone',
  first_name: 'First Name',
  last_name: 'Last Name',
  full_name: 'Full Name',
  is_disabled: 'Account Disabled',
  is_super_admin: 'Super Admin',
  action: 'Action',
  resource: 'Resource',
  permission: 'Permission',
};

const ACTIVITY_STATUS_COLORS = {
  approved:          { bg: '#D1FAE5', fg: '#065F46', label: 'Approved' },
  rejected:          { bg: '#FEE2E2', fg: '#991B1B', label: 'Rejected' },
  submitted:         { bg: '#DBEAFE', fg: '#1E40AF', label: 'Submitted' },
  resubmitted:       { bg: '#EDE9FE', fg: '#5B21B6', label: 'Resubmitted' },
  changes_requested: { bg: '#FEF3C7', fg: '#92400E', label: 'Changes Requested' },
  draft:             { bg: '#F3F4F6', fg: '#374151', label: 'Draft' },
};

function formatActivityFieldValue(key, val) {
  if (val === null || val === undefined || val === '') return '<span style="color:#9CA3AF;font-style:italic">—</span>';
  if (typeof val === 'boolean') return val
    ? '<span style="color:#059669;font-weight:600">Yes</span>'
    : '<span style="color:#DC2626;font-weight:600">No</span>';

  const strVal = String(val);

  if (key === 'status' || key === 'profile_status') {
    const c = ACTIVITY_STATUS_COLORS[strVal];
    if (c) return `<span style="display:inline-block;padding:2px 9px;border-radius:20px;font-size:11px;font-weight:700;background:${c.bg};color:${c.fg}">${c.label}</span>`;
  }

  // Multi-line values (remarks with bullet points): render as a list
  if (strVal.includes('\n')) {
    const lines = strVal.split('\n').map(l => l.trim()).filter(Boolean);
    return `<ul style="margin:0;padding-left:14px;display:flex;flex-direction:column;gap:3px">${lines.map(l => `<li style="font-size:12px;color:inherit">${esc(l)}</li>`).join('')}</ul>`;
  }

  return `<span style="font-size:12px">${esc(strVal)}</span>`;
}

function formatActivityData(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    return `<span style="font-size:12px;color:inherit">${esc(String(obj ?? '—'))}</span>`;
  }
  const entries = Object.entries(obj).filter(([, v]) => v !== undefined);
  if (entries.length === 0) return '<span style="color:#9CA3AF;font-style:italic">No data</span>';
  return entries.map(([k, v]) => {
    const label = ACTIVITY_FIELD_LABELS[k] || k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    return `<div style="display:flex;flex-direction:column;gap:2px">
      <span style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;opacity:0.6">${esc(label)}</span>
      <div>${formatActivityFieldValue(k, v)}</div>
    </div>`;
  }).join('');
}

// ============================================================
// PERMISSION GRID COMPONENT
// ============================================================

// Full resource catalogue grouped by nav section
const PERMISSION_SECTIONS = [
  {
    label: 'Sebayat Profiles',
    resources: [
      { key: 'applications', label: 'Applications' },
      { key: 'sebayat_profiles', label: 'Sebayat Profiles' },
      { key: 'activity_log', label: 'Activity Log' },
    ],
  },
  {
    label: 'Seba',
    resources: [
      { key: 'seba_today', label: 'Seba Today' },
      { key: 'seba_calendar', label: 'Seba Calendar' },
      { key: 'seba_history', label: 'Seba History' },
      { key: 'seba_assign', label: 'Seba Assignments' },
      { key: 'seba_categories', label: 'Seba Categories' },
      { key: 'nijog', label: 'Nijog' },
    ],
  },
  {
    label: 'Management',
    resources: [
      { key: 'notices', label: 'Notices' },
      { key: 'committees', label: 'Committees' },
      { key: 'reports', label: 'Reports' },
    ],
  },
  {
    label: 'Settings',
    resources: [
      { key: 'admins', label: 'Admin Users' },
      { key: 'roles', label: 'Roles & Permissions' },
      { key: 'settings', label: 'System Settings' },
      { key: 'notifications', label: 'Notifications' },
    ],
  },
];

const PERMISSION_ACTIONS = ['view', 'create', 'edit', 'delete', 'approve', 'export'];

// Returns current override state for a cell: 'grant' | 'deny' | 'default'
function getOverrideState(gridId, resource, action) {
  const el = document.querySelector(`[data-grid="${gridId}"][data-resource="${resource}"][data-action="${action}"]`);
  return el ? el.dataset.state : 'default';
}

// Collect all non-default overrides from a rendered grid
function collectGridOverrides(gridId) {
  const overrides = [];
  document.querySelectorAll(`[data-grid="${gridId}"]`).forEach(el => {
    if (el.dataset.state !== 'default') {
      overrides.push({ resource: el.dataset.resource, action: el.dataset.action, granted: el.dataset.state === 'grant' });
    }
  });
  return overrides;
}

// Render permission grid HTML. rolePerms = Set of "resource:action" for the baseline role.
// existingOverrides = array of { resource, action, granted } from admin_user_permissions.
function renderPermissionGrid(gridId, rolePerms, existingOverrides = []) {
  const overrideMap = {};
  for (const o of existingOverrides) {
    overrideMap[`${o.resource}:${o.action}`] = o.granted ? 'grant' : 'deny';
  }

  const actionLabels = { view: 'View', create: 'Create', edit: 'Edit', delete: 'Delete', approve: 'Approve', export: 'Export' };

  let html = `<div class="perm-grid" id="perm-grid-${gridId}">`;
  html += `<div class="perm-grid-header">
    <div class="perm-grid-resource-col"></div>
    ${PERMISSION_ACTIONS.map(a => `<div class="perm-grid-action-col">${actionLabels[a]}</div>`).join('')}
  </div>`;

  for (const section of PERMISSION_SECTIONS) {
    html += `<div class="perm-grid-section-label">${section.label}</div>`;
    for (const res of section.resources) {
      html += `<div class="perm-grid-row">`;
      html += `<div class="perm-grid-resource-col">${res.label}</div>`;
      for (const action of PERMISSION_ACTIONS) {
        const key = `${res.key}:${action}`;
        const roleGrants = rolePerms ? rolePerms.has(key) : false;
        const currentState = overrideMap[key] || 'default';
        html += `<div class="perm-grid-action-col">
          <button type="button"
            class="perm-cell perm-cell--${currentState}${roleGrants ? ' perm-cell--role-grants' : ''}"
            data-grid="${gridId}"
            data-resource="${res.key}"
            data-action="${action}"
            data-state="${currentState}"
            data-role-grants="${roleGrants}"
            title="${roleGrants ? 'Role grants this' : 'Role does not grant this'}"
            onclick="cyclePermCell(this)">
            ${currentState === 'grant' ? '&#10003;' : currentState === 'deny' ? '&#10005;' : roleGrants ? '<span class="perm-role-dot"></span>' : '<span class="perm-empty-dot"></span>'}
          </button>
        </div>`;
      }
      html += `</div>`;
    }
  }

  html += `<div class="perm-grid-legend">
    <span class="perm-legend-item"><button class="perm-cell perm-cell--default perm-cell--role-grants" style="pointer-events:none"><span class="perm-role-dot"></span></button> Role grants</span>
    <span class="perm-legend-item"><button class="perm-cell perm-cell--default" style="pointer-events:none"><span class="perm-empty-dot"></span></button> Role denies</span>
    <span class="perm-legend-item"><button class="perm-cell perm-cell--grant" style="pointer-events:none">&#10003;</button> Force grant</span>
    <span class="perm-legend-item"><button class="perm-cell perm-cell--deny" style="pointer-events:none">&#10005;</button> Force deny</span>
  </div>`;

  html += `</div>`;
  return html;
}

// Cycle cell: default → grant → deny → default
function cyclePermCell(btn) {
  const states = ['default', 'grant', 'deny'];
  const cur = btn.dataset.state;
  const next = states[(states.indexOf(cur) + 1) % states.length];
  const roleGrants = btn.dataset.roleGrants === 'true';
  btn.dataset.state = next;
  btn.className = `perm-cell perm-cell--${next}${roleGrants ? ' perm-cell--role-grants' : ''}`;
  if (next === 'grant') btn.innerHTML = '&#10003;';
  else if (next === 'deny') btn.innerHTML = '&#10005;';
  else btn.innerHTML = roleGrants ? '<span class="perm-role-dot"></span>' : '<span class="perm-empty-dot"></span>';
}

// Load role permissions for a given role_id (returns a Set of "resource:action" strings)
async function fetchRolePerms(roleId) {
  if (!roleId) return new Set();
  const { data } = await db.from('role_permissions').select('resource, action').eq('role_id', roleId);
  const s = new Set();
  for (const p of (data || [])) s.add(`${p.resource}:${p.action}`);
  return s;
}

// ============================================================
// ADMINS
// ============================================================
function renderAdmins() {
  const canAdd = can('admins', 'create');
  const canEdit = can('admins', 'edit');
  const canDelete = can('admins', 'delete');
  const roleOptions = state.roles.map(r =>
    `<option value="${esc(r.id)}">${esc(r.role_name)}</option>`
  ).join('');
  return `
    <div class="page-header">
      <div>
        <h1>Admin Users</h1>
        <p>Manage who can access the admin dashboard and assign their roles</p>
      </div>
      <div class="page-actions">
        ${canAdd ? `<button class="btn btn-primary btn-sm" onclick="actions.openAddAdmin()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add Admin
        </button>` : ''}
      </div>
    </div>
    <div class="panel">
      <div class="data-table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Admin</th>
              <th>Role</th>
              <th>Added</th>
              <th>Last Activity</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${state.admins.length === 0 ? `<tr><td colspan="6">${emptyState('No admins yet', 'Add the first administrator to get started.')}</td></tr>` :
              state.admins.map(a => {
                const seb = state.sebayats.find(x => x.id === a.user_id);
                const isMe = a.user_id === state.user?.id;
                const lastAct = state.history.find(h => h.changed_by === a.user_id);
                const role = state.roles.find(r => r.id === a.role_id);
                const roleName = role?.role_name || (a.is_super_admin ? 'Super Admin' : 'Admin');
                const roleColor = role?.color || '#6B7280';
                const isSystemSuperAdmin = a.added_by === null;
                const overrideCount = (state.adminOverrideCounts || {})[a.id] || 0;
                const canManagePerms = canEdit && !isMe && !isSystemSuperAdmin && !a.is_super_admin;
                return `<tr>
                  <td>
                    <div class="row-name">
                      <div class="row-avatar">${seb ? esc(getInitials(seb)) : 'A'}</div>
                      <div class="row-name-main">
                        <div class="row-name-text">${seb ? esc(getName(seb)) : 'Admin'} ${isMe ? '<span style="color:var(--saffron);font-size:11px;font-weight:600;margin-left:6px">(you)</span>' : ''}</div>
                        ${a.email ? `<div class="row-name-sub">${esc(a.email)}</div>` : (seb?.phone ? `<div class="row-name-sub">+${esc(seb.phone)}</div>` : '')}
                      </div>
                    </div>
                  </td>
                  <td>
                    ${canEdit && !isMe && !isSystemSuperAdmin
                      ? `<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
                          <select class="admin-role-sel" data-admin-id="${esc(a.id)}" style="padding:4px 8px;border:1.5px solid var(--border);border-radius:6px;font-size:12px;font-weight:600;color:${esc(roleColor)};background:var(--surface);cursor:pointer">
                            ${state.roles.map(r => `<option value="${esc(r.id)}" ${a.role_id === r.id ? 'selected' : ''}>${esc(r.role_name)}</option>`).join('')}
                          </select>
                          ${overrideCount > 0 ? `<span class="custom-badge" title="${overrideCount} custom permission override${overrideCount === 1 ? '' : 's'}">Custom</span>` : ''}
                        </div>`
                      : `<div style="display:inline-flex;align-items:center;gap:6px;flex-wrap:wrap">
                          <span style="display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:20px;font-size:12px;font-weight:600;background:${esc(roleColor)}18;color:${esc(roleColor)};border:1px solid ${esc(roleColor)}33">
                            <span style="width:6px;height:6px;border-radius:50%;background:${esc(roleColor)};flex-shrink:0"></span>
                            ${esc(roleName)}${isSystemSuperAdmin ? ' <span style="font-size:10px;opacity:0.7">(system)</span>' : ''}
                          </span>
                          ${overrideCount > 0 ? `<span class="custom-badge" title="${overrideCount} custom permission override${overrideCount === 1 ? '' : 's'}">Custom</span>` : ''}
                        </div>`
                    }
                  </td>
                  <td>${fmtDate(a.created_at)}</td>
                  <td>${lastAct ? `<div class="cell-stack"><div class="cell-stack-main">${fmtRelative(lastAct.created_at)}</div><div class="cell-stack-sub">${esc(STATUS_LABELS[lastAct.to_status] || lastAct.to_status)}</div></div>` : '<span style="color:var(--ink4)">No actions yet</span>'}</td>
                  <td>
                    ${a.is_disabled
                      ? `<span class="status-badge status-rejected">Disabled</span>`
                      : `<span class="status-badge status-approved">Active</span>`}
                  </td>
                  <td>
                    <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
                    ${!isMe && !isSystemSuperAdmin && canEdit ? `
                      <button class="btn btn-xs" style="background:var(--surface);border:1.5px solid var(--border);color:var(--ink2)" onclick="actions.openResetPassword('${esc(a.id)}','${esc(a.email||'')}')">Reset PW</button>
                      <button class="btn btn-xs" style="background:var(--surface);border:1.5px solid ${a.is_disabled ? '#16a34a' : '#dc2626'};color:${a.is_disabled ? '#16a34a' : '#dc2626'}" onclick="actions.toggleAdminDisabled('${esc(a.id)}',${a.is_disabled})">${a.is_disabled ? 'Enable' : 'Disable'}</button>
                    ` : ''}
                    ${canManagePerms ? `<button class="btn btn-xs" style="background:var(--teal-bg);border:1.5px solid var(--teal);color:var(--teal)" onclick="actions.openAdminPermissions('${esc(a.id)}')">Permissions</button>` : ''}
                    ${canDelete && !isMe && !isSystemSuperAdmin
                      ? `<button class="btn btn-danger btn-xs" onclick="actions.removeAdmin('${esc(a.id)}')">Remove</button>`
                      : `<span style="color:var(--ink4);font-size:12px">${isSystemSuperAdmin ? 'Protected' : isMe ? 'You' : ''}</span>`
                    }
                    </div>
                  </td>
                </tr>`;
              }).join('')}
          </tbody>
        </table>
      </div>
      <div class="table-footer">
        <span class="table-count">${state.admins.length} administrator${state.admins.length === 1 ? '' : 's'} total</span>
      </div>
    </div>
  `;
}

function attachAdminsHandlers() {
  document.querySelectorAll('.admin-role-sel').forEach(sel => {
    sel.onchange = () => actions.changeAdminRole(sel.dataset.adminId, sel.value);
  });
}

// ============================================================
// ROLES & PERMISSIONS
// ============================================================
const ROLE_RESOURCES = [
  { id: 'sebayat_profiles', label: 'Sebayat Profiles' },
  { id: 'applications', label: 'Applications' },
  { id: 'seba_today', label: "Today's Seba" },
  { id: 'seba_calendar', label: 'Seba Calendar' },
  { id: 'seba_history', label: 'Seba History' },
  { id: 'seba_assign', label: 'Seba Assign' },
  { id: 'seba_categories', label: 'Seba Categories' },
  { id: 'nijog', label: 'Nijog Assignments' },
  { id: 'notices', label: 'Notices' },
  { id: 'committees', label: 'Committees' },
  { id: 'admins', label: 'Admin Users' },
  { id: 'roles', label: 'Roles & Permissions' },
  { id: 'settings', label: 'Settings' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'activity_log', label: 'Activity Log' },
  { id: 'reports', label: 'Reports' },
];
const ROLE_ACTIONS = ['view','create','edit','delete','approve','export'];
const ACTION_LABELS = { view: 'View', create: 'Create', edit: 'Edit', delete: 'Delete', approve: 'Approve', export: 'Export' };

function renderRolesView() {
  const editingRole = state.roleEditTarget;

  if (editingRole) {
    const perms = state.rolePermissions[editingRole.id] || new Set();
    const isSystem = editingRole.is_system_role;
    return `
      <div class="page-header">
        <div>
          <h1 style="display:flex;align-items:center;gap:10px">
            <button class="btn btn-ghost btn-sm" onclick="actions.closeRoleEdit()" style="padding:4px 8px">← Back</button>
            ${isSystem ? '🔒 ' : ''}${esc(editingRole.role_name)}
          </h1>
          <p>${esc(editingRole.description)}${isSystem ? ' — System role (read-only)' : ''}</p>
        </div>
        ${!isSystem ? `<div class="page-actions">
          <button class="btn btn-primary btn-sm" onclick="actions.saveRolePermissions()">Save Permissions</button>
        </div>` : ''}
      </div>
      <div class="panel" style="overflow:auto">
        <div style="font-size:13px;font-weight:600;color:var(--ink2);padding:16px 20px 8px;border-bottom:1px solid var(--border-light)">
          Permission Matrix — ${esc(editingRole.role_name)}
        </div>
        <table class="data-table" id="role-perms-table">
          <thead>
            <tr>
              <th style="min-width:160px">Resource</th>
              ${ROLE_ACTIONS.map(a => `<th style="text-align:center;min-width:70px">${esc(ACTION_LABELS[a])}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${ROLE_RESOURCES.map(res => `
              <tr>
                <td style="font-weight:500;color:var(--ink1)">${esc(res.label)}</td>
                ${ROLE_ACTIONS.map(act => {
                  const has = perms.has(`${res.id}:${act}`);
                  return `<td style="text-align:center">
                    <input type="checkbox" class="perm-cb"
                      data-resource="${esc(res.id)}" data-action="${esc(act)}"
                      ${has ? 'checked' : ''} ${isSystem ? 'disabled' : ''}
                      style="width:16px;height:16px;cursor:${isSystem ? 'not-allowed' : 'pointer'}" />
                  </td>`;
                }).join('')}
              </tr>`).join('')}
          </tbody>
        </table>
        <div style="padding:16px 20px;border-top:1px solid var(--border-light);display:flex;align-items:center;gap:8px;color:var(--ink3);font-size:12px">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          ${isSystem ? 'System role permissions are locked and cannot be edited.' : 'Changes take effect for all admins with this role on their next action or page refresh.'}
        </div>
      </div>
    `;
  }

  // Role list view
  const memberCounts = {};
  for (const a of state.admins) {
    if (a.role_id) memberCounts[a.role_id] = (memberCounts[a.role_id] || 0) + 1;
  }

  return `
    <div class="page-header">
      <div>
        <h1>Roles &amp; Permissions</h1>
        <p>Define what each role can see and do in the admin dashboard</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-primary btn-sm" onclick="actions.openCreateRole()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Create Role
        </button>
      </div>
    </div>
    <div class="panel">
      <div class="data-table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Role</th>
              <th>Description</th>
              <th style="text-align:center">Members</th>
              <th style="text-align:center">Type</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${state.roles.map(role => {
              const count = memberCounts[role.id] || 0;
              return `<tr>
                <td>
                  <div style="display:flex;align-items:center;gap:10px">
                    <div style="width:10px;height:10px;border-radius:50%;background:${esc(role.color)};flex-shrink:0"></div>
                    <span style="font-weight:600;color:var(--ink1)">${esc(role.role_name)}</span>
                  </div>
                </td>
                <td style="color:var(--ink2);max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(role.description || '—')}</td>
                <td style="text-align:center">
                  <span style="font-weight:600;color:${count > 0 ? 'var(--ink1)' : 'var(--ink4)'}">${count}</span>
                </td>
                <td style="text-align:center">
                  ${role.is_system_role
                    ? `<span style="display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:600;background:#F5F0E8;color:#92400E;border:1px solid #FCD34D66">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                        System
                      </span>`
                    : `<span style="display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:600;background:#F0F9F4;color:#065F46;border:1px solid #6EE7B766">Custom</span>`
                  }
                </td>
                <td style="color:var(--ink3);font-size:13px">${fmtDate(role.created_at)}</td>
                <td>
                  <div style="display:flex;gap:6px;align-items:center">
                    <button class="btn btn-ghost btn-xs" onclick="actions.openRoleEdit('${esc(role.id)}')">
                      ${role.is_system_role ? 'View' : 'Edit'}
                    </button>
                    ${!role.is_system_role
                      ? `<button class="btn btn-danger btn-xs" onclick="actions.deleteRole('${esc(role.id)}')" ${count > 0 ? `disabled title="${count} admin(s) have this role — reassign first"` : ''}>
                          Delete
                        </button>`
                      : ''
                    }
                  </div>
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
      <div class="table-footer">
        <span class="table-count">${state.roles.length} role${state.roles.length === 1 ? '' : 's'} total (${state.roles.filter(r => r.is_system_role).length} system, ${state.roles.filter(r => !r.is_system_role).length} custom)</span>
      </div>
    </div>
  `;
}

function attachRolesHandlers() {
  // permission checkboxes handled inline by saveRolePermissions reading the DOM
}

// ============================================================
// HANDLERS
// ============================================================
function attachViewHandlers() {
  // Search
  const search = $('#search-input');
  if (search) {
    search.oninput = (e) => {
      state.search = e.target.value;
      state.page = 1;
      const val = e.target.value;
      const selStart = e.target.selectionStart;
      const selEnd = e.target.selectionEnd;
      render();
      const inp = $('#search-input');
      if (inp) {
        inp.focus();
        inp.setSelectionRange(selStart, selEnd);
      }
    };
  }
  // Filter tabs
  $$('.filter-tab').forEach(t => {
    t.onclick = () => {
      state.filter = t.dataset.filter; state.page = 1; state.selectedIds.clear(); render();
    };
  });
  // Sort headers
  $$('.data-table th[data-sort]').forEach(th => {
    th.onclick = () => {
      const k = th.dataset.sort;
      if (state.sort.key === k) state.sort.dir = state.sort.dir === 'asc' ? 'desc' : 'asc';
      else { state.sort.key = k; state.sort.dir = 'asc'; }
      render();
    };
  });
  // Pagination
  $$('.pagination button[data-page]').forEach(b => {
    b.onclick = () => { state.page = parseInt(b.dataset.page); render(); };
  });
  // Page size
  const ps = $('#page-size');
  if (ps) ps.onchange = (e) => { state.pageSize = parseInt(e.target.value); state.page = 1; render(); };
  // Select all
  const selAll = $('#select-all');
  if (selAll) {
    selAll.onchange = (e) => {
      const filtered = sortedSebayats(filteredSebayats());
      const start = (state.page - 1) * state.pageSize;
      const pageIds = filtered.slice(start, start + state.pageSize).map(s => s.id);
      if (e.target.checked) pageIds.forEach(id => state.selectedIds.add(id));
      else pageIds.forEach(id => state.selectedIds.delete(id));
      render();
    };
  }
  // Activity filters (legacy profile_review_history based — kept for backward compat)
  const af = $('#act-from'), at = $('#act-to'), aa = $('#act-admin');
  if (af) af.onchange = () => { state.activityFilter.from = af.value; render(); };
  if (at) at.onchange = () => { state.activityFilter.to = at.value; render(); };
  if (aa) aa.onchange = () => { state.activityFilter.admin = aa.value; render(); };
  // Unified activity log filters
  const ulf = $('#ulog-from'), ult = $('#ulog-to'), ula = $('#ulog-admin');
  const ulat = $('#ulog-action'), ulrt = $('#ulog-resource'), uls = $('#ulog-search');
  const applyUlogFilters = () => {
    if (ulf) state.unifiedLogFilter.from = ulf.value;
    if (ult) state.unifiedLogFilter.to = ult.value;
    if (ula) state.unifiedLogFilter.admin = ula.value;
    if (ulat) state.unifiedLogFilter.actionType = ulat.value;
    if (ulrt) state.unifiedLogFilter.resourceType = ulrt.value;
    if (uls) state.unifiedLogFilter.search = uls.value;
    state.unifiedLogPage = 1;
    actions.loadUnifiedLog(1);
  };
  if (ulf) ulf.onchange = applyUlogFilters;
  if (ult) ult.onchange = applyUlogFilters;
  if (ula) ula.onchange = applyUlogFilters;
  if (ulat) ulat.onchange = applyUlogFilters;
  if (ulrt) ulrt.onchange = applyUlogFilters;
  if (uls) {
    let t; uls.oninput = () => { clearTimeout(t); t = setTimeout(applyUlogFilters, 400); };
  }
  // If activity view just loaded and log not yet loaded, auto-load
  if (state.view === 'activity' && !state.unifiedLogLoaded && !state.unifiedLogLoading) {
    actions.loadUnifiedLog(1);
  }
  // Row checkboxes
  $$('.row-cb').forEach(cb => {
    cb.onchange = (e) => {
      e.stopPropagation();
      const id = cb.dataset.id;
      if (cb.checked) state.selectedIds.add(id); else state.selectedIds.delete(id);
      render();
    };
  });
  // Add profile wizard handlers
  if (state.view === 'add_profile') attachAddProfileHandlers();
  // Seba categories handlers
  if (state.view === 'seba_categories') attachSebaCatHandlers();
  // Seba assign handlers
  if (state.view === 'seba_assign') attachSebaAssignHandlers();
}

// ============================================================
// ACTIONS
// ============================================================
const actions = {
  go(view) {
    if (view !== 'add_profile') { state.newProfile = {}; state.addProfileStep = 0; state.fatherSearchResults = []; state.fatherSearching = false; }
    state.view = view; state.selectedIds.clear(); render();
  },
  gotoApplications(filter) { state.view = 'applications'; state.filter = filter || 'all'; state.page = 1; state.selectedIds.clear(); render(); },
  refresh() { loadAll(); },
  clearSelection() { state.selectedIds.clear(); render(); },
  clearActivityFilters() { state.activityFilter = { from: '', to: '', admin: 'all' }; render(); },

  async openSebayat(id) {
    const s = state.sebayats.find(x => x.id === id);
    if (!s) return;
    state.currentSebayat = s;
    state.drawerTab = 'overview';
    await openDrawer(s);
  },

  async gotoMpEdit(id) {
    const s = state.sebayats.find(x => x.id === id);
    if (!s) return;
    state.currentSebayat = s;
    state.view = 'mp_edit_page';
    render();
    await mpOpenEdit(id);
  },

  async gotoMpView(id) {
    const s = state.sebayats.find(x => x.id === id);
    if (!s) return;
    state.currentSebayat = s;
    state.view = 'mp_view_page';
    render();
  },

  openAction(id, type) {
    const s = state.sebayats.find(x => x.id === id);
    if (!s) return;
    state.pendingAction = { sebayatIds: [id], type, sebayat: s };
    openActionModal();
  },

  openBulk(type) {
    if (state.selectedIds.size === 0) return;
    state.pendingAction = { sebayatIds: [...state.selectedIds], type, bulk: true };
    openActionModal();
  },

  exportCsv() {
    const rows = sortedSebayats(filteredSebayats());
    if (rows.length === 0) { showToast('Nothing to export', 'warning'); return; }
    const cols = ['full_name','phone','email','seba_name','bansa_name','palia_number','registration_no','profile_status','joining_year','submitted_at','reviewed_at'];
    const headers = ['Name','Phone','Email','Seba','Bansa','Palia','Reg. No.','Status','Joining Year','Submitted','Reviewed'];
    const csv = [headers.join(',')].concat(rows.map(r => cols.map(c => {
      let v = r[c] ?? '';
      if (c === 'full_name') v = getName(r);
      v = String(v).replace(/"/g, '""');
      return /[,"\n]/.test(v) ? `"${v}"` : v;
    }).join(','))).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `sebayats-${new Date().toISOString().slice(0,10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
    logActivity('export', 'sebayat_profiles', null, `${rows.length} rows exported`, null, null, { count: rows.length, filter: state.filter });
    showToast(`Exported ${rows.length} rows`, 'success');
  },

  openAddAdmin() {
    const roleOpts = state.roles.map(r => `<option value="${esc(r.id)}">${esc(r.role_name)}</option>`).join('');
    const defaultRoleId = state.roles.find(r => r.role_name === 'Admin')?.id || '';
    const html = `
      <div class="modal-header">
        <div class="modal-title">Add Admin User</div>
        <div class="modal-desc">Search for a sebayat, then set their login email, password, and role for the web dashboard.</div>
      </div>
      <div class="modal-body" style="display:flex;flex-direction:column;gap:16px">
        <div class="field">
          <label>Search sebayat</label>
          <input id="add-admin-search" type="text" placeholder="Phone or name…" autocomplete="off" />
        </div>
        <div id="add-admin-results" style="max-height:200px;overflow-y:auto;border:1px solid var(--border-light);border-radius:8px;display:none"></div>
        <div id="add-admin-form" style="display:none;flex-direction:column;gap:12px">
          <div id="add-admin-selected" style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--surface-2);border-radius:8px;border:1px solid var(--border-light)"></div>
          <div id="add-admin-fields"></div>
          <div id="add-admin-error" style="display:none;color:var(--error);font-size:13px;padding:8px 12px;background:#fff1f1;border-radius:6px;border:1px solid #fecaca"></div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
        <button id="add-admin-submit" class="btn btn-primary" style="display:none" onclick="actions._submitAddAdmin()">Add Admin</button>
      </div>
    `;
    showModal(html);
    const input = $('#add-admin-search');
    const resultsEl = $('#add-admin-results');
    const formEl = $('#add-admin-form');
    // Pre-select default role
    const roleEl = $('#add-admin-role');
    if (roleEl && defaultRoleId) roleEl.value = defaultRoleId;

    input.oninput = () => {
      const q = input.value.trim().toLowerCase();
      formEl.style.display = 'none';
      $('#add-admin-submit').style.display = 'none';
      if (q.length < 2) { resultsEl.style.display = 'none'; return; }
      const matches = state.sebayats.filter(s =>
        !state.admins.some(a => a.user_id === s.id) &&
        (getName(s).toLowerCase().includes(q) || (s.phone || '').includes(q) || (s.email || '').toLowerCase().includes(q))
      ).slice(0, 12);
      if (matches.length === 0) {
        resultsEl.innerHTML = '<div style="padding:12px;color:var(--ink3);text-align:center;font-size:13px">No matches</div>';
        resultsEl.style.display = 'block'; return;
      }
      resultsEl.innerHTML = matches.map(s => `
        <div class="activity-item" style="border-bottom:1px solid var(--border-light);cursor:pointer" onclick="actions._selectAddAdminSebayat('${esc(s.id)}')">
          <div class="row-avatar">${esc(getInitials(s))}</div>
          <div class="activity-content">
            <div class="activity-line1"><strong>${esc(getName(s))}</strong></div>
            <div class="activity-line2">${s.phone ? '+' + esc(s.phone) : ''}${s.email ? ' · ' + esc(s.email) : ''}</div>
          </div>
        </div>
      `).join('');
      resultsEl.style.display = 'block';
    };
    setTimeout(() => input.focus(), 50);
  },

  _selectAddAdminSebayat(sebayatId) {
    const s = state.sebayats.find(x => x.id === sebayatId);
    if (!s) return;
    state._addAdminSebayatId = sebayatId;
    $('#add-admin-results').style.display = 'none';
    const formEl = $('#add-admin-form');
    formEl.style.display = 'flex';
    $('#add-admin-submit').style.display = '';
    $('#add-admin-error').style.display = 'none';
    $('#add-admin-selected').innerHTML = `
      <div class="row-avatar" style="width:32px;height:32px;font-size:13px">${esc(getInitials(s))}</div>
      <div>
        <div style="font-weight:600;font-size:14px">${esc(getName(s))}</div>
        <div style="font-size:12px;color:var(--ink3)">${s.phone ? '+' + esc(s.phone) : ''}${s.email ? ' · ' + esc(s.email) : ''}</div>
      </div>
      <button type="button" onclick="actions._clearAddAdminSebayat()" style="margin-left:auto;background:none;border:none;cursor:pointer;color:var(--ink3);font-size:12px">Change</button>
    `;
    const hasEmail = !!s.email;
    const roleOpts = state.roles.map(r => `<option value="${esc(r.id)}">${esc(r.role_name)}</option>`).join('');
    const defaultRoleId = state.roles.find(r => r.role_name === 'Admin')?.id || '';
    $('#add-admin-fields').innerHTML = `
      <div class="field">
        <label>Login Email${!hasEmail ? ' <span style="color:var(--error)">*</span>' : ''}</label>
        ${hasEmail
          ? `<div style="display:flex;align-items:center;gap:8px;padding:10px 12px;background:var(--surface-2);border:1px solid var(--border-light);border-radius:8px;font-size:14px">
               <span style="flex:1;color:var(--ink1)">${esc(s.email)}</span>
               <span style="font-size:11px;color:var(--ink3);background:var(--border-light);padding:2px 7px;border-radius:20px">Existing account</span>
             </div>`
          : `<input id="add-admin-email" type="email" placeholder="admin@example.com" autocomplete="off" />`
        }
      </div>
      <div class="field">
        <label>Password <span style="color:var(--error)">*</span></label>
        <div style="position:relative">
          <input id="add-admin-password" type="password" placeholder="Min 8 characters" autocomplete="new-password" style="padding-right:40px" />
          <button type="button" onclick="(function(){var i=$('#add-admin-password');i.type=i.type==='password'?'text':'password'})()" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:var(--ink3);padding:0;font-size:12px">Show</button>
        </div>
      </div>
      <div class="field">
        <label>Role <span style="color:var(--error)">*</span></label>
        <select id="add-admin-role" onchange="actions._onAddAdminRoleChange(this.value)">${roleOpts}</select>
      </div>
      <div class="field" id="add-admin-customize-section">
        <div class="perm-customize-toggle" onclick="actions._toggleAddAdminCustomize()">
          <span id="add-admin-customize-chevron">&#9654;</span>
          <span>Customize Access (optional)</span>
        </div>
        <div id="add-admin-customize-panel" class="perm-customize-panel">
          <div style="font-size:12px;color:var(--ink3);margin-bottom:6px">
            Override specific permissions for this user. Cells show the role baseline — click to cycle: <strong>Role Default → Force Grant → Force Deny</strong>.
          </div>
          <div id="add-admin-perm-grid-container" class="perm-grid-wrap">
            <div style="padding:20px;text-align:center;color:var(--ink4);font-size:13px">Loading permissions…</div>
          </div>
        </div>
      </div>
    `;
    if (defaultRoleId) { const r = $('#add-admin-role'); if (r) r.value = defaultRoleId; }
    const firstInput = hasEmail ? $('#add-admin-role') : $('#add-admin-email');
    setTimeout(() => firstInput && firstInput.focus(), 50);
    // Load permission grid for default role
    const initialRoleId = defaultRoleId || (state.roles[0]?.id || '');
    if (initialRoleId) actions._onAddAdminRoleChange(initialRoleId);
  },

  async _onAddAdminRoleChange(roleId) {
    const container = $('#add-admin-perm-grid-container');
    if (!container) return;
    const rolePerms = await fetchRolePerms(roleId);
    container.innerHTML = renderPermissionGrid('add-admin', rolePerms, []);
  },

  _toggleAddAdminCustomize() {
    const panel = $('#add-admin-customize-panel');
    const chevron = $('#add-admin-customize-chevron');
    if (!panel) return;
    const open = panel.classList.toggle('open');
    if (chevron) chevron.innerHTML = open ? '&#9660;' : '&#9654;';
  },

  _clearAddAdminSebayat() {
    state._addAdminSebayatId = null;
    $('#add-admin-form').style.display = 'none';
    $('#add-admin-submit').style.display = 'none';
    $('#add-admin-search').value = '';
    $('#add-admin-search').focus();
  },

  async _submitAddAdmin() {
    if (!can('admins', 'create')) { showToast('Access denied: you cannot add admins', 'error'); return; }
    const sebayatId = state._addAdminSebayatId;
    const seb = state.sebayats.find(x => x.id === sebayatId);
    const hasExistingEmail = !!seb?.email;
    // Email comes from sebayat record (read-only) or from the input (new)
    const email = hasExistingEmail ? seb.email : ($('#add-admin-email')?.value || '').trim();
    const password = ($('#add-admin-password')?.value || '');
    const roleId = $('#add-admin-role')?.value;
    const errEl = $('#add-admin-error');
    errEl.style.display = 'none';
    if (!sebayatId || !email || !roleId) {
      errEl.textContent = 'Please fill in all required fields.';
      errEl.style.display = 'block'; return;
    }
    if (password.length < 8) {
      errEl.textContent = 'Password must be at least 8 characters.';
      errEl.style.display = 'block'; return;
    }
    const submitBtn = $('#add-admin-submit');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Adding…';
    setLoading(true);
    try {
      const session = (await db.auth.getSession()).data.session;
      const res = await fetch(`${SUPABASE_URL}/functions/v1/manage-admin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify({ action: 'create', email, password, role_id: roleId, sebayat_user_id: sebayatId, existing_account: hasExistingEmail, phone: seb?.phone,permission_overrides: collectGridOverrides('add-admin') }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        errEl.textContent = data.error || 'Failed to create admin.';
        errEl.style.display = 'block';
        submitBtn.disabled = false; submitBtn.textContent = 'Add Admin';
        setLoading(false); return;
      }
      const name = getName(state.sebayats.find(x => x.id === sebayatId));
      logActivity('admin_added', 'admins', data.user_id, name, null, { role_id: roleId });
      showToast(`${name} added as admin`, 'success');
      closeModal();
      await loadAll(); render();
    } catch (e) {
      errEl.textContent = 'Network error. Please try again.';
      errEl.style.display = 'block';
      submitBtn.disabled = false; submitBtn.textContent = 'Add Admin';
    }
    setLoading(false);
  },

  async confirmAddAdmin(userId, name, roleId) {
    // Legacy path kept for compatibility — now routes through _submitAddAdmin
    if (!can('admins', 'create')) { showToast('Access denied: you cannot add admins', 'error'); return; }
    const targetRole = roleId || state.roles.find(r => r.role_name === 'Admin')?.id;
    setLoading(true);
    const { error } = await db.from('pratihari_admins').insert({ user_id: userId, added_by: state.user.id, role_id: targetRole || null });
    setLoading(false);
    closeModal();
    if (error) { showToast('Failed to add admin: ' + error.message, 'error'); return; }
    logActivity('admin_added', 'admins', userId, name, null, { role_id: targetRole });
    showToast(`${name} is now an admin`, 'success');
    await loadAll(); render();
  },

  async removeAdmin(adminId) {
    if (!can('admins', 'delete')) { showToast('Access denied: you cannot remove admins', 'error'); return; }
    const adminRow = state.admins.find(a => a.id === adminId);
    if (adminRow?.user_id === state.user?.id) { showToast('You cannot remove yourself', 'error'); return; }
    showConfirm({
      title: 'Remove Admin Access',
      message: 'This user will lose all admin privileges immediately.',
      confirmLabel: 'Remove',
      danger: true,
      onConfirm: async () => {
        setLoading(true);
        const { error } = await db.from('pratihari_admins').delete().eq('id', adminId);
        setLoading(false);
        if (error) { showToast('Failed to remove admin: ' + error.message, 'error'); return; }
        logActivity('admin_removed', 'admins', adminRow?.user_id, adminRow?.user_id || adminId);
        showToast('Admin removed', 'success');
        await loadAll();
        render();
      },
    });
  },

  async changeAdminRole(adminId, newRoleId) {
    if (!can('admins', 'edit')) { showToast('Access denied', 'error'); return; }
    const adminRow = state.admins.find(a => a.id === adminId);
    if (!adminRow) return;
    if (adminRow.user_id === state.user?.id) { showToast('You cannot change your own role', 'error'); return; }
    const oldRole = state.roles.find(r => r.id === adminRow.role_id)?.role_name || '—';
    const newRole = state.roles.find(r => r.id === newRoleId)?.role_name || '—';
    showConfirm({
      title: 'Change Role',
      message: `Change role from "${oldRole}" to "${newRole}"?`,
      confirmLabel: 'Change Role',
      danger: false,
      onConfirm: async () => {
        const isSuper = state.roles.find(r => r.id === newRoleId)?.role_name === 'Super Admin';
        setLoading(true);
        const { error } = await db.from('pratihari_admins')
          .update({ role_id: newRoleId, is_super_admin: isSuper })
          .eq('id', adminId);
        setLoading(false);
        if (error) { showToast('Failed: ' + error.message, 'error'); return; }
        logActivity('role_assigned', 'admins', adminRow.user_id, adminRow.user_id,
          { role: oldRole }, { role: newRole });
        showToast(`Role updated to ${newRole}`, 'success');
        await loadAll();
        render();
      },
    });
  },

  async toggleAdminDisabled(adminId, currentlyDisabled) {
    if (!state.isSuperAdmin) { showToast('Super admin privileges required', 'error'); return; }
    const action = currentlyDisabled ? 'enable' : 'disable';
    showConfirm({
      title: `${currentlyDisabled ? 'Enable' : 'Disable'} Admin Account`,
      message: currentlyDisabled
        ? 'This admin will regain access to the dashboard.'
        : 'This admin will be locked out until re-enabled.',
      confirmLabel: currentlyDisabled ? 'Enable' : 'Disable',
      danger: !currentlyDisabled,
      onConfirm: async () => {
        setLoading(true);
        try {
          const session = (await db.auth.getSession()).data.session;
          const res = await fetch(`${SUPABASE_URL}/functions/v1/manage-admin`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
            body: JSON.stringify({ action: 'set_disabled', admin_id: adminId, disabled: !currentlyDisabled }),
          });
          const data = await res.json();
          if (!res.ok || data.error) { showToast(data.error || 'Failed', 'error'); setLoading(false); return; }
          showToast(`Admin ${currentlyDisabled ? 'enabled' : 'disabled'}`, 'success');
          await loadAll(); render();
        } catch (e) { showToast('Network error', 'error'); }
        setLoading(false);
      },
    });
  },

  openResetPassword(adminId, email) {
    if (!state.isSuperAdmin) { showToast('Super admin privileges required', 'error'); return; }
    const html = `
      <div class="modal-header">
        <div class="modal-title">Reset Password</div>
        <div class="modal-desc">Set a new password for <strong>${esc(email)}</strong>.</div>
      </div>
      <div class="modal-body" style="display:flex;flex-direction:column;gap:12px">
        <div class="field">
          <label>New Password <span style="color:var(--error)">*</span></label>
          <div style="position:relative">
            <input id="reset-pw-input" type="password" placeholder="Min 8 characters" autocomplete="new-password" style="padding-right:40px" />
            <button type="button" onclick="(function(){var i=$('#reset-pw-input');i.type=i.type==='password'?'text':'password'})()" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:var(--ink3);padding:0;font-size:12px">Show</button>
          </div>
        </div>
        <div class="field">
          <label>Confirm Password <span style="color:var(--error)">*</span></label>
          <input id="reset-pw-confirm" type="password" placeholder="Repeat password" autocomplete="new-password" />
        </div>
        <div id="reset-pw-error" style="display:none;color:var(--error);font-size:13px;padding:8px 12px;background:#fff1f1;border-radius:6px;border:1px solid #fecaca"></div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="actions._submitResetPassword('${esc(adminId)}')">Reset Password</button>
      </div>
    `;
    showModal(html);
    setTimeout(() => $('#reset-pw-input').focus(), 50);
  },

  async _submitResetPassword(adminId) {
    const pw = $('#reset-pw-input').value;
    const pw2 = $('#reset-pw-confirm').value;
    const errEl = $('#reset-pw-error');
    errEl.style.display = 'none';
    if (!pw || pw.length < 8) { errEl.textContent = 'Password must be at least 8 characters.'; errEl.style.display = 'block'; return; }
    if (pw !== pw2) { errEl.textContent = 'Passwords do not match.'; errEl.style.display = 'block'; return; }
    setLoading(true);
    try {
      const session = (await db.auth.getSession()).data.session;
      const res = await fetch(`${SUPABASE_URL}/functions/v1/manage-admin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify({ action: 'reset_password', admin_id: adminId, new_password: pw }),
      });
      const data = await res.json();
      if (!res.ok || data.error) { errEl.textContent = data.error || 'Failed to reset password.'; errEl.style.display = 'block'; setLoading(false); return; }
      showToast('Password reset successfully', 'success');
      closeModal();
    } catch (e) { errEl.textContent = 'Network error. Please try again.'; errEl.style.display = 'block'; }
    setLoading(false);
  },

  async openAdminPermissions(adminId) {
    if (!state.isSuperAdmin) { showToast('Super admin privileges required', 'error'); return; }
    const admin = state.admins.find(a => a.id === adminId);
    if (!admin) return;
    const seb = state.sebayats.find(x => x.id === admin.user_id);
    const name = seb ? getName(seb) : (admin.email || 'Admin');
    const role = state.roles.find(r => r.id === admin.role_id);
    const roleName = role?.role_name || 'No role';

    const html = `
      <div class="modal-header">
        <div class="modal-title">User Permissions</div>
        <div class="modal-desc">
          Customize access for <strong>${esc(name)}</strong> &mdash; current role: <strong>${esc(roleName)}</strong>.
          Overrides apply on top of the role. Click a cell to cycle: Role Default &rarr; Force Grant &rarr; Force Deny.
        </div>
      </div>
      <div class="modal-body" style="padding:0">
        <div id="user-perm-grid-wrap" style="padding:0 4px 4px">
          <div style="padding:32px;text-align:center;color:var(--ink4)">Loading…</div>
        </div>
        <div id="user-perm-error" style="display:none;color:var(--error);font-size:13px;padding:8px 16px;background:#fff1f1;border:1px solid #fecaca;margin:0 16px 12px;border-radius:6px"></div>
      </div>
      <div class="modal-footer" style="justify-content:space-between">
        <button class="btn btn-ghost btn-sm" id="user-perm-reset-all" onclick="actions._resetAllPermOverrides('${esc(adminId)}')">Reset All to Role Default</button>
        <div style="display:flex;gap:8px">
          <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
          <button class="btn btn-primary" id="user-perm-save" onclick="actions._saveAdminPermissions('${esc(adminId)}')">Save Changes</button>
        </div>
      </div>
    `;
    showModal(html);
    $('#modal').classList.add('modal--perm-wide');

    // Load role perms and existing overrides in parallel
    const [rolePerms, overridesRes] = await Promise.all([
      fetchRolePerms(admin.role_id),
      db.from('admin_user_permissions').select('resource,action,granted').eq('admin_id', adminId),
    ]);
    const existingOverrides = overridesRes.data || [];
    const container = $('#user-perm-grid-wrap');
    if (container) {
      container.innerHTML = renderPermissionGrid('user-perm', rolePerms, existingOverrides);
    }
  },

  async _saveAdminPermissions(adminId) {
    const errEl = $('#user-perm-error');
    if (errEl) errEl.style.display = 'none';
    const saveBtn = $('#user-perm-save');
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Saving…'; }
    setLoading(true);

    try {
      const overrides = collectGridOverrides('user-perm');
      // Delete all existing overrides for this admin, then insert the new set
      await db.from('admin_user_permissions').delete().eq('admin_id', adminId);
      if (overrides.length > 0) {
        const rows = overrides.map(o => ({ admin_id: adminId, resource: o.resource, action: o.action, granted: o.granted }));
        const { error: insErr } = await db.from('admin_user_permissions').insert(rows);
        if (insErr) throw new Error(insErr.message);
      }
      // Update the override count in local state
      if (!state.adminOverrideCounts) state.adminOverrideCounts = {};
      state.adminOverrideCounts[adminId] = overrides.length;
      showToast('Permissions saved', 'success');
      closeModal();
      // If editing current user, reload their permissions live
      const admin = state.admins.find(a => a.id === adminId);
      if (admin && admin.user_id === state.user?.id) {
        await loadRoleAndPermissions(state.user.id);
      }
      renderCurrentPage();
    } catch (e) {
      if (errEl) { errEl.textContent = e.message || 'Failed to save permissions.'; errEl.style.display = 'block'; }
      if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Save Changes'; }
    }
    setLoading(false);
  },

  async _resetAllPermOverrides(adminId) {
    const resetBtn = $('#user-perm-reset-all');
    if (resetBtn) { resetBtn.disabled = true; resetBtn.textContent = 'Resetting…'; }
    setLoading(true);
    try {
      await db.from('admin_user_permissions').delete().eq('admin_id', adminId);
      if (!state.adminOverrideCounts) state.adminOverrideCounts = {};
      state.adminOverrideCounts[adminId] = 0;
      showToast('All overrides cleared — using role defaults', 'success');
      closeModal();
      const admin = state.admins.find(a => a.id === adminId);
      if (admin && admin.user_id === state.user?.id) {
        await loadRoleAndPermissions(state.user.id);
      }
      renderCurrentPage();
    } catch (e) {
      showToast('Failed to reset overrides', 'error');
    }
    setLoading(false);
  },

  async toggleOtpChannel(channel, currentlyEnabled) {
    if (!state.isSuperAdmin) { showToast('Super admin access required', 'error'); return; }
    const newValue = !currentlyEnabled;
    const key = channel === 'whatsapp' ? 'otp_whatsapp_enabled' : 'otp_sms_enabled';
    const otherKey = channel === 'whatsapp' ? 'otp_sms_enabled' : 'otp_whatsapp_enabled';
    // Prevent disabling both channels
    if (!newValue && !state.otpSettings[otherKey]) {
      showToast('Cannot disable both channels — at least one must remain active', 'error');
      return;
    }
    setLoading(true);
    const { error } = await db.from('app_settings')
      .update({ value: newValue, updated_at: new Date().toISOString(), updated_by: state.user?.id })
      .eq('key', key);
    setLoading(false);
    if (error) { showToast('Failed to update setting: ' + error.message, 'error'); return; }
    state.otpSettings[key] = newValue;
    const label = channel === 'whatsapp' ? 'WhatsApp' : 'SMS';
    logActivity('update', 'settings', null, `OTP ${label} ${newValue ? 'enabled' : 'disabled'}`);
    showToast(`${label} OTP ${newValue ? 'enabled' : 'disabled'}`, newValue ? 'success' : 'warning');
    const c = $('#view-container');
    if (c && state.view === 'settings') { c.innerHTML = renderSettingsView(); attachSettingsHandlers(); }
  },
};
window.actions = actions;

// Activity log actions — must be after actions is declared
Object.assign(actions, {
  clearUnifiedLogFilters() {
    state.unifiedLogFilter = { from: '', to: '', admin: 'all', actionType: 'all', resourceType: 'all', search: '' };
    state.unifiedLogPage = 1;
    render();
  },

  async loadUnifiedLog(page = 1) {
    state.unifiedLogLoading = true;
    state.unifiedLogPage = page;
    render();
    const f = state.unifiedLogFilter;
    const PAGE_SIZE = 50;
    const offset = (page - 1) * PAGE_SIZE;
    let q = db.from('admin_activity_log')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);
    if (f.from) q = q.gte('created_at', f.from + 'T00:00:00Z');
    if (f.to)   q = q.lte('created_at', f.to + 'T23:59:59Z');
    if (f.admin !== 'all') q = q.eq('actor_id', f.admin);
    if (f.actionType !== 'all') q = q.eq('action_type', f.actionType);
    if (f.resourceType !== 'all') q = q.eq('resource_type', f.resourceType);
    if (f.search.trim()) q = q.ilike('resource_label', `%${f.search.trim()}%`);
    const { data, count, error } = await q;
    state.unifiedLogLoading = false;
    state.unifiedLogLoaded = true;
    if (error) { showToast('Failed to load log: ' + error.message, 'error'); state.unifiedLog = []; state.unifiedLogTotal = 0; }
    else { state.unifiedLog = data || []; state.unifiedLogTotal = count || 0; }
    render();
  },

  toggleLogDetail(id) {
    const el = document.getElementById(id);
    if (el) el.style.display = el.style.display === 'none' ? '' : 'none';
  },

  exportActivityLog() {
    if (state.unifiedLog.length === 0) { showToast('Nothing to export', 'warning'); return; }
    const cols = ['created_at','actor_email','role_snapshot','action_type','resource_type','resource_label','ip_address'];
    const headers = ['When','Admin Email','Role','Action','Resource','Label','IP'];
    const csv = [headers.join(',')].concat(state.unifiedLog.map(r => cols.map(c => {
      let v = r[c] ?? '';
      v = String(v).replace(/"/g, '""');
      return /[,"\n]/.test(v) ? `"${v}"` : v;
    }).join(','))).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `activity-log-${new Date().toISOString().slice(0,10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
    logActivity('export', 'activity_log', null, `${state.unifiedLog.length} log entries`, null, null, { count: state.unifiedLog.length });
    showToast(`Exported ${state.unifiedLog.length} entries`, 'success');
  },
});

// Role actions — must be after actions is declared
Object.assign(actions, {
  async openRoleEdit(roleId) {
    const role = state.roles.find(r => r.id === roleId);
    if (!role) return;
    const { data: perms } = await db.from('role_permissions').select('resource,action').eq('role_id', roleId);
    const permSet = new Set((perms || []).map(p => `${p.resource}:${p.action}`));
    state.rolePermissions[roleId] = permSet;
    state.roleEditTarget = role;
    render();
  },

  closeRoleEdit() {
    state.roleEditTarget = null;
    render();
  },

  async saveRolePermissions() {
    const role = state.roleEditTarget;
    if (!role || role.is_system_role) return;
    const checked = new Set();
    document.querySelectorAll('.perm-cb:checked').forEach(cb => {
      checked.add(`${cb.dataset.resource}:${cb.dataset.action}`);
    });
    setLoading(true);
    const { error: delErr } = await db.from('role_permissions').delete().eq('role_id', role.id);
    if (delErr) { setLoading(false); showToast('Failed: ' + delErr.message, 'error'); return; }
    const rows = [...checked].map(key => {
      const [resource, action] = key.split(':');
      return { role_id: role.id, resource, action };
    });
    if (rows.length > 0) {
      const { error: insErr } = await db.from('role_permissions').insert(rows);
      if (insErr) { setLoading(false); showToast('Failed: ' + insErr.message, 'error'); return; }
    }
    setLoading(false);
    state.rolePermissions[role.id] = checked;
    logActivity('update', 'roles', role.id, role.role_name, null, { permissions_count: rows.length });
    showToast('Permissions saved', 'success');
    state.roleEditTarget = null;
    render();
  },

  openCreateRole() {
    showModal(`
      <div class="modal-header">
        <div class="modal-title">Create Custom Role</div>
        <div class="modal-desc">Define a new role and assign permissions after creation.</div>
      </div>
      <div class="modal-body">
        <div class="field">
          <label>Role Name <span style="color:var(--red)">*</span></label>
          <input id="new-role-name" type="text" placeholder="e.g. Report Viewer, Seba Manager…" />
        </div>
        <div class="field">
          <label>Description</label>
          <input id="new-role-desc" type="text" placeholder="Brief description of this role's purpose" />
        </div>
        <div class="field">
          <label>Badge Color</label>
          <div style="display:flex;gap:8px;flex-wrap:wrap" id="role-color-picker">
            ${['#B45309','#1D4ED8','#065F46','#6B7280','#9D174D','#1E40AF','#7C3AED','#B91C1C','#0F766E','#4338CA'].map(c =>
              `<button type="button" class="role-color-opt" data-color="${c}"
                style="width:24px;height:24px;border-radius:50%;background:${c};border:2px solid transparent;cursor:pointer;transition:border-color 0.15s"
                onclick="document.querySelectorAll('.role-color-opt').forEach(b=>b.style.borderColor='transparent');this.style.borderColor='#333';document.getElementById('new-role-color').value='${c}'"></button>`
            ).join('')}
          </div>
          <input type="hidden" id="new-role-color" value="#6B7280" />
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="actions.saveNewRole()">Create Role</button>
      </div>
    `);
  },

  async saveNewRole() {
    const name = document.getElementById('new-role-name')?.value?.trim();
    const desc = document.getElementById('new-role-desc')?.value?.trim() || '';
    const color = document.getElementById('new-role-color')?.value || '#6B7280';
    if (!name) { showToast('Role name is required', 'error'); return; }
    if (state.roles.some(r => r.role_name.toLowerCase() === name.toLowerCase())) {
      showToast('A role with that name already exists', 'error'); return;
    }
    setLoading(true);
    const { data, error } = await db.from('admin_roles').insert({
      role_name: name, description: desc, color, is_system_role: false, created_by: state.user?.id,
    }).select().maybeSingle();
    setLoading(false);
    if (error) { showToast('Failed: ' + error.message, 'error'); return; }
    logActivity('create', 'roles', data.id, name);
    closeModal();
    showToast(`Role "${name}" created`, 'success');
    await loadAll();
    state.view = 'roles';
    actions.openRoleEdit(data.id);
  },

  async deleteRole(roleId) {
    const role = state.roles.find(r => r.id === roleId);
    if (!role) return;
    const memberCount = state.admins.filter(a => a.role_id === roleId).length;
    if (memberCount > 0) { showToast(`Cannot delete — ${memberCount} admin(s) still have this role`, 'error'); return; }
    showConfirm({
      title: 'Delete Role',
      message: `Delete "${role.role_name}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      danger: true,
      onConfirm: async () => {
        setLoading(true);
        const { error } = await db.from('admin_roles').delete().eq('id', roleId);
        setLoading(false);
        if (error) { showToast('Failed: ' + error.message, 'error'); return; }
        logActivity('delete', 'roles', roleId, role.role_name);
        showToast(`Role "${role.role_name}" deleted`, 'success');
        await loadAll();
        render();
      },
    });
  },
});

// ============================================================
// DRAWER
// ============================================================
async function openDrawer(s) {
  state.drawerTab = 'overview';
  $('#drawer-title').textContent = getName(s);
  $('#drawer-sub').textContent = (s.phone ? '+' + s.phone : '') + (s.registration_no ? ' · Reg ' + s.registration_no : '');
  const av = $('#drawer-avatar');
  if (s.photo_url) { av.style.backgroundImage = `url('${s.photo_url}')`; av.textContent = ''; }
  else { av.style.backgroundImage = ''; av.textContent = getInitials(s); }
  $$('.drawer-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === 'overview'));
  $('#drawer-overlay').classList.add('open');
  await renderDrawer();
}

function closeDrawer() {
  $('#drawer-overlay').classList.remove('open');
  state.currentSebayat = null;
}

async function renderDrawer() {
  const s = state.currentSebayat;
  if (!s) return;
  const body = $('#drawer-body');
  const footer = $('#drawer-footer');

  if (state.drawerTab === 'overview') body.innerHTML = await drawerOverview(s);
  else if (state.drawerTab === 'address') body.innerHTML = drawerAddress(s);
  else if (state.drawerTab === 'documents') body.innerHTML = await drawerDocuments(s);
  else if (state.drawerTab === 'history') body.innerHTML = drawerHistory(s);

  const status = s.profile_status || 'draft';
  const canAct = ['submitted','resubmitted'].includes(status);
  footer.innerHTML = canAct ? `
    <button class="btn btn-success" style="flex:1" onclick="actions.openAction('${esc(s.id)}','approve')">Approve</button>
    <button class="btn btn-warning" style="flex:1" onclick="actions.openAction('${esc(s.id)}','changes')">Request Changes</button>
    <button class="btn btn-danger" style="flex:1" onclick="actions.openAction('${esc(s.id)}','reject')">Reject</button>
  ` : `<button class="btn btn-ghost" style="flex:1" onclick="closeDrawer()">Close</button>`;

  // Photo lightbox
  $$('.photo-tile[data-src]').forEach(el => {
    el.onclick = () => openLightbox(el.dataset.src);
  });
}

async function drawerOverview(s) {
  const currentYear = new Date().getFullYear();
  // Fetch seba selections and nijog assignments in parallel
  const [{ data: sebaSelRows }, { data: nijogRows }] = await Promise.all([
    db.from('sebayat_seba_selections').select('seba_category_id, beddha_number').eq('sebayat_id', s.id),
    db.from('nijog_assignments')
      .select('beddha_number, year, seba_categories!inner(name, seba_groups!inner(name))')
      .eq('sebayat_id', s.id)
      .eq('year', currentYear)
      .order('beddha_number', { ascending: true }),
  ]);
  // Build grouped display for seba selections: catId -> [beddha_numbers]
  const sebaSelMap = {};
  for (const row of (sebaSelRows || [])) {
    if (!sebaSelMap[row.seba_category_id]) sebaSelMap[row.seba_category_id] = [];
    sebaSelMap[row.seba_category_id].push(row.beddha_number);
  }
  const hasSebaSel = Object.keys(sebaSelMap).length > 0;
  // Nijog assignments for current year
  const nijogAssignments = (nijogRows || []).map(r => ({
    seba_name: r.seba_categories.name,
    group_name: r.seba_categories.seba_groups.name,
    beddha_number: r.beddha_number,
  }));
  const hasNijog = nijogAssignments.length > 0;
  const status = s.profile_status || 'draft';
  const steps = [
    { key: 'draft', label: 'Draft' },
    { key: 'submitted', label: 'Submitted' },
    { key: status === 'rejected' ? 'rejected' : status === 'changes_requested' ? 'changes_requested' : 'approved', label: status === 'rejected' ? 'Rejected' : status === 'changes_requested' ? 'Changes Req.' : 'Approved' },
  ];
  const orderIdx = ['draft','submitted','resubmitted','changes_requested','approved','rejected'].indexOf(status);
  const isError = status === 'rejected' || status === 'changes_requested';
  return `
    <div class="status-timeline">
      ${steps.map((step, i) => {
        let cls = '';
        if (status === step.key) cls = 'active';
        else if (i < steps.findIndex(x => x.key === status)) cls = 'done';
        if (i === 3 && isError) cls = 'error';
        const num = i + 1;
        const dotInner = cls === 'done' ? '✓' : cls === 'error' ? '!' : num;
        return `<div class="status-step ${cls}"><div class="dot">${dotInner}</div><div>${esc(step.label)}</div></div>`;
      }).join('')}
    </div>

    <div class="detail-section">
      <div class="detail-section-header">
        <span class="detail-section-title">Status</span>
        <div class="detail-section-line"></div>
      </div>
      <div class="detail-card">
        ${detailRow('Current Status', `<span class="status-badge status-${esc(status)}">${esc(STATUS_LABELS[status] || status)}</span>`, true)}
        ${detailRow('Submitted', s.submitted_at ? fmtDate(s.submitted_at, true) : '—')}
        ${s.reviewed_at ? detailRow(
          status === 'approved' ? 'Approved On' : status === 'rejected' ? 'Rejected On' : status === 'changes_requested' ? 'Changes Requested On' : 'Reviewed',
          fmtDate(s.reviewed_at, true)
        ) : ''}
        ${s.registration_no ? detailRow('Registration No.', `<strong>${esc(s.registration_no)}</strong>`, true) : ''}
        ${s.admin_remarks ? detailRow('Latest Remarks', `<div style="white-space:pre-wrap;line-height:1.6">${esc(s.admin_remarks)}</div>`, true) : ''}
      </div>
    </div>

    <div class="detail-section">
      <div class="detail-section-header"><span class="detail-section-title">Personal Details</span><div class="detail-section-line"></div></div>
      <div class="detail-card">
        ${detailRow('Full Name', getName(s))}
        ${s.alias_name ? detailRow('Alias', s.alias_name) : ''}
        ${detailRow('Date of Birth', s.date_of_birth ? fmtDate(s.date_of_birth) : '')}
        ${detailRow('Gender', s.gender)}
        ${detailRow('Blood Group', s.blood_group)}
        ${detailRow('Marital Status', s.marital_status)}
        ${s.spouse_name ? detailRow('Spouse', s.spouse_name) : ''}
      </div>
    </div>

    <div class="detail-section">
      <div class="detail-section-header"><span class="detail-section-title">Contact</span><div class="detail-section-line"></div></div>
      <div class="detail-card">
        ${detailRow('Phone', s.phone ? `<a href="tel:+${esc(s.phone)}">+${esc(s.phone)}</a>` : '', true)}
        ${detailRow('WhatsApp', s.whatsapp_number ? `<a href="https://wa.me/${esc(s.whatsapp_number)}" target="_blank">+${esc(s.whatsapp_number)}</a>` : '', true)}
        ${detailRow('Email', s.email ? `<a href="mailto:${esc(s.email)}">${esc(s.email)}</a>` : '', true)}
      </div>
    </div>

    <div class="detail-section">
      <div class="detail-section-header"><span class="detail-section-title">Family</span><div class="detail-section-line"></div></div>
      <div class="detail-card">
        ${detailRow('Father', s.father_name)}
        ${detailRow('Mother', s.mother_name)}
        ${s.father_sebayat_id ? detailRow('Father Sebayat ID', `<span style="font-family:monospace;font-size:11px">${esc(s.father_sebayat_id.slice(0,8))}…</span>`, true) : ''}
      </div>
    </div>

    <div class="detail-section">
      <div class="detail-section-header"><span class="detail-section-title">Seba Details</span><div class="detail-section-line"></div></div>
      <div class="detail-card">
        ${detailRow('Bansa', s.bansa_name)}
        ${detailRow('Palia Number', s.palia_number)}
        ${detailRow('Seba Name', s.seba_name)}
        ${detailRow('Joining', s.joining_date_exact ? fmtDate(s.joining_date) : (s.joining_year || s.joining_date))}
        ${detailRow('Bhagari', s.is_bhagari ? 'Yes' : (s.is_bhagari === false ? 'No' : ''))}
        ${detailRow('Baristha Bhai Pua', s.is_baristha_bhai_pua ? 'Yes' : (s.is_baristha_bhai_pua === false ? 'No' : ''))}
      </div>
    </div>

    ${hasNijog ? `
    <div class="detail-section">
      <div class="detail-section-header">
        <span class="detail-section-title" style="color:var(--saffron,#E8732A)">Nijog Assignments ${currentYear}</span>
        <div class="detail-section-line"></div>
      </div>
      <div class="detail-card" style="padding:0">
        ${nijogAssignments.map((a, i) => `
          <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;${i < nijogAssignments.length - 1 ? 'border-bottom:1px solid var(--line)' : ''}">
            <div>
              <div style="font-size:13px;font-weight:600;color:var(--ink1)">${esc(a.seba_name)}</div>
              <div style="font-size:11px;color:var(--ink4);margin-top:2px">${esc(a.group_name)}</div>
            </div>
            <span style="padding:3px 10px;border-radius:20px;font-size:12px;font-weight:700;background:rgba(232,115,42,0.12);color:var(--saffron,#E8732A);border:1px solid rgba(232,115,42,0.25)">Beddha ${esc(String(a.beddha_number))}</span>
          </div>
        `).join('')}
      </div>
    </div>` : ''}

    ${hasSebaSel ? `
    <div class="detail-section">
      <div class="detail-section-header"><span class="detail-section-title">Seba Claims</span><div class="detail-section-line"></div></div>
      <div class="detail-card">
        ${(state.sebaCategories || [])
          .filter(cat => sebaSelMap[cat.id] && sebaSelMap[cat.id].length > 0)
          .map(cat => {
            const nums = sebaSelMap[cat.id].slice().sort((a, b) => a - b);
            const beddhaTypes = state.sebaBeddhas[cat.id] || {};
            const pillsHtml = nums.map(n => {
              const bType = beddhaTypes[n];
              const typeClass = bType === 'hereditary' ? 'drawer-beddha--hereditary' : bType === 'nijog_assigned' ? 'drawer-beddha--nijog' : '';
              return `<span class="drawer-beddha ${typeClass}">${n}</span>`;
            }).join('');
            return `<div class="drawer-seba-claim-row">
              <div class="drawer-seba-claim-name">${esc(cat.name)}</div>
              <div class="drawer-seba-claim-pills">${pillsHtml}</div>
            </div>`;
          }).join('')}
      </div>
    </div>` : ''}

    <div class="detail-section">
      <div class="detail-section-header"><span class="detail-section-title">Health</span><div class="detail-section-line"></div></div>
      <div class="detail-card">
        ${detailRow('Health Card No.', s.health_card_no)}
      </div>
      ${s.health_card_photo_url ? `<div class="photo-grid" style="margin-top:10px"><div class="photo-tile" data-src="${esc(s.health_card_photo_url)}" style="background-image:url('${esc(s.health_card_photo_url)}')"><div class="photo-tile-label">Health Card</div></div></div>` : ''}
    </div>

    ${(s.social_facebook || s.social_twitter || s.social_instagram || s.social_linkedin || s.social_youtube) ? `
    <div class="detail-section">
      <div class="detail-section-header"><span class="detail-section-title">Social</span><div class="detail-section-line"></div></div>
      <div class="detail-card">
        ${s.social_facebook ? detailRow('Facebook', `<a href="${esc(s.social_facebook)}" target="_blank">${esc(s.social_facebook)}</a>`, true) : ''}
        ${s.social_twitter ? detailRow('Twitter', `<a href="${esc(s.social_twitter)}" target="_blank">${esc(s.social_twitter)}</a>`, true) : ''}
        ${s.social_instagram ? detailRow('Instagram', `<a href="${esc(s.social_instagram)}" target="_blank">${esc(s.social_instagram)}</a>`, true) : ''}
        ${s.social_linkedin ? detailRow('LinkedIn', `<a href="${esc(s.social_linkedin)}" target="_blank">${esc(s.social_linkedin)}</a>`, true) : ''}
        ${s.social_youtube ? detailRow('YouTube', `<a href="${esc(s.social_youtube)}" target="_blank">${esc(s.social_youtube)}</a>`, true) : ''}
      </div>
    </div>` : ''}

    ${(s.photo_url || s.spouse_photo_url || s.spouse_father_photo_url || s.spouse_mother_photo_url) ? `
    <div class="detail-section">
      <div class="detail-section-header"><span class="detail-section-title">Photos</span><div class="detail-section-line"></div></div>
      <div class="photo-grid">
        ${photoTile(s.photo_url, 'Profile')}
        ${photoTile(s.spouse_photo_url, 'Spouse')}
        ${photoTile(s.spouse_father_photo_url, 'Spouse Father')}
        ${photoTile(s.spouse_mother_photo_url, 'Spouse Mother')}
      </div>
    </div>` : ''}
  `;
}

function drawerAddress(s) {
  return `
    <div class="detail-section">
      <div class="detail-section-header"><span class="detail-section-title">Permanent Address</span><div class="detail-section-line"></div></div>
      <div class="detail-card">
        ${detailRow('Sahi', s.permanent_sahi)}
        ${detailRow('Landmark', s.permanent_landmark)}
        ${detailRow('Post Office', s.permanent_post_office)}
        ${detailRow('Police Station', s.permanent_police_station)}
        ${detailRow('District', s.permanent_district)}
        ${detailRow('State', s.permanent_state)}
        ${detailRow('Pincode', s.permanent_pincode)}
        ${detailRow('Country', s.permanent_country)}
      </div>
    </div>
    ${s.is_permanent_different ? `
    <div class="detail-section">
      <div class="detail-section-header"><span class="detail-section-title">Current Address</span><div class="detail-section-line"></div></div>
      <div class="detail-card">
        ${detailRow('Sahi', s.current_sahi)}
        ${detailRow('Landmark', s.current_landmark)}
        ${detailRow('Post Office', s.current_post_office)}
        ${detailRow('Police Station', s.current_police_station)}
        ${detailRow('District', s.current_district)}
        ${detailRow('State', s.current_state)}
        ${detailRow('Pincode', s.current_pincode)}
        ${detailRow('Country', s.current_country)}
      </div>
    </div>` : `<div style="padding:14px;background:var(--surface-2);border-radius:8px;color:var(--ink3);font-size:13px">Current address is the same as the permanent address.</div>`}
  `;
}

async function drawerDocuments(s) {
  const { data, error } = await db.from('identity_documents').select('*').eq('sebayat_id', s.id).order('created_at');
  const docs = data || [];
  if (docs.length === 0) return emptyState('No documents uploaded', 'This sebayat has not yet uploaded identity documents.', iconFile());
  return `
    <div class="detail-section">
      <div class="detail-section-header"><span class="detail-section-title">Identity Documents (${docs.length})</span><div class="detail-section-line"></div></div>
      <div style="display:flex;flex-direction:column;gap:14px">
        ${docs.map(d => {
          const hasPhoto = d.photo_url && d.photo_url.trim();
          return `
          <div style="border:1px solid #E8D5C4;border-radius:12px;overflow:hidden;background:#fff">
            <div style="display:flex;align-items:center;gap:10px;padding:12px 14px;background:#FFF8F3;border-bottom:${hasPhoto ? '1px solid #E8D5C4' : 'none'}">
              <div style="width:32px;height:32px;border-radius:8px;background:#E8732A;display:flex;align-items:center;justify-content:center;flex-shrink:0">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><rect x="3" y="4" width="18" height="16" rx="2"/><line x1="7" y1="9" x2="17" y2="9"/><line x1="7" y1="13" x2="13" y2="13"/></svg>
              </div>
              <div style="flex:1;min-width:0">
                <div style="font-size:13px;font-weight:700;color:#2D1810">${esc(d.id_type || 'Identity Document')}</div>
                ${d.id_number ? `<div style="font-size:12px;color:#6B4C3B;margin-top:1px;font-family:monospace;letter-spacing:0.5px">${esc(d.id_number)}</div>` : ''}
              </div>
              ${hasPhoto ? `<button class="btn btn-ghost btn-sm" onclick="openLightbox('${esc(d.photo_url)}')" style="font-size:11px;padding:4px 10px;flex-shrink:0">View</button>` : ''}
            </div>
            ${hasPhoto ? `
            <div style="padding:10px 14px">
              <div class="photo-tile" data-src="${esc(d.photo_url)}" style="background-image:url('${esc(d.photo_url)}');height:140px;border-radius:8px;width:100%;background-size:contain;background-repeat:no-repeat;background-position:center;background-color:#F7EFE8;cursor:zoom-in">
                <div class="photo-tile-label">${esc(d.id_type || 'Document')}</div>
              </div>
            </div>` : `
            <div style="padding:10px 14px">
              <div style="display:flex;align-items:center;gap:8px;color:#9B8578;font-size:12px">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                No photo uploaded for this document
              </div>
            </div>`}
          </div>`;
        }).join('')}
      </div>
    </div>
  `;
}

function drawerHistory(s) {
  const items = state.history.filter(h => h.sebayat_id === s.id);
  if (items.length === 0) return emptyState('No review history', 'No actions have been taken on this profile yet.', iconClock());
  return `
    <div class="detail-section">
      <div class="detail-section-header"><span class="detail-section-title">Review Timeline</span><div class="detail-section-line"></div></div>
      <div>
        ${items.map(h => {
          const reviewer = state.sebayats.find(x => x.id === h.changed_by);
          const c = activityColor(h.to_status);
          return `<div class="history-item">
            <div class="history-dot" style="background:${c.bg};color:${c.fg}">${activityIcon(h.to_status)}</div>
            <div style="flex:1">
              <div class="history-line1">Status changed from <strong>${esc(STATUS_LABELS[h.from_status] || h.from_status || '—')}</strong> to <strong>${esc(STATUS_LABELS[h.to_status] || h.to_status)}</strong></div>
              ${h.remarks ? `<div class="history-remarks">${esc(h.remarks)}</div>` : ''}
              <div class="history-time">By ${reviewer ? esc(getName(reviewer)) : 'admin'} · ${fmtDate(h.created_at, true)}</div>
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>
  `;
}

function detailRow(label, value, raw = false) {
  if (value == null || value === '' || value === false) return '';
  const dv = raw ? value : (typeof value === 'string' ? esc(value) : value);
  return `<div class="detail-row"><div class="dk">${esc(label)}</div><div class="dv">${dv}</div></div>`;
}

function photoTile(url, label) {
  if (!url) return '';
  return `<div class="photo-tile" data-src="${esc(url)}" style="background-image:url('${esc(url)}')"><div class="photo-tile-label">${esc(label)}</div></div>`;
}

// Drawer tab handlers
$$('.drawer-tab').forEach(t => {
  t.onclick = () => {
    state.drawerTab = t.dataset.tab;
    $$('.drawer-tab').forEach(x => x.classList.toggle('active', x === t));
    renderDrawer();
  };
});

$('#drawer-close').onclick = closeDrawer;
$('#drawer-overlay').onclick = (e) => { if (e.target === $('#drawer-overlay')) closeDrawer(); };

// ============================================================
// MODAL
// ============================================================
function showModal(html, opts = {}) {
  const modal = $('#modal');
  modal.innerHTML = html;
  if (opts.wide) modal.classList.add('modal--wide');
  else modal.classList.remove('modal--wide');
  $('#modal-overlay').classList.add('open');
}

function renderCurrentPage() {
  if (state.view === 'admins') {
    const c = $('#view-container');
    if (c) { c.innerHTML = renderAdmins(); attachAdminsHandlers(); }
  } else {
    render();
  }
}
/*
  showConfirm({ title, message, confirmLabel, danger, onConfirm })
  Replaces native confirm() with a styled modal. onConfirm is called if user confirms.
*/
function showConfirm({ title = 'Are you sure?', message = '', confirmLabel = 'Confirm', danger = false, onConfirm }) {
  const iconSvg = danger
    ? `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#E8732A" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`
    : `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;
  const iconBg = danger ? '#FFF7ED' : '#EFF6FF';
  const iconBorder = danger ? '#FDBA74' : '#93C5FD';
  const confirmBtnStyle = danger
    ? 'background:#E8732A;color:#fff;border:none'
    : 'background:#E8732A;color:#fff;border:none';
  showModal(`
    <div style="padding:28px;width:400px;box-sizing:border-box">
      <div style="display:flex;align-items:flex-start;gap:14px;margin-bottom:20px">
        <div style="width:44px;height:44px;border-radius:50%;background:${iconBg};border:1.5px solid ${iconBorder};display:flex;align-items:center;justify-content:center;flex-shrink:0">${iconSvg}</div>
        <div style="flex:1;min-width:0">
          <h3 style="margin:0 0 6px;font-size:16px;font-weight:700;color:#2D1810;line-height:1.3">${esc(title)}</h3>
          ${message ? `<p style="margin:0;font-size:13px;color:#6B4C3B;line-height:1.6">${esc(message)}</p>` : ''}
        </div>
      </div>
      <div style="display:flex;justify-content:flex-end;gap:10px">
        <button class="btn btn-ghost" id="confirm-modal-cancel" style="padding:9px 20px">Cancel</button>
        <button class="btn btn-primary" id="confirm-modal-ok" style="padding:9px 24px;${confirmBtnStyle}">${esc(confirmLabel)}</button>
      </div>
    </div>
  `);
  $('#confirm-modal-cancel').onclick = closeModal;
  $('#confirm-modal-ok').onclick = () => { closeModal(); onConfirm(); };
}

function closeModal() {
  $('#modal-overlay').classList.remove('open');
  $('#modal').innerHTML = '';
  $('#modal').classList.remove('modal--wide');
  $('#modal').classList.remove('modal--perm-wide');
  state.pendingAction = null;
  state._pendingChangeSection = null;
}
window.closeModal = closeModal;

$('#modal-overlay').onclick = (e) => { if (e.target === $('#modal-overlay')) closeModal(); };

function openActionModal() {
  const { type, sebayat, sebayatIds, bulk } = state.pendingAction;
  const titles = { approve: 'Approve Application', reject: 'Reject Application', changes: 'Request Changes' };
  const descs = {
    approve: bulk ? `Approve ${sebayatIds.length} applications. Optionally add remarks. Applicants will be notified.` : 'Assign a registration number and confirm approval. The applicant will be notified.',
    reject: bulk ? `Reject ${sebayatIds.length} applications. Provide a reason — this will be visible to the applicants.` : 'Provide a clear reason for rejection. The applicant will see your remarks.',
    changes: bulk ? `Request changes for ${sebayatIds.length} applications. Describe what needs to be corrected.` : 'Describe what needs to be corrected. The applicant will be asked to update and resubmit.',
  };
  const btnClass = type === 'approve' ? 'btn-success' : type === 'reject' ? 'btn-danger' : 'btn-warning';

  const ctx = bulk ? `<div class="context-card">
    <div class="row-avatar" style="background:var(--saffron-light);color:var(--saffron)">${sebayatIds.length}</div>
    <div><div class="cell-stack-main">${sebayatIds.length} applications selected</div><div class="cell-stack-sub">Bulk action</div></div>
  </div>` : `<div class="context-card">
    <div class="row-avatar" ${sebayat.photo_url ? `style="background-image:url('${esc(sebayat.photo_url)}')"` : ''}>${sebayat.photo_url ? '' : esc(getInitials(sebayat))}</div>
    <div><div class="cell-stack-main">${esc(getName(sebayat))}</div><div class="cell-stack-sub">${sebayat.phone ? '+' + esc(sebayat.phone) : ''} · <span class="status-badge status-${esc(sebayat.profile_status)}">${esc(STATUS_LABELS[sebayat.profile_status] || sebayat.profile_status)}</span></div></div>
  </div>`;

  const checklist = type === 'changes' ? `
    <div class="checklist">
      ${[
        ['Profile photo','Profile photo needs to be re-uploaded.', 'personal'],
        ['Personal details','Personal details (name, DOB, etc.) need updating.', 'personal'],
        ['Address details','Address details are incomplete or incorrect.', 'address'],
        ['Identity documents','Identity documents need to be re-uploaded.', 'documents'],
        ['Seba details','Seba/bansa/palia details need correction.', 'seba'],
        ['Family details','Family details need updating.', 'family'],
      ].map(([label, line, section]) => `<label><input type="checkbox" data-line="${esc(line)}" data-section="${esc(section)}"> ${esc(label)}</label>`).join('')}
    </div>
  ` : '';

  const html = `
    <div class="modal-header">
      <div class="modal-title">${titles[type]}</div>
      <div class="modal-desc">${descs[type]}</div>
    </div>
    <div class="modal-body">
      ${ctx}
      ${type === 'approve' && !bulk ? `
        <div class="field">
          <label>Registration Number ${sebayat.registration_no ? '(currently: ' + esc(sebayat.registration_no) + ')' : '<span style="color:var(--ink4);font-weight:500">(optional)</span>'}</label>
          <input id="modal-reg" type="text" placeholder="e.g. PN-2025-0042" value="${esc(sebayat.registration_no || '')}" />
        </div>
      ` : ''}
      ${checklist}
      <div class="field">
        <label>${type === 'approve' ? 'Remarks (optional)' : 'Remarks <span style="color:var(--red)">*</span>'}</label>
        <textarea id="modal-remarks" rows="4" placeholder="${type === 'approve' ? 'Welcome message or notes…' : 'Explain your decision…'}" maxlength="500"></textarea>
        <div class="char-count"><span id="char-count">0</span>/500</div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn ${btnClass}" id="confirm-action-btn">Confirm ${type === 'approve' ? 'Approval' : type === 'reject' ? 'Rejection' : 'Request'}</button>
    </div>
  `;
  showModal(html);

  state._pendingChangeSection = null;
  state._pendingChangeSections = [];

  const remarks = $('#modal-remarks');
  remarks.oninput = () => $('#char-count').textContent = remarks.value.length;
  remarks.focus();

  if (type === 'changes') {
    // Section priority order — higher index = higher priority shown to user
    const SECTION_PRIORITY = ['contact','personal','family','address','documents','seba'];
    $$('.checklist input').forEach(cb => {
      cb.onchange = () => {
        const checked = $$('.checklist input:checked');
        const lines = checked.map(x => '• ' + x.dataset.line);
        remarks.value = lines.join('\n');
        $('#char-count').textContent = remarks.value.length;
        // Collect ALL unique checked sections (preserving order by label index)
        const sections = [...new Set(checked.map(x => x.dataset.section).filter(Boolean))];
        state._pendingChangeSections = sections;
        // Also pick the highest-priority single section for legacy change_section field
        const best = [...sections].sort((a, b) => SECTION_PRIORITY.indexOf(b) - SECTION_PRIORITY.indexOf(a))[0] || null;
        state._pendingChangeSection = best;
      };
    });
  }

  $('#confirm-action-btn').onclick = confirmAction;
}

async function confirmAction() {
  const { type, sebayatIds, bulk } = state.pendingAction;
  const remarks = $('#modal-remarks').value.trim();
  const regInput = $('#modal-reg');
  const regNo = regInput?.value.trim() || '';
  if ((type === 'reject' || type === 'changes') && !remarks) { showToast('Remarks are required', 'error'); return; }

  const btn = $('#confirm-action-btn');
  btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>';

  const statusMap = { approve: 'approved', reject: 'rejected', changes: 'changes_requested' };
  const newStatus = statusMap[type];
  const changeSection = type === 'changes' ? (state._pendingChangeSection || null) : null;
  const changeSections = type === 'changes' ? (state._pendingChangeSections?.length ? state._pendingChangeSections : (changeSection ? [changeSection] : null)) : null;

  let successes = 0, errors = 0;
  for (const id of sebayatIds) {
    const s = state.sebayats.find(x => x.id === id);
    const updates = {
      profile_status: newStatus,
      admin_remarks: remarks,
      reviewed_at: new Date().toISOString(),
      reviewed_by: state.user.id,
      ...(type === 'changes' ? { change_section: changeSection, change_sections: changeSections } : { change_section: null, change_sections: null }),
    };
    if (type === 'approve' && regNo && !bulk) updates.registration_no = regNo;
    const { error } = await db.from('sebayats').update(updates).eq('id', id);
    if (error) { errors++; continue; }
    await db.from('profile_review_history').insert({
      sebayat_id: id,
      from_status: s?.profile_status || '',
      to_status: newStatus,
      remarks: remarks || '',
      changed_by: state.user.id,
    });
    logActivity(
      type === 'approve' ? 'approve' : type === 'reject' ? 'reject' : 'update',
      'sebayat_profiles', id,
      [s?.first_name, s?.last_name].filter(Boolean).join(' ') || id,
      { status: s?.profile_status },
      { status: newStatus, remarks: remarks || '' }
    );

    // Fire notification
    const eventKeyMap = { approve: 'registration_approved', reject: 'registration_rejected', changes: 'registration_changes_requested' };
    const name = [s?.first_name, s?.last_name].filter(Boolean).join(' ') || s?.mobile_primary || '';
    dispatchNotification(eventKeyMap[type], id, {
      name,
      remarks: remarks || '',
      registration_no: regNo || s?.registration_no || '',
      reference_type: 'sebayat',
      reference_id: id,
    });

    successes++;
  }

  closeModal();
  closeDrawer();
  state.selectedIds.clear();

  if (errors > 0) showToast(`${errors} action(s) failed`, 'error');
  if (successes > 0) {
    const verb = type === 'approve' ? 'approved' : type === 'reject' ? 'rejected' : 'sent for changes';
    showToast(`${successes} application${successes > 1 ? 's' : ''} ${verb}`, 'success');
  }
  await loadAll();
}

// ============================================================
// SEBA CATEGORIES
// ============================================================
const SEBA_CAT_TYPES = [
  { key: 'seba', label: 'Seba Name', desc: 'Service/duty names performed by sebayats' },
];

function renderSebaCategories() {
  const tab = state.sebaCatTab;
  const cats = state.sebaCategories.filter(c => c.category_type === tab);
  const currentType = SEBA_CAT_TYPES.find(t => t.key === tab);

  return `
    <div class="page-header">
      <div>
        <h1>Seba Categories</h1>
        <p>Manage the Seba names used across sebayat profiles.</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-primary btn-sm" id="sc-add-btn">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add ${esc(currentType.label)}
        </button>
      </div>
    </div>

    <div class="sc-tabs">
      ${SEBA_CAT_TYPES.map(t => `
        <button class="sc-tab${tab === t.key ? ' active' : ''}" data-sc-tab="${esc(t.key)}">
          ${esc(t.label)}
          <span class="sc-tab-count">${state.sebaCategories.filter(c => c.category_type === t.key).length}</span>
        </button>`).join('')}
    </div>

    <div class="sc-desc">${esc(currentType.desc)}</div>

    <div class="panel">
      ${cats.length === 0
        ? emptyState(`No ${currentType.label} entries yet`, `Click "Add ${currentType.label}" to create the first one.`)
        : `<div class="data-table-wrap">
            <table class="data-table">
              <thead>
                <tr>
                  <th data-sort="sort_order" style="width:60px">Order</th>
                  <th data-sort="name">Name (English)</th>
                  <th>Odia Name</th>
                  <th>Description</th>
                  ${tab === 'seba' ? '<th style="width:90px">Beddha</th>' : ''}
                  ${tab === 'seba' ? '<th style="width:110px" title="Daily order in which this niti is performed in the temple">Niti Seq.</th>' : ''}
                  <th style="width:90px">Status</th>
                  <th>Created</th>
                  <th style="width:140px">Actions</th>
                </tr>
              </thead>
              <tbody>
                ${cats.map(cat => `
                  <tr class="${cat.is_active ? '' : 'sc-row-inactive'}">
                    <td>
                      <div class="sc-order-cell">
                        <button class="sc-order-btn" data-sc-up="${esc(cat.id)}" title="Move up"
                          ${cats.indexOf(cat) === 0 ? 'disabled' : ''}>&#8679;</button>
                        <span>${cat.sort_order}</span>
                        <button class="sc-order-btn" data-sc-down="${esc(cat.id)}" title="Move down"
                          ${cats.indexOf(cat) === cats.length - 1 ? 'disabled' : ''}>&#8681;</button>
                      </div>
                    </td>
                    <td><strong>${esc(cat.name)}</strong></td>
                    <td>${cat.name_or ? `<strong>${esc(cat.name_or)}</strong>` : `<span style="color:var(--ink4);font-style:italic;font-size:12px">Not set</span>`}</td>
                    <td><span style="color:var(--ink3)">${esc(cat.description || '—')}</span></td>
                    ${tab === 'seba' ? `<td>${renderBeddhaBadge(cat)}</td>` : ''}
                    ${tab === 'seba' ? `<td><input type="number" class="sc-niti-seq-input" data-sc-niti-seq="${esc(cat.id)}" min="1" max="100" value="${cat.niti_sequence ?? ''}" placeholder="—" style="width:72px;padding:4px 6px;border:1px solid #E8D5C4;border-radius:6px;font-size:13px;text-align:center" /></td>` : ''}
                    <td>
                      <span class="status-badge ${cat.is_active ? 'status-approved' : 'status-rejected'}">
                        ${cat.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>${fmtDate(cat.created_at)}</td>
                    <td>
                      <div style="display:flex;gap:6px">
                        ${tab === 'seba' ? `<button class="btn btn-accent btn-xs" data-sc-beddha="${esc(cat.id)}" title="Set number of Beddhas">Beddha</button>` : ''}
                        <button class="btn btn-ghost btn-xs" data-sc-edit="${esc(cat.id)}">Edit</button>
                      </div>
                    </td>
                  </tr>`).join('')}
              </tbody>
            </table>
          </div>
          <div class="table-footer">
            <span class="table-count">${cats.length} ${currentType.label} entr${cats.length === 1 ? 'y' : 'ies'}</span>
          </div>`}
    </div>
  `;
}

function openSebaCatModal(existing = null) {
  const tab = state.sebaCatTab;
  const typeLabel = SEBA_CAT_TYPES.find(t => t.key === tab)?.label || tab;
  const isEdit = !!existing;
  const html = `
    <div class="modal-header">
      <div class="modal-title">${isEdit ? 'Edit' : 'Add'} ${esc(typeLabel)}</div>
      <div class="modal-desc">${isEdit ? 'Update the details for this category entry.' : `Create a new ${esc(typeLabel.toLowerCase())} entry. It will be available across all sebayat profiles.`}</div>
    </div>
    <div class="modal-body">
      <div class="field">
        <label>Name (English) <span style="color:var(--red)">*</span></label>
        <input id="sc-modal-name" type="text" placeholder="${tab === 'palia' ? 'e.g. 1, 2, 3…' : tab === 'bansa' ? 'e.g. Daitapati' : 'e.g. Pahandi'}"
          value="${esc(existing?.name || '')}" maxlength="120" />
      </div>
      <div class="field">
        <label>Odia Name <span style="color:var(--ink4);font-weight:400">(optional)</span></label>
        <input id="sc-modal-name-or" type="text" placeholder="ଓଡ଼ିଆ ନାମ ଲେଖନ୍ତୁ"
          value="${esc(existing?.name_or || '')}" maxlength="120" />
      </div>
      <div class="field">
        <label>Description <span style="color:var(--ink4);font-weight:400">(optional)</span></label>
        <textarea id="sc-modal-desc" rows="2" placeholder="Brief explanation or notes…" maxlength="300">${esc(existing?.description || '')}</textarea>
      </div>
      <div class="field">
        <label>Sort Order</label>
        <input id="sc-modal-order" type="number" min="0" max="9999" value="${existing?.sort_order ?? 0}" style="width:120px" />
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" id="sc-modal-save">${isEdit ? 'Save Changes' : 'Create'}</button>
    </div>
  `;
  showModal(html);
  const nameInput = $('#sc-modal-name');
  nameInput.focus();

  $('#sc-modal-save').onclick = async () => {
    const name = nameInput.value.trim();
    const name_or = $('#sc-modal-name-or').value.trim() || null;
    const description = $('#sc-modal-desc').value.trim() || null;
    const sort_order = parseInt($('#sc-modal-order').value) || 0;
    if (!name) { showToast('Name is required', 'error'); nameInput.focus(); return; }

    const btn = $('#sc-modal-save');
    btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>';

    if (isEdit) {
      const { error } = await db.from('seba_categories')
        .update({ name, name_or, description, sort_order, updated_at: new Date().toISOString() })
        .eq('id', existing.id);
      if (error) {
        btn.disabled = false; btn.textContent = 'Save Changes';
        showToast('Failed: ' + (error.message.includes('unique') ? 'That name already exists.' : error.message), 'error');
        return;
      }
      showToast(`${typeLabel} updated`, 'success');
    } else {
      const { error } = await db.from('seba_categories')
        .insert({ category_type: tab, name, name_or, description, sort_order, created_by: state.user?.id });
      if (error) {
        btn.disabled = false; btn.textContent = 'Create';
        showToast('Failed: ' + (error.message.includes('unique') ? 'That name already exists.' : error.message), 'error');
        return;
      }
      showToast(`${typeLabel} "${name}" created`, 'success');
    }

    closeModal();
    const { data } = await db.from('seba_categories').select('*').order('category_type').order('sort_order').order('name');
    state.sebaCategories = data || [];
    render();
  };
}

function openBeddhaModal(cat) {
  if (!cat.beddha_count) {
    showToast('This seba has no beddha count set.', 'error');
    return;
  }

  // Local working copy of assignments for this category
  const assignments = Object.assign({}, state.sebaBeddhas[cat.id] || {});
  const selected = new Set();

  function countsByType() {
    let h = 0, n = 0;
    for (let i = 1; i <= cat.beddha_count; i++) {
      if (assignments[i] === 'hereditary') h++;
      else if (assignments[i] === 'nijog_assigned') n++;
    }
    return { h, n, u: cat.beddha_count - h - n };
  }

  function renderGrid() {
    const { h, n, u } = countsByType();
    // Summary
    $('#beddha-summary').innerHTML = `
      <span class="beddha-summary-chip hereditary"><span class="dot"></span>${h} Hereditary</span>
      <span class="beddha-summary-chip nijog"><span class="dot"></span>${n} Nijog Assigned</span>
      <span class="beddha-summary-chip unassigned"><span class="dot"></span>${u} Unassigned</span>
    `;
    // Pills
    const gridEl = $('#beddha-grid');
    gridEl.innerHTML = '';
    for (let i = 1; i <= cat.beddha_count; i++) {
      const type = assignments[i];
      const isSelected = selected.has(i);
      const pill = document.createElement('div');
      pill.className = 'beddha-pill' + (type === 'hereditary' ? ' hereditary' : type === 'nijog_assigned' ? ' nijog' : '') + (isSelected ? ' selected' : '');
      pill.textContent = i;
      pill.dataset.num = i;
      pill.onclick = () => {
        if (selected.has(i)) selected.delete(i);
        else selected.add(i);
        renderGrid();
      };
      gridEl.appendChild(pill);
    }
    // Actions hint
    const hint = $('#beddha-actions-hint');
    if (hint) hint.textContent = selected.size > 0 ? `${selected.size} selected` : 'Click beddhas to select, then apply a type';
    // Warning and save button
    const warning = $('#beddha-unassigned-warning');
    const saveBtn = $('#beddha-save-btn');
    if (u > 0) {
      if (warning) warning.textContent = `${u} beddha${u > 1 ? 's' : ''} still unassigned — assign all before saving`;
      if (saveBtn) saveBtn.disabled = true;
    } else {
      if (warning) warning.textContent = '';
      if (saveBtn) saveBtn.disabled = false;
    }
  }

  const html = `
    <div class="modal-header">
      <div class="modal-title">Beddha Assignments — ${esc(cat.name)}</div>
      <div class="modal-desc">Select beddhas, then mark them as Hereditary or Nijog Assigned. All ${cat.beddha_count} must be assigned before saving.</div>
    </div>
    <div class="modal-body">
      <div id="beddha-summary" class="beddha-summary"></div>
      <div id="beddha-grid" class="beddha-grid"></div>
      <div class="beddha-actions">
        <button class="btn btn-sm btn-hereditary" id="beddha-mark-hereditary">Mark Hereditary</button>
        <button class="btn btn-sm btn-nijog" id="beddha-mark-nijog">Mark Nijog Assigned</button>
        <button class="btn btn-sm btn-ghost" id="beddha-clear-sel">Clear Selection</button>
        <span id="beddha-actions-hint" class="beddha-actions-hint">Click beddhas to select, then apply a type</span>
      </div>
      <div id="beddha-unassigned-warning" class="beddha-unassigned-warning" style="margin-top:10px"></div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" id="beddha-save-btn" disabled>Save Assignments</button>
    </div>
  `;

  showModal(html);
  $('#modal').classList.add('modal--wide');

  renderGrid();

  $('#beddha-mark-hereditary').onclick = () => {
    if (selected.size === 0) { showToast('Select at least one beddha first', 'error'); return; }
    selected.forEach(n => { assignments[n] = 'hereditary'; });
    selected.clear();
    renderGrid();
  };

  $('#beddha-mark-nijog').onclick = () => {
    if (selected.size === 0) { showToast('Select at least one beddha first', 'error'); return; }
    selected.forEach(n => { assignments[n] = 'nijog_assigned'; });
    selected.clear();
    renderGrid();
  };

  $('#beddha-clear-sel').onclick = () => {
    selected.clear();
    renderGrid();
  };

  $('#beddha-save-btn').onclick = async () => {
    const { u } = countsByType();
    if (u > 0) { showToast(`${u} beddhas still unassigned`, 'error'); return; }

    const saveBtn = $('#beddha-save-btn');
    saveBtn.disabled = true; saveBtn.innerHTML = '<span class="spinner"></span>';

    const rows = [];
    for (let i = 1; i <= cat.beddha_count; i++) {
      rows.push({
        seba_category_id: cat.id,
        beddha_number: i,
        beddha_type: assignments[i],
        updated_at: new Date().toISOString(),
      });
    }

    const { error } = await db.from('seba_beddhas')
      .upsert(rows, { onConflict: 'seba_category_id,beddha_number' });

    if (error) {
      saveBtn.disabled = false; saveBtn.textContent = 'Save Assignments';
      showToast('Failed: ' + error.message, 'error'); return;
    }

    showToast('Beddha assignments saved', 'success');
    closeModal();
    await reloadBeddhas();
    render();
  };
}

function attachSebaCatHandlers() {
  // Tab switching
  $$('[data-sc-tab]').forEach(btn => {
    btn.onclick = () => { state.sebaCatTab = btn.dataset.scTab; render(); };
  });

  // Add button
  const addBtn = $('#sc-add-btn');
  if (addBtn) addBtn.onclick = () => openSebaCatModal(null);

  // Beddha buttons
  $$('[data-sc-beddha]').forEach(btn => {
    btn.onclick = () => {
      const cat = state.sebaCategories.find(c => c.id === btn.dataset.scBeddha);
      if (cat) openBeddhaModal(cat);
    };
  });

  // Edit buttons
  $$('[data-sc-edit]').forEach(btn => {
    btn.onclick = () => {
      const cat = state.sebaCategories.find(c => c.id === btn.dataset.scEdit);
      if (cat) openSebaCatModal(cat);
    };
  });

  // Toggle active/inactive
  $$('[data-sc-toggle]').forEach(btn => {
    btn.onclick = async () => {
      const cat = state.sebaCategories.find(c => c.id === btn.dataset.scToggle);
      if (!cat) return;
      const { error } = await db.from('seba_categories')
        .update({ is_active: !cat.is_active, updated_at: new Date().toISOString() })
        .eq('id', cat.id);
      if (error) { showToast('Failed: ' + error.message, 'error'); return; }
      const { data } = await db.from('seba_categories').select('*').order('category_type').order('sort_order').order('name');
      state.sebaCategories = data || [];
      render();
    };
  });

  // Delete buttons
  $$('[data-sc-delete]').forEach(btn => {
    btn.onclick = async () => {
      const cat = state.sebaCategories.find(c => c.id === btn.dataset.scDelete);
      if (!cat) return;
      showConfirm({
        title: 'Delete Seba Category',
        message: `Delete "${cat.name}"? This cannot be undone.`,
        confirmLabel: 'Delete',
        danger: true,
        onConfirm: async () => {
          const { error } = await db.from('seba_categories').delete().eq('id', cat.id);
          if (error) { showToast('Failed: ' + error.message, 'error'); return; }
          showToast(`"${cat.name}" deleted`, 'success');
          const { data } = await db.from('seba_categories').select('*').order('category_type').order('sort_order').order('name');
          state.sebaCategories = data || [];
          render();
        },
      });
    };
  });

  // Niti sequence inline edit
  $$('[data-sc-niti-seq]').forEach(inp => {
    inp.onchange = async () => {
      const id = inp.dataset.scNitiSeq;
      const raw = inp.value.trim();
      const val = raw === '' ? null : Math.max(1, parseInt(raw, 10) || 1);
      const { error } = await db.from('seba_categories')
        .update({ niti_sequence: val, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) { showToast('Failed: ' + error.message, 'error'); return; }
      const cat = state.sebaCategories.find(c => c.id === id);
      if (cat) cat.niti_sequence = val;
      showToast('Niti sequence saved', 'success');
    };
  });

  // Move up/down (reorder)
  $$('[data-sc-up], [data-sc-down]').forEach(btn => {
    btn.onclick = async () => {
      const isUp = 'scUp' in btn.dataset;
      const id = btn.dataset.scUp || btn.dataset.scDown;
      const tab = state.sebaCatTab;
      const cats = state.sebaCategories.filter(c => c.category_type === tab);
      const idx = cats.findIndex(c => c.id === id);
      const swapIdx = isUp ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= cats.length) return;

      const a = cats[idx], b = cats[swapIdx];
      const aOrder = a.sort_order, bOrder = b.sort_order;
      const newAOrder = aOrder === bOrder ? (isUp ? aOrder - 1 : aOrder + 1) : bOrder;
      const newBOrder = aOrder === bOrder ? (isUp ? bOrder + 1 : bOrder - 1) : aOrder;

      await Promise.all([
        db.from('seba_categories').update({ sort_order: newAOrder, updated_at: new Date().toISOString() }).eq('id', a.id),
        db.from('seba_categories').update({ sort_order: newBOrder, updated_at: new Date().toISOString() }).eq('id', b.id),
      ]);
      const { data } = await db.from('seba_categories').select('*').order('category_type').order('sort_order').order('name');
      state.sebaCategories = data || [];
      render();
    };
  });
}

// ============================================================
// ADD PROFILE WIZARD
// ============================================================
const ADD_PROFILE_STEPS = [
  { title: 'Personal', sub: 'Name, DOB, gender, health' },
  { title: 'Contact & IDs', sub: 'Phone, email, identity documents' },
  { title: 'Seba', sub: 'Seba beddha selection' },
  { title: 'Family', sub: 'Father, mother, spouse, children' },
  { title: 'Address', sub: 'Permanent & current address' },
  { title: 'Occupation', sub: 'Joining date & occupation' },
  { title: 'Social & Review', sub: 'Social media profiles and confirm' },
];

function apField(id, label, type = 'text', placeholder = '', required = false, options = null, extraAttrs = '') {
  const val = state.newProfile[id] != null ? state.newProfile[id] : '';
  const req = required ? ' <span style="color:var(--red)">*</span>' : '';
  const errId = `ap-err-${id}`;
  const errSlot = `<div class="ap-field-error" id="${errId}"></div>`;
  if (options) {
    return `<div class="field" id="ap-wrap-${esc(id)}">
      <label>${label}${req}</label>
      <select id="ap-${esc(id)}" data-ap="${esc(id)}" ${extraAttrs}>
        <option value="">— Select —</option>
        ${options.map(o => `<option value="${esc(o)}" ${String(val) === o ? 'selected' : ''}>${esc(o)}</option>`).join('')}
      </select>
      ${errSlot}
    </div>`;
  }
  if (type === 'textarea') {
    return `<div class="field" id="ap-wrap-${esc(id)}">
      <label>${label}${req}</label>
      <textarea id="ap-${esc(id)}" data-ap="${esc(id)}" rows="2" placeholder="${esc(placeholder)}" ${extraAttrs}>${esc(String(val))}</textarea>
      ${errSlot}
    </div>`;
  }
  return `<div class="field" id="ap-wrap-${esc(id)}">
    <label>${label}${req}</label>
    <input id="ap-${esc(id)}" data-ap="${esc(id)}" type="${type}" placeholder="${esc(placeholder)}" value="${esc(String(val))}" ${extraAttrs} />
    ${errSlot}
  </div>`;
}

function apToggle(id, label, description = '') {
  const val = state.newProfile[id] === true || state.newProfile[id] === 'true';
  return `<div class="ap-toggle-row">
    <div class="ap-toggle-label">
      <div class="ap-toggle-title">${esc(label)}</div>
      ${description ? `<div class="ap-toggle-desc">${esc(description)}</div>` : ''}
    </div>
    <label class="ap-toggle-switch">
      <input type="checkbox" id="ap-${esc(id)}" data-ap-toggle="${esc(id)}" ${val ? 'checked' : ''} />
      <span class="ap-toggle-track"></span>
    </label>
  </div>`;
}

function apSection(title) {
  return `<div class="detail-section-header" style="margin:20px 0 12px"><span class="detail-section-title">${esc(title)}</span><div class="detail-section-line"></div></div>`;
}

function apAddress(prefix, titleLabel) {
  const req = prefix === 'permanent';
  return `
    ${apSection(titleLabel)}
    <div class="ap-grid">
      ${apField(prefix + '_sahi', 'Sahi / Mohalla', 'text', 'e.g. Badaghara Sahi', req)}
      ${apField(prefix + '_landmark', 'Landmark', 'text', 'Nearby landmark', req)}
      ${apField(prefix + '_post_office', 'Post Office', 'text', 'Post office name', req)}
      ${apField(prefix + '_police_station', 'Police Station', 'text', 'Police station name', req)}
      ${apField(prefix + '_pincode', 'Pincode', 'text', '6-digit PIN', req, null, 'maxlength="6" inputmode="numeric" data-digits-only="true"')}
      ${apField(prefix + '_district', 'District', 'text', 'e.g. Puri', req)}
      ${apField(prefix + '_state', 'State', 'text', 'e.g. Odisha', req)}
      ${apField(prefix + '_country', 'Country', 'text', 'India')}
    </div>
    ${apField(prefix + '_address_text', 'Full Address (optional)', 'textarea', 'House no., street, area…')}`;
}

function apFatherSearch() {
  const p = state.newProfile;
  const linkedId = p.father_sebayat_id || '';
  const fatherName = p.father_name || '';
  const isManual = p.father_manual === 'yes';
  const searchResults = state.fatherSearchResults || [];
  const searching = state.fatherSearching || false;

  if (isManual) {
    return `<div class="field">
      <label>Father's Name <span style="color:var(--red)">*</span></label>
      <div style="display:flex;gap:8px;align-items:center">
        <input id="ap-father_name" data-ap="father_name" type="text" placeholder="Full name" value="${esc(fatherName)}" style="flex:1" />
        <button class="btn btn-ghost btn-sm" id="ap-father-switch-search" style="white-space:nowrap;flex-shrink:0">Search</button>
      </div>
    </div>`;
  }

  return `<div class="field">
    <label>Father's Name <span style="color:var(--red)">*</span></label>
    ${linkedId ? `
      <div class="ap-father-linked">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
        <span>${esc(fatherName)}</span>
        <button class="btn btn-ghost btn-sm" id="ap-father-clear" style="margin-left:auto">Clear</button>
      </div>` : `
      <div style="position:relative">
        <input id="ap-father-search-input" type="text" placeholder="Search registered sebayat" value="${esc(fatherName)}" autocomplete="off" />
        ${searching ? `<div class="ap-search-spin"></div>` : ''}
        ${searchResults.length > 0 ? `
          <div class="ap-father-dropdown">
            ${searchResults.map(s => `
              <div class="ap-father-result" data-id="${esc(s.id)}" data-name="${esc(getName(s))}">
                <div class="ap-father-result-name">${esc(getName(s))}</div>
                <div class="ap-father-result-sub">${s.date_of_birth ? 'DOB: ' + fmtDate(s.date_of_birth) : ''}${s.bansa_name ? ' · ' + s.bansa_name : ''}</div>
              </div>`).join('')}
          </div>` : ''}
      </div>
      <div style="margin-top:6px">
        <button class="link-action" id="ap-father-switch-manual" style="font-size:12px">Enter name manually instead</button>
      </div>`}
  </div>`;
}

function renderAddProfile() {
  const step = state.addProfileStep;
  const p = state.newProfile;
  // Initialize list defaults
  if (!p.id_documents) p.id_documents = [{ id_type: '', photo_url: '' }];
  if (!p.occupations) p.occupations = [{ occupation: '', extra_curriculum_activity: '' }];
  if (!p.extra_phones) p.extra_phones = [];
  if (!p.children) p.children = [];
  if (p.joining_date_exact === undefined) p.joining_date_exact = true;
  // Mark _bhagari_selected true if either flag is already set (e.g. navigating back)
  if (p.is_bhagari === true || p.is_bhagari === 'true' || p.is_baristha_bhai_pua === true || p.is_baristha_bhai_pua === 'true') {
    p._bhagari_selected = true;
  }
  const isLast = step === ADD_PROFILE_STEPS.length - 1;

  const stepsHtml = ADD_PROFILE_STEPS.map((s, i) => {
    let cls = 'ap-step';
    if (i < step) cls += ' done';
    else if (i === step) cls += ' active';
    return `<div class="${cls}">
      <div class="ap-step-dot">${i < step ? '✓' : i + 1}</div>
      <div class="ap-step-label">${esc(s.title)}</div>
    </div>`;
  }).join('');

  let body = '';

  // ── STEP 0: Personal ──
  if (step === 0) {
    body = `
      ${apSection('Identity')}
      <div class="ap-grid">
        ${apField('first_name', 'First Name', 'text', 'First name', true)}
        ${apField('middle_name', 'Middle Name', 'text', 'Middle name')}
        ${apField('last_name', 'Last Name', 'text', 'Last name', true)}
        ${apField('alias_name', 'Alias / Known as', 'text', 'Alias / known as')}
      </div>
      ${apField('date_of_birth', 'Date of Birth <span style="color:var(--red)">*</span>', 'date', '', false)}
      <div class="ap-chips-row">
        <div class="ap-chips-label">Gender <span style="color:var(--red)">*</span></div>
        <div class="ap-chips">
          ${['Male','Female'].map(g => `<button class="ap-chip${p.gender === g ? ' active' : ''}" data-ap-chip="gender" data-val="${esc(g)}">${esc(g)}</button>`).join('')}
        </div>
      </div>
      <div class="ap-radio-group-block">
        <div class="ap-radio-group-label">Bhagari / Baristha Bhai Pua <span style="color:var(--red)">*</span></div>
        <div class="ap-radio-group-desc">Select one that applies to this sebayat</div>
        <div class="ap-radio-options">
          ${(()=>{
            const isBhagari = p.is_bhagari === true || p.is_bhagari === 'true';
            const isBaristha = p.is_baristha_bhai_pua === true || p.is_baristha_bhai_pua === 'true';
            const isNeither = p._bhagari_selected && !isBhagari && !isBaristha;
            return [['bhagari','Bhagari'],['baristha','Baristha Bhai Pua'],['neither','Neither']].map(([val, label]) => {
              const sel = (val === 'bhagari' && isBhagari) || (val === 'baristha' && isBaristha) || (val === 'neither' && isNeither);
              return `<label class="ap-radio-opt${sel ? ' active' : ''}">
                <input type="radio" name="bhagari_type" value="${val}" ${sel ? 'checked' : ''} class="ap-bhagari-radio" />
                <span class="ap-radio-circle"></span>
                <span class="ap-radio-text">${label}</span>
              </label>`;
            }).join('');
          })()}
        </div>
      </div>
      ${apSection('Health')}
      <div class="ap-grid">
        ${apField('blood_group', 'Blood Group', 'text', '', false, ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'])}
        ${apField('health_card_no', 'Health Card Number <span style="color:var(--red)">*</span>', 'text', '8-digit number', false, null, 'maxlength="8" inputmode="numeric" data-digits-only="true"')}
      </div>`;

  // ── STEP 1: Contact & IDs ──
  } else if (step === 1) {
    const docs = p.id_documents || [];
    const extraPhones = p.extra_phones || [];
    const usedTypes = docs.map(d => d.id_type).filter(Boolean);
    const allIdTypes = ['Aadhar Card', 'PAN Card', 'Voter ID', 'Passport', 'Driving Licence'];
    body = `
      <div class="ap-info-banner">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        These numbers will be used by the Nijog administration to contact the sebayat.
      </div>
      <div class="ap-grid">
        ${apField('phone', 'Phone Number (Primary)', 'tel', '10-digit number', true, null, 'maxlength="10" inputmode="numeric" data-digits-only="true"')}
        ${apField('whatsapp_number', 'WhatsApp Number', 'tel', '10-digit number', false, null, 'maxlength="10" inputmode="numeric" data-digits-only="true"')}
        ${apField('email', 'Email Address', 'email', 'email@example.com')}
      </div>
      ${apSection('Additional Phone Numbers')}
      ${extraPhones.map((ph, i) => `
        <div class="ap-list-row" data-phone-idx="${i}">
          <input type="tel" class="ap-extra-phone" data-phone-idx="${i}" placeholder="Number ${i+1}" value="${esc(ph)}" maxlength="15" style="flex:1" />
          <button class="ap-list-del" data-del-phone="${i}" title="Remove">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
          </button>
        </div>`).join('')}
      <button class="ap-add-btn" id="ap-add-phone">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Add another number
      </button>
      ${apSection('Identity Cards')}
      <div class="ap-info-banner" style="margin-bottom:12px">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        Attach one or more government IDs.
      </div>
      ${docs.map((doc, i) => `
        <div class="ap-id-card" data-doc-idx="${i}">
          <div class="ap-id-card-header">
            <span class="ap-id-card-num">ID ${i + 1}</span>
            <select class="ap-doc-type" data-doc-idx="${i}" data-doc-field="id_type">
              <option value="">— Select ID type —</option>
              ${allIdTypes.map(t => `<option value="${esc(t)}" ${doc.id_type === t ? 'selected' : ''}>${esc(t)}</option>`).join('')}
            </select>
            ${docs.length > 1 ? `<button class="ap-list-del" data-del-doc="${i}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
            </button>` : ''}
          </div>
          <div class="ap-id-photo-row">
            ${doc.photo_url
              ? `<div class="ap-id-photo-preview" style="background-image:url('${esc(doc.photo_url)}')"></div>
                 <span class="ap-id-photo-label">Photo uploaded · Tap to replace</span>`
              : `<span class="ap-id-photo-label">Upload ID photo — Front side · JPG or PNG</span>`}
            <input type="file" class="ap-doc-photo-input" data-doc-idx="${i}" accept="image/*" style="display:none" id="ap-doc-photo-${i}" />
            <button class="btn btn-ghost btn-sm ap-doc-photo-btn" data-doc-idx="${i}">${doc.photo_url ? 'Replace' : 'Upload'}</button>
          </div>
        </div>`).join('')}
      ${docs.length < allIdTypes.length ? `
        <button class="ap-add-btn" id="ap-add-doc">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add another ID
        </button>` : ''}`;

  // ── STEP 2: Seba ──
  } else if (step === 2) {
    const apSebaSelections2 = p.sebaSelections || {};
    const AP_HIDDEN_SEBAS2 = ['Singha Dwara', 'Dwara Ghara'];
    if (!state.apSebaExpanded) state.apSebaExpanded = {};
    const sebaCatsHtml2 = (state.sebaCategories || [])
      .filter(cat => cat.is_active && cat.category_type === 'seba' && !AP_HIDDEN_SEBAS2.includes(cat.name))
      .map(cat => {
        const beddhaTypes = state.sebaBeddhas[cat.id] || {};
        const selectedNums = apSebaSelections2[cat.id] || [];
        const count = cat.beddha_count || 0;
        const selCount = selectedNums.length;
        const isOpen = !!state.apSebaExpanded[cat.id];
        const pills = Array.from({ length: count }, (_, i) => i + 1).map(num => {
          const bType = beddhaTypes[num];
          const isNijog = bType === 'nijog_assigned';
          const isSel = selectedNums.includes(num);
          if (isNijog) return `<div class="ap-beddha ap-beddha--disabled" title="Nijog assigned">${num}<span class="ap-beddha-n">N</span></div>`;
          return `<div class="ap-beddha${isSel ? ' ap-beddha--selected' : ''}" data-cat="${esc(cat.id)}" data-num="${num}" onclick="apToggleBeddha('${esc(cat.id)}', ${num})">${num}</div>`;
        }).join('');
        return `
          <div class="ap-seba-cat-card" id="ap-seba-card-${esc(cat.id)}">
            <div class="ap-seba-cat-header ap-seba-toggle" onclick="apToggleSebaCard('${esc(cat.id)}')">
              <span class="ap-seba-cat-name">${esc(cat.name)}</span>
              <div style="display:flex;gap:6px;align-items:center">
                ${selCount > 0 ? `<span class="ap-seba-sel-badge">${selCount} selected</span>` : ''}
                <span class="ap-seba-count-badge">${count}</span>
                <span id="ap-seba-chev-${esc(cat.id)}" class="ap-seba-chevron" style="transform:rotate(${isOpen ? '90deg' : '0deg'})">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
                </span>
              </div>
            </div>
            <div id="ap-seba-body-${esc(cat.id)}" style="display:${isOpen ? 'block' : 'none'}">
              <div class="ap-beddha-grid">${pills}</div>
              <div class="ap-seba-legend">
                <span class="ap-legend-item"><span class="ap-legend-dot ap-legend-dot--selected"></span>Selected</span>
                <span class="ap-legend-item"><span class="ap-legend-dot ap-legend-dot--available"></span>Available</span>
                <span class="ap-legend-item"><span class="ap-legend-dot ap-legend-dot--nijog"></span>N — Nijog assigned</span>
              </div>
            </div>
          </div>`;
      }).join('');
    const totalSel2 = Object.values(apSebaSelections2).reduce((s, arr) => s + arr.length, 0);
    body = `
      ${apSection('Seba Selection')}
      <div class="ap-info-banner" style="margin-bottom:12px">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        Select the beddha numbers for this sebayat. Grey pills marked <strong>N</strong> are Nijog-assigned and cannot be selected.
      </div>
      ${totalSel2 > 0 ? `<div class="ap-seba-total-badge">${totalSel2} beddha${totalSel2 !== 1 ? 's' : ''} selected across all sebas</div>` : ''}
      ${sebaCatsHtml2 || '<p style="color:var(--ink4);font-size:14px">No seba categories configured.</p>'}`;

  // ── STEP 3: Family ──
  } else if (step === 3) {
    const married = p.marital_status === 'Married';
    const children = p.children || [];
    body = `
      ${apFatherSearch()}
      ${apField('mother_name', 'Mother\'s Full Name <span style="color:var(--red)">*</span>', 'text', 'Full name')}
      <div class="ap-chips-row">
        <div class="ap-chips-label">Marital Status <span style="color:var(--red)">*</span></div>
        <div class="ap-chips">
          ${['Unmarried','Married'].map(m => `<button class="ap-chip${p.marital_status === m ? ' active' : ''}" data-ap-chip="marital_status" data-val="${esc(m)}">${esc(m)}</button>`).join('')}
        </div>
      </div>
      ${married ? `
        ${apSection('Spouse Details')}
        <div class="ap-grid">
          ${apField('spouse_name', 'Spouse Name', 'text', 'Full name', true)}
          ${apField('spouse_father_name', "Spouse's Father Name", 'text', 'Full name', true)}
          ${apField('spouse_mother_name', "Spouse's Mother Name", 'text', 'Full name', true)}
        </div>
        ${apSection('Children')}
        ${children.map((child, i) => `
          <div class="ap-child-card" data-child-idx="${i}">
            <div class="ap-id-card-header">
              <span class="ap-id-card-num">Child ${i + 1}</span>
              <button class="ap-list-del" data-del-child="${i}">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
              </button>
            </div>
            <input type="text" class="ap-child-field" data-child-idx="${i}" data-child-field="child_name" placeholder="Full name" value="${esc(child.child_name || '')}" style="margin-bottom:8px" />
            <div class="ap-chips-row" style="margin-bottom:8px">
              <div class="ap-chips-label">Gender</div>
              <div class="ap-chips">
                ${['Male','Female'].map(g => `<button class="ap-chip${child.gender === g ? ' active' : ''}" data-child-chip="${i}" data-child-field="gender" data-val="${esc(g)}">${esc(g)}</button>`).join('')}
              </div>
            </div>
            <div class="ap-chips-row">
              <div class="ap-chips-label">Marital Status</div>
              <div class="ap-chips">
                ${['Single','Married'].map(m => `<button class="ap-chip${child.marital_status === m ? ' active' : ''}" data-child-chip="${i}" data-child-field="marital_status" data-val="${esc(m)}">${esc(m)}</button>`).join('')}
              </div>
            </div>
          </div>`).join('')}
        <button class="ap-add-btn" id="ap-add-child">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add child
        </button>` : ''}`;

  // ── STEP 4: Address ──
  } else if (step === 4) {
    const hasCurrent = p.is_permanent_different === true || p.is_permanent_different === 'true';
    body = `
      ${apAddress('permanent', 'Permanent Address')}
      <div class="ap-toggle-row" style="margin-top:20px">
        <div class="ap-toggle-label">
          <div class="ap-toggle-title">Current address is different</div>
        </div>
        <label class="ap-toggle-switch">
          <input type="checkbox" id="ap-has-current" ${hasCurrent ? 'checked' : ''} />
          <span class="ap-toggle-track"></span>
        </label>
      </div>
      ${hasCurrent ? apAddress('current', 'Current Address') : ''}`;

  // ── STEP 5: Occupation ──
  } else if (step === 5) {
    const exactDate = p.joining_date_exact !== false && p.joining_date_exact !== 'false';
    const occupations = p.occupations || [];
    body = `
      ${apSection('Joining Nijog')}
      <div class="ap-toggle-row" style="margin-bottom:12px">
        <div class="ap-toggle-label">
          <div class="ap-toggle-title">I know the exact joining date</div>
        </div>
        <label class="ap-toggle-switch">
          <input type="checkbox" id="ap-joining-exact" ${exactDate ? 'checked' : ''} />
          <span class="ap-toggle-track"></span>
        </label>
      </div>
      ${exactDate
        ? apField('joining_date', 'Joining Date <span style="color:var(--red)">*</span>', 'date', '')
        : `<div class="ap-info-banner" style="margin-bottom:8px">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            Please enter the year the sebayat joined instead.
           </div>
           ${apField('joining_year', 'Joining Year <span style="color:var(--red)">*</span>', 'select', '', false, Array.from({length: new Date().getFullYear() - 1899}, (_, i) => String(new Date().getFullYear() - i)))}`}
      ${apSection('Occupations')}
      ${occupations.map((occ, i) => `
        <div class="ap-occ-card" data-occ-idx="${i}">
          <div class="ap-id-card-header">
            <span class="ap-id-card-num">Occupation ${i + 1}</span>
            ${occupations.length > 1 ? `<button class="ap-list-del" data-del-occ="${i}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
            </button>` : ''}
          </div>
          <input type="text" class="ap-occ-field" data-occ-idx="${i}" data-occ-field="occupation" placeholder="e.g. Teacher, Engineer" value="${esc(occ.occupation || '')}" style="margin-bottom:8px" />
          <input type="text" class="ap-occ-field" data-occ-idx="${i}" data-occ-field="extra_curriculum_activity" placeholder="e.g. Sports coaching" value="${esc(occ.extra_curriculum_activity || '')}" />
        </div>`).join('')}
      <button class="ap-add-btn" id="ap-add-occ">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Add another occupation
      </button>`;

  // ── STEP 6: Social & Review ──
  } else if (step === 6) {
    const socialFields = [
      { key: 'social_facebook', label: 'Facebook', color: '#1877F2', placeholder: 'facebook.com/...', icon: 'M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z' },
      { key: 'social_twitter', label: 'X (Twitter)', color: '#0F1419', placeholder: 'x.com/...', icon: 'M23 3a10.9 10.9 0 0 1-3.14 1.53 4.48 4.48 0 0 0-7.86 3v1A10.66 10.66 0 0 1 3 4s-4 9 5 13a11.64 11.64 0 0 1-7 2c9 5 20 0 20-11.5a4.5 4.5 0 0 0-.08-.83A7.72 7.72 0 0 0 23 3z' },
      { key: 'social_instagram', label: 'Instagram', color: '#C13584', placeholder: 'instagram.com/...', icon: 'M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37zm1.5-4.87h.01M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5z' },
      { key: 'social_linkedin', label: 'LinkedIn', color: '#0A66C2', placeholder: 'linkedin.com/in/...', icon: 'M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6zM2 9h4v12H2z M2 4a2 2 0 1 0 4 0 2 2 0 0 0-4 0' },
      { key: 'social_youtube', label: 'YouTube', color: '#FF0000', placeholder: 'youtube.com/@...', icon: 'M22.54 6.42a2.78 2.78 0 0 0-1.95-1.97C18.88 4 12 4 12 4s-6.88 0-8.59.46A2.78 2.78 0 0 0 1.46 6.42 29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58A2.78 2.78 0 0 0 3.41 19.6C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-1.95A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z M9.75 15.02l5.75-3.02-5.75-3.02v6.04z' },
    ];
    body = `
      <div class="ap-info-banner" style="margin-bottom:16px">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        All social media fields are optional.
      </div>
      ${socialFields.map(sf => `
        <div class="ap-social-row ${p[sf.key] ? 'filled' : ''}">
          <div class="ap-social-icon" style="color:${sf.color}">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="${sf.icon}"/></svg>
          </div>
          <div class="field" style="margin:0;flex:1">
            <label>${esc(sf.label)}</label>
            <input id="ap-${esc(sf.key)}" data-ap="${esc(sf.key)}" type="url" placeholder="${esc(sf.placeholder)}" value="${esc(p[sf.key] || '')}" />
          </div>
        </div>`).join('')}`;

    // Append review summary on last step
    const reviewName = [p.first_name, p.middle_name, p.last_name].filter(Boolean).join(' ') || '—';
    const reviewAddr = [p.permanent_sahi, p.permanent_district, p.permanent_state].filter(Boolean).join(', ') || '—';
    const reviewDocs = p.id_documents || [];
    const reviewOccs = p.occupations || [];
    body += `
      ${apSection('Review Summary')}
      <div class="ap-review">
        <div class="detail-card" style="margin-bottom:12px">
          ${detailRow('Name', reviewName)}
          ${p.alias_name ? detailRow('Alias', p.alias_name) : ''}
          ${p.date_of_birth ? detailRow('Date of Birth', fmtDate(p.date_of_birth)) : ''}
          ${p.gender ? detailRow('Gender', p.gender) : ''}
          ${p.blood_group ? detailRow('Blood Group', p.blood_group) : ''}
          ${p.is_bhagari === true || p.is_bhagari === 'true' ? detailRow('Bhagari', 'Yes') : ''}
          ${p.is_baristha_bhai_pua === true || p.is_baristha_bhai_pua === 'true' ? detailRow('Baristha Bhai Pua', 'Yes') : ''}
        </div>
        <div class="detail-card" style="margin-bottom:12px">
          ${p.phone ? detailRow('Phone', '+' + p.phone) : detailRow('Phone', '—')}
          ${p.whatsapp_number ? detailRow('WhatsApp', '+' + p.whatsapp_number) : ''}
          ${p.email ? detailRow('Email', p.email) : ''}
          ${reviewDocs.length > 0 ? detailRow('ID Documents', reviewDocs.map(d => d.id_type).filter(Boolean).join(', ')) : ''}
        </div>
        <div class="detail-card" style="margin-bottom:12px">
          ${p.father_name ? detailRow('Father', p.father_name + (p.father_sebayat_id ? ' (linked)' : '')) : ''}
          ${p.mother_name ? detailRow('Mother', p.mother_name) : ''}
          ${p.marital_status ? detailRow('Marital Status', p.marital_status) : ''}
          ${p.spouse_name ? detailRow('Spouse', p.spouse_name) : ''}
        </div>
        <div class="detail-card" style="margin-bottom:12px">
          ${detailRow('Permanent Address', reviewAddr)}
        </div>
        ${reviewOccs.length > 0 ? `<div class="detail-card" style="margin-bottom:12px">
          ${detailRow('Occupations', reviewOccs.map(o => o.occupation).filter(Boolean).join(', '))}
        </div>` : ''}
      </div>
      <div class="ap-save-note">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        The profile will be saved as <strong>Draft</strong>. You can submit or approve it from the Applications view.
      </div>`;
  }

  return `
    <div class="page-header">
      <div>
        <h1>Add Profile</h1>
        <p>Create a sebayat profile on their behalf. Fill in each section and save.</p>
      </div>
    </div>

    <div class="ap-wizard">
      <div class="ap-steps">
        ${stepsHtml}
      </div>

      <div class="ap-card">
        <div class="ap-card-header">
          <div class="ap-card-title">${esc(ADD_PROFILE_STEPS[step].title)}</div>
          <div class="ap-card-sub">${esc(ADD_PROFILE_STEPS[step].sub)}</div>
        </div>
        <div class="ap-card-body">
          ${body}
        </div>
        <div class="ap-card-footer">
          <div class="ap-footer-left">
            ${step > 0 ? `<button class="btn btn-ghost" id="ap-back-btn">Back</button>` : `<button class="btn btn-ghost" onclick="actions.go('overview')">Cancel</button>`}
          </div>
          <div class="ap-footer-right">
            <span class="ap-step-counter">Step ${step + 1} of ${ADD_PROFILE_STEPS.length}</span>
            ${isLast
              ? `<button class="btn btn-primary" id="ap-save-btn">Save Profile</button>`
              : `<button class="btn btn-primary" id="ap-next-btn">Next &rarr;</button>`}
          </div>
        </div>
      </div>
    </div>
  `;
}

// Inline field validation helpers
function apSetError(id, msg) {
  const wrap = document.getElementById(`ap-wrap-${id}`);
  const errEl = document.getElementById(`ap-err-${id}`);
  const input = document.getElementById(`ap-${id}`);
  if (wrap) wrap.classList.add('ap-field-invalid');
  if (input) input.classList.add('ap-input-error');
  if (errEl) errEl.textContent = msg;
}
function apClearError(id) {
  const wrap = document.getElementById(`ap-wrap-${id}`);
  const errEl = document.getElementById(`ap-err-${id}`);
  const input = document.getElementById(`ap-${id}`);
  if (wrap) wrap.classList.remove('ap-field-invalid');
  if (input) input.classList.remove('ap-input-error');
  if (errEl) errEl.textContent = '';
}
function apValidateField(id, value) {
  const v = typeof value === 'string' ? value.trim() : (value || '');
  switch (id) {
    case 'first_name': if (!v) { apSetError(id, 'First Name is required'); return false; } break;
    case 'last_name':  if (!v) { apSetError(id, 'Last Name is required'); return false; } break;
    case 'date_of_birth': if (!v) { apSetError(id, 'Date of Birth is required'); return false; } break;
    case 'health_card_no':
      if (!v) { apSetError(id, 'Health Card Number is required'); return false; }
      if (!/^\d{8}$/.test(v)) { apSetError(id, 'Must be exactly 8 digits'); return false; }
      break;
    case 'phone':
      if (!v) { apSetError(id, 'Phone Number is required'); return false; }
      if (!/^\d{10}$/.test(v)) { apSetError(id, 'Must be exactly 10 digits'); return false; }
      break;
    case 'whatsapp_number':
      if (v && !/^\d{10}$/.test(v)) { apSetError(id, 'Must be exactly 10 digits'); return false; }
      break;
    case 'email':
      if (v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) { apSetError(id, 'Enter a valid email address'); return false; }
      break;
    case 'mother_name': if (!v) { apSetError(id, "Mother's Full Name is required"); return false; } break;
    case 'spouse_name': if (state.newProfile.marital_status === 'Married' && !v) { apSetError(id, 'Spouse Name is required'); return false; } break;
    case 'spouse_father_name': if (state.newProfile.marital_status === 'Married' && !v) { apSetError(id, "Spouse's Father Name is required"); return false; } break;
    case 'spouse_mother_name': if (state.newProfile.marital_status === 'Married' && !v) { apSetError(id, "Spouse's Mother Name is required"); return false; } break;
    case 'permanent_sahi':          if (!v) { apSetError(id, 'Sahi / Mohalla is required'); return false; } break;
    case 'permanent_landmark':      if (!v) { apSetError(id, 'Landmark is required'); return false; } break;
    case 'permanent_post_office':   if (!v) { apSetError(id, 'Post Office is required'); return false; } break;
    case 'permanent_police_station':if (!v) { apSetError(id, 'Police Station is required'); return false; } break;
    case 'permanent_pincode':
      if (!v) { apSetError(id, 'Pincode is required'); return false; }
      if (!/^\d{6}$/.test(v)) { apSetError(id, 'Must be exactly 6 digits'); return false; }
      break;
    case 'permanent_district': if (!v) { apSetError(id, 'District is required'); return false; } break;
    case 'permanent_state':    if (!v) { apSetError(id, 'State is required'); return false; } break;
    case 'joining_date': if (!v && state.newProfile.joining_date_exact !== false) { apSetError(id, 'Joining Date is required'); return false; } break;
    case 'joining_year': if (!v && state.newProfile.joining_date_exact === false) { apSetError(id, 'Joining Year is required'); return false; } break;
  }
  apClearError(id);
  return true;
}

function attachAddProfileHandlers() {
  function collectFields() {
    // Regular inputs/selects/textareas
    $$('[data-ap]').forEach(el => {
      const key = el.dataset.ap;
      state.newProfile[key] = el.value;
    });
    // Toggles
    $$('[data-ap-toggle]').forEach(el => {
      state.newProfile[el.dataset.apToggle] = el.checked;
    });
    // Bhagari/Baristha radio
    const bhagariRadio = document.querySelector('input[name="bhagari_type"]:checked');
    if (bhagariRadio) {
      const val = bhagariRadio.value;
      state.newProfile.is_bhagari = val === 'bhagari';
      state.newProfile.is_baristha_bhai_pua = val === 'baristha';
      state.newProfile._bhagari_selected = true;
    }
    // Extra phones
    const phoneCells = $$('.ap-extra-phone');
    if (phoneCells.length > 0) {
      state.newProfile.extra_phones = phoneCells.map(el => el.value.trim()).filter(Boolean);
    }
    // Occupation fields
    $$('.ap-occ-field').forEach(el => {
      const idx = parseInt(el.dataset.occIdx);
      const field = el.dataset.occField;
      if (!state.newProfile.occupations) state.newProfile.occupations = [];
      if (!state.newProfile.occupations[idx]) state.newProfile.occupations[idx] = {};
      state.newProfile.occupations[idx][field] = el.value;
    });
    // Child fields
    $$('.ap-child-field').forEach(el => {
      const idx = parseInt(el.dataset.childIdx);
      const field = el.dataset.childField;
      if (!state.newProfile.children) state.newProfile.children = [];
      if (!state.newProfile.children[idx]) state.newProfile.children[idx] = {};
      state.newProfile.children[idx][field] = el.value;
    });
    // ID doc types
    $$('.ap-doc-type').forEach(el => {
      const idx = parseInt(el.dataset.docIdx);
      if (!state.newProfile.id_documents) state.newProfile.id_documents = [];
      if (!state.newProfile.id_documents[idx]) state.newProfile.id_documents[idx] = {};
      state.newProfile.id_documents[idx].id_type = el.value;
    });
  }

  // Digits-only enforcement: strip non-digits as user types
  $$('[data-digits-only="true"]').forEach(input => {
    input.oninput = (e) => {
      const pos = input.selectionStart;
      const cleaned = input.value.replace(/\D/g, '');
      if (input.value !== cleaned) {
        input.value = cleaned;
        try { input.setSelectionRange(pos - 1, pos - 1); } catch(_) {}
      }
      // Live validation feedback
      const id = input.dataset.ap;
      if (id) apValidateField(id, cleaned);
    };
  });

  // Blur validation on all required [data-ap] fields
  $$('[data-ap]').forEach(el => {
    el.addEventListener('blur', () => {
      apValidateField(el.dataset.ap, el.value);
    });
    // Clear error as soon as user starts typing (for non-digit fields)
    if (!el.dataset.digitsOnly) {
      el.addEventListener('input', () => {
        if (el.value.trim()) apClearError(el.dataset.ap);
      });
    }
  });

  // Back button
  const backBtn = $('#ap-back-btn');
  if (backBtn) backBtn.onclick = () => { collectFields(); state.addProfileStep--; render(); };

  // Cancel
  const cancelBtn = document.querySelector('[onclick="actions.go(\'overview\')"]');

  // Next button
  const nextBtn = $('#ap-next-btn');
  if (nextBtn) nextBtn.onclick = () => {
    collectFields();
    const step = state.addProfileStep;
    const np = state.newProfile;
    if (step === 0) {
      if (!np.first_name?.trim()) { showToast('First Name is required', 'error'); return; }
      if (!np.last_name?.trim()) { showToast('Last Name is required', 'error'); return; }
      if (!np.date_of_birth) { showToast('Date of Birth is required', 'error'); return; }
      if (!np.gender) { showToast('Gender is required', 'error'); return; }
      if (!np._bhagari_selected && np.is_bhagari !== true && np.is_bhagari !== 'true' && np.is_baristha_bhai_pua !== true && np.is_baristha_bhai_pua !== 'true') {
        showToast('Please select Bhagari, Baristha Bhai Pua, or Neither', 'error'); return;
      }
      if (!np.health_card_no?.trim()) { showToast('Health Card Number is required', 'error'); return; }
      if (!/^\d{8}$/.test(np.health_card_no?.trim())) { showToast('Health Card Number must be exactly 8 digits', 'error'); return; }
    }
    if (step === 1) {
      if (!np.phone?.trim()) { showToast('Phone Number is required', 'error'); return; }
      if (!/^\d{10}$/.test(np.phone?.trim())) { showToast('Phone Number must be exactly 10 digits', 'error'); return; }
      if (np.whatsapp_number?.trim() && !/^\d{10}$/.test(np.whatsapp_number.trim())) { showToast('WhatsApp Number must be exactly 10 digits', 'error'); return; }
      if (np.email?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(np.email.trim())) { showToast('Enter a valid email address', 'error'); return; }
      const hasDoc = (np.id_documents || []).some(d => d.id_type);
      if (!hasDoc) { showToast('At least one Identity Card must be selected', 'error'); return; }
    }
    if (step === 2) {
      const totalSel = Object.values(np.sebaSelections || {}).reduce((s, arr) => s + arr.length, 0);
      if (totalSel === 0) { showToast('Please select at least one Seba beddha', 'error'); return; }
    }
    if (step === 3) {
      if (!np.father_name?.trim()) { showToast("Father's Name is required", 'error'); return; }
      if (!np.mother_name?.trim()) { showToast("Mother's Full Name is required", 'error'); return; }
      if (!np.marital_status) { showToast('Marital Status is required', 'error'); return; }
      if (np.marital_status === 'Married') {
        if (!np.spouse_name?.trim()) { showToast("Spouse Name is required for married status", 'error'); return; }
        if (!np.spouse_father_name?.trim()) { showToast("Spouse's Father Name is required for married status", 'error'); return; }
        if (!np.spouse_mother_name?.trim()) { showToast("Spouse's Mother Name is required for married status", 'error'); return; }
      }
    }
    if (step === 4) {
      if (!np.permanent_sahi?.trim()) { showToast('Sahi / Mohalla is required', 'error'); return; }
      if (!np.permanent_landmark?.trim()) { showToast('Landmark is required', 'error'); return; }
      if (!np.permanent_post_office?.trim()) { showToast('Post Office is required', 'error'); return; }
      if (!np.permanent_police_station?.trim()) { showToast('Police Station is required', 'error'); return; }
      if (!np.permanent_pincode?.trim()) { showToast('Pincode is required', 'error'); return; }
      if (!/^\d{6}$/.test(np.permanent_pincode?.trim())) { showToast('Pincode must be exactly 6 digits', 'error'); return; }
      if (!np.permanent_district?.trim()) { showToast('District is required', 'error'); return; }
      if (!np.permanent_state?.trim()) { showToast('State is required', 'error'); return; }
    }
    if (step === 5) {
      const exactDate = np.joining_date_exact !== false && np.joining_date_exact !== 'false';
      if (exactDate && !np.joining_date) { showToast('Joining Date is required', 'error'); return; }
      if (!exactDate && !np.joining_year) { showToast('Joining Year is required', 'error'); return; }
    }
    state.addProfileStep++;
    render();
  };

  // Bhagari/Baristha radio buttons
  $$('.ap-bhagari-radio').forEach(radio => {
    radio.onchange = () => {
      collectFields();
      render();
    };
  });

  // Chip buttons (gender, marital_status)
  $$('[data-ap-chip]').forEach(btn => {
    btn.onclick = () => {
      collectFields();
      state.newProfile[btn.dataset.apChip] = btn.dataset.val;
      render();
    };
  });

  // Child chip buttons
  $$('[data-child-chip]').forEach(btn => {
    btn.onclick = () => {
      collectFields();
      const idx = parseInt(btn.dataset.childChip);
      if (!state.newProfile.children) state.newProfile.children = [];
      if (!state.newProfile.children[idx]) state.newProfile.children[idx] = {};
      state.newProfile.children[idx][btn.dataset.childField] = btn.dataset.val;
      render();
    };
  });

  // Current address toggle
  const hasCurrentChk = $('#ap-has-current');
  if (hasCurrentChk) hasCurrentChk.onchange = () => {
    collectFields();
    state.newProfile.is_permanent_different = hasCurrentChk.checked;
    render();
  };

  // Joining exact toggle
  const joiningExact = $('#ap-joining-exact');
  if (joiningExact) joiningExact.onchange = () => {
    collectFields();
    state.newProfile.joining_date_exact = joiningExact.checked;
    render();
  };

  // Add extra phone
  const addPhoneBtn = $('#ap-add-phone');
  if (addPhoneBtn) addPhoneBtn.onclick = () => {
    collectFields();
    if (!state.newProfile.extra_phones) state.newProfile.extra_phones = [];
    state.newProfile.extra_phones.push('');
    render();
  };

  // Delete extra phone
  $$('[data-del-phone]').forEach(btn => {
    btn.onclick = () => {
      collectFields();
      const idx = parseInt(btn.dataset.delPhone);
      state.newProfile.extra_phones.splice(idx, 1);
      render();
    };
  });

  // Add ID document
  const addDocBtn = $('#ap-add-doc');
  if (addDocBtn) addDocBtn.onclick = () => {
    collectFields();
    if (!state.newProfile.id_documents) state.newProfile.id_documents = [];
    state.newProfile.id_documents.push({ id_type: '', photo_url: '' });
    render();
  };

  // Delete ID document
  $$('[data-del-doc]').forEach(btn => {
    btn.onclick = () => {
      collectFields();
      const idx = parseInt(btn.dataset.delDoc);
      state.newProfile.id_documents.splice(idx, 1);
      render();
    };
  });

  // ID doc photo upload buttons
  $$('.ap-doc-photo-btn').forEach(btn => {
    btn.onclick = () => {
      const idx = btn.dataset.docIdx;
      $(`#ap-doc-photo-${idx}`)?.click();
    };
  });
  $$('.ap-doc-photo-input').forEach(input => {
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const idx = parseInt(input.dataset.docIdx);
      const ext = file.name.split('.').pop() || 'jpg';
      const tempId = state.newProfile._tempId || ('new-' + Date.now());
      state.newProfile._tempId = tempId;
      const path = `${tempId}/id-doc-${idx}-${Date.now()}.${ext}`;
      showToast('Uploading document photo…', 'info');
      const { error: upErr } = await db.storage.from('profile-photos').upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) { showToast('Upload failed: ' + upErr.message, 'error'); return; }
      const { data: urlData } = db.storage.from('profile-photos').getPublicUrl(path);
      if (!state.newProfile.id_documents) state.newProfile.id_documents = [];
      if (!state.newProfile.id_documents[idx]) state.newProfile.id_documents[idx] = {};
      state.newProfile.id_documents[idx].photo_url = urlData.publicUrl;
      showToast('Document photo uploaded', 'success');
      render();
    };
  });

  // Add child
  const addChildBtn = $('#ap-add-child');
  if (addChildBtn) addChildBtn.onclick = () => {
    collectFields();
    if (!state.newProfile.children) state.newProfile.children = [];
    state.newProfile.children.push({ child_name: '', gender: '', marital_status: '' });
    render();
  };

  // Delete child
  $$('[data-del-child]').forEach(btn => {
    btn.onclick = () => {
      collectFields();
      const idx = parseInt(btn.dataset.delChild);
      state.newProfile.children.splice(idx, 1);
      render();
    };
  });

  // Add occupation
  const addOccBtn = $('#ap-add-occ');
  if (addOccBtn) addOccBtn.onclick = () => {
    collectFields();
    if (!state.newProfile.occupations) state.newProfile.occupations = [];
    state.newProfile.occupations.push({ occupation: '', extra_curriculum_activity: '' });
    render();
  };

  // Delete occupation
  $$('[data-del-occ]').forEach(btn => {
    btn.onclick = () => {
      collectFields();
      const idx = parseInt(btn.dataset.delOcc);
      state.newProfile.occupations.splice(idx, 1);
      render();
    };
  });

  // Father search
  const fatherSearchInput = $('#ap-father-search-input');
  if (fatherSearchInput) {
    fatherSearchInput.oninput = async () => {
      const q = fatherSearchInput.value.trim();
      state.newProfile.father_name = q;
      if (q.length < 2) { state.fatherSearchResults = []; render(); return; }
      state.fatherSearching = true;
      render();
      const { data } = await db.from('sebayats').select('id,first_name,middle_name,last_name,full_name,date_of_birth,bansa_name').or(`full_name.ilike.%${q}%,first_name.ilike.%${q}%,last_name.ilike.%${q}%`).in('profile_status', ['submitted','resubmitted','approved']).limit(20);
      state.fatherSearching = false;
      state.fatherSearchResults = data || [];
      render();
      const newInput = $('#ap-father-search-input');
      if (newInput) { newInput.value = q; newInput.focus(); newInput.setSelectionRange(q.length, q.length); }
    };
  }

  $$('.ap-father-result').forEach(el => {
    el.onclick = () => {
      state.newProfile.father_name = el.dataset.name;
      state.newProfile.father_sebayat_id = el.dataset.id;
      state.fatherSearchResults = [];
      state.fatherSearching = false;
      render();
    };
  });

  const fatherClear = $('#ap-father-clear');
  if (fatherClear) fatherClear.onclick = () => {
    state.newProfile.father_name = '';
    state.newProfile.father_sebayat_id = '';
    state.fatherSearchResults = [];
    render();
  };

  const fatherSwitchManual = $('#ap-father-switch-manual');
  if (fatherSwitchManual) fatherSwitchManual.onclick = () => {
    state.newProfile.father_manual = 'yes';
    state.newProfile.father_sebayat_id = '';
    state.fatherSearchResults = [];
    render();
  };

  const fatherSwitchSearch = $('#ap-father-switch-search');
  if (fatherSwitchSearch) fatherSwitchSearch.onclick = () => {
    state.newProfile.father_manual = 'no';
    state.fatherSearchResults = [];
    render();
  };

  // Save button
  const saveBtn = $('#ap-save-btn');
  if (saveBtn) {
    saveBtn.onclick = async () => {
      collectFields();
      const p = state.newProfile;
      if (!p.first_name?.trim()) { showToast('First Name is required', 'error'); return; }
      if (!p.last_name?.trim()) { showToast('Last Name is required', 'error'); return; }
      if (!p.date_of_birth) { showToast('Date of Birth is required', 'error'); return; }
      if (!p.gender) { showToast('Gender is required', 'error'); return; }
      if (!p.health_card_no?.trim() || !/^\d{8}$/.test(p.health_card_no.trim())) { showToast('Health Card Number must be 8 digits', 'error'); return; }
      if (!p.phone?.trim() || !/^\d{10}$/.test(p.phone.trim())) { showToast('Phone Number must be exactly 10 digits', 'error'); return; }
      if (p.whatsapp_number?.trim() && !/^\d{10}$/.test(p.whatsapp_number.trim())) { showToast('WhatsApp Number must be exactly 10 digits', 'error'); return; }
      if (p.email?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email.trim())) { showToast('Enter a valid email address', 'error'); return; }
      if (!(p.id_documents || []).some(d => d.id_type)) { showToast('At least one Identity Card is required', 'error'); return; }
      if (!p.father_name?.trim()) { showToast("Father's Name is required", 'error'); return; }
      if (!p.mother_name?.trim()) { showToast("Mother's Full Name is required", 'error'); return; }
      if (!p.marital_status) { showToast('Marital Status is required', 'error'); return; }
      if (p.marital_status === 'Married') {
        if (!p.spouse_name?.trim()) { showToast('Spouse Name is required', 'error'); return; }
        if (!p.spouse_father_name?.trim()) { showToast("Spouse's Father Name is required", 'error'); return; }
        if (!p.spouse_mother_name?.trim()) { showToast("Spouse's Mother Name is required", 'error'); return; }
      }
      if (!p.permanent_sahi?.trim()) { showToast('Sahi / Mohalla is required', 'error'); return; }
      if (!p.permanent_landmark?.trim()) { showToast('Landmark is required', 'error'); return; }
      if (!p.permanent_post_office?.trim()) { showToast('Post Office is required', 'error'); return; }
      if (!p.permanent_police_station?.trim()) { showToast('Police Station is required', 'error'); return; }
      if (!p.permanent_pincode?.trim() || !/^\d{6}$/.test(p.permanent_pincode.trim())) { showToast('Pincode must be 6 digits', 'error'); return; }
      if (!p.permanent_district?.trim()) { showToast('District is required', 'error'); return; }
      if (!p.permanent_state?.trim()) { showToast('State is required', 'error'); return; }
      const exactDate = p.joining_date_exact !== false && p.joining_date_exact !== 'false';
      if (exactDate && !p.joining_date) { showToast('Joining Date is required', 'error'); return; }
      if (!exactDate && !p.joining_year) { showToast('Joining Year is required', 'error'); return; }

      saveBtn.disabled = true; saveBtn.innerHTML = '<span class="spinner"></span>';

      const full_name = [p.first_name, p.middle_name, p.last_name].filter(Boolean).join(' ');
      const toBool = v => v === true || v === 'true' ? true : v === false || v === 'false' ? false : null;
      const toNull = v => (v == null || v === '') ? null : v;

      const sebayatPayload = {
        first_name: toNull(p.first_name), middle_name: toNull(p.middle_name), last_name: toNull(p.last_name),
        full_name, alias_name: toNull(p.alias_name),
        date_of_birth: toNull(p.date_of_birth), gender: toNull(p.gender),
        blood_group: toNull(p.blood_group), health_card_no: toNull(p.health_card_no),
        is_bhagari: toBool(p.is_bhagari), is_baristha_bhai_pua: toBool(p.is_baristha_bhai_pua),
        phone: toNull(p.phone), whatsapp_number: toNull(p.whatsapp_number), email: toNull(p.email),
        extra_phones: (p.extra_phones || []).filter(Boolean),
        father_name: toNull(p.father_name), father_sebayat_id: toNull(p.father_sebayat_id) || null,
        mother_name: toNull(p.mother_name), marital_status: toNull(p.marital_status),
        spouse_name: toNull(p.spouse_name), spouse_father_name: toNull(p.spouse_father_name), spouse_mother_name: toNull(p.spouse_mother_name),
        children: (p.children || []).filter(c => c.child_name),
        permanent_sahi: toNull(p.permanent_sahi), permanent_landmark: toNull(p.permanent_landmark),
        permanent_post_office: toNull(p.permanent_post_office), permanent_police_station: toNull(p.permanent_police_station),
        permanent_pincode: toNull(p.permanent_pincode), permanent_district: toNull(p.permanent_district),
        permanent_state: toNull(p.permanent_state), permanent_country: toNull(p.permanent_country),
        permanent_address_text: toNull(p.permanent_address_text),
        is_permanent_different: toBool(p.is_permanent_different) || false,
        current_sahi: toBool(p.is_permanent_different) ? toNull(p.current_sahi) : null,
        current_landmark: toBool(p.is_permanent_different) ? toNull(p.current_landmark) : null,
        current_post_office: toBool(p.is_permanent_different) ? toNull(p.current_post_office) : null,
        current_police_station: toBool(p.is_permanent_different) ? toNull(p.current_police_station) : null,
        current_pincode: toBool(p.is_permanent_different) ? toNull(p.current_pincode) : null,
        current_district: toBool(p.is_permanent_different) ? toNull(p.current_district) : null,
        current_state: toBool(p.is_permanent_different) ? toNull(p.current_state) : null,
        current_country: toBool(p.is_permanent_different) ? toNull(p.current_country) : null,
        current_address_text: toBool(p.is_permanent_different) ? toNull(p.current_address_text) : null,
        joining_date_exact: toBool(p.joining_date_exact) !== false,
        joining_date: toNull(p.joining_date), joining_year: toNull(p.joining_year),
        occupations: (p.occupations || []).filter(o => o.occupation),
        social_facebook: toNull(p.social_facebook), social_twitter: toNull(p.social_twitter),
        social_instagram: toNull(p.social_instagram), social_linkedin: toNull(p.social_linkedin),
        social_youtube: toNull(p.social_youtube),
        bansa_name: toNull(p.bansa_name), palia_number: toNull(p.palia_number), seba_name: toNull(p.seba_name),
        profile_status: 'submitted', created_by_admin: state.user?.id || null,
      };

      const { data, error } = await db.from('sebayats').insert(sebayatPayload).select().maybeSingle();
      if (error) { saveBtn.disabled = false; saveBtn.textContent = 'Save Profile'; showToast('Failed: ' + error.message, 'error'); return; }

      // Save identity documents separately
      const docs = (p.id_documents || []).filter(d => d.id_type);
      if (data?.id && docs.length > 0) {
        const docRows = docs.map(d => ({ sebayat_id: data.id, id_type: d.id_type, photo_url: d.photo_url || null }));
        await db.from('identity_documents').insert(docRows);
      }

      // Save seba selections
      if (data?.id) {
        const sebaSelections = p.sebaSelections || {};
        const sebaRows = [];
        for (const [catId, nums] of Object.entries(sebaSelections)) {
          for (const num of (nums || [])) {
            sebaRows.push({ sebayat_id: data.id, seba_category_id: catId, beddha_number: num });
          }
        }
        if (sebaRows.length > 0) await db.from('sebayat_seba_selections').insert(sebaRows);
        await db.rpc('regenerate_roster_for_sebayat', { p_sebayat_id: data.id });
      }

      // Notify admins of new registration
      if (data?.id) {
        const name = [p.first_name, p.last_name].filter(Boolean).join(' ') || p.mobile_primary || '';
        dispatchNotification('registration_submitted', data.id, {
          name,
          phone: p.mobile_primary || '',
          reference_type: 'sebayat',
          reference_id: data.id,
        }, 'admin');
      }

      showToast('Profile created successfully', 'success');
      state.newProfile = {}; state.addProfileStep = 0; state.fatherSearchResults = []; state.fatherSearching = false;
      await loadAll();
      state.view = 'applications'; state.filter = 'all'; render();
      if (data?.id) actions.openSebayat(data.id);
    };
  }
}

// ============================================================
// SEBA BEDDHA TOGGLE (Add Profile wizard)
// ============================================================
function apToggleSebaCard(catId) {
  if (!state.apSebaExpanded) state.apSebaExpanded = {};
  state.apSebaExpanded[catId] = !state.apSebaExpanded[catId];
  const body = document.getElementById(`ap-seba-body-${catId}`);
  const chev = document.getElementById(`ap-seba-chev-${catId}`);
  if (body) body.style.display = state.apSebaExpanded[catId] ? 'block' : 'none';
  if (chev) chev.style.transform = `rotate(${state.apSebaExpanded[catId] ? '90deg' : '0deg'})`;
}

function apToggleBeddha(catId, num) {
  if (!state.newProfile.sebaSelections) state.newProfile.sebaSelections = {};
  const current = state.newProfile.sebaSelections[catId] || [];
  const idx = current.indexOf(num);
  if (idx >= 0) {
    state.newProfile.sebaSelections[catId] = current.filter(n => n !== num);
  } else {
    state.newProfile.sebaSelections[catId] = [...current, num];
  }
  // Update pill without full re-render
  const pill = document.querySelector(`.ap-beddha[data-cat="${CSS.escape(catId)}"][data-num="${num}"]`);
  if (pill) pill.classList.toggle('ap-beddha--selected', state.newProfile.sebaSelections[catId].includes(num));
  // Update selected count badge (visible even when card is collapsed)
  const card = document.getElementById(`ap-seba-card-${catId}`);
  if (card) {
    const selCount = (state.newProfile.sebaSelections[catId] || []).length;
    let selBadge = card.querySelector('.ap-seba-sel-badge');
    if (selCount > 0) {
      if (!selBadge) {
        selBadge = document.createElement('span');
        selBadge.className = 'ap-seba-sel-badge';
        card.querySelector('.ap-seba-cat-header > div').prepend(selBadge);
      }
      selBadge.textContent = `${selCount} selected`;
    } else if (selBadge) {
      selBadge.remove();
    }
  }
  // Update total badge
  const totalSel = Object.values(state.newProfile.sebaSelections).reduce((s, arr) => s + (arr || []).length, 0);
  let totalBadge = document.querySelector('.ap-seba-total-badge');
  if (totalSel > 0) {
    if (!totalBadge) {
      totalBadge = document.createElement('div');
      totalBadge.className = 'ap-seba-total-badge';
      document.querySelector('.ap-seba-cat-card')?.before(totalBadge);
    }
    totalBadge.textContent = `${totalSel} beddha${totalSel !== 1 ? 's' : ''} selected across all sebas`;
  } else if (totalBadge) {
    totalBadge.remove();
  }
}

// ============================================================
// SEBA ASSIGN PAGE
// ============================================================
function renderSebaAssign() {
  const visibleCats = (state.sebaCategories || []).filter(c => c.is_active && c.category_type === 'seba');
  const p = state.saSelectedSebayat;

  // Year selector row
  const currentYear = new Date().getFullYear();
  const yearOptions = [currentYear - 1, currentYear, currentYear + 1].map(y =>
    `<option value="${y}" ${state.saYear === y ? 'selected' : ''}>${y}</option>`
  ).join('');

  // Search panel — results injected via saRenderResults() to avoid focus loss
  const searchPanel = `
    <div class="sa-search-panel">
      <div class="sa-search-row">
        <div class="sa-search-wrap">
          <svg class="sa-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input id="sa-search-input" class="sa-search-input" type="text" placeholder="Search by name, registration no., phone…" autocomplete="off" />
          <button class="sa-search-clear" id="sa-search-clear" title="Clear" style="display:none">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div class="sa-year-wrap">
          <label class="sa-year-label">Year</label>
          <select id="sa-year-select" class="sa-year-select">${yearOptions}</select>
        </div>
      </div>
      <div id="sa-results-container"></div>
    </div>`;

  // Right panel: assignment
  let rightPanel = '';
  if (!p) {
    rightPanel = `
      <div class="sa-right-empty">
        <div class="sa-right-empty-icon">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/><path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/></svg>
        </div>
        <div class="sa-right-empty-title">Select a Sebayat</div>
        <div class="sa-right-empty-sub">Search and select a sebayat above to assign their Nijog seba for ${state.saYear}.</div>
      </div>`;
  } else {
    const totalAssigned = Object.values(state.saAssignments).reduce((s, set) => s + set.size, 0);

    const catRows = visibleCats.map(cat => {
      const beddhaTypes = state.sebaBeddhas[cat.id] || {};
      const count = cat.beddha_count || 0;
      const nijogNums = Object.entries(beddhaTypes)
        .filter(([, t]) => t === 'nijog_assigned')
        .map(([n]) => parseInt(n));
      if (nijogNums.length === 0) return '';

      const assigned = state.saAssignments[cat.id] || new Set();
      const selCount = assigned.size;
      const isOpen = !!state.saExpanded[cat.id];

      const pills = nijogNums.sort((a, b) => a - b).map(num => {
        const isSel = assigned.has(num);
        return `<button class="sa-beddha${isSel ? ' sa-beddha--sel' : ''}" data-cat="${esc(cat.id)}" data-num="${num}" onclick="saToggleBeddha('${esc(cat.id)}',${num})">${num}</button>`;
      }).join('');

      return `
        <div class="sa-cat-card">
          <button class="sa-cat-header" onclick="saToggleCat('${esc(cat.id)}')">
            <div class="sa-cat-left">
              <svg class="sa-cat-chev ${isOpen ? 'sa-cat-chev--open' : ''}" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
              <span class="sa-cat-name">${esc(cat.name)}</span>
            </div>
            <div class="sa-cat-badges">
              ${selCount > 0 ? `<span class="sa-sel-badge">${selCount} assigned</span>` : ''}
              <span class="sa-nijog-badge">${nijogNums.length} nijog beddha${nijogNums.length !== 1 ? 's' : ''}</span>
            </div>
          </button>
          ${isOpen ? `<div class="sa-beddha-grid">${pills}</div>` : ''}
        </div>`;
    }).filter(Boolean).join('');

    const hasCats = catRows.length > 0;

    rightPanel = `
      <div class="sa-right-header">
        <div class="sa-sebayat-card">
          <div class="sa-sebayat-avatar">${p.photo_url ? `<img src="${esc(p.photo_url)}" alt="" />` : `<span>${esc((p.full_name || p.first_name || '?')[0].toUpperCase())}</span>`}</div>
          <div class="sa-sebayat-info">
            <div class="sa-sebayat-name">${esc(p.full_name || [p.first_name, p.last_name].filter(Boolean).join(' ') || '—')}</div>
            <div class="sa-sebayat-meta">
              ${p.registration_no ? `<span>Reg: ${esc(p.registration_no)}</span>` : ''}
              ${p.seba_name ? `<span>${esc(p.seba_name)}</span>` : ''}
              ${p.bansa_name ? `<span>${esc(p.bansa_name)}</span>` : ''}
            </div>
          </div>
          <div class="sa-year-chip">${state.saYear}</div>
        </div>

        ${totalAssigned > 0 ? `
        <div class="sa-assign-summary">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg>
          ${totalAssigned} beddha${totalAssigned !== 1 ? 's' : ''} assigned across all sebas
        </div>` : ''}
      </div>

      ${state.saLoading ? `<div class="sa-loading"><div class="sa-spinner"></div> Loading existing assignments…</div>` : ''}

      ${!state.saLoading && !hasCats ? `
        <div class="sa-no-nijog">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <p>No nijog-assigned beddhas are configured in any seba category.<br>Go to <strong>Seba Categories</strong> to mark beddhas as Nijog Assigned first.</p>
        </div>` : ''}

      ${!state.saLoading && hasCats ? `
        <div class="sa-cats">${catRows}</div>

        <div class="sa-footer">
          <button class="btn btn-ghost sa-clear-btn" onclick="saClearAll()" ${totalAssigned === 0 ? 'disabled' : ''}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            Clear All
          </button>
          <button class="btn btn-primary sa-save-btn" id="sa-save-btn" onclick="saSaveAssignments()">
            ${state.saSaving ? `<span class="sa-spinner sa-spinner--sm sa-spinner--white"></span> Saving…` : `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
            Save Assignments`}
          </button>
        </div>` : ''}`;
  }

  return `
    <div class="sa-page">
      <div class="sa-page-header">
        <div>
          <h1 class="sa-page-title">Seba Assign</h1>
          <p class="sa-page-sub">Assign Nijog-administered seba beddhas to sebayats for a specific year.</p>
        </div>
      </div>
      <div class="sa-layout">
        <div class="sa-left">${searchPanel}</div>
        <div class="sa-right">${rightPanel}</div>
      </div>
    </div>`;
}

function attachSebaAssignHandlers() {
  const inp = $('#sa-search-input');
  if (inp) {
    inp.oninput = (e) => {
      state.saSearchQ = e.target.value;
      saDoSearch();
    };
    inp.onkeydown = (e) => {
      if (e.key === 'Escape') { saClearSearch(); }
    };
  }
  const clr = $('#sa-search-clear');
  if (clr) clr.onclick = () => saClearSearch();

  const yrSel = $('#sa-year-select');
  if (yrSel) yrSel.onchange = (e) => {
    state.saYear = parseInt(e.target.value);
    if (state.saSelectedSebayat) saLoadAssignments(state.saSelectedSebayat.id);
  };
}

function saClearSearch() {
  state.saSearchQ = '';
  state.saSearchResults = [];
  const inp = $('#sa-search-input');
  if (inp) inp.value = '';
  saRenderResults();
}

let saSearchTimer = null;
function saDoSearch() {
  clearTimeout(saSearchTimer);
  const q = state.saSearchQ.trim();
  if (q.length < 2) { state.saSearchResults = []; saRenderResults(); return; }
  saSearchTimer = setTimeout(() => {
    const lq = q.toLowerCase();
    state.saSearchResults = state.sebayats.filter(s =>
      [s.full_name, s.first_name, s.last_name, s.phone, s.email, s.registration_no, s.bansa_name, s.seba_name]
        .some(v => v && String(v).toLowerCase().includes(lq))
    ).slice(0, 10);
    saRenderResults();
  }, 200);
}

function saRenderResults() {
  const container = $('#sa-results-container');
  if (!container) return;

  // Toggle clear button visibility
  const clr = $('#sa-search-clear');
  if (clr) clr.style.display = state.saSearchQ ? 'flex' : 'none';

  const q = state.saSearchQ.trim();
  const p = state.saSelectedSebayat;

  if (!q || q.length < 2) {
    container.innerHTML = '';
    return;
  }

  if (state.saSearchResults.length === 0) {
    container.innerHTML = `<div class="sa-empty-results">No sebayats found matching "${esc(q)}"</div>`;
    return;
  }

  container.innerHTML = `<div class="sa-results-list">
    ${state.saSearchResults.map(s => `
      <button class="sa-result-item${p && p.id === s.id ? ' sa-result-item--active' : ''}" data-id="${esc(s.id)}">
        <div class="sa-result-avatar">${s.photo_url ? `<img src="${esc(s.photo_url)}" alt="" />` : `<span>${esc((s.full_name || s.first_name || '?')[0].toUpperCase())}</span>`}</div>
        <div class="sa-result-info">
          <div class="sa-result-name">${esc(s.full_name || [s.first_name, s.last_name].filter(Boolean).join(' ') || '—')}</div>
          <div class="sa-result-meta">${s.registration_no ? `Reg: ${esc(s.registration_no)}` : ''} ${s.phone ? `· ${esc(s.phone)}` : ''}</div>
        </div>
        <div class="sa-result-status">
          <span class="status-badge status-${esc(s.profile_status)}">${esc(STATUS_LABELS[s.profile_status] || s.profile_status)}</span>
        </div>
      </button>
    `).join('')}
  </div>`;

  // Wire up click handlers
  container.querySelectorAll('.sa-result-item').forEach(btn => {
    btn.onclick = () => {
      const id = btn.dataset.id;
      const sebayat = state.saSearchResults.find(s => s.id === id) || state.sebayats.find(s => s.id === id);
      if (sebayat) saSelectSebayat(sebayat);
    };
  });
}

async function saSelectSebayat(sebayat) {
  state.saSelectedSebayat = sebayat;
  state.saAssignments = {};
  state.saExpanded = {};
  // Clear search
  state.saSearchQ = '';
  state.saSearchResults = [];
  const inp = $('#sa-search-input');
  if (inp) inp.value = '';
  const container = $('#sa-results-container');
  if (container) container.innerHTML = '';
  const clr = $('#sa-search-clear');
  if (clr) clr.style.display = 'none';
  // Render right panel with loading state
  render();
  await saLoadAssignments(sebayat.id);
}

async function saLoadAssignments(sebayatId) {
  state.saLoading = true;
  render();
  const { data, error } = await db.from('nijog_assignments')
    .select('seba_category_id,beddha_number')
    .eq('sebayat_id', sebayatId)
    .eq('year', state.saYear);

  state.saAssignments = {};
  if (!error && data) {
    for (const row of data) {
      if (!state.saAssignments[row.seba_category_id]) state.saAssignments[row.seba_category_id] = new Set();
      state.saAssignments[row.seba_category_id].add(row.beddha_number);
    }
  }
  state.saLoading = false;
  render();
}

function saToggleCat(catId) {
  state.saExpanded[catId] = !state.saExpanded[catId];
  render();
}

function saToggleBeddha(catId, num) {
  if (!state.saAssignments[catId]) state.saAssignments[catId] = new Set();
  if (state.saAssignments[catId].has(num)) {
    state.saAssignments[catId].delete(num);
  } else {
    state.saAssignments[catId].add(num);
  }
  // Partial re-render: just toggle class on pill and update badges
  const pill = document.querySelector(`.sa-beddha[data-cat="${CSS.escape(catId)}"][data-num="${num}"]`);
  if (pill) pill.classList.toggle('sa-beddha--sel', state.saAssignments[catId].has(num));

  // Update assigned badge in header
  const card = document.querySelector(`.sa-beddha[data-cat="${CSS.escape(catId)}"]`)?.closest('.sa-cat-card');
  if (card) {
    const selCount = state.saAssignments[catId].size;
    let badge = card.querySelector('.sa-sel-badge');
    if (selCount > 0) {
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'sa-sel-badge';
        card.querySelector('.sa-cat-badges').prepend(badge);
      }
      badge.textContent = `${selCount} assigned`;
    } else if (badge) badge.remove();
  }

  // Update total summary
  const total = Object.values(state.saAssignments).reduce((s, set) => s + set.size, 0);
  let sumEl = document.querySelector('.sa-assign-summary');
  const rightHeader = document.querySelector('.sa-right-header');
  if (total > 0) {
    if (!sumEl && rightHeader) {
      sumEl = document.createElement('div');
      sumEl.className = 'sa-assign-summary';
      rightHeader.appendChild(sumEl);
    }
    if (sumEl) sumEl.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg> ${total} beddha${total !== 1 ? 's' : ''} assigned across all sebas`;
  } else if (sumEl) sumEl.remove();

  // Enable/disable clear button
  const clrBtn = document.querySelector('.sa-clear-btn');
  if (clrBtn) clrBtn.disabled = total === 0;
}

function saClearAll() {
  state.saAssignments = {};
  // Re-render only the right panel to preserve left search state
  const right = document.querySelector('.sa-right');
  if (right && state.saSelectedSebayat) {
    const tmp = document.createElement('div');
    tmp.innerHTML = renderSebaAssign();
    const newRight = tmp.querySelector('.sa-right');
    if (newRight) right.innerHTML = newRight.innerHTML;
    attachSebaAssignHandlers();
  } else {
    render();
  }
}

function saSaveAssignments() {
  if (!state.saSelectedSebayat || state.saSaving) return;

  // Build rows summary for the confirmation modal
  const rows = [];
  for (const [catId, numSet] of Object.entries(state.saAssignments)) {
    for (const num of numSet) {
      rows.push({ sebayat_id: state.saSelectedSebayat.id, seba_category_id: catId, beddha_number: num, year: state.saYear, assigned_by: state.user?.id || null });
    }
  }

  const name = state.saSelectedSebayat.full_name ||
    [state.saSelectedSebayat.first_name, state.saSelectedSebayat.last_name].filter(Boolean).join(' ') || 'Sebayat';

  // Group by category name for display
  const catMap = {};
  for (const r of rows) {
    const cat = (state.sebaCategories || []).find(c => c.id === r.seba_category_id);
    const catName = cat ? cat.name : r.seba_category_id;
    if (!catMap[catName]) catMap[catName] = [];
    catMap[catName].push(r.beddha_number);
  }

  const summaryRows = Object.entries(catMap).map(([catName, nums]) =>
    `<tr><td class="sa-confirm-cat">${esc(catName)}</td><td class="sa-confirm-nums">${nums.sort((a,b)=>a-b).map(n=>`<span class="sa-confirm-chip">${n}</span>`).join('')}</td></tr>`
  ).join('');

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay open';
  overlay.id = 'sa-confirm-overlay';
  overlay.innerHTML = `
    <div class="modal" style="max-width:520px">
      <div class="modal-header">
        <div class="modal-title">Confirm Assignments</div>
        <div class="modal-desc">You are about to save the following nijog beddha assignments for <strong>${esc(name)}</strong> (${state.saYear}). This will replace any existing assignments for this year.</div>
      </div>
      <div class="modal-body">
        ${rows.length === 0
          ? `<p style="color:var(--ink4);font-size:14px;text-align:center;padding:16px 0">No beddhas selected — saving will clear all assignments for this sebayat.</p>`
          : `<table class="sa-confirm-table">
              <thead><tr><th>Seba</th><th>Beddhas</th></tr></thead>
              <tbody>${summaryRows}</tbody>
             </table>`
        }
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" id="sa-confirm-cancel">Cancel</button>
        <button class="btn btn-primary" id="sa-confirm-ok">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg>
          Confirm &amp; Save
        </button>
      </div>
    </div>`;

  document.body.appendChild(overlay);

  $('#sa-confirm-cancel').onclick = () => overlay.remove();
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

  $('#sa-confirm-ok').onclick = async () => {
    const okBtn = $('#sa-confirm-ok');
    okBtn.disabled = true;
    okBtn.textContent = 'Saving…';

    const sebayatId = state.saSelectedSebayat.id;
    const year = state.saYear;

    const { error: delErr } = await db.from('nijog_assignments')
      .delete().eq('sebayat_id', sebayatId).eq('year', year);

    if (delErr) {
      overlay.remove();
      showToast('Failed to clear old assignments: ' + delErr.message, 'error');
      return;
    }

    if (rows.length > 0) {
      const { error: insErr } = await db.from('nijog_assignments').insert(rows);
      if (insErr) {
        overlay.remove();
        showToast('Failed to save assignments: ' + insErr.message, 'error');
        return;
      }
    }

    overlay.remove();
    showToast(`Saved ${rows.length} nijog assignment${rows.length !== 1 ? 's' : ''} for ${name} (${year})`, 'success');

    // Reset page state cleanly
    state.saSelectedSebayat = null;
    state.saAssignments = {};
    state.saExpanded = {};
    state.saSearchQ = '';
    state.saSearchResults = [];
    state.saSaving = false;
    render();
  };
}

// ============================================================
// MANAGE PROFILES VIEW
// ============================================================
const mpState = {
  search: '',
  filterStatus: 'all',
  sort: { key: 'created_at', dir: 'desc' },
  page: 1,
  pageSize: 25,
  editing: null,
  editData: {},
  editTab: 'personal',
  saving: false,
  dirty: false,
  fatherSearchResults: [],
  fatherSearching: false,
};

const MP_TABS = [
  { id: 'personal',   label: 'Personal' },
  { id: 'contact',    label: 'Contact & IDs' },
  { id: 'family',     label: 'Family' },
  { id: 'address',    label: 'Address' },
  { id: 'occupation', label: 'Occupation' },
  { id: 'seba',       label: 'Seba' },
  { id: 'social',     label: 'Social' },
];

function mpFilteredRows() {
  const q = mpState.search.toLowerCase().trim();
  const sf = mpState.filterStatus;
  return state.sebayats.filter(s => {
    if (sf !== 'all' && s.profile_status !== sf) return false;
    if (!q) return true;
    const name = getName(s).toLowerCase();
    const reg = (s.registration_no || '').toLowerCase();
    const phone = (s.phone || '').toLowerCase();
    const email = (s.email || '').toLowerCase();
    const bansa = (s.bansa_name || '').toLowerCase();
    const seba = (s.seba_name || '').toLowerCase();
    return name.includes(q) || reg.includes(q) || phone.includes(q) || email.includes(q) || bansa.includes(q) || seba.includes(q);
  });
}

function mpSortedRows(rows) {
  const { key, dir } = mpState.sort;
  const mul = dir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    let av = a[key], bv = b[key];
    if (av == null) av = '';
    if (bv == null) bv = '';
    if (key === 'name') { av = getName(a).toLowerCase(); bv = getName(b).toLowerCase(); }
    return String(av).localeCompare(String(bv)) * mul;
  });
}

function renderManageProfiles() {
  const filtered = mpFilteredRows();
  const sorted = mpSortedRows(filtered);
  const total = sorted.length;
  const ps = mpState.pageSize;
  const pg = mpState.page;
  const start = (pg - 1) * ps;
  const end = Math.min(start + ps, total);
  const pageItems = sorted.slice(start, end);

  const statusCounts = { all: state.sebayats.length };
  ['draft','submitted','resubmitted','approved','rejected','changes_requested'].forEach(st => {
    statusCounts[st] = state.sebayats.filter(x => x.profile_status === st).length;
  });

  const sortArrow = k => {
    if (mpState.sort.key !== k) return '<span class="sort-arrow">↕</span>';
    return `<span class="sort-arrow">${mpState.sort.dir === 'asc' ? '↑' : '↓'}</span>`;
  };
  const sc = k => mpState.sort.key === k ? 'sortable sorted' : 'sortable';

  const isEditing = !!mpState.editing;

  const tableHtml = `
    <div class="mp-table-panel${isEditing ? ' mp-table-panel--narrow' : ''}">
      <div class="page-header">
        <div>
          <h1>Manage Profiles</h1>
          <p>Edit and manage all sebayat profiles created by users or admins</p>
        </div>
      </div>
      <div class="toolbar">
        <div class="search-box">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input id="mp-search" type="text" placeholder="Search name, phone, reg no, seba…" value="${esc(mpState.search)}" />
        </div>
        <div class="filter-tabs">
          ${[
            { f: 'all', label: 'All' },
            { f: 'draft', label: 'Draft' },
            { f: 'submitted', label: 'Pending' },
            { f: 'resubmitted', label: 'Resubmitted' },
            { f: 'approved', label: 'Approved' },
            { f: 'rejected', label: 'Rejected' },
            { f: 'changes_requested', label: 'Changes Req.' },
          ].map(({ f, label }) => `
            <button class="filter-tab ${mpState.filterStatus === f ? 'active' : ''}" data-mp-filter="${f}">
              ${label} <span class="count">${statusCounts[f] ?? 0}</span>
            </button>`).join('')}
        </div>
      </div>
      <div class="panel">
        <div class="data-table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th class="${sc('name')}" data-mp-sort="name">Name ${sortArrow('name')}</th>
                ${!isEditing ? `<th>Contact</th><th>Seba</th>` : ''}
                <th>Status</th>
                <th class="${sc('created_at')}" data-mp-sort="created_at">Created ${sortArrow('created_at')}</th>
                <th>Source</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              ${pageItems.length === 0
                ? `<tr><td colspan="${isEditing ? 5 : 7}">${emptyState('No profiles found', mpState.search ? 'Try adjusting your search or filter.' : 'No profiles match this filter.')}</td></tr>`
                : pageItems.map(s => {
                    const status = s.profile_status || 'draft';
                    const isOpen = mpState.editing === s.id;
                    return `<tr class="mp-row${isOpen ? ' mp-row--active' : ''}" data-mp-id="${esc(s.id)}">
                      <td>
                        <div class="row-name" style="cursor:pointer" onclick="actions.gotoMpView('${esc(s.id)}')" data-mp-view="${esc(s.id)}">
                          <div class="row-avatar" ${s.photo_url ? `style="background-image:url('${esc(s.photo_url)}')"` : ''}>${s.photo_url ? '' : esc(getInitials(s))}</div>
                          <div class="row-name-main">
                            <div class="row-name-text">${esc(getName(s))}</div>
                            ${s.registration_no ? `<div class="row-name-sub">Reg: ${esc(s.registration_no)}</div>` : ''}
                          </div>
                        </div>
                      </td>
                      ${!isEditing ? `
                        <td>
                          <div class="cell-stack">
                            <div class="cell-stack-main">${s.phone ? '+' + esc(s.phone) : '—'}</div>
                            ${s.email ? `<div class="cell-stack-sub">${esc(s.email)}</div>` : ''}
                          </div>
                        </td>
                        <td>
                          <div class="cell-stack">
                            <div class="cell-stack-main">${esc(s.seba_name || '—')}</div>
                            ${s.bansa_name ? `<div class="cell-stack-sub">${esc(s.bansa_name)}</div>` : ''}
                          </div>
                        </td>` : ''}
                      <td><span class="status-badge status-${esc(status)}">${esc(STATUS_LABELS[status] || status)}</span></td>
                      <td>${fmtDate(s.created_at)}</td>
                      <td>${s.created_by_admin ? '<span class="mp-source-badge mp-source-badge--admin">Admin</span>' : '<span class="mp-source-badge mp-source-badge--user">User</span>'}</td>
                      <td>
                        <div class="row-actions">
                          <button class="btn btn-ghost btn-xs" onclick="actions.gotoMpEdit('${esc(s.id)}')">Edit</button>
                          <button class="btn btn-ghost btn-xs" onclick="actions.gotoMpView('${esc(s.id)}')">View</button>
                        </div>
                      </td>
                    </tr>`;
                  }).join('')}
            </tbody>
          </table>
        </div>
        <div class="table-footer">
          <span class="table-count">Showing <strong>${total === 0 ? 0 : start + 1}</strong>–<strong>${end}</strong> of <strong>${total}</strong></span>
          <div class="page-size">
            <span>Rows:</span>
            <select id="mp-page-size">
              ${[25,50,100].map(n => `<option value="${n}" ${ps === n ? 'selected' : ''}>${n}</option>`).join('')}
            </select>
          </div>
          ${mpRenderPagination(total)}
        </div>
      </div>
    </div>`;

  const editHtml = isEditing ? mpRenderEditPanel() : '';

  return `<div class="mp-layout${isEditing ? ' mp-layout--split' : ''}">${tableHtml}${editHtml}</div>`;
}

function mpRenderPagination(total) {
  const totalPages = Math.max(1, Math.ceil(total / mpState.pageSize));
  if (mpState.page > totalPages) mpState.page = totalPages;
  const cur = mpState.page;
  const pages = [];
  pages.push(1);
  if (cur - 2 > 2) pages.push('…');
  for (let i = Math.max(2, cur - 1); i <= Math.min(totalPages - 1, cur + 1); i++) pages.push(i);
  if (cur + 2 < totalPages - 1) pages.push('…');
  if (totalPages > 1) pages.push(totalPages);
  return `<div class="pagination">
    <button ${cur === 1 ? 'disabled' : ''} data-mp-page="${cur - 1}">‹</button>
    ${pages.map(p => p === '…' ? '<button disabled>…</button>' : `<button class="${p === cur ? 'active' : ''}" data-mp-page="${p}">${p}</button>`).join('')}
    <button ${cur === totalPages ? 'disabled' : ''} data-mp-page="${cur + 1}">›</button>
  </div>`;
}

function mpRenderEditPanel() {
  const s = mpState.editData;
  const tab = mpState.editTab;

  const tabsHtml = MP_TABS.map(t => `
    <button class="mp-edit-tab${tab === t.id ? ' active' : ''}" data-mp-tab="${t.id}">${t.label}</button>`).join('');

  return `
    <div class="mp-edit-panel">
      <div class="mp-edit-header">
        <div class="mp-edit-identity">
          <div class="mp-edit-avatar-wrap">
            <div class="row-avatar mp-edit-avatar" ${s.photo_url ? `style="background-image:url('${esc(s.photo_url)}');background-size:cover;background-position:center"` : ''}>${s.photo_url ? '' : esc(getInitials(s))}</div>
            <label class="mp-photo-overlay" for="mp-photo-upload" title="Change photo">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
            </label>
            <input type="file" id="mp-photo-upload" accept="image/*" style="display:none" />
          </div>
          <div>
            <div class="mp-edit-name">${esc(getName(s))}</div>
            <div class="mp-edit-sub">${s.registration_no ? 'Reg: ' + esc(s.registration_no) : (s.phone ? '+' + esc(s.phone) : 'No registration')}</div>
          </div>
        </div>
        <button class="icon-btn mp-edit-close" id="mp-edit-close" title="Close">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div class="mp-edit-tabs">${tabsHtml}</div>
      <div class="mp-edit-body" id="mp-edit-body">
        ${mpRenderEditTab(tab, s)}
      </div>
      <div class="mp-edit-footer">
        ${mpState.dirty ? '<span class="mp-unsaved"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg> Unsaved changes</span>' : '<span class="mp-saved"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Saved</span>'}
        <div style="display:flex;gap:8px">
          <button class="btn btn-ghost btn-sm" id="mp-edit-close-btn">Close</button>
          <button class="btn btn-primary btn-sm" id="mp-save-btn" ${mpState.saving ? 'disabled' : ''}>
            ${mpState.saving ? '<span class="nv-btn-spinner"></span> Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>`;
}

// Shared field builder — reads from mpState.editData
function mpField(id, label, type = 'text', placeholder = '', options = null) {
  const val = mpState.editData[id] != null ? mpState.editData[id] : '';
  if (options) {
    return `<div class="field">
      <label>${label}</label>
      <select class="mp-input" data-mp-field="${esc(id)}">
        <option value="">— Select —</option>
        ${options.map(o => Array.isArray(o)
          ? `<option value="${esc(o[0])}" ${String(val) === o[0] ? 'selected' : ''}>${esc(o[1])}</option>`
          : `<option value="${esc(o)}" ${String(val) === o ? 'selected' : ''}>${esc(o)}</option>`
        ).join('')}
      </select>
    </div>`;
  }
  if (type === 'textarea') {
    return `<div class="field">
      <label>${label}</label>
      <textarea class="mp-input" data-mp-field="${esc(id)}" rows="3" placeholder="${esc(placeholder)}">${esc(String(val))}</textarea>
    </div>`;
  }
  if (type === 'toggle') {
    const checked = val === true || val === 'true';
    return `<div class="ap-toggle-row">
      <div class="ap-toggle-label"><div class="ap-toggle-title">${label}</div></div>
      <label class="ap-toggle-switch">
        <input type="checkbox" class="mp-toggle" data-mp-toggle="${esc(id)}" ${checked ? 'checked' : ''} />
        <span class="ap-toggle-track"></span>
      </label>
    </div>`;
  }
  return `<div class="field">
    <label>${label}</label>
    <input class="mp-input" data-mp-field="${esc(id)}" type="${type}" placeholder="${esc(placeholder)}" value="${esc(String(val))}" />
  </div>`;
}

// Chip-selector row matching add-profile style
function mpChips(id, label, values) {
  const cur = mpState.editData[id] || '';
  return `<div class="ap-chips-row">
    <div class="ap-chips-label">${label}</div>
    <div class="ap-chips">
      ${values.map(v => `<button class="ap-chip${cur === v ? ' active' : ''}" data-mp-chip="${esc(id)}" data-val="${esc(v)}">${esc(v)}</button>`).join('')}
    </div>
  </div>`;
}

function mpSection(title) {
  return `<div class="detail-section-header" style="margin:18px 0 10px"><span class="detail-section-title">${esc(title)}</span><div class="detail-section-line"></div></div>`;
}

function mpRenderEditTab(tab, s) {
  switch (tab) {

    // ── PERSONAL ──────────────────────────────────────────────
    case 'personal': return `
      ${mpSection('Name')}
      <div class="ap-grid">
        ${mpField('first_name', 'First Name', 'text', 'First name')}
        ${mpField('middle_name', 'Middle Name', 'text', 'Middle name')}
        ${mpField('last_name', 'Last Name', 'text', 'Last name')}
        ${mpField('alias_name', 'Alias / Known as', 'text', 'Nickname or alias')}
      </div>
      ${mpSection('Personal Details')}
      ${mpField('date_of_birth', 'Date of Birth', 'date')}
      ${mpChips('gender', 'Gender', ['Male', 'Female'])}
      <div class="ap-grid" style="margin-top:12px">
        ${mpField('blood_group', 'Blood Group', 'text', '', ['A+','A-','B+','B-','AB+','AB-','O+','O-'])}
      </div>
      <div class="ap-toggles" style="margin-top:10px">
        ${mpField('is_bhagari', 'Bhagari', 'toggle')}
        ${mpField('is_baristha_bhai_pua', 'Baristha Bhai Pua', 'toggle')}
      </div>
      ${mpSection('Health')}
      <div class="ap-grid">
        ${mpField('health_card_no', 'Health Card Number', 'text', 'Card number')}
      </div>
      ${(()=>{
        const hurl = s.health_card_photo_url;
        return `<div class="ap-id-photo-row" style="margin-top:8px">
          ${hurl ? `<div class="ap-id-photo-preview" style="background-image:url('${esc(hurl)}')" onclick="openLightbox('${esc(hurl)}')"></div>` : ''}
          <span class="ap-id-photo-label">${hurl ? 'Health card photo uploaded' : 'Upload health card photo'}</span>
          <input type="file" id="mp-health-photo-input" accept="image/*" style="display:none" />
          <button class="btn btn-ghost btn-sm" id="mp-health-photo-btn">${hurl ? 'Replace' : 'Upload'}</button>
        </div>`;
      })()}`;

    // ── CONTACT & IDs ─────────────────────────────────────────
    case 'contact': {
      const docs = s.id_documents || [];
      const extraPhones = s.extra_phones || [];
      const allIdTypes = ['Aadhar Card', 'PAN Card', 'Voter ID', 'Passport', 'Driving Licence'];
      return `
        <div class="ap-info-banner">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          These numbers are used by Nijog administration to contact the sebayat.
        </div>
        <div class="ap-grid">
          ${mpField('phone', 'Phone Number (Primary)', 'tel', '91XXXXXXXXXX')}
          ${mpField('whatsapp_number', 'WhatsApp Number', 'tel', 'Leave blank if same as phone')}
          ${mpField('email', 'Email Address', 'email', 'email@example.com')}
        </div>
        ${mpSection('Additional Phone Numbers')}
        ${extraPhones.map((ph, i) => `
          <div class="ap-list-row" data-mp-phone-idx="${i}">
            <input type="tel" class="mp-phone-extra" data-mp-phone-idx="${i}" placeholder="Number ${i+1}" value="${esc(String(ph||''))}" maxlength="15" style="flex:1" />
            <button class="ap-list-del" data-mp-del-phone="${i}" title="Remove">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
            </button>
          </div>`).join('')}
        <button class="ap-add-btn" id="mp-add-phone">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add another number
        </button>
        ${mpSection('Identity Documents')}
        <div class="ap-info-banner" style="margin-bottom:12px">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          Attach one or more government identity cards.
        </div>
        ${docs.map((doc, i) => `
          <div class="ap-id-card" data-mp-doc-idx="${i}">
            <div class="ap-id-card-header">
              <span class="ap-id-card-num">ID ${i+1}</span>
              <select class="ap-doc-type mp-doc-type" data-mp-doc-idx="${i}">
                <option value="">— Select ID type —</option>
                ${allIdTypes.map(t => `<option value="${esc(t)}" ${doc.id_type === t ? 'selected' : ''}>${esc(t)}</option>`).join('')}
              </select>
              ${docs.length > 1 ? `<button class="ap-list-del" data-mp-del-doc="${i}">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
              </button>` : ''}
            </div>
            <div class="ap-id-photo-row">
              ${doc.photo_url ? `<div class="ap-id-photo-preview" style="background-image:url('${esc(doc.photo_url)}')" onclick="openLightbox('${esc(doc.photo_url)}')"></div><span class="ap-id-photo-label">Photo uploaded · click preview to view</span>` : `<span class="ap-id-photo-label">Upload ID photo — Front side · JPG or PNG</span>`}
              <input type="file" class="mp-doc-photo-input" data-mp-doc-idx="${i}" accept="image/*" style="display:none" id="mp-doc-photo-${i}" />
              <button class="btn btn-ghost btn-sm mp-doc-photo-btn" data-mp-doc-idx="${i}">${doc.photo_url ? 'Replace' : 'Upload'}</button>
            </div>
          </div>`).join('')}
        ${docs.length < allIdTypes.length ? `
          <button class="ap-add-btn" id="mp-add-doc">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Add another ID
          </button>` : ''}`;
    }

    // ── FAMILY ────────────────────────────────────────────────
    case 'family': {
      const married = s.marital_status === 'Married';
      const children = s.children || [];
      const linkedFather = s.father_sebayat_id || '';
      const fatherName = s.father_name || '';
      const fResults = mpState.fatherSearchResults || [];
      const fSearching = mpState.fatherSearching || false;

      const fatherBlock = linkedFather
        ? `<div class="ap-father-linked">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
            <span>${esc(fatherName)}</span>
            <span style="font-size:11px;color:var(--ink4);margin-left:4px">(linked)</span>
            <button class="btn btn-ghost btn-sm" id="mp-father-unlink" style="margin-left:auto">Unlink</button>
          </div>`
        : `<div style="position:relative">
            <input id="mp-father-search" type="text" placeholder="Search registered sebayat or enter name manually" value="${esc(fatherName)}" autocomplete="off" />
            ${fSearching ? `<div class="ap-search-spin"></div>` : ''}
            ${fResults.length > 0 ? `
              <div class="ap-father-dropdown">
                ${fResults.map(r => `
                  <div class="ap-father-result" data-mp-father-id="${esc(r.id)}" data-mp-father-name="${esc(getName(r))}">
                    <div class="ap-father-result-name">${esc(getName(r))}</div>
                    <div class="ap-father-result-sub">${r.date_of_birth ? 'DOB: ' + fmtDate(r.date_of_birth) : ''}${r.bansa_name ? ' · ' + r.bansa_name : ''}</div>
                  </div>`).join('')}
              </div>` : ''}
          </div>`;

      return `
        <div class="field">
          <label>Father's Name</label>
          ${fatherBlock}
        </div>
        ${mpField('mother_name', 'Mother\'s Full Name', 'text', 'Full name')}
        ${mpSection('Marital Status')}
        ${mpChips('marital_status', 'Marital Status', ['Unmarried', 'Married'])}
        ${married ? `
          ${mpSection('Spouse Details')}
          <div class="ap-grid">
            ${mpField('spouse_name', 'Spouse Name', 'text', 'Full name')}
            ${mpField('spouse_father_name', "Spouse's Father", 'text', 'Full name')}
            ${mpField('spouse_mother_name', "Spouse's Mother", 'text', 'Full name')}
          </div>
          ${mpSection('Children')}
          ${children.map((child, i) => `
            <div class="ap-child-card" data-mp-child-idx="${i}">
              <div class="ap-id-card-header">
                <span class="ap-id-card-num">Child ${i+1}</span>
                <button class="ap-list-del" data-mp-del-child="${i}">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                </button>
              </div>
              <input type="text" class="mp-child-name" data-mp-child-idx="${i}" placeholder="Child's full name" value="${esc(child.child_name||'')}" style="margin-bottom:8px" />
              <div class="ap-chips-row" style="margin-bottom:8px">
                <div class="ap-chips-label">Gender</div>
                <div class="ap-chips">
                  ${['Male','Female'].map(g => `<button class="ap-chip${child.gender===g?' active':''}" data-mp-child-chip="${i}" data-child-field="gender" data-val="${esc(g)}">${esc(g)}</button>`).join('')}
                </div>
              </div>
              <div class="ap-chips-row">
                <div class="ap-chips-label">Marital Status</div>
                <div class="ap-chips">
                  ${['Single','Married'].map(m => `<button class="ap-chip${child.marital_status===m?' active':''}" data-mp-child-chip="${i}" data-child-field="marital_status" data-val="${esc(m)}">${esc(m)}</button>`).join('')}
                </div>
              </div>
            </div>`).join('')}
          <button class="ap-add-btn" id="mp-add-child">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Add child
          </button>` : ''}`;
    }

    // ── ADDRESS ───────────────────────────────────────────────
    case 'address': {
      const hasCurrent = s.is_permanent_different === true || s.is_permanent_different === 'true';
      return `
        ${mpSection('Permanent Address')}
        <div class="ap-grid">
          ${mpField('permanent_sahi', 'Sahi / Mohalla', 'text', 'e.g. Badaghara Sahi')}
          ${mpField('permanent_landmark', 'Landmark', 'text', 'Nearby landmark')}
          ${mpField('permanent_post_office', 'Post Office', 'text', 'Post office name')}
          ${mpField('permanent_police_station', 'Police Station', 'text', 'Police station name')}
          ${mpField('permanent_pincode', 'Pincode', 'text', '6-digit PIN')}
          ${mpField('permanent_district', 'District', 'text', 'e.g. Puri')}
          ${mpField('permanent_state', 'State', 'text', 'e.g. Odisha')}
          ${mpField('permanent_country', 'Country', 'text', 'India')}
        </div>
        ${mpField('permanent_address_text', 'Full Address (optional)', 'textarea', 'House no., street, area…')}
        <div class="ap-toggle-row" style="margin-top:16px">
          <div class="ap-toggle-label"><div class="ap-toggle-title">Current address is different</div></div>
          <label class="ap-toggle-switch">
            <input type="checkbox" id="mp-has-current" ${hasCurrent ? 'checked' : ''} />
            <span class="ap-toggle-track"></span>
          </label>
        </div>
        ${hasCurrent ? `
          ${mpSection('Current Address')}
          <div class="ap-grid">
            ${mpField('current_sahi', 'Sahi / Mohalla')}
            ${mpField('current_landmark', 'Landmark')}
            ${mpField('current_post_office', 'Post Office')}
            ${mpField('current_police_station', 'Police Station')}
            ${mpField('current_pincode', 'Pincode')}
            ${mpField('current_district', 'District')}
            ${mpField('current_state', 'State')}
            ${mpField('current_country', 'Country')}
          </div>
          ${mpField('current_address_text', 'Full Current Address', 'textarea')}
        ` : ''}`;
    }

    // ── OCCUPATION ────────────────────────────────────────────
    case 'occupation': {
      const exactDate = s.joining_date_exact !== false && s.joining_date_exact !== 'false';
      const occupations = s.occupations || [];
      return `
        ${mpSection('Joining Nijog')}
        <div class="ap-toggle-row" style="margin-bottom:12px">
          <div class="ap-toggle-label"><div class="ap-toggle-title">I know the exact joining date</div></div>
          <label class="ap-toggle-switch">
            <input type="checkbox" id="mp-joining-exact" ${exactDate ? 'checked' : ''} />
            <span class="ap-toggle-track"></span>
          </label>
        </div>
        ${exactDate
          ? mpField('joining_date', 'Joining Date', 'date', '')
          : `<div class="ap-info-banner" style="margin-bottom:8px">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              Exact date unknown — enter the joining year instead.
             </div>
             ${mpField('joining_year', 'Joining Year', 'select', '', Array.from({length: new Date().getFullYear() - 1899}, (_, i) => String(new Date().getFullYear() - i)))}`}
        ${mpSection('Occupations')}
        ${occupations.map((occ, i) => `
          <div class="ap-occ-card" data-mp-occ-idx="${i}">
            <div class="ap-id-card-header">
              <span class="ap-id-card-num">Occupation ${i+1}</span>
              ${occupations.length > 1 ? `<button class="ap-list-del" data-mp-del-occ="${i}">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
              </button>` : ''}
            </div>
            <input type="text" class="mp-occ-field" data-mp-occ-idx="${i}" data-mp-occ-key="occupation" placeholder="e.g. Teacher, Engineer" value="${esc(occ.occupation||'')}" style="margin-bottom:8px" />
            <input type="text" class="mp-occ-field" data-mp-occ-idx="${i}" data-mp-occ-key="extra_curriculum_activity" placeholder="Extra curricular activity (optional)" value="${esc(occ.extra_curriculum_activity||'')}" />
          </div>`).join('')}
        <button class="ap-add-btn" id="mp-add-occ">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add another occupation
        </button>`;
    }

    // ── SEBA ──────────────────────────────────────────────────
    case 'seba': {
      const AP_HIDDEN_SEBAS = ['Singha Dwara', 'Dwara Ghara'];
      if (!mpState.sebaExpanded) mpState.sebaExpanded = {};
      const sebaSelections = mpState.editData.sebaSelections || {};

      const sebaCatsHtml = (state.sebaCategories || [])
        .filter(cat => cat.is_active && cat.category_type === 'seba' && !AP_HIDDEN_SEBAS.includes(cat.name))
        .map(cat => {
          const beddhaTypes = state.sebaBeddhas[cat.id] || {};
          const selectedNums = sebaSelections[cat.id] || [];
          const count = cat.beddha_count || 0;
          const selCount = selectedNums.length;
          const isOpen = !!mpState.sebaExpanded[cat.id];
          const pills = Array.from({ length: count }, (_, i) => i + 1).map(num => {
            const bType = beddhaTypes[num];
            const isNijog = bType === 'nijog_assigned';
            const isSel = selectedNums.includes(num);
            if (isNijog) return `<div class="ap-beddha ap-beddha--disabled" title="Nijog assigned">${num}<span class="ap-beddha-n">N</span></div>`;
            return `<div class="ap-beddha${isSel ? ' ap-beddha--selected' : ''}" data-mp-beddha-cat="${esc(cat.id)}" data-mp-beddha-num="${num}">${num}</div>`;
          }).join('');
          return `
            <div class="ap-seba-cat-card" id="mp-seba-card-${esc(cat.id)}">
              <div class="ap-seba-cat-header ap-seba-toggle" data-mp-seba-toggle="${esc(cat.id)}">
                <span class="ap-seba-cat-name">${esc(cat.name)}</span>
                <div style="display:flex;gap:6px;align-items:center">
                  ${selCount > 0 ? `<span class="ap-seba-sel-badge">${selCount} selected</span>` : ''}
                  <span class="ap-seba-count-badge">${count}</span>
                  <span class="ap-seba-chevron" style="transform:rotate(${isOpen ? '90deg' : '0deg'})">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
                  </span>
                </div>
              </div>
              <div id="mp-seba-body-${esc(cat.id)}" style="display:${isOpen ? 'block' : 'none'}">
                <div class="ap-beddha-grid">${pills}</div>
                <div class="ap-seba-legend">
                  <span class="ap-legend-item"><span class="ap-legend-dot ap-legend-dot--selected"></span>Selected</span>
                  <span class="ap-legend-item"><span class="ap-legend-dot ap-legend-dot--available"></span>Available</span>
                  <span class="ap-legend-item"><span class="ap-legend-dot ap-legend-dot--nijog"></span>N — Nijog assigned</span>
                </div>
              </div>
            </div>`;
        }).join('');

      const totalSel = Object.values(sebaSelections).reduce((sum, arr) => sum + arr.length, 0);

      return `
        ${mpSection('Seba Identity')}
        ${mpField('registration_no', 'Registration No.', 'text', 'Reg number')}
        <div class="ap-toggles">
          ${mpField('is_bhagari', 'Bhagari', 'toggle')}
          ${mpField('is_baristha_bhai_pua', 'Baristha Bhai Pua', 'toggle')}
        </div>
        ${mpSection('Beddha Selection')}
        <div class="ap-info-banner" style="margin-bottom:12px">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          Select the beddha numbers for this sebayat. Pills marked <strong>N</strong> are Nijog-assigned.
        </div>
        ${totalSel > 0 ? `<div class="ap-seba-total-badge">${totalSel} beddha${totalSel!==1?'s':''} selected</div>` : ''}
        ${sebaCatsHtml || '<p style="color:var(--ink4);font-size:14px">No seba categories configured.</p>'}
        ${mpSection('Profile Status')}
        <div class="ap-grid">
          ${mpField('profile_status', 'Profile Status', 'text', '', [
            ['draft','Draft'],
            ['submitted','Submitted'],
            ['resubmitted','Resubmitted'],
            ['approved','Approved'],
            ['rejected','Rejected'],
            ['changes_requested','Changes Requested'],
          ])}
        </div>
        ${(s.profile_status==='rejected'||s.profile_status==='changes_requested') ? `
          ${mpSection('Admin Remarks')}
          ${mpField('admin_remarks', 'Remarks for sebayat', 'textarea', 'Explain what needs to change…')}
        ` : ''}`;
    }

    // ── SOCIAL ────────────────────────────────────────────────
    case 'social': {
      const socialFields = [
        { key: 'social_facebook',  label: 'Facebook',    color: '#1877F2', placeholder: 'facebook.com/…',    icon: 'M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z' },
        { key: 'social_twitter',   label: 'X (Twitter)', color: '#0F1419', placeholder: 'x.com/…',           icon: 'M23 3a10.9 10.9 0 0 1-3.14 1.53 4.48 4.48 0 0 0-7.86 3v1A10.66 10.66 0 0 1 3 4s-4 9 5 13a11.64 11.64 0 0 1-7 2c9 5 20 0 20-11.5a4.5 4.5 0 0 0-.08-.83A7.72 7.72 0 0 0 23 3z' },
        { key: 'social_instagram', label: 'Instagram',   color: '#C13584', placeholder: 'instagram.com/…',  icon: 'M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37zm1.5-4.87h.01M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5z' },
        { key: 'social_linkedin',  label: 'LinkedIn',    color: '#0A66C2', placeholder: 'linkedin.com/in/…', icon: 'M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6zM2 9h4v12H2z M2 4a2 2 0 1 0 4 0 2 2 0 0 0-4 0' },
        { key: 'social_youtube',   label: 'YouTube',     color: '#FF0000', placeholder: 'youtube.com/@…',   icon: 'M22.54 6.42a2.78 2.78 0 0 0-1.95-1.97C18.88 4 12 4 12 4s-6.88 0-8.59.46A2.78 2.78 0 0 0 1.46 6.42 29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58A2.78 2.78 0 0 0 3.41 19.6C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-1.95A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z M9.75 15.02l5.75-3.02-5.75-3.02v6.04z' },
      ];
      return `
        <div class="ap-info-banner" style="margin-bottom:16px">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          All social media fields are optional.
        </div>
        ${socialFields.map(sf => `
          <div class="ap-social-row ${s[sf.key] ? 'filled' : ''}">
            <div class="ap-social-icon" style="color:${sf.color}">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="${sf.icon}"/></svg>
            </div>
            <div class="field" style="margin:0;flex:1">
              <label>${esc(sf.label)}</label>
              <input class="mp-input" data-mp-field="${esc(sf.key)}" type="url" placeholder="${esc(sf.placeholder)}" value="${esc(s[sf.key]||'')}" />
            </div>
          </div>`).join('')}`;
    }

    default: return '';
  }
}

async function mpSave() {
  if (!mpState.editing || mpState.saving) return;
  mpState.saving = true;
  mpRerender();

  const sebayatId = mpState.editing;
  const updates = { ...mpState.editData, updated_at: new Date().toISOString() };
  // Remove fields that don't exist as columns in sebayats
  delete updates.id;
  delete updates.sebaSelections;
  delete updates.id_documents;

  const { error } = await db.from('sebayats').update(updates).eq('id', sebayatId);

  if (error) {
    mpState.saving = false;
    showToast('Save failed: ' + error.message, 'error');
    mpRerender();
    return;
  }

  // Save seba selections: delete existing, re-insert
  const sebaSelections = mpState.editData.sebaSelections || {};
  const newRows = [];
  for (const [catId, nums] of Object.entries(sebaSelections)) {
    for (const num of (nums || [])) {
      newRows.push({ sebayat_id: sebayatId, seba_category_id: catId, beddha_number: num });
    }
  }
  await db.from('sebayat_seba_selections').delete().eq('sebayat_id', sebayatId);
  if (newRows.length > 0) {
    const { error: selError } = await db.from('sebayat_seba_selections').insert(newRows);
    if (selError) {
      mpState.saving = false;
      showToast('Profile saved but seba selections failed: ' + selError.message, 'error');
      mpRerender();
      return;
    }
  }

  // Patch in-memory state
  const idx = state.sebayats.findIndex(x => x.id === sebayatId);
  if (idx !== -1) state.sebayats[idx] = { ...state.sebayats[idx], ...updates };
  mpState.saving = false;
  mpState.dirty = false;
  showToast('Profile saved successfully', 'success');
  mpRerender();
}

async function mpOpenEdit(id) {
  const s = state.sebayats.find(x => x.id === id);
  if (!s) return;
  mpState.editing = id;
  mpState.editData = JSON.parse(JSON.stringify(s));
  // Ensure array fields are initialized
  if (!mpState.editData.extra_phones) mpState.editData.extra_phones = [];
  if (!mpState.editData.id_documents) mpState.editData.id_documents = [{ id_type: '', photo_url: '' }];
  if (!mpState.editData.occupations) mpState.editData.occupations = [{ occupation: '', extra_curriculum_activity: '' }];
  if (!mpState.editData.children) mpState.editData.children = [];
  if (mpState.editData.joining_date_exact === undefined) mpState.editData.joining_date_exact = true;
  // Load existing seba selections from DB
  mpState.editData.sebaSelections = {};
  const { data: selRows } = await db
    .from('sebayat_seba_selections')
    .select('seba_category_id, beddha_number')
    .eq('sebayat_id', id);
  for (const row of (selRows || [])) {
    if (!mpState.editData.sebaSelections[row.seba_category_id]) {
      mpState.editData.sebaSelections[row.seba_category_id] = [];
    }
    mpState.editData.sebaSelections[row.seba_category_id].push(row.beddha_number);
  }
  mpState.editTab = 'personal';
  mpState.dirty = false;
  mpState.fatherSearchResults = [];
  mpState.sebaExpanded = {};
  mpRerender();
}

function mpCloseEdit() {
  mpState.editing = null;
  mpState.editData = {};
  mpState.dirty = false;
  state.currentSebayat = null;
  state.view = 'manage_profiles';
  render();
}

function mpRerender() {
  const c = $('#view-container');
  if (c && state.view === 'manage_profiles') {
    c.innerHTML = renderManageProfiles();
    attachManageProfilesHandlers();
  } else if (c && state.view === 'mp_edit_page') {
    c.innerHTML = renderMpEditPage();
    attachManageProfilesHandlers();
  } else if (c && state.view === 'mp_view_page') {
    renderMpViewPageShell(c);
  }
}

function renderMpEditPage() {
  return `
    <div class="mp-page-wrapper">
      <div class="mp-page-back">
        <button class="btn btn-ghost btn-sm" onclick="mpCloseEdit()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
          Back to Manage Profiles
        </button>
      </div>
      ${mpRenderEditPanel()}
    </div>`;
}

function renderMpViewPageShell(container) {
  const s = state.currentSebayat;
  if (!s) { state.view = 'manage_profiles'; render(); return; }

  container.innerHTML = `
    <div class="mp-page-wrapper">
      <div class="mp-page-back">
        <button class="btn btn-ghost btn-sm" onclick="state.view='manage_profiles';render()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
          Back to Manage Profiles
        </button>
        <button class="btn btn-ghost btn-sm" onclick="actions.gotoMpEdit('${esc(s.id)}')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          Edit Profile
        </button>
      </div>
      <div class="mp-view-header">
        <div class="row-avatar mp-view-avatar" ${s.photo_url ? `style="background-image:url('${esc(s.photo_url)}');background-size:cover;background-position:center"` : ''}>${s.photo_url ? '' : esc(getInitials(s))}</div>
        <div class="mp-view-identity">
          <div class="mp-view-name">${esc(getName(s))}</div>
          <div class="mp-view-sub">${s.phone ? '+' + esc(s.phone) : ''}${s.registration_no ? ' &nbsp;·&nbsp; Reg: ' + esc(s.registration_no) : ''}</div>
          <span class="status-badge status-${esc(s.profile_status)}" style="margin-top:6px;display:inline-block">${esc(STATUS_LABELS[s.profile_status] || s.profile_status)}</span>
        </div>
      </div>
      <div id="mp-view-body" class="mp-view-body"><div style="text-align:center;padding:40px;color:#9B8578">Loading…</div></div>
    </div>`;

  // Populate async content after shell is painted
  drawerOverview(s).then(html => {
    const body = $('#mp-view-body');
    if (body) body.innerHTML = html;
  });
}

function attachManageProfilesHandlers() {
  // ── Table handlers ──────────────────────────────────────────
  const search = $('#mp-search');
  if (search) search.oninput = () => { mpState.search = search.value; mpState.page = 1; mpRerender(); };

  $$('[data-mp-filter]').forEach(btn => {
    btn.onclick = () => { mpState.filterStatus = btn.dataset.mpFilter; mpState.page = 1; mpRerender(); };
  });

  $$('[data-mp-sort]').forEach(th => {
    th.onclick = () => {
      const k = th.dataset.mpSort;
      if (mpState.sort.key === k) mpState.sort.dir = mpState.sort.dir === 'asc' ? 'desc' : 'asc';
      else { mpState.sort.key = k; mpState.sort.dir = 'asc'; }
      mpRerender();
    };
  });

  $$('[data-mp-page]').forEach(b => {
    b.onclick = () => { mpState.page = parseInt(b.dataset.mpPage); mpRerender(); };
  });

  const ps = $('#mp-page-size');
  if (ps) ps.onchange = () => { mpState.pageSize = parseInt(ps.value); mpState.page = 1; mpRerender(); };

  $$('[data-mp-edit]').forEach(el => {
    el.onclick = (e) => { e.stopPropagation(); mpOpenEdit(el.dataset.mpEdit); };
  });

  if (!mpState.editing) return;

  // ── Edit panel core ─────────────────────────────────────────
  const closeBtn = $('#mp-edit-close');
  const closeBtnFooter = $('#mp-edit-close-btn');
  if (closeBtn) closeBtn.onclick = mpCloseEdit;
  if (closeBtnFooter) closeBtnFooter.onclick = mpCloseEdit;

  const saveBtn = $('#mp-save-btn');
  if (saveBtn) saveBtn.onclick = mpSave;

  $$('[data-mp-tab]').forEach(btn => {
    btn.onclick = () => { mpState.editTab = btn.dataset.mpTab; mpState.fatherSearchResults = []; mpRerender(); };
  });

  // ── Profile photo upload ────────────────────────────────────
  const photoInput = $('#mp-photo-upload');
  if (photoInput) photoInput.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const ext = file.name.split('.').pop() || 'jpg';
    const sebayatId = mpState.editing;
    const path = `${sebayatId}/profile-photo-${Date.now()}.${ext}`;
    showToast('Uploading photo…', 'info');
    const { error: upErr } = await db.storage.from('profile-photos').upload(path, file, { upsert: true, contentType: file.type });
    if (upErr) { showToast('Photo upload failed: ' + upErr.message, 'error'); return; }
    const { data: urlData } = db.storage.from('profile-photos').getPublicUrl(path);
    mpState.editData.photo_url = urlData.publicUrl;
    mpState.dirty = true;
    showToast('Photo uploaded', 'success');
    mpRerender();
  };

  // ── Generic text/select/textarea fields ─────────────────────
  $$('.mp-input').forEach(input => {
    const field = input.dataset.mpField;
    if (!field) return;
    const update = () => { mpState.editData[field] = input.value; mpState.dirty = true; };
    input.oninput = update;
    input.onchange = update;
  });

  // ── Chip selectors (gender, marital_status) ─────────────────
  $$('[data-mp-chip]').forEach(btn => {
    btn.onclick = () => {
      const field = btn.dataset.mpChip;
      mpState.editData[field] = btn.dataset.val;
      mpState.dirty = true;
      mpRerender();
    };
  });

  // ── Boolean toggles ─────────────────────────────────────────
  $$('.mp-toggle, [data-mp-toggle]').forEach(cb => {
    if (!cb.dataset.mpToggle) return;
    cb.onchange = () => { mpState.editData[cb.dataset.mpToggle] = cb.checked; mpState.dirty = true; mpRerender(); };
  });

  // ── Current address toggle ──────────────────────────────────
  const hasCurrent = $('#mp-has-current');
  if (hasCurrent) hasCurrent.onchange = () => { mpState.editData.is_permanent_different = hasCurrent.checked; mpState.dirty = true; mpRerender(); };

  // ── Health card photo ────────────────────────────────────────
  const healthPhotoBtn = $('#mp-health-photo-btn');
  const healthPhotoInput = $('#mp-health-photo-input');
  if (healthPhotoBtn && healthPhotoInput) {
    healthPhotoBtn.onclick = () => healthPhotoInput.click();
    healthPhotoInput.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const ext = file.name.split('.').pop() || 'jpg';
      const sebayatId = mpState.editing;
      const path = `${sebayatId}/health-card-${Date.now()}.${ext}`;
      showToast('Uploading health card…', 'info');
      const { error: upErr } = await db.storage.from('profile-photos').upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) { showToast('Health card upload failed: ' + upErr.message, 'error'); return; }
      const { data: urlData } = db.storage.from('profile-photos').getPublicUrl(path);
      mpState.editData.health_card_photo_url = urlData.publicUrl;
      mpState.dirty = true;
      showToast('Health card uploaded', 'success');
      mpRerender();
    };
  }

  // ── Contact: extra phones ────────────────────────────────────
  $$('.mp-phone-extra').forEach(inp => {
    const i = parseInt(inp.dataset.mpPhoneIdx);
    inp.oninput = () => {
      const arr = [...(mpState.editData.extra_phones || [])];
      arr[i] = inp.value;
      mpState.editData.extra_phones = arr;
      mpState.dirty = true;
    };
  });
  $$('[data-mp-del-phone]').forEach(btn => {
    const i = parseInt(btn.dataset.mpDelPhone);
    btn.onclick = () => {
      const arr = [...(mpState.editData.extra_phones || [])];
      arr.splice(i, 1);
      mpState.editData.extra_phones = arr;
      mpState.dirty = true;
      mpRerender();
    };
  });
  const addPhoneBtn = $('#mp-add-phone');
  if (addPhoneBtn) addPhoneBtn.onclick = () => {
    mpState.editData.extra_phones = [...(mpState.editData.extra_phones || []), ''];
    mpState.dirty = true;
    mpRerender();
  };

  // ── Contact: ID documents ────────────────────────────────────
  $$('.mp-doc-type').forEach(sel => {
    const i = parseInt(sel.dataset.mpDocIdx);
    sel.onchange = () => {
      const docs = [...(mpState.editData.id_documents || [])];
      docs[i] = { ...(docs[i] || {}), id_type: sel.value };
      mpState.editData.id_documents = docs;
      mpState.dirty = true;
    };
  });
  $$('.mp-doc-photo-btn').forEach(btn => {
    btn.onclick = () => { const inp = $(`#mp-doc-photo-${btn.dataset.mpDocIdx}`); if (inp) inp.click(); };
  });
  $$('.mp-doc-photo-input').forEach(input => {
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const i = parseInt(input.dataset.mpDocIdx);
      const ext = file.name.split('.').pop() || 'jpg';
      const sebayatId = mpState.editing;
      const path = `${sebayatId}/id-doc-${i}-${Date.now()}.${ext}`;
      showToast('Uploading document photo…', 'info');
      const { error: upErr } = await db.storage.from('profile-photos').upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) { showToast('Upload failed: ' + upErr.message, 'error'); return; }
      const { data: urlData } = db.storage.from('profile-photos').getPublicUrl(path);
      const docs = [...(mpState.editData.id_documents || [])];
      docs[i] = { ...(docs[i] || {}), photo_url: urlData.publicUrl };
      mpState.editData.id_documents = docs;
      mpState.dirty = true;
      showToast('Document photo uploaded', 'success');
      mpRerender();
    };
  });
  $$('[data-mp-del-doc]').forEach(btn => {
    const i = parseInt(btn.dataset.mpDelDoc);
    btn.onclick = () => {
      const docs = [...(mpState.editData.id_documents || [])];
      docs.splice(i, 1);
      mpState.editData.id_documents = docs;
      mpState.dirty = true;
      mpRerender();
    };
  });
  const addDocBtn = $('#mp-add-doc');
  if (addDocBtn) addDocBtn.onclick = () => {
    mpState.editData.id_documents = [...(mpState.editData.id_documents || []), { id_type: '', photo_url: '' }];
    mpState.dirty = true;
    mpRerender();
  };

  // ── Family: father search ────────────────────────────────────
  const fatherSearch = $('#mp-father-search');
  if (fatherSearch) {
    fatherSearch.oninput = async () => {
      const q = fatherSearch.value.trim();
      mpState.editData.father_name = q;
      mpState.dirty = true;
      if (q.length < 2) { mpState.fatherSearchResults = []; mpRerender(); return; }
      mpState.fatherSearching = true;
      mpRerender();
      const { data } = await db.from('sebayats')
        .select('id,first_name,middle_name,last_name,full_name,date_of_birth,bansa_name')
        .or(`full_name.ilike.%${q}%,first_name.ilike.%${q}%,last_name.ilike.%${q}%`)
        .in('profile_status', ['submitted','resubmitted','approved'])
        .limit(15);
      mpState.fatherSearching = false;
      mpState.fatherSearchResults = data || [];
      mpRerender();
    };
  }
  $$('[data-mp-father-id]').forEach(el => {
    el.onclick = () => {
      mpState.editData.father_sebayat_id = el.dataset.mpFatherId;
      mpState.editData.father_name = el.dataset.mpFatherName;
      mpState.fatherSearchResults = [];
      mpState.dirty = true;
      mpRerender();
    };
  });
  const fatherUnlink = $('#mp-father-unlink');
  if (fatherUnlink) fatherUnlink.onclick = () => {
    mpState.editData.father_sebayat_id = null;
    mpState.fatherSearchResults = [];
    mpState.dirty = true;
    mpRerender();
  };

  // ── Family: child chips ──────────────────────────────────────
  $$('[data-mp-child-chip]').forEach(btn => {
    btn.onclick = () => {
      const i = parseInt(btn.dataset.mpChildChip);
      const field = btn.dataset.childField;
      const arr = [...(mpState.editData.children || [])];
      arr[i] = { ...(arr[i] || {}), [field]: btn.dataset.val };
      mpState.editData.children = arr;
      mpState.dirty = true;
      mpRerender();
    };
  });
  $$('.mp-child-name').forEach(inp => {
    const i = parseInt(inp.dataset.mpChildIdx);
    inp.oninput = () => {
      const arr = [...(mpState.editData.children || [])];
      arr[i] = { ...(arr[i] || {}), child_name: inp.value };
      mpState.editData.children = arr;
      mpState.dirty = true;
    };
  });
  $$('[data-mp-del-child]').forEach(btn => {
    const i = parseInt(btn.dataset.mpDelChild);
    btn.onclick = () => {
      const arr = [...(mpState.editData.children || [])];
      arr.splice(i, 1);
      mpState.editData.children = arr;
      mpState.dirty = true;
      mpRerender();
    };
  });
  const addChildBtn = $('#mp-add-child');
  if (addChildBtn) addChildBtn.onclick = () => {
    mpState.editData.children = [...(mpState.editData.children || []), { child_name: '', gender: '', marital_status: '' }];
    mpState.dirty = true;
    mpRerender();
  };

  // ── Occupation: joining date toggle ─────────────────────────
  const joiningExact = $('#mp-joining-exact');
  if (joiningExact) joiningExact.onchange = () => { mpState.editData.joining_date_exact = joiningExact.checked; mpState.dirty = true; mpRerender(); };

  // ── Occupation: occupation cards ─────────────────────────────
  $$('.mp-occ-field').forEach(inp => {
    const i = parseInt(inp.dataset.mpOccIdx);
    const key = inp.dataset.mpOccKey;
    inp.oninput = () => {
      const arr = [...(mpState.editData.occupations || [])];
      arr[i] = { ...(arr[i] || {}), [key]: inp.value };
      mpState.editData.occupations = arr;
      mpState.dirty = true;
    };
  });
  $$('[data-mp-del-occ]').forEach(btn => {
    const i = parseInt(btn.dataset.mpDelOcc);
    btn.onclick = () => {
      const arr = [...(mpState.editData.occupations || [])];
      arr.splice(i, 1);
      mpState.editData.occupations = arr;
      mpState.dirty = true;
      mpRerender();
    };
  });
  const addOccBtn = $('#mp-add-occ');
  if (addOccBtn) addOccBtn.onclick = () => {
    mpState.editData.occupations = [...(mpState.editData.occupations || []), { occupation: '', extra_curriculum_activity: '' }];
    mpState.dirty = true;
    mpRerender();
  };

  // ── Seba: beddha grid ────────────────────────────────────────
  $$('[data-mp-seba-toggle]').forEach(el => {
    el.onclick = () => {
      const catId = el.dataset.mpSebaToggle;
      if (!mpState.sebaExpanded) mpState.sebaExpanded = {};
      mpState.sebaExpanded[catId] = !mpState.sebaExpanded[catId];
      mpRerender();
    };
  });
  $$('[data-mp-beddha-cat]').forEach(pill => {
    pill.onclick = () => {
      const catId = pill.getAttribute('data-mp-beddha-cat');
      const num = parseInt(pill.getAttribute('data-mp-beddha-num'));
      if (!mpState.editData.sebaSelections) mpState.editData.sebaSelections = {};
      const arr = [...(mpState.editData.sebaSelections[catId] || [])];
      const idx = arr.indexOf(num);
      if (idx === -1) arr.push(num); else arr.splice(idx, 1);
      mpState.editData.sebaSelections[catId] = arr;
      mpState.dirty = true;
      mpRerender();
    };
  });
}

// ============================================================
// NIJOG VIEW — table grid with expandable beddha detail
// ============================================================
const nvState = {
  year: new Date().getFullYear(),
  loading: false,
  rows: [],        // raw assignment rows joined with sebayat + category
  search: '',
  expanded: null,  // sebayat_id of expanded row, or null
};

// Build grouped structure: [{ sebayat, totalBeddhas, cats: [{catName, nums}] }]
function nvBuildGroups() {
  const bySeb = {};
  for (const r of nvState.rows) {
    const key = r.sebayat_id;
    if (!bySeb[key]) bySeb[key] = { sebayat: r.sebayat, cats: {} };
    if (!bySeb[key].cats[r.cat_name]) bySeb[key].cats[r.cat_name] = [];
    bySeb[key].cats[r.cat_name].push(r.beddha_number);
  }
  const q = nvState.search.toLowerCase().trim();
  let groups = Object.entries(bySeb).map(([sebId, g]) => ({
    sebayat_id: sebId,
    sebayat: g.sebayat,
    cats: Object.entries(g.cats)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([catName, nums]) => ({ catName, nums: nums.slice().sort((a, b) => a - b) })),
    totalBeddhas: Object.values(g.cats).reduce((s, arr) => s + arr.length, 0),
  }));
  if (q) groups = groups.filter(g => {
    const name = getName(g.sebayat).toLowerCase();
    const reg = (g.sebayat?.registration_no || '').toLowerCase();
    const phone = (g.sebayat?.phone_number || '').toLowerCase();
    const cats = g.cats.map(c => c.catName).join(' ').toLowerCase();
    return name.includes(q) || reg.includes(q) || phone.includes(q) || cats.includes(q);
  });
  groups.sort((a, b) => getName(a.sebayat).localeCompare(getName(b.sebayat)));
  return groups;
}

// ============================================================
// SEBA CALENDAR (anchor settings + today's roster + date picker)
// ============================================================
function beddhaForDate(group, isoDate) {
  if (!group) return null;
  const anchor = new Date(group.anchor_date + 'T00:00:00');
  const target = new Date(isoDate + 'T00:00:00');
  const diff = Math.round((target - anchor) / 86400000);
  const c = group.beddha_count;
  const off = (((diff + (group.anchor_beddha - 1)) % c) + c) % c;
  return off + 1;
}

function renderSebaCalendar() {
  const groups = state.sebaGroups;
  if (!groups.length) {
    return `<div class="page"><div class="page-head"><h1>Seba Calendar</h1></div><div class="empty">No seba groups configured.</div></div>`;
  }
  const today = new Date().toISOString().slice(0,10);

  // Sort: Pratihari first, then others
  const sorted = [...groups].sort((a, b) => {
    if (a.code === 'pratihari') return -1;
    if (b.code === 'pratihari') return 1;
    return a.name.localeCompare(b.name);
  });

  const todayLabel = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  // Hero beddha chips
  const heroChips = sorted.map(g => {
    const b = beddhaForDate(g, today);
    const isPratihari = g.code === 'pratihari';
    return `
      <div class="sc-hero-chip ${isPratihari ? 'sc-hero-chip--primary' : 'sc-hero-chip--secondary'}">
        <div class="sc-hero-chip-label">${esc(g.name)}</div>
        <div class="sc-hero-chip-beddha">#${b}</div>
      </div>
    `;
  }).join('');

  const calHTML = renderMonthCalendar();

  return `
    <div class="page sc-page">
      <!-- Hero banner -->
      <div class="sc-hero">
        <div class="sc-hero-left">
          <div class="sc-today-label">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            <span>Today — ${esc(todayLabel)}</span>
          </div>
          <h1 class="sc-hero-title">Seba Calendar</h1>
          <p class="sc-hero-desc">Click any date to see its beddha &amp; roster</p>
        </div>
        <div class="sc-hero-chips">
          ${heroChips}
        </div>
      </div>

      <!-- Monthly calendar -->
      <div class="sc-section-label">Monthly Calendar</div>
      ${calHTML}
    </div>
  `;
}

// ── Monthly calendar ──────────────────────────────────────────
function renderMonthCalendar() {
  const groups = state.sebaGroups;
  const year = state.scCalYear;
  const month = state.scCalMonth;
  const today = new Date().toISOString().slice(0,10);

  const monthLabel = new Date(year, month, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  // Sorted groups: pratihari first
  const sorted = [...groups].sort((a, b) => {
    if (a.code === 'pratihari') return -1;
    if (b.code === 'pratihari') return 1;
    return a.name.localeCompare(b.name);
  });

  // Days in month, first weekday (0=Sun)
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstWeekday = new Date(year, month, 1).getDay();

  const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const headerCells = DAY_NAMES.map(d => `<div class="sc-cal-header-cell">${d}</div>`).join('');

  const cells = [];
  // Leading empty cells
  for (let i = 0; i < firstWeekday; i++) {
    cells.push(`<div class="sc-cal-cell sc-cal-cell--empty"></div>`);
  }
  // Day cells
  for (let day = 1; day <= daysInMonth; day++) {
    const iso = `${year}-${String(month + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const isToday = iso === today;
    const isPast = iso < today;

    const chips = sorted.map(g => {
      const b = beddhaForDate(g, iso);
      const cls = g.code === 'pratihari' ? 'sc-cal-chip-p' : 'sc-cal-chip-g';
      const lbl = g.code === 'pratihari' ? 'P' : 'G';
      return `<span class="${cls}">${lbl}:${b}</span>`;
    }).join('');

    cells.push(`
      <button class="sc-cal-cell${isToday ? ' sc-cal-cell--today' : ''}${isPast ? ' sc-cal-cell--past' : ''}" data-date="${iso}" type="button">
        <div class="sc-cal-day-num">${day}</div>
        <div class="sc-cal-chips">${chips}</div>
      </button>
    `);
  }
  // Trailing empties to complete the last row
  const total = firstWeekday + daysInMonth;
  const trailing = (7 - (total % 7)) % 7;
  for (let i = 0; i < trailing; i++) {
    cells.push(`<div class="sc-cal-cell sc-cal-cell--empty"></div>`);
  }

  return `
    <div class="card sc-cal-card" style="margin-bottom:28px">
      <div class="sc-cal-nav">
        <button class="icon-btn sc-cal-prev" type="button" aria-label="Previous month">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div class="sc-cal-month-label">${esc(monthLabel)}</div>
        <button class="icon-btn sc-cal-next" type="button" aria-label="Next month">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
        <button class="btn btn-ghost btn-sm sc-cal-today-btn" type="button" style="margin-left:8px">Today</button>
        <div class="sc-cal-jump">
          <div class="sc-cal-jump-input-wrap">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="flex-shrink:0;color:var(--ink4)"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            <input type="date" id="sc-cal-jump-date" class="sc-cal-jump-date" value="${year}-${String(month+1).padStart(2,'0')}-01" aria-label="Jump to date"/>
          </div>
          <button class="btn btn-sm sc-cal-jump-go" type="button">Go</button>
        </div>
      </div>
      <div class="sc-cal-legend">
        <span class="sc-cal-chip-p" style="padding:2px 8px">Pratihari beddha</span> &nbsp;
        <span class="sc-cal-chip-g" style="padding:2px 8px">Gochhikar beddha</span> &nbsp;&nbsp;
        <span style="color:var(--ink4);font-size:12px">· Click any date for roster</span>
      </div>
      <div class="sc-cal-grid">
        ${headerCells}
        ${cells.join('')}
      </div>
    </div>
  `;
}

// ── Day modal ────────────────────────────────────────────────
async function openDayModal(isoDate) {
  const groups = [...state.sebaGroups].sort((a, b) => {
    if (a.code === 'pratihari') return -1;
    if (b.code === 'pratihari') return 1;
    return a.name.localeCompare(b.name);
  });

  const dateLabel = new Date(isoDate + 'T00:00:00').toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });

  // Show modal immediately with beddha numbers (no DB call needed)
  const beddhaChips = groups.map(g => {
    const b = beddhaForDate(g, isoDate);
    const isPratihari = g.code === 'pratihari';
    return `
      <div class="sc-modal-group ${isPratihari ? 'sc-modal-group--primary' : 'sc-modal-group--secondary'}">
        <div class="sc-modal-group-name">${esc(g.name)}</div>
        <div class="sc-modal-group-beddha">#${b}</div>
      </div>
    `;
  }).join('');

  const overlay = $('#modal-overlay');
  const modal = $('#modal');

  const renderContent = (rosterHTML) => `
    <div class="sc-day-modal">
      <div class="sc-day-modal-header">
        <div>
          <div class="sc-day-modal-date">${esc(dateLabel)}</div>
          <div class="sc-day-modal-sub">Beddha assignment &amp; serving sebayats</div>
        </div>
        <button class="icon-btn sc-day-modal-close" type="button" aria-label="Close">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div class="sc-day-modal-chips">${beddhaChips}</div>
      <div class="sc-day-modal-roster" id="sc-day-roster">${rosterHTML}</div>
    </div>
  `;

  modal.className = 'modal modal--wide';
  modal.innerHTML = renderContent(`<div class="sc-day-modal-loading">Loading roster…</div>`);
  overlay.classList.add('open');

  const closeBtn = modal.querySelector('.sc-day-modal-close');
  if (closeBtn) closeBtn.onclick = closeDayModal;

  // Fetch roster (cached)
  let cached = state.scCalRosterCache[isoDate];
  if (!cached) {
    const { data: scheds } = await db.from('seba_schedule').select('id,group_id,beddha_number').eq('service_date', isoDate);
    const ids = (scheds || []).map(s => s.id);
    let roster = [];
    if (ids.length) {
      const { data } = await db.from('seba_roster')
        .select('id,schedule_id,sebayat_id,seba_category_id,beddha_number,is_absent,notes')
        .in('schedule_id', ids);
      roster = data || [];
    }
    cached = { scheds: scheds || [], roster };
    state.scCalRosterCache[isoDate] = cached;
  }

  // Build roster HTML per group
  const rosterBlocks = groups.map(g => {
    const sched = cached.scheds.find(s => s.group_id === g.id);
    if (!sched) return `
      <div class="sc-roster-block">
        <div class="sc-roster-block-title">${esc(g.name)}</div>
        <div class="sc-roster-empty">No schedule row for this date.</div>
      </div>
    `;
    const rows = cached.roster.filter(r => r.schedule_id === sched.id);
    if (!rows.length) return `
      <div class="sc-roster-block">
        <div class="sc-roster-block-title">${esc(g.name)}</div>
        <div class="sc-roster-empty">No sebayats assigned for this date.</div>
      </div>
    `;
    const byCat = {};
    for (const r of rows) {
      const cat = state.sebaCategories.find(c => c.id === r.seba_category_id);
      const catName = cat ? cat.name : 'Unknown Category';
      if (!byCat[catName]) byCat[catName] = [];
      const seb = state.sebayats.find(s => s.id === r.sebayat_id);
      byCat[catName].push(seb ? getName(seb) : 'Unknown Sebayat');
    }
    const catRows = Object.keys(byCat).sort().map(catName => `
      <div class="sc-roster-cat-row">
        <div class="sc-roster-cat-name">${esc(catName)}</div>
        <div class="sc-roster-cat-sebayats">${byCat[catName].map(n => `<span class="sc-roster-sebayat-chip">${esc(n)}</span>`).join('')}</div>
      </div>
    `).join('');
    return `
      <div class="sc-roster-block">
        <div class="sc-roster-block-title">${esc(g.name)}</div>
        ${catRows}
      </div>
    `;
  }).join('');

  const rosterEl = modal.querySelector('#sc-day-roster');
  if (rosterEl) rosterEl.innerHTML = rosterBlocks;
}

function closeDayModal() {
  $('#modal-overlay').classList.remove('open');
  $('#modal').className = 'modal';
}

function renderAnchorCard(g) {
  const today = new Date().toISOString().slice(0,10);
  const todayBeddha = beddhaForDate(g, today);
  const edit = state.scAnchorEdits[g.id] || { anchor_date: g.anchor_date, anchor_beddha: g.anchor_beddha };
  const dirty = edit.anchor_date !== g.anchor_date || Number(edit.anchor_beddha) !== g.anchor_beddha;
  const isPratihari = g.code === 'pratihari';
  const previewG = { ...g, anchor_date: edit.anchor_date, anchor_beddha: Number(edit.anchor_beddha) || 1 };
  const previewRows = [];
  for (let i = 0; i < 14; i++) {
    const d = new Date(); d.setDate(d.getDate() + i);
    const iso = d.toISOString().slice(0,10);
    const isToday = iso === today;
    previewRows.push(`<tr ${isToday ? 'class="sc-preview-today"' : ''}><td>${esc(iso)}${isToday ? ' <span class="pill" style="font-size:10px;padding:1px 6px;background:#fef9c3;color:#854d0e">today</span>' : ''}</td><td><span class="pill pill-blue">#${beddhaForDate(previewG, iso)}</span></td></tr>`);
  }
  return `
    <div class="card sc-anchor-card ${isPratihari ? 'sc-anchor-card--primary' : ''}">
      <div class="sc-anchor-card-head">
        <div class="sc-anchor-card-info">
          <div class="sc-anchor-card-name">${esc(g.name)}</div>
          <div class="sc-anchor-card-meta">${g.beddha_count}-beddha cycle · anchor ${esc(g.anchor_date)}</div>
        </div>
        <div class="sc-anchor-today-badge">
          <div class="sc-anchor-today-lbl">Today's beddha</div>
          <div class="sc-anchor-today-num">#${todayBeddha}</div>
        </div>
      </div>
      <div class="card-body" style="padding-top:0">
        <div class="sc-anchor-divider"></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">
          <div class="field">
            <label>Anchor date</label>
            <input type="date" class="input sc-anchor-date" data-group="${g.id}" value="${esc(edit.anchor_date)}" />
          </div>
          <div class="field">
            <label>Anchor beddha (1 – ${g.beddha_count})</label>
            <input type="number" min="1" max="${g.beddha_count}" class="input sc-anchor-beddha" data-group="${g.id}" value="${esc(String(edit.anchor_beddha))}" />
          </div>
        </div>
        <details class="sc-preview-details">
          <summary>14-day beddha preview</summary>
          <table class="data-table compact" style="margin-top:10px">
            <thead><tr><th>Date</th><th>Beddha</th></tr></thead>
            <tbody>${previewRows.join('')}</tbody>
          </table>
        </details>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px">
          <button class="btn btn-ghost btn-sm sc-anchor-reset" data-group="${g.id}" ${dirty ? '' : 'disabled'}>Reset</button>
          <button class="btn ${isPratihari ? 'btn-primary' : 'btn-primary'} btn-sm sc-anchor-save" data-group="${g.id}" ${dirty ? '' : 'disabled'}>
            ${dirty ? 'Save anchor' : 'No changes'}
          </button>
        </div>
      </div>
    </div>
  `;
}

function renderDateRoster(isoDate) {
  const groups = state.sebaGroups;
  if (!groups.length) return '<div class="empty">No groups.</div>';
  const blocks = groups.map(g => {
    const beddha = beddhaForDate(g, isoDate);
    // Find roster: query in-memory if today, else show category list with beddha highlighted; live data only loaded for today
    if (isoDate === new Date().toISOString().slice(0,10)) {
      const sched = state.scheduleToday[g.id];
      const roster = sched ? state.rosterToday.filter(r => r.schedule_id === sched.id) : [];
      const byCat = {};
      for (const r of roster) {
        const cat = state.sebaCategories.find(c => c.id === r.seba_category_id);
        const name = cat ? cat.name : '—';
        if (!byCat[name]) byCat[name] = [];
        const seb = state.sebayats.find(s => s.id === r.sebayat_id);
        byCat[name].push(seb ? getName(seb) : 'Unknown');
      }
      const list = Object.keys(byCat).length
        ? Object.keys(byCat).sort().map(k => `<div style="margin-bottom:8px"><div style="font-weight:600;color:var(--ink2);font-size:13px">${esc(k)}</div><div style="color:var(--ink3);font-size:13px">${byCat[k].map(esc).join(', ')}</div></div>`).join('')
        : '<div class="empty" style="padding:8px 0">No sebayats serving in this group today.</div>';
      return `
        <div class="sc-group-block">
          <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px">
            <div style="font-weight:700;font-size:15px">${esc(g.name)}</div>
            <span class="pill pill-blue">Beddha #${beddha}</span>
          </div>
          ${list}
        </div>
      `;
    }
    return `
      <div class="sc-group-block">
        <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px">
          <div style="font-weight:700;font-size:15px">${esc(g.name)}</div>
          <span class="pill pill-blue">Beddha #${beddha}</span>
        </div>
        <div id="sc-roster-${g.id}" style="color:var(--ink4);font-size:13px">Loading roster…</div>
      </div>
    `;
  }).join('');
  return `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:18px">${blocks}</div>`;
}

function renderAnchorHistory() {
  if (!state.anchorHistory.length) return '<div class="empty" style="padding:8px 0">No anchor changes recorded yet.</div>';
  const groups = Object.fromEntries(state.sebaGroups.map(g => [g.id, g.name]));
  const rows = state.anchorHistory.map(h => `
    <tr>
      <td>${esc(fmtDate(h.changed_at, true))}</td>
      <td>${esc(groups[h.group_id] || '—')}</td>
      <td>${esc(h.old_anchor_date || '—')} → ${esc(h.new_anchor_date)}</td>
      <td>${esc(String(h.old_anchor_beddha || '—'))} → ${esc(String(h.new_anchor_beddha))}</td>
      <td>${esc(h.reason || '—')}</td>
    </tr>
  `).join('');
  return `<table class="data-table compact"><thead><tr><th>When</th><th>Group</th><th>Anchor date</th><th>Anchor beddha</th><th>Reason</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function attachSebaCalendarHandlers() {
  // Calendar month navigation
  const prevBtn = $('.sc-cal-prev');
  const nextBtn = $('.sc-cal-next');
  const todayBtn = $('.sc-cal-today-btn');
  if (prevBtn) prevBtn.onclick = () => {
    let m = state.scCalMonth - 1;
    let y = state.scCalYear;
    if (m < 0) { m = 11; y--; }
    state.scCalMonth = m; state.scCalYear = y;
    render();
  };
  if (nextBtn) nextBtn.onclick = () => {
    let m = state.scCalMonth + 1;
    let y = state.scCalYear;
    if (m > 11) { m = 0; y++; }
    state.scCalMonth = m; state.scCalYear = y;
    render();
  };
  if (todayBtn) todayBtn.onclick = () => {
    const now = new Date();
    state.scCalMonth = now.getMonth();
    state.scCalYear = now.getFullYear();
    render();
  };

  // Jump-to-date
  const jumpGo = $('.sc-cal-jump-go');
  const jumpInput = $('#sc-cal-jump-date');
  const doJump = () => {
    const val = jumpInput && jumpInput.value;
    if (!val) return;
    const d = new Date(val + 'T00:00:00');
    if (isNaN(d)) return;
    state.scCalMonth = d.getMonth();
    state.scCalYear = d.getFullYear();
    render();
    // Open day modal after render
    setTimeout(() => openDayModal(val), 50);
  };
  if (jumpGo) jumpGo.onclick = doJump;
  if (jumpInput) jumpInput.onkeydown = (e) => { if (e.key === 'Enter') doJump(); };

  // Day cell click → open modal
  $$('.sc-cal-cell[data-date]').forEach(cell => {
    cell.onclick = () => openDayModal(cell.dataset.date);
  });
}

async function loadRosterForDate(isoDate) {
  const { data: scheds } = await db.from('seba_schedule').select('id,group_id,beddha_number').eq('service_date', isoDate);
  if (!scheds || !scheds.length) return;
  const ids = scheds.map(s => s.id);
  const { data: roster } = await db.from('seba_roster').select('id,schedule_id,sebayat_id,seba_category_id,beddha_number').in('schedule_id', ids);
  for (const g of state.sebaGroups) {
    const sched = scheds.find(s => s.group_id === g.id);
    const slot = $('#sc-roster-' + g.id);
    if (!slot) continue;
    if (!sched) { slot.textContent = 'No schedule row for this date.'; continue; }
    const rows = (roster || []).filter(r => r.schedule_id === sched.id);
    const byCat = {};
    for (const r of rows) {
      const cat = state.sebaCategories.find(c => c.id === r.seba_category_id);
      const name = cat ? cat.name : '—';
      if (!byCat[name]) byCat[name] = [];
      const seb = state.sebayats.find(s => s.id === r.sebayat_id);
      byCat[name].push(seb ? getName(seb) : 'Unknown');
    }
    if (!Object.keys(byCat).length) { slot.textContent = 'No sebayats assigned.'; continue; }
    slot.innerHTML = Object.keys(byCat).sort().map(k =>
      `<div style="margin-bottom:6px"><div style="font-weight:600;color:var(--ink2);font-size:13px">${esc(k)}</div><div style="color:var(--ink3);font-size:13px">${byCat[k].map(esc).join(', ')}</div></div>`
    ).join('');
  }
}

async function saveAnchor(groupId) {
  const g = state.sebaGroups.find(x => x.id === groupId);
  const edit = state.scAnchorEdits[groupId];
  if (!g || !edit) return;
  const newDate = edit.anchor_date;
  const newBeddha = parseInt(edit.anchor_beddha, 10);
  if (!newDate || !newBeddha || newBeddha < 1 || newBeddha > g.beddha_count) {
    showToast('Invalid anchor values', 'error'); return;
  }
  showConfirm({
    title: `Save Anchor — ${g.name}`,
    message: 'This will regenerate every future date in this group\'s cycle. Past dates remain frozen and unchanged.',
    confirmLabel: 'Save Anchor',
    danger: false,
    onConfirm: async () => {
      setLoading(true);
      // 1) write history first
      const histRes = await db.from('seba_group_anchor_history').insert({
        group_id: g.id,
        old_anchor_date: g.anchor_date,
        old_anchor_beddha: g.anchor_beddha,
        new_anchor_date: newDate,
        new_anchor_beddha: newBeddha,
        changed_by: state.user?.id,
        reason: 'admin edit',
      });
      if (histRes.error) { setLoading(false); showToast('Failed to write history: ' + histRes.error.message, 'error'); return; }

      // 2) update group
      const upd = await db.from('seba_groups').update({
        anchor_date: newDate,
        anchor_beddha: newBeddha,
        updated_at: new Date().toISOString(),
      }).eq('id', g.id);
      if (upd.error) { setLoading(false); showToast('Failed to update anchor: ' + upd.error.message, 'error'); return; }

      // 3) delete future schedule rows so regenerate fills with new beddhas
      const today = new Date().toISOString().slice(0,10);
      await db.from('seba_schedule').delete().eq('group_id', g.id).gte('service_date', today);

      // 4) ask DB to regenerate schedule + future roster
      const through = new Date(); through.setFullYear(through.getFullYear() + 5);
      await db.rpc('regenerate_schedule', { p_group_id: g.id, p_through_date: through.toISOString().slice(0,10) });
      await db.rpc('regenerate_all_future_roster');

      delete state.scAnchorEdits[groupId];
      logActivity('anchor_changed', 'seba_calendar', g.id, g.name,
        { anchor_date: g.anchor_date, anchor_beddha: g.anchor_beddha },
        { anchor_date: newDate, anchor_beddha: newBeddha }
      );
      await loadAll();
      setLoading(false);
      showToast('Anchor saved and future schedule regenerated', 'success');
      if (state.view === 'settings') {
        const c = $('#view-container');
        if (c) { c.innerHTML = renderSettingsView(); attachSettingsHandlers(); }
      }
    },
  });
}

// ============================================================
// SETTINGS (super admin only)
// ============================================================
function renderSettingsView() {
  const groups = state.sebaGroups;
  const sorted = [...groups].sort((a, b) => {
    if (a.code === 'pratihari') return -1;
    if (b.code === 'pratihari') return 1;
    return a.name.localeCompare(b.name);
  });
  const cards = sorted.map(g => renderAnchorCard(g)).join('');
  const history = renderAnchorHistory();

  const smsOn = state.otpSettings.otp_sms_enabled;
  const waOn = state.otpSettings.otp_whatsapp_enabled;

  return `
    <div class="page">
      <div class="page-head">
        <div>
          <h1 class="page-title">Settings</h1>
          <div class="page-sub">Super admin configuration — OTP channels, cycle anchors &amp; history</div>
        </div>
        <div class="pill" style="background:var(--saffron-light,#fff7ed);color:var(--saffron);font-size:12px;font-weight:600;padding:4px 10px;border-radius:20px;display:flex;align-items:center;gap:5px">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          Super Admin Only
        </div>
      </div>

      <div class="sc-section-label" style="margin-top:24px">OTP Login Channels</div>
      <div class="card" style="margin-bottom:24px">
        <div class="card-body" style="padding:20px 24px">
          <div style="font-size:13px;color:var(--text-muted);margin-bottom:16px">
            Control which OTP delivery channels are available to users on the login screen.
            At least one channel must remain enabled.
          </div>
          <div style="display:flex;flex-direction:column;gap:0">
            <div class="otp-channel-row" style="display:flex;align-items:center;justify-content:space-between;padding:14px 0;border-bottom:1px solid var(--border)">
              <div style="display:flex;align-items:center;gap:12px">
                <div style="width:36px;height:36px;border-radius:8px;background:#FEF3C7;display:flex;align-items:center;justify-content:center">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#B45309" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 11.5a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 8.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                </div>
                <div>
                  <div style="font-weight:600;font-size:14px;color:var(--text)">SMS</div>
                  <div style="font-size:12px;color:var(--text-muted)">Deliver OTP via text message (MSG91)</div>
                </div>
              </div>
              <button
                id="toggle-otp-sms"
                class="otp-toggle-btn ${smsOn ? 'active' : ''}"
                onclick="actions.toggleOtpChannel('sms', ${smsOn})"
                style="position:relative;width:48px;height:26px;border-radius:13px;border:none;cursor:pointer;transition:background 0.2s;background:${smsOn ? 'var(--saffron,#c2762a)' : '#D1D5DB'};flex-shrink:0"
                ${!smsOn && !waOn ? 'disabled' : ''}
              >
                <span style="position:absolute;top:3px;left:${smsOn ? '25px' : '3px'};width:20px;height:20px;border-radius:50%;background:#fff;transition:left 0.2s;box-shadow:0 1px 3px rgba(0,0,0,0.2)"></span>
              </button>
            </div>
            <div class="otp-channel-row" style="display:flex;align-items:center;justify-content:space-between;padding:14px 0">
              <div style="display:flex;align-items:center;gap:12px">
                <div style="width:36px;height:36px;border-radius:8px;background:#DCFCE7;display:flex;align-items:center;justify-content:center">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16A34A" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
                </div>
                <div>
                  <div style="font-weight:600;font-size:14px;color:var(--text)">WhatsApp</div>
                  <div style="font-size:12px;color:var(--text-muted)">Deliver OTP via WhatsApp message (MSG91)</div>
                </div>
              </div>
              <button
                id="toggle-otp-whatsapp"
                class="otp-toggle-btn ${waOn ? 'active' : ''}"
                onclick="actions.toggleOtpChannel('whatsapp', ${waOn})"
                style="position:relative;width:48px;height:26px;border-radius:13px;border:none;cursor:pointer;transition:background 0.2s;background:${waOn ? '#16A34A' : '#D1D5DB'};flex-shrink:0"
                ${!waOn && !smsOn ? 'disabled' : ''}
              >
                <span style="position:absolute;top:3px;left:${waOn ? '25px' : '3px'};width:20px;height:20px;border-radius:50%;background:#fff;transition:left 0.2s;box-shadow:0 1px 3px rgba(0,0,0,0.2)"></span>
              </button>
            </div>
          </div>
          ${(!smsOn || !waOn) ? `<div style="margin-top:12px;padding:10px 12px;background:#FEF9C3;border-radius:6px;font-size:12px;color:#854D0E;display:flex;align-items:center;gap:6px">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            ${!smsOn && !waOn ? 'Both channels are disabled — users cannot log in. Enable at least one.' : `${!smsOn ? 'SMS' : 'WhatsApp'} is currently disabled.`}
          </div>` : ''}
        </div>
      </div>

      <div class="sc-section-label">Cycle Anchor Settings</div>
      ${groups.length
        ? `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(420px,1fr));gap:16px;margin-bottom:28px">${cards}</div>`
        : `<div class="card"><div class="card-body empty">No seba groups configured.</div></div>`
      }

      <div class="sc-section-label">Anchor Change History</div>
      <div class="card">
        <div class="card-body">${history}</div>
      </div>
    </div>
  `;
}

function attachSettingsHandlers() {
  $$('.sc-anchor-date, .sc-anchor-beddha').forEach(inp => {
    inp.oninput = () => {
      const id = inp.dataset.group;
      const g = state.sebaGroups.find(x => x.id === id);
      if (!g) return;
      const cur = state.scAnchorEdits[id] || { anchor_date: g.anchor_date, anchor_beddha: g.anchor_beddha };
      if (inp.classList.contains('sc-anchor-date')) cur.anchor_date = inp.value;
      else cur.anchor_beddha = inp.value;
      state.scAnchorEdits[id] = cur;
      const c = $('#view-container');
      if (c && state.view === 'settings') { c.innerHTML = renderSettingsView(); attachSettingsHandlers(); }
    };
  });
  $$('.sc-anchor-reset').forEach(btn => {
    btn.onclick = () => {
      delete state.scAnchorEdits[btn.dataset.group];
      const c = $('#view-container');
      if (c && state.view === 'settings') { c.innerHTML = renderSettingsView(); attachSettingsHandlers(); }
    };
  });
  $$('.sc-anchor-save').forEach(btn => {
    btn.onclick = () => saveAnchor(btn.dataset.group);
  });
}

function renderNijogView() {
  const years = [];
  const cy = new Date().getFullYear();
  for (let y = cy + 1; y >= cy - 3; y--) years.push(y);

  return `
  <div class="nv-wrap">
    <div class="nv-toolbar">
      <div class="nv-toolbar-left">
        <div class="field-inline">
          <label class="field-label-sm">Year</label>
          <select class="select-sm" id="nv-year">${years.map(y => `<option value="${y}"${y === nvState.year ? ' selected' : ''}>${y}</option>`).join('')}</select>
        </div>
        <div class="nv-search-wrap">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input class="nv-search" id="nv-search" placeholder="Search by name, reg no, phone…" value="${esc(nvState.search)}" />
          ${nvState.search ? `<button class="nv-search-clear" id="nv-search-clear" title="Clear">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>` : ''}
        </div>
      </div>
      <button class="btn btn-primary btn-sm" id="nv-load-btn" ${nvState.loading ? 'disabled' : ''}>
        ${nvState.loading
          ? `<span class="nv-btn-spinner"></span> Loading…`
          : `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="23 4 23 10 17 10"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10"/><polyline points="1 20 1 14 7 14"/><path d="M20.49 15a9 9 0 0 1-14.85 3.36L1 14"/></svg> Load`}
      </button>
    </div>
    <div id="nv-content">${nvRenderContent()}</div>
  </div>`;
}

function nvRenderContent() {
  if (nvState.loading) {
    return `<div class="nv-empty"><div class="nv-spinner"></div><div class="nv-empty-text">Loading assignments…</div></div>`;
  }
  if (!nvState.rows.length) {
    return `<div class="nv-empty">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="color:var(--ink5)"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 12h6M9 16h4"/></svg>
      <div class="nv-empty-title">No assignments loaded</div>
      <div class="nv-empty-text">Select a year and click <strong>Load</strong> to view nijog assignments.</div>
    </div>`;
  }

  const groups = nvBuildGroups();
  const totalSeb = groups.length;
  const totalBed = groups.reduce((s, g) => s + g.totalBeddhas, 0);

  if (!groups.length) {
    return `<div class="nv-empty"><div class="nv-empty-title">No results</div><div class="nv-empty-text">No sebayats match your search.</div></div>`;
  }

  const rows = groups.map(g => {
    const name = getName(g.sebayat);
    const initials = getInitials(g.sebayat);
    const reg = g.sebayat?.registration_no || '—';
    const phone = g.sebayat?.phone_number || '—';
    const isOpen = nvState.expanded === g.sebayat_id;

    const expandedRow = isOpen ? `
      <tr class="nv-expand-row" data-seb="${g.sebayat_id}">
        <td colspan="5" class="nv-expand-cell">
          <div class="nv-expand-inner">
            ${g.cats.map(c => `
              <div class="nv-expand-cat">
                <span class="nv-expand-cat-name">${esc(c.catName)}</span>
                <span class="nv-chips">${c.nums.map(n => `<span class="nv-chip">${n}</span>`).join('')}</span>
              </div>`).join('')}
          </div>
        </td>
      </tr>` : '';

    return `
      <tr class="nv-row${isOpen ? ' nv-row--open' : ''}" data-seb="${g.sebayat_id}">
        <td class="nv-td nv-td--name">
          <div class="nv-row-identity">
            <div class="nv-avatar nv-avatar--sm">${esc(initials)}</div>
            <span class="nv-row-name">${esc(name)}</span>
          </div>
        </td>
        <td class="nv-td nv-td--reg">${esc(reg)}</td>
        <td class="nv-td nv-td--phone">${esc(phone)}</td>
        <td class="nv-td nv-td--count">
          <span class="nv-count-badge">${g.totalBeddhas} beddha${g.totalBeddhas !== 1 ? 's' : ''}</span>
        </td>
        <td class="nv-td nv-td--toggle">
          <button class="nv-expand-btn${isOpen ? ' open' : ''}" data-seb="${g.sebayat_id}" title="${isOpen ? 'Collapse' : 'View beddhas'}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
        </td>
      </tr>
      ${expandedRow}`;
  }).join('');

  return `
    <div class="nv-summary-bar">
      <span class="nv-stat"><strong>${totalSeb}</strong> sebayat${totalSeb !== 1 ? 's' : ''} assigned</span>
      <span class="nv-stat-sep">·</span>
      <span class="nv-stat"><strong>${totalBed}</strong> total beddha${totalBed !== 1 ? 's' : ''}</span>
      <span class="nv-stat-sep">·</span>
      <span class="nv-stat">Year <strong>${nvState.year}</strong></span>
    </div>
    <div class="nv-table-wrap">
      <table class="nv-table">
        <thead>
          <tr>
            <th class="nv-th">Sebayat</th>
            <th class="nv-th">Reg No.</th>
            <th class="nv-th">Phone</th>
            <th class="nv-th">Beddhas</th>
            <th class="nv-th nv-th--action"></th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

async function nvLoad() {
  nvState.loading = true;
  nvState.rows = [];
  nvState.expanded = null;
  const c = $('#nv-content');
  if (c) c.innerHTML = nvRenderContent();

  const { data, error } = await db
    .from('nijog_assignments')
    .select('*, sebayat:sebayat_id(*), cat:seba_category_id(id,name)')
    .eq('year', nvState.year);

  nvState.loading = false;

  if (error) {
    showToast('Failed to load assignments: ' + error.message, 'error');
    if (c) c.innerHTML = nvRenderContent();
    return;
  }

  nvState.rows = (data || []).map(r => ({ ...r, cat_name: r.cat?.name || '—' }));
  if (c) c.innerHTML = nvRenderContent();
  nvAttachContentHandlers();
}

function nvAttachContentHandlers() {
  $$('.nv-expand-btn').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const sebId = btn.dataset.seb;
      nvState.expanded = nvState.expanded === sebId ? null : sebId;
      const c = $('#nv-content');
      if (c) c.innerHTML = nvRenderContent();
      nvAttachContentHandlers();
    };
  });
  // clicking the row itself also toggles
  $$('.nv-row').forEach(tr => {
    tr.onclick = () => {
      const sebId = tr.dataset.seb;
      nvState.expanded = nvState.expanded === sebId ? null : sebId;
      const c = $('#nv-content');
      if (c) c.innerHTML = nvRenderContent();
      nvAttachContentHandlers();
    };
  });
  const clearBtn = $('#nv-search-clear');
  if (clearBtn) clearBtn.onclick = () => {
    nvState.search = '';
    const c = $('#nv-content');
    if (c) c.innerHTML = nvRenderContent();
    nvAttachContentHandlers();
    const inp = $('#nv-search');
    if (inp) { inp.value = ''; inp.focus(); }
  };
}

function attachNijogViewHandlers() {
  attachViewHandlers();

  const yearSel = $('#nv-year');
  const searchEl = $('#nv-search');
  const loadBtn  = $('#nv-load-btn');

  if (yearSel) yearSel.onchange = () => {
    nvState.year = +yearSel.value;
    nvState.rows = [];
    nvState.search = '';
    nvState.expanded = null;
    const c = $('#nv-content');
    if (c) c.innerHTML = nvRenderContent();
  };

  if (searchEl) searchEl.oninput = () => {
    nvState.search = searchEl.value;
    nvState.expanded = null;
    const c = $('#nv-content');
    if (c) c.innerHTML = nvRenderContent();
    nvAttachContentHandlers();
  };

  if (loadBtn) loadBtn.onclick = nvLoad;
  nvAttachContentHandlers();
}

// ============================================================
// LIGHTBOX
// ============================================================
function openLightbox(src) {
  $('#lightbox-img').src = src;
  $('#lightbox').classList.add('open');
}
$('#lightbox-close').onclick = () => $('#lightbox').classList.remove('open');
$('#lightbox').onclick = (e) => { if (e.target === $('#lightbox')) $('#lightbox').classList.remove('open'); };

// ============================================================
// ICONS
// ============================================================
function iconUsers() { return svg('<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'); }
function iconClock() { return svg('<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>'); }
function iconCheck() { return svg('<polyline points="20 6 9 17 4 12"/>'); }
function iconX() { return svg('<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>'); }
function iconSearch() { return svg('<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>'); }
function iconAlert() { return svg('<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>'); }
function iconFile() { return svg('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>'); }
function iconInbox() { return svg('<polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>'); }
function iconUserPlus() { return svg('<path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/>'); }
function iconClipboard() { return svg('<path d="M9 2h6a2 2 0 0 1 2 2v2H7V4a2 2 0 0 1 2-2z"/><path d="M5 6h14a1 1 0 0 1 1 1v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a1 1 0 0 1 1-1z"/><path d="M8 12h6"/><path d="M8 16h8"/>'); }
function svg(inner) { return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`; }

function activityColor(status) {
  const m = {
    approved: { bg: 'var(--green-bg)', fg: 'var(--green)' },
    rejected: { bg: 'var(--red-bg)', fg: 'var(--red)' },
    changes_requested: { bg: 'var(--amber-bg)', fg: 'var(--amber)' },
    submitted: { bg: 'var(--blue-bg)', fg: 'var(--blue)' },
    resubmitted: { bg: 'var(--blue-bg)', fg: 'var(--blue)' },
  };
  return m[status] || { bg: 'var(--bg)', fg: 'var(--ink3)' };
}
function activityIcon(status) {
  if (status === 'approved') return '✓';
  if (status === 'rejected') return '✕';
  if (status === 'changes_requested') return '!';
  return '•';
}

// ============================================================
// EVENTS
// ============================================================
$('#login-form').onsubmit = async (e) => {
  e.preventDefault();
  const email = $('#email-input').value.trim();
  const password = $('#password-input').value;
  const errEl = $('#login-error');
  const btn = $('#login-btn');
  errEl.classList.remove('show');
  btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>';
  const res = await signIn(email, password);
  if (res.error) {
    errEl.textContent = res.error; errEl.classList.add('show');
    btn.disabled = false; btn.textContent = 'Sign In';
    return;
  }
  showApp(res.user);
  btn.disabled = false; btn.textContent = 'Sign In';
};

$('#forgot-link').onclick = async () => {
  const email = $('#email-input').value.trim();
  const errEl = $('#login-error');
  if (!email) { errEl.textContent = 'Enter your email above first, then click reset.'; errEl.classList.add('show'); return; }
  setLoading(true);
  const { error } = await db.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + window.location.pathname });
  setLoading(false);
  if (error) { errEl.textContent = error.message; errEl.classList.add('show'); return; }
  errEl.textContent = '';
  errEl.classList.remove('show');
  showToast('Password reset email sent to ' + email, 'success', 5000);
};

$('#signout-btn').onclick = signOut;
$('#refresh-btn').onclick = () => loadAll();
$('#sidebar-toggle').onclick = () => $('#sidebar').classList.toggle('open');

$$('.nav-item').forEach(n => {
  if (n.id === 'nav-apps-toggle') {
    n.onclick = () => {
      const c = document.getElementById('nav-apps-children');
      const a = document.getElementById('nav-apps-chevron');
      const closed = c.style.display === 'none';
      c.style.display = closed ? 'flex' : 'none';
      a.style.transform = closed ? 'rotate(0deg)' : 'rotate(-90deg)';
    };
    return;
  }
  if (n.id === 'nav-sebayat-toggle') {
    n.onclick = () => {
      const c = document.getElementById('nav-sebayat-children');
      const a = document.getElementById('nav-sebayat-chevron');
      const closed = c.style.display === 'none';
      c.style.display = closed ? 'flex' : 'none';
      a.style.transform = closed ? 'rotate(0deg)' : 'rotate(-90deg)';
    };
    return;
  }
  if (n.id === 'nav-seba-toggle') {
    n.onclick = () => {
      const c = document.getElementById('nav-seba-children');
      const a = document.getElementById('nav-seba-chevron');
      const closed = c.style.display === 'none';
      c.style.display = closed ? 'flex' : 'none';
      a.style.transform = closed ? 'rotate(0deg)' : 'rotate(-90deg)';
    };
    return;
  }
  if (n.id === 'nav-mgmt-toggle') {
    n.onclick = () => {
      const c = document.getElementById('nav-mgmt-children');
      const a = document.getElementById('nav-mgmt-chevron');
      const closed = c.style.display === 'none';
      c.style.display = closed ? 'flex' : 'none';
      a.style.transform = closed ? 'rotate(0deg)' : 'rotate(-90deg)';
    };
    return;
  }
  if (n.id === 'nav-settings-toggle') {
    n.onclick = () => {
      const c = document.getElementById('nav-settings-children');
      const a = document.getElementById('nav-settings-chevron');
      const closed = c.style.display === 'none';
      c.style.display = closed ? 'flex' : 'none';
      a.style.transform = closed ? 'rotate(0deg)' : 'rotate(-90deg)';
    };
    return;
  }
  n.onclick = () => {
    const v = n.dataset.view;
    if (v === 'applications') {
      state.view = 'applications';
      state.filter = n.dataset.filter || 'all';
      state.page = 1;
      state.selectedIds.clear();
    } else if (v === 'manage_applications') {
      state.view = 'manage_applications';
      state.manageAppsFilter = n.dataset.appfilter || 'all';
      state.manageAppsDetail = null;
    } else {
      state.view = v;
      state.selectedIds.clear();
    }
    if (window.innerWidth <= 1024) $('#sidebar').classList.remove('open');
    render();
  };
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if ($('#lightbox').classList.contains('open')) $('#lightbox').classList.remove('open');
    else if ($('#modal-overlay').classList.contains('open')) closeModal();
    else if ($('#drawer-overlay').classList.contains('open')) closeDrawer();
  }
  if (e.key === '/' && state.view === 'applications' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
    e.preventDefault();
    $('#search-input')?.focus();
  }
});

// Auth state listener
db.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_OUT') {
    state.user = null;
    if (state.pollTimer) clearInterval(state.pollTimer);
    $('#app').classList.remove('visible');
    $('#login-screen').style.display = 'flex';
  }
});

// Boot
bootstrap();

/* ============================================================
   NOTICES VIEW
   ============================================================ */

async function loadNotices() {
  state.noticesLoading = true;
  const { data } = await db.from('notices').select('*').order('pinned', { ascending: false }).order('created_at', { ascending: false });
  state.notices = data || [];
  if (state.notices.length > 0) {
    const ids = state.notices.map(n => n.id);
    const { data: reads } = await db.from('notice_reads').select('notice_id').in('notice_id', ids);
    const counts = {};
    (reads || []).forEach(r => { counts[r.notice_id] = (counts[r.notice_id] || 0) + 1; });
    state.noticesReadCounts = counts;
  }
  state.noticesLoading = false;
  state.noticesLoaded = true;
}

// ── Notices List ──

function renderNoticesView() {
  const f = state.noticesFilter;
  const list = state.notices.filter(n => {
    if (f === 'published') return n.is_published;
    if (f === 'draft') return !n.is_published;
    return true;
  });
  const catColors = { general: '#1D6FAE', duty: '#B7770D', event: '#27AE60', urgent: '#C0392B' };
  const catBg    = { general: '#EBF5FB', duty: '#FFF3CD', event: '#F0FFF4', urgent: '#FFF5F5' };
  const catLabel = { general: 'General', duty: 'Duty', event: 'Event', urgent: 'Urgent' };
  const filterCounts = {
    all: state.notices.length,
    published: state.notices.filter(n => n.is_published).length,
    draft: state.notices.filter(n => !n.is_published).length,
  };

  const rows = list.map(n => {
    const reads = state.noticesReadCounts[n.id] || 0;
    const targets = Array.isArray(n.target_ids) ? n.target_ids : [];
    const targetLabel = n.target_type === 'individual'
      ? `${targets.length} member${targets.length !== 1 ? 's' : ''}`
      : n.target_type === 'group' ? (targets.join(', ') || 'Group') : 'All';
    const channels = Array.isArray(n.channels) ? n.channels : [];
    const color = catColors[n.category] || catColors.general;
    const bg    = catBg[n.category]    || catBg.general;
    const cat   = catLabel[n.category] || n.category;
    return `
    <tr>
      <td><span class="status-pill" style="background:${bg};color:${color};font-size:11px;padding:2px 8px;border-radius:6px;font-weight:600">${esc(cat)}</span></td>
      <td>
        <div style="font-weight:600;color:var(--ink);max-width:280px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(n.title)}</div>
        <div style="font-size:12px;color:var(--ink3);max-width:280px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px">${esc(n.body)}</div>
      </td>
      <td><span style="font-size:12px;color:var(--ink3)">${esc(targetLabel)}</span></td>
      <td>
        ${n.is_published ? `<span class="status-pill status-approved" style="font-size:11px">Published</span>` : `<span class="status-pill" style="background:var(--bg2);color:var(--ink3);font-size:11px">Draft</span>`}
        ${n.pinned ? `<span class="status-pill" style="background:#FFF8E8;color:#B7770D;font-size:11px;margin-left:4px">Pinned</span>` : ''}
      </td>
      <td style="font-size:12px;color:var(--ink3)">${reads > 0 ? `<span style="color:var(--green)">${reads} read</span>` : '—'}</td>
      <td style="font-size:12px;color:var(--ink3)">${channels.join(', ') || '—'}</td>
      <td style="font-size:12px;color:var(--ink3)">${n.published_at ? new Date(n.published_at).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}) : '—'}</td>
      <td>
        <div style="display:flex;gap:6px;align-items:center">
          <button class="btn btn-ghost btn-sm notices-edit-btn" data-id="${n.id}">Edit</button>
          <button class="btn btn-ghost btn-sm notices-toggle-btn" data-id="${n.id}" data-published="${n.is_published}">${n.is_published ? 'Unpublish' : 'Publish'}</button>
          <button class="btn btn-ghost btn-sm notices-pin-btn" data-id="${n.id}" data-pinned="${n.pinned}">${n.pinned ? 'Unpin' : 'Pin'}</button>
          <button class="btn btn-ghost btn-sm notices-delete-btn" data-id="${n.id}" style="color:var(--red)">Delete</button>
        </div>
      </td>
    </tr>`;
  }).join('');

  return `
  <div class="view-header">
    <div>
      <h2 class="view-title">Notices</h2>
      <p class="view-sub">Post and manage announcements for sebayats</p>
    </div>
    <button class="btn btn-primary" id="notices-create-btn">+ New Notice</button>
  </div>
  <div class="filter-bar">
    ${['all','published','draft'].map(k => `
      <button class="filter-tab${f===k?' active':''}" data-notices-filter="${k}">
        ${k.charAt(0).toUpperCase()+k.slice(1)} (${filterCounts[k]})
      </button>`).join('')}
  </div>
  ${state.noticesLoading
    ? `<div class="loading-placeholder"><div class="spinner"></div></div>`
    : list.length === 0
      ? `<div class="empty-state" style="padding:0 28px"><p>No notices yet. Click "+ New Notice" to create one.</p></div>`
      : `<div class="data-table-wrap" style="padding:0 28px 40px"><table class="data-table">
          <thead><tr><th>Category</th><th>Notice</th><th>Target</th><th>Status</th><th>Reads</th><th>Channels</th><th>Published</th><th>Actions</th></tr></thead>
          <tbody>${rows}</tbody>
        </table></div>`}`;
}

function attachNoticesHandlers() {
  if (!state.noticesLoaded && !state.noticesLoading) {
    loadNotices().then(() => {
      const c = $('#view-container');
      if (c && state.view === 'notices') { c.innerHTML = renderNoticesView(); attachNoticesHandlers(); }
    });
  }

  $$('[data-notices-filter]').forEach(btn => {
    btn.onclick = () => { state.noticesFilter = btn.dataset.noticesFilter; reRenderNotices(); };
  });

  $('#notices-create-btn')?.addEventListener('click', () => {
    state.noticesForm = { title:'', body:'', category:'general', is_published:false, pinned:false,
      target_type:'all', target_ids:[], channels:['push'], notify_when:'on_publish', notify_at_date:'', notify_at_time:'',
      publish_mode:'now', scheduled_publish_date:'', scheduled_publish_time:'' };
    state.noticesFormError = '';
    state.noticesSebayatSearch = '';
    state.noticesSebayatResults = [];
    state.noticesSelectedSebayats = [];
    state.view = 'notices_form';
    render();
  });

  $$('.notices-edit-btn').forEach(btn => {
    btn.onclick = async () => {
      const n = state.notices.find(x => x.id === btn.dataset.id);
      if (!n) return;
      state.noticesForm = {
        id: n.id, title: n.title, body: n.body, category: n.category,
        is_published: n.is_published, pinned: n.pinned,
        target_type: n.target_type || 'all',
        target_ids: Array.isArray(n.target_ids) ? [...n.target_ids] : [],
        channels: Array.isArray(n.channels) ? [...n.channels] : [],
        notify_when: n.notify_at ? 'custom' : 'on_publish',
        notify_at_date: n.notify_at ? n.notify_at.split('T')[0] : '',
        notify_at_time: n.notify_at ? (n.notify_at.split('T')[1]||'').slice(0,5) : '',
        publish_mode: n.scheduled_publish_at ? 'scheduled' : (n.is_published ? 'now' : 'draft'),
        scheduled_publish_date: n.scheduled_publish_at ? n.scheduled_publish_at.split('T')[0] : '',
        scheduled_publish_time: n.scheduled_publish_at ? (n.scheduled_publish_at.split('T')[1]||'').slice(0,5) : '',
      };
      state.noticesFormError = '';
      state.noticesSebayatSearch = '';
      state.noticesSebayatResults = [];
      if (n.target_type === 'individual' && n.target_ids?.length > 0) {
        const { data } = await db.from('sebayats').select('id,full_name,phone').in('id', n.target_ids);
        state.noticesSelectedSebayats = data || [];
      } else {
        state.noticesSelectedSebayats = [];
      }
      state.view = 'notices_form';
      render();
    };
  });

  $$('.notices-toggle-btn').forEach(btn => {
    btn.onclick = async () => {
      const id = btn.dataset.id;
      const nowPub = btn.dataset.published !== 'true';
      const n = state.notices.find(x => x.id === id);
      await db.from('notices').update({
        is_published: nowPub,
        published_at: nowPub && !n?.published_at ? new Date().toISOString() : n?.published_at,
        updated_at: new Date().toISOString(),
      }).eq('id', id);

      // Fire notification when publishing (not unpublishing)
      if (nowPub && n) {
        dispatchNotification('notice_published', null, {
          title: n.title || '',
          body: n.body || n.content || '',
          reference_type: 'notice',
          reference_id: id,
        }, 'sebayat');
      }

      await loadNotices();
      reRenderNotices();
    };
  });

  $$('.notices-pin-btn').forEach(btn => {
    btn.onclick = async () => {
      await db.from('notices').update({ pinned: btn.dataset.pinned !== 'true', updated_at: new Date().toISOString() }).eq('id', btn.dataset.id);
      await loadNotices();
      reRenderNotices();
    };
  });

  $$('.notices-delete-btn').forEach(btn => {
    btn.onclick = () => {
      const n = state.notices.find(x => x.id === btn.dataset.id);
      if (!n) return;
      showModal(`
        <div style="text-align:center;padding:8px 0 4px">
          <div style="width:60px;height:60px;border-radius:30px;background:#FFF5F5;display:flex;align-items:center;justify-content:center;margin:0 auto 16px">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#C0392B" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
          </div>
          <h3 style="margin:0 0 8px">Delete Notice?</h3>
          <p style="color:var(--ink3);font-size:14px;margin:0 0 4px">"${esc(n.title)}"</p>
          <p style="color:var(--ink4);font-size:12px;margin:0 0 24px">This cannot be undone.</p>
          <div style="display:flex;gap:12px;justify-content:center">
            <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
            <button class="btn btn-primary" style="background:var(--red);border-color:var(--red)" id="notices-delete-confirm-btn">Delete</button>
          </div>
        </div>`);
      $('#notices-delete-confirm-btn').onclick = async () => {
        closeModal();
        await db.from('notices').delete().eq('id', n.id);
        await loadNotices();
        reRenderNotices();
        showToast('Notice deleted.', 'success');
      };
    };
  });
}

function reRenderNotices() {
  const c = $('#view-container');
  if (c && state.view === 'notices') { c.innerHTML = renderNoticesView(); attachNoticesHandlers(); }
}

// ── Notices Form Page ──

function renderNoticesFormPage() {
  const f = state.noticesForm;
  if (!f) return '';
  const isEdit = !!f.id;
  const cats = ['general','duty','event','urgent'];
  const catLabel = { general:'General', duty:'Duty', event:'Event', urgent:'Urgent' };
  const catColors = { general: '#1D6FAE', duty: '#B7770D', event: '#27AE60', urgent: '#C0392B' };
  const catBg    = { general: '#EBF5FB', duty: '#FFF3CD', event: '#F0FFF4', urgent: '#FFF5F5' };
  const channels = ['sms','whatsapp','push'];
  const groupCodes = ['pratihari','gochhikar'];

  function chip(label, active) {
    return `border-color:${active?'var(--teal)':'var(--border)'};background:${active?'#EBF7F4':'transparent'};color:${active?'var(--teal)':'var(--ink2)'}`;
  }

  return `
  <div class="view-header" style="margin-bottom:0;padding-bottom:20px">
    <div style="display:flex;align-items:center;gap:12px">
      <button class="icon-btn" id="nf-back-btn" title="Back to notices">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
      </button>
      <div>
        <h2 class="view-title" style="margin:0">${isEdit ? 'Edit Notice' : 'New Notice'}</h2>
        <p class="view-sub" style="margin:0">${isEdit ? 'Update the details below' : 'Fill in the details below'}</p>
      </div>
    </div>
  </div>

  <div style="display:grid;grid-template-columns:1fr 340px;gap:24px;align-items:start">

    <!-- Left column: content + targeting -->
    <div style="display:flex;flex-direction:column;gap:20px">

      <div class="card" style="padding:24px">
        <h4 style="margin:0 0 16px;font-size:14px;font-weight:600;color:var(--ink2);text-transform:uppercase;letter-spacing:.04em">Content</h4>
        ${state.noticesFormError ? `<div class="alert alert-error" style="margin-bottom:16px">${esc(state.noticesFormError)}</div>` : ''}
        <div class="field">
          <label>Title (English) *</label>
          <input id="nf-title" value="${esc(f.title||'')}" placeholder="Notice headline" />
        </div>
        <div class="field">
          <label>Title (Odia) <span style="color:var(--ink4);font-weight:400">(optional)</span></label>
          <input id="nf-title-or" value="${esc(f.title_or||'')}" placeholder="ଓଡ଼ିଆ ଶୀର୍ଷକ" />
        </div>
        <div class="field">
          <label>Body (English) *</label>
          <textarea id="nf-body" rows="5" placeholder="Full notice content..." style="resize:vertical">${esc(f.body||'')}</textarea>
        </div>
        <div class="field" style="margin:0">
          <label>Body (Odia) <span style="color:var(--ink4);font-weight:400">(optional)</span></label>
          <textarea id="nf-body-or" rows="5" placeholder="ଓଡ଼ିଆ ବିଷୟବସ୍ତୁ..." style="resize:vertical">${esc(f.body_or||'')}</textarea>
        </div>
      </div>

      <div class="card" style="padding:24px">
        <h4 style="margin:0 0 16px;font-size:14px;font-weight:600;color:var(--ink2);text-transform:uppercase;letter-spacing:.04em">Category</h4>
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          ${cats.map(k => `
            <button type="button" class="btn btn-ghost notices-cat-btn" data-cat="${k}"
              style="${chip(catLabel[k], f.category===k)};padding:8px 16px;border-radius:8px;display:flex;align-items:center;gap:6px">
              <span style="width:8px;height:8px;border-radius:50%;background:${catColors[k]};display:inline-block"></span>
              ${catLabel[k]}
            </button>`).join('')}
        </div>
      </div>

      <div class="card" style="padding:24px">
        <h4 style="margin:0 0 16px;font-size:14px;font-weight:600;color:var(--ink2);text-transform:uppercase;letter-spacing:.04em">Target Audience</h4>
        <div style="display:flex;gap:10px;margin-bottom:16px">
          ${['all','group','individual'].map(t => `
            <button type="button" class="btn btn-ghost notices-target-btn" data-target="${t}"
              style="${chip(t, f.target_type===t)};padding:8px 16px;border-radius:8px">
              ${t==='all'?'All Members':t==='group'?'By Group':'Specific Members'}
            </button>`).join('')}
        </div>
        ${f.target_type === 'group' ? `
          <div style="display:flex;gap:10px;flex-wrap:wrap">
            ${groupCodes.map(g => {
              const tids = Array.isArray(f.target_ids) ? f.target_ids : [];
              const checked = tids.includes(g);
              return `<label style="display:flex;align-items:center;gap:8px;cursor:pointer;padding:10px 16px;border-radius:8px;border:1px solid ${checked?'var(--teal)':'var(--border)'};background:${checked?'#EBF7F4':''}">
                <input type="checkbox" class="nf-group-check" value="${g}" ${checked?'checked':''} style="accent-color:var(--teal);width:15px;height:15px"/>
                <span style="font-weight:500">${g.charAt(0).toUpperCase()+g.slice(1)}</span>
              </label>`;
            }).join('')}
          </div>` : ''}
        ${f.target_type === 'individual' ? `
          <div>
            <div style="display:flex;align-items:center;gap:8px;border:1px solid var(--border);border-radius:8px;padding:10px 14px;margin-bottom:10px;background:var(--surface)">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input id="nf-sebayat-search" style="border:none;outline:none;flex:1;font-size:14px;background:transparent" placeholder="Search by name or phone..." value="${esc(state.noticesSebayatSearch)}" />
            </div>
            ${state.noticesSebayatResults.length > 0 ? `
              <div style="border:1px solid var(--border);border-radius:8px;overflow:hidden;margin-bottom:10px">
                ${state.noticesSebayatResults.map(s => {
                  const already = state.noticesSelectedSebayats.some(x => x.id === s.id);
                  return `<div class="nf-sebayat-result${already?' nf-sebayat-added':''}" data-id="${s.id}" data-name="${esc(s.full_name)}" data-phone="${esc(s.phone)}"
                    style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;border-bottom:1px solid var(--border);cursor:pointer;background:${already?'var(--bg)':'var(--surface)'};opacity:${already?'0.5':'1'}">
                    <span style="font-weight:500">${esc(s.full_name)}</span>
                    <span style="font-size:12px;color:var(--ink3)">${esc(s.phone)}</span>
                  </div>`;
                }).join('')}
              </div>` : ''}
            ${state.noticesSelectedSebayats.length > 0 ? `
              <div style="display:flex;flex-wrap:wrap;gap:6px">
                ${state.noticesSelectedSebayats.map(s => `
                  <span style="display:flex;align-items:center;gap:6px;background:#EBF7F4;border:1px solid var(--teal);border-radius:20px;padding:5px 12px;font-size:13px;color:var(--teal)">
                    ${esc(s.full_name)}
                    <button type="button" class="nf-sebayat-remove" data-id="${s.id}" style="background:none;border:none;cursor:pointer;color:var(--ink3);line-height:1;padding:0;font-size:16px">×</button>
                  </span>`).join('')}
              </div>` : `<p style="font-size:13px;color:var(--ink4);margin:0">No members selected yet.</p>`}
          </div>` : ''}
      </div>

    </div>

    <!-- Right column: settings + actions -->
    <div style="display:flex;flex-direction:column;gap:20px">

      <div class="card" style="padding:24px">
        <h4 style="margin:0 0 16px;font-size:14px;font-weight:600;color:var(--ink2);text-transform:uppercase;letter-spacing:.04em">Publishing</h4>
        <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px">
          ${[
            { k:'now',       label:'Publish now',   desc:'Make visible immediately' },
            { k:'scheduled', label:'Schedule',      desc:'Set a future publish date & time' },
            { k:'draft',     label:'Save as draft', desc:'Not visible to members' },
          ].map(o => `
            <label style="display:flex;align-items:flex-start;gap:10px;cursor:pointer;padding:12px 14px;border-radius:8px;border:1px solid ${f.publish_mode===o.k?'var(--teal)':'var(--border)'};background:${f.publish_mode===o.k?'#EBF7F4':'var(--surface)'}">
              <input type="radio" name="nf-publish-mode" class="nf-publish-mode-radio" value="${o.k}" ${f.publish_mode===o.k?'checked':''} style="accent-color:var(--teal);margin-top:2px;flex-shrink:0"/>
              <div>
                <div style="font-weight:600;font-size:14px">${o.label}</div>
                <div style="font-size:12px;color:var(--ink3);margin-top:1px">${o.desc}</div>
              </div>
            </label>`).join('')}
        </div>
        ${f.publish_mode === 'scheduled' ? `
          <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:16px;padding:14px;background:var(--bg);border-radius:8px;border:1px solid var(--border)">
            <div class="field" style="margin:0">
              <label style="font-size:12px">Publish date *</label>
              <input id="nf-publish-date" type="date" value="${esc(f.scheduled_publish_date||'')}" />
            </div>
            <div class="field" style="margin:0">
              <label style="font-size:12px">Publish time</label>
              <input id="nf-publish-time" type="time" value="${esc(f.scheduled_publish_time||'09:00')}" />
            </div>
          </div>` : ''}
        <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 0;border-top:1px solid var(--border)">
          <div>
            <div style="font-weight:600;font-size:14px">Pin to top</div>
            <div style="font-size:12px;color:var(--ink3);margin-top:2px">Always appears first in list</div>
          </div>
          <label class="toggle-switch">
            <input type="checkbox" id="nf-pinned" ${f.pinned?'checked':''} />
            <span class="toggle-slider"></span>
          </label>
        </div>
      </div>

      <div class="card" style="padding:24px">
        <h4 style="margin:0 0 16px;font-size:14px;font-weight:600;color:var(--ink2);text-transform:uppercase;letter-spacing:.04em">Notify via</h4>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">
          ${channels.map(ch => {
            const chs = Array.isArray(f.channels) ? f.channels : [];
            const active = chs.includes(ch);
            return `<button type="button" class="btn btn-ghost btn-sm nf-channel-btn" data-channel="${ch}"
              style="${chip(ch, active)};border-radius:8px">
              ${ch.charAt(0).toUpperCase()+ch.slice(1)}
            </button>`;
          }).join('')}
        </div>
        <p style="font-size:11px;color:var(--ink4);font-style:italic;margin:0">Delivery active when notification system goes live.</p>
      </div>

      <div class="card" style="padding:24px">
        <h4 style="margin:0 0 16px;font-size:14px;font-weight:600;color:var(--ink2);text-transform:uppercase;letter-spacing:.04em">Schedule Notification</h4>
        <div style="display:flex;gap:8px;margin-bottom:14px">
          ${['on_publish','custom'].map(k => `
            <button type="button" class="btn btn-ghost btn-sm nf-notify-when-btn" data-when="${k}"
              style="${chip(k, f.notify_when===k)};border-radius:8px">
              ${k==='on_publish'?'On Publish':'Custom Time'}
            </button>`).join('')}
        </div>
        ${f.notify_when === 'custom' ? `
          <div style="display:flex;flex-direction:column;gap:10px">
            <div class="field" style="margin:0">
              <label style="font-size:12px">Date</label>
              <input id="nf-notify-date" type="date" value="${esc(f.notify_at_date||'')}" />
            </div>
            <div class="field" style="margin:0">
              <label style="font-size:12px">Time</label>
              <input id="nf-notify-time" type="time" value="${esc(f.notify_at_time||'')}" />
            </div>
          </div>` : ''}
      </div>

      <div style="display:flex;flex-direction:column;gap:10px">
        <button class="btn btn-primary" id="nf-save-btn" ${state.noticesFormSaving?'disabled':''} style="width:100%;justify-content:center;padding:12px">
          ${state.noticesFormSaving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Notice'}
        </button>
        <button class="btn btn-ghost" id="nf-cancel-btn" style="width:100%;justify-content:center">Cancel</button>
      </div>

    </div>
  </div>`;
}

function attachNoticesFormHandlers() {
  $('#nf-back-btn')?.addEventListener('click', () => { state.noticesForm = null; state.view = 'notices'; render(); });
  $('#nf-cancel-btn')?.addEventListener('click', () => { state.noticesForm = null; state.view = 'notices'; render(); });

  $$('.notices-cat-btn').forEach(btn => {
    btn.onclick = () => { if (state.noticesForm) { state.noticesForm.category = btn.dataset.cat; reRenderFormPage(); } };
  });

  $$('.notices-target-btn').forEach(btn => {
    btn.onclick = () => {
      if (!state.noticesForm) return;
      state.noticesForm.target_type = btn.dataset.target;
      state.noticesForm.target_ids = [];
      state.noticesSelectedSebayats = [];
      reRenderFormPage();
    };
  });

  $$('.nf-group-check').forEach(cb => {
    cb.onchange = () => {
      if (!state.noticesForm) return;
      const tids = [...(state.noticesForm.target_ids || [])];
      if (cb.checked) { if (!tids.includes(cb.value)) tids.push(cb.value); }
      else { const i = tids.indexOf(cb.value); if (i > -1) tids.splice(i, 1); }
      state.noticesForm.target_ids = tids;
    };
  });

  let sebSearchTimer = null;
  $('#nf-sebayat-search')?.addEventListener('input', (e) => {
    state.noticesSebayatSearch = e.target.value;
    clearTimeout(sebSearchTimer);
    if (!state.noticesSebayatSearch.trim()) { state.noticesSebayatResults = []; reRenderFormPage(); return; }
    sebSearchTimer = setTimeout(async () => {
      const q = state.noticesSebayatSearch.trim();
      const { data } = await db.from('sebayats').select('id,full_name,phone').or(`full_name.ilike.%${q}%,phone.ilike.%${q}%`).limit(10);
      state.noticesSebayatResults = data || [];
      reRenderFormPage();
    }, 300);
  });

  $$('.nf-sebayat-result').forEach(el => {
    el.onclick = () => {
      if (el.classList.contains('nf-sebayat-added')) return;
      const s = { id: el.dataset.id, full_name: el.dataset.name, phone: el.dataset.phone };
      if (!state.noticesSelectedSebayats.some(x => x.id === s.id)) {
        state.noticesSelectedSebayats.push(s);
        if (state.noticesForm) state.noticesForm.target_ids = state.noticesSelectedSebayats.map(x => x.id);
      }
      state.noticesSebayatSearch = '';
      state.noticesSebayatResults = [];
      reRenderFormPage();
    };
  });

  $$('.nf-sebayat-remove').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      state.noticesSelectedSebayats = state.noticesSelectedSebayats.filter(s => s.id !== btn.dataset.id);
      if (state.noticesForm) state.noticesForm.target_ids = state.noticesSelectedSebayats.map(x => x.id);
      reRenderFormPage();
    };
  });

  $$('.nf-channel-btn').forEach(btn => {
    btn.onclick = () => {
      if (!state.noticesForm) return;
      const chs = [...(state.noticesForm.channels || [])];
      const i = chs.indexOf(btn.dataset.channel);
      if (i > -1) chs.splice(i, 1); else chs.push(btn.dataset.channel);
      state.noticesForm.channels = chs;
      reRenderFormPage();
    };
  });

  $$('.nf-notify-when-btn').forEach(btn => {
    btn.onclick = () => { if (state.noticesForm) { state.noticesForm.notify_when = btn.dataset.when; reRenderFormPage(); } };
  });

  $$('.nf-publish-mode-radio').forEach(r => {
    r.onchange = () => { if (state.noticesForm) { state.noticesForm.publish_mode = r.value; reRenderFormPage(); } };
  });

  $('#nf-publish-date')?.addEventListener('change', (e) => { if (state.noticesForm) state.noticesForm.scheduled_publish_date = e.target.value; });
  $('#nf-publish-time')?.addEventListener('change', (e) => { if (state.noticesForm) state.noticesForm.scheduled_publish_time = e.target.value; });

  $('#nf-notify-date')?.addEventListener('change', (e) => { if (state.noticesForm) state.noticesForm.notify_at_date = e.target.value; });
  $('#nf-notify-time')?.addEventListener('change', (e) => { if (state.noticesForm) state.noticesForm.notify_at_time = e.target.value; });

  const nfSaveBtn = $('#nf-save-btn');
  if (nfSaveBtn && !nfSaveBtn._noticesSaveAttached) {
    nfSaveBtn._noticesSaveAttached = true;
    nfSaveBtn.addEventListener('click', async () => {
      const f = state.noticesForm;
      if (!f) return;

      // Capture all DOM values before any re-render
      const title = $('#nf-title')?.value.trim() || '';
      const title_or = $('#nf-title-or')?.value.trim() || null;
      const body  = $('#nf-body')?.value.trim() || '';
      const body_or = $('#nf-body-or')?.value.trim() || null;
      const nowPinned = $('#nf-pinned')?.checked || false;
      const publishMode = f.publish_mode || 'now';
      const pubDate = $('#nf-publish-date')?.value || f.scheduled_publish_date || '';
      const pubTime = $('#nf-publish-time')?.value || f.scheduled_publish_time || '09:00';
      const notifyDate = $('#nf-notify-date')?.value || '';
      const notifyTime = $('#nf-notify-time')?.value || '09:00';

      // Sync captured values back to state so re-renders show them
      f.title = title;
      f.title_or = title_or;
      f.body = body;
      f.body_or = body_or;

      const showErr = (msg) => {
        state.noticesFormError = msg;
        state.noticesFormSaving = false;
        reRenderFormPage();
      };

      if (!title) { showErr('Title is required.'); return; }
      if (!body)  { showErr('Body is required.'); return; }
      if (f.target_type === 'group' && (!f.target_ids || f.target_ids.length === 0)) { showErr('Select at least one group.'); return; }
      if (f.target_type === 'individual' && state.noticesSelectedSebayats.length === 0) { showErr('Select at least one member.'); return; }
      if (publishMode === 'scheduled' && !pubDate) { showErr('Please set a publish date for scheduled publishing.'); return; }

      // Disable button immediately — no re-render to avoid losing DOM
      nfSaveBtn.disabled = true;
      nfSaveBtn.textContent = 'Saving…';
      state.noticesFormError = '';
      state.noticesFormSaving = true;

      const scheduledPublishAt = publishMode === 'scheduled' && pubDate ? `${pubDate}T${pubTime}:00` : null;
      const isPublishedNow = publishMode === 'now';
      const notifyAt = f.notify_when === 'custom' && notifyDate ? `${notifyDate}T${notifyTime}:00` : null;

      const payload = {
        title, title_or, body, body_or,
        category: f.category || 'general',
        is_published: isPublishedNow,
        pinned: nowPinned,
        target_type: f.target_type || 'all',
        target_ids: f.target_ids || [],
        channels: f.channels || [],
        notify_at: notifyAt,
        scheduled_publish_at: scheduledPublishAt,
        updated_at: new Date().toISOString(),
      };

      let error;
      if (f.id) {
        ({ error } = await db.from('notices').update(payload).eq('id', f.id));
      } else {
        if (isPublishedNow) payload.published_at = new Date().toISOString();
        ({ error } = await db.from('notices').insert({ ...payload, created_by: state.user.id }));
      }

      state.noticesFormSaving = false;
      if (error) { showErr(error.message); return; }

      showToast(f.id ? 'Notice updated.' : 'Notice created.', 'success');
      state.noticesForm = null;
      await loadNotices();
      state.view = 'notices';
      render();
    });
  }
}

function reRenderFormPage() {
  const c = $('#view-container');
  if (c && state.view === 'notices_form') { c.innerHTML = renderNoticesFormPage(); attachNoticesFormHandlers(); }
}

/* ============================================================
   APPLICATION TYPES MODULE
   ============================================================ */

const APP_TYPE_ICONS = [
  { key: 'FileText', svg: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>' },
  { key: 'Calendar', svg: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>' },
  { key: 'AlertCircle', svg: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>' },
  { key: 'RefreshCw', svg: '<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>' },
  { key: 'Heart', svg: '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>' },
  { key: 'Award', svg: '<circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/>' },
  { key: 'MessageSquare', svg: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>' },
  { key: 'Tool', svg: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>' },
  { key: 'Shield', svg: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>' },
  { key: 'Star', svg: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>' },
];

const APP_TYPE_COLORS = ['#1D6FAE','#27AE60','#C0392B','#B7770D','#8E44AD','#2980B9','#16A085','#D35400','#884EA0','#7F8C8D'];

function getAppTypeIconSvg(key) {
  const found = APP_TYPE_ICONS.find(i => i.key === key);
  return found ? found.svg : APP_TYPE_ICONS[0].svg;
}

async function loadAppTypes() {
  state.appTypesLoading = true;
  const { data } = await db.from('application_types').select('*').order('sort_order').order('created_at');
  state.appTypes = data || [];
  state.appTypesLoading = false;
  state.appTypesLoaded = true;
}

function renderAppTypesView() {
  if (state.appTypesLoading && !state.appTypesLoaded) {
    return `<div style="padding:60px;text-align:center;color:var(--ink4)">Loading application types…</div>`;
  }
  const types = state.appTypes;
  return `
    <div class="view-header">
      <div>
        <h2 class="view-title">Application Types</h2>
        <p class="view-sub">Define the types of applications sebayats can submit. Each type can have custom fields.</p>
      </div>
      <button class="btn btn-primary" id="app-type-create-btn">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        New Type
      </button>
    </div>
    ${types.length === 0 ? `
      <div style="text-align:center;padding:80px 40px;color:var(--ink4)">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin:0 auto 16px;display:block;opacity:0.4"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        <div style="font-size:16px;font-weight:600;margin-bottom:8px">No application types yet</div>
        <div style="font-size:14px">Create your first type to let sebayats submit requests.</div>
      </div>
    ` : `
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:16px;padding:24px">
        ${types.map(t => renderAppTypeCard(t)).join('')}
      </div>
    `}
  `;
}

function renderAppTypeCard(t) {
  const fields = Array.isArray(t.form_fields) ? t.form_fields : [];
  return `
    <div style="background:#fff;border:1px solid var(--border);border-radius:12px;padding:20px;display:flex;flex-direction:column;gap:12px">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px">
        <div style="display:flex;align-items:center;gap:12px">
          <div style="width:44px;height:44px;border-radius:10px;background:${t.color}20;display:flex;align-items:center;justify-content:center;flex-shrink:0">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${t.color}" stroke-width="2">${getAppTypeIconSvg(t.icon)}</svg>
          </div>
          <div>
            <div style="font-weight:600;font-size:15px;color:var(--ink1)">${esc(t.name)}</div>
            <div style="font-size:12px;color:var(--ink4);margin-top:2px">Code: <code style="background:var(--surface2);padding:1px 5px;border-radius:4px">${esc(t.code)}</code></div>
          </div>
        </div>
        <span style="padding:3px 8px;border-radius:20px;font-size:11px;font-weight:600;background:${t.is_active?'#ECFDF5':'#F5F5F5'};color:${t.is_active?'#166534':'#6B7280'}">${t.is_active?'Active':'Inactive'}</span>
      </div>
      ${t.description ? `<div style="font-size:13px;color:var(--ink3);line-height:1.5">${esc(t.description)}</div>` : ''}
      <div style="font-size:12px;color:var(--ink4)">
        ${fields.length} custom field${fields.length!==1?'s':''}
        ${t.requires_documents ? ' · Documents required' : ''}
      </div>
      <div style="display:flex;gap:8px;margin-top:4px">
        <button class="btn btn-ghost btn-sm app-type-edit-btn" data-id="${t.id}" style="flex:1">Edit</button>
        <button class="btn btn-ghost btn-sm app-type-toggle-btn" data-id="${t.id}" data-active="${t.is_active}" style="flex:1;color:${t.is_active?'var(--red)':'var(--green)'}">
          ${t.is_active?'Deactivate':'Activate'}
        </button>
      </div>
    </div>
  `;
}

function renderAppTypeFormModal(typeObj) {
  const isEdit = !!(typeObj && typeObj.id);
  const t = typeObj || { name:'', code:'', description:'', icon:'FileText', color:'#1D6FAE', form_fields:[], requires_documents:false, is_active:true };
  const fields = Array.isArray(t.form_fields) ? t.form_fields : [];
  const fieldStyle = 'width:100%;padding:8px 12px;border:1.5px solid var(--border);border-radius:var(--radius);font-size:13px;font-family:inherit;color:var(--ink);background:#fff;outline:none;box-sizing:border-box';
  const labelStyle = 'display:block;font-size:12px;font-weight:600;color:var(--ink3);margin-bottom:5px';
  return `
    <div class="modal-header">
      <div>
        <h3 class="modal-title">${isEdit ? 'Edit Application Type' : 'New Application Type'}</h3>
        <p class="modal-desc">${isEdit ? 'Update the details for this application type' : 'Define a new application type for sebayats'}</p>
      </div>
      <button class="modal-close" onclick="closeModal()">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
    <div class="modal-body" style="display:flex;flex-direction:column;gap:16px;max-height:65vh;overflow-y:auto">
      ${state.appTypeFormError ? `<div style="background:var(--red-bg);color:var(--red);border-radius:var(--radius);padding:10px 14px;font-size:13px">${esc(state.appTypeFormError)}</div>` : ''}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
        <div>
          <label style="${labelStyle}">Name <span style="color:var(--red)">*</span></label>
          <input type="text" id="atf-name" value="${esc(t.name)}" placeholder="e.g. Leave Request" style="${fieldStyle}" />
        </div>
        <div>
          <label style="${labelStyle}">Code <span style="color:var(--red)">*</span></label>
          <input type="text" id="atf-code" value="${esc(t.code)}" placeholder="e.g. leave_request" style="${fieldStyle}" />
        </div>
      </div>
      <div>
        <label style="${labelStyle}">Description</label>
        <textarea id="atf-desc" rows="2" placeholder="When should a sebayat use this type?" style="${fieldStyle};resize:vertical">${esc(t.description)}</textarea>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
        <div>
          <label style="${labelStyle}">Icon</label>
          <div style="display:flex;flex-wrap:wrap;gap:6px" id="atf-icon-picker">
            ${APP_TYPE_ICONS.map(ic => `
              <button type="button" class="atf-icon-btn" data-icon="${ic.key}" style="width:36px;height:36px;border-radius:8px;border:2px solid ${t.icon===ic.key?t.color:'var(--border)'};background:${t.icon===ic.key?t.color+'20':'transparent'};display:flex;align-items:center;justify-content:center;cursor:pointer" title="${ic.key}">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${t.icon===ic.key?t.color:'var(--ink3)'}" stroke-width="2">${ic.svg}</svg>
              </button>
            `).join('')}
          </div>
          <input type="hidden" id="atf-icon" value="${esc(t.icon)}" />
        </div>
        <div>
          <label style="${labelStyle}">Color</label>
          <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:4px">
            ${APP_TYPE_COLORS.map(c => `<button type="button" class="atf-color-btn" data-color="${c}" style="width:28px;height:28px;border-radius:50%;background:${c};border:3px solid ${t.color===c?'var(--ink)':'transparent'};cursor:pointer"></button>`).join('')}
          </div>
          <input type="hidden" id="atf-color" value="${esc(t.color)}" />
        </div>
      </div>
      <div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
          <label style="${labelStyle};margin:0">Custom Form Fields</label>
          <button type="button" class="btn btn-ghost btn-sm" id="atf-add-field-btn">+ Add Field</button>
        </div>
        <div id="atf-fields-list" style="display:flex;flex-direction:column;gap:8px">
          ${fields.map((f, i) => renderAtfFieldRow(f, i)).join('')}
        </div>
        ${fields.length===0 ? `<div id="atf-fields-empty" style="font-size:13px;color:var(--ink4);padding:12px;background:var(--surface-2);border-radius:var(--radius);text-align:center;border:1px dashed var(--border)">No custom fields yet.</div>` : ''}
      </div>
      <div style="display:flex;align-items:center;gap:20px">
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;color:var(--ink2)">
          <input type="checkbox" id="atf-req-docs" ${t.requires_documents?'checked':''} style="width:16px;height:16px;accent-color:var(--saffron)" /> Requires documents
        </label>
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;color:var(--ink2)">
          <input type="checkbox" id="atf-active" ${t.is_active?'checked':''} style="width:16px;height:16px;accent-color:var(--green)" /> Active
        </label>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" id="atf-save-btn">${state.appTypeFormSaving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Type'}</button>
    </div>
  `;
}

function renderAtfFieldRow(f, i) {
  return `
    <div class="atf-field-row" data-field-index="${i}" style="display:flex;gap:8px;align-items:center;background:var(--surface-2);padding:8px 10px;border-radius:var(--radius);border:1px solid var(--border-light)">
      <input type="text" class="atf-field-label" value="${esc(f.label||'')}" placeholder="Field label" style="flex:2;font-size:13px;padding:6px 8px;border:1.5px solid var(--border);border-radius:var(--radius);font-family:inherit;color:var(--ink);background:#fff;outline:none" />
      <select class="atf-field-type" style="flex:1;font-size:13px;padding:6px 8px;border:1.5px solid var(--border);border-radius:var(--radius);font-family:inherit;color:var(--ink);background:#fff;outline:none">
        ${['text','textarea','date','select','checkbox','number'].map(ft=>`<option value="${ft}" ${f.type===ft?'selected':''}>${ft}</option>`).join('')}
      </select>
      <label style="display:flex;align-items:center;gap:4px;font-size:12px;white-space:nowrap;cursor:pointer">
        <input type="checkbox" class="atf-field-required" ${f.required?'checked':''} /> Req.
      </label>
      <button type="button" class="atf-field-remove icon-btn" style="color:var(--red);padding:4px">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
  `;
}

function attachAppTypesHandlers() {
  if (!state.appTypesLoaded && !state.appTypesLoading) {
    loadAppTypes().then(() => {
      const c = $('#view-container');
      if (c && state.view === 'app_types') { c.innerHTML = renderAppTypesView(); attachAppTypesHandlers(); }
    });
    return;
  }

  $('#app-type-create-btn')?.addEventListener('click', () => {
    state.appTypeFormError = '';
    showModal(renderAppTypeFormModal(null));
    $('#modal').classList.add('modal--wide');
    attachAppTypeFormModalHandlers(null);
  });

  $$('.app-type-edit-btn').forEach(btn => {
    btn.onclick = () => {
      const t = state.appTypes.find(x => x.id === btn.dataset.id);
      if (!t) return;
      state.appTypeFormError = '';
      showModal(renderAppTypeFormModal(t));
      $('#modal').classList.add('modal--wide');
      attachAppTypeFormModalHandlers(t);
    };
  });

  $$('.app-type-toggle-btn').forEach(btn => {
    btn.onclick = async () => {
      const isActive = btn.dataset.active === 'true';
      await db.from('application_types').update({ is_active: !isActive, updated_at: new Date().toISOString() }).eq('id', btn.dataset.id);
      await loadAppTypes();
      const c = $('#view-container');
      if (c && state.view === 'app_types') { c.innerHTML = renderAppTypesView(); attachAppTypesHandlers(); }
      showToast(`Type ${isActive?'deactivated':'activated'}.`, 'success');
    };
  });
}

function attachAppTypeFormModalHandlers(existingType) {
  const sel = { icon: existingType?.icon || 'FileText', color: existingType?.color || '#1D6FAE' };

  $('#atf-name')?.addEventListener('input', e => {
    if (!existingType) {
      const slug = e.target.value.toLowerCase().replace(/\s+/g,'_').replace(/[^a-z0-9_]/g,'');
      const ci = $('#atf-code'); if (ci) ci.value = slug;
    }
  });

  $$('.atf-icon-btn').forEach(btn => {
    btn.onclick = () => {
      sel.icon = btn.dataset.icon;
      const hi = $('#atf-icon'); if (hi) hi.value = sel.icon;
      $$('.atf-icon-btn').forEach(b => {
        b.style.borderColor = b.dataset.icon === sel.icon ? sel.color : 'var(--border)';
        b.style.background = b.dataset.icon === sel.icon ? sel.color+'20' : 'transparent';
        b.querySelector('svg').setAttribute('stroke', b.dataset.icon === sel.icon ? sel.color : 'var(--ink3)');
      });
    };
  });

  $$('.atf-color-btn').forEach(btn => {
    btn.onclick = () => {
      sel.color = btn.dataset.color;
      const hc = $('#atf-color'); if (hc) hc.value = sel.color;
      $$('.atf-color-btn').forEach(b => { b.style.borderColor = b.dataset.color === sel.color ? 'var(--ink1)' : 'transparent'; });
      $$('.atf-icon-btn').forEach(b => {
        if (b.dataset.icon === sel.icon) {
          b.style.borderColor = sel.color;
          b.style.background = sel.color+'20';
          b.querySelector('svg').setAttribute('stroke', sel.color);
        }
      });
    };
  });

  $('#atf-add-field-btn')?.addEventListener('click', () => {
    const list = $('#atf-fields-list');
    const empty = $('#atf-fields-empty'); if (empty) empty.remove();
    const idx = $$('.atf-field-row').length;
    const div = document.createElement('div');
    div.innerHTML = renderAtfFieldRow({ label:'', type:'text', required:false }, idx);
    list.appendChild(div.firstElementChild);
    attachAtfFieldRemoveHandlers();
  });

  attachAtfFieldRemoveHandlers();

  $('#atf-save-btn')?.addEventListener('click', async () => {
    const fields = [];
    $$('.atf-field-row').forEach(row => {
      const label = row.querySelector('.atf-field-label')?.value?.trim();
      const type = row.querySelector('.atf-field-type')?.value || 'text';
      const required = row.querySelector('.atf-field-required')?.checked || false;
      if (label) fields.push({ label, type, required, key: label.toLowerCase().replace(/\s+/g,'_').replace(/[^a-z0-9_]/g,'') });
    });
    const payload = {
      name: $('#atf-name')?.value?.trim() || '',
      code: $('#atf-code')?.value?.trim() || '',
      description: $('#atf-desc')?.value?.trim() || '',
      icon: $('#atf-icon')?.value || 'FileText',
      color: $('#atf-color')?.value || '#1D6FAE',
      form_fields: fields,
      requires_documents: $('#atf-req-docs')?.checked || false,
      is_active: $('#atf-active')?.checked !== false,
    };
    if (!payload.name) { state.appTypeFormError = 'Name is required.'; showModal(renderAppTypeFormModal(existingType ? {...existingType,...payload} : payload)); $('#modal').classList.add('modal--wide'); attachAppTypeFormModalHandlers(existingType); return; }
    if (!payload.code) { state.appTypeFormError = 'Code is required.'; showModal(renderAppTypeFormModal(existingType ? {...existingType,...payload} : payload)); $('#modal').classList.add('modal--wide'); attachAppTypeFormModalHandlers(existingType); return; }
    state.appTypeFormSaving = true;
    let error;
    if (existingType) {
      ({ error } = await db.from('application_types').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', existingType.id));
    } else {
      ({ error } = await db.from('application_types').insert({ ...payload, created_by: state.user.id }));
    }
    state.appTypeFormSaving = false;
    if (error) { state.appTypeFormError = error.message; showModal(renderAppTypeFormModal(existingType ? {...existingType,...payload} : payload)); $('#modal').classList.add('modal--wide'); attachAppTypeFormModalHandlers(existingType); return; }
    closeModal();
    await loadAppTypes();
    const c = $('#view-container');
    if (c && state.view === 'app_types') { c.innerHTML = renderAppTypesView(); attachAppTypesHandlers(); }
    showToast(existingType ? 'Type updated.' : 'Type created.', 'success');
  });
}

function attachAtfFieldRemoveHandlers() {
  $$('.atf-field-remove').forEach(btn => {
    btn.onclick = () => {
      btn.closest('.atf-field-row').remove();
      if ($$('.atf-field-row').length === 0) {
        const list = $('#atf-fields-list');
        const empty = document.createElement('div');
        empty.id = 'atf-fields-empty';
        empty.style.cssText = 'font-size:13px;color:var(--ink4);padding:12px;background:var(--surface2);border-radius:8px;text-align:center';
        empty.textContent = 'No custom fields yet.';
        list.appendChild(empty);
      }
    };
  });
}

/* ============================================================
   MANAGE APPLICATIONS MODULE
   ============================================================ */

const APP_STATUS_LABELS = { pending:'Pending', under_review:'Under Review', approved:'Approved', rejected:'Rejected', more_info_required:'More Info Required' };
const APP_STATUS_COLORS = {
  pending:             { bg:'#FFFBEB', color:'#92400E', border:'#FCD34D' },
  under_review:        { bg:'#EFF6FF', color:'#1E40AF', border:'#93C5FD' },
  approved:            { bg:'#F0FDF4', color:'#166534', border:'#86EFAC' },
  rejected:            { bg:'#FFF1F2', color:'#9F1239', border:'#FDA4AF' },
  more_info_required:  { bg:'#FFF7ED', color:'#9A3412', border:'#FDBA74' },
};

function appStatusBadge(status) {
  const s = APP_STATUS_COLORS[status] || { bg:'#F3F4F6', color:'#374151', border:'#D1D5DB' };
  return `<span style="padding:2px 9px;border-radius:20px;font-size:11px;font-weight:600;background:${s.bg};color:${s.color};border:1px solid ${s.border}">${APP_STATUS_LABELS[status]||status}</span>`;
}

async function loadManageApplications() {
  state.manageAppsLoading = true;
  const { data } = await db
    .from('applications')
    .select('*, sebayat:sebayats(id,full_name,phone,photo_url,palia_number,seba_name,registration_no), app_type:application_types(id,name,code,icon,color,form_fields)')
    .order('submitted_at', { ascending: false });
  state.manageApps = data || [];
  state.manageAppsLoading = false;
  state.manageAppsLoaded = true;
  updateAppsBadgeCounts();
}

function updateAppsBadgeCounts() {
  const apps = state.manageApps;
  const map = { apps_all: apps.length, apps_pending: apps.filter(a=>a.status==='pending').length, apps_under_review: apps.filter(a=>a.status==='under_review').length, apps_approved: apps.filter(a=>a.status==='approved').length, apps_rejected: apps.filter(a=>a.status==='rejected').length, apps_more_info: apps.filter(a=>a.status==='more_info_required').length };
  Object.entries(map).forEach(([badge, count]) => {
    const el = $(`[data-badge="${badge}"]`);
    if (el) { el.textContent = count; el.style.display = count > 0 ? '' : 'none'; }
  });
}

function renderManageApplicationsView() {
  if (state.manageAppsDetail) return renderApplicationDetailView();
  if (state.manageAppsLoading && !state.manageAppsLoaded) {
    return `<div style="padding:60px;text-align:center;color:var(--ink4)">Loading applications…</div>`;
  }
  const f = state.manageAppsFilter;
  const q = state.manageAppsSearch.toLowerCase();
  const all = state.manageApps;
  let list = f === 'all' ? all : all.filter(a => a.status === f);
  if (q) list = list.filter(a => (a.sebayat?.full_name||'').toLowerCase().includes(q) || (a.title||'').toLowerCase().includes(q) || (a.app_type?.name||'').toLowerCase().includes(q));
  const counts = { all:all.length, pending:all.filter(a=>a.status==='pending').length, under_review:all.filter(a=>a.status==='under_review').length, approved:all.filter(a=>a.status==='approved').length, rejected:all.filter(a=>a.status==='rejected').length, more_info_required:all.filter(a=>a.status==='more_info_required').length };
  const filterBtns = Object.entries({ all:'All', pending:'Pending', under_review:'Under Review', approved:'Approved', rejected:'Rejected', more_info_required:'More Info Required' }).map(([key,label]) =>
    `<button class="btn btn-sm ${f===key?'btn-primary':'btn-ghost'}" onclick="state.manageAppsFilter='${key}';reRenderManageApps()">${label}${counts[key]>0?` (${counts[key]})`:''}</button>`
  ).join('');

  return `
    <div class="view-header">
      <div><h2 class="view-title">Applications</h2><p class="view-sub">Review and manage requests submitted by sebayats.</p></div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:12px;padding:0 24px 24px">
      ${[['Total',counts.all,'#F8FAFC','#1E293B'],['Pending',counts.pending,'#FFFBEB','#92400E'],['Under Review',counts.under_review,'#EFF6FF','#1E40AF'],['Approved',counts.approved,'#F0FDF4','#166534'],['Rejected',counts.rejected,'#FFF1F2','#9F1239']].map(([lbl,val,bg,col]) =>
        `<div style="background:${bg};border:1px solid var(--border);border-radius:10px;padding:14px 16px;cursor:pointer" onclick="state.manageAppsFilter='${lbl==='Total'?'all':lbl.toLowerCase().replace(' ','_')}';reRenderManageApps()"><div style="font-size:24px;font-weight:700;color:${col}">${val}</div><div style="font-size:12px;color:var(--ink3);margin-top:2px">${lbl}</div></div>`
      ).join('')}
    </div>
    <div style="padding:0 24px 16px;display:flex;align-items:center;gap:12px;flex-wrap:wrap">
      <div style="display:flex;gap:4px;flex-wrap:wrap">${filterBtns}</div>
      <div style="position:relative;margin-left:auto">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ink4)" stroke-width="2" style="position:absolute;left:10px;top:50%;transform:translateY(-50%)"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input type="text" id="manage-apps-search" placeholder="Search by name or title…" value="${esc(state.manageAppsSearch)}" style="padding:7px 12px 7px 32px;border:1px solid var(--border);border-radius:8px;font-size:13px;width:220px" />
      </div>
    </div>
    ${list.length === 0 ? `
      <div style="text-align:center;padding:60px 40px;color:var(--ink4)">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin:0 auto 12px;display:block;opacity:0.4"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        <div style="font-weight:600;margin-bottom:6px">No applications found</div>
        <div style="font-size:13px">Try a different filter or wait for sebayats to submit.</div>
      </div>
    ` : `
      <div style="padding:0 24px">
        <table class="data-table" style="width:100%">
          <thead><tr><th>Applicant</th><th>Type</th><th>Title</th><th>Priority</th><th>Status</th><th>Submitted</th><th></th></tr></thead>
          <tbody>${list.map(a => renderAppRow(a)).join('')}</tbody>
        </table>
      </div>
    `}
  `;
}

function renderAppRow(a) {
  const s = a.sebayat;
  const initials = s?.full_name ? s.full_name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase() : '?';
  const typeColor = a.app_type?.color || '#1D6FAE';
  const atts = Array.isArray(a.attachments) ? a.attachments : [];
  const submitted = a.submitted_at ? new Date(a.submitted_at).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}) : '—';
  return `
    <tr class="clickable-row" data-app-id="${a.id}" style="cursor:pointer">
      <td>
        <div style="display:flex;align-items:center;gap:10px">
          ${s?.photo_url ? `<img src="${esc(s.photo_url)}" style="width:32px;height:32px;border-radius:50%;object-fit:cover;flex-shrink:0" />` : `<div style="width:32px;height:32px;border-radius:50%;background:var(--saffron-light);color:var(--saffron);display:flex;align-items:center;justify-content:center;font-weight:600;font-size:12px;flex-shrink:0">${initials}</div>`}
          <div><div style="font-weight:600;font-size:13px">${esc(s?.full_name||'Unknown')}</div><div style="font-size:11px;color:var(--ink4)">${esc(s?.phone||'')}</div></div>
        </div>
      </td>
      <td><span style="padding:2px 8px;border-radius:20px;font-size:11px;font-weight:600;background:${typeColor}20;color:${typeColor}">${esc(a.app_type?.name||'—')}</span></td>
      <td style="max-width:180px"><div style="font-size:13px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(a.title)}</div>${atts.length?`<div style="font-size:11px;color:var(--ink4);margin-top:2px">${atts.length} attachment${atts.length>1?'s':''}</div>`:''}</td>
      <td><span style="padding:2px 8px;border-radius:20px;font-size:11px;font-weight:600;background:${a.priority==='urgent'?'#FFF1F2':'#F3F4F6'};color:${a.priority==='urgent'?'#9F1239':'#6B7280'}">${a.priority==='urgent'?'Urgent':'Normal'}</span></td>
      <td>${appStatusBadge(a.status)}</td>
      <td style="font-size:13px;color:var(--ink3)">${submitted}</td>
      <td><button class="btn btn-ghost btn-sm app-view-btn" data-app-id="${a.id}">View</button></td>
    </tr>
  `;
}

function renderApplicationDetailView() {
  const a = state.manageAppsDetail;
  if (!a) return '';
  const s = a.sebayat;
  const initials = s?.full_name ? s.full_name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase() : '?';
  const typeColor = a.app_type?.color || '#1D6FAE';
  const atts = Array.isArray(a.attachments) ? a.attachments : [];
  const meta = typeof a.metadata === 'object' && a.metadata ? a.metadata : {};
  const fields = Array.isArray(a.app_type?.form_fields) ? a.app_type.form_fields : [];
  const history = state.manageAppsHistory || [];
  const comments = state.manageAppsComments || [];
  const submitted = a.submitted_at ? new Date(a.submitted_at).toLocaleString('en-IN',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '—';

  return `
    <div style="padding:0 0 40px">
      <div style="display:flex;align-items:center;gap:12px;padding:20px 24px 16px;border-bottom:1px solid var(--border)">
        <button class="btn btn-ghost btn-sm" id="app-detail-back-btn">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg> Back
        </button>
        <div style="flex:1"><h2 style="margin:0;font-size:16px;font-weight:700">${esc(a.title)}</h2><div style="font-size:12px;color:var(--ink4);margin-top:2px">Submitted ${submitted}</div></div>
        ${appStatusBadge(a.status)}
        <span style="padding:2px 8px;border-radius:20px;font-size:11px;font-weight:600;background:${a.priority==='urgent'?'#FFF1F2':'#F3F4F6'};color:${a.priority==='urgent'?'#9F1239':'#6B7280'}">${a.priority==='urgent'?'Urgent':'Normal'}</span>
      </div>
      <div style="display:grid;grid-template-columns:280px 1fr;gap:0;min-height:400px">
        <div style="border-right:1px solid var(--border);padding:20px;display:flex;flex-direction:column;gap:16px">
          <div style="background:var(--surface2);border-radius:10px;padding:14px">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
              ${s?.photo_url ? `<img src="${esc(s.photo_url)}" style="width:40px;height:40px;border-radius:50%;object-fit:cover" />` : `<div style="width:40px;height:40px;border-radius:50%;background:var(--saffron-light);color:var(--saffron);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px">${initials}</div>`}
              <div><div style="font-weight:600;font-size:14px">${esc(s?.full_name||'Unknown')}</div><div style="font-size:12px;color:var(--ink4)">${esc(s?.phone||'')}</div></div>
            </div>
            ${s?.palia_number?`<div style="font-size:12px;color:var(--ink3)">Palia: ${esc(String(s.palia_number))} · ${esc(s?.seba_name||'')}</div>`:''}
            ${s?.registration_no?`<div style="font-size:12px;color:var(--ink4)">Reg: ${esc(s.registration_no)}</div>`:''}
          </div>
          <div>
            <div style="font-size:11px;font-weight:600;color:var(--ink4);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px">Type</div>
            <span style="padding:4px 10px;border-radius:20px;font-size:12px;font-weight:600;background:${typeColor}20;color:${typeColor}">${esc(a.app_type?.name||'Unknown')}</span>
          </div>
          <div>
            <div style="font-size:11px;font-weight:600;color:var(--ink4);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px">Actions</div>
            <div style="display:flex;flex-direction:column;gap:7px">
              ${a.status!=='under_review'?`<button class="btn btn-ghost btn-sm app-status-btn" data-status="under_review" style="justify-content:flex-start;gap:8px;text-align:left">Mark Under Review</button>`:''}
              ${a.status!=='approved'?`<button class="btn btn-sm app-status-btn" data-status="approved" style="background:#F0FDF4;color:#166534;border:1px solid #86EFAC;justify-content:flex-start;gap:8px;text-align:left">Approve</button>`:''}
              ${a.status!=='more_info_required'?`<button class="btn btn-sm app-status-btn" data-status="more_info_required" style="background:#FFF7ED;color:#9A3412;border:1px solid #FDBA74;justify-content:flex-start;gap:8px;text-align:left">Request More Info</button>`:''}
              ${a.status!=='rejected'?`<button class="btn btn-sm app-status-btn" data-status="rejected" style="background:#FFF1F2;color:#9F1239;border:1px solid #FDA4AF;justify-content:flex-start;gap:8px;text-align:left">Reject</button>`:''}
            </div>
          </div>
          ${a.admin_remarks?`<div style="padding:10px;background:#FFFBEB;border-radius:8px;border:1px solid #FCD34D"><div style="font-size:11px;font-weight:600;color:#92400E;margin-bottom:4px">Admin Remarks</div><div style="font-size:13px;color:#78350F">${esc(a.admin_remarks)}</div></div>`:''}
        </div>
        <div style="padding:20px;display:flex;flex-direction:column;gap:20px">
          <div>
            <div style="font-size:11px;font-weight:600;color:var(--ink4);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px">Description</div>
            <div style="font-size:14px;color:var(--ink2);line-height:1.6;white-space:pre-wrap">${esc(a.description||'—')}</div>
          </div>
          ${fields.length>0&&Object.keys(meta).length>0?`
            <div>
              <div style="font-size:11px;font-weight:600;color:var(--ink4);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:10px">Additional Information</div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
                ${fields.map(f=>`<div><div style="font-size:11px;color:var(--ink4);margin-bottom:3px">${esc(f.label)}</div><div style="font-size:13px;font-weight:500;color:var(--ink2)">${esc(String(meta[f.key]||'—'))}</div></div>`).join('')}
              </div>
            </div>
          `:''}
          ${atts.length>0?`
            <div>
              <div style="font-size:11px;font-weight:600;color:var(--ink4);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:10px">Attachments (${atts.length})</div>
              <div style="display:flex;flex-wrap:wrap;gap:10px" id="app-attachments-row">
                ${atts.map((att,ai)=>{
                  const nm = att.name||att.filename||'File';
                  const ext = nm.split('.').pop()?.toLowerCase()||'';
                  const isImg = ['jpg','jpeg','png','gif','webp','bmp','svg'].includes(ext);
                  return isImg
                    ? `<div class="app-att-thumb" data-path="${esc(att.path||'')}" data-idx="${ai}" style="width:100px;height:80px;border-radius:8px;overflow:hidden;border:1px solid var(--border);background:var(--surface-2);display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0" title="${esc(nm)}"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--ink4)" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg></div>`
                    : `<div class="app-att-thumb" data-path="${esc(att.path||'')}" data-idx="${ai}" style="display:flex;flex-direction:column;align-items:center;gap:6px;padding:10px 14px;background:var(--surface-2);border-radius:8px;border:1px solid var(--border);cursor:pointer;min-width:80px;max-width:120px" title="${esc(nm)}"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--saffron)" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg><span style="font-size:11px;color:var(--ink3);text-align:center;word-break:break-all;line-height:1.3">${esc(nm.length>18?nm.slice(0,15)+'…':nm)}</span></div>`;
                }).join('')}
              </div>
            </div>
          `:''}
          ${history.length>0?`
            <div>
              <div style="font-size:11px;font-weight:600;color:var(--ink4);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:10px">Status History</div>
              <div style="display:flex;flex-direction:column;gap:0">
                ${history.map((h,i)=>`
                  <div style="display:flex;gap:12px;padding-bottom:${i<history.length-1?'14px':'0'}">
                    <div style="display:flex;flex-direction:column;align-items:center">
                      <div style="width:10px;height:10px;border-radius:50%;background:${APP_STATUS_COLORS[h.to_status]?.border||'var(--ink4)'};flex-shrink:0;margin-top:3px"></div>
                      ${i<history.length-1?`<div style="width:2px;flex:1;background:var(--border);margin-top:3px"></div>`:''}
                    </div>
                    <div style="flex:1">
                      <div style="font-size:13px;font-weight:500">${h.from_status?`${APP_STATUS_LABELS[h.from_status]||h.from_status} → `:''}${APP_STATUS_LABELS[h.to_status]||h.to_status}</div>
                      ${h.remarks?`<div style="font-size:12px;color:var(--ink3);margin-top:2px">${esc(h.remarks)}</div>`:''}
                      <div style="font-size:11px;color:var(--ink4);margin-top:2px">${new Date(h.created_at).toLocaleString('en-IN',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})}</div>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
          `:''}
          <div>
            <div style="font-size:11px;font-weight:600;color:var(--ink4);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:10px">Comments</div>
            <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:12px">
              ${comments.length===0?`<div style="font-size:13px;color:var(--ink4)">No comments yet.</div>`:comments.map(c=>`
                <div style="padding:10px 12px;border-radius:8px;background:${c.is_internal?'#FFFBEB':'var(--surface2)'};border:1px solid ${c.is_internal?'#FCD34D':'var(--border)'}">
                  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:5px">
                    <div style="font-size:12px;font-weight:600;color:${c.author_role==='admin'?'var(--saffron)':'var(--ink2)'}">${c.author_role==='admin'?'Admin':'Sebayat'}${c.is_internal?' <span style="font-size:10px;background:#FEF9C3;color:#854D0E;padding:1px 5px;border-radius:4px;margin-left:4px">Internal</span>':''}</div>
                    <div style="font-size:11px;color:var(--ink4)">${new Date(c.created_at).toLocaleString('en-IN',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</div>
                  </div>
                  <div style="font-size:13px;color:var(--ink2);line-height:1.5;white-space:pre-wrap">${esc(c.message)}</div>
                </div>
              `).join('')}
            </div>
            <div style="display:flex;flex-direction:column;gap:8px">
              <textarea id="app-comment-input" rows="3" placeholder="Write a comment…" style="font-size:13px;padding:10px;border:1px solid var(--border);border-radius:8px;resize:vertical">${esc(state.manageAppsCommentText)}</textarea>
              <div style="display:flex;align-items:center;justify-content:space-between">
                <label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer">
                  <input type="checkbox" id="app-comment-internal" ${state.manageAppsCommentInternal?'checked':''} />
                  Internal note (not visible to sebayat)
                </label>
                <button class="btn btn-primary btn-sm" id="app-comment-submit">${state.manageAppsCommenting?'Posting…':'Post Comment'}</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

async function openApplicationDetail(appId) {
  const app = state.manageApps.find(a => a.id === appId);
  if (!app) return;
  state.manageAppsDetail = app;
  state.manageAppsCommentText = '';
  state.manageAppsCommentInternal = false;
  const [{ data: comments }, { data: history }] = await Promise.all([
    db.from('application_comments').select('*').eq('application_id', appId).order('created_at'),
    db.from('application_status_history').select('*').eq('application_id', appId).order('created_at'),
  ]);
  state.manageAppsComments = comments || [];
  state.manageAppsHistory = history || [];
  const c = $('#view-container');
  if (c && state.view === 'manage_applications') { c.innerHTML = renderManageApplicationsView(); attachManageApplicationsHandlers(); }
}

async function changeApplicationStatus(appId, newStatus, remarks) {
  const app = state.manageApps.find(a => a.id === appId);
  if (!app) return;
  await Promise.all([
    db.from('applications').update({ status: newStatus, admin_remarks: remarks||'', reviewed_at: new Date().toISOString(), reviewed_by: state.user.id, updated_at: new Date().toISOString() }).eq('id', appId),
    db.from('application_status_history').insert({ application_id: appId, from_status: app.status, to_status: newStatus, changed_by: state.user.id, remarks: remarks||'' }),
  ]);
  await loadManageApplications();
  if (state.manageAppsDetail?.id === appId) await openApplicationDetail(appId);
  else reRenderManageApps();
}

function reRenderManageApps() {
  const c = $('#view-container');
  if (c && state.view === 'manage_applications') { c.innerHTML = renderManageApplicationsView(); attachManageApplicationsHandlers(); }
}

function attachManageApplicationsHandlers() {
  if (!state.manageAppsLoaded && !state.manageAppsLoading) {
    loadManageApplications().then(() => reRenderManageApps());
    return;
  }
  if (state.manageAppsDetail) { attachApplicationDetailHandlers(); return; }

  $$('.app-row, .app-view-btn, .clickable-row').forEach(el => {
    el.onclick = e => {
      e.stopPropagation();
      const id = el.dataset.appId;
      if (id) openApplicationDetail(id);
    };
  });

  $('#manage-apps-search')?.addEventListener('input', e => {
    state.manageAppsSearch = e.target.value;
    reRenderManageApps();
  });
}

function attachApplicationDetailHandlers() {
  $('#app-detail-back-btn')?.addEventListener('click', () => {
    state.manageAppsDetail = null;
    reRenderManageApps();
  });

  // Load signed URLs for private attachments and wire up click handlers
  (async () => {
    const thumbs = $$('.app-att-thumb');
    if (!thumbs.length) return;
    const a = state.manageAppsDetail;
    const atts = Array.isArray(a?.attachments) ? a.attachments : [];
    await Promise.all(thumbs.map(async (el) => {
      const idx = parseInt(el.dataset.idx || '0');
      const path = el.dataset.path || '';
      const att = atts[idx] || {};
      const nm = att.name || att.filename || 'File';
      const ext = nm.split('.').pop()?.toLowerCase() || '';
      const isImg = ['jpg','jpeg','png','gif','webp','bmp'].includes(ext);

      let signedUrl = '';
      if (path) {
        const { data } = await db.storage.from('application-attachments').createSignedUrl(path, 3600);
        signedUrl = data?.signedUrl || '';
      }
      const openUrl = signedUrl || att.url || '';

      if (isImg && signedUrl) {
        el.innerHTML = `<img src="${esc(signedUrl)}" style="width:100%;height:100%;object-fit:cover;display:block" onerror="this.parentElement.innerHTML='<svg width=20 height=20 viewBox=\\'0 0 24 24\\' fill=none stroke=var(--ink4) stroke-width=1.5><rect x=3 y=3 width=18 height=18 rx=2/><circle cx=8.5 cy=8.5 r=1.5/><polyline points=\\'21 15 16 10 5 21\\'/></svg>'" />`;
      }

      el.onclick = () => {
        if (openUrl) window.open(openUrl, '_blank');
        else showToast('Attachment URL not available.', 'error');
      };
    }));
  })();

  $$('.app-status-btn').forEach(btn => {
    btn.onclick = () => {
      const newStatus = btn.dataset.status;
      const needsRemarks = ['rejected','more_info_required'].includes(newStatus);
      const statusLabel = APP_STATUS_LABELS[newStatus] || newStatus;
      const statusColors = {
        approved: { bg: '#F0FDF4', border: '#86EFAC', text: '#166534', dot: '#22C55E' },
        rejected: { bg: '#FFF1F2', border: '#FDA4AF', text: '#9F1239', dot: '#F43F5E' },
        more_info_required: { bg: '#FFF7ED', border: '#FDBA74', text: '#9A3412', dot: '#F97316' },
        under_review: { bg: '#EFF6FF', border: '#93C5FD', text: '#1E40AF', dot: '#3B82F6' },
      };
      const sc = statusColors[newStatus] || { bg: '#F5F0EC', border: '#E8D5C4', text: '#2D1810', dot: '#9B8578' };
      showModal(`
        <div style="padding:28px;width:420px;box-sizing:border-box">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:20px">
            <div style="width:36px;height:36px;border-radius:50%;background:${sc.bg};border:1.5px solid ${sc.border};display:flex;align-items:center;justify-content:center;flex-shrink:0">
              <div style="width:10px;height:10px;border-radius:50%;background:${sc.dot}"></div>
            </div>
            <div>
              <h3 style="margin:0;font-size:16px;font-weight:700;color:#2D1810">Change Status</h3>
              <div style="font-size:13px;color:${sc.text};font-weight:600;margin-top:1px">${statusLabel}</div>
            </div>
          </div>
          <div style="margin-bottom:20px">
            <label style="display:block;font-size:12px;font-weight:600;color:#6B4C3B;margin-bottom:6px;letter-spacing:0.02em">
              REMARKS${needsRemarks ? ' <span style="color:#E8732A">*</span>' : ' <span style="font-weight:400;color:#9B8578">(optional)</span>'}
            </label>
            <textarea id="status-change-remarks" rows="4" placeholder="${newStatus==='rejected'?'Reason for rejection…':'Add a note or reason…'}" style="width:100%;box-sizing:border-box;padding:10px 12px;border:1.5px solid #E8D5C4;border-radius:8px;font-size:13px;font-family:inherit;color:#2D1810;background:#FDFAF7;resize:vertical;outline:none;transition:border-color .15s" onfocus="this.style.borderColor='#E8732A'" onblur="this.style.borderColor='#E8D5C4'"></textarea>
          </div>
          <div style="display:flex;justify-content:flex-end;gap:10px">
            <button class="btn btn-ghost" onclick="closeModal()" style="padding:9px 20px">Cancel</button>
            <button class="btn btn-primary" id="status-change-confirm" style="padding:9px 24px">Confirm</button>
          </div>
        </div>
      `);
      $('#status-change-confirm').onclick = async () => {
        const remarks = $('#status-change-remarks')?.value?.trim() || '';
        if (needsRemarks && !remarks) { showToast('Please provide a reason.', 'error'); return; }
        closeModal();
        await changeApplicationStatus(state.manageAppsDetail.id, newStatus, remarks);
        showToast(`Status updated to ${statusLabel}.`, 'success');
      };
    };
  });

  $('#app-comment-input')?.addEventListener('input', e => { state.manageAppsCommentText = e.target.value; });
  $('#app-comment-internal')?.addEventListener('change', e => { state.manageAppsCommentInternal = e.target.checked; });
  $('#app-comment-submit')?.addEventListener('click', async () => {
    const msg = state.manageAppsCommentText.trim();
    if (!msg) return;
    state.manageAppsCommenting = true;
    await db.from('application_comments').insert({ application_id: state.manageAppsDetail.id, author_id: state.user.id, author_role: 'admin', message: msg, is_internal: state.manageAppsCommentInternal });
    state.manageAppsCommentText = '';
    state.manageAppsCommentInternal = false;
    state.manageAppsCommenting = false;
    const { data: comments } = await db.from('application_comments').select('*').eq('application_id', state.manageAppsDetail.id).order('created_at');
    state.manageAppsComments = comments || [];
    const c = $('#view-container');
    if (c && state.view === 'manage_applications') { c.innerHTML = renderManageApplicationsView(); attachManageApplicationsHandlers(); }
  });
}

// ============================================================
// COMMITTEE MODULE
// ============================================================

const cmtFieldStyle = 'width:100%;padding:8px 12px;border:1.5px solid var(--border);border-radius:var(--radius);font-size:13px;font-family:inherit;color:var(--ink);background:#fff;outline:none;transition:border-color .15s';
const cmtLabelStyle = 'display:block;font-size:12px;font-weight:600;color:var(--ink3);margin-bottom:5px;letter-spacing:.01em';

async function loadCommittees() {
  state.committeesLoading = true;
  const { data } = await db
    .from('committees')
    .select('*, committee_members(id, name, role, role_order, photo_url, phone, email, bio, sebayat_id)')
    .order('year', { ascending: false });
  state.committees = (data || []).map(c => ({
    ...c,
    committee_members: (c.committee_members || []).sort((a, b) => a.role_order - b.role_order),
  }));
  state.committeesLoading = false;
  state.committeesLoaded = true;
}

function renderCommitteesView() {
  if (state.committeesLoading && !state.committeesLoaded) {
    return `<div class="loading-placeholder"><div class="spinner"></div></div>`;
  }
  const list = state.committees;
  return `
    <div class="view-header">
      <div>
        <h2 class="view-title">Committee</h2>
        <p class="view-sub">Manage annual Pratihari Nijog committees and their members.</p>
      </div>
      <button class="btn btn-primary" id="committee-create-btn">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        New Committee
      </button>
    </div>
    ${list.length === 0 ? `
      <div class="empty-state">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        <p>No committees yet. Create the first annual committee to get started.</p>
      </div>
    ` : `
      <div style="padding:0 28px 40px;display:flex;flex-direction:column;gap:16px">
        ${list.map(c => renderCommitteeCard(c)).join('')}
      </div>
    `}
  `;
}

function renderCommitteeCard(c) {
  const memberCount = (c.committee_members || []).length;
  const activeBadge = c.is_active
    ? `<span style="padding:2px 10px;border-radius:20px;font-size:11px;font-weight:600;background:var(--green-bg);color:var(--green-strong);border:1px solid #B7E6CB">Active</span>`
    : `<span style="padding:2px 10px;border-radius:20px;font-size:11px;font-weight:600;background:var(--bg2);color:var(--ink3);border:1px solid var(--border)">Inactive</span>`;
  const topMembers = (c.committee_members || []).slice(0, 6);
  return `
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-lg);padding:20px 24px;box-shadow:var(--shadow-xs)${c.is_active ? ';border-left:3px solid var(--green)' : ''}">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:${topMembers.length > 0 ? '16px' : '0'}">
        <div style="min-width:0">
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:5px">
            <h3 style="margin:0;font-size:16px;font-weight:700;color:var(--ink)">${esc(c.title)}</h3>
            ${activeBadge}
          </div>
          <div style="font-size:12px;color:var(--ink4)">Year ${c.year} &nbsp;&middot;&nbsp; ${memberCount} member${memberCount !== 1 ? 's' : ''}</div>
          ${c.description ? `<div style="font-size:13px;color:var(--ink3);margin-top:6px;line-height:1.5">${esc(c.description)}</div>` : ''}
        </div>
        <div style="display:flex;gap:6px;flex-shrink:0;flex-wrap:wrap;justify-content:flex-end">
          <button class="btn btn-secondary btn-sm committee-manage-btn" data-id="${c.id}">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
            Members
          </button>
          <button class="btn btn-ghost btn-sm committee-edit-btn" data-id="${c.id}">Edit</button>
          ${!c.is_active ? `<button class="btn btn-ghost btn-sm committee-activate-btn" data-id="${c.id}" style="color:var(--green);border-color:var(--green)">Set Active</button>` : ''}
          <button class="btn btn-ghost btn-sm committee-delete-btn" data-id="${c.id}" style="color:var(--red);border-color:transparent">Delete</button>
        </div>
      </div>
      ${topMembers.length > 0 ? `
        <div style="display:flex;flex-wrap:wrap;gap:8px;padding-top:16px;border-top:1px solid var(--border-light)">
          ${topMembers.map(m => `
            <div style="display:flex;align-items:center;gap:8px;background:var(--surface-2);border-radius:var(--radius);padding:6px 10px;border:1px solid var(--border-light)">
              ${m.photo_url ? `<img src="${esc(m.photo_url)}" style="width:26px;height:26px;border-radius:50%;object-fit:cover;flex-shrink:0" />`
                : `<div style="width:26px;height:26px;border-radius:50%;background:var(--saffron-light);color:var(--saffron);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:10px;flex-shrink:0">${esc(m.name).charAt(0).toUpperCase()}</div>`}
              <div>
                <div style="font-size:12px;font-weight:600;color:var(--ink)">${esc(m.name)}</div>
                <div style="font-size:11px;color:var(--ink4)">${esc(m.role)}</div>
              </div>
            </div>
          `).join('')}
          ${memberCount > 6 ? `<div style="display:flex;align-items:center;padding:6px 10px;font-size:12px;color:var(--ink4)">+${memberCount - 6} more</div>` : ''}
        </div>
      ` : ''}
    </div>
  `;
}

function renderCommitteeFormModal(committee) {
  const isEdit = !!committee;
  return `
    <div class="modal-header">
      <div>
        <h3 class="modal-title">${isEdit ? 'Edit Committee' : 'New Committee'}</h3>
        <p class="modal-desc">${isEdit ? 'Update committee details' : 'Create a new annual committee term'}</p>
      </div>
      <button class="modal-close" onclick="closeModal()">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
    <div class="modal-body" style="display:flex;flex-direction:column;gap:18px">
      <div>
        <label style="${cmtLabelStyle}">Year <span style="color:var(--red)">*</span></label>
        <input type="number" id="committee-form-year" style="${cmtFieldStyle}" value="${committee?.year || new Date().getFullYear()}" min="2000" max="2100" placeholder="e.g. 2025" />
      </div>
      <div>
        <label style="${cmtLabelStyle}">Title (English) <span style="color:var(--red)">*</span></label>
        <input type="text" id="committee-form-title" style="${cmtFieldStyle}" value="${esc(committee?.title || '')}" placeholder="e.g. Pratihari Nijog Committee 2025-26" />
      </div>
      <div>
        <label style="${cmtLabelStyle}">Title (Odia) <span style="color:var(--ink4);font-weight:400">(optional)</span></label>
        <input type="text" id="committee-form-title-or" style="${cmtFieldStyle}" value="${esc(committee?.title_or || '')}" placeholder="ଓଡ଼ିଆ ଶୀର୍ଷକ" />
      </div>
      <div>
        <label style="${cmtLabelStyle}">Description (English)</label>
        <textarea id="committee-form-description" style="${cmtFieldStyle};resize:vertical;min-height:80px" rows="3" placeholder="Optional notes about this committee term…">${esc(committee?.description || '')}</textarea>
      </div>
      <div>
        <label style="${cmtLabelStyle}">Description (Odia) <span style="color:var(--ink4);font-weight:400">(optional)</span></label>
        <textarea id="committee-form-description-or" style="${cmtFieldStyle};resize:vertical;min-height:60px" rows="2" placeholder="ଓଡ଼ିଆ ବିବରଣ">${esc(committee?.description_or || '')}</textarea>
      </div>
      <label style="display:flex;align-items:center;gap:10px;cursor:pointer;padding:10px 12px;border-radius:var(--radius);border:1.5px solid var(--border);background:var(--surface-2)">
        <input type="checkbox" id="committee-form-active" ${committee?.is_active ? 'checked' : ''} style="width:16px;height:16px;accent-color:var(--green)" />
        <span style="font-size:13px;color:var(--ink2)">Mark as <strong>active</strong> (current) committee</span>
      </label>
      <div id="committee-form-error" style="color:var(--red);font-size:13px;display:none;background:var(--red-bg);padding:8px 12px;border-radius:var(--radius)"></div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" id="committee-form-save">${isEdit ? 'Save Changes' : 'Create Committee'}</button>
    </div>
  `;
}

function renderCommitteeMembersModal(committee) {
  const members = (committee.committee_members || []).sort((a, b) => a.role_order - b.role_order);
  return `
    <div class="modal-header">
      <div>
        <h3 class="modal-title">Manage Members</h3>
        <p class="modal-desc">${esc(committee.title)}</p>
      </div>
      <button class="modal-close" onclick="closeModal()">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
    <div class="modal-body" style="max-height:60vh;overflow-y:auto">
      <div id="committee-members-list" style="display:flex;flex-direction:column;gap:6px;margin-bottom:20px">
        ${members.length === 0
          ? `<div style="text-align:center;padding:28px;color:var(--ink4);font-size:13px;background:var(--surface-2);border-radius:var(--radius);border:1px dashed var(--border)">No members yet. Add the first one below.</div>`
          : members.map(m => renderMemberRow(m, committee.id)).join('')}
      </div>
      <div style="background:var(--surface-2);border:1px solid var(--border);border-radius:var(--radius-md);padding:16px">
        <div style="font-size:13px;font-weight:700;color:var(--ink2);margin-bottom:14px;display:flex;align-items:center;gap:6px">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add New Member
        </div>
        <div style="margin-bottom:12px">
          <label style="${cmtLabelStyle}">Link to Approved Sebayat</label>
          <div style="position:relative">
            <div style="display:flex;align-items:center;gap:8px;border:1.5px solid var(--border);border-radius:var(--radius);background:#fff;padding:0 10px;transition:border-color .15s" id="sebayat-search-wrap">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--ink4)" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input type="text" id="new-member-sebayat-search" style="flex:1;border:none;outline:none;background:transparent;font-size:13px;font-family:inherit;color:var(--ink);padding:9px 0" placeholder="Search by name or phone…" autocomplete="off" />
              <button id="new-member-sebayat-clear" style="display:none;background:none;border:none;cursor:pointer;color:var(--ink4);padding:2px;line-height:0" title="Clear">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div id="sebayat-dropdown" style="display:none;position:absolute;left:0;right:0;top:calc(100% + 4px);background:#fff;border:1.5px solid var(--border);border-radius:var(--radius-md);z-index:200;max-height:200px;overflow-y:auto;box-shadow:0 4px 16px rgba(0,0,0,.1)"></div>
          </div>
          <div id="sebayat-selected-badge" style="display:none;margin-top:6px;padding:6px 10px;background:#F0FDF4;border:1px solid #86EFAC;border-radius:var(--radius);font-size:12px;font-weight:600;color:#166534;display:none;align-items:center;gap:6px">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            <span id="sebayat-selected-name"></span> — auto-filled
          </div>
        </div>
        <input type="hidden" id="new-member-sebayat-id" value="" />
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
          <div>
            <label style="${cmtLabelStyle}">Name (English) <span style="color:var(--red)">*</span></label>
            <input type="text" id="new-member-name" style="${cmtFieldStyle}" placeholder="Full name" />
          </div>
          <div>
            <label style="${cmtLabelStyle}">Name (Odia)</label>
            <input type="text" id="new-member-name-or" style="${cmtFieldStyle}" placeholder="ଓଡ଼ିଆ ନାମ" />
          </div>
          <div>
            <label style="${cmtLabelStyle}">Role (English) <span style="color:var(--red)">*</span></label>
            <input type="text" id="new-member-role" style="${cmtFieldStyle}" placeholder="e.g. President" list="role-suggestions" />
            <datalist id="role-suggestions">
              <option value="President"><option value="Vice President"><option value="Secretary">
              <option value="Joint Secretary"><option value="Treasurer"><option value="Joint Treasurer">
              <option value="Executive Member"><option value="Advisor">
            </datalist>
          </div>
          <div>
            <label style="${cmtLabelStyle}">Role (Odia)</label>
            <input type="text" id="new-member-role-or" style="${cmtFieldStyle}" placeholder="ଓଡ଼ିଆ ପଦ" />
          </div>
          <div>
            <label style="${cmtLabelStyle}">Phone</label>
            <input type="text" id="new-member-phone" style="${cmtFieldStyle}" placeholder="Optional" />
          </div>
          <div>
            <label style="${cmtLabelStyle}">Display Order</label>
            <input type="number" id="new-member-order" style="${cmtFieldStyle}" value="${members.length + 1}" min="1" />
          </div>
        </div>
        <div style="margin-bottom:8px">
          <label style="${cmtLabelStyle}">Bio / Note (English)</label>
          <input type="text" id="new-member-bio" style="${cmtFieldStyle}" placeholder="Short description (optional)" />
        </div>
        <div style="margin-bottom:12px">
          <label style="${cmtLabelStyle}">Bio / Note (Odia)</label>
          <input type="text" id="new-member-bio-or" style="${cmtFieldStyle}" placeholder="ଓଡ଼ିଆ ବିବରଣ (ଐଚ୍ଛିକ)" />
        </div>
        <div id="new-member-error" style="color:var(--red);font-size:12px;margin-bottom:8px;background:var(--red-bg);padding:7px 10px;border-radius:var(--radius);display:none"></div>
        <button class="btn btn-primary btn-sm" id="new-member-add-btn">Add Member</button>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()" style="flex:unset;padding:10px 28px">Done</button>
    </div>
  `;
}

function renderMemberRow(m, committeeId) {
  return `
    <div style="display:flex;align-items:center;gap:12px;padding:10px 12px;background:var(--surface);border-radius:var(--radius);border:1px solid var(--border)" data-member-id="${m.id}">
      ${m.photo_url
        ? `<img src="${esc(m.photo_url)}" style="width:36px;height:36px;border-radius:50%;object-fit:cover;flex-shrink:0" />`
        : `<div style="width:36px;height:36px;border-radius:50%;background:var(--saffron-light);color:var(--saffron);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;flex-shrink:0">${esc(m.name).charAt(0).toUpperCase()}</div>`}
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:600;color:var(--ink)">${esc(m.name)}</div>
        <div style="font-size:12px;color:var(--ink4)">${esc(m.role)}${m.phone ? ` &nbsp;&middot;&nbsp; ${esc(m.phone)}` : ''}</div>
      </div>
      <button class="btn btn-ghost btn-sm member-delete-btn" data-member-id="${m.id}" data-committee-id="${committeeId}" style="color:var(--red);border:none;padding:4px 8px" title="Remove member">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
      </button>
    </div>
  `;
}

function attachCommitteesHandlers() {
  if (!state.committeesLoaded && !state.committeesLoading) {
    loadCommittees().then(() => {
      const c = $('#view-container');
      if (c && state.view === 'committees') { c.innerHTML = renderCommitteesView(); attachCommitteesHandlers(); }
    });
    return;
  }

  $('#committee-create-btn')?.addEventListener('click', () => {
    showModal(renderCommitteeFormModal(null));
    attachCommitteeFormHandlers(null);
  });

  $$('.committee-edit-btn').forEach(btn => {
    btn.onclick = () => {
      const c = state.committees.find(x => x.id === btn.dataset.id);
      if (!c) return;
      showModal(renderCommitteeFormModal(c));
      attachCommitteeFormHandlers(c);
    };
  });

  $$('.committee-manage-btn').forEach(btn => {
    btn.onclick = async () => {
      const c = state.committees.find(x => x.id === btn.dataset.id);
      if (!c) return;
      showModal(renderCommitteeMembersModal(c));
      attachCommitteeMembersHandlers(c);
    };
  });

  $$('.committee-activate-btn').forEach(btn => {
    btn.onclick = async () => {
      // Deactivate all, then activate selected
      await db.from('committees').update({ is_active: false, updated_at: new Date().toISOString() }).neq('id', '00000000-0000-0000-0000-000000000000');
      await db.from('committees').update({ is_active: true, updated_at: new Date().toISOString() }).eq('id', btn.dataset.id);
      await loadCommittees();
      const c = $('#view-container');
      if (c && state.view === 'committees') { c.innerHTML = renderCommitteesView(); attachCommitteesHandlers(); }
      showToast('Committee set as active.', 'success');
    };
  });

  $$('.committee-delete-btn').forEach(btn => {
    btn.onclick = async () => {
      const c = state.committees.find(x => x.id === btn.dataset.id);
      if (!c) return;
      showConfirm({
        title: 'Delete Committee',
        message: `Delete "${c.title}" and all its members? This cannot be undone.`,
        confirmLabel: 'Delete',
        danger: true,
        onConfirm: async () => {
          await db.from('committees').delete().eq('id', btn.dataset.id);
          await loadCommittees();
          const el = $('#view-container');
          if (el && state.view === 'committees') { el.innerHTML = renderCommitteesView(); attachCommitteesHandlers(); }
          showToast('Committee deleted.', 'success');
        },
      });
    };
  });
}

function attachCommitteeFormHandlers(existing) {
  $('#committee-form-save')?.addEventListener('click', async () => {
    const year = parseInt($('#committee-form-year')?.value || '0');
    const title = $('#committee-form-title')?.value.trim() || '';
    const title_or = $('#committee-form-title-or')?.value.trim() || null;
    const description = $('#committee-form-description')?.value.trim() || '';
    const description_or = $('#committee-form-description-or')?.value.trim() || null;
    const isActive = $('#committee-form-active')?.checked || false;
    const errEl = $('#committee-form-error');

    if (!year || !title) {
      errEl.textContent = 'Year and title are required.';
      errEl.style.display = '';
      return;
    }
    errEl.style.display = 'none';

    if (isActive) {
      // Deactivate all others first
      await db.from('committees').update({ is_active: false, updated_at: new Date().toISOString() }).neq('id', '00000000-0000-0000-0000-000000000000');
    }

    if (existing) {
      await db.from('committees').update({ year, title, title_or, description, description_or, is_active: isActive, updated_at: new Date().toISOString() }).eq('id', existing.id);
    } else {
      await db.from('committees').insert({ year, title, title_or, description, description_or, is_active: isActive, created_by: state.user.id });
    }

    closeModal();
    await loadCommittees();
    const c = $('#view-container');
    if (c && state.view === 'committees') { c.innerHTML = renderCommitteesView(); attachCommitteesHandlers(); }
    showToast(existing ? 'Committee updated.' : 'Committee created.', 'success');
  });
}

async function attachCommitteeMembersHandlers(committee) {
  // Load approved sebayats for the search dropdown
  let sebayatOptions = [];
  const { data: sebData } = await db.from('sebayats')
    .select('id, full_name, first_name, last_name, phone, primary_phone')
    .eq('profile_status', 'approved')
    .order('full_name', { ascending: true, nullsFirst: false });
  sebayatOptions = sebData || [];

  function getSebName(s) {
    return s.full_name || [s.first_name, s.last_name].filter(Boolean).join(' ') || '—';
  }

  // Wire up sebayat search autocomplete
  const searchInput = $('#new-member-sebayat-search');
  const dropdown = $('#sebayat-dropdown');
  const clearBtn = $('#new-member-sebayat-clear');
  const badge = $('#sebayat-selected-badge');
  const badgeName = $('#sebayat-selected-name');
  const hiddenId = $('#new-member-sebayat-id');

  function renderDropdown(query) {
    if (!dropdown) return;
    const q = query.toLowerCase();
    const matches = sebayatOptions.filter(s =>
      getSebName(s).toLowerCase().includes(q) ||
      (s.phone || '').includes(q) ||
      (s.primary_phone || '').includes(q)
    ).slice(0, 10);
    if (!matches.length) { dropdown.style.display = 'none'; return; }
    dropdown.innerHTML = matches.map(s => `
      <div data-seb-id="${esc(s.id)}" style="display:flex;align-items:center;gap:10px;padding:9px 12px;cursor:pointer;border-bottom:1px solid var(--border);transition:background .1s" onmouseover="this.style.background='var(--surface-2)'" onmouseout="this.style.background=''">
        <div style="width:30px;height:30px;border-radius:50%;background:var(--saffron-light);color:var(--saffron);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0">${esc(getSebName(s).charAt(0).toUpperCase())}</div>
        <div>
          <div style="font-size:13px;font-weight:600;color:var(--ink)">${esc(getSebName(s))}</div>
          ${(s.phone || s.primary_phone) ? `<div style="font-size:11px;color:var(--ink4)">${esc(s.phone || s.primary_phone)}</div>` : ''}
        </div>
      </div>`).join('');
    dropdown.style.display = 'block';
    // Attach click handlers to each item
    dropdown.querySelectorAll('[data-seb-id]').forEach(item => {
      item.onclick = () => {
        const seb = sebayatOptions.find(s => s.id === item.dataset.sebId);
        if (!seb) return;
        selectSebayat(seb);
      };
    });
  }

  function selectSebayat(seb) {
    const name = getSebName(seb);
    const phone = seb.phone || seb.primary_phone || '';
    if (searchInput) searchInput.value = name;
    if (hiddenId) hiddenId.value = seb.id;
    if (dropdown) dropdown.style.display = 'none';
    if (clearBtn) clearBtn.style.display = '';
    if (badge) { badge.style.display = 'flex'; }
    if (badgeName) badgeName.textContent = name;
    // Auto-fill name and phone fields
    const nameEl = $('#new-member-name');
    const phoneEl = $('#new-member-phone');
    if (nameEl) nameEl.value = name;
    if (phoneEl) phoneEl.value = phone;
  }

  function clearSebayat() {
    if (searchInput) searchInput.value = '';
    if (hiddenId) hiddenId.value = '';
    if (dropdown) dropdown.style.display = 'none';
    if (clearBtn) clearBtn.style.display = 'none';
    if (badge) badge.style.display = 'none';
    const nameEl = $('#new-member-name');
    const phoneEl = $('#new-member-phone');
    if (nameEl) nameEl.value = '';
    if (phoneEl) phoneEl.value = '';
  }

  if (searchInput) {
    searchInput.oninput = () => {
      const v = searchInput.value.trim();
      if (v.length >= 2) renderDropdown(v);
      else { if (dropdown) dropdown.style.display = 'none'; }
      if (!v && hiddenId) { clearSebayat(); }
    };
    searchInput.onfocus = () => {
      if (searchInput.value.trim().length >= 2) renderDropdown(searchInput.value.trim());
    };
    // Hide dropdown on outside click
    document.addEventListener('click', function hideOnClick(e) {
      if (!searchInput.contains(e.target) && !dropdown?.contains(e.target)) {
        if (dropdown) dropdown.style.display = 'none';
        document.removeEventListener('click', hideOnClick);
      }
    });
  }
  if (clearBtn) clearBtn.onclick = () => clearSebayat();

  $$('.member-delete-btn').forEach(btn => {
    btn.onclick = () => {
      showConfirm({
        title: 'Remove Member',
        message: 'This member will be removed from the committee.',
        confirmLabel: 'Remove',
        danger: true,
        onConfirm: async () => {
          await db.from('committee_members').delete().eq('id', btn.dataset.memberId);
          const { data } = await db.from('committees').select('*, committee_members(id, name, role, role_order, photo_url, phone, email, bio, sebayat_id)').eq('id', committee.id).maybeSingle();
          if (data) {
            const updated = { ...data, committee_members: (data.committee_members || []).sort((a, b) => a.role_order - b.role_order) };
            state.committees = state.committees.map(c => c.id === updated.id ? updated : c);
            const listEl = $('#committee-members-list');
            if (listEl) {
              const members = updated.committee_members;
              listEl.innerHTML = members.length === 0
                ? `<div style="text-align:center;padding:24px;color:var(--ink4);font-size:13px">No members yet.</div>`
                : members.map(m => renderMemberRow(m, committee.id)).join('');
              attachCommitteeMembersHandlers(updated);
            }
          }
        },
      });
    };
  });

  $('#new-member-add-btn')?.addEventListener('click', async () => {
    const name = $('#new-member-name')?.value.trim() || '';
    const name_or = $('#new-member-name-or')?.value.trim() || null;
    const role = $('#new-member-role')?.value.trim() || '';
    const role_or = $('#new-member-role-or')?.value.trim() || null;
    const phone = $('#new-member-phone')?.value.trim() || '';
    const bio = $('#new-member-bio')?.value.trim() || '';
    const description_or = $('#new-member-bio-or')?.value.trim() || null;
    const roleOrder = parseInt($('#new-member-order')?.value || '100');
    const sebayatId = $('#new-member-sebayat-id')?.value || null;
    const errEl = $('#new-member-error');

    if (!name || !role) {
      errEl.textContent = 'Name and role are required.';
      errEl.style.display = '';
      return;
    }
    errEl.style.display = 'none';

    await db.from('committee_members').insert({
      committee_id: committee.id,
      sebayat_id: sebayatId || null,
      name, name_or, role, role_or, phone, bio, description_or,
      role_order: roleOrder,
    });

    // Clear inputs
    ['new-member-name','new-member-name-or','new-member-role','new-member-role-or','new-member-phone','new-member-bio','new-member-bio-or'].forEach(id => {
      const el = $(`#${id}`); if (el) el.value = '';
    });
    clearSebayat();

    // Reload and re-render
    const { data } = await db.from('committees').select('*, committee_members(id, name, role, role_order, photo_url, phone, email, bio, sebayat_id)').eq('id', committee.id).maybeSingle();
    if (data) {
      const updated = { ...data, committee_members: (data.committee_members || []).sort((a, b) => a.role_order - b.role_order) };
      state.committees = state.committees.map(c => c.id === updated.id ? updated : c);
      const listEl = $('#committee-members-list');
      if (listEl) {
        listEl.innerHTML = updated.committee_members.map(m => renderMemberRow(m, committee.id)).join('');
        const orderEl = $('#new-member-order');
        if (orderEl) orderEl.value = updated.committee_members.length + 1;
        attachCommitteeMembersHandlers(updated);
      }
    }
    showToast('Member added.', 'success');
  });
}

/* ============================================================
   EVENT IMAGES VIEW
   ============================================================ */

async function loadEventImages() {
  state.eventImagesLoading = true;
  const { data } = await db.from('event_images').select('*').order('display_order', { ascending: true });
  state.eventImages = data || [];
  state.eventImagesLoading = false;
  state.eventImagesLoaded = true;
}

function renderEventImagesView(container) {
  if (!state.eventImagesLoaded && !state.eventImagesLoading) {
    loadEventImages().then(() => {
      if ($('#view-container') && state.view === 'event_images') renderEventImagesView($('#view-container'));
    });
  }
  if (state.eventImagesLoading && !state.eventImagesLoaded) {
    container.innerHTML = `<div class="page"><div style="padding:40px;text-align:center;color:#9B8578">Loading…</div></div>`;
    return;
  }
  const imgs = state.eventImages;
  container.innerHTML = `
    <div class="page">
      <div class="page-header">
        <div>
          <h1 class="page-title">Event Images</h1>
          <p class="page-sub">Manage the carousel slides shown on the user home screen.</p>
        </div>
        <button class="btn btn-primary" id="ei-add-btn">+ Add Image</button>
      </div>
      ${imgs.length === 0 ? `
        <div class="empty" style="padding:60px 0">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#D4A843" stroke-width="1.5" style="margin-bottom:16px"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
          <p style="margin:0 0 4px;font-weight:600;color:#2D1810">No event images yet</p>
          <p style="margin:0;font-size:13px;color:#9B8578">Add your first image to show it in the app carousel.</p>
        </div>
      ` : `
        <div style="display:grid;gap:12px">
          ${imgs.map((img, idx) => `
            <div class="ei-card" data-id="${esc(img.id)}" style="display:flex;align-items:center;gap:16px;background:#fff;border:1px solid #E8D5C4;border-radius:14px;padding:12px 16px;${!img.is_active ? 'opacity:0.55;' : ''}">
              <img src="${esc(img.image_url)}" style="width:96px;height:64px;object-fit:cover;border-radius:8px;flex-shrink:0;background:#f5f0ec" onerror="this.style.background='#f5f0ec';this.src=''" />
              <div style="flex:1;min-width:0">
                <div style="font-weight:600;font-size:14px;color:#2D1810;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(img.title)}</div>
                ${img.subtitle ? `<div style="font-size:12px;color:#9B8578;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(img.subtitle)}</div>` : ''}
                <div style="font-size:11px;margin-top:4px;color:${img.is_active ? '#27AE60' : '#9B8578'};font-weight:500">${img.is_active ? 'Visible' : 'Hidden'}</div>
              </div>
              <div style="display:flex;align-items:center;gap:6px;flex-shrink:0">
                <button class="icon-btn ei-move-up" data-id="${esc(img.id)}" title="Move up" ${idx === 0 ? 'disabled' : ''}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="18 15 12 9 6 15"/></svg>
                </button>
                <button class="icon-btn ei-move-down" data-id="${esc(img.id)}" title="Move down" ${idx === imgs.length - 1 ? 'disabled' : ''}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
                </button>
                <button class="icon-btn ei-toggle" data-id="${esc(img.id)}" data-active="${img.is_active}" title="${img.is_active ? 'Hide' : 'Show'}">
                  ${img.is_active
                    ? `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#27AE60" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`
                    : `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9B8578" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`
                  }
                </button>
                <button class="icon-btn ei-edit" data-id="${esc(img.id)}" title="Edit">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#E8732A" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
                <button class="icon-btn ei-delete" data-id="${esc(img.id)}" title="Delete" style="color:#C0392B">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#C0392B" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      `}
    </div>
  `;
  attachEventImagesHandlers();
}

function openEventImageModal(existing) {
  const modalTitle = existing ? 'Edit Image' : 'Add Image';
  showModal(`
    <div style="padding:24px;min-width:360px;max-width:480px">
      <h2 style="margin:0 0 20px;font-size:18px;font-weight:700;color:#2D1810">${modalTitle}</h2>

      <div id="ei-modal-preview" style="margin-bottom:16px;border-radius:10px;overflow:hidden;border:2px dashed #E8D5C4;height:180px;background:#FFF8F0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;cursor:pointer;transition:border-color .15s" onclick="$('#ei-file-input').click()">
        ${existing && existing.image_url
          ? `<img src="${esc(existing.image_url)}" style="width:100%;height:180px;object-fit:cover;border-radius:8px" />`
          : `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#D4A843" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
             <span style="font-size:13px;color:#9B8578;font-weight:500">Click to choose an image</span>
             <span style="font-size:11px;color:#C8B8AD">JPG, PNG or WebP · max 5 MB</span>`}
      </div>
      <input type="file" id="ei-file-input" accept="image/jpeg,image/png,image/webp,image/gif" style="display:none" />

      <div id="ei-modal-err" style="display:none;margin-bottom:12px;padding:8px 12px;background:#FFF5F5;border:1px solid #FECACA;border-radius:8px;font-size:13px;color:#C0392B"></div>

      <div class="field">
        <label style="font-size:12px;font-weight:600;color:#6B4C3B;margin-bottom:5px;display:block">Title (English) *</label>
        <input id="ei-title" type="text" placeholder="e.g. Rath Yatra 2026" value="${existing ? esc(existing.title) : ''}" style="width:100%;box-sizing:border-box" />
      </div>
      <div class="field">
        <label style="font-size:12px;font-weight:600;color:#6B4C3B;margin-bottom:5px;display:block">Title (Odia) <span style="font-weight:400;color:#9B8578">(optional)</span></label>
        <input id="ei-title-or" type="text" placeholder="ଓଡ଼ିଆ ଶୀର୍ଷକ" value="${existing ? esc(existing.title_or || '') : ''}" style="width:100%;box-sizing:border-box" />
      </div>
      <div class="field">
        <label style="font-size:12px;font-weight:600;color:#6B4C3B;margin-bottom:5px;display:block">Subtitle (English) <span style="font-weight:400;color:#9B8578">(optional)</span></label>
        <input id="ei-subtitle" type="text" placeholder="e.g. Join the grand procession" value="${existing ? esc(existing.subtitle || '') : ''}" style="width:100%;box-sizing:border-box" />
      </div>
      <div class="field" style="margin-bottom:0">
        <label style="font-size:12px;font-weight:600;color:#6B4C3B;margin-bottom:5px;display:block">Subtitle (Odia) <span style="font-weight:400;color:#9B8578">(optional)</span></label>
        <input id="ei-subtitle-or" type="text" placeholder="ଓଡ଼ିଆ ଉପ-ଶୀର୍ଷକ" value="${existing ? esc(existing.subtitle_or || '') : ''}" style="width:100%;box-sizing:border-box" />
      </div>

      <div style="display:flex;gap:10px;margin-top:20px">
        <button class="btn btn-ghost" id="ei-modal-cancel">Cancel</button>
        <button class="btn btn-primary" id="ei-modal-save" style="flex:1">${existing ? 'Save Changes' : 'Add Image'}</button>
      </div>
    </div>
  `);

  let uploadedImageUrl = existing ? existing.image_url : '';

  // File picker — show preview instantly using object URL
  $('#ei-file-input').addEventListener('change', () => {
    const file = $('#ei-file-input').files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      const errEl = $('#ei-modal-err');
      errEl.textContent = 'File too large. Maximum size is 5 MB.';
      errEl.style.display = '';
      return;
    }
    const preview = $('#ei-modal-preview');
    const objectUrl = URL.createObjectURL(file);
    preview.innerHTML = `<img src="${objectUrl}" style="width:100%;height:180px;object-fit:cover;border-radius:8px" />`;
    preview.style.border = '2px solid #E8D5C4';
    // store file reference for upload on save
    preview._pendingFile = file;
    uploadedImageUrl = ''; // will be set after upload
  });

  $('#ei-modal-cancel').onclick = closeModal;

  $('#ei-modal-save').onclick = async () => {
    const titleVal = $('#ei-title').value.trim();
    const title_or = $('#ei-title-or').value.trim() || null;
    const subtitle = $('#ei-subtitle').value.trim();
    const subtitle_or = $('#ei-subtitle-or').value.trim() || null;
    const errEl = $('#ei-modal-err');
    const preview = $('#ei-modal-preview');
    const pendingFile = preview._pendingFile || null;

    if (!titleVal) {
      errEl.textContent = 'Title is required.';
      errEl.style.display = '';
      return;
    }
    if (!existing && !pendingFile && !uploadedImageUrl) {
      errEl.textContent = 'Please select an image to upload.';
      errEl.style.display = '';
      return;
    }
    errEl.style.display = 'none';
    const saveBtn = $('#ei-modal-save');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Uploading…';

    // Upload new file if one was selected
    if (pendingFile) {
      const ext = pendingFile.name.split('.').pop() || 'jpg';
      const path = `event-images/${Date.now()}_${pendingFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const { error: upErr } = await db.storage.from('event-images').upload(path, pendingFile, { contentType: pendingFile.type, upsert: false });
      if (upErr) {
        errEl.textContent = `Upload failed: ${upErr.message}`;
        errEl.style.display = '';
        saveBtn.disabled = false;
        saveBtn.textContent = existing ? 'Save Changes' : 'Add Image';
        return;
      }
      const { data: urlData } = db.storage.from('event-images').getPublicUrl(path);
      uploadedImageUrl = urlData.publicUrl;
    }

    saveBtn.textContent = 'Saving…';
    let dbErr;
    if (existing) {
      const upd = { title: titleVal, title_or, subtitle: subtitle || null, subtitle_or, updated_at: new Date().toISOString() };
      if (uploadedImageUrl && uploadedImageUrl !== existing.image_url) upd.image_url = uploadedImageUrl;
      ({ error: dbErr } = await db.from('event_images').update(upd).eq('id', existing.id));
    } else {
      const maxOrder = state.eventImages.length > 0 ? Math.max(...state.eventImages.map(i => i.display_order)) + 1 : 0;
      ({ error: dbErr } = await db.from('event_images').insert({ image_url: uploadedImageUrl, title: titleVal, title_or, subtitle: subtitle || null, subtitle_or, display_order: maxOrder, is_active: true }));
    }

    if (dbErr) {
      errEl.textContent = `Save failed: ${dbErr.message}`;
      errEl.style.display = '';
      saveBtn.disabled = false;
      saveBtn.textContent = existing ? 'Save Changes' : 'Add Image';
      return;
    }

    closeModal();
    await loadEventImages();
    const c = $('#view-container');
    if (c && state.view === 'event_images') renderEventImagesView(c);
    showToast(existing ? 'Image updated.' : 'Image added.', 'success');
  };
}

function attachEventImagesHandlers() {
  $('#ei-add-btn')?.addEventListener('click', () => openEventImageModal(null));

  $$('.ei-edit').forEach(btn => {
    btn.onclick = () => {
      const img = state.eventImages.find(i => i.id === btn.dataset.id);
      if (img) openEventImageModal(img);
    };
  });

  $$('.ei-toggle').forEach(btn => {
    btn.onclick = async () => {
      const img = state.eventImages.find(i => i.id === btn.dataset.id);
      if (!img) return;
      await db.from('event_images').update({ is_active: !img.is_active }).eq('id', img.id);
      await loadEventImages();
      const c = $('#view-container');
      if (c && state.view === 'event_images') renderEventImagesView(c);
    };
  });

  $$('.ei-move-up').forEach(btn => {
    btn.onclick = async () => {
      const sorted = [...state.eventImages].sort((a, b) => a.display_order - b.display_order);
      const idx = sorted.findIndex(i => i.id === btn.dataset.id);
      if (idx <= 0) return;
      const a = sorted[idx], b = sorted[idx - 1];
      await Promise.all([
        db.from('event_images').update({ display_order: b.display_order }).eq('id', a.id),
        db.from('event_images').update({ display_order: a.display_order }).eq('id', b.id),
      ]);
      await loadEventImages();
      const c = $('#view-container');
      if (c && state.view === 'event_images') renderEventImagesView(c);
    };
  });

  $$('.ei-move-down').forEach(btn => {
    btn.onclick = async () => {
      const sorted = [...state.eventImages].sort((a, b) => a.display_order - b.display_order);
      const idx = sorted.findIndex(i => i.id === btn.dataset.id);
      if (idx < 0 || idx >= sorted.length - 1) return;
      const a = sorted[idx], b = sorted[idx + 1];
      await Promise.all([
        db.from('event_images').update({ display_order: b.display_order }).eq('id', a.id),
        db.from('event_images').update({ display_order: a.display_order }).eq('id', b.id),
      ]);
      await loadEventImages();
      const c = $('#view-container');
      if (c && state.view === 'event_images') renderEventImagesView(c);
    };
  });

  $$('.ei-delete').forEach(btn => {
    btn.onclick = () => {
      showConfirm({
        title: 'Delete Event Image',
        message: 'This image will be removed from the carousel immediately.',
        confirmLabel: 'Delete',
        danger: true,
        onConfirm: async () => {
          await db.from('event_images').delete().eq('id', btn.dataset.id);
          await loadEventImages();
          const c = $('#view-container');
          if (c && state.view === 'event_images') renderEventImagesView(c);
          showToast('Image deleted.', 'success');
        },
      });
    };
  });
}

/* ============================================================
   SEBA HISTORY VIEW
   ============================================================ */

function fmtDateLocal(d) {
  if (!d) return '—';
  return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { weekday:'short', day:'numeric', month:'short', year:'numeric' });
}
function fmtTime(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit', hour12:true });
}
function fmtDur(m) {
  if (m == null) return '—';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60), r = m % 60;
  return r ? `${h}h ${r}m` : `${h}h`;
}

async function loadSebaHistory() {
  if (state.sebaHistoryLoading) return;
  state.sebaHistoryLoading = true;
  const today = new Date().toISOString().split('T')[0];

  const [rosterRes, sessionRes] = await Promise.all([
    db.from('seba_roster')
      .select('id, beddha_number, is_absent, sebayat_id, sebayats!inner(full_name, phone), seba_schedule!inner(service_date), seba_categories!inner(name, id)')
      .lte('seba_schedule.service_date', today)
      .order('service_date', { referencedTable: 'seba_schedule', ascending: false })
      .limit(1000),
    db.from('seba_sessions')
      .select('id, roster_id, sebayat_id, seba_category_id, service_date, started_at, ended_at, duration_minutes, beddha_number, seba_categories(name)')
      .lte('service_date', today)
      .order('started_at', { ascending: false }),
  ]);

  const byRosterId = new Map();
  const byDateCatSebayat = new Map();
  for (const s of (sessionRes.data || [])) {
    if (s.roster_id) {
      const ex = byRosterId.get(s.roster_id);
      if (!ex || s.started_at > ex.started_at) byRosterId.set(s.roster_id, s);
    } else {
      const k = `${s.service_date}__${s.seba_category_id}__${s.sebayat_id}`;
      const ex = byDateCatSebayat.get(k);
      if (!ex || s.started_at > ex.started_at) byDateCatSebayat.set(k, s);
    }
  }

  // Roster-based entries
  const rosterEntries = (rosterRes.data || []).map(r => {
    const catId = r.seba_categories?.id;
    const fallback = `${r.seba_schedule.service_date}__${catId}__${r.sebayat_id}`;
    const sess = byRosterId.get(r.id) ?? byDateCatSebayat.get(fallback) ?? null;
    // Use the beddha stored on the session (what was active when started); fall back to roster
    const beddha = sess?.beddha_number ?? r.beddha_number ?? null;
    return {
      session_id: sess?.id ?? null,
      roster_id: r.id,
      sebayat_id: r.sebayat_id,
      sebayat_name: r.sebayats?.full_name ?? '—',
      phone: r.sebayats?.phone ?? '',
      service_date: r.seba_schedule.service_date,
      seba_name: r.seba_categories?.name ?? '—',
      beddha_number: beddha,
      is_absent: r.is_absent,
      started_at: sess?.started_at ?? null,
      ended_at: sess?.ended_at ?? null,
      duration_minutes: sess?.duration_minutes ?? null,
    };
  });

  // Session-only entries (no roster row) — deduplicate by date+cat+sebayat
  const rosterKeys = new Set(rosterEntries.map(e => `${e.service_date}__${e.seba_name}__${e.sebayat_id}`));
  const sessionOnlyMap = new Map();
  for (const s of (sessionRes.data || [])) {
    if (!s.ended_at) continue;
    const catName = s.seba_categories?.name ?? '—';
    const k = `${s.service_date}__${catName}__${s.sebayat_id}`;
    if (rosterKeys.has(k)) continue;
    const ex = sessionOnlyMap.get(k);
    if (!ex || s.started_at > ex.started_at) sessionOnlyMap.set(k, s);
  }
  const sebayatNameMap = {};
  for (const s of state.sebayats) sebayatNameMap[s.id] = { name: s.full_name, phone: s.phone };
  const sessionOnlyEntries = [...sessionOnlyMap.values()].map(s => {
    const catName = s.seba_categories?.name ?? '—';
    const sInfo = sebayatNameMap[s.sebayat_id] || { name: '—', phone: '' };
    return {
      session_id: s.id,
      roster_id: null,
      sebayat_id: s.sebayat_id,
      sebayat_name: sInfo.name,
      phone: sInfo.phone,
      service_date: s.service_date,
      seba_name: catName,
      beddha_number: s.beddha_number ?? null,
      is_absent: false,
      started_at: s.started_at,
      ended_at: s.ended_at,
      duration_minutes: s.duration_minutes,
    };
  });

  state.sebaHistoryEntries = [...rosterEntries, ...sessionOnlyEntries]
    .sort((a, b) => b.service_date.localeCompare(a.service_date) || a.sebayat_name.localeCompare(b.sebayat_name));

  // Build member summaries
  const memberMap = new Map();
  for (const e of state.sebaHistoryEntries) {
    if (!memberMap.has(e.sebayat_id)) memberMap.set(e.sebayat_id, { id: e.sebayat_id, name: e.sebayat_name, phone: e.phone, total: 0, completed: 0, absent: 0, minutes: 0 });
    const m = memberMap.get(e.sebayat_id);
    m.total++;
    if (e.is_absent) m.absent++;
    if (e.ended_at) { m.completed++; m.minutes += (e.duration_minutes || 0); }
  }
  state.sebaHistoryMembers = [...memberMap.values()].sort((a, b) => a.name.localeCompare(b.name));

  state.sebaHistoryLoading = false;
  state.sebaHistoryLoaded = true;
}

function shPickDate(iso) {
  const picking = state.sebaHistoryRangePicking;
  if (picking === 'from') {
    state.sebaHistoryDateFrom = iso;
    // if from > to, push to forward
    if (state.sebaHistoryDateTo && iso > state.sebaHistoryDateTo) state.sebaHistoryDateTo = iso;
    state.sebaHistoryRangePicking = 'to';
  } else {
    state.sebaHistoryDateTo = iso;
    // if to < from, pull from back
    if (state.sebaHistoryDateFrom && iso < state.sebaHistoryDateFrom) state.sebaHistoryDateFrom = iso;
    state.sebaHistoryShowCal = false;
  }
  render();
}

function shCalendarHtml() {
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const DAYS = ['S','M','T','W','T','F','S'];
  const yr = state.sebaHistoryCalYear;
  const mo = state.sebaHistoryCalMonth;
  const todayIso = new Date().toISOString().split('T')[0];
  const fromDate = state.sebaHistoryDateFrom;
  const toDate = state.sebaHistoryDateTo;
  const picking = state.sebaHistoryRangePicking;

  const datesWithData = new Set(state.sebaHistoryEntries.map(e => e.service_date));

  const firstDow = new Date(yr, mo, 1).getDay();
  const daysInMonth = new Date(yr, mo + 1, 0).getDate();
  let cells = '';
  for (let i = 0; i < firstDow; i++) cells += `<div style="width:32px;height:32px"></div>`;
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = `${yr}-${String(mo+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const hasDuty = datesWithData.has(iso);
    const isFrom = iso === fromDate;
    const isTo = iso === toDate;
    const inRange = fromDate && toDate && iso >= fromDate && iso <= toDate;
    const isToday = iso === todayIso;
    const isEndpoint = isFrom || isTo;
    const bg = isEndpoint ? '#E8732A' : inRange ? '#FDE8D4' : isToday ? '#FFF8F0' : 'transparent';
    const clr = isEndpoint ? '#fff' : inRange ? '#B8520A' : isToday ? '#E8732A' : '#2D1810';
    const ring = isToday && !isEndpoint ? 'box-shadow:0 0 0 1.5px #E8732A inset' : '';
    cells += `<div onclick="shPickDate('${iso}')" style="width:32px;height:32px;display:flex;flex-direction:column;align-items:center;justify-content:center;border-radius:6px;cursor:pointer;background:${bg};${ring};user-select:none;flex-shrink:0" onmouseover="this.style.opacity='0.75'" onmouseout="this.style.opacity='1'">
      <span style="font-size:12px;font-weight:600;color:${clr};line-height:1">${d}</span>
      ${hasDuty ? `<span style="width:4px;height:4px;border-radius:50%;background:${isEndpoint ? '#fff' : '#1A7A6A'};margin-top:2px;display:block"></span>` : ''}
    </div>`;
  }

  return `<div style="background:#fff;border:1px solid #E8D5C4;border-radius:12px;padding:12px 14px;margin-top:8px;margin-bottom:4px;box-shadow:0 4px 16px rgba(0,0,0,0.10);width:260px">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
      <button class="btn btn-ghost btn-sm" style="padding:4px 8px;min-width:0" onclick="state.sebaHistoryCalMonth===0?(state.sebaHistoryCalYear--,state.sebaHistoryCalMonth=11):state.sebaHistoryCalMonth--;render()">&#8592;</button>
      <span style="font-size:13px;font-weight:700;color:#2D1810">${MONTHS[mo]} ${yr}</span>
      <button class="btn btn-ghost btn-sm" style="padding:4px 8px;min-width:0" onclick="state.sebaHistoryCalMonth===11?(state.sebaHistoryCalYear++,state.sebaHistoryCalMonth=0):state.sebaHistoryCalMonth++;render()">&#8594;</button>
    </div>
    <div style="font-size:10px;color:#E8732A;font-weight:700;text-align:center;margin-bottom:8px;letter-spacing:0.3px">
      ${picking === 'from' ? '&#x25C0; Pick FROM' : 'Pick TO &#x25B6;'}
    </div>
    <div style="display:grid;grid-template-columns:repeat(7,32px);gap:2px;margin-bottom:4px">
      ${DAYS.map(d => `<div style="width:32px;text-align:center;font-size:10px;font-weight:700;color:#9B8578;padding:2px 0">${d}</div>`).join('')}
    </div>
    <div style="display:grid;grid-template-columns:repeat(7,32px);gap:2px">${cells}</div>
    <div style="display:flex;align-items:center;justify-content:space-between;margin-top:10px;padding-top:8px;border-top:1px solid #F0E4D8">
      <div style="display:flex;align-items:center;gap:4px"><span style="width:6px;height:6px;border-radius:50%;background:#1A7A6A;display:inline-block"></span><span style="font-size:10px;color:#9B8578">Has records</span></div>
      <button class="btn btn-sm btn-ghost" style="font-size:11px;padding:3px 10px" onclick="state.sebaHistoryShowCal=false;render()">Close</button>
    </div>
  </div>`;
}

async function renderSebaHistoryView(container) {
  if (!state.sebaHistoryLoaded && !state.sebaHistoryLoading) {
    container.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:200px"><div class="spinner"></div></div>`;
    await loadSebaHistory();
  }

  const vm = state.sebaHistoryViewMode;
  const filter = state.sebaHistoryFilter;
  const q = state.sebaHistorySearch.trim().toLowerCase();
  const todayIso = new Date().toISOString().split('T')[0];
  const dateFrom = state.sebaHistoryDateFrom;
  const dateTo = state.sebaHistoryDateTo;

  // Apply date range filter first (for both stats and table)
  let rangeEntries = state.sebaHistoryEntries;
  if (dateFrom) rangeEntries = rangeEntries.filter(e => e.service_date >= dateFrom);
  if (dateTo) rangeEntries = rangeEntries.filter(e => e.service_date <= dateTo);

  // Stats always reflect the current date range
  const totalEntries = rangeEntries.length;
  const cCount = rangeEntries.filter(e => e.ended_at).length;
  const ipCount = rangeEntries.filter(e => e.started_at && !e.ended_at).length;
  const abCount = rangeEntries.filter(e => e.is_absent).length;

  let entries = rangeEntries;
  if (filter === 'completed') entries = entries.filter(e => e.ended_at);
  else if (filter === 'in_progress') entries = entries.filter(e => e.started_at && !e.ended_at);
  else if (filter === 'absent') entries = entries.filter(e => e.is_absent);
  else if (filter === 'no_session') entries = entries.filter(e => !e.is_absent && !e.started_at);
  if (q.length >= 2) entries = entries.filter(e => e.sebayat_name.toLowerCase().includes(q) || e.phone.includes(q) || e.seba_name.toLowerCase().includes(q));

  const mq = state.sebaHistoryMemberSearch.trim().toLowerCase();
  let members = state.sebaHistoryMembers;
  if (mq.length >= 2) members = members.filter(m => m.name.toLowerCase().includes(mq) || m.phone.includes(mq));

  const FILTERS = [
    { key:'all', label:'All' },
    { key:'completed', label:'Completed' },
    { key:'in_progress', label:'In Progress' },
    { key:'absent', label:'Absent' },
    { key:'no_session', label:'No Record' },
  ];

  const statusBadge = (e) => {
    if (e.is_absent) return `<span class="badge badge-red">Absent</span>`;
    if (e.ended_at) return `<span class="badge badge-green">Completed</span>`;
    if (e.started_at) return `<span class="badge badge-blue">In Progress</span>`;
    return `<span class="badge">No Record</span>`;
  };
  const borderColor = (e) => {
    if (e.is_absent) return '#e53e3e';
    if (e.ended_at) return '#1A7A6A';
    if (e.started_at) return '#1D6FAE';
    return '#E8D5C4';
  };
  const beddhaDisplay = (e) => e.beddha_number != null ? String(e.beddha_number) : '—';

  // Date range bar helpers
  function fmtRangeDate(iso) {
    if (!iso) return 'All';
    if (iso === todayIso) return 'Today';
    return new Date(iso + 'T00:00:00').toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' });
  }

  const sessionsTable = vm === 'sessions' ? `
    <div style="margin-bottom:12px;display:flex;gap:8px;flex-wrap:wrap;align-items:center">
      <div style="display:flex;align-items:center;gap:0;border:1px solid #E8D5C4;border-radius:10px;overflow:hidden;background:#fff;flex:1;min-width:200px">
        <span style="padding:0 10px;display:flex;align-items:center;color:#9B8578">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        </span>
        <input id="sh-search" placeholder="Search name, phone, seba…" value="${esc(state.sebaHistorySearch)}" style="flex:1;border:none;outline:none;padding:10px 10px 10px 0;font-size:13px;color:#2D1810;background:transparent;font-family:inherit" />
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;border:1px solid #E8D5C4;border-radius:10px;padding:4px;background:#fff">
        ${FILTERS.map(f => `<button onclick="state.sebaHistoryFilter='${f.key}';render()" style="padding:5px 12px;border-radius:7px;border:none;cursor:pointer;font-size:12px;font-weight:600;font-family:inherit;background:${filter === f.key ? '#E8732A' : 'transparent'};color:${filter === f.key ? '#fff' : '#6B4C3B'};transition:all 0.15s">${f.label}</button>`).join('')}
      </div>
    </div>
    ${state.sebaHistoryLoading ? `<div style="text-align:center;padding:40px"><div class="spinner"></div></div>` : entries.length === 0 ? `<div class="empty-state"><p>No entries found for this date.</p></div>` : `
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr>
          <th>Date</th><th>Seba</th><th>Sebayat</th><th>Beddha(s)</th><th>Status</th><th>Start</th><th>End</th><th>Duration</th>
        </tr></thead>
        <tbody>
          ${entries.map(e => `
            <tr style="border-left:3px solid ${borderColor(e)}">
              <td>${fmtDateLocal(e.service_date)}</td>
              <td><strong>${esc(e.seba_name)}</strong></td>
              <td>
                <div>${esc(e.sebayat_name)}</div>
                <div style="font-size:11px;color:#9B8578">${esc(e.phone)}</div>
              </td>
              <td>${beddhaDisplay(e)}</td>
              <td>${statusBadge(e)}</td>
              <td>${e.started_at ? fmtTime(e.started_at) : '—'}</td>
              <td>${e.ended_at ? fmtTime(e.ended_at) : '—'}</td>
              <td>${e.duration_minutes != null ? fmtDur(e.duration_minutes) : '—'}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`}
  ` : `
    <div style="margin-bottom:12px">
      <div style="display:flex;align-items:center;gap:0;border:1px solid #E8D5C4;border-radius:10px;overflow:hidden;background:#fff">
        <span style="padding:0 10px;display:flex;align-items:center;color:#9B8578">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        </span>
        <input id="sh-member-search" placeholder="Search member name or phone…" value="${esc(state.sebaHistoryMemberSearch)}" style="flex:1;border:none;outline:none;padding:10px 10px 10px 0;font-size:13px;color:#2D1810;background:transparent;font-family:inherit" />
      </div>
    </div>
    ${state.sebaHistoryLoading ? `<div style="text-align:center;padding:40px"><div class="spinner"></div></div>` : members.length === 0 ? `<div class="empty-state"><p>No members found.</p></div>` : `
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr>
          <th>Member</th><th>Phone</th><th>Total Duties</th><th>Recorded</th><th>Absent</th><th>Total Served</th><th></th>
        </tr></thead>
        <tbody>
          ${members.map(m => `
            <tr>
              <td><strong>${esc(m.name)}</strong></td>
              <td>${esc(m.phone)}</td>
              <td>${m.total}</td>
              <td><span class="badge badge-green">${m.completed}</span></td>
              <td>${m.absent > 0 ? `<span class="badge badge-red">${m.absent}</span>` : '0'}</td>
              <td>${m.minutes > 0 ? fmtDur(m.minutes) : '—'}</td>
              <td><button class="btn btn-sm btn-ghost" onclick="openSebaHistoryMember('${m.id}')">View History</button></td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`}
  `;

  // Range label for the stats card subtitle
  const rangeLabel = (!dateFrom && !dateTo)
    ? 'All time'
    : dateFrom === dateTo
      ? fmtRangeDate(dateFrom)
      : `${fmtRangeDate(dateFrom)} — ${fmtRangeDate(dateTo)}`;

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Seba History</h1>
        <p class="page-sub">Session records for all sebayats</p>
      </div>
      <button class="btn btn-ghost btn-sm" onclick="state.sebaHistoryLoaded=false;state.sebaHistoryEntries=[];state.sebaHistoryMembers=[];render()">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
        Refresh
      </button>
    </div>

    <!-- Date range picker at top -->
    <div style="margin-bottom:16px">
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        <!-- FROM → TO pill -->
        <div style="display:flex;align-items:center;border:1px solid #E8D5C4;border-radius:10px;overflow:hidden;background:#fff">
          <button onclick="state.sebaHistoryRangePicking='from';state.sebaHistoryShowCal=true;render()" style="display:flex;flex-direction:column;align-items:flex-start;gap:1px;padding:8px 16px;background:${state.sebaHistoryShowCal && state.sebaHistoryRangePicking==='from' ? '#FFF0E6' : 'transparent'};border:none;cursor:pointer;border-right:1px solid #E8D5C4">
            <span style="font-size:10px;font-weight:700;color:#9B8578;text-transform:uppercase;letter-spacing:0.6px">From</span>
            <span style="font-size:14px;font-weight:700;color:${state.sebaHistoryShowCal && state.sebaHistoryRangePicking==='from' ? '#E8732A' : (dateFrom ? '#2D1810' : '#9B8578')}">${dateFrom ? fmtRangeDate(dateFrom) : 'All'}</span>
          </button>
          <span style="padding:0 10px;color:#C8B9AE;font-size:14px">→</span>
          <button onclick="state.sebaHistoryRangePicking='to';state.sebaHistoryShowCal=true;render()" style="display:flex;flex-direction:column;align-items:flex-start;gap:1px;padding:8px 16px;background:${state.sebaHistoryShowCal && state.sebaHistoryRangePicking==='to' ? '#FFF0E6' : 'transparent'};border:none;cursor:pointer">
            <span style="font-size:10px;font-weight:700;color:#9B8578;text-transform:uppercase;letter-spacing:0.6px">To</span>
            <span style="font-size:14px;font-weight:700;color:${state.sebaHistoryShowCal && state.sebaHistoryRangePicking==='to' ? '#E8732A' : (dateTo ? '#2D1810' : '#9B8578')}">${dateTo ? fmtRangeDate(dateTo) : 'All'}</span>
          </button>
        </div>
        <!-- Today shortcut — same pill style -->
        ${(dateFrom !== todayIso || dateTo !== todayIso) ? `
        <div style="border:1px solid #E8D5C4;border-radius:10px;overflow:hidden;background:#fff">
          <button onclick="state.sebaHistoryDateFrom='${todayIso}';state.sebaHistoryDateTo='${todayIso}';state.sebaHistoryShowCal=false;state.sebaHistoryRangePicking='from';render()" style="display:flex;flex-direction:column;align-items:flex-start;gap:1px;padding:8px 16px;background:transparent;border:none;cursor:pointer">
            <span style="font-size:10px;font-weight:700;color:#9B8578;text-transform:uppercase;letter-spacing:0.6px">Quick</span>
            <span style="font-size:14px;font-weight:700;color:#2D1810">Today</span>
          </button>
        </div>` : ''}
        <!-- All dates — same pill style, muted -->
        ${(dateFrom || dateTo) ? `
        <div style="border:1px solid #E8D5C4;border-radius:10px;overflow:hidden;background:#fff">
          <button onclick="state.sebaHistoryDateFrom='';state.sebaHistoryDateTo='';state.sebaHistoryShowCal=false;state.sebaHistoryRangePicking='from';render()" style="display:flex;flex-direction:column;align-items:flex-start;gap:1px;padding:8px 16px;background:transparent;border:none;cursor:pointer">
            <span style="font-size:10px;font-weight:700;color:#9B8578;text-transform:uppercase;letter-spacing:0.6px">Clear</span>
            <span style="font-size:14px;font-weight:700;color:#9B8578">All dates</span>
          </button>
        </div>` : ''}
      </div>
      ${state.sebaHistoryShowCal ? shCalendarHtml() : ''}
    </div>

    <!-- Stats cards update based on date range -->
    <div class="stats-row" style="display:flex;gap:12px;margin-bottom:16px;flex-wrap:wrap">
      <div class="stat-card" style="flex:1;min-width:120px">
        <div class="stat-value" style="color:#E8732A">${totalEntries}</div>
        <div class="stat-label">Total Duties</div>
        <div style="font-size:10px;color:#9B8578;margin-top:4px">${esc(rangeLabel)}</div>
      </div>
      <div class="stat-card" style="flex:1;min-width:120px">
        <div class="stat-value" style="color:#1A7A6A">${cCount}</div>
        <div class="stat-label">Completed</div>
        <div style="font-size:10px;color:#9B8578;margin-top:4px">${esc(rangeLabel)}</div>
      </div>
      <div class="stat-card" style="flex:1;min-width:120px">
        <div class="stat-value" style="color:#1D6FAE">${ipCount}</div>
        <div class="stat-label">In Progress</div>
        <div style="font-size:10px;color:#9B8578;margin-top:4px">${esc(rangeLabel)}</div>
      </div>
      <div class="stat-card" style="flex:1;min-width:120px">
        <div class="stat-value" style="color:#e53e3e">${abCount}</div>
        <div class="stat-label">Absent</div>
        <div style="font-size:10px;color:#9B8578;margin-top:4px">${esc(rangeLabel)}</div>
      </div>
    </div>

    <div style="display:flex;gap:8px;margin-bottom:16px">
      <button class="btn btn-sm ${vm === 'sessions' ? 'btn-primary' : 'btn-ghost'}" onclick="state.sebaHistoryViewMode='sessions';render()">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        Sessions
      </button>
      <button class="btn btn-sm ${vm === 'members' ? 'btn-primary' : 'btn-ghost'}" onclick="state.sebaHistoryViewMode='members';render()">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
        By Member
      </button>
    </div>

    ${sessionsTable}
  `;

  // Attach search handlers — preserve focus and cursor position after re-render
  const searchEl = $('#sh-search');
  if (searchEl) {
    searchEl.addEventListener('input', e => {
      const val = e.target.value;
      const pos = e.target.selectionStart;
      state.sebaHistorySearch = val;
      renderSebaHistoryView(container);
      const el = $('#sh-search');
      if (el) { el.focus(); el.setSelectionRange(pos, pos); }
    });
  }
  const mSearchEl = $('#sh-member-search');
  if (mSearchEl) {
    mSearchEl.addEventListener('input', e => {
      const val = e.target.value;
      const pos = e.target.selectionStart;
      state.sebaHistoryMemberSearch = val;
      renderSebaHistoryView(container);
      const el = $('#sh-member-search');
      if (el) { el.focus(); el.setSelectionRange(pos, pos); }
    });
  }
}

async function openSebaHistoryMember(sebayatId) {
  // Member may not be in the current date-range summary — look up directly if needed
  let member = state.sebaHistoryMembers.find(m => m.id === sebayatId);
  if (!member) {
    const { data: s } = await db.from('sebayats')
      .select('id, first_name, last_name, primary_phone')
      .eq('id', sebayatId)
      .maybeSingle();
    if (s) member = { id: s.id, name: `${s.first_name || ''} ${s.last_name || ''}`.trim(), phone: s.primary_phone || '', total: 0, completed: 0, absent: 0, minutes: 0 };
  }
  if (!member) return;

  state.sebaHistoryMember = member;
  state.sebaHistoryMemberLoading = true;
  state.sebaHistoryMemberEntries = [];
  state.view = 'seba_history_member';
  render();

  const today = new Date().toISOString().split('T')[0];
  const [rosterRes, sessionRes] = await Promise.all([
    db.from('seba_roster')
      .select('id, beddha_number, is_absent, seba_category_id, seba_schedule!inner(service_date), seba_categories!inner(name)')
      .eq('sebayat_id', sebayatId)
      .lte('seba_schedule.service_date', today)
      .order('service_date', { referencedTable: 'seba_schedule', ascending: false })
      .limit(500),
    db.from('seba_sessions')
      .select('id, roster_id, seba_category_id, service_date, started_at, ended_at, duration_minutes')
      .eq('sebayat_id', sebayatId)
      .lte('service_date', today)
      .order('service_date', { ascending: false }),
  ]);

  const byRosterId = new Map();
  const byDateCat = new Map();
  for (const s of (sessionRes.data || [])) {
    if (s.roster_id) {
      const ex = byRosterId.get(s.roster_id);
      if (!ex || s.started_at > ex.started_at) byRosterId.set(s.roster_id, s);
    } else {
      const k = `${s.service_date}__${s.seba_category_id}`;
      const ex = byDateCat.get(k);
      if (!ex || s.started_at > ex.started_at) byDateCat.set(k, s);
    }
  }

  state.sebaHistoryMemberEntries = (rosterRes.data || []).map(r => {
    const fallback = `${r.seba_schedule.service_date}__${r.seba_category_id}`;
    const sess = byRosterId.get(r.id) ?? byDateCat.get(fallback) ?? null;
    return {
      id: r.id,
      service_date: r.seba_schedule.service_date,
      seba_name: r.seba_categories?.name ?? '—',
      beddha_number: r.beddha_number,
      is_absent: r.is_absent,
      started_at: sess?.started_at ?? null,
      ended_at: sess?.ended_at ?? null,
      duration_minutes: sess?.duration_minutes ?? null,
    };
  });

  state.sebaHistoryMemberLoading = false;
  render();
}

function renderSebaHistoryMemberView(container) {
  const m = state.sebaHistoryMember;
  if (!m) { container.innerHTML = ''; return; }

  const entries = state.sebaHistoryMemberEntries;
  const totalMinutes = entries.reduce((acc, e) => acc + (e.duration_minutes || 0), 0);

  const rowColor = (e) => {
    if (e.is_absent) return '#e53e3e';
    if (e.ended_at) return '#1A7A6A';
    return '#E8D5C4';
  };

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">${esc(m.name)}</h1>
        <p class="page-sub">Pali History · ${esc(m.phone)}</p>
      </div>
      <button class="btn btn-ghost btn-sm" onclick="state.view='seba_history';render()">← Back to Seba History</button>
    </div>

    <div class="stats-row" style="display:flex;gap:12px;margin-bottom:20px;flex-wrap:wrap">
      <div class="stat-card" style="flex:1;min-width:120px">
        <div class="stat-value" style="color:#E8732A">${m.total}</div>
        <div class="stat-label">Total Duties</div>
      </div>
      <div class="stat-card" style="flex:1;min-width:120px">
        <div class="stat-value" style="color:#1A7A6A">${m.completed}</div>
        <div class="stat-label">Recorded</div>
      </div>
      <div class="stat-card" style="flex:1;min-width:120px">
        <div class="stat-value" style="color:#e53e3e">${m.absent}</div>
        <div class="stat-label">Absent</div>
      </div>
      <div class="stat-card" style="flex:1;min-width:120px">
        <div class="stat-value" style="color:#D4A843">${totalMinutes > 0 ? fmtDur(totalMinutes) : '—'}</div>
        <div class="stat-label">Total Served</div>
      </div>
    </div>

    ${state.sebaHistoryMemberLoading ? `<div style="text-align:center;padding:40px"><div class="spinner"></div></div>` :
      entries.length === 0 ? `<div class="empty-state"><p>No duties found for this member.</p></div>` : `
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr><th>Date</th><th>Seba</th><th>Beddha</th><th>Status</th><th>Start</th><th>End</th><th>Duration</th></tr></thead>
        <tbody>
          ${entries.map(e => `
            <tr style="border-left:3px solid ${rowColor(e)}">
              <td>${fmtDateLocal(e.service_date)}</td>
              <td><strong>${esc(e.seba_name)}</strong></td>
              <td>#${e.beddha_number}</td>
              <td>${e.is_absent ? `<span class="badge badge-red">Absent</span>` : e.ended_at ? `<span class="badge badge-green">Completed</span>` : `<span class="badge">No Record</span>`}</td>
              <td>${e.started_at ? fmtTime(e.started_at) : '—'}</td>
              <td>${e.ended_at ? fmtTime(e.ended_at) : '—'}</td>
              <td>${e.duration_minutes != null ? fmtDur(e.duration_minutes) : '—'}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`}
  `;
}

// ============================================================
// NOTIFICATIONS VIEW
// ============================================================

async function loadNotifData() {
  const [chRes, ftRes] = await Promise.all([
    db.from('notification_channels').select('*').order('channel'),
    db.from('notification_feature_config').select('*').order('sort_order'),
  ]);
  state.notifChannels = chRes.data || [];
  state.notifFeatures = ftRes.data || [];
}

async function loadNotifLog(page = 1) {
  const pageSize = 20;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const { data, count } = await db.from('notification_log')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);
  state.notifLog = data || [];
  state.notifLogTotal = count || 0;
  state.notifLogPage = page;
}

async function loadAdminNotifs() {
  const { data } = await db.from('admin_notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(30);
  state.adminNotifs = data || [];
  state.adminNotifsUnread = (data || []).filter(n => !n.is_read).length;
  updateNotifBell();
}

function updateNotifBell() {
  const badge = $('#notif-badge');
  const count = state.adminNotifsUnread;
  if (badge) {
    if (count > 0) {
      badge.style.display = 'block';
      badge.textContent = count > 99 ? '99+' : count;
    } else {
      badge.style.display = 'none';
    }
  }
}

function renderNotifBellList() {
  const list = $('#notif-list');
  if (!list) return;
  if (state.adminNotifs.length === 0) {
    list.innerHTML = `<div style="padding:24px;text-align:center;color:#9B8578;font-size:13px">No notifications yet</div>`;
    return;
  }
  list.innerHTML = state.adminNotifs.map(n => `
    <div class="notif-item${n.is_read ? '' : ' notif-unread'}" data-notif-id="${esc(n.id)}" style="padding:12px 16px;border-bottom:1px solid #F7F0E8;cursor:pointer;display:flex;gap:10px;align-items:flex-start;${n.is_read ? '' : 'background:#FFFAF5;'}">
      <div style="width:8px;height:8px;border-radius:50%;background:${n.is_read ? 'transparent' : '#E8732A'};flex-shrink:0;margin-top:5px"></div>
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:${n.is_read ? '400' : '600'};color:#2D1810;line-height:1.3">${esc(n.title)}</div>
        <div style="font-size:12px;color:#9B8578;margin-top:2px;line-height:1.4">${esc(n.body.length > 80 ? n.body.slice(0, 80) + '…' : n.body)}</div>
        <div style="font-size:11px;color:#C4A882;margin-top:4px">${fmtRelTime(n.created_at)}</div>
      </div>
    </div>
  `).join('');

  $$('.notif-item', list).forEach(el => {
    el.onclick = async () => {
      const id = el.dataset.notifId;
      await db.from('admin_notifications').update({ is_read: true }).eq('id', id);
      await loadAdminNotifs();
      renderNotifBellList();
      const notif = state.adminNotifs.find(n => n.id === id);
      if (notif?.reference_type === 'sebayat' && notif?.reference_id) {
        state.notifBellOpen = false;
        const dropdown = $('#notif-dropdown');
        if (dropdown) dropdown.style.display = 'none';
        actions.openSebayat(notif.reference_id);
      }
    };
  });
}

function fmtRelTime(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function attachNotifBellHandlers() {
  const btn = $('#notif-bell-btn');
  const dropdown = $('#notif-dropdown');
  const markAll = $('#notif-mark-all-read');
  const viewAll = $('#notif-view-all');

  if (btn && dropdown) {
    btn.onclick = (e) => {
      e.stopPropagation();
      state.notifBellOpen = !state.notifBellOpen;
      dropdown.style.display = state.notifBellOpen ? 'block' : 'none';
      if (state.notifBellOpen) {
        loadAdminNotifs().then(renderNotifBellList);
      }
    };
    document.addEventListener('click', (e) => {
      if (!$('#notif-bell-wrap')?.contains(e.target)) {
        state.notifBellOpen = false;
        dropdown.style.display = 'none';
      }
    });
  }

  if (markAll) {
    markAll.onclick = async () => {
      await db.from('admin_notifications').update({ is_read: true }).eq('is_read', false);
      await loadAdminNotifs();
      renderNotifBellList();
    };
  }

  if (viewAll) {
    viewAll.onclick = () => {
      state.notifBellOpen = false;
      if (dropdown) dropdown.style.display = 'none';
      state.view = 'notifications';
      state.notifTab = 'log';
      render();
    };
  }
}

async function renderNotificationsView(container) {
  if (!state.notifChannels.length) await loadNotifData();
  if (state.notifTab === 'log') await loadNotifLog(state.notifLogPage);

  const chMap = {};
  for (const ch of state.notifChannels) chMap[ch.channel] = ch;

  const tabs = [
    { key: 'channels', label: 'Channel Settings' },
    { key: 'features', label: 'Feature Settings' },
    { key: 'seba_reminders', label: 'Seba Reminders' },
    { key: 'log', label: 'Notification Log' },
  ];

  const CHANNEL_ICONS = {
    sms: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
    whatsapp: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>`,
    push: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>`,
  };

  let tabContent = '';

  if (state.notifTab === 'channels') {
    tabContent = `
      <div style="display:flex;flex-direction:column;gap:16px;max-width:680px">
        ${['sms','whatsapp','push'].map(ch => {
          const cfg = chMap[ch] || { channel: ch, enabled: false, push_mode: 'expo-go' };
          return `
          <div class="card" style="padding:20px 24px">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:16px">
              <div style="display:flex;align-items:center;gap:12px">
                <div style="width:40px;height:40px;border-radius:10px;background:${cfg.enabled ? '#FFF3E8' : '#F5F0EC'};display:flex;align-items:center;justify-content:center;color:${cfg.enabled ? '#E8732A' : '#9B8578'}">${CHANNEL_ICONS[ch]}</div>
                <div>
                  <div style="font-weight:600;font-size:15px;color:#2D1810">${ch === 'sms' ? 'SMS' : ch === 'whatsapp' ? 'WhatsApp' : 'Push Notifications'}</div>
                  <div style="font-size:12px;color:#9B8578;margin-top:2px">${ch === 'sms' ? 'Send SMS via MSG91' : ch === 'whatsapp' ? 'Send WhatsApp messages via MSG91' : 'Send mobile push notifications via Expo'}</div>
                </div>
              </div>
              <label class="toggle-switch" title="${cfg.enabled ? 'Disable' : 'Enable'} ${ch}">
                <input type="checkbox" class="notif-ch-toggle" data-channel="${esc(ch)}" ${cfg.enabled ? 'checked' : ''}>
                <span class="toggle-track"></span>
              </label>
            </div>
            ${ch === 'push' ? `
            <div style="margin-top:16px;padding-top:16px;border-top:1px solid #F0E4D7;display:flex;align-items:center;gap:12px">
              <span style="font-size:13px;color:#6B4C3B;font-weight:500">Push Mode</span>
              <select class="notif-push-mode-select" style="border:1px solid #E8D5C4;border-radius:8px;padding:6px 10px;font-size:13px;color:#2D1810;background:#fff;cursor:pointer">
                <option value="expo-go" ${cfg.push_mode === 'expo-go' ? 'selected' : ''}>Expo Go (Development)</option>
                <option value="production" ${cfg.push_mode === 'production' ? 'selected' : ''}>Production (App Store / Play Store)</option>
              </select>
              <span style="font-size:12px;color:#9B8578">Switch to Production when app is published to store</span>
            </div>` : ''}
          </div>`;
        }).join('')}
        <div style="font-size:12px;color:#9B8578;padding:0 4px">
          MSG91 credentials are configured via environment variables (MSG91_AUTH_KEY). Toggle channels on once credentials are set.
        </div>
      </div>`;

  } else if (state.notifTab === 'features') {
    const CHANNEL_COLS = [
      { key: 'sms_enabled', label: 'SMS', icon: CHANNEL_ICONS.sms },
      { key: 'whatsapp_enabled', label: 'WhatsApp', icon: CHANNEL_ICONS.whatsapp },
      { key: 'push_enabled', label: 'Push', icon: CHANNEL_ICONS.push },
      { key: 'admin_notification_enabled', label: 'Admin Alert', icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>` },
    ];
    tabContent = `
      <div style="overflow-x:auto">
        <table class="data-table" style="min-width:600px">
          <thead>
            <tr>
              <th style="width:240px">Event</th>
              ${CHANNEL_COLS.map(c => `<th style="text-align:center;width:100px"><div style="display:flex;align-items:center;justify-content:center;gap:6px">${c.icon}<span>${c.label}</span></div></th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${state.notifFeatures.map(ft => `
              <tr data-event="${esc(ft.event_key)}">
                <td style="font-weight:500;color:#2D1810">${esc(ft.label)}</td>
                ${CHANNEL_COLS.map(col => `
                  <td style="text-align:center">
                    <label class="toggle-switch">
                      <input type="checkbox" class="notif-feat-toggle" data-event="${esc(ft.event_key)}" data-col="${esc(col.key)}" ${ft[col.key] ? 'checked' : ''}>
                      <span class="toggle-track"></span>
                    </label>
                  </td>`).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      <p style="font-size:12px;color:#9B8578;margin-top:12px">Changes save automatically. A channel must also be enabled globally in Channel Settings to deliver messages.</p>`;

  } else if (state.notifTab === 'seba_reminders') {
    // Load config + recent webhook events on demand
    if (!state.sebaReminderConfig) {
      const { data: cfg } = await db.from('seba_notification_config').select('*').eq('id', 1).maybeSingle();
      state.sebaReminderConfig = cfg || null;
    }
    const { data: recentEvents } = await db.from('niti_tracker_events')
      .select('*').order('received_at', { ascending: false }).limit(20);
    state.nitiTrackerEvents = recentEvents || [];

    const cfg = state.sebaReminderConfig || {};
    const projectUrl = (SUPABASE_URL || '').replace(/\/$/, '');
    const webhookUrl = `${projectUrl}/functions/v1/niti-started`;

    const EV_STATUS = { processed: 'green', skipped_disabled: 'amber', invalid_auth: 'red', invalid_payload: 'red', error: 'red' };

    tabContent = `
      <div style="display:flex;flex-direction:column;gap:20px;max-width:820px">

        <!-- Day-before + Morning reminders -->
        <div class="card" style="padding:20px 24px">
          <div style="font-weight:700;font-size:15px;color:#2D1810;margin-bottom:4px">Scheduled Reminders</div>
          <div style="font-size:12px;color:#9B8578;margin-bottom:18px">Time-based reminders sent the day before and the morning of each seba. Times are in IST.</div>

          <div style="display:flex;align-items:center;justify-content:space-between;gap:16px;padding:14px 0;border-top:1px solid #F0E4D7">
            <div style="flex:1">
              <div style="font-weight:600;font-size:14px;color:#2D1810">Evening reminder (day before)</div>
              <div style="font-size:12px;color:#9B8578;margin-top:2px">Notify sebayats on duty tomorrow.</div>
            </div>
            <input type="time" id="sr-evening-time" value="${esc(String(cfg.evening_reminder_time || '18:00').slice(0,5))}" style="padding:6px 10px;border:1px solid #E8D5C4;border-radius:8px;font-size:13px" />
            <label class="toggle-switch">
              <input type="checkbox" id="sr-evening-toggle" ${cfg.evening_reminder_enabled ? 'checked' : ''}>
              <span class="toggle-track"></span>
            </label>
          </div>

          <div style="display:flex;align-items:center;justify-content:space-between;gap:16px;padding:14px 0;border-top:1px solid #F0E4D7">
            <div style="flex:1">
              <div style="font-weight:600;font-size:14px;color:#2D1810">Morning reminder (day of)</div>
              <div style="font-size:12px;color:#9B8578;margin-top:2px">Notify sebayats on duty today.</div>
            </div>
            <input type="time" id="sr-morning-time" value="${esc(String(cfg.morning_reminder_time || '06:00').slice(0,5))}" style="padding:6px 10px;border:1px solid #E8D5C4;border-radius:8px;font-size:13px" />
            <label class="toggle-switch">
              <input type="checkbox" id="sr-morning-toggle" ${cfg.morning_reminder_enabled ? 'checked' : ''}>
              <span class="toggle-track"></span>
            </label>
          </div>
        </div>

        <!-- Preceding Niti Reminder -->
        <div class="card" style="padding:20px 24px">
          <div style="font-weight:700;font-size:15px;color:#2D1810;margin-bottom:4px">Preceding Niti Reminder</div>
          <div style="font-size:12px;color:#9B8578;margin-bottom:14px">Sent in real time to the next sebayat the moment a preceding niti begins.</div>
          <div style="display:flex;align-items:center;justify-content:space-between;gap:16px">
            <div style="flex:1">
              <div style="font-weight:600;font-size:14px;color:#2D1810">Enable preceding-niti reminder</div>
              <div style="font-size:12px;color:#9B8578;margin-top:2px">Requires external niti tracker integration.</div>
            </div>
            <label class="toggle-switch">
              <input type="checkbox" id="sr-preceding-toggle" ${cfg.preceding_niti_reminder_enabled ? 'checked' : ''}>
              <span class="toggle-track"></span>
            </label>
          </div>
          <div style="display:flex;align-items:center;gap:10px;margin-top:16px">
            <span style="font-size:13px;color:#6B4C3B">Notify when</span>
            <input type="number" id="sr-offset-input" min="1" max="5" value="${cfg.preceding_niti_offset ?? 1}" style="width:64px;padding:6px 10px;border:1px solid #E8D5C4;border-radius:8px;font-size:13px;text-align:center" />
            <span style="font-size:13px;color:#6B4C3B">niti(s) before the user's own niti starts (1–5).</span>
          </div>
        </div>

        <!-- Niti Tracker Integration -->
        <div class="card" style="padding:20px 24px">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:10px">
            <div>
              <div style="font-weight:700;font-size:15px;color:#2D1810">Niti Tracker Integration</div>
              <div style="font-size:12px;color:#9B8578;margin-top:2px">Master switch for the external webhook. Turn OFF to stop accepting calls.</div>
            </div>
            <label class="toggle-switch">
              <input type="checkbox" id="sr-tracker-toggle" ${cfg.niti_tracker_integration_enabled ? 'checked' : ''}>
              <span class="toggle-track"></span>
            </label>
          </div>

          <div style="margin-top:14px;padding:14px;background:#FAF6F1;border-radius:10px">
            <div style="font-size:12px;font-weight:600;color:#6B4C3B;margin-bottom:6px">Webhook URL</div>
            <div style="display:flex;gap:8px;align-items:center">
              <input type="text" readonly id="sr-webhook-url" value="${esc(webhookUrl)}" style="flex:1;padding:8px 10px;border:1px solid #E8D5C4;border-radius:8px;font-size:12px;font-family:monospace;background:#fff" />
              <button class="btn btn-ghost btn-sm" id="sr-copy-url">Copy</button>
            </div>

            <div style="font-size:12px;font-weight:600;color:#6B4C3B;margin:14px 0 6px">Webhook Secret</div>
            <div style="display:flex;gap:8px;align-items:center">
              <input type="text" readonly id="sr-webhook-secret" value="${esc(cfg.niti_tracker_webhook_secret || '')}" style="flex:1;padding:8px 10px;border:1px solid #E8D5C4;border-radius:8px;font-size:12px;font-family:monospace;background:#fff" />
              <button class="btn btn-ghost btn-sm" id="sr-copy-secret">Copy</button>
              <button class="btn btn-accent btn-sm" id="sr-regen-secret">Regenerate</button>
            </div>

            <details style="margin-top:14px">
              <summary style="cursor:pointer;font-size:12px;font-weight:600;color:#6B4C3B">Request format for external tracker</summary>
              <pre style="margin-top:8px;padding:12px;background:#2D1810;color:#F7F0E8;border-radius:8px;font-size:11px;line-height:1.5;overflow-x:auto">POST ${esc(webhookUrl)}
Authorization: Bearer &lt;secret above&gt;
Content-Type: application/json

{
  "niti_sequence": 2,
  "niti_name": "Mangala Alati",
  "service_date": "YYYY-MM-DD",
  "started_at": "2026-05-04T04:30:00Z"
}</pre>
            </details>
          </div>
        </div>

        <!-- Save button -->
        <div style="display:flex;justify-content:flex-end;gap:10px">
          <button class="btn btn-primary" id="sr-save">Save Reminder Settings</button>
        </div>

        <!-- Recent webhook events -->
        <div class="card" style="padding:20px 24px">
          <div style="font-weight:700;font-size:15px;color:#2D1810;margin-bottom:4px">Recent Webhook Calls</div>
          <div style="font-size:12px;color:#9B8578;margin-bottom:14px">Last 20 incoming webhook events from the niti tracker.</div>
          <div style="overflow-x:auto">
            <table class="data-table">
              <thead><tr>
                <th>Received</th>
                <th>Niti</th>
                <th>Service Date</th>
                <th>Notified</th>
                <th>Status</th>
                <th>Error</th>
              </tr></thead>
              <tbody>
                ${state.nitiTrackerEvents.length === 0
                  ? `<tr><td colspan="6" style="text-align:center;color:#9B8578;padding:24px">No webhook calls received yet</td></tr>`
                  : state.nitiTrackerEvents.map(ev => `
                    <tr>
                      <td style="white-space:nowrap;font-size:12px;color:#9B8578">${ev.received_at ? new Date(ev.received_at).toLocaleString() : '—'}</td>
                      <td style="font-size:13px">${esc(ev.niti_name || '—')}${ev.niti_sequence ? ` <span style="color:#9B8578">#${ev.niti_sequence}</span>` : ''}</td>
                      <td style="font-size:13px">${esc(ev.service_date || '—')}</td>
                      <td style="text-align:center;font-size:13px">${ev.notified_count ?? 0}</td>
                      <td><span class="badge badge-${EV_STATUS[ev.status] || ''}">${esc(ev.status || '—')}</span></td>
                      <td style="font-size:12px;color:#C04040;max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(ev.error_message || '')}</td>
                    </tr>`).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

  } else if (state.notifTab === 'log') {
    const pageSize = 20;
    const totalPages = Math.ceil(state.notifLogTotal / pageSize);
    const STATUS_COLORS = { sent: 'green', failed: 'red', skipped: 'amber' };
    const CH_LABELS = { sms: 'SMS', whatsapp: 'WhatsApp', push: 'Push', admin: 'Admin Alert' };

    tabContent = `
      <div>
        <div style="overflow-x:auto">
          <table class="data-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Event</th>
                <th>Channel</th>
                <th>Recipient</th>
                <th>Status</th>
                <th>Error</th>
              </tr>
            </thead>
            <tbody>
              ${state.notifLog.length === 0 ? `<tr><td colspan="6" style="text-align:center;color:#9B8578;padding:32px">No notifications logged yet</td></tr>` :
                state.notifLog.map(l => `
                  <tr>
                    <td style="white-space:nowrap;font-size:12px;color:#9B8578">${l.created_at ? new Date(l.created_at).toLocaleString() : '—'}</td>
                    <td style="font-size:13px">${esc(l.event_key || '—')}</td>
                    <td><span class="badge">${esc(CH_LABELS[l.channel] || l.channel || '—')}</span></td>
                    <td style="font-size:12px;color:#6B4C3B">${esc(l.recipient_phone || l.recipient_type || '—')}</td>
                    <td><span class="badge badge-${STATUS_COLORS[l.status] || ''}">${esc(l.status || '—')}</span></td>
                    <td style="font-size:12px;color:#C04040;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(l.error_message || '')}</td>
                  </tr>`).join('')}
            </tbody>
          </table>
        </div>
        ${totalPages > 1 ? `
          <div style="display:flex;align-items:center;gap:8px;margin-top:16px;justify-content:center">
            <button class="btn btn-ghost btn-sm" id="notif-log-prev" ${state.notifLogPage <= 1 ? 'disabled' : ''}>Previous</button>
            <span style="font-size:13px;color:#6B4C3B">Page ${state.notifLogPage} of ${totalPages}</span>
            <button class="btn btn-ghost btn-sm" id="notif-log-next" ${state.notifLogPage >= totalPages ? 'disabled' : ''}>Next</button>
          </div>` : ''}
      </div>`;
  }

  container.innerHTML = `
    <div class="page">
      <div class="page-header">
        <div>
          <h1>Notification Settings</h1>
          <p>Configure how and when notifications are sent to sebayats and administrators.</p>
        </div>
      </div>
      <div class="tabs" style="margin-bottom:24px">
        ${tabs.map(t => `<button class="tab-btn${state.notifTab === t.key ? ' active' : ''}" data-notif-tab="${esc(t.key)}">${esc(t.label)}</button>`).join('')}
      </div>
      <div id="notif-tab-body">${tabContent}</div>
    </div>`;

  // Attach tab switchers
  $$('[data-notif-tab]').forEach(btn => {
    btn.onclick = async () => {
      state.notifTab = btn.dataset.notifTab;
      await renderNotificationsView(container);
    };
  });

  // Channel toggles
  $$('.notif-ch-toggle').forEach(inp => {
    inp.onchange = async () => {
      const channel = inp.dataset.channel;
      await db.from('notification_channels').update({ enabled: inp.checked, updated_at: new Date().toISOString() }).eq('channel', channel);
      const ch = state.notifChannels.find(c => c.channel === channel);
      if (ch) ch.enabled = inp.checked;
    };
  });

  // Push mode selector
  const pushModeSelect = $('.notif-push-mode-select');
  if (pushModeSelect) {
    pushModeSelect.onchange = async () => {
      await db.from('notification_channels').update({ push_mode: pushModeSelect.value, updated_at: new Date().toISOString() }).eq('channel', 'push');
      const ch = state.notifChannels.find(c => c.channel === 'push');
      if (ch) ch.push_mode = pushModeSelect.value;
      showToast('Push mode updated', 'success');
    };
  }

  // Seba Reminders tab handlers
  if (state.notifTab === 'seba_reminders') {
    const copyUrl = $('#sr-copy-url');
    if (copyUrl) copyUrl.onclick = () => {
      const el = $('#sr-webhook-url');
      if (el) { el.select(); document.execCommand('copy'); showToast('Webhook URL copied', 'success'); }
    };
    const copySecret = $('#sr-copy-secret');
    if (copySecret) copySecret.onclick = () => {
      const el = $('#sr-webhook-secret');
      if (el) { el.select(); document.execCommand('copy'); showToast('Webhook secret copied', 'success'); }
    };
    const regen = $('#sr-regen-secret');
    if (regen) regen.onclick = () => {
      showConfirm({
        title: 'Regenerate Webhook Secret',
        message: 'The external niti tracker must be updated with the new value after regeneration.',
        confirmLabel: 'Regenerate',
        danger: true,
        onConfirm: async () => {
          const bytes = new Uint8Array(24); crypto.getRandomValues(bytes);
          const newSecret = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
          const { error } = await db.from('seba_notification_config').update({
            niti_tracker_webhook_secret: newSecret, updated_at: new Date().toISOString(),
          }).eq('id', 1);
          if (error) { showToast('Failed: ' + error.message, 'error'); return; }
          state.sebaReminderConfig = { ...(state.sebaReminderConfig || {}), niti_tracker_webhook_secret: newSecret };
          showToast('Secret regenerated', 'success');
          await renderNotificationsView(container);
        },
      });
    };
    const saveBtn = $('#sr-save');
    if (saveBtn) saveBtn.onclick = async () => {
      const eveningEnabled = $('#sr-evening-toggle').checked;
      const morningEnabled = $('#sr-morning-toggle').checked;
      const precedingEnabled = $('#sr-preceding-toggle').checked;
      const trackerEnabled = $('#sr-tracker-toggle').checked;
      const eveningTime = $('#sr-evening-time').value || '18:00';
      const morningTime = $('#sr-morning-time').value || '06:00';
      const offset = Math.max(1, Math.min(5, parseInt($('#sr-offset-input').value, 10) || 1));

      saveBtn.disabled = true; saveBtn.textContent = 'Saving…';
      const { error } = await db.from('seba_notification_config').update({
        evening_reminder_enabled: eveningEnabled,
        evening_reminder_time: eveningTime,
        morning_reminder_enabled: morningEnabled,
        morning_reminder_time: morningTime,
        preceding_niti_reminder_enabled: precedingEnabled,
        preceding_niti_offset: offset,
        niti_tracker_integration_enabled: trackerEnabled,
        updated_at: new Date().toISOString(),
      }).eq('id', 1);
      saveBtn.disabled = false; saveBtn.textContent = 'Save Reminder Settings';
      if (error) { showToast('Failed: ' + error.message, 'error'); return; }

      // Try to reschedule cron
      const { error: cronErr } = await db.rpc('reschedule_seba_reminder_jobs');
      if (cronErr) {
        showToast('Saved, but cron reschedule failed: ' + cronErr.message, 'error');
      } else {
        showToast('Reminder settings saved', 'success');
      }
      state.sebaReminderConfig = null;
      await renderNotificationsView(container);
    };
  }

  // Feature toggles
  $$('.notif-feat-toggle').forEach(inp => {
    inp.onchange = async () => {
      const { event: eventKey, col } = inp.dataset;
      await db.from('notification_feature_config').update({ [col]: inp.checked, updated_at: new Date().toISOString() }).eq('event_key', eventKey);
      const ft = state.notifFeatures.find(f => f.event_key === eventKey);
      if (ft) ft[col] = inp.checked;
    };
  });

  // Log pagination
  const prevBtn = $('#notif-log-prev');
  const nextBtn = $('#notif-log-next');
  if (prevBtn) prevBtn.onclick = async () => { await renderNotificationsView(container); };
  if (nextBtn) nextBtn.onclick = async () => {
    state.notifLogPage++;
    await renderNotificationsView(container);
  };
  if (prevBtn) prevBtn.onclick = async () => {
    state.notifLogPage--;
    await renderNotificationsView(container);
  };
}

// ── Notification bell polling ────────────────────────────────
function startNotifPolling() {
  loadAdminNotifs();
  setInterval(loadAdminNotifs, 30000);
}

// ============================================================
// TODAY'S SEBA — Live Control Panel
// ============================================================

let _sebaTodayPollTimer = null;

async function loadSebaTodayData() {
  const today = new Date().toISOString().slice(0, 10);

  // 1. Today's schedule: which beddha number is active per group
  const { data: schedRows } = await db
    .from('seba_schedule')
    .select('id, group_id, service_date, beddha_number')
    .eq('service_date', today);

  const scheduleToday = schedRows || [];
  // group_id → { scheduleId, beddha }
  const groupBeddhaMap = {};
  for (const r of scheduleToday) groupBeddhaMap[r.group_id] = { scheduleId: r.id, beddha: r.beddha_number };

  const todayBeddhas = [...new Set(scheduleToday.map(r => r.beddha_number))];

  // 2. Build lookups from already-loaded state
  const allCats = state.sebaCategories || [];
  const catMap = {};
  for (const c of allCats) catMap[c.id] = c;
  const sebayatMap = {};
  for (const s of (state.sebayats || [])) sebayatMap[s.id] = s;

  let rosterRows = [];
  if (todayBeddhas.length > 0) {
    // 3. Fetch ALL selections matching today's beddha numbers — let JS handle group filtering
    const { data: selData, error: selError } = await db
      .from('sebayat_seba_selections')
      .select('sebayat_id, seba_category_id, beddha_number')
      .in('beddha_number', todayBeddhas);

    // 4. Filter: only keep rows where the category's group is active today at that beddha
    const filtered = (selData || []).filter(sel => {
      const cat = catMap[sel.seba_category_id];
      if (!cat?.group_id) return false;
      return groupBeddhaMap[cat.group_id]?.beddha === sel.beddha_number;
    });

    rosterRows = filtered.map(sel => {
      const cat = catMap[sel.seba_category_id];
      const groupId = cat?.group_id;
      return {
        id: `sel:${sel.sebayat_id}:${sel.seba_category_id}:${sel.beddha_number}`,
        sebayat_id: sel.sebayat_id,
        substitute_sebayat_id: null,
        seba_category_id: sel.seba_category_id,
        beddha_number: sel.beddha_number,
        is_absent: false,
        notes: '',
        schedule_id: groupId ? (groupBeddhaMap[groupId]?.scheduleId || null) : null,
        category: cat ? { id: cat.id, name: cat.name, niti_sequence: cat.niti_sequence, group_id: cat.group_id } : null,
        sebayat: sebayatMap[sel.sebayat_id] || null,
        sub: null,
      };
    });
  }

  // 6. Today's sessions
  const { data: sessionRows } = await db
    .from('seba_sessions')
    .select('id, roster_id, sebayat_id, seba_category_id, service_date, started_at, ended_at, duration_minutes, beddha_number, started_by_admin, marked_done_by, marked_done_at')
    .eq('service_date', today);

  state.sebaTodayRoster = rosterRows;
  state.sebaTodaySessions = sessionRows || [];
  state.sebaTodayDate = today;
  state.sebaTodaySchedule = groupBeddhaMap;

  // Update sidebar live badge
  const inProgress = (sessionRows || []).filter(s => s.started_at && !s.ended_at).length;
  const badge = document.getElementById('seba-today-inprogress-badge');
  if (badge) badge.style.display = inProgress > 0 ? 'block' : 'none';
}

function sessionForRoster(rosterRow) {
  const sessions = state.sebaTodaySessions || [];
  // Match by (service_date, seba_category_id, sebayat_id) — synthetic ids never match roster_id
  return sessions.find(s =>
    s.service_date === state.sebaTodayDate &&
    s.seba_category_id === rosterRow.seba_category_id &&
    s.sebayat_id === rosterRow.sebayat_id
  ) || null;
}

function getTodayEntryStatus(rosterRow, session) {
  if (rosterRow.is_absent && !session) return 'absent';
  if (!session) return 'scheduled';
  if (session.ended_at) return 'done';
  if (session.started_at) return 'inprogress';
  return 'scheduled';
}

function fmtTimeOnly(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function fmtDuration(mins) {
  if (!mins && mins !== 0) return '—';
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

async function renderSebaTodayView(container) {
  container.innerHTML = `<div class="page"><div style="padding:32px 0;text-align:center;color:#9B8578">Loading today's seba…</div></div>`;

  await loadSebaTodayData();

  // Stop any previous poll
  if (_sebaTodayPollTimer) { clearInterval(_sebaTodayPollTimer); _sebaTodayPollTimer = null; }

  _sebaTodayPollTimer = setInterval(async () => {
    if (state.view !== 'seba_today') { clearInterval(_sebaTodayPollTimer); _sebaTodayPollTimer = null; return; }
    await loadSebaTodayData();
    _paintSebaTodayTable();
  }, 60000);

  _paintSebaTodayView(container);
}

function _paintSebaTodayView(container) {
  const today = state.sebaTodayDate || new Date().toISOString().slice(0, 10);
  const todayFmt = new Date(today + 'T00:00:00').toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });

  const roster = state.sebaTodayRoster || [];
  const sessions = state.sebaTodaySessions || [];

  const totalScheduled = roster.length;
  const totalDone = roster.filter(r => { const s = sessionForRoster(r); return s && s.ended_at; }).length;
  const totalInProgress = roster.filter(r => { const s = sessionForRoster(r); return s && s.started_at && !s.ended_at; }).length;
  const totalAbsent = roster.filter(r => r.is_absent).length;

  // Walk-in sessions (no roster_id and no matching roster row)
  const rosterSessionIds = new Set(roster.map(r => { const s = sessionForRoster(r); return s?.id; }).filter(Boolean));
  const walkins = sessions.filter(s => !rosterSessionIds.has(s.id) && s.ended_at);

  container.innerHTML = `
    <div class="page">
      <div class="page-header">
        <div>
          <h1>Today's Seba</h1>
          <p style="font-size:13px;color:#9B8578">${esc(todayFmt)}</p>
        </div>
        <div class="page-actions">
          <button class="btn btn-ghost btn-sm" id="st-refresh-btn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
            Refresh
          </button>
          <button class="btn btn-primary btn-sm" id="st-walkin-btn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Add Walk-in
          </button>
        </div>
      </div>

      <!-- Stats strip -->
      <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:24px">
        ${[
          { label: 'Scheduled', val: totalScheduled, color: '#6B7280', bg: '#F3F4F6' },
          { label: 'In Progress', val: totalInProgress, color: '#E8732A', bg: '#FFF3E8' },
          { label: 'Done', val: totalDone, color: '#16A34A', bg: '#F0FDF4' },
          { label: 'Absent', val: totalAbsent, color: '#DC2626', bg: '#FEF2F2' },
        ].map(c => `<div style="background:${c.bg};border-radius:10px;padding:10px 18px;min-width:90px">
          <div style="font-size:24px;font-weight:800;color:${c.color};line-height:1">${c.val}</div>
          <div style="font-size:11px;font-weight:600;color:${c.color};opacity:0.7;margin-top:2px;text-transform:uppercase;letter-spacing:0.5px">${c.label}</div>
        </div>`).join('')}
      </div>

      <!-- Main table -->
      <div id="st-table-wrap">
        ${_buildSebaTodayTable(roster, walkins)}
      </div>
    </div>
  `;

  _attachSebaTodayHandlers(container);
}

function _buildSebaTodayTable(roster, walkins, compact = false) {
  if (roster.length === 0 && (!walkins || walkins.length === 0)) {
    return `<div class="panel" style="padding:48px;text-align:center;color:#9B8578">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#C4A882" stroke-width="1.5" style="margin-bottom:12px"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
      <div style="font-weight:600;margin-bottom:4px">No roster for today</div>
      <div style="font-size:13px">Today's seba schedule has not been assigned yet.</div>
    </div>`;
  }

  const STATUS_META = {
    scheduled:  { label: 'Scheduled',   cls: 'badge',            color: '#9B8578' },
    inprogress: { label: 'In Progress',  cls: 'badge badge-blue', color: '#E8732A' },
    done:       { label: 'Done',         cls: 'badge badge-green', color: '#16A34A' },
    absent:     { label: 'Absent',       cls: 'badge badge-red',  color: '#DC2626' },
  };

  // Sort roster by niti_sequence then name then beddha, then group by category
  const sorted = [...roster].sort((a, b) => {
    const sa = a.category?.niti_sequence ?? 9999;
    const sb = b.category?.niti_sequence ?? 9999;
    if (sa !== sb) return sa - sb;
    const na = a.category?.name || '';
    const nb = b.category?.name || '';
    if (na !== nb) return na.localeCompare(nb);
    return (a.beddha_number || 0) - (b.beddha_number || 0);
  });

  // Group by seba_category_id
  const groups = [];
  const groupIndex = {};
  for (const r of sorted) {
    const key = r.seba_category_id || r.category?.name || '—';
    if (groupIndex[key] == null) {
      groupIndex[key] = groups.length;
      groups.push({ key, rows: [] });
    }
    groups[groupIndex[key]].rows.push(r);
  }

  const tableRows = [];
  for (const grp of groups) {
    const firstRow = grp.rows[0];
    const catName = firstRow.category?.name || '—';
    const nitiSeq = firstRow.category?.niti_sequence;
    const beddha = firstRow.beddha_number || '—';
    const rowCount = grp.rows.length;

    // Determine group-level aggregate status
    const groupSessions = grp.rows.map(r => sessionForRoster(r));
    const groupStatuses = grp.rows.map((r, i) => getTodayEntryStatus(r, groupSessions[i]));
    const allDone = groupStatuses.every(s => s === 'done');
    const anyInProgress = groupStatuses.some(s => s === 'inprogress');
    const anyScheduled = groupStatuses.some(s => s === 'scheduled');
    const allAbsent = groupStatuses.every(s => s === 'absent');

    // Group-level aggregate status label
    let groupStatus, groupStatusCls;
    if (allDone) { groupStatus = 'Done'; groupStatusCls = 'badge badge-green'; }
    else if (anyInProgress) { groupStatus = 'In Progress'; groupStatusCls = 'badge badge-blue'; }
    else if (allAbsent) { groupStatus = 'Absent'; groupStatusCls = 'badge badge-red'; }
    else { groupStatus = 'Scheduled'; groupStatusCls = 'badge'; }

    // Group-level action: "Start All" if all scheduled, "Mark All Done" if all in-progress
    let groupAction = '';
    if (anyScheduled && !anyInProgress) {
      if (!compact) {
        const rosterIds = grp.rows
          .filter((r, i) => groupStatuses[i] === 'scheduled')
          .map(r => esc(r.id)).join(',');
        groupAction = `<button class="btn btn-accent btn-xs st-start-all-btn" data-roster-ids="${rosterIds}">Start All</button>`;
      }
    } else if (anyInProgress) {
      const sessionIds = grp.rows
        .filter((r, i) => groupStatuses[i] === 'inprogress')
        .map((r, i) => esc(groupSessions[groupStatuses.indexOf('inprogress', i)]?.id))
        .filter(Boolean);
      // Simpler: collect session IDs for in-progress rows
      const inProgressPairs = grp.rows
        .map((r, i) => ({ r, s: groupSessions[i], st: groupStatuses[i] }))
        .filter(x => x.st === 'inprogress');
      const sids = inProgressPairs.map(x => esc(x.s.id)).join(',');
      if (sids) groupAction = `<button class="btn btn-primary btn-xs st-done-all-btn" data-session-ids="${sids}">Complete All</button>`;
    }

    // Seba name cell with rowspan
    const sebaCell = `<td rowspan="${rowCount}" style="vertical-align:top;padding-top:14px;border-right:2px solid #F3EDE6">
      <div style="display:flex;align-items:flex-start;gap:6px">
        ${nitiSeq != null ? `<span style="width:22px;height:22px;border-radius:50%;background:#F3EDE6;color:#9B6B4A;font-size:10px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px">${nitiSeq}</span>` : ''}
        <div>
          <div style="font-weight:700;font-size:13px;color:#2D1810;line-height:1.3">${esc(catName)}</div>
          <div style="font-size:11px;color:#9B8578;margin-top:2px">${compact ? '' : `Beddha ${beddha} · `}${rowCount} sebayat${rowCount > 1 ? 's' : ''}</div>
        </div>
      </div>
    </td>`;

    const groupActionCell = `<td rowspan="${rowCount}" style="vertical-align:top;padding-top:10px">
      <div style="display:flex;flex-direction:column;gap:6px">${groupAction}</div>
    </td>`;

    for (let i = 0; i < grp.rows.length; i++) {
      const r = grp.rows[i];
      const session = groupSessions[i];
      const status = groupStatuses[i];
      const sebName = r.sebayat ? [r.sebayat.title, r.sebayat.first_name, r.sebayat.last_name].filter(Boolean).join(' ') : '—';
      const subName = r.sub ? [r.sub.first_name, r.sub.last_name].filter(Boolean).join(' ') : null;
      const regNo = r.sebayat?.registration_no || '';

      const startInput = (status === 'inprogress' || status === 'done') && session
        ? `<input type="time" class="st-time-edit" data-session-id="${esc(session.id)}" data-field="started_at"
             value="${session.started_at ? new Date(session.started_at).toLocaleTimeString('en-GB', {hour:'2-digit', minute:'2-digit'}) : ''}"
             style="width:90px;padding:4px 6px;border:1px solid #E8D5C4;border-radius:6px;font-size:12px" />`
        : `<span style="font-size:13px;color:#9B8578">${fmtTimeOnly(session?.started_at)}</span>`;

      const endInput = status === 'done' && session
        ? `<input type="time" class="st-time-edit" data-session-id="${esc(session.id)}" data-field="ended_at"
             value="${session.ended_at ? new Date(session.ended_at).toLocaleTimeString('en-GB', {hour:'2-digit', minute:'2-digit'}) : ''}"
             style="width:90px;padding:4px 6px;border:1px solid #E8D5C4;border-radius:6px;font-size:12px" />`
        : `<span style="font-size:13px;color:#9B8578">${fmtTimeOnly(session?.ended_at)}</span>`;

      let rowAction = '';
      if (status === 'scheduled') {
        rowAction = `<button class="btn btn-ghost btn-xs st-start-btn" data-roster-id="${esc(r.id)}" style="font-size:11px;color:#2D8A4E;border-color:#2D8A4E">Start</button>`;
      } else if (status === 'inprogress') {
        rowAction = `<button class="btn btn-ghost btn-xs st-done-btn" data-roster-id="${esc(r.id)}" data-session-id="${esc(session.id)}" style="font-size:11px;color:#E8732A;border-color:#E8732A;font-weight:600">Complete</button>`;
      } else if (status === 'done') {
        rowAction = compact
          ? `<span style="font-size:11px;font-weight:600;color:#4ADE80">Done</span>`
          : `<button class="btn btn-ghost btn-xs st-undo-done-btn" data-session-id="${esc(session?.id)}" style="font-size:11px">Undo</button>`;
      }

      let rowStatusCls, rowStatusLabel;
      if (status === 'done') { rowStatusLabel = 'Done'; rowStatusCls = 'badge badge-green'; }
      else if (status === 'inprogress') { rowStatusLabel = 'In Progress'; rowStatusCls = 'badge badge-blue'; }
      else if (status === 'absent') { rowStatusLabel = 'Absent'; rowStatusCls = 'badge badge-red'; }
      else { rowStatusLabel = 'Scheduled'; rowStatusCls = 'badge'; }

      const rowStatusCell = `<td style="text-align:center"><span class="${rowStatusCls}">${rowStatusLabel}</span></td>`;

      const rowStyle = status === 'done' ? 'opacity:0.7;' : '';
      const borderTop = i === 0 ? 'border-top:2px solid #EDE0D4;' : '';

      const timeCells = compact ? '' : `<td>${startInput}</td><td>${endInput}</td><td style="font-size:13px;color:#6B4C3B">${fmtDuration(session?.duration_minutes)}</td>`;

      const sebayatId = r.sebayat_id || r.sebayat?.id || '';
      const photoUrl = r.sebayat?.photo_url || '';
      const initials = r.sebayat ? getInitials(r.sebayat) : '?';
      const avatarHtml = `<div class="row-avatar" style="width:28px;height:28px;font-size:11px;flex-shrink:0;${photoUrl ? `background-image:url('${esc(photoUrl)}');background-size:cover;background-position:center` : ''}">${photoUrl ? '' : esc(initials)}</div>`;
      const sebNameCell = `<td>
            <div style="display:flex;align-items:center;gap:7px;cursor:pointer" onclick="actions.openSebayat('${esc(sebayatId)}')">
              ${avatarHtml}
              <div>
                <div style="font-size:13px;font-weight:500;color:#E8732A;text-decoration:underline;text-decoration-style:dotted;text-underline-offset:2px">${esc(sebName)}</div>
                ${regNo ? `<div style="font-size:11px;color:#C4A882">${esc(regNo)}</div>` : ''}
                ${subName ? `<div style="font-size:11px;color:#E8732A">Sub: ${esc(subName)}</div>` : ''}
              </div>
            </div>
          </td>`;

      if (i === 0) {
        tableRows.push(`<tr style="${rowStyle}${borderTop}">
          ${sebaCell}
          ${sebNameCell}
          ${timeCells}
          <td style="font-size:11px;color:#9B8578">${rowAction}</td>
          ${rowStatusCell}
          ${compact ? '' : groupActionCell}
        </tr>`);
      } else {
        tableRows.push(`<tr style="${rowStyle}">
          ${sebNameCell}
          ${timeCells}
          <td style="font-size:11px;color:#9B8578">${rowAction}</td>
          ${rowStatusCell}
        </tr>`);
      }
    }
  }

  // Walk-in rows appended at the bottom (no grouping needed)
  let walkinRows = '';
  if (walkins && walkins.length > 0) {
    walkinRows = walkins.map(s => {
      const catName = state.sebaCategories.find(c => c.id === s.seba_category_id)?.name || '—';
      const seb = state.sebayats.find(x => x.id === s.sebayat_id);
      const sebName = seb ? getName(seb) : '—';
      const wiPhotoUrl = seb?.photo_url || '';
      const wiInitials = seb ? getInitials(seb) : '?';
      const wiAvatar = `<div class="row-avatar" style="width:28px;height:28px;font-size:11px;flex-shrink:0;${wiPhotoUrl ? `background-image:url('${esc(wiPhotoUrl)}');background-size:cover;background-position:center` : ''}">${wiPhotoUrl ? '' : esc(wiInitials)}</div>`;
      return `<tr style="background:#FFFAF5;border-top:2px solid #EDE0D4">
        <td><span style="font-weight:700;font-size:13px;color:#2D1810">${esc(catName)}</span><div style="font-size:11px;color:#E8732A;margin-top:2px">Walk-in</div></td>
        <td>
          <div style="display:flex;align-items:center;gap:7px;cursor:pointer" onclick="actions.openSebayat('${esc(s.sebayat_id)}')">
            ${wiAvatar}
            <div style="font-size:13px;font-weight:500;color:#E8732A;text-decoration:underline;text-decoration-style:dotted;text-underline-offset:2px">${esc(sebName)}</div>
          </div>
        </td>
        ${compact ? '' : `<td style="font-size:13px;color:#9B8578">${fmtTimeOnly(s.started_at)}</td>
        <td style="font-size:13px;color:#9B8578">${fmtTimeOnly(s.ended_at)}</td>
        <td style="font-size:13px;color:#6B4C3B">${fmtDuration(s.duration_minutes)}</td>`}
        <td></td>
        <td><span class="badge badge-green">Done</span></td>
        ${compact ? '' : '<td></td>'}
      </tr>`;
    }).join('');
  }

  const totalSebayats = roster.length;
  const totalGroups = groups.length;

  return `
    <div class="data-table-wrap">
      <table class="data-table" style="${compact ? 'min-width:0' : ''}">
        <thead>
          <tr>
            <th style="width:${compact ? '140px' : '220px'}">Seba</th>
            <th>Sebayat</th>
            ${compact ? '' : `<th style="width:120px">Started</th><th style="width:120px">Ended</th><th style="width:80px">Duration</th>`}
            <th style="width:${compact ? '60px' : '70px'}"></th>
            <th style="width:${compact ? '80px' : '110px'};text-align:center">Status</th>
            ${compact ? '' : `<th style="width:160px">Actions</th>`}
          </tr>
        </thead>
        <tbody>
          ${tableRows.join('')}
          ${walkinRows}
        </tbody>
      </table>
    </div>
    <div class="table-footer">
      <span class="table-count">${totalGroups} seba${totalGroups === 1 ? '' : 's'} · ${totalSebayats} sebayat${totalSebayats === 1 ? '' : 's'} scheduled</span>
      <span style="font-size:11px;color:#C4A882;margin-left:12px">Auto-refreshes every 60s</span>
    </div>`;
}

function _paintSebaTodayTable() {
  const wrap = document.getElementById('st-table-wrap');
  if (!wrap) return;
  const roster = state.sebaTodayRoster || [];
  const sessions = state.sebaTodaySessions || [];
  const rosterSessionIds = new Set(roster.map(r => { const s = sessionForRoster(r); return s?.id; }).filter(Boolean));
  const walkins = sessions.filter(s => !rosterSessionIds.has(s.id) && s.ended_at);

  // Update stats strip
  const totalInProgress = roster.filter(r => { const s = sessionForRoster(r); return s && s.started_at && !s.ended_at; }).length;
  const badge = document.getElementById('seba-today-inprogress-badge');
  if (badge) badge.style.display = totalInProgress > 0 ? 'block' : 'none';

  wrap.innerHTML = _buildSebaTodayTable(roster, walkins);
  _attachSebaTodayHandlers(document.getElementById('st-table-wrap')?.closest('.page')?.parentElement);

  // Also refresh dashboard panel if visible
  const dashTable = document.getElementById('dash-st-table-wrap');
  if (dashTable) { _initDashboardSebaPanel(); }
}

function _attachSebaTodayHandlers(container) {
  if (!container) return;

  // Refresh button
  const refreshBtn = document.getElementById('st-refresh-btn');
  if (refreshBtn) refreshBtn.onclick = async () => {
    refreshBtn.disabled = true;
    await loadSebaTodayData();
    _paintSebaTodayTable();
    refreshBtn.disabled = false;
    showToast('Refreshed', 'success');
  };

  // Walk-in button
  const walkinBtn = document.getElementById('st-walkin-btn');
  if (walkinBtn) walkinBtn.onclick = () => openSebaTodayWalkinModal();

  // Start All buttons (group-level)
  document.querySelectorAll('.st-start-all-btn').forEach(btn => {
    btn.onclick = async () => {
      const rosterIds = (btn.dataset.rosterIds || '').split(',').filter(Boolean);
      if (!rosterIds.length) return;
      btn.disabled = true;
      const now = new Date().toISOString();
      const inserts = rosterIds.map(rid => {
        const row = (state.sebaTodayRoster || []).find(r => r.id === rid);
        if (!row) return null;
        return {
          roster_id: null,
          sebayat_id: row.sebayat_id,
          seba_category_id: row.seba_category_id,
          service_date: state.sebaTodayDate,
          started_at: now,
          beddha_number: row.beddha_number,
          started_by_admin: state.user?.id || null,
        };
      }).filter(Boolean);
      if (!inserts.length) return;
      const { error } = await db.from('seba_sessions').insert(inserts);
      if (error) { showToast('Failed: ' + error.message, 'error'); btn.disabled = false; return; }
      showToast(`${inserts.length} seba${inserts.length > 1 ? 's' : ''} started`, 'success');
      await loadSebaTodayData();
      _paintSebaTodayTable();
    };
  });

  // Mark All Done buttons (group-level)
  document.querySelectorAll('.st-done-all-btn').forEach(btn => {
    btn.onclick = async () => {
      const sessionIds = (btn.dataset.sessionIds || '').split(',').filter(Boolean);
      if (!sessionIds.length) return;
      btn.disabled = true;
      const now = new Date().toISOString();
      const updates = sessionIds.map(sid => {
        const s = (state.sebaTodaySessions || []).find(x => x.id === sid);
        const durationMinutes = s?.started_at ? Math.round((Date.now() - new Date(s.started_at).getTime()) / 60000) : 0;
        return db.from('seba_sessions').update({
          ended_at: now, duration_minutes: durationMinutes,
          marked_done_by: state.user?.id || null, marked_done_at: now,
        }).eq('id', sid);
      });
      const results = await Promise.all(updates);
      const failed = results.filter(r => r.error);
      if (failed.length) { showToast('Some updates failed', 'error'); btn.disabled = false; return; }
      showToast(`${sessionIds.length} seba${sessionIds.length > 1 ? 's' : ''} marked done`, 'success');
      await loadSebaTodayData();
      _paintSebaTodayTable();
    };
  });

  // Start buttons
  document.querySelectorAll('.st-start-btn').forEach(btn => {
    btn.onclick = async () => {
      const rosterId = btn.dataset.rosterId;
      const rosterRow = (state.sebaTodayRoster || []).find(r => r.id === rosterId);
      if (!rosterRow) return;
      btn.disabled = true;

      // Optimistic UI — flip to "Complete" immediately
      btn.textContent = 'Complete';
      btn.classList.remove('st-start-btn');
      btn.classList.add('st-done-btn');
      btn.style.color = '#E8732A';
      btn.style.borderColor = '#E8732A';
      btn.style.fontWeight = '600';

      const now = new Date().toISOString();
      const { data: inserted, error } = await db.from('seba_sessions').insert({
        roster_id: null,
        sebayat_id: rosterRow.sebayat_id,
        seba_category_id: rosterRow.seba_category_id,
        service_date: state.sebaTodayDate,
        started_at: now,
        beddha_number: rosterRow.beddha_number,
        started_by_admin: state.user?.id || null,
      }).select().single();
      if (error) {
        showToast('Failed to start: ' + error.message, 'error');
        btn.textContent = 'Start'; btn.classList.remove('st-done-btn'); btn.classList.add('st-start-btn');
        btn.style.color = '#2D8A4E'; btn.style.borderColor = '#2D8A4E'; btn.style.fontWeight = '';
        btn.disabled = false; return;
      }
      // Wire the new session ID onto the button so "Complete" click works without repaint
      if (inserted?.id) btn.dataset.sessionId = inserted.id;
      btn.disabled = false;
      showToast('Seba started', 'success');
      await loadSebaTodayData();
      _paintSebaTodayTable();
    };
  });

  // Mark Complete/Done buttons
  document.querySelectorAll('.st-done-btn').forEach(btn => {
    btn.onclick = async () => {
      const sessionId = btn.dataset.sessionId;
      if (!sessionId) return;
      const session = (state.sebaTodaySessions || []).find(s => s.id === sessionId);
      btn.disabled = true;

      // Optimistic UI — flip to "Undo" immediately
      btn.textContent = 'Undo';
      btn.classList.remove('st-done-btn');
      btn.classList.add('st-undo-done-btn');
      btn.style.color = '';
      btn.style.borderColor = '';
      btn.style.fontWeight = '';

      const isCompact = !!btn.closest('#dash-st-table-wrap, [data-compact="true"]');

      const now = new Date().toISOString();
      const startedAt = session?.started_at || now;
      const durationMinutes = Math.round((Date.now() - new Date(startedAt).getTime()) / 60000);
      const { error } = await db.from('seba_sessions').update({
        ended_at: now,
        duration_minutes: durationMinutes,
        marked_done_by: state.user?.id || null,
        marked_done_at: now,
      }).eq('id', sessionId);
      if (error) {
        showToast('Failed: ' + error.message, 'error');
        btn.textContent = 'Complete'; btn.classList.remove('st-undo-done-btn'); btn.classList.add('st-done-btn');
        btn.style.color = '#E8732A'; btn.style.borderColor = '#E8732A'; btn.style.fontWeight = '600';
        btn.disabled = false; return;
      }

      if (isCompact) {
        // In dashboard compact view replace button with plain Done label
        const doneLabel = document.createElement('span');
        doneLabel.style.cssText = 'font-size:11px;font-weight:600;color:#4ADE80';
        doneLabel.textContent = 'Done';
        btn.replaceWith(doneLabel);
      } else {
        // In full page keep Undo button
        btn.textContent = 'Undo';
        btn.classList.remove('st-done-btn');
        btn.classList.add('st-undo-done-btn');
        btn.style.color = '';
        btn.style.borderColor = '';
        btn.style.fontWeight = '';
        btn.disabled = false;
      }

      showToast('Seba completed', 'success');
      await loadSebaTodayData();
      _paintSebaTodayTable();
    };
  });

  // Undo Done buttons
  document.querySelectorAll('.st-undo-done-btn').forEach(btn => {
    btn.onclick = async () => {
      const sessionId = btn.dataset.sessionId;
      btn.disabled = true;
      const { error } = await db.from('seba_sessions').update({
        ended_at: null,
        duration_minutes: null,
        marked_done_by: null,
        marked_done_at: null,
      }).eq('id', sessionId);
      if (error) { showToast('Failed: ' + error.message, 'error'); btn.disabled = false; return; }
      showToast('Reverted to In Progress', 'success');
      await loadSebaTodayData();
      _paintSebaTodayTable();
    };
  });

  // Mark Absent buttons (only for real seba_roster rows — not selection-based synthetic rows)
  document.querySelectorAll('.st-absent-btn').forEach(btn => {
    btn.onclick = async () => {
      const rosterId = btn.dataset.rosterId;
      if (rosterId.startsWith('sel:')) { showToast('Absence tracking not available for selection-based sevas', 'error'); return; }
      btn.disabled = true;
      const { error } = await db.from('seba_roster').update({
        is_absent: true, updated_at: new Date().toISOString(),
      }).eq('id', rosterId);
      if (error) { showToast('Failed: ' + error.message, 'error'); btn.disabled = false; return; }
      showToast('Marked absent', 'success');
      await loadSebaTodayData();
      _paintSebaTodayTable();
    };
  });

  // Unmark Absent buttons
  document.querySelectorAll('.st-unabsent-btn').forEach(btn => {
    btn.onclick = async () => {
      const rosterId = btn.dataset.rosterId;
      if (rosterId.startsWith('sel:')) return;
      btn.disabled = true;
      const { error } = await db.from('seba_roster').update({
        is_absent: false, updated_at: new Date().toISOString(),
      }).eq('id', rosterId);
      if (error) { showToast('Failed: ' + error.message, 'error'); btn.disabled = false; return; }
      showToast('Unmarked absent', 'success');
      await loadSebaTodayData();
      _paintSebaTodayTable();
    };
  });

  // Inline time editors
  document.querySelectorAll('.st-time-edit').forEach(inp => {
    inp.onchange = async () => {
      const sessionId = inp.dataset.sessionId;
      const field = inp.dataset.field;
      const session = (state.sebaTodaySessions || []).find(s => s.id === sessionId);
      if (!session) return;

      // Build a full ISO timestamp using today's date + the edited time
      const [hh, mm] = inp.value.split(':').map(Number);
      const d = new Date(state.sebaTodayDate + 'T00:00:00');
      d.setHours(hh, mm, 0, 0);
      const iso = d.toISOString();

      const updates = { [field]: iso };
      // Recompute duration if both times are available
      const startedAt = field === 'started_at' ? iso : session.started_at;
      const endedAt   = field === 'ended_at'   ? iso : session.ended_at;
      if (startedAt && endedAt) {
        updates.duration_minutes = Math.max(0, Math.round((new Date(endedAt) - new Date(startedAt)) / 60000));
      }

      const { error } = await db.from('seba_sessions').update(updates).eq('id', sessionId);
      if (error) { showToast('Failed: ' + error.message, 'error'); return; }
      showToast('Time updated', 'success');
      await loadSebaTodayData();
      _paintSebaTodayTable();
    };
  });
}

function openSebaTodayWalkinModal() {
  const today = state.sebaTodayDate || new Date().toISOString().slice(0, 10);
  const nowTime = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const sebaOptions = (state.sebaCategories || [])
    .filter(c => c.category_type === 'seba' && c.is_active)
    .sort((a, b) => (a.niti_sequence ?? 9999) - (b.niti_sequence ?? 9999))
    .map(c => `<option value="${esc(c.id)}">${esc(c.name)}${c.niti_sequence ? ` (#${c.niti_sequence})` : ''}</option>`)
    .join('');

  // Build group options (Pratihari / Gochhikar) with today's beddha numbers
  const groupOptions = (state.sebaGroups || [])
    .map(g => {
      const sched = state.scheduleToday[g.id];
      const beddha = sched ? sched.beddha_number : null;
      const label = `${esc(g.name)}${beddha != null ? ` — Beddha ${beddha}` : ''}`;
      return `<option value="${esc(g.id)}" data-beddha="${beddha ?? ''}">${label}</option>`;
    }).join('');

  // Determine default group and beddha
  const defaultGroup = (state.sebaGroups || [])[0];
  const defaultSched = defaultGroup ? state.scheduleToday[defaultGroup.id] : null;
  const defaultBeddha = defaultSched ? defaultSched.beddha_number : '—';

  const html = `
    <div class="modal-header">
      <div class="modal-title">Add Walk-in Seba</div>
      <div class="modal-desc">Record a seba session that was not on today's scheduled roster.</div>
    </div>
    <div class="modal-body">
      <div class="field">
        <label>Sebayat <span style="color:var(--red)">*</span></label>
        <input id="st-wi-search" type="text" placeholder="Search by name or registration no…" autocomplete="off" />
        <div id="st-wi-results" style="border:1px solid #E8D5C4;border-radius:8px;max-height:180px;overflow-y:auto;display:none;margin-top:4px"></div>
        <input type="hidden" id="st-wi-sebayat-id" />
        <div id="st-wi-sebayat-name" style="font-size:13px;color:#E8732A;margin-top:4px;font-weight:500"></div>
      </div>
      <div class="field">
        <label>Seba <span style="color:var(--red)">*</span></label>
        <select id="st-wi-category"><option value="">Select seba…</option>${sebaOptions}</select>
      </div>
      <div style="display:flex;gap:12px;align-items:flex-end">
        <div class="field" style="flex:1.4">
          <label>Pratihari / Gochhikar Beddha <span style="color:var(--red)">*</span></label>
          <select id="st-wi-group"><option value="">Select group…</option>${groupOptions}</select>
        </div>
        <div class="field" style="flex:0.6">
          <label>Beddha for Today</label>
          <div id="st-wi-beddha-display" style="padding:9px 14px;border:1px solid #E8D5C4;border-radius:8px;font-size:14px;color:#6B4C3B;font-weight:600;background:#FAF5F0;min-height:40px;display:flex;align-items:center">${defaultBeddha}</div>
        </div>
      </div>
      <div style="display:flex;gap:12px">
        <div class="field" style="flex:1">
          <label>Started At</label>
          <input id="st-wi-start-time" type="time" value="${nowTime}" />
        </div>
        <div class="field" style="flex:1">
          <label>Ended At</label>
          <input id="st-wi-end-time" type="time" value="${nowTime}" />
        </div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" id="st-wi-save">Save Walk-in</button>
    </div>
  `;
  showModal(html);

  // Update beddha display when group changes
  const groupSel = document.getElementById('st-wi-group');
  const beddhaDisplay = document.getElementById('st-wi-beddha-display');
  if (defaultGroup) groupSel.value = defaultGroup.id;
  groupSel.onchange = () => {
    const opt = groupSel.options[groupSel.selectedIndex];
    const b = opt?.dataset?.beddha;
    beddhaDisplay.textContent = b ? b : '—';
  };

  // Sebayat search
  const searchInp = document.getElementById('st-wi-search');
  const resultsDiv = document.getElementById('st-wi-results');
  let searchTimer = null;
  searchInp.oninput = () => {
    clearTimeout(searchTimer);
    const q = searchInp.value.trim();
    if (q.length < 2) { resultsDiv.style.display = 'none'; return; }
    searchTimer = setTimeout(async () => {
      const { data } = await db.from('sebayats')
        .select('id, first_name, last_name, title, registration_no')
        .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,registration_no.ilike.%${q}%`)
        .limit(8);
      if (!data || data.length === 0) {
        resultsDiv.innerHTML = `<div style="padding:10px 14px;font-size:13px;color:#9B8578">No approved sebayats found</div>`;
        resultsDiv.style.display = 'block';
        return;
      }
      resultsDiv.innerHTML = data.map(s => {
        const nm = [s.title, s.first_name, s.last_name].filter(Boolean).join(' ');
        return `<div class="search-result-item" data-id="${esc(s.id)}" data-name="${esc(nm)}"
          style="padding:8px 14px;cursor:pointer;font-size:13px;border-bottom:1px solid #F0E4D7">
          <span style="font-weight:500">${esc(nm)}</span>
          ${s.registration_no ? `<span style="color:#9B8578;margin-left:8px;font-size:12px">${esc(s.registration_no)}</span>` : ''}
        </div>`;
      }).join('');
      resultsDiv.style.display = 'block';
      resultsDiv.querySelectorAll('.search-result-item').forEach(el => {
        el.onmouseenter = () => el.style.background = '#FFF3E8';
        el.onmouseleave = () => el.style.background = '';
        el.onclick = () => {
          document.getElementById('st-wi-sebayat-id').value = el.dataset.id;
          document.getElementById('st-wi-sebayat-name').textContent = el.dataset.name;
          searchInp.value = el.dataset.name;
          resultsDiv.style.display = 'none';
        };
      });
    }, 250);
  };

  document.getElementById('st-wi-save').onclick = async () => {
    const sebayatId = document.getElementById('st-wi-sebayat-id').value;
    const categoryId = document.getElementById('st-wi-category').value;
    const groupSel = document.getElementById('st-wi-group');
    const groupId = groupSel.value;
    const beddhaRaw = groupSel.options[groupSel.selectedIndex]?.dataset?.beddha;
    const beddha = beddhaRaw ? parseInt(beddhaRaw, 10) || null : null;
    const startTimeVal = document.getElementById('st-wi-start-time').value;
    const endTimeVal = document.getElementById('st-wi-end-time').value;

    if (!sebayatId) { showToast('Please select a sebayat', 'error'); return; }
    if (!categoryId) { showToast('Please select a seba', 'error'); return; }
    if (!groupId) { showToast('Please select a Pratihari / Gochhikar group', 'error'); return; }

    const toISO = (timeStr) => {
      const [h, m] = timeStr.split(':').map(Number);
      const d = new Date(today + 'T00:00:00');
      d.setHours(h, m, 0, 0);
      return d.toISOString();
    };

    const startedAt = startTimeVal ? toISO(startTimeVal) : new Date().toISOString();
    const endedAt   = endTimeVal   ? toISO(endTimeVal)   : new Date().toISOString();
    const durationMinutes = Math.max(0, Math.round((new Date(endedAt) - new Date(startedAt)) / 60000));

    const saveBtn = document.getElementById('st-wi-save');
    saveBtn.disabled = true; saveBtn.textContent = 'Saving…';

    const { error } = await db.from('seba_sessions').insert({
      roster_id: null,
      sebayat_id: sebayatId,
      seba_category_id: categoryId,
      service_date: today,
      started_at: startedAt,
      ended_at: endedAt,
      duration_minutes: durationMinutes,
      beddha_number: beddha,
      started_by_admin: state.user?.id || null,
      marked_done_by: state.user?.id || null,
      marked_done_at: endedAt,
    });

    if (error) { showToast('Failed: ' + error.message, 'error'); saveBtn.disabled = false; saveBtn.textContent = 'Save Walk-in'; return; }
    showToast('Walk-in recorded', 'success');
    closeModal();
    await loadSebaTodayData();
    _paintSebaTodayTable();
  };
}
