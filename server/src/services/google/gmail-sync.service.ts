import { google } from 'googleapis';
import { db } from '../../db/index.js';
import { emails, emailThreads, connectedAccounts } from '../../db/schema/index.js';
import { eq, and } from 'drizzle-orm';
import { logger } from '../../utils/logger.js';
import { createOAuth2Client } from '../../utils/google-oauth.js';
import { decrypt, encrypt } from '../../utils/encryption.js';
import { emailsRepository } from '../../repositories/emails.repository.js';

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

export async function getGmailClientForAccount(accountId: string) {
  const [account] = await db.select().from(connectedAccounts).where(eq(connectedAccounts.id, accountId)).limit(1);
  if (!account) return null;

  let accessToken = decrypt(account.accessToken);
  const refreshToken = account.refreshToken ? decrypt(account.refreshToken) : undefined;

  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
    expiry_date: account.tokenExpiresAt ? new Date(account.tokenExpiresAt).getTime() : undefined,
  });

  if (account.tokenExpiresAt && new Date(account.tokenExpiresAt).getTime() < Date.now() + 120000 && refreshToken) {
    try {
      logger.info({ accountId }, 'Google OAuth access token expired or expiring soon. Refreshing token...');
      const { credentials } = await oauth2Client.refreshAccessToken();
      if (credentials.access_token) {
        accessToken = credentials.access_token;
        oauth2Client.setCredentials(credentials);
        const newEncryptedAccess = encrypt(credentials.access_token);
        const newExpiresAt = new Date(credentials.expiry_date || Date.now() + 3600 * 1000);
        await db.update(connectedAccounts)
          .set({
            accessToken: newEncryptedAccess,
            tokenExpiresAt: newExpiresAt,
            updatedAt: new Date(),
          })
          .where(eq(connectedAccounts.id, accountId));
        logger.info({ accountId }, 'Google OAuth access token refreshed and updated successfully');
      }
    } catch (refreshErr) {
      logger.error({ refreshErr, accountId }, 'Failed to refresh Google OAuth token');
    }
  }

  return { gmail: google.gmail({ version: 'v1', auth: oauth2Client }), account, oauth2Client };
}

export async function syncGmailMessages(oauth2Client: any, accountId: string): Promise<number> {
  const clientData = await getGmailClientForAccount(accountId);
  const gmail = clientData ? clientData.gmail : google.gmail({ version: 'v1', auth: oauth2Client });

  const messagesRes = await gmail.users.messages.list({ userId: 'me', maxResults: 100 });
  const messageMetas = messagesRes.data.messages || [];

  if (messageMetas.length === 0) return 0;

  const fullMessages = await Promise.all(
    messageMetas.map(m => gmail.users.messages.get({ userId: 'me', id: m.id!, format: 'full' }))
  );

  let syncedCount = 0;
  for (const msgRes of fullMessages) {
    const msg = msgRes.data;
    if (!msg.id || !msg.threadId) continue;

    const headers = msg.payload?.headers || [];
    const getHeader = (name: string) => headers.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value || '';

    const subject = getHeader('Subject') || '(No Subject)';
    const sender = getHeader('From') || 'Unknown Sender';
    const recipients = getHeader('To') || '';
    const dateStr = getHeader('Date');
    const receivedAt = dateStr ? new Date(dateStr) : new Date();

    const { bodyText, bodyHtml } = extractEmailBodies(msg.payload);
    const attachmentList = extractAttachments(msg.payload);
    const labelIds = msg.labelIds || [];

    const isStarred = labelIds.includes('STARRED');
    const isImportant = labelIds.includes('IMPORTANT');
    const isRead = !labelIds.includes('UNREAD');

    let folder = 'inbox';
    if (labelIds.includes('TRASH')) folder = 'trash';
    else if (labelIds.includes('SENT')) folder = 'sent';
    else if (labelIds.includes('DRAFT')) folder = 'drafts';

    let category = 'primary';
    if (labelIds.includes('CATEGORY_PROMOTIONS')) {
      category = 'promotions';
    } else if (labelIds.includes('CATEGORY_SOCIAL')) {
      category = 'social';
    } else if (labelIds.includes('CATEGORY_UPDATES') || labelIds.includes('CATEGORY_FORUMS')) {
      category = 'updates';
    } else if (labelIds.includes('CATEGORY_PERSONAL')) {
      category = 'primary';
    } else {
      const senderLower = sender.toLowerCase();
      const subjectLower = subject.toLowerCase();
      if (
        senderLower.includes('no-reply') ||
        senderLower.includes('noreply') ||
        senderLower.includes('newsletter') ||
        senderLower.includes('marketing') ||
        subjectLower.includes('off') ||
        subjectLower.includes('sale') ||
        subjectLower.includes('discount') ||
        subjectLower.includes('deal') ||
        subjectLower.includes('subscription')
      ) {
        category = 'promotions';
      } else if (
        senderLower.includes('linkedin') ||
        senderLower.includes('twitter') ||
        senderLower.includes('facebook') ||
        senderLower.includes('instagram') ||
        senderLower.includes('github') ||
        senderLower.includes('youtube')
      ) {
        category = 'social';
      } else if (
        senderLower.includes('google') ||
        senderLower.includes('security') ||
        senderLower.includes('alert') ||
        senderLower.includes('notification') ||
        senderLower.includes('receipt') ||
        senderLower.includes('invoice') ||
        senderLower.includes('billing') ||
        subjectLower.includes('verify') ||
        subjectLower.includes('confirm')
      ) {
        category = 'updates';
      }
    }

    let threadDbId: string;
    const [existingThread] = await db.select().from(emailThreads)
      .where(and(eq(emailThreads.accountId, accountId), eq(emailThreads.externalThreadId, msg.threadId))).limit(1);

    if (existingThread) {
      threadDbId = existingThread.id;
    } else {
      const [newThread] = await db.insert(emailThreads).values({
        accountId,
        externalThreadId: msg.threadId,
        subject,
        snippet: msg.snippet || '',
        lastMessageAt: receivedAt,
        isStarred,
        isImportant,
      }).returning();
      threadDbId = newThread.id;
    }

    const [existingEmail] = await db.select().from(emails)
      .where(and(eq(emails.accountId, accountId), eq(emails.externalMessageId, msg.id))).limit(1);

    if (existingEmail) {
      await db.update(emails).set({
        isStarred,
        isRead,
        isImportant,
        folder,
        category,
        updatedAt: new Date(),
      }).where(eq(emails.id, existingEmail.id));
    } else {
      await db.insert(emails).values({
        threadId: threadDbId,
        accountId,
        externalMessageId: msg.id,
        sender,
        recipients,
        subject,
        bodyText,
        bodyHtml,
        receivedAt,
        folder,
        category,
        isRead,
        isStarred,
        isImportant,
        attachments: attachmentList,
      });
    }

    syncedCount++;
  }

  logger.info({ accountId, syncedCount }, 'Gmail messages sync completed');
  return syncedCount;
}

export async function syncGmailMarkAsRead(emailId: string, isRead: boolean) {
  const [email] = await db.select().from(emails).where(eq(emails.id, emailId)).limit(1);
  if (!email) return null;

  const [updated] = await db.update(emails)
    .set({ isRead, updatedAt: new Date() })
    .where(eq(emails.id, emailId))
    .returning();

  if (email.accountId && email.externalMessageId) {
    try {
      const clientData = await getGmailClientForAccount(email.accountId);
      if (clientData) {
        await clientData.gmail.users.messages.modify({
          userId: 'me',
          id: email.externalMessageId,
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

export async function syncGmailToggleStar(emailId: string, isStarred: boolean) {
  const [email] = await db.select().from(emails).where(eq(emails.id, emailId)).limit(1);
  if (!email) return null;

  const [updated] = await db.update(emails)
    .set({ isStarred, updatedAt: new Date() })
    .where(eq(emails.id, emailId))
    .returning();

  if (email.accountId && email.externalMessageId) {
    try {
      const clientData = await getGmailClientForAccount(email.accountId);
      if (clientData) {
        await clientData.gmail.users.messages.modify({
          userId: 'me',
          id: email.externalMessageId,
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

export async function syncGmailDeleteEmail(emailId: string) {
  const [email] = await db.select().from(emails).where(eq(emails.id, emailId)).limit(1);
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

  return db.delete(emails).where(eq(emails.id, emailId));
}

export async function syncGmailSendEmail(userId: string, data: { to: string; subject: string; body: string; accountId?: string }) {
  let accountId = data.accountId;
  if (!accountId) {
    const [acc] = await db.select({ id: connectedAccounts.id })
      .from(connectedAccounts)
      .where(eq(connectedAccounts.userId, userId))
      .limit(1);
    if (acc) accountId = acc.id;
  }

  if (!accountId) {
    throw new Error('No connected Google account found. Please connect an account first.');
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

  return emailsRepository.createSentEmail({
    userId,
    to: data.to,
    subject: data.subject,
    body: data.body,
    accountId,
    externalMessageId: extMessageId,
  });
}

