import { google } from 'googleapis';
import { db } from '../../db/index.js';
import { emails, emailThreads, connectedAccounts, syncStates } from '../../db/schema/index.js';
import { eq, and, inArray } from 'drizzle-orm';
import { logger } from '../../utils/logger.js';
import { createOAuth2Client } from '../../utils/google-oauth.js';
import { decrypt, encrypt } from '../../utils/encryption.js';
import { emailsRepository } from '../../repositories/emails.repository.js';
import { delCache } from '../cache.service.js';
import { auditService } from '../audit.service.js';
import { aiTriageQueue } from '../../queues/index.js';


function decodeBase64(data: string): string {
  try {
    const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
    return Buffer.from(base64, 'base64').toString('utf-8');
  } catch {
    return '';
  }
}

function extractEmailBodies(payload: any): { bodyText: string; bodyHtml: string } {
  let bodyText = '';
  let bodyHtml = '';

  function walk(part: any) {
    if (!part) return;
    const mime = part.mimeType?.toLowerCase() || '';
    if (mime === 'text/html' && part.body?.data) {
      bodyHtml += decodeBase64(part.body.data);
    } else if (mime === 'text/plain' && part.body?.data) {
      bodyText += decodeBase64(part.body.data);
    }
    if (part.parts && Array.isArray(part.parts)) {
      for (const subPart of part.parts) walk(subPart);
    }
  }

  walk(payload);
  if (!bodyText && !bodyHtml && payload?.body?.data) {
    const mime = payload.mimeType?.toLowerCase() || '';
    const decoded = decodeBase64(payload.body.data);
    if (mime === 'text/html') bodyHtml = decoded;
    else bodyText = decoded;
  }
  return { bodyText, bodyHtml };
}

function extractAttachments(payload: any): Array<{ filename: string; mimeType: string; size: number; attachmentId?: string }> {
  const attachments: Array<{ filename: string; mimeType: string; size: number; attachmentId?: string }> = [];
  function walk(part: any) {
    if (!part) return;
    if (part.filename && part.filename.length > 0) {
      attachments.push({
        filename: part.filename,
        mimeType: part.mimeType || 'application/octet-stream',
        size: part.body?.size || 0,
        attachmentId: part.body?.attachmentId,
      });
    }
    if (part.parts && Array.isArray(part.parts)) {
      for (const subPart of part.parts) walk(subPart);
    }
  }
  walk(payload);
  return attachments;
}

import { googleTokenManager } from './token-manager.service.js';

export async function getGmailClientForAccount(accountId: string) {
  return googleTokenManager.getGmailClient(accountId);
}

export async function syncGmailMessages(oauth2Client: any, accountId: string): Promise<number> {
  const clientData = await getGmailClientForAccount(accountId);
  const gmail = clientData ? clientData.gmail : google.gmail({ version: 'v1', auth: oauth2Client });

  // Fetch all messages from past 30 days using Gmail query with pagination
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const yyyy = thirtyDaysAgo.getFullYear();
  const mm = String(thirtyDaysAgo.getMonth() + 1).padStart(2, '0');
  const dd = String(thirtyDaysAgo.getDate()).padStart(2, '0');
  const q = `after:${yyyy}/${mm}/${dd}`;

  let pageToken: string | undefined = undefined;
  let allMessageMetas: any[] = [];

  do {
    const listRes: any = await gmail.users.messages.list({
      userId: 'me',
      q,
      maxResults: 500,
      pageToken,
    });
    const metas = listRes.data.messages || [];
    allMessageMetas.push(...metas);
    pageToken = listRes.data.nextPageToken || undefined;
  } while (pageToken);

  if (allMessageMetas.length === 0) return 0;

  const batchSize = 25;
  let syncedCount = 0;
  const newEmailIds: string[] = [];


  for (let i = 0; i < allMessageMetas.length; i += batchSize) {
    const chunk = allMessageMetas.slice(i, i + batchSize);
    const fullMessages = await Promise.all(
      chunk.map(async (meta: any) => {
        try {
          const res = await gmail.users.messages.get({
            userId: 'me',
            id: meta.id,
            format: 'full',
          });
          return res.data;
        } catch (e) {
          return null;
        }
      })
    );

    for (const msg of fullMessages) {
      if (!msg || !msg.id) continue;

      const headers = msg.payload?.headers || [];
      const getHeader = (name: string) => headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || '';

      const subject = getHeader('subject') || '(No Subject)';
      const from = getHeader('from') || 'Unknown Sender';
      const to = getHeader('to') || '';
      const cc = getHeader('cc') || undefined;
      const bcc = getHeader('bcc') || undefined;
      const dateHeader = getHeader('date');
      const receivedAt = dateHeader ? new Date(dateHeader) : new Date(parseInt(msg.internalDate || `${Date.now()}`, 10));

      const labelIds: string[] = msg.labelIds || [];
      const isRead = !labelIds.includes('UNREAD');
      const isStarred = labelIds.includes('STARRED');
      const isImportant = labelIds.includes('IMPORTANT');

      let folder = 'inbox';
      if (labelIds.includes('TRASH')) folder = 'trash';
      else if (labelIds.includes('SPAM')) folder = 'spam';
      else if (labelIds.includes('SENT')) folder = 'sent';
      else if (labelIds.includes('DRAFT')) folder = 'drafts';

      let category = 'primary';
      if (labelIds.includes('CATEGORY_PROMOTIONS')) category = 'promotions';
      else if (labelIds.includes('CATEGORY_SOCIAL')) category = 'social';
      else if (labelIds.includes('CATEGORY_UPDATES')) category = 'updates';

      const { bodyText, bodyHtml } = extractEmailBodies(msg.payload);
      const attachments = extractAttachments(msg.payload);

      const externalThreadId = msg.threadId || msg.id;

      let [thread] = await db
        .select()
        .from(emailThreads)
        .where(and(eq(emailThreads.accountId, accountId), eq(emailThreads.externalThreadId, externalThreadId)))
        .limit(1);

      if (!thread) {
        [thread] = await db
          .insert(emailThreads)
          .values({
            accountId,
            externalThreadId,
            subject,
            snippet: msg.snippet || bodyText.substring(0, 100),
            lastMessageAt: receivedAt,
            isStarred,
            isImportant,
          })
          .returning();
      }

      const [insertedEmail] = await db.insert(emails).values({
        threadId: thread.id,
        accountId,
        externalMessageId: msg.id,
        sender: from,
        recipients: to,
        cc,
        bcc,
        subject,
        bodyText,
        bodyHtml,
        receivedAt,
        folder,
        category,
        isRead,
        isStarred,
        isImportant,
        attachments,
      }).onConflictDoNothing().returning({ id: emails.id });

      if (insertedEmail) {
        newEmailIds.push(insertedEmail.id);
      }

      syncedCount++;
    }
  }

  if (newEmailIds.length > 0) {
    try {
      await aiTriageQueue.add('triage-batch', { emailIds: newEmailIds, accountId });
      logger.info({ accountId, count: newEmailIds.length }, 'Enqueued newly synced emails for AI triage');
    } catch (err: any) {
      logger.warn({ err: err.message }, 'Failed to enqueue emails to AI triage queue');
    }
  }

  logger.info({ accountId, syncedCount }, 'Gmail batch sync completed');
  return syncedCount;

}

export async function syncGmailMarkAsRead(emailId: string, userId: string, isRead: boolean) {
  const updated = await emailsRepository.markAsRead(emailId, userId, isRead);
  if (!updated) return null;

  if (updated.accountId && updated.externalMessageId) {
    try {
      const clientData = await getGmailClientForAccount(updated.accountId);
      if (clientData) {
        await clientData.gmail.users.messages.modify({
          userId: 'me',
          id: updated.externalMessageId,
          requestBody: {
            addLabelIds: isRead ? [] : ['UNREAD'],
            removeLabelIds: isRead ? ['UNREAD'] : [],
          },
        });
        logger.info({ emailId, isRead }, 'Successfully synced read status with Gmail API');
      }
    } catch (err) {
      logger.warn({ err, emailId }, 'Failed to sync read status with Gmail API');
    }
  }

  return updated;
}

export async function syncGmailToggleStar(emailId: string, userId: string, isStarred: boolean) {
  const updated = await emailsRepository.toggleStar(emailId, userId, isStarred);
  if (!updated) return null;

  if (updated.accountId && updated.externalMessageId) {
    try {
      const clientData = await getGmailClientForAccount(updated.accountId);
      if (clientData) {
        await clientData.gmail.users.messages.modify({
          userId: 'me',
          id: updated.externalMessageId,
          requestBody: {
            addLabelIds: isStarred ? ['STARRED'] : [],
            removeLabelIds: isStarred ? [] : ['STARRED'],
          },
        });
        logger.info({ emailId, isStarred }, 'Successfully synced star status with Gmail API');
      }
    } catch (err) {
      logger.warn({ err, emailId }, 'Failed to sync star status with Gmail API');
    }
  }

  return updated;
}

export async function syncGmailUpdateCategory(emailId: string, userId: string, category: string) {
  const updated = await emailsRepository.updateCategory(emailId, userId, category);
  if (!updated) return null;

  if (updated.accountId && updated.externalMessageId) {
    try {
      const clientData = await getGmailClientForAccount(updated.accountId);
      if (clientData) {
        const categoryLabelMap: Record<string, string> = {
          promotions: 'CATEGORY_PROMOTIONS',
          social: 'CATEGORY_SOCIAL',
          updates: 'CATEGORY_UPDATES',
          primary: 'CATEGORY_PERSONAL',
        };

        const addLabel = categoryLabelMap[category];
        const removeLabels = Object.values(categoryLabelMap).filter((l) => l !== addLabel);

        if (addLabel) {
          await clientData.gmail.users.messages.modify({
            userId: 'me',
            id: updated.externalMessageId,
            requestBody: {
              addLabelIds: [addLabel],
              removeLabelIds: removeLabels,
            },
          });
        }
        logger.info({ emailId, category }, 'Successfully synced category update with Gmail API');
      }
    } catch (err) {
      logger.warn({ err, emailId }, 'Failed to sync category with Gmail API');
    }
  }

  return updated;
}

export async function syncGmailDeleteEmail(emailId: string, userId: string) {
  const email = await emailsRepository.findById(emailId, userId);
  if (email && email.accountId && email.externalMessageId) {
    try {
      const clientData = await getGmailClientForAccount(email.accountId);
      if (clientData) {
        await clientData.gmail.users.messages.trash({
          userId: 'me',
          id: email.externalMessageId,
        });
        logger.info({ emailId }, 'Successfully trashed email on Gmail via Gmail API');
      }
    } catch (err) {
      logger.warn({ err, emailId }, 'Failed to trash email via Gmail API');
    }
  }

  return emailsRepository.deleteEmail(emailId, userId);
}

export async function syncGmailSendEmail(
  userId: string,
  data: { to: string; subject: string; body: string; accountId?: string }
) {
  let accountId = data.accountId;
  if (!accountId) {
    const [acc] = await db
      .select({ id: connectedAccounts.id })
      .from(connectedAccounts)
      .where(eq(connectedAccounts.userId, userId))
      .limit(1);
    if (acc) accountId = acc.id;
  }

  if (!accountId) {
    throw new Error('No connected Google account found. Please connect an account first.');
  }

  // Verify account belongs to requesting user
  const [userAcc] = await db
    .select({ id: connectedAccounts.id })
    .from(connectedAccounts)
    .where(and(eq(connectedAccounts.id, accountId), eq(connectedAccounts.userId, userId)))
    .limit(1);

  if (!userAcc) {
    throw new Error('Target connected account does not belong to the authenticated user.');
  }

  const clientData = await getGmailClientForAccount(accountId);
  let extMessageId = `local_sent_${Date.now()}`;

  if (clientData) {
    try {
      const rawMessage = [
        `To: ${data.to}`,
        `Subject: ${data.subject || ''}`,
        'Content-Type: text/plain; charset=utf-8',
        'MIME-Version: 1.0',
        '',
        data.body || '',
      ].join('\r\n');

      const encodedRaw = Buffer.from(rawMessage).toString('base64url');
      const res = await clientData.gmail.users.messages.send({
        userId: 'me',
        requestBody: { raw: encodedRaw },
      });
      if (res.data.id) {
        extMessageId = res.data.id;
      }
      logger.info({ to: data.to, messageId: extMessageId }, 'Successfully delivered email via Gmail API');
    } catch (err: any) {
      logger.error({ err, to: data.to }, 'Gmail API send email error');
      throw new Error(`Gmail API failed to send email: ${err.message}`);
    }
  }

  const sent = await emailsRepository.createSentEmail({
    userId,
    to: data.to,
    subject: data.subject,
    body: data.body,
    accountId,
    externalMessageId: extMessageId,
  });

  await auditService.logAction(userId, 'email.sent', {
    to: data.to,
    subject: data.subject,
    accountId,
    messageId: extMessageId,
  });

  return sent;
}
