# Cascade Tech

A free resource hub for tech learning material. Students browse by topic and download files, with no login. You sign in at `/admin.html` to post and delete materials.

Frontend: plain HTML/CSS/JS on Netlify. Backend: Supabase (database, file storage, admin login).

## Setup (about 15 minutes)

### 1. Supabase project
1. Create a new project at supabase.com. A separate project from Soko keeps things tidy, and the free plan allows two.
2. Go to **Authentication -> Users -> Add user**, create your admin account (email + strong password), and tick **Auto Confirm User**.
3. Go to **Authentication -> Sign In / Providers** and turn **off** "Allow new users to sign up". This stops strangers from creating accounts.
4. Open `supabase/setup.sql`, replace `admin@example.com` with your admin email, then paste it into **SQL Editor** and run it.

### 2. Connect the site
1. In Supabase go to **Project Settings -> API**.
2. Copy the **Project URL** and the **anon public key** into `js/config.js`.

### 3. Deploy on Netlify
1. Drag this whole folder onto app.netlify.com/drop, or connect it to a Git repo.
2. Open `your-site.netlify.app/admin.html`, sign in, and post your first material.

## Bulk import (zips and mixed files)

1. If you already ran `setup.sql` before this update, run `supabase/add-file-type.sql` once in the SQL Editor. It adds the file type column and fills it in for anything already uploaded.
2. On the admin page, open **Bulk import**, pick your zip files (or loose files) and press **Scan files**.
3. Each file is sorted by extension (PDF, Python, Notebook, Web, Code, Docs, Data, Programs, Archives, Media, Other) and stored in a folder for that type. A topic is suggested from folder and file names. Change any row, or use "Set topic for checked rows".
4. Files that look like they contain a token, key or password are flagged and left unchecked. Remove the secret from the file before you upload it.
5. Press **Publish checked files**.

Limits: .zip only (not .rar or .7z), no password-protected zips, 50 MB per file, and very large zips use your browser's memory, so do a few at a time.

## Notes

- **Premium label:** the "Premium" option only changes the badge for now. Files sit in a public bucket, so anyone with a file's link can download it. When you add payments, move premium files to a private bucket and serve them through signed links.
- **Limits:** the free Supabase plan caps total storage and monthly download bandwidth. Check the current numbers on supabase.com/pricing before launch.
- **Admin page:** `admin.html` isn't linked from the public site and is marked noindex, but the real protection is the sign-in plus the database rules, not the hidden address.
- **Topics:** edit the `CATEGORIES` list in `js/common.js` to add or rename topics.
- **Content:** only post material you wrote or have the right to share.
