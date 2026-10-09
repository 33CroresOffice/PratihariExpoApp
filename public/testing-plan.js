/* Pratihari Nijog — Testing Plan (database-backed, dev-team gated) */
'use strict';

var SUPABASE_URL = 'https://zqmuniemheltatarumbp.supabase.co';
var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpxbXVuaWVtaGVsdGF0YXJ1bWJwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2OTg4NDIsImV4cCI6MjA5MjI3NDg0Mn0.W-6bEQvSJnhMDYr9mDBAHmF5pf_p9BcVaGnZ-mRWPzs';
var db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

var STATUSES = ['PENDING', 'PASS', 'FAIL', 'BLOCKED', 'SKIPPED'];
var STATUS_CLASSES = { PENDING: 'badge-pending', PASS: 'badge-pass', FAIL: 'badge-fail', BLOCKED: 'badge-blocked', SKIPPED: 'badge-skipped' };

var currentUser = null;
var MODULES = [];   // [{code,name,scope}]
var TC = [];        // [id, module, title, priority, description, feature]
var results = {};   // tcId -> {status, notes, test_date, updated_by_email}
var changeHistory = [];   // recent change rows
var currentFilter = 'ALL';
var collapsedModules = {};
var noteTimers = {};

/* ── Auth gate ─────────────────────────────── */

function show(el, on) { el.style.display = on ? '' : 'none'; }

async function boot() {
  var session = null;
  try { session = (await db.auth.getSession()).data.session; } catch (e) { session = null; }
  if (session && (await isAdmin(session.user.id))) {
    currentUser = session.user;
    await enterApp();
  } else {
    showLogin();
  }
}

async function isAdmin(userId) {
  try {
    var r = await db.from('pratihari_admins').select('user_id').eq('user_id', userId).maybeSingle();
    return !!r.data;
  } catch (e) { return false; }
}

function showLogin() {
  show(document.getElementById('loginScreen'), true);
  show(document.getElementById('mainApp'), false);
  show(document.getElementById('appLoading'), false);
}

async function handleSignIn() {
  var errEl = document.getElementById('loginError');
  var btn = document.getElementById('loginBtn');
  errEl.style.display = 'none';
  var email = document.getElementById('loginEmail').value.trim();
  var password = document.getElementById('loginPassword').value;
  if (!email || !password) { errEl.textContent = 'Enter your work email and password.'; errEl.style.display = 'block'; return; }
  btn.disabled = true; btn.textContent = 'Signing in…';
  try {
    var r = await db.auth.signInWithPassword({ email: email, password: password });
    if (r.error) throw r.error;
    if (!(await isAdmin(r.data.user.id))) {
      await db.auth.signOut();
      throw new Error('This account is not on the dev team. Access denied.');
    }
    currentUser = r.data.user;
    await enterApp();
  } catch (e) {
    errEl.textContent = e.message || 'Sign-in failed.';
    errEl.style.display = 'block';
  } finally {
    btn.disabled = false; btn.textContent = 'Sign In';
  }
}

async function handleSignOut() {
  await db.auth.signOut();
  currentUser = null; MODULES = []; TC = []; results = {}; changeHistory = [];
  document.getElementById('loginEmail').value = '';
  document.getElementById('loginPassword').value = '';
  showLogin();
}

/* ── Data loading ──────────────────────────── */

async function enterApp() {
  show(document.getElementById('loginScreen'), false);
  show(document.getElementById('appLoading'), true);
  show(document.getElementById('mainApp'), false);
  var ok = await loadData();
  show(document.getElementById('appLoading'), false);
  if (!ok) { showLogin(); return; }
  show(document.getElementById('mainApp'), true);
  document.getElementById('whoami').textContent = 'Tester: ' + (currentUser.email || '');
  document.getElementById('lastSaved').textContent = '';
  initFilters();
  renderAll();
}

async function loadData() {
  try {
    var mods = await db.from('test_modules').select('code,name,scope');
    if (mods.error) throw mods.error;
    MODULES = (mods.data || []).map(function (m) { return { code: m.code, name: m.name, scope: m.scope }; });

    var cases = await db.from('test_cases').select('test_case_id,module_code,title,priority,description,feature,sort_order').order('sort_order');
    if (cases.error) throw cases.error;
    TC = (cases.data || []).map(function (c) { return [c.test_case_id, c.module_code, c.title, c.priority, c.description, c.feature]; });

    var firstSeen = {};
    TC.forEach(function (tc) { if (!(tc[1] in firstSeen)) firstSeen[tc[1]] = Object.keys(firstSeen).length; });
    MODULES.sort(function (a, b) { return (firstSeen[a.code] != null ? firstSeen[a.code] : 999) - (firstSeen[b.code] != null ? firstSeen[b.code] : 999); });

    var res = await db.from('test_case_results').select('test_case_id,status,notes,test_date,updated_by_email');
    if (res.error) throw res.error;
    results = {};
    (res.data || []).forEach(function (r) {
      results[r.test_case_id] = { status: r.status, notes: r.notes || '', test_date: r.test_date || '', updated_by_email: r.updated_by_email || '' };
    });

    var hist = await db.from('test_case_history').select('test_case_id,old_status,new_status,changed_by_email,changed_at').order('changed_at', { ascending: false }).limit(50);
    if (hist.error) throw hist.error;
    changeHistory = hist.data || [];
    return true;
  } catch (e) {
    console.error('Load failed', e);
    alert('Could not load test data: ' + (e.message || 'unknown error'));
    return false;
  }
}

/* ── State helpers ─────────────────────────── */

function getStatus(id) { return (results[id] && results[id].status) || 'PENDING'; }
function getNotes(id) { return (results[id] && results[id].notes) || ''; }
function getDate(id) { return (results[id] && results[id].test_date) || ''; }
function getTesterOf(id) { return (results[id] && results[id].updated_by_email) || ''; }

async function persistResult(id, fields) {
  var payload = Object.assign({ test_case_id: id }, fields);
  var r = await db.from('test_case_results').upsert(payload, { onConflict: 'test_case_id' });
  if (r.error) { alert('Save failed: ' + r.error.message); return false; }
  document.getElementById('lastSaved').textContent = 'Last saved: ' + new Date().toLocaleTimeString();
  return true;
}

async function setStatus(id, newStatus) {
  var old = getStatus(id);
  if (old === newStatus) return;
  results[id] = results[id] || {};
  results[id].status = newStatus;
  if (newStatus === 'PASS' || newStatus === 'FAIL') {
    if (!results[id].test_date) results[id].test_date = new Date().toISOString().slice(0, 10);
  }
  var ok = await persistResult(id, { status: newStatus, notes: results[id].notes || '', test_date: results[id].test_date || null });
  if (!ok) { results[id].status = old; renderAll(); return; }
  if (newStatus === 'PENDING') {
    await db.from('test_case_results').delete().eq('test_case_id', id);
    delete results[id];
  }
  await db.from('test_case_history').insert({ test_case_id: id, old_status: old, new_status: newStatus });
  changeHistory.unshift({ test_case_id: id, old_status: old, new_status: newStatus, changed_by_email: currentUser.email, changed_at: new Date().toISOString() });
  changeHistory = changeHistory.slice(0, 50);
  renderAll();
}

function setNotes(id, notes) {
  results[id] = results[id] || { status: 'PENDING' };
  results[id].notes = notes;
  clearTimeout(noteTimers[id]);
  noteTimers[id] = setTimeout(function () { persistResult(id, { notes: notes }); }, 500);
}

async function setDate(id, date) {
  results[id] = results[id] || { status: 'PENDING' };
  results[id].test_date = date;
  await persistResult(id, { test_date: date || null });
}

async function saveTestCycle(cycle) {
  try { localStorage.setItem('pn_test_cycle', cycle); } catch (e) {}
}

/* ── Stats & rendering ─────────────────────── */

function getModuleStats(code) {
  var s = { total: 0, pass: 0, fail: 0, blocked: 0, skipped: 0, pending: 0, p1: 0, p2: 0, p3: 0 };
  TC.forEach(function (tc) {
    if (tc[1] !== code) return;
    s.total++;
    var st = getStatus(tc[0]);
    if (st === 'PASS') s.pass++; else if (st === 'FAIL') s.fail++; else if (st === 'BLOCKED') s.blocked++; else if (st === 'SKIPPED') s.skipped++; else s.pending++;
    if (tc[3] === 'P1') s.p1++; else if (tc[3] === 'P2') s.p2++; else s.p3++;
  });
  return s;
}

function getOverallStats() {
  var s = { total: TC.length, pass: 0, fail: 0, blocked: 0, skipped: 0, pending: 0 };
  TC.forEach(function (tc) {
    var st = getStatus(tc[0]);
    if (st === 'PASS') s.pass++; else if (st === 'FAIL') s.fail++; else if (st === 'BLOCKED') s.blocked++; else if (st === 'SKIPPED') s.skipped++; else s.pending++;
  });
  return s;
}

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function cycleStatus(id) {
  var next = STATUSES[(STATUSES.indexOf(getStatus(id)) + 1) % STATUSES.length];
  setStatus(id, next);
}

function statusBadge(id) {
  var s = getStatus(id);
  var tester = getTesterOf(id);
  var title = 'Click to change status' + (tester ? ' — last by ' + tester : '');
  return '<span class="badge ' + STATUS_CLASSES[s] + '" onclick="cycleStatus(\'' + id + '\')" title="' + escapeHtml(title) + '">' + s + '</span>';
}

function priorityBadge(p) {
  var cls = p === 'P1' ? 'badge-p1' : p === 'P2' ? 'badge-p2' : 'badge-p3';
  return '<span class="badge ' + cls + '">' + p + '</span>';
}

function matchesFilters(tc) {
  var st = getStatus(tc[0]);
  if (currentFilter !== 'ALL' && st !== currentFilter) return false;
  var pf = document.getElementById('priorityFilter').value;
  if (pf !== 'ALL' && tc[3] !== pf) return false;
  var mf = document.getElementById('moduleFilter').value;
  if (mf !== 'ALL' && tc[1] !== mf) return false;
  var search = document.getElementById('searchBox').value.toLowerCase();
  if (search && (tc[0] + ' ' + tc[2] + ' ' + tc[4]).toLowerCase().indexOf(search) < 0) return false;
  return true;
}

function renderOverview() {
  var s = getOverallStats();
  var executed = s.pass + s.fail + s.blocked + s.skipped;
  var passRate = s.total > 0 ? Math.round((s.pass / s.total) * 100) : 0;
  document.getElementById('overviewGrid').innerHTML =
    '<div class="stat-card"><div class="num">' + s.total + '</div><div class="lbl">Total Test Cases</div></div>' +
    '<div class="stat-card"><div class="num">' + MODULES.length + '</div><div class="lbl">Modules</div></div>' +
    '<div class="stat-card"><div class="num" style="color:#198754">' + s.pass + '</div><div class="lbl">Passed</div></div>' +
    '<div class="stat-card"><div class="num" style="color:#dc3545">' + s.fail + '</div><div class="lbl">Failed</div></div>' +
    '<div class="stat-card"><div class="num" style="color:#856404">' + s.blocked + '</div><div class="lbl">Blocked</div></div>' +
    '<div class="stat-card"><div class="num" style="color:#6c757d">' + s.pending + '</div><div class="lbl">Pending</div></div>' +
    '<div class="stat-card"><div class="num" style="color:var(--primary)">' + executed + '</div><div class="lbl">Executed</div></div>' +
    '<div class="stat-card"><div class="num" style="color:#198754">' + passRate + '%</div><div class="lbl">Pass Rate</div></div>';
}

function renderProgressBar() {
  var s = getOverallStats();
  var segments = [
    { cls: 's-pass', label: 'Pass', count: s.pass },
    { cls: 's-fail', label: 'Fail', count: s.fail },
    { cls: 's-blocked', label: 'Blocked', count: s.blocked },
    { cls: 's-skipped', label: 'Skipped', count: s.skipped },
    { cls: 's-pending', label: 'Pending', count: s.pending }
  ];
  var html = '';
  segments.forEach(function (seg) {
    if (seg.count > 0) {
      var pct = (seg.count / s.total) * 100;
      html += '<div class="progress-segment ' + seg.cls + '" style="width:' + pct + '%" title="' + seg.label + ': ' + seg.count + '">' + (pct > 5 ? seg.count : '') + '</div>';
    }
  });
  document.getElementById('progressBar').innerHTML = html;
  var executed = s.pass + s.fail + s.blocked + s.skipped;
  document.getElementById('overallPercent').textContent = Math.round((executed / s.total) * 100) + '%';
  document.getElementById('progressLabels').innerHTML = segments.map(function (seg) {
    return '<span style="color:var(--neutral-600)">' + seg.label + ': ' + seg.count + '</span>';
  }).join(' &middot; ');
}

function renderModuleIndex() {
  var html = '';
  MODULES.forEach(function (m) {
    var s = getModuleStats(m.code);
    var passRate = s.total > 0 ? Math.round((s.pass / s.total) * 100) : 0;
    html += '<tr><td><span class="module-badge">' + m.code + '</span></td><td>' + escapeHtml(m.name) + '</td><td>' + s.total + '</td><td>' + escapeHtml(m.scope) + '</td>';
    html += '<td><div class="mini-progress"><div class="mini-bar"><div class="mini-bar-fill" style="width:' + passRate + '%"></div></div><span class="mini-text">' + s.pass + '/' + s.total + ' (' + passRate + '%)</span></div></td></tr>';
  });
  document.getElementById('moduleIndexBody').innerHTML = html;
}

function renderPriorityGuide() {
  var p1 = 0, p2 = 0, p3 = 0;
  TC.forEach(function (tc) { if (tc[3] === 'P1') p1++; else if (tc[3] === 'P2') p2++; else p3++; });
  document.getElementById('priorityLegend').innerHTML =
    '<div class="priority-card p1"><strong>P1 — Critical (' + p1 + ' tests)</strong>Core functionality or security. Must pass before any release.</div>' +
    '<div class="priority-card p2"><strong>P2 — Important (' + p2 + ' tests)</strong>Key features covering most use-cases. Must pass before production.</div>' +
    '<div class="priority-card p3"><strong>P3 — Nice to Have (' + p3 + ' tests)</strong>Edge cases and cosmetic details. Target for post-launch polish.</div>';
  document.getElementById('coverMeta').innerHTML =
    '<div class="cover-meta-item"><label>System</label><span>Pratihari Nijog App + Admin Dashboard</span></div>' +
    '<div class="cover-meta-item"><label>Version</label><span>2.0 — Oct 2026</span></div>' +
    '<div class="cover-meta-item"><label>Total Test Cases</label><span>' + TC.length + '</span></div>' +
    '<div class="cover-meta-item"><label>Modules Covered</label><span>' + MODULES.length + '</span></div>';
}

function renderTestCases() {
  var html = '';
  var hasVisible = false;
  MODULES.forEach(function (m) {
    var code = m.code;
    var visible = TC.filter(function (tc) { return tc[1] === code && matchesFilters(tc); });
    if (visible.length === 0) return;
    hasVisible = true;
    var collapsed = collapsedModules[code];
    html += '<div class="module-section" data-module="' + code + '">';
    html += '<div class="module-header" onclick="toggleModule(\'' + code + '\')">';
    html += '<h2 id="tc-' + code.toLowerCase().replace(/[^a-z0-9]/g, '-') + '">' + escapeHtml(m.name) + ' (' + code + ')</h2>';
    html += '<span class="module-toggle ' + (collapsed ? 'collapsed' : '') + '">&#9660;</span></div>';
    html += '<div class="module-content ' + (collapsed ? 'collapsed' : '') + '">';
    html += '<table class="tc-table"><thead><tr><th>ID</th><th>Test Case</th><th>Priority</th><th>Status</th></tr></thead><tbody>';
    visible.forEach(function (tc) {
      var s = getStatus(tc[0]);
      var rowCls = s === 'PASS' ? 'row-pass' : s === 'FAIL' ? 'row-fail' : s === 'BLOCKED' ? 'row-blocked' : '';
      html += '<tr class="' + rowCls + '"><td class="tc-code">' + tc[0] + '</td><td>' + escapeHtml(tc[2]) + '<br><span style="font-size:11px;color:var(--neutral-600)">' + escapeHtml(tc[4]) + '</span></td><td>' + priorityBadge(tc[3]) + '</td><td>' + statusBadge(tc[0]) + '</td></tr>';
      if (s === 'FAIL' || s === 'BLOCKED') {
        html += '<tr class="tc-row-notes ' + rowCls + '"><td colspan="4"><div class="notes-grid">';
        html += '<input type="text" class="notes-input" placeholder="Notes / Bug ID..." value="' + escapeHtml(getNotes(tc[0])) + '" onchange="setNotes(\'' + tc[0] + '\',this.value)">';
        html += '<div><label>Test Date</label><input type="date" class="date-input" value="' + getDate(tc[0]) + '" onchange="setDate(\'' + tc[0] + '\',this.value)"></div>';
        html += '<div></div></div></td></tr>';
      }
    });
    html += '</tbody></table></div></div>';
  });
  if (!hasVisible) html = '<div class="empty-state">No test cases match the current filters.</div>';
  document.getElementById('testCasesContainer').innerHTML = html;
}

function renderRTM() {
  var html = '';
  MODULES.forEach(function (m) {
    var visible = TC.filter(function (tc) { return tc[1] === m.code && matchesFilters(tc); });
    if (visible.length === 0) return;
    html += '<tr class="rtm-group"><td colspan="6">' + m.code + ' — ' + escapeHtml(m.name) + '</td></tr>';
    visible.forEach(function (tc) {
      var s = getStatus(tc[0]);
      var rowCls = s === 'PASS' ? 'row-pass' : s === 'FAIL' ? 'row-fail' : s === 'BLOCKED' ? 'row-blocked' : '';
      html += '<tr class="' + rowCls + '"><td class="tc-code">' + tc[0] + '</td><td>' + tc[1] + '</td><td>' + escapeHtml(tc[5]) + '</td><td>' + escapeHtml(tc[2]) + '</td><td>' + priorityBadge(tc[3]) + '</td><td>' + statusBadge(tc[0]) + '</td></tr>';
    });
  });
  document.getElementById('rtmBody').innerHTML = html;
}

function renderSummary() {
  var html = '';
  var t = { total: 0, p1: 0, p2: 0, p3: 0, pass: 0, fail: 0, blocked: 0, pending: 0 };
  MODULES.forEach(function (m) {
    var s = getModuleStats(m.code);
    html += '<tr><td>' + m.code + ' — ' + escapeHtml(m.name) + '</td><td>' + s.total + '</td><td>' + s.p1 + '</td><td>' + s.p2 + '</td><td>' + s.p3 + '</td><td style="color:#198754">' + s.pass + '</td><td style="color:#dc3545">' + s.fail + '</td><td style="color:#856404">' + s.blocked + '</td><td>' + s.pending + '</td></tr>';
    t.total += s.total; t.p1 += s.p1; t.p2 += s.p2; t.p3 += s.p3; t.pass += s.pass; t.fail += s.fail; t.blocked += s.blocked; t.pending += s.pending;
  });
  html += '<tr><td><strong>TOTAL</strong></td><td><strong>' + t.total + '</strong></td><td><strong>' + t.p1 + '</strong></td><td><strong>' + t.p2 + '</strong></td><td><strong>' + t.p3 + '</strong></td><td><strong style="color:#198754">' + t.pass + '</strong></td><td><strong style="color:#dc3545">' + t.fail + '</strong></td><td><strong style="color:#856404">' + t.blocked + '</strong></td><td><strong>' + t.pending + '</strong></td></tr>';
  document.getElementById('summaryBody').innerHTML = html;
}

function renderHistory() {
  var html = '';
  changeHistory.slice(0, 30).forEach(function (h) {
    var d = new Date(h.changed_at);
    html += '<tr><td>' + d.toLocaleString() + '</td><td class="tc-code">' + h.test_case_id + '</td><td>' + (h.old_status || '—') + '</td><td>' + h.new_status + '</td><td>' + escapeHtml(h.changed_by_email || '') + '</td></tr>';
  });
  if (!html) html = '<tr><td colspan="5" class="empty-state">No changes recorded yet.</td></tr>';
  document.getElementById('historyBody').innerHTML = html;
}

function renderTesters() {
  var byTester = {};
  TC.forEach(function (tc) {
    var tester = getTesterOf(tc[0]);
    if (!tester) return;
    byTester[tester] = byTester[tester] || { pass: 0, fail: 0, blocked: 0, skipped: 0 };
    var s = getStatus(tc[0]);
    if (s !== 'PENDING') byTester[tester][s.toLowerCase()]++;
  });
  var testers = Object.keys(byTester).sort();
  var html = '<h2>Testers & Contributions</h2><table class="summary-table"><thead><tr><th>Tester</th><th>Passed</th><th>Failed</th><th>Blocked</th><th>Skipped</th><th>Executed</th></tr></thead><tbody>';
  testers.forEach(function (t) {
    var s = byTester[t];
    var ex = s.pass + s.fail + s.blocked + s.skipped;
    html += '<tr><td>' + escapeHtml(t) + '</td><td style="color:#198754">' + s.pass + '</td><td style="color:#dc3545">' + s.fail + '</td><td style="color:#856404">' + s.blocked + '</td><td style="color:#6c757d">' + s.skipped + '</td><td>' + ex + '</td></tr>';
  });
  if (!testers.length) html = '<tr><td colspan="6" class="empty-state">No results recorded yet.</td></tr>';
  html += '</tbody></table>';
  document.getElementById('testersPanel').innerHTML = html;
}

function renderAll() {
  renderOverview();
  renderProgressBar();
  renderModuleIndex();
  renderPriorityGuide();
  renderTestCases();
  renderRTM();
  renderSummary();
  renderHistory();
  renderTesters();
}

/* ── Interactions ──────────────────────────── */

function setFilter(f) {
  currentFilter = f;
  document.querySelectorAll('.filter-btn').forEach(function (b) {
    b.classList.toggle('active', b.getAttribute('data-filter') === f);
  });
  applyFilters();
}

function applyFilters() { renderTestCases(); renderRTM(); }

function toggleModule(code) {
  collapsedModules[code] = !collapsedModules[code];
  renderTestCases();
}

function initFilters() {
  var mf = document.getElementById('moduleFilter');
  MODULES.forEach(function (m) {
    var opt = document.createElement('option');
    opt.value = m.code;
    opt.textContent = m.code + ' — ' + m.name;
    mf.appendChild(opt);
  });
  try {
    var cycle = localStorage.getItem('pn_test_cycle');
    if (cycle) document.getElementById('testCycle').value = cycle;
  } catch (e) {}
}

async function resetAll() {
  if (!confirm('Reset ALL test case statuses to PENDING? This deletes every result and cannot be undone.')) return;
  var ids = Object.keys(results);
  var r = await db.from('test_case_results').delete().in('test_case_id', ids);
  if (r.error) { alert('Reset failed: ' + r.error.message); return; }
  results = {};
  changeHistory = [];
  renderAll();
}

/* ── CSV export / import ───────────────────── */

function exportCSV() {
  var csv = 'Test ID,Module,Test Case,Priority,Status,Tested By,Test Date,Notes\n';
  TC.forEach(function (tc) {
    var id = tc[0];
    csv += '"' + id + '","' + tc[1] + '","' + tc[2].replace(/"/g, '""') + '","' + tc[3] + '","' + getStatus(id) + '","' + getTesterOf(id) + '","' + getDate(id) + '","' + getNotes(id).replace(/"/g, '""') + '"\n';
  });
  var blob = new Blob([csv], { type: 'text/csv' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'pratihari_testing_progress_' + new Date().toISOString().slice(0, 10) + '.csv';
  a.click();
  URL.revokeObjectURL(url);
}

function importCSV(event) {
  var file = event.target.files[0];
  if (!file) return;
  var reader = new FileReader();
  reader.onload = async function (e) {
    try {
      var lines = e.target.result.split('\n');
      var imported = 0;
      var rows = [];
      for (var i = 1; i < lines.length; i++) {
        var line = lines[i].trim();
        if (!line) continue;
        var fields = parseCSVLine(line);
        if (fields.length < 5) continue;
        var id = fields[0], status = fields[4];
        if (STATUSES.indexOf(status) < 0) continue;
        if (!TC.some(function (tc) { return tc[0] === id; })) continue;
        rows.push({ test_case_id: id, status: status, notes: fields[7] || '', test_date: fields[6] || null });
        imported++;
      }
      if (rows.length) {
        var r = await db.from('test_case_results').upsert(rows, { onConflict: 'test_case_id' });
        if (r.error) throw r.error;
        await loadData();
        renderAll();
      }
      alert('Imported ' + imported + ' test case statuses successfully.');
    } catch (err) {
      alert('Error importing CSV: ' + err.message);
    }
    event.target.value = '';
  };
  reader.readAsText(file);
}

function parseCSVLine(line) {
  var fields = [], current = '', inQuotes = false;
  for (var i = 0; i < line.length; i++) {
    var ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { current += '"'; i++; }
        else inQuotes = false;
      } else current += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ',') { fields.push(current); current = ''; }
      else current += ch;
    }
  }
  fields.push(current);
  return fields;
}

document.getElementById('loginPassword').addEventListener('keydown', function (e) {
  if (e.key === 'Enter') handleSignIn();
});
document.getElementById('loginEmail').addEventListener('keydown', function (e) {
  if (e.key === 'Enter') handleSignIn();
});

boot();
