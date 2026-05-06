/**
 * Strip noise out of a bank/card transaction description so different
 * appearances of the same vendor collapse to the same key. This is what
 * the categorization-rules engine and AI categorizer match against.
 *
 * Examples:
 *   "POS PURCHASE TIM HORTONS #1234 04/12"   → "tim hortons"
 *   "SHOPIFY* MONTHLY FEE 2024-04-01"        → "shopify monthly fee"
 *   "AMZN MKTP CA*M83YC9KL3 AMAZON.CA"       → "amzn mktp ca amazon ca"
 */
export function normalizeVendor(description: string): string {
  if (!description) return '';

  let s = description.toLowerCase().trim();

  // Strip common bank-statement prefixes.
  s = s.replace(
    /^(pos\s+purchase|pos|debit\s+memo|debit|credit\s+memo|credit|purchase|payment|withdrawal|deposit|misc|atm\s+w\/d|atm|e[-\s]?transfer|interac|preauth|preauthorized|chq|cheque|check)\s+/i,
    ''
  );

  // Drop dates: 04/12, 04-12, 2024/04/12, 2024-04-12, 12 apr.
  s = s.replace(/\b\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}\b/g, '');
  s = s.replace(/\b\d{1,2}[\/\-]\d{1,2}([\/\-]\d{2,4})?\b/g, '');
  s = s.replace(
    /\b\d{1,2}\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/gi,
    ''
  );

  // Drop long reference / authorization numbers (6+ digits in a row).
  s = s.replace(/\b\d{6,}\b/g, '');

  // Drop store/branch numbers like "#1234" or "store 0042".
  s = s.replace(/#\s*\d+/g, '');
  s = s.replace(/\bstore\s+\d+\b/gi, '');

  // Drop card-network noise.
  s = s.replace(/\bvisa\s+(debit|credit)\b/gi, '');
  s = s.replace(/\bmastercard\b/gi, '');

  // Drop trailing province/country tags (CA, ON, BC, etc).
  s = s.replace(/\b(ca|us|on|bc|ab|mb|sk|qc|nb|ns|pe|nl|yt|nt|nu)\b/g, '');

  // Replace any non-alphanumeric/space characters with a space.
  s = s.replace(/[^a-z0-9\s]/g, ' ');

  // Collapse repeated whitespace.
  s = s.replace(/\s+/g, ' ').trim();

  return s;
}
