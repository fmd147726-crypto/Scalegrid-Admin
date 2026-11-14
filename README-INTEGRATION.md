# ScaleGrid Admin + User Website integration

## What was changed
- Preserved the supplied website HTML and its existing design; the integration is additive.
- Fixed public pages referencing a missing `main.js`; they now load the supplied `user.js`.
- Reworked `user.js` to reuse the existing Firebase app instance, listen to `pages/{pageKey}` and render only optional managed sections.
- Preserved the homepage notification read from `notifications`.
- Implemented the admin page controls for hero, descriptions, section layout/visibility, portfolio, packages and FAQs.
- Added a homepage content editor at `home.html` for About, portfolio, testimonials, process steps and FAQs.
- Added notification history/deletion and safer fail-closed admin authorization.
- Added a starter Realtime Database rules file. It is intentionally not auto-deployed.

## Firebase bootstrap — required before deployment
Both ZIPs point at Firebase project `scalegrid-1c506`. Before publishing:
1. In Firebase Authentication, enable the sign-in providers you use (Google and/or Email/Password).
2. Create the initial admin account in Firebase Authentication.
3. In Realtime Database, create `admins/{new-key}` with the account email, role `super`, and a permissions object. Example:
   ```json
   {"email":"your-admin@example.com","role":"super","permissions":{"content":true,"portfolio":true,"faqs":true,"pricing":true,"sections":true}}
   ```
4. Find that account's Firebase Authentication UID and create `adminUids/{UID}` with value `true`.
5. Review `database.rules.json`, then publish the rules in Firebase Console. Do not deploy until you have confirmed the UID allowlist and that the admin can sign in. The UID allowlist is the server-enforced write gate; client-side role checks alone are not security.
6. Test admin login, notification publishing, and public rendering in a staging copy before production.

The rules allow public read access only for public website content and notifications, while writes require an authenticated UID listed under `adminUids`. Admin records are readable by signed-in users so the current email-based admin UI can verify membership; writes are UID-gated.

## Content paths
- `pages/general`: homepage About, portfolio, testimonials, process, FAQs.
- `pages/ads`, `pages/apps`, `pages/websites`, `pages/automations`: service page hero, description, portfolio, packages, FAQs, and layout.
- `notifications`: existing website notification stream (preserved).
- `admins`: existing email/role admin records.
- `adminUids`: security-rule allowlist keyed by Firebase Auth UID.

## Important publishing checks
- Replace sample/placeholder portfolio information only with client-approved details.
- Verify every performance metric and testimonial before publishing.
- Add your real contact email and WhatsApp number before enabling a contact CTA; no contact details were present in the supplied ZIP, so none have been invented.
- The public homepage notification code currently displays the latest notification regardless of `target`; review the target behavior if you use audience-specific notifications.
- The admin authorization UI uses email matching, but production authorization is enforced by the `adminUids` security rules. Keep the UID allowlist current.

## Hosting
Serve both folders from static hosting over HTTPS. The Firebase SDK is loaded from Google's CDN. No build step is required. Do not open HTML files directly using `file://`; use a local static server or Firebase Hosting.

## Homepage editor layout fix
The `home.html` editor uses the same `.admin-container`, `.sidebar`, `.nav-menu`, `.nav-btn`, and `.main-content` structure as the other admin pages. This keeps the sidebar and editor side by side on desktop and stacks them on narrow screens.
