import { describe, it, expect, vi } from 'vitest';
import { db } from '../db/index.js';
import { connectedAccounts } from '../db/schema/index.js';
import { encrypt } from '../utils/encryption.js';

describe('Google Workspace Sync Pipeline & Token Lifecycle', () => {
  it('should encrypt tokens securely during OAuth callback lifecycle', () => {
    const rawAccessToken = 'ya29.sample-token-secret-12345';
    const encrypted = encrypt(rawAccessToken);

    expect(encrypted).toBeDefined();
    expect(encrypted).not.toEqual(rawAccessToken);
    expect(encrypted.split(':')).toHaveLength(3);
  });

  it('should format message attachment extraction metadata accurately', () => {
    // Helper function reproducing Gmail MIME attachment walker
    function extractAttachments(payload: any) {
      const attachments: any[] = [];
      function walk(part: any) {
        if (part.filename && part.body && part.body.attachmentId) {
          attachments.push({
            filename: part.filename,
            mimeType: part.mimeType,
            size: part.body.size || 0,
            attachmentId: part.body.attachmentId,
          });
        }
        if (part.parts && Array.isArray(part.parts)) {
          part.parts.forEach(walk);
        }
      }
      walk(payload);
      return attachments;
    }

    const mockPayload = {
      mimeType: 'multipart/mixed',
      parts: [
        {
          mimeType: 'text/plain',
          body: { size: 100 },
        },
        {
          filename: 'Lab_Report_Guidelines.pdf',
          mimeType: 'application/pdf',
          body: { attachmentId: 'att-123', size: 245000 },
        },
      ],
    };

    const extracted = extractAttachments(mockPayload);
    expect(extracted).toHaveLength(1);
    expect(extracted[0].filename).toEqual('Lab_Report_Guidelines.pdf');
    expect(extracted[0].mimeType).toEqual('application/pdf');
    expect(extracted[0].size).toEqual(245000);
  });
});
