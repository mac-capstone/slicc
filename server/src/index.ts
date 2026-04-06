import 'dotenv/config';

import type { Request, Response } from 'express';
import express from 'express';

import { extractReceiptTextFromBase64 } from './extract-receipt';

const app = express();
app.use(express.json({ limit: '15mb' }));

app.post('/api/extract-receipt', async (req: Request, res: Response) => {
  const base64Image = req.body?.base64Image;
  if (typeof base64Image !== 'string' || !base64Image.trim()) {
    res.status(400).json({ error: 'Missing or invalid base64Image' });
    return;
  }

  try {
    const text = await extractReceiptTextFromBase64(base64Image);
    res.json({ text: text ?? '' });
  } catch (err) {
    console.error('extract-receipt error:', err);
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Receipt extraction failed',
    });
  }
});

const port = Number(process.env.PORT) || 8787;
app.listen(port, () => {
  console.log(`Receipt extraction API listening on http://localhost:${port}`);
});
