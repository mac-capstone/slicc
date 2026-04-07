/**
 * Heuristic parser for ML Kit OCR text — line-oriented receipts with a price at EOL.
 */
const SKIP_LINE =
  /^(subtotal|total|change|balance|amount\s*due|visa|master|amex|cash|debit|credit)/i;

const TAX_LINE = /\b(tax|hst|gst|pst|qst|vat|sales\s*tax)\b/i;
const TIP_LINE = /\b(tip|gratuity|service\s*charge)\b/i;

function parseTrailingAmount(line: string): number | null {
  const amountMatch = line.match(/(\$?\d{1,6}(?:\.\d{1,2})?)\s*$/);
  if (!amountMatch) return null;

  const parsed = Number.parseFloat(
    amountMatch[1].replace('$', '').replaceAll(',', '')
  );
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
}

export function parseReceiptLinesFromOcrText(fullText: string): {
  items: { item: string; price: number }[];
  taxAmount: number;
  tipAmount: number;
} {
  const lines = fullText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const items: { item: string; price: number }[] = [];
  let taxAmount = 0;
  let tipAmount = 0;

  for (const line of lines) {
    if (TAX_LINE.test(line)) {
      const parsedTax = parseTrailingAmount(line);
      if (parsedTax !== null) {
        taxAmount += parsedTax;
      }
      continue;
    }

    if (TIP_LINE.test(line)) {
      const parsedTip = parseTrailingAmount(line);
      if (parsedTip !== null) {
        tipAmount += parsedTip;
      }
      continue;
    }

    if (SKIP_LINE.test(line)) continue;
    // "Item name    $12.99" or "Item 12.99"
    const m = line.match(/^(.+?)[\s\u00A0]+(\$?\d{1,6}(?:\.\d{1,2})?)\s*$/);
    if (!m) continue;
    const item = m[1].replace(/\s+/g, ' ').trim();
    const priceStr = m[2].replace('$', '').replaceAll(',', '');
    const price = Number.parseFloat(priceStr);
    if (
      item.length < 2 ||
      Number.isNaN(price) ||
      price <= 0 ||
      price > 99_999
    ) {
      continue;
    }
    items.push({ item, price });
  }

  return {
    items,
    taxAmount,
    tipAmount,
  };
}
