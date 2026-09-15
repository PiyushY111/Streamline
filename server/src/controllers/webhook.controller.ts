import { Request, Response } from 'express';
import { logger } from '../utils/logger.js';
import { googlePubSubService, PubSubPushPayload } from '../services/google/pubsub.service.js';
import { toError } from '../utils/errors.js';

export const handleGmailPushWebhook = async (req: Request, res: Response): Promise<void> => {
  try {
    // Optional verification token check
    const verificationToken = process.env.PUBSUB_VERIFICATION_TOKEN;
    if (verificationToken) {
      const token = req.query.token || req.headers['x-pubsub-token'];
      if (token !== verificationToken) {
        logger.warn('Pub/Sub push webhook received with invalid verification token');
        res.status(403).send('Invalid verification token');
        return;
      }
    }

    let payload: PubSubPushPayload | null = null;

    // Google Pub/Sub sends { message: { data: "<base64>", messageId: "..." } }
    if (req.body?.message?.data) {
      const rawString = Buffer.from(req.body.message.data, 'base64').toString('utf-8');
      try {
        payload = JSON.parse(rawString);
      } catch (parseErr: unknown) {
        const error = toError(parseErr);
        logger.error({ parseErr: error, rawString }, 'Failed to parse decoded Pub/Sub JSON payload');
      }
    } else if (req.body?.emailAddress && req.body?.historyId) {
      // Direct testing format
      payload = {
        emailAddress: req.body.emailAddress,
        historyId: String(req.body.historyId),
      };
    }

    if (!payload || !payload.emailAddress) {
      logger.warn({ body: req.body }, 'Pub/Sub push webhook received unparseable or empty payload');
      // Always return 200 to prevent Google Pub/Sub from looping delivery retries on malformed messages
      res.status(200).send('Ignored: malformed message');
      return;
    }

    // Process push in background and respond immediately with 200 OK
    googlePubSubService
      .handlePubSubPush(payload)
      .catch((err: unknown) => {
        const error = toError(err);
        logger.error({ err: error.message, payload }, 'Error processing Pub/Sub push notification');
      });

    res.status(200).json({ received: true });
  } catch (err: unknown) {
    const error = toError(err);
    logger.error({ err: error.message }, 'Unexpected error in handleGmailPushWebhook');
    // Return 200 so Pub/Sub does not flood with retries
    res.status(200).send('Internal processing error, acknowledged');
  }
};
