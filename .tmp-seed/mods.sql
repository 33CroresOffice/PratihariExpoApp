/*
# Testing module — seed real catalog data (chunk 0/0)

Upserts the actual test-case catalog extracted from the previous version of the testing page.
ON CONFLICT upserts — safe to re-run, nothing deleted. This replaces the earlier
reconstruction with the exact original catalog data.
*/

INSERT INTO test_modules (code,name,scope) VALUES
('AUTH','Authentication (OTP)','Mobile App'),
('REG','Sebayat Registration','Mobile App'),
('HOME','Home Screen','Mobile App'),
('PROF','Profile Screen','Mobile App'),
('SCHED','Schedule Screen','Mobile App'),
('NOTICE','Notice Board','Mobile App'),
('ADMIN-SEP','Admin — Sebayat Profiles','Admin Dashboard'),
('ADMIN-APP','Admin — Applications','Admin Dashboard'),
('ADMIN-SEBA','Admin — Seba Management','Admin Dashboard'),
('ADMIN-MGMT','Admin — Notices/Committee/Images','Admin Dashboard'),
('ADMIN-SETTINGS','Admin — Settings & RBAC','Admin Dashboard'),
('ADMIN-LOG','Admin — Activity Log','Admin Dashboard'),
('NOTIF','Notifications (Push/SMS/WA)','Backend + App'),
('OFFLINE','Offline Mode & Caching','Mobile App'),
('I18N','Internationalization','Mobile App'),
('DB','Database & RLS Policies','Supabase'),
('EDGE','Edge Functions','Supabase Edge'),
('APP','Applications','Mobile App'),
('COMM','Committee','Mobile App'),
('SOC/PALI','Social Profile & Pali History','Mobile App'),
('SD/MEM','Sebayat Detail & Members Directory','Mobile App')
ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name, scope=EXCLUDED.scope;
