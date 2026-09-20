# ADR-0002: Application-Level AES-256-GCM Token Encryption over Cloud KMS

* **Status**: Accepted
* **Deciders**: Security & Architecture Team
* **Date**: 2026-08-18

---

## Context and Problem Statement

Streamline stores high-privilege Google OAuth `accessToken` and `refreshToken` credentials granting access to user mailboxes and calendars. Plaintext storage in PostgreSQL is unacceptable. We needed a cryptographic strategy that prevents token exposure in the event of a database dump or unauthorized read replica access.

---

## Alternatives Considered

1. **Cloud Key Management Service (AWS KMS / GCP Cloud KMS / HashiCorp Vault)**:
   * *Pros*: Hardware Security Modules (HSM), automated key rotation, strict IAM auditing.
   * *Cons*: Adds network roundtrip latency to every database decryption operation; introduces vendor lock-in and paid cloud dependencies for local open-source developers; requires active internet access during unit testing.
2. **Database-Level Transparent Data Encryption (TDE)**:
   * *Pros*: Automatic encryption at rest handled by the DB engine.
   * *Cons*: Does not protect against compromised database credentials or SQL injection, as data is decrypted automatically in query results.
3. **Application-Level AES-256-GCM (Chosen)**:
   * *Pros*: 
     * Authenticated encryption with associated data (AEAD) ensures both confidentiality and cryptographic integrity.
     * Unique 16-byte initialization vector (IV) generated via `crypto.randomBytes(16)` for every token write prevents identical ciphertext patterns.
     * Zero network latency overhead during worker batch processing.
     * 100% portable across local environments, Docker, Railway, Render, or any cloud provider with a single 32-byte master key (`ENCRYPTION_KEY`).

---

## Decision Outcome

**Chosen Option**: **Application-Level AES-256-GCM**.

### Security Properties Guaranteed:
* **Format**: `iv_hex:auth_tag_hex:ciphertext_hex`
* **Tamper Proofing**: Modifying even a single bit of ciphertext or tag causes decryption to fail immediately via `cipher.getAuthTag()`.
* **Zero Cloud Dependency**: Enables offline testing and self-hosted deployments while maintaining AES-256-GCM encryption at rest.
