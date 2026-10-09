# Privacy Auth System

**Privacy-focused, passwordless authentication using WebAuthn passkeys.**

Privacy Auth System is a full-stack Next.js application that demonstrates pseudonymous account creation, phishing-resistant passkey authentication, multi-passkey management, account-data transparency, and WebAuthn-protected account deletion.

> **Project status:** Working **local-development prototype**, tested with Safari, Chrome, and a local PostgreSQL database. It is **not yet production-hardened or independently security-audited**.

## Features

- **Passwordless registration and sign-in:** Create a pseudonymous account and authenticate using WebAuthn/FIDO2 passkeys; no application password is required.
- **Passkey management:** Add credentials from different authenticators, list registered passkeys, and protect the last remaining passkey from removal.
- **Sensitive-action reauthentication:** Require a fresh, user-verified WebAuthn assertion before removing a passkey or deleting an account.
- **Session management:** Use server-validated, HTTP-only session cookies; store hashed session tokens in PostgreSQL.
- **Privacy dashboard:** View a pseudonymous account identifier and counts of associated passkeys, session records, and temporary challenges.
- **JSON data export:** Download selected account and authentication **metadata**, omitting session tokens, token hashes, raw challenges, and credential public-key bytes.
- **Account deletion:** Confirm the action and reauthenticate with a passkey, then delete the account and its related records using database cascade rules.
- **Automated security tests:** 50 passing Vitest tests across six API test suites at the latest local validation.

## Technology stack

| Layer | Technology |
| --- | --- |
| Application | Next.js 16 (App Router), React 19, TypeScript |
| Styling | Tailwind CSS |
| Passkeys | SimpleWebAuthn (browser and server), WebAuthn/FIDO2 |
| Database | PostgreSQL |
| Data access / migrations | Prisma ORM 7 |
| Automated tests | Vitest |
| Development / verification | VS Code, Safari, Chrome |

## Architecture

```text
Browser (Safari / Chrome)
   |
   | WebAuthn registration or authentication ceremony
   v
Next.js pages and client components
   |
   | Same-origin API requests + HTTP-only session cookie
   v
Next.js API routes
   |-- WebAuthn challenge generation
   |-- Cryptographic response verification
   |-- Session validation and issuance
   |-- Passkey management
   |-- Account export and verified deletion
   v
Prisma ORM
   v
PostgreSQL
   |-- User
   |-- Passkey
   |-- Session
   `-- WebAuthnChallenge
```

The application represents accounts with opaque IDs rather than requiring names, email addresses, or passwords. A credential's private key stays with its authenticator or passkey provider; the application database stores its public key and supporting metadata.

## Getting started (local development)

### Prerequisites

- Node.js and npm compatible with Next.js 16.
- A working PostgreSQL instance, including the Prisma-managed local development database if using `prisma dev`.
- A browser with WebAuthn/passkey support (for example, Safari or Chrome).
- A passkey authenticator or provider, such as Apple Passwords or a Chrome-profile authenticator.

### 1. Get the code and dependencies

```bash
git clone https://github.com/Chatuminie/privacy-auth-system.git
cd privacy-auth-system
npm install
```

**Note:** Until the feature work is merged, the completed local-prototype implementation is on the `feature/passkey-removal-reauth` branch:

```bash
git switch feature/passkey-removal-reauth
```

### 2. Configure the database

The project uses a local PostgreSQL database and Prisma configuration (`prisma7.config.ts`). Ensure your local `.env` and Prisma configuration reference the **same running database**. Database credentials and other secrets must remain local and must not be committed to Git.

For the project's Prisma-managed development database, start it in a **separate terminal**:

```bash
npx prisma dev
```

Leave that terminal running. Follow any connection/configuration instructions printed by Prisma. Local ports and connection details can differ between machines.

In another terminal, apply the existing migrations and generate the Prisma Client:

```bash
npx prisma migrate dev
npx prisma generate
npx prisma migrate status
```

Do **not** use `prisma migrate reset` on a database containing accounts you need to preserve.

### 3. Start the application

```bash
npm run dev
```

Open **http://localhost:3000**.

Optional: inspect your local data using Prisma Studio:

```bash
npx prisma studio
```

Use the URL printed by Prisma Studio rather than assuming a fixed port.

### Daily development startup

Once dependencies, configuration, and migrations are set up, the usual startup sequence is:

1. `npx prisma dev` — database terminal (keep running).
2. `npm run dev` — application terminal (keep running).
3. `npx prisma studio` — optional database viewer.

Avoid starting duplicate development servers; use the existing running process or stop it before starting another.

## Main application routes

| Page | Purpose |
| --- | --- |
| `/register` | Create a pseudonymous account with a passkey |
| `/login` | Sign in with an existing passkey |
| `/dashboard` | Authenticated account overview |
| `/dashboard/passkeys` | Add and remove passkeys |
| `/dashboard/privacy` | Review stored metadata, export data, or request account deletion |

## API overview

| Endpoint | Purpose |
| --- | --- |
| `POST /api/webauthn/register/options` | Begin registration |
| `POST /api/webauthn/register/verify` | Verify registration |
| `POST /api/webauthn/login/options` | Issue a login challenge |
| `POST /api/webauthn/login/verify` | Verify a login assertion and create a session |
| `POST /api/webauthn/passkeys/add/options` | Begin adding a passkey to an existing account |
| `POST /api/webauthn/passkeys/add/verify` | Verify and save the additional passkey |
| `POST /api/webauthn/passkeys/remove/options` | Issue a passkey-removal challenge |
| `POST /api/webauthn/passkeys/remove` | Verify fresh authentication and remove a passkey |
| `GET /api/privacy/export` | Export the signed-in user's selected account metadata |
| `POST /api/privacy/delete/options` | Issue an account-deletion challenge |
| `POST /api/privacy/delete` | Verify fresh authentication and delete the account |
| `POST /api/auth/logout` | End the browser's authenticated session |

These are application-internal endpoints, not a publicly supported API contract.

## Security and privacy design

- **WebAuthn:** Challenge-based, origin- and relying-party-bound cryptographic verification with user verification required in sensitive flows.
- **Challenge replay protection:** Expiring challenge records and single-use consumption, with transactional checks for security-sensitive mutations.
- **Ownership checks:** Passkey management, data export, and account deletion derive the current user from the authenticated session, not an arbitrary browser-supplied user ID.
- **Session cookies:** HTTP-only, `SameSite=Lax` cookies, with the `Secure` attribute enabled in production mode; token hashes, rather than raw tokens, are stored in the database.
- **Account safety:** The final registered passkey cannot be removed through passkey management. Full account deletion requires separate, fresh passkey verification.
- **Data minimization:** The current application schema does not require a real name, email address, password, or biometric template.
- **Controlled export:** The JSON download contains selected metadata, **not** raw authentication credentials or a complete database backup.

**Important:** Pseudonymous does not mean fully anonymous. Credential identifiers, account IDs, IP addresses in infrastructure logs, and browser/provider records may still be identifying. Account deletion removes the application's related database records; it does not automatically erase a saved passkey from a browser/passkey provider or remove external logs or backups.

## Testing and verification

Run all automated tests:

```bash
npx vitest run
```

Run TypeScript, lint, and production-build checks:

```bash
npx tsc --noEmit
npm run lint
npm run build
```

Run them sequentially if desired:

```bash
npx vitest run && npx tsc --noEmit && npm run lint && npm run build
```

**Latest recorded local results (October 2026):** Six test suites, **50/50 tests passed**; TypeScript, ESLint, and the optimized Next.js build completed successfully.

The test suites cover login challenge options, login verification, passkey removal, metadata export, account-deletion options, and verified account deletion. These are primarily mocked API tests and should be supplemented with end-to-end and adversarial testing.

### Manual demo checklist

1. Register a new account with a passkey and sign in.
2. Add a second credential using a different authenticator/provider.
3. Remove the second credential after a fresh passkey assertion; confirm the last credential remains protected.
4. Open Privacy Settings and download the JSON metadata export.
5. **Using a separate, disposable account only**, verify passkey-protected deletion, then confirm the deleted account can no longer access protected pages.

The local development flow has been manually exercised with Safari/Apple Passwords and Chrome. Never test irreversible account deletion using an account you need to keep.

## Project structure

```text
prisma/
  schema.prisma              # User, Passkey, Session, challenge models
  migrations/               # Database migration history
src/
  app/
    api/
      auth/                 # Logout
      privacy/              # Data export and account deletion
      webauthn/             # Registration, login, passkey management
    dashboard/
      passkeys/             # Passkey management interface
      privacy/              # Privacy and account deletion interface
    login/                   # Sign-in UI
    register/                # Registration UI
  lib/
    prisma.ts                # Database client
    session.ts               # Session operations
```

## Known limitations / before public deployment

This repository is a **local security prototype**. Before accepting real users or deploying publicly, at minimum:

- Replace hard-coded `localhost` relying-party ID and WebAuthn origin with carefully validated environment-specific configuration; use HTTPS in production.
- Replace the prototype's **database-wide login-challenge quota** with reliable per-client abuse controls and verification-endpoint limits. The current shared quota is not a complete production rate limiter and can be exhausted by another client.
- Perform an independent security review of all registration, authentication, authorization, replay, concurrency, and account-deletion paths.
- Add comprehensive browser end-to-end tests, negative-path tests, monitoring, and retention/cleanup policies for sessions and expired challenges.
- Document deployment, database backups, incident handling, privacy/logging practices, and a safe recovery strategy for lost passkeys.
- Validate production secrets, database permissions, secure transport, proxy/header trust, and cookie behavior under the actual hosting setup.

## Repository

[Privacy Auth System on GitHub](https://github.com/Chatuminie/privacy-auth-system)

Built as a hands-on exploration of passwordless authentication, secure session management, and privacy-conscious account lifecycle design.
