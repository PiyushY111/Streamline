import { google } from 'googleapis';
import { db } from '../../db/index.js';
import { emails, emailThreads } from '../../db/schema/index.js';
import { eq, and } from 'drizzle-orm';
import { logger } from '../../utils/logger.js';

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

export async function syncGmailMessages(oauth2Client: any, accountId: string): Promise<number> {
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
  const messagesRes = await gmail.users.messages.list({ userId: 'me', maxResults: 50 });
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
      isRead,
      isStarred,
      isImportant,
      attachments: attachmentList,
    }).onConflictDoNothing();

    syncedCount++;
  }

  logger.info({ accountId, syncedCount }, 'Gmail messages sync completed');
  return syncedCount;
}
