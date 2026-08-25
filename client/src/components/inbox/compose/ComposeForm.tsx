import React from 'react';

interface ComposeFormProps {
  to: string;
  setTo: (val: string) => void;
  subject: string;
  setSubject: (val: string) => void;
  body: string;
  setBody: (val: string) => void;
}

export function ComposeForm({ to, setTo, subject, setSubject, body, setBody }: ComposeFormProps) {
  return (
    <div className="flex-1 flex flex-col p-3 space-y-2 bg-white dark:bg-gray-950">
      <input
        type="email"
        value={to}
        onChange={(e) => setTo(e.target.value)}
        placeholder="Recipients (To)"
        className="w-full text-xs py-1.5 px-2 border-b border-gray-200 dark:border-gray-800 bg-transparent focus:outline-none focus:border-blue-500 text-gray-900 dark:text-gray-100"
      />
      <input
        type="text"
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        placeholder="Subject"
        className="w-full text-xs py-1.5 px-2 border-b border-gray-200 dark:border-gray-800 bg-transparent focus:outline-none focus:border-blue-500 font-medium text-gray-900 dark:text-gray-100"
      />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Write your email here..."
        className="w-full flex-1 text-xs p-2 bg-transparent border-0 focus:outline-none resize-none text-gray-900 dark:text-gray-100"
      />
    </div>
  );
}
