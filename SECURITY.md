# Security Policy

Streamline is built on a **defense-in-depth, bank-grade security architecture**. We treat security, multi-tenant isolation, and data privacy as fundamental system requirements.

---

## 1. Supported Versions

Security updates and critical patches are actively applied to the following release streams:

| Version | Supported | Notes |
|---|---|---|
| `1.x.x` (Current Main) | :white_check_mark: | Fully supported with active security monitoring |
| `< 1.0.0` | :x: | Development iterations prior to 1.0 are deprecated |

---

## 2. Core Security Architecture & Safeguards

Streamline enforces strict boundary protections across every tier of the application:

1. **Cryptographic Token Protection (AES-256-GCM)**:
   - All external provider OAuth credentials (access tokens, refresh tokens) are encrypted at rest using AES-256-GCM with 96-bit random IVs and 128-bit authentication tags.
   - Zero-downtime key rotation is supported via multi-version keyrings (`v1`, `v2`, etc.) and the `reencrypt()` background migration utility.

2. **Dual-Boundary Policy Gatekeeper for Autonomous AI**:
   - High-impact AI actions (sending emails, modifying calendar events, deleting records) require explicit human approval via the Policy Gatekeeper.
   - Pending actions are stored with cryptographically verified idempotency keys, strict 24-hour expiration TTLs, and atomic database state transitions (`pending` -> `executing` -> `executed`).

3. **Query-Level Multi-Tenant Isolation (Anti-IDOR)**:
   - Every database query in repositories filters strictly by authenticated `userId` and/or user-owned `accountId`s directly in SQL clauses.
   - Cross-tenant data leakage is prevented at the data access layer, independent of controller parameters.

4. **CSRF & Cookie Protection**:
   - Double-submit cookie verification (`X-CSRF-Token` matched against `csrf_token` cookie) is enforced on all state-modifying requests (POST, PUT, PATCH, DELETE) when session cookies are used.
   - Cookies are configured with `HttpOnly`, `SameSite=Strict`, and `Secure` (in production).

5. **Two-Tier Rate Limiting**:
   - IP-level rate limiting (60 requests/minute) protects against unauthenticated abuse and DDoS attempts.
   - User-level rate limiting (120 requests/minute) governs authenticated API traffic, with strict limits on email delivery and sync triggers.

6. **Content Security Policy (CSP) & XSS Defenses**:
   - Strict HTTP response headers via Helmet enforce `frame-ancestors 'none'` to block iframe clickjacking, `object-src 'none'`, and restrict script execution.
   - Client email body rendering strictly purges script execution vectors, event handlers, and javascript URIs via DOMPurify before DOM injection.

7. **Secrets Scanning & Leak Prevention**:
   - Pre-commit scanning hooks and `.gitleaks.toml` patterns verify staged commits to prevent API keys (`AIza...`, `sk-...`), JWT secrets, and database credentials from entering git history.

8. **Comprehensive Audit Trails**:
   - Critical authentication, token refresh, and agent tool execution events are logged to the immutable `audit_logs` table with user IDs, timestamps, and contextual metadata.

---

## 3. Reporting a Vulnerability

We take all security vulnerability reports seriously. If you believe you have discovered a vulnerability in Streamline, please report it responsibly so we can investigate and patch it promptly before public disclosure.

### How to Report:
- **Email**: `security@streamline.internal` (or submit a confidential security advisory on GitHub).
- **PGP Key**: If transmitting sensitive logs or proofs-of-concept, please request our PGP public key.

### What to Include:
1. **Description**: Clear description of the vulnerability and its potential impact.
2. **Steps to Reproduce**: A minimal proof-of-concept (PoC) or step-by-step reproduction instructions.
3. **Affected Components**: Specific endpoints, files, or packages involved.
4. **Proposed Fix**: Any suggested mitigations (if available).

### What NOT to Do:
- Do NOT test vulnerabilities against production users or perform destructive data operations.
- Do NOT execute Denial of Service (DoS) attacks against live infrastructure.
- Do NOT publicly disclose the issue until our team has confirmed and released a patch.

---

## 4. Response SLA & Disclosure Timeline

- **Initial Acknowledgment**: Within **24 hours** of receipt.
- **Triage & Severity Assessment**: Within **48 hours**.
- **Fix & Patch Deployment**: Critical vulnerabilities are patched within **72 hours**; high severity within **7 days**.
- **Coordinated Disclosure**: We collaborate with reporters on coordinated disclosure after fixes are released.
