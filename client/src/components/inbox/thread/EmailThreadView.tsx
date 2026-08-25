import React, { useState } from 'react';
import { EmailData } from '@/lib/api';
import { ThreadHeader } from './ThreadHeader';
import { ThreadBody } from './ThreadBody';
import { InlineReplyForm } from './InlineReplyForm';

interface EmailThreadViewProps {
  email: EmailData;
  onBack: () => void;
  onStar: (id: string, isStarred: boolean) => void;
  onDelete: (id: string) => void;
}

export function EmailThreadView({ email, onBack, onStar, onDelete }: EmailThreadViewProps) {
  const [replyMode, setReplyMode] = useState<'reply' | 'forward'>('reply');
  const [replyText, setReplyText] = useState('');
  const [isSending, setIsSending] = useState(false);

  const handleSendReply = () => {
    if (!replyText.trim()) return;
    setIsSending(true);
    setTimeout(() => {
      setIsSending(false);
      setReplyText('');
      alert('Reply sent successfully!');
    }, 800);
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto bg-white dark:bg-gray-950">
      <ThreadHeader email={email} onBack={onBack} onStar={onStar} onDelete={onDelete} />
      <ThreadBody email={email} />
      <InlineReplyForm
        replyMode={replyMode}
        setReplyMode={setReplyMode}
        replyText={replyText}
        setReplyText={setReplyText}
        onSend={handleSendReply}
        isSending={isSending}
      />
    </div>
  );
}
