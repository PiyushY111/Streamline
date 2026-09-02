import React from 'react';
import { EmailData } from '@/lib/api';
import { SanitizedEmailBody } from './SanitizedEmailBody';

interface ThreadBodyProps {
  email: EmailData;
}

export function ThreadBody({ email }: ThreadBodyProps) {
  return (
    <div className="p-6 text-sm text-gray-800 dark:text-gray-200 leading-relaxed space-y-4">
      <SanitizedEmailBody
        html={email.bodyHtml}
        text={email.bodyText || email.snippet}
      />
    </div>
  );
}
