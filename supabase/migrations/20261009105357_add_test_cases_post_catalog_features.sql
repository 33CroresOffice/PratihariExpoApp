/*
# Add test cases for features shipped after the catalog was created

1. Why
- The test catalog (302 cases) was frozen before the late-September / October
  development wave. Ten newer features had no coverage at all. This migration
  adds 33 new cases across existing modules, continuing each module's ID and
  sort_order sequence so the traceability matrix stays clean.

2. What is covered, by feature area
- Documents library (app/documents.tsx + documents bucket): 4 cases (REG module? no —
  NOTICE module gets doc cases? no — see below: DOC cases ride on NOTICE module? no —
  these ride on the NOTICE module only where notice-related).
  Actually: Documents cases are added to the NOTICE module as NOTICE-TC-008..011
  because the documents library is a shared-content surface, alongside notices.
- Notice repeat / recurrence (daily/weekly/monthly/yearly + end date, publisher cron):
  NOTICE-TC-012..014 and ADMIN-MGMT-TC-019..021.
- Sebayat suspension (is_suspended, suspended screen, login block):
  ADMIN-SEP-TC-032..034, AUTH-TC-015..017.
- Aadhaar number (registration capture + admin search): REG-TC-054..055, ADMIN-SEP-TC-035.
- Hobby field: REG-TC-056, PROF-TC-016.
- Death details (date/place stored for deceased members): ADMIN-SEP-TC-036..037, PROF-TC-017.
- Sahis management screen (add/edit/delete/toggle): ADMIN-SEBA-TC-020..023.
- Family member date-of-birth: REG-TC-057.
- Bhai Pua / Palia status flags: REG-TC-058..059.
- Personal seba calendar lookup on schedule screen: SCHED-TC-010..012.
- Offline cache of documents + notification center deep links: OFFLINE-TC-009, NOTIF-TC-011.

3. New rows only
- New rows in `test_cases` (33 rows) via ON CONFLICT DO NOTHING upsert — safe to
  re-run, and existing cases/results/history are untouched.
- Matching PENDING rows in `test_case_results` are created automatically by the
  existing identity trigger when testers first update them; no action needed here.

4. Security
- No schema or RLS changes.

5. ID and sort numbering (continues each module's sequence)
- NOTICE: 008-014 (sort 114-120), ADMIN-MGMT: 019-021 (sort 189-191),
  ADMIN-SEP: 032-037 (sort 145-150), AUTH: 015-017 (sort 14-16),
  REG: 054-059 (sort 67-72), PROF: 016-017 (sort 98-99),
  ADMIN-SEBA: 020-023 (sort 171-174), SCHED: 010-012 (sort 107-109),
  OFFLINE: TC-009 (sort 231), NOTIF: TC-011 (sort 223).
*/

INSERT INTO test_cases (test_case_id,module_code,title,priority,description,feature,sort_order) VALUES
-- Documents library
('NOTICE-TC-008','NOTICE','Documents list loads','P1','Open Documents screen — all published documents listed with bilingual titles.','Documents',114),
('NOTICE-TC-009','NOTICE','Document download works','P1','Tap a document — file opens/downloads successfully.','Documents',115),
('NOTICE-TC-010','NOTICE','Document shown in Odia mode','P3','Switch to Odia — Odia titles/descriptions shown where available, English fallback otherwise.','Documents',116),
('NOTICE-TC-011','NOTICE','Documents hidden when none published','P3','With no documents in library — empty state message shown, no crash.','Documents',117),
-- Notice repeat / recurrence
('NOTICE-TC-012','NOTICE','Repeat notice republishes','P1','Notice with weekly repeat enabled — republished automatically on schedule by publisher cron.','Recurrence',118),
('NOTICE-TC-013','NOTICE','Repeat respects end date','P2','Repeat notice with past end date — no further republish after end date.','Recurrence',119),
('NOTICE-TC-014','NOTICE','Repeat stop clears future publishes','P2','Toggle repeat off on a repeating notice — no further republishes occur.','Recurrence',120),
('ADMIN-MGMT-TC-019','ADMIN-MGMT','Set notice repeat schedule','P1','Create notice with repeat daily/weekly/monthly/yearly + interval + end date — saved correctly.','Notices',189),
('ADMIN-MGMT-TC-020','ADMIN-MGMT','Edit repeat schedule','P2','Change repeat frequency/interval on existing notice — updated schedule takes effect.','Notices',190),
('ADMIN-MGMT-TC-021','ADMIN-MGMT','Notice images attached','P3','Attach images to notice — images shown in notice detail/startup modal.','Notices',191),
-- Sebayat suspension
('ADMIN-SEP-TC-032','ADMIN-SEP','Suspend member','P1','Admin marks sebayat suspended — flag saved, member list shows suspended state.','Manage',145),
('ADMIN-SEP-TC-033','ADMIN-SEP','Suspended member blocked at login','P1','Suspended member signs in — redirected to suspended screen, app content inaccessible.','Manage',146),
('ADMIN-SEP-TC-034','ADMIN-SEP','Unsuspend restores access','P1','Clear suspension — member logs in normally next time, no suspended screen.','Manage',147),
('AUTH-TC-015','AUTH','Suspended login shows suspended screen','P1','Suspended user completes OTP — lands on suspended screen with explanation.','Route Guard',14),
('AUTH-TC-016','AUTH','Suspended user cannot reach app tabs','P1','Suspended user manually navigates to app routes — always bounced back to suspended screen.','Route Guard',15),
('AUTH-TC-017','AUTH','Sign out from suspended screen works','P3','Suspended user taps sign out — session cleared, back to phone login.','Sign Out',16),
-- Aadhaar
('REG-TC-054','REG','Aadhaar number entered','P2','Enter 12-digit Aadhaar in Step 1 — saved with profile.','Step 1',67),
('REG-TC-055','REG','Aadhaar in admin search','P2','Search admin member list by Aadhaar digits — matching member found.','Search & Filter',68),
('ADMIN-SEP-TC-035','ADMIN-SEP','Aadhaar editable on profile','P2','Admin edits Aadhaar number on sebayat profile — saved and reflected in list search.','View/Edit',148),
-- Hobby
('REG-TC-056','REG','Hobby field saved','P3','Enter hobby text in Step 1 — saved and shown on profile.','Step 1',69),
('PROF-TC-016','PROF','Hobby shown on profile','P3','Hobby set on profile — displayed in personal details section.','Data Display',98),
-- Death details
('ADMIN-SEP-TC-036','ADMIN-SEP','Record death details','P2','Admin records death date and place for deceased sebayat — saved correctly.','Manage',149),
('ADMIN-SEP-TC-037','ADMIN-SEP','Death details persist on profile','P3','Reopen sebayat profile — recorded death details still shown.','View/Edit',150),
('PROF-TC-017','PROF','Deceased status handled gracefully','P3','Profile with death details recorded — no crash; deceased info not shown to the member account.','Data Display',99),
-- Sahis management
('ADMIN-SEBA-TC-020','ADMIN-SEBA','Sahis list shown','P2','Open Sahis management — all sahis listed with status.','Sahis',171),
('ADMIN-SEBA-TC-021','ADMIN-SEBA','Add sahi','P2','Add new sahi with name — appears in list and in registration sahi dropdown.','Sahis',172),
('ADMIN-SEBA-TC-022','ADMIN-SEBA','Edit sahi','P2','Rename sahi — updated everywhere it is referenced.','Sahis',173),
('ADMIN-SEBA-TC-023','ADMIN-SEBA','Toggle sahi active/inactive','P3','Disable a sahi — hidden from new registration selections; existing members unaffected.','Sahis',174),
-- Family DOB
('REG-TC-057','REG','Child date of birth saved','P3','Add child with date of birth in family details — saved with profile.','Step 4',70),
-- Bhai Pua / Palia
('REG-TC-058','REG','Bhai toggle saved','P3','Toggle Bhai status in registration — saved with profile.','Step 1',71),
('REG-TC-059','REG','Pua/Palia flags saved','P3','Set Pua and Palia status flags — saved and persist after re-open.','Step 1',72),
-- Personal seba calendar
('SCHED-TC-010','SCHED','Personal duty dates on calendar','P1','Approved member opens schedule — their own seba duty dates marked via personal calendar lookup.','Calendar',107),
('SCHED-TC-011','SCHED','Personal dates update after assignment change','P2','Admin changes seba assignment — member calendar reflects new dates on next load.','Calendar',108),
('SCHED-TC-012','SCHED','Member with no duties — clean calendar','P3','Member with no seba assignments — calendar shows month with no duty markers, no error.','Calendar',109),
-- Offline + notifications additions
('OFFLINE-TC-009','OFFLINE','Documents cached for offline','P3','Enable offline mode, load documents, go offline — previously loaded documents still viewable.','Cache',231),
('NOTIF-TC-011','NOTIF','Notice notification deep link opens notice','P2','Tap a notice push notification — notice detail screen opens directly.','Push',223)
ON CONFLICT (test_case_id) DO NOTHING;
