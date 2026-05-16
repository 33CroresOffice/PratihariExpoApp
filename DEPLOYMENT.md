# Pratihari Nijog — Production Deployment Guide

**Version:** 1.0.0  
**Stack:** Expo (React Native + Web) + Supabase  
**Date:** May 2026

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Prerequisites](#2-prerequisites)
3. [Architecture](#3-architecture)
4. [Supabase Project Setup](#4-supabase-project-setup)
5. [Database Deployment (Migrations)](#5-database-deployment)
6. [Storage Bucket Setup](#6-storage-bucket-setup)
7. [Edge Functions Deployment](#7-edge-functions-deployment)
8. [Environment Variables Reference](#8-environment-variables-reference)
9. [External Services Setup](#9-external-services-setup)
10. [Seed Data](#10-seed-data)
11. [First Super Admin Setup](#11-first-super-admin-setup)
12. [Scheduled Jobs (pg_cron)](#12-scheduled-jobs)
13. [Mobile App Build (iOS & Android)](#13-mobile-app-build)
14. [Web Deployment](#14-web-deployment)
15. [Post-Deployment Verification](#15-post-deployment-verification)
16. [Monitoring & Logging](#16-monitoring--logging)
17. [Troubleshooting](#17-troubleshooting)
18. [Full Deployment Checklist](#18-full-deployment-checklist)

---

## 1. System Overview

The Pratihari Nijog app is a mobile-first system for managing the Pratihari Nijog temple service organization. It handles:

- Member registration and approval workflow
- Seba (duty) scheduling and beddha cycle management
- Real-time session attendance tracking
- Multi-channel notifications (SMS, WhatsApp, Push)
- Committee management
- Admin RBAC (Role-Based Access Control)
- Notices and announcements
- Offline mode support

### Technology Stack

| Layer | Technology |
|---|---|
| Mobile App | Expo SDK 54, React Native 0.81.4, React 19 |
| Web App | Expo Web (Metro bundler, static export) |
| Backend / DB | Supabase (PostgreSQL 15) |
| Auth | Supabase Auth + custom OTP via MSG91 |
| Server Logic | Supabase Edge Functions (Deno/TypeScript) |
| SMS/WhatsApp | MSG91 API |
| Push Notifications | Expo Push Notification Service |
| Scheduled Jobs | pg_cron (built into Supabase) |
| Storage | Supabase Storage (profile photos) |

---

## 2. Prerequisites

Before starting deployment, ensure you have the following installed and ready.

### Local Tools

```
Node.js          >= 18.x LTS
npm              >= 9.x
Supabase CLI     latest  →  npm install -g supabase
Expo CLI         latest  →  npm install -g expo-cli
EAS CLI          latest  →  npm install -g eas-cli
Git
```

### Accounts Required

| Service | Purpose | URL |
|---|---|---|
| Supabase | Database, Auth, Storage, Edge Functions | supabase.com |
| MSG91 | OTP SMS + WhatsApp messaging | msg91.com |
| Expo / EAS | Mobile app builds and OTA updates | expo.dev |
| Apple Developer | iOS App Store distribution | developer.apple.com ($99/yr) |
| Google Play | Android Play Store distribution | play.google.com/console ($25 one-time) |
| Static host | Web app hosting (Vercel / Netlify / Cloudflare) | Your choice |

---

## 3. Architecture

```
┌─────────────────────────────────────────────────────┐
│                   CLIENT APPS                        │
│                                                      │
│   iOS App        Android App        Web App          │
│  (Expo/RN)       (Expo/RN)     (Static Export)       │
└────────────────────────┬─────────────────────────────┘
                         │  HTTPS
                         ▼
┌─────────────────────────────────────────────────────┐
│                  SUPABASE CLOUD                      │
│                                                      │
│  ┌──────────────┐    ┌──────────────────────────┐    │
│  │  PostgREST   │    │      Edge Functions       │    │
│  │  (auto API)  │    │                          │    │
│  └──────┬───────┘    │  send-otp                │    │
│         │            │  verify-otp              │    │
│  ┌──────▼───────┐    │  resend-otp              │    │
│  │  PostgreSQL  │    │  send-notification       │    │
│  │  + RLS       │    │  seba-reminders          │    │
│  │  + pg_cron   │    │  manage-admin            │    │
│  └──────────────┘    │  niti-started            │    │
│                      └────────────┬─────────────┘    │
│  ┌──────────────┐                 │                  │
│  │   Storage    │                 │                  │
│  │ profile-photos│               │                  │
│  └──────────────┘                 │                  │
└─────────────────────────────────┬─┘──────────────────┘
                                  │
                    ┌─────────────┼──────────────┐
                    ▼             ▼              ▼
               ┌────────┐  ┌──────────┐  ┌──────────┐
               │ MSG91  │  │  Expo    │  │  Niti    │
               │SMS/WA  │  │  Push    │  │ Tracker  │
               └────────┘  └──────────┘  │(external)│
                                         └──────────┘
```

---

## 4. Supabase Project Setup

### Step 1 — Create a New Project

1. Log in at [supabase.com](https://supabase.com)
2. Click **New Project**
3. Choose your organization, set a project name (e.g., `pratihari-nijog-prod`), set a strong database password, and select the region closest to your users (e.g., `ap-south-1` for India)
4. Wait 2–3 minutes for provisioning to complete

### Step 2 — Collect Your Credentials

From **Project Settings > API**, note:

```
Project URL:        https://<your-project-ref>.supabase.co
Anon (public) key:  eyJ...  (safe to expose in the app)
Service role key:   eyJ...  (NEVER expose publicly — backend only)
```

### Step 3 — Enable Required Extensions

Go to **Database > Extensions** and enable:

| Extension | Purpose |
|---|---|
| `pg_cron` | Scheduled jobs for seba reminders |
| `pg_net` | HTTP calls from pg_cron to Edge Functions |

Both are available in Supabase Cloud. Click **Enable** for each.

---

## 5. Database Deployment

The database schema is defined across **45 SQL migration files** covering the full feature set.

### Using Supabase CLI (Recommended)

```bash
# 1. Log in to Supabase CLI
supabase login

# 2. Link your project
supabase link --project-ref <your-project-ref>

# 3. Push all migrations
supabase db push
```

### Manually via SQL Editor

1. Go to **Database > SQL Editor** in the Supabase dashboard
2. Run each file from `supabase/migrations/` in chronological order
3. Files begin at `20260427080303_create_sebayats_and_otp_sessions.sql` and end at `20260506140712_add_offline_mode_preference.sql`

### What the Migrations Create

| Category | Tables Created |
|---|---|
| Core Members | `sebayats`, `otp_sessions`, `phone_numbers`, `children`, `occupations`, `identity_documents` |
| Approval Flow | `profile_review_history` |
| Seba Structure | `seba_groups`, `seba_categories`, `seba_beddhas`, `seba_group_anchor_history` |
| Assignments | `sebayat_seba_selections`, `nijog_assignments` |
| Schedule | `seba_schedule`, `seba_roster`, `seba_sessions` |
| Notices | `notices`, `notice_reads` |
| Committees | `committees`, `committee_members` |
| Admin | `pratihari_admins`, `admin_roles`, `role_permissions`, `admin_user_permissions`, `admin_activity_log` |
| Notifications | `push_tokens`, `notification_channels`, `notification_feature_config`, `notification_log`, `admin_notifications`, `seba_notification_config`, `niti_tracker_events` |
| Settings | `app_settings`, `event_images`, `_seba_cron_settings` |

---

## 6. Storage Bucket Setup

One storage bucket is required. The migrations create it automatically, but verify it exists:

1. Go to **Storage** in the Supabase dashboard
2. Confirm the bucket `profile-photos` exists and is set to **Public**
3. If it does not exist, create it manually:
   - Name: `profile-photos`
   - Public: Yes

RLS policies on the bucket allow authenticated users to upload to their own folder and allow public read access for all profile photos.

---

## 7. Edge Functions Deployment

There are **7 Edge Functions** to deploy, all located in `supabase/functions/`.

### Deploy All Functions

```bash
# Deploy all functions at once
supabase functions deploy

# Or deploy individually
supabase functions deploy send-otp
supabase functions deploy verify-otp
supabase functions deploy resend-otp
supabase functions deploy send-notification
supabase functions deploy seba-reminders
supabase functions deploy manage-admin
supabase functions deploy niti-started
```

### Function Reference

#### `send-otp`
Sends a 6-digit OTP to a phone number via SMS or WhatsApp through MSG91.
- **Endpoint:** `POST /functions/v1/send-otp`
- **Calls:** MSG91 `https://control.msg91.com/api/v5/otp`
- **Required secrets:** `MSG91_AUTH_KEY`, `MSG91_TEMPLATE_ID`

#### `verify-otp`
Verifies the OTP entered by the user. Creates a new auth account if first login, or links to an existing sebayat profile.
- **Endpoint:** `POST /functions/v1/verify-otp`
- **Calls:** MSG91 verify endpoint, Supabase Auth admin API
- **Required secrets:** `SUPABASE_SERVICE_ROLE_KEY`, `MSG91_AUTH_KEY`

#### `resend-otp`
Retries sending an OTP using MSG91's retry endpoint.
- **Endpoint:** `POST /functions/v1/resend-otp`
- **Calls:** MSG91 `https://control.msg91.com/api/v5/otp/retry`
- **Required secrets:** `MSG91_AUTH_KEY`

#### `send-notification`
Dispatches notifications across all channels — SMS, WhatsApp, Expo push, and in-dashboard admin alerts.
- **Endpoint:** `POST /functions/v1/send-notification`
- **Calls:** MSG91 flow API, `https://exp.host/--/api/v2/push/send`
- **Required secrets:** `SUPABASE_SERVICE_ROLE_KEY`, `MSG91_AUTH_KEY`

#### `seba-reminders`
Called by pg_cron twice daily. Looks up who is on duty and dispatches reminders.
- **Endpoint:** `POST /functions/v1/seba-reminders`
- **Calls:** `send-notification` (internal)
- **Required secrets:** `SUPABASE_SERVICE_ROLE_KEY`
- **Triggered by:** pg_cron at 06:00 IST and 18:00 IST daily

#### `manage-admin`
Creates, disables, and resets passwords for admin accounts. Restricted to super admins only.
- **Endpoint:** `POST /functions/v1/manage-admin`
- **Calls:** Supabase Auth admin API (internal)
- **Required secrets:** `SUPABASE_SERVICE_ROLE_KEY`

#### `niti-started`
Webhook receiver. An external niti tracker system calls this when a specific niti begins; it then notifies performers of the upcoming niti.
- **Endpoint:** `POST /functions/v1/niti-started`
- **Calls:** `send-notification` (internal)
- **Required secrets:** `SUPABASE_SERVICE_ROLE_KEY`
- **Auth:** Bearer token (stored in `seba_notification_config.niti_tracker_webhook_secret`)

### Set Edge Function Secrets

```bash
supabase secrets set \
  SUPABASE_URL=https://<your-ref>.supabase.co \
  SUPABASE_SERVICE_ROLE_KEY=eyJ... \
  SUPABASE_ANON_KEY=eyJ... \
  MSG91_AUTH_KEY=your_msg91_key \
  MSG91_TEMPLATE_ID=your_template_id \
  MSG91_SMS_NOTIFICATION_TEMPLATE_ID=your_sms_notif_template \
  MSG91_WA_NOTIFICATION_TEMPLATE_ID=your_wa_template \
  OTP_TEST_MODE=false
```

Or set them in the Supabase Dashboard under **Project Settings > Edge Functions > Secrets**.

---

## 8. Environment Variables Reference

### Client App (`.env` file in project root)

```env
EXPO_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...your-anon-key...
```

These are embedded into the app at build time. They are safe to be public.

### Edge Function Secrets (Server-Side Only)

| Variable | Required | Description |
|---|---|---|
| `SUPABASE_URL` | Yes | Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Admin-level key — never expose publicly |
| `SUPABASE_ANON_KEY` | Yes | Public anon key |
| `MSG91_AUTH_KEY` | Yes | MSG91 account authentication key |
| `MSG91_TEMPLATE_ID` | Yes | MSG91 OTP template ID (pre-approved) |
| `MSG91_SMS_NOTIFICATION_TEMPLATE_ID` | No | Separate SMS notification template (falls back to `MSG91_TEMPLATE_ID`) |
| `MSG91_WA_NOTIFICATION_TEMPLATE_ID` | No | WhatsApp notification template ID |
| `OTP_TEST_MODE` | No | Set `true` for development (OTP is always `123456`); set `false` for production |

---

## 9. External Services Setup

### MSG91 (Critical — Required for All Logins)

MSG91 powers the OTP authentication flow. Without it, no user can log in.

1. Register at [msg91.com](https://msg91.com)
2. Complete KYC verification (required for India numbers)
3. Purchase SMS and/or WhatsApp credits
4. Under **OTP**, create an OTP template — note the **Template ID**
5. For WhatsApp, apply for WhatsApp Business API access and create notification templates
6. Under **Settings > API Key**, generate your auth key
7. Register the DLT sender ID if sending to Indian numbers (legally required in India)
8. Set the following in your Edge Function secrets:
   - `MSG91_AUTH_KEY` — your API key
   - `MSG91_TEMPLATE_ID` — your OTP template ID

**Test MSG91 integration:**

```bash
curl -X POST https://<your-ref>.supabase.co/functions/v1/send-otp \
  -H "Authorization: Bearer <anon-key>" \
  -H "Content-Type: application/json" \
  -d '{"phone": "91XXXXXXXXXX", "channel": "sms"}'
```

### Expo Push Notifications

Expo's push service is used for in-app push notifications. No separate account is needed beyond your Expo account.

**Development mode:** Uses Expo Go tokens — works directly.

**Production mode requires:**
1. An Expo project with EAS configured
2. For iOS: APNs credentials configured in the EAS dashboard
3. For Android: FCM credentials configured in the EAS dashboard
4. Update `notification_channels` table row for `push`: set `push_mode = 'production'` when going live

---

## 10. Seed Data

After running migrations, verify these configuration tables have the required rows:

```sql
-- Should show 2 rows: pratihari and gochhikar
SELECT code, name, beddha_count, anchor_date FROM seba_groups;

-- Should show 4 rows: Super Admin, Admin, Moderator, Viewer
SELECT role_name, is_system_role FROM admin_roles;

-- Should show 3 rows: sms, whatsapp, push
SELECT channel, enabled FROM notification_channels;

-- Should show rows for standard notification events
SELECT event_key FROM notification_feature_config;

-- Should show 1 row
SELECT * FROM seba_notification_config;

-- Should show 2 rows: otp_sms_enabled, otp_whatsapp_enabled
SELECT key, value FROM app_settings;
```

If any are missing, recheck that all migration files ran in order.

### Adjust Seba Group Anchor Dates

The anchor dates control the beddha cycle rotation. Update them to match your actual schedule:

```sql
UPDATE seba_groups
SET anchor_date = '2026-03-15', anchor_beddha = 1
WHERE code = 'pratihari';

UPDATE seba_groups
SET anchor_date = '2026-04-27', anchor_beddha = 1
WHERE code = 'gochhikar';
```

---

## 11. First Super Admin Setup

The first admin must be created directly in the database — there is no UI for this step.

### Step 1 — Create Auth User

Via Supabase Dashboard:
1. Go to **Authentication > Users**
2. Click **Add User**
3. Enter the admin's email and a temporary password
4. Note the generated UUID of the new user

### Step 2 — Grant Super Admin Role

```sql
-- Replace the UUID with the auth user's actual ID from Step 1
INSERT INTO pratihari_admins (user_id, is_super_admin, is_disabled)
VALUES ('xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx', true, false);
```

### Step 3 — Verify

```sql
SELECT p.id, u.email, p.is_super_admin
FROM pratihari_admins p
JOIN auth.users u ON u.id = p.user_id;
```

This super admin can now log in to the admin panel and create other admins through the `manage-admin` Edge Function.

---

## 12. Scheduled Jobs

Two pg_cron jobs send daily reminders. Activate them after deployment.

### Step 1 — Store Cron Credentials

```sql
SELECT set_seba_cron_credentials(
  'https://<your-project-ref>.supabase.co',
  'eyJ...your-service-role-key...'
);
```

### Step 2 — Activate the Jobs

```sql
SELECT reschedule_seba_reminder_jobs();
```

This creates two cron jobs:
- `seba-reminder-evening` — runs daily at **12:30 UTC (18:00 IST)** — notifies about tomorrow's duty
- `seba-reminder-morning` — runs daily at **00:30 UTC (06:00 IST)** — notifies about today's duty

### Step 3 — Verify Jobs Are Active

```sql
SELECT jobname, schedule, active FROM cron.job;
```

### Changing Reminder Times

```sql
UPDATE seba_notification_config
SET morning_reminder_time = '06:00',
    evening_reminder_time = '18:00'
WHERE id = 1;

-- Re-apply to update cron schedule
SELECT reschedule_seba_reminder_jobs();
```

---

## 13. Mobile App Build

### Step 1 — Update app.json

Update `app.json` with your production values before building:

```json
{
  "expo": {
    "name": "Pratihari Nijog",
    "slug": "pratihari-nijog",
    "version": "1.0.0",
    "ios": {
      "bundleIdentifier": "com.yourorg.pratihariapp",
      "supportsTablet": true,
      "buildNumber": "1"
    },
    "android": {
      "package": "com.yourorg.pratihariapp",
      "versionCode": 1
    },
    "scheme": "pratihariapp"
  }
}
```

### Step 2 — Create eas.json

The project does not currently have an `eas.json`. Create one in the project root:

```json
{
  "cli": { "version": ">= 14.0.0" },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "ios": { "simulator": false }
    },
    "production": {
      "autoIncrement": true
    }
  },
  "submit": {
    "production": {}
  }
}
```

### Step 3 — Configure EAS Project

```bash
# Login to Expo
eas login

# Initialize EAS in the project
eas init

# Configure credentials
eas credentials
```

### Step 4 — Build

```bash
# iOS production build
eas build --platform ios --profile production

# Android production build
eas build --platform android --profile production

# Both platforms at once
eas build --platform all --profile production
```

### Step 5 — Submit to App Stores

```bash
# Submit to Apple App Store
eas submit --platform ios

# Submit to Google Play Store
eas submit --platform android
```

### iOS Requirements Checklist
- Apple Developer Program membership ($99/year)
- App ID registered in Apple Developer portal
- APNs key uploaded to EAS for push notifications
- App Store Connect app record created

### Android Requirements Checklist
- Google Play Developer account ($25 one-time)
- App record created in Play Console
- FCM server key uploaded to EAS for push notifications
- Signing keystore managed by EAS

---

## 14. Web Deployment

The web version is a fully static export — no server needed.

### Build

```bash
npm install
npm run build:web
# Output is in ./dist/
```

### Deploy to Vercel (Recommended)

```bash
npm install -g vercel
vercel --prod
# Point output directory to ./dist when prompted
```

### Deploy to Netlify

```bash
npm install -g netlify-cli
netlify deploy --prod --dir=dist
```

### Deploy to Cloudflare Pages

1. Push your repository to GitHub
2. In Cloudflare Pages, connect the repository
3. Set build command: `npm run build:web`
4. Set output directory: `dist`

### Important: Environment Variables for Web Builds

The `EXPO_PUBLIC_*` variables are baked into the bundle at build time. Set them in your hosting provider's environment settings before triggering a build.

---

## 15. Post-Deployment Verification

### Authentication Flow
- [ ] Open app, enter a valid phone number, tap Send OTP
- [ ] Receive OTP via SMS (or check that test mode returns `123456`)
- [ ] Enter OTP and verify session is created
- [ ] Confirm user appears in Supabase **Authentication > Users**

### Profile Registration
- [ ] New user is prompted to complete registration
- [ ] Submit profile, verify status changes to `submitted`
- [ ] Log in as admin, approve the profile, confirm status becomes `approved`

### Seba Schedule
- [ ] Confirm seba groups and beddha cycles appear correctly
- [ ] Verify today's beddha number matches expectations

### Notifications

```bash
# Test sending a notification manually
curl -X POST https://<ref>.supabase.co/functions/v1/send-notification \
  -H "Authorization: Bearer <service-role-key>" \
  -H "Content-Type: application/json" \
  -d '{
    "event": "seba_morning_reminder",
    "recipient_sebayat_id": "<valid-sebayat-uuid>",
    "recipient_type": "sebayat",
    "template_vars": {
      "name": "Test User",
      "seba_name": "Test Seba",
      "beddha_number": "1"
    }
  }'
```

### Scheduled Jobs
- [ ] Query `cron.job` to confirm jobs exist and are active
- [ ] Check `notification_log` for delivery records after next scheduled run

### Admin Panel
- [ ] Log in as super admin
- [ ] Create a new admin user via the manage-admin function
- [ ] Verify the new admin appears in `pratihari_admins`

---

## 16. Monitoring & Logging

### Key Tables to Watch

| Table | What to Monitor |
|---|---|
| `notification_log` | Delivery success/failure rates per channel |
| `admin_activity_log` | All admin actions — changes to profiles, schedules |
| `otp_sessions` | OTP request volume, expiry, verification failures |
| `niti_tracker_events` | Webhook call statuses from external system |
| `admin_notifications` | Unread alert backlog for admin users |

### Useful Monitoring Queries

```sql
-- Notification delivery success rate (last 7 days)
SELECT channel,
       COUNT(*) FILTER (WHERE status = 'sent') AS sent,
       COUNT(*) FILTER (WHERE status = 'failed') AS failed,
       COUNT(*) FILTER (WHERE status = 'skipped') AS skipped
FROM notification_log
WHERE created_at > now() - interval '7 days'
GROUP BY channel;

-- Recent OTP failures
SELECT phone, created_at, verified
FROM otp_sessions
WHERE verified = false AND expires_at < now()
ORDER BY created_at DESC
LIMIT 20;

-- Admin activity in last 24 hours
SELECT actor_email, action_type, resource_type, resource_label, created_at
FROM admin_activity_log
WHERE created_at > now() - interval '24 hours'
ORDER BY created_at DESC;

-- Pending member applications
SELECT COUNT(*) FROM sebayats WHERE profile_status = 'submitted';
```

### Supabase Dashboard Monitoring

- **Database > Query Performance** — identify slow queries
- **Edge Functions > Logs** — function errors and execution times
- **Storage > Usage** — photo storage consumption
- **Authentication > Users** — user signup rates

---

## 17. Troubleshooting

### OTP Not Received

1. Check `OTP_TEST_MODE` is set to `false` in production
2. Verify `MSG91_AUTH_KEY` and `MSG91_TEMPLATE_ID` are set correctly
3. Check the `otp_sessions` table — was a row created? If yes, MSG91 was called
4. Log in to MSG91 dashboard and check delivery reports
5. For Indian numbers, verify DLT registration is complete
6. Check Edge Function logs: **Dashboard > Edge Functions > send-otp > Logs**

### Users Cannot Log In

1. Check `app_settings` table — `otp_sms_enabled` or `otp_whatsapp_enabled` should be `true`
2. Verify `verify-otp` function is deployed and secrets are set
3. Check `otp_sessions` for the phone number — is `verified` being set to `true`?

### Push Notifications Not Arriving

1. Verify `push_tokens` table has entries for the user
2. Check `notification_channels` — `push` row `enabled` should be `true`
3. For production builds: ensure APNs (iOS) and FCM (Android) credentials are in EAS
4. Change `push_mode` to `production` in `notification_channels` for production builds

### Seba Reminders Not Sending

1. Confirm `pg_cron` and `pg_net` extensions are enabled
2. Run `SELECT * FROM cron.job;` — jobs should be listed and active
3. Run `set_seba_cron_credentials(...)` and `reschedule_seba_reminder_jobs()` again
4. Check `seba_notification_config` — `evening_reminder_enabled` and `morning_reminder_enabled` should be `true`
5. Check `notification_log` around expected cron times

### Database Migration Errors

1. Run migrations one at a time to identify the failing file
2. Check for extension errors — ensure `pg_cron` and `pg_net` are enabled before migrations that reference them
3. Check for foreign key errors — migrations must be run in strict chronological order

---

## 18. Full Deployment Checklist

### Infrastructure
- [ ] Supabase project created (region: `ap-south-1` recommended for India)
- [ ] `pg_cron` extension enabled
- [ ] `pg_net` extension enabled
- [ ] All 45 migrations run successfully
- [ ] `profile-photos` storage bucket exists and is public

### Configuration
- [ ] `.env` updated with production Supabase URL and anon key
- [ ] All Edge Function secrets set (MSG91 keys, service role key, `OTP_TEST_MODE=false`)
- [ ] `seba_groups` anchor dates correct
- [ ] `notification_channels` configured (enable SMS/WhatsApp/Push as needed)
- [ ] `seba_notification_config` row exists with correct times

### External Services
- [ ] MSG91 account active with approved OTP template
- [ ] DLT registration complete (for Indian numbers)
- [ ] MSG91 template IDs noted and set in secrets
- [ ] Expo account set up and project initialized

### Edge Functions
- [ ] `send-otp` deployed and tested
- [ ] `verify-otp` deployed and tested
- [ ] `resend-otp` deployed and tested
- [ ] `send-notification` deployed and tested
- [ ] `seba-reminders` deployed
- [ ] `manage-admin` deployed
- [ ] `niti-started` deployed (optional — only needed if using niti tracker integration)

### Admin Setup
- [ ] First super admin auth user created
- [ ] Super admin row inserted into `pratihari_admins`
- [ ] Admin can log in and access admin panel
- [ ] Admin RBAC roles and permissions verified

### Scheduled Jobs
- [ ] `set_seba_cron_credentials(...)` called with production values
- [ ] `reschedule_seba_reminder_jobs()` called
- [ ] `cron.job` table shows both morning and evening jobs as active

### App Builds
- [ ] `app.json` updated with production name, bundle IDs, and version
- [ ] `eas.json` created with build profiles
- [ ] iOS production build completed and submitted
- [ ] Android production build completed and submitted
- [ ] Web static build exported (`npm run build:web`)
- [ ] Web build deployed to hosting provider

### Final Verification
- [ ] OTP login works end-to-end on a real device
- [ ] Profile registration and approval flow tested
- [ ] Notifications received on at least one channel
- [ ] Admin panel accessible by super admin
- [ ] Seba schedule displays correct beddha for today

---

*Keep your service role key, MSG91 auth key, and database password secure at all times. Never commit them to source control.*
