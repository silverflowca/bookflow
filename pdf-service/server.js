import express from 'express';
import puppeteer from 'puppeteer';

const app = express();
app.use(express.json({ limit: '10mb' }));

const PORT = process.env.PORT || 3099;

app.get('/health', (_req, res) => res.json({ ok: true }));

app.post('/generate', async (req, res) => {
  const { html } = req.body;
  if (!html) return res.status(400).json({ error: 'html is required' });

  let browser;
  try {
    browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({
      format: 'A4',
      margin: { top: '2cm', bottom: '2cm', left: '2.5cm', right: '2.5cm' },
      printBackground: true,
    });
    await browser.close();
    browser = null;
    res.json({ pdf: Buffer.from(pdfBuffer).toString('base64') });
  } catch (err) {
    if (browser) await browser.close().catch(() => {});
    console.error('PDF generation error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => console.log(`pdf-service listening on port ${PORT}`));
