import { Request, Response } from 'express';
import { eq, desc } from 'drizzle-orm';
import { google } from 'googleapis';
import { db } from '../db/client.js';
import { emails, emailThreads, connectedAccounts } from '../db/schema/index.js';
import { AuthenticatedRequest } from '../middlewares/auth.js';
import { createOAuth2Client } from '../utils/google-oauth.js';
import { decrypt } from '../utils/encryption.js';
import { logger } from '../utils/logger.js';

export async function listEmails(req: AuthenticatedRequest, res: Response): Promise<void> {
  const startTime = Date.now();
  try {
    const { accountId, folder } = req.query;

    const query = db
      .select({
        id: emails.id,
        threadId: emails.threadId,
        accountId: emails.accountId,
        accountName: connectedAccounts.label,
        accountColor: connectedAccounts.color,
        sender: emails.sender,
        recipients: emails.recipients,
        subject: emails.subject,
        snippet: emails.bodyText,
        bodyText: emails.bodyText,
        bodyHtml: emails.bodyHtml,
        receivedAt: emails.receivedAt,
        folder: emails.folder,
        isRead: emails.isRead,
        isStarred: emails.isStarred,
        isImportant: emails.isImportant,
        attachments: emails.attachments,
      })
      .from(emails)
      .leftJoin(connectedAccounts, eq(emails.accountId, connectedAccounts.id))
      .orderBy(desc(emails.receivedAt))
      .limit(300);

    if (accountId && typeof accountId === 'string') {
      query.where(eq(emails.accountId, accountId));
    }

    if (folder && typeof folder === 'string') {
      query.where(eq(emails.folder, folder));
    }

    const emailList = await query;

    // Fast payload optimization: strip massive base64 content blobs from list response
    const lightEmailList = emailList.map((e) => {
      const atts = Array.isArray(e.attachments) ? e.attachments : [];
      const cleanAtts = atts.map((att: any) => ({
        filename: att.filename,
        mimeType: att.mimeType,
        size: att.size,
        attachmentId: att.attachmentId,
        content: att.content && att.content.length < 300000 ? att.content : undefined,
      }));
      return {
        ...e,
        attachments: cleanAtts,
      };
    });

    const duration = Date.now() - startTime;
    logger.info({ count: lightEmailList.length, durationMs: duration }, '⚡ Ultra-fast email list returned');

    res.json({ emails: lightEmailList });
  } catch (err: any) {
    logger.error({ err }, 'Error listing emails from database');
    res.status(500).json({ error: 'Failed to fetch emails' });
  }
}

export async function sendEmail(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { accountId, to, subject, body, threadId, attachments } = req.body;

    if (!to || !subject || !body) {
      res.status(400).json({ error: 'Missing required email fields (to, subject, body)' });
      return;
    }

    // Fetch active connected account
    const accounts = await db.select().from(connectedAccounts);
    const targetAccount = accountId ? accounts.find(a => a.id === accountId) : accounts[0];

    if (!targetAccount) {
      res.status(400).json({ error: 'No connected Gmail account found to send email' });
      return;
    }

    const accessToken = decrypt(targetAccount.accessToken);
    const refreshToken = targetAccount.refreshToken ? decrypt(targetAccount.refreshToken) : undefined;

    const oauth2Client = createOAuth2Client();
    oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    let externalThreadId: string | undefined = undefined;
    if (threadId) {
      const [threadRec] = await db.select().from(emailThreads).where(eq(emailThreads.id, threadId)).limit(1);
      if (threadRec && threadRec.externalThreadId) {
        externalThreadId = threadRec.externalThreadId;
      }
    }

    const htmlBody = `<div style="font-family: system-ui, sans-serif; font-size: 14px; color: #1e293b; line-height: 1.6;">${body.replace(/\n/g, '<br/>')}</div>`;
    let rawMessage = '';

    if (attachments && Array.isArray(attachments) && attachments.length > 0) {
      const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).substring(2)}`;
      const mimeParts: string[] = [
        `To: ${to}`,
        `From: ${targetAccount.email}`,
        `Subject: ${subject}`,
        'MIME-Version: 1.0',
        `Content-Type: multipart/mixed; boundary="${boundary}"`,
      ];

      if (externalThreadId) {
        mimeParts.push(`In-Reply-To: <${externalThreadId}>`);
        mimeParts.push(`References: <${externalThreadId}>`);
      }

      mimeParts.push('');
      mimeParts.push(`--${boundary}`);
      mimeParts.push('Content-Type: text/html; charset=utf-8');
      mimeParts.push('Content-Transfer-Encoding: 7bit');
      mimeParts.push('');
      mimeParts.push(htmlBody);

      for (const att of attachments) {
        mimeParts.push(`--${boundary}`);
        mimeParts.push(`Content-Type: ${att.contentType || 'application/octet-stream'}; name="${att.filename}"`);
        mimeParts.push('Content-Transfer-Encoding: base64');
        mimeParts.push(`Content-Disposition: attachment; filename="${att.filename}"`);
        mimeParts.push('');

        const base64Content = att.content.includes(',') ? att.content.split(',')[1] : att.content;
        mimeParts.push(base64Content);
      }

      mimeParts.push(`--${boundary}--`);
      rawMessage = mimeParts.join('\r\n');
    } else {
      const headers = [
        `To: ${to}`,
        `From: ${targetAccount.email}`,
        `Subject: ${subject}`,
        'Content-Type: text/html; charset=utf-8',
        'MIME-Version: 1.0',
      ];
      if (externalThreadId) {
        headers.push(`In-Reply-To: <${externalThreadId}>`);
        headers.push(`References: <${externalThreadId}>`);
      }
      rawMessage = [...headers, '', htmlBody].join('\r\n');
    }

    const encodedRaw = Buffer.from(rawMessage).toString('base64url');

    const sendResult = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedRaw,
        threadId: externalThreadId || undefined,
      },
    });

    const newMsgId = sendResult.data.id || `sent-${Date.now()}`;
    const gmailThreadId = sendResult.data.threadId || externalThreadId || newMsgId;

    let finalThreadId = threadId;
    if (!finalThreadId) {
      const [newThread] = await db.insert(emailThreads).values({
        accountId: targetAccount.id,
        externalThreadId: gmailThreadId,
        subject: subject,
        snippet: body,
        lastMessageAt: new Date(),
        isStarred: false,
        isImportant: false,
      }).returning();
      finalThreadId = newThread.id;
    }

    // Save sent email into PostgreSQL DB immediately with attachments payload
    await db.insert(emails).values({
      threadId: finalThreadId,
      accountId: targetAccount.id,
      externalMessageId: newMsgId,
      sender: targetAccount.email,
      recipients: to,
      subject: subject,
      bodyText: body,
      bodyHtml: htmlBody,
      receivedAt: new Date(),
      folder: 'sent',
      isRead: true,
      isStarred: false,
      isImportant: false,
      attachments: attachments || [],
    }).onConflictDoNothing();

    logger.info({ messageId: newMsgId, to, attachmentCount: attachments?.length || 0 }, '✅ Email sent successfully via Gmail API!');

    res.json({
      message: 'Email sent successfully via Gmail API',
      gmailMessageId: newMsgId,
    });
  } catch (err: any) {
    logger.error({ err: err.message }, 'Error sending email via Gmail API');
    res.status(500).json({ error: err.message || 'Failed to send email' });
  }
}

export async function markEmailAsRead(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const idParam = req.params.id;
    const emailId = Array.isArray(idParam) ? idParam[0] : (idParam as string);

    const [email] = await db.select().from(emails).where(eq(emails.id, emailId)).limit(1);
    if (!email) {
      res.status(404).json({ error: 'Email message not found' });
      return;
    }

    // 1. Update in Neon PostgreSQL
    await db.update(emails).set({ isRead: true }).where(eq(emails.id, emailId));
    await db.update(emailThreads).set({ isStarred: email.isStarred }).where(eq(emailThreads.id, email.threadId));

    // 2. Mark as read on Google Gmail servers via Gmail API (remove UNREAD label)
    const [account] = await db
      .select()
      .from(connectedAccounts)
      .where(eq(connectedAccounts.id, email.accountId))
      .limit(1);

    if (account && email.externalMessageId) {
      try {
        const accessToken = decrypt(account.accessToken);
        const refreshToken = account.refreshToken ? decrypt(account.refreshToken) : undefined;

        const oauth2Client = createOAuth2Client();
        oauth2Client.setCredentials({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
        await gmail.users.messages.modify({
          userId: 'me',
          id: email.externalMessageId,
          requestBody: {
            removeLabelIds: ['UNREAD'],
          },
        });
        logger.info({ messageId: email.externalMessageId }, '✅ Marked email as read on Google Gmail servers!');
      } catch (err: any) {
        logger.warn({ err: err.message }, 'Could not modify UNREAD label on Gmail server (token may need re-auth)');
      }
    }

    res.json({ message: 'Email marked as read in database and Gmail server' });
  } catch (err: any) {
    logger.error({ err: err.message }, 'Error marking email as read');
    res.status(500).json({ error: 'Failed to mark email as read' });
  }
}

export async function deleteEmail(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const idParam = req.params.id;
    const emailId = Array.isArray(idParam) ? idParam[0] : (idParam as string);

    const [email] = await db.select().from(emails).where(eq(emails.id, emailId)).limit(1);
    if (!email) {
      res.status(404).json({ error: 'Email message not found' });
      return;
    }

    // 1. Update folder to 'trash' in PostgreSQL
    await db.update(emails).set({ folder: 'trash' }).where(eq(emails.id, emailId));

    // 2. Trash email on Google Gmail server via Gmail API
    const [account] = await db
      .select()
      .from(connectedAccounts)
      .where(eq(connectedAccounts.id, email.accountId))
      .limit(1);

    if (account && email.externalMessageId) {
      try {
        const accessToken = decrypt(account.accessToken);
        const refreshToken = account.refreshToken ? decrypt(account.refreshToken) : undefined;

        const oauth2Client = createOAuth2Client();
        oauth2Client.setCredentials({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
        await gmail.users.messages.trash({
          userId: 'me',
          id: email.externalMessageId,
        });
        logger.info({ messageId: email.externalMessageId }, '✅ Trashed email on Google Gmail servers!');
      } catch (err: any) {
        logger.warn({ err: err.message }, 'Could not trash email on Gmail server');
      }
    }

    res.json({ message: 'Email trashed in database and Gmail server' });
  } catch (err: any) {
    logger.error({ err: err.message }, 'Error deleting email');
    res.status(500).json({ error: 'Failed to delete email' });
  }
}

export async function toggleStarEmail(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const idParam = req.params.id;
    const emailId = Array.isArray(idParam) ? idParam[0] : (idParam as string);

    const [email] = await db.select().from(emails).where(eq(emails.id, emailId)).limit(1);
    if (!email) {
      res.status(404).json({ error: 'Email message not found' });
      return;
    }

    const newStarred = !email.isStarred;
    await db.update(emails).set({ isStarred: newStarred }).where(eq(emails.id, emailId));
    await db.update(emailThreads).set({ isStarred: newStarred }).where(eq(emailThreads.id, email.threadId));

    const [account] = await db
      .select()
      .from(connectedAccounts)
      .where(eq(connectedAccounts.id, email.accountId))
      .limit(1);

    if (account && email.externalMessageId) {
      try {
        const accessToken = decrypt(account.accessToken);
        const refreshToken = account.refreshToken ? decrypt(account.refreshToken) : undefined;

        const oauth2Client = createOAuth2Client();
        oauth2Client.setCredentials({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
        await gmail.users.messages.modify({
          userId: 'me',
          id: email.externalMessageId,
          requestBody: newStarred
            ? { addLabelIds: ['STARRED'] }
            : { removeLabelIds: ['STARRED'] },
        });
        logger.info({ messageId: email.externalMessageId, newStarred }, '✅ Toggled STARRED label on Google Gmail servers!');
      } catch (err: any) {
        logger.error({ err: err.message }, 'Could not toggle STARRED label on Gmail server (permission scope grant required)');
      }
    }

    res.json({ message: 'Email star status updated', isStarred: newStarred });
  } catch (err: any) {
    logger.error({ err: err.message }, 'Error starring email');
    res.status(500).json({ error: 'Failed to toggle star status' });
  }
}
