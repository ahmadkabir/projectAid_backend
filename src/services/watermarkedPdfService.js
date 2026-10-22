import { PDFDocument, StandardFonts, rgb, degrees } from 'pdf-lib';

/**
 * Watermarked PDF rendering for purchased documents.
 *
 * Two paths:
 *  - `stampPdf` overlays a diagonal watermark and footer on an existing PDF so
 *    the original layout is preserved.
 *  - `buildPdfFromText` lays out plain text (extracted from DOCX) on A4 pages
 *    with the same watermark, so every document is viewable as a PDF.
 */

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 64;
const FOOTER_Y = 30;
const INK = rgb(0.15, 0.15, 0.17);
const SOFT_INK = rgb(0.45, 0.45, 0.48);

// pdf-lib's standard fonts only cover WinAnsi, so unsupported characters must
// be normalised before drawing or the whole render throws.
const sanitize = (value) => String(value ?? '')
  .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
  .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
  .replace(/[\u2013\u2014\u2212]/g, '-')
  .replace(/\u2026/g, '...')
  .replace(/\u00A0/g, ' ')
  .replace(/\u20A6/g, 'NGN ')
  .replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, ' ')
  .replace(/[^\x20-\x7E\n]/g, '');

const wrapLine = (line, font, size, maxWidth) => {
  const words = sanitize(line).split(/\s+/).filter(Boolean);
  if (words.length === 0) return [''];

  const lines = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }

  if (current) lines.push(current);
  return lines;
};

const drawWatermark = (page, font, text) => {
  const { width, height } = page.getSize();
  const size = 34;
  const content = sanitize(text);
  if (!content) return;

  const textWidth = font.widthOfTextAtSize(content, size);
  const angle = degrees(38);
  const offset = Math.SQRT1_2 * (textWidth / 2);

  page.drawText(content, {
    x: width / 2 - offset,
    y: height / 2 - offset,
    size,
    font,
    color: rgb(0.25, 0.3, 0.4),
    opacity: 0.11,
    rotate: angle
  });
};

const drawFooter = (page, font, footer, pageNumber, totalPages) => {
  const { width } = page.getSize();
  const size = 7.5;
  const content = sanitize(footer);
  const contentWidth = font.widthOfTextAtSize(content, size);

  page.drawText(content, {
    x: Math.max(MARGIN / 2, (width - contentWidth) / 2),
    y: FOOTER_Y,
    size,
    font,
    color: SOFT_INK,
    opacity: 0.8
  });

  const label = `Page ${pageNumber} of ${totalPages}`;
  page.drawText(label, {
    x: width - MARGIN / 2 - font.widthOfTextAtSize(label, size),
    y: FOOTER_Y,
    size,
    font,
    color: SOFT_INK,
    opacity: 0.8
  });
};

const decoratePages = (doc, font, { watermark, footer }) => {
  const pages = doc.getPages();
  pages.forEach((page, index) => {
    drawWatermark(page, font, watermark);
    drawFooter(page, font, footer, index + 1, pages.length);
  });
};

/** Overlay the watermark on an existing PDF without touching its content. */
export const stampPdf = async (buffer, options) => {
  const doc = await PDFDocument.load(buffer, { ignoreEncryption: true, updateMetadata: false });
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  decoratePages(doc, font, options);
  return Buffer.from(await doc.save());
};

const isHeading = (paragraph) => {
  const firstLine = paragraph.split('\n')[0].trim();
  if (!firstLine || firstLine.length > 90) return false;
  if (/^chapter\b/i.test(firstLine)) return true;
  if (/^[A-Z0-9][A-Z0-9 ,.'&/()\-:]{3,}$/.test(firstLine)) return true;
  if (/^\*\*.+\*\*$/.test(firstLine)) return true;
  return false;
};

const cleanHeading = (value) => value.replace(/\*\*/g, '').trim();

/** Lay out plain text on A4 pages and decorate every page. */
export const buildPdfFromText = async ({ title, text, watermark, footer }) => {
  const doc = await PDFDocument.create();
  const bodyFont = await doc.embedFont(StandardFonts.Helvetica);
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);
  const decorativeFont = await doc.embedFont(StandardFonts.HelveticaBold);

  doc.setTitle(sanitize(title || 'Project documentation'));
  doc.setProducer('ProjectAid');

  const maxWidth = PAGE_WIDTH - MARGIN * 2;
  let page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let cursorY = PAGE_HEIGHT - MARGIN;

  const newPage = () => {
    page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    cursorY = PAGE_HEIGHT - MARGIN;
  };

  const writeLine = (line, font, size, { centered = false, gap = 5 } = {}) => {
    if (cursorY - size < MARGIN + 18) newPage();

    const content = sanitize(line);
    const x = centered
      ? Math.max(MARGIN, (PAGE_WIDTH - font.widthOfTextAtSize(content, size)) / 2)
      : MARGIN;

    page.drawText(content, { x, y: cursorY - size, size, font, color: INK });
    cursorY -= size + gap;
  };

  const titleLines = wrapLine(title || 'Project documentation', boldFont, 17, maxWidth);
  titleLines.forEach((line) => writeLine(line, boldFont, 17, { centered: true, gap: 8 }));
  cursorY -= 10;

  const paragraphs = sanitize(text).split(/\n{2,}/).filter((part) => part.trim());

  for (const paragraph of paragraphs) {
    const heading = isHeading(paragraph);
    const font = heading ? boldFont : bodyFont;
    const size = heading ? 12.5 : 11;
    const gap = heading ? 6 : 4;

    if (heading) {
      const headingText = cleanHeading(paragraph.split('\n')[0]);
      wrapLine(headingText, font, size, maxWidth)
        .forEach((line) => writeLine(line, font, size, { gap }));
      cursorY -= 4;
    }

    const bodyText = heading ? paragraph.split('\n').slice(1).join('\n') : paragraph;
    for (const rawLine of bodyText.split('\n')) {
      wrapLine(rawLine, font, size, maxWidth)
        .forEach((line) => writeLine(line, font, size, { gap }));
    }

    cursorY -= heading ? 8 : 6;
  }

  decoratePages(doc, decorativeFont, { watermark, footer });
  return Buffer.from(await doc.save());
};
