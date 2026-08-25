import { eq, and } from 'drizzle-orm';
import { google } from 'googleapis';
import { db } from '../db/client.js';
import { connectedAccounts, emails, emailThreads, calendars, events } from '../db/schema/index.js';
import { createOAuth2Client } from '../utils/google-oauth.js';
import { decrypt } from '../utils/encryption.js';
import { logger } from '../utils/logger.js';

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
      for (const subPart of part.parts) {
        walk(subPart);
      }
    }
  }

  walk(payload);

  if (!bodyText && !bodyHtml && payload?.body?.data) {
    const mime = payload.mimeType?.toLowerCase() || '';
    const decoded = decodeBase64(payload.body.data);
    if (mime === 'text/html') {
      bodyHtml = decoded;
    } else {
      bodyText = decoded;
    }
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
      for (const subPart of part.parts) {
        walk(subPart);
      }
    }
  }

  walk(payload);
  return attachments;
}

export async function syncGoogleAccountData(accountId: string): Promise<void> {
  logger.info({ accountId }, 'Starting live Google data synchronization for account...');

  const [account] = await db
    .select()
    .from(connectedAccounts)
    .where(eq(connectedAccounts.id, accountId))
    .limit(1);

  if (!account) {
    throw new Error(`Connected account not found for ID: ${accountId}`);
  }

  const accessToken = decrypt(account.accessToken);
  const refreshToken = account.refreshToken ? decrypt(account.refreshToken) : undefined;

  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  try {
    // 1. Fetch Gmail Messages (Last 30 days window)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const query = `after:${Math.floor(thirtyDaysAgo.getTime() / 1000)}`;

    const listRes = await gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults: 150,
    });

    const messages = listRes.data.messages || [];
    logger.info({ count: messages.length, accountEmail: account.email }, 'Fetched recent Gmail message headers');

    for (const msgRef of messages) {
      if (!msgRef.id) continue;

      try {
        const msgRes = await gmail.users.messages.get({
          userId: 'me',
          id: msgRef.id,
          format: 'full',
        });

        const data = msgRes.data;
        if (!data || !data.id) continue;

        const externalThreadId = data.threadId || msgRef.id;
        const externalMessageId = data.id!;
        const payload = data.payload || {};
        const headers = payload.headers || [];

        const subjectHeader = headers.find((h) => h.name?.toLowerCase() === 'subject');
        const fromHeader = headers.find((h) => h.name?.toLowerCase() === 'from');
        const toHeader = headers.find((h) => h.name?.toLowerCase() === 'to');
        const dateHeader = headers.find((h) => h.name?.toLowerCase() === 'date');

        const subject = subjectHeader?.value || '(No Subject)';
        const sender = fromHeader?.value || 'Unknown Sender';
        const recipients = toHeader?.value || account.email;
        const snippet = data.snippet || '';

        const { bodyText, bodyHtml } = extractEmailBodies(payload);
        const parsedAttachments = extractAttachments(payload);

        let receivedAt = new Date();
        if (data.internalDate) {
          receivedAt = new Date(parseInt(data.internalDate, 10));
        } else if (dateHeader?.value) {
          receivedAt = new Date(dateHeader.value);
        }

        const labelIds = data.labelIds || [];
        const isRead = !labelIds.includes('UNREAD');
        const isStarred = labelIds.includes('STARRED');
        const isImportant = labelIds.includes('IMPORTANT');

        let folder = 'inbox';
        if (labelIds.includes('SENT')) folder = 'sent';
        else if (labelIds.includes('DRAFT')) folder = 'drafts';
        else if (labelIds.includes('TRASH') || labelIds.includes('SPAM')) folder = 'trash';
        else if (labelIds.includes('SNOOZED')) folder = 'snoozed';

        // Ensure emailThread exists in DB
        let threadRecord = (
          await db
            .select()
            .from(emailThreads)
            .where(
              and(
                eq(emailThreads.accountId, account.id),
                eq(emailThreads.externalThreadId, externalThreadId)
              )
            )
            .limit(1)
        )[0];

        if (!threadRecord) {
          const [newThread] = await db
            .insert(emailThreads)
            .values({
              accountId: account.id,
              externalThreadId,
              subject,
              snippet,
              lastMessageAt: receivedAt,
              isStarred,
              isImportant,
            })
            .returning();
          threadRecord = newThread;
        } else {
          await db
            .update(emailThreads)
            .set({
              subject,
              snippet,
              lastMessageAt: receivedAt,
              isStarred,
              isImportant,
            })
            .where(eq(emailThreads.id, threadRecord.id));
        }

        // Upsert Email record into DB
        const existingEmail = (
          await db
            .select()
            .from(emails)
            .where(
              and(
                eq(emails.accountId, account.id),
                eq(emails.externalMessageId, externalMessageId)
              )
            )
            .limit(1)
        )[0];

        if (existingEmail) {
          await db
            .update(emails)
            .set({
              subject,
              bodyText: bodyText || snippet,
              bodyHtml: bodyHtml || bodyText || snippet,
              folder,
              isRead,
              isStarred,
              isImportant,
              attachments: parsedAttachments,
              updatedAt: new Date(),
            })
            .where(eq(emails.id, existingEmail.id));
        } else {
          await db.insert(emails).values({
            threadId: threadRecord.id,
            accountId: account.id,
            externalMessageId,
            sender,
            recipients,
            subject,
            bodyText: bodyText || snippet,
            bodyHtml: bodyHtml || bodyText || snippet,
            receivedAt,
            folder,
            isRead,
            isStarred,
            isImportant,
            attachments: parsedAttachments,
          });
        }
      } catch (msgErr: any) {
        logger.warn({ err: msgErr.message, msgId: msgRef.id }, 'Error processing individual Gmail message');
      }
    }
  } catch (err: any) {
    logger.error({ err: err.message, accountId }, 'Failed to sync Gmail messages');
  }

  // 2. Fetch Calendar Events
  try {
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    const now = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(now.getDate() - 30);
    const thirtyDaysFuture = new Date();
    thirtyDaysFuture.setDate(now.getDate() + 30);

    const eventsRes = await calendar.events.list({
      calendarId: 'primary',
      timeMin: thirtyDaysAgo.toISOString(),
      timeMax: thirtyDaysFuture.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 250,
    });

    const calendarEventsList = eventsRes.data.items || [];
    logger.info({ count: calendarEventsList.length, accountEmail: account.email }, 'Fetched Google Calendar events');

    let [calRecord] = await db.select().from(calendars).where(eq(calendars.accountId, account.id)).limit(1);
    if (!calRecord) {
      [calRecord] = await db.insert(calendars).values({
        accountId: account.id,
        externalCalendarId: 'primary',
        name: 'Primary Calendar',
        isPrimary: true,
      }).returning();
    }

    for (const item of calendarEventsList) {
      if (!item.id) continue;

      const startStr = item.start?.dateTime || item.start?.date;
      const endStr = item.end?.dateTime || item.end?.date;
      if (!startStr || !endStr) continue;

      const startTime = new Date(startStr);
      const endTime = new Date(endStr);

      const existingCalEvent = (
        await db
          .select()
          .from(events)
          .where(
            and(
              eq(events.accountId, account.id),
              eq(events.externalEventId, item.id)
            )
          )
          .limit(1)
      )[0];

      if (existingCalEvent) {
        await db
          .update(events)
          .set({
            title: item.summary || '(No Title)',
            description: item.description || '',
            location: item.location || '',
            startTime,
            endTime,
            updatedAt: new Date(),
          })
          .where(eq(events.id, existingCalEvent.id));
      } else {
        await db.insert(events).values({
          calendarId: calRecord.id,
          accountId: account.id,
          externalEventId: item.id,
          title: item.summary || '(No Title)',
          description: item.description || '',
          location: item.location || '',
          startTime,
          endTime,
        });
      }
    }
  } catch (err: any) {
    logger.error({ err: err.message, accountId }, 'Failed to sync Google Calendar events');
  }

  logger.info({ accountId }, '✅ Google account sync completed successfully!');
}
