/**
 * Heuristic parser for ML Kit OCR text — line-oriented receipts with a price at EOL.
 */
const SKIP_LINE =
  /^(subtotal|total|tax|tip|change|balance|amount\s*due|visa|master|amex|cash|debit|credit)/i;

export function parseReceiptLinesFromOcrText(fullText: string): {
  dish: string;
  price: number;
}[] {
  const lines = fullText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const items: { dish: string; price: number }[] = [];

  for (const line of lines) {
    if (SKIP_LINE.test(line)) continue;
    // "Item name    $12.99" or "Item 12.99"
    const m = line.match(/^(.+?)[\s\u00A0]+(\$?\d{1,6}(?:\.\d{1,2})?)\s*$/);
    if (!m) continue;
    const dish = m[1].replace(/\s+/g, ' ').trim();
    const priceStr = m[2].replace('$', '').replaceAll(',', '');
    const price = Number.parseFloat(priceStr);
    if (
      dish.length < 2 ||
      Number.isNaN(price) ||
      price <= 0 ||
      price > 99_999
    ) {
      continue;
    }
    items.push({ dish, price });
  }

  return items;
}
