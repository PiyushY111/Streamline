'use client';

import React, { useMemo } from 'react';
import DOMPurify from 'dompurify';

interface SanitizedEmailBodyProps {
  html?: string;
  text?: string;
  className?: string;
}

export const SanitizedEmailBody: React.FC<SanitizedEmailBodyProps> = ({ html, text, className = '' }) => {
  const sanitizedHtml = useMemo(() => {
    if (!html) return '';
    // Strict sanitization: permit formatting, styling, images, links, tables
    // Strictly strip scripts, on* handlers, javascript: URIs, object/embed/applet tags
    return DOMPurify.sanitize(html, {
      USE_PROFILES: { html: true },
      ADD_ATTR: ['target'],
      FORBID_TAGS: ['script', 'style', 'iframe', 'frame', 'object', 'embed', 'applet', 'base', 'form'],
      FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur', 'formaction'],
    });
  }, [html]);

  if (sanitizedHtml) {
    return (
      <div
        className={`email-body-content prose prose-sm dark:prose-invert max-w-none text-slate-800 dark:text-slate-200 overflow-x-auto leading-relaxed ${className}`}
        dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
      />
    );
  }

  if (text) {
    return (
      <div
        className={`whitespace-pre-wrap font-sans text-sm text-slate-800 dark:text-slate-200 leading-relaxed ${className}`}
      >
        {text}
      </div>
    );
  }

  return <div className="text-xs text-slate-400 italic">No content available</div>;
};
