import React from 'react';
import { EmailData } from '@/lib/api';

interface ThreadBodyProps {
  email: EmailData;
}

export function ThreadBody({ email }: ThreadBodyProps) {
  return (
    <div className="p-6 text-sm text-gray-800 dark:text-gray-200 leading-relaxed space-y-4">
      {email.bodyHtml ? (
        <div dangerouslySetInnerHTML={{ __html: email.bodyHtml }} />
      ) : (
        <p className="whitespace-pre-wrap">{email.bodyText || email.snippet}</p>
      )}
    </div>
  );
}
