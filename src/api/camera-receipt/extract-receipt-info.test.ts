import { extractReceiptInfo } from '@/api/camera-receipt/extract-receipt-info';
import { parseReceiptInfo } from '@/lib/utils';

function parseReceiptInfoCompat(
  result: string,
  parse: typeof parseReceiptInfo
): ReturnType<typeof parseReceiptInfo> {
  const first = parse(result);
  if (first?.success) return first;
  const swapped = result.includes('"item"')
    ? result.replace(/"item":/g, '"dish":')
    : result.replace(/"dish":/g, '"item":');
  return parse(swapped);
}

const mockGenerateContent = jest.fn().mockResolvedValue({
  text: '[{"item":"Coffee","price":"$3.00"}]',
});

jest.mock('@google/genai', () => ({
  GoogleGenAI: jest.fn().mockImplementation(() => ({
    models: {
      generateContent: mockGenerateContent,
    },
  })),
}));

/**
 * TA feedback: receipt parsing must be scored on structured correctness and field
 * accuracy, not latency alone (§6.4.1 / §6.4.2).
 */
function receiptLineItemMetrics(
  expected: { dish: string; price: number }[],
  actual:
    | { dish: string; price: number }[]
    | {
        items: { item: string; price: number }[];
        taxAmount?: number;
        tipAmount?: number;
      }
) {
  const actualItems: { dish: string; price: number }[] = Array.isArray(actual)
    ? actual
    : actual.items.map((i) => ({ dish: i.item, price: i.price }));

  const expSet = new Set(expected.map((e) => `${e.dish}::${e.price}`));
  const actSet = new Set(actualItems.map((a) => `${a.dish}::${a.price}`));
  let tp = 0;
  for (const k of actSet) {
    if (expSet.has(k)) tp++;
  }
  const precision = actSet.size ? tp / actSet.size : 1;
  const recall = expSet.size ? tp / expSet.size : 1;
  const priceMape =
    expected.length === 0
      ? 0
      : expected.reduce((acc, e, i) => {
          const a = actualItems[i];
          if (!a) return acc + 1;
          const denom = Math.abs(e.price) < 1e-9 ? 1 : Math.abs(e.price);
          return acc + Math.abs(e.price - a.price) / denom;
        }, 0) / expected.length;
  return { precision, recall, priceMape };
}

describe('extractReceiptInfo (Gemini client, §6.4)', () => {
  beforeEach(() => {
    mockGenerateContent.mockResolvedValue({
      text: '[{"item":"Coffee","price":"$3.00"}]',
    });
  });

  it('formats the multimodal request and returns model text', async () => {
    const { GoogleGenAI } = jest.requireMock('@google/genai') as {
      GoogleGenAI: jest.Mock;
    };
    const text = await extractReceiptInfo('YmFzZTY0');
    expect(GoogleGenAI).toHaveBeenCalled();
    expect(text).toContain('Coffee');
    expect(mockGenerateContent).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gemini-2.5-flash-lite',
        contents: expect.arrayContaining([
          expect.objectContaining({
            inlineData: expect.objectContaining({
              mimeType: 'image/jpeg',
              data: 'YmFzZTY0',
            }),
          }),
          expect.objectContaining({
            text: expect.stringContaining('JSON array'),
          }),
        ]),
      })
    );
  });

  it('propagates failures from the mocked Gemini client (§6.4.1 failure path)', async () => {
    mockGenerateContent.mockRejectedValueOnce(new Error('quota'));
    await expect(extractReceiptInfo('x')).rejects.toThrow('quota');
  });

  it('completes within the §6.4.2 latency budget on a mocked network call', async () => {
    const t0 = global.performance.now();
    await extractReceiptInfo('x');
    expect(global.performance.now() - t0).toBeLessThan(5000);
  });
});

describe('parseReceiptInfo + golden-set quality metrics (§6.4 TA feedback)', () => {
  const gold = `[
    {"item":"Chicken Curry","price":"$12.99"},
    {"item":"Spring Rolls","price":"$5.50"}
  ]`;

  it('achieves high precision/recall on an exact golden transcript', () => {
    const parsed = parseReceiptInfoCompat(gold, parseReceiptInfo);
    expect(parsed?.success).toBe(true);
    if (!parsed?.success) return;
    const expected = [
      { dish: 'Chicken Curry', price: 12.99 },
      { dish: 'Spring Rolls', price: 5.5 },
    ];
    const m = receiptLineItemMetrics(expected, parsed.data);
    expect(m.precision).toBeGreaterThanOrEqual(0.9);
    expect(m.recall).toBeGreaterThanOrEqual(0.9);
    expect(m.priceMape).toBeLessThan(0.01);
  });

  it('flags lower recall when a line is dropped', () => {
    const parsed = parseReceiptInfoCompat(
      '[{"item":"Chicken Curry","price":"$12.99"}]',
      parseReceiptInfo
    );
    expect(parsed?.success).toBe(true);
    if (!parsed?.success) return;
    const expected = [
      { dish: 'Chicken Curry', price: 12.99 },
      { dish: 'Spring Rolls', price: 5.5 },
    ];
    const m = receiptLineItemMetrics(expected, parsed.data);
    expect(m.recall).toBeLessThan(1);
  });
});
