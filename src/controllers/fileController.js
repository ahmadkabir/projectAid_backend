import mongoose from 'mongoose';
import { Project, ProjectDocumentFile, Order } from '../models/index.js';
import { entitledCategories } from '../services/projectService.js';
import {
  createReadStream,
  getSignedDownloadUrl,
  statObject,
  readBuffer,
  getStorageProvider
} from '../services/storageService.js';
import { extractPlainText } from '../services/documentTextService.js';
import { buildPdfFromText, stampPdf } from '../services/watermarkedPdfService.js';
import { streamBuffer } from '../utils/http.js';

const SAFE_ASCII = /[^\x20-\x7e]/g;

const contentDisposition = (fileName) => {
  const fallback = String(fileName || 'download').replace(SAFE_ASCII, '_').replace(/["\\]/g, '');
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(fileName || 'download')}`;
};

const purchaseCoversFile = async (userId, project, category) => {
  const userFilters = [{ user: userId }];
  if (mongoose.Types.ObjectId.isValid(userId)) {
    userFilters.push({ user: new mongoose.Types.ObjectId(userId) });
  }

  const completedOrders = await Order.find({
    $or: userFilters,
    status: 'completed'
  });

  const matchingItems = [];
  const targetId = project._id?.toString() || String(project.id);
  const targetLegacy = project.legacyId !== undefined && project.legacyId !== null ? String(project.legacyId) : null;

  for (const order of completedOrders) {
    for (const item of order.items || []) {
      const itemProjectId = item.project?._id?.toString() || (item.project ? String(item.project) : null);
      const itemLegacy = item.projectIdLegacy !== undefined && item.projectIdLegacy !== null ? String(item.projectIdLegacy) : null;

      if (
        (itemProjectId && itemProjectId === targetId) ||
        (targetLegacy && itemLegacy && itemLegacy === targetLegacy)
      ) {
        matchingItems.push(item);
      }
    }
  }

  return matchingItems.some((item) => entitledCategories(project, item.itemType).includes(category));
};

/**
 * Resolve the requested file and verify the caller may access it. Resolves to
 * `{ file, project }` or `{ error, status }`.
 */
const loadEntitledFile = async (req) => {
  const file = await ProjectDocumentFile.findByIdOrLegacy(req.params.id);

  if (!file || file.uploadStatus !== 'completed') {
    return { error: 'File not found', status: 404 };
  }

  const project = await Project.findByIdOrLegacy(file.projectId);
  if (!project) {
    return { error: 'File not found', status: 404 };
  }

  const isAdmin = req.user?.role === 'admin';

  if (!isAdmin) {
    const allowed = await purchaseCoversFile(req.user.id, project, file.category || 'documentation');
    if (!allowed) {
      return { error: 'A completed purchase is required to download this file', status: 403 };
    }
  }

  return { file, project };
};

/**
 * Private download endpoint.
 *
 * The binary never has a public URL: the customer must be signed in and hold a
 * completed order that covers the file's category, or be an administrator.
 */
export const downloadProjectFile = async (req, res) => {
  try {
    const entitled = await loadEntitledFile(req);
    if (entitled.error) {
      return res.status(entitled.status).json({ message: entitled.error });
    }

    const { file } = entitled;
    const key = file.storageKey || file.filePath;
    if (!key) {
      return res.status(404).json({ message: 'File not found' });
    }

    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');

    if (getStorageProvider() === 's3') {
      // Short-lived presigned URL; the bucket itself stays private.
      const url = await getSignedDownloadUrl(key);
      if (!url) {
        return res.status(503).json({ message: 'File storage is not available' });
      }
      return res.redirect(302, url);
    }

    const stat = await statObject(key);
    if (!stat) {
      return res.status(404).json({ message: 'File is no longer available' });
    }

    res.setHeader('Content-Type', file.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', contentDisposition(file.originalName || file.fileName));
    if (stat.size) res.setHeader('Content-Length', String(stat.size));

    const stream = createReadStream(key);
    stream.on('error', (error) => {
      console.error('File stream error:', error.message);
      if (!res.headersSent) {
        res.status(500).json({ message: 'Unable to read the stored file' });
      } else {
        res.destroy(error);
      }
    });
    stream.pipe(res);

    return undefined;
  } catch (error) {
    console.error('Download file error:', error);
    if (!res.headersSent) {
      return res.status(500).json({ message: 'Server error downloading file' });
    }
    return undefined;
  }
};

const pdfFileName = (project, file) => {
  const base = (project?.title || file.originalName || 'document')
    .replace(/[^\w\s-]+/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 80);
  return `${base || 'document'}.pdf`;
};

/**
 * Render a purchased document as a PDF carrying the customer's watermark.
 * `?download=1` returns it as an attachment; otherwise it is inline for the
 * in-app viewer.
 */
export const getWatermarkedPdf = async (req, res) => {
  try {
    const entitled = await loadEntitledFile(req);
    if (entitled.error) {
      return res.status(entitled.status).json({ message: entitled.error });
    }

    const { file, project } = entitled;

    if ((file.category || 'documentation') === 'software') {
      return res.status(400).json({ message: 'PDF preview is only available for documents' });
    }

    const key = file.storageKey || file.filePath;
    if (!key) {
      return res.status(404).json({ message: 'File not found' });
    }

    const sourceBuffer = await readBuffer(key);
    const userName = req.user?.name || 'ProjectAid customer';
    const userEmail = req.user?.email || '';
    const stampDate = new Date().toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });

    const options = {
      watermark: `ProjectAid | Licensed to ${userName} | ${userEmail}`,
      footer: `ProjectAid - Licensed to ${userName} (${userEmail}) - ${stampDate}`
    };

    const isPdf = (file.fileType || '').toLowerCase() === 'pdf' ||
      /\.pdf$/i.test(file.originalName || file.fileName || '');

    let pdfBuffer = null;

    if (isPdf) {
      try {
        pdfBuffer = await stampPdf(sourceBuffer, options);
      } catch (error) {
        console.error(`Watermarking PDF ${file.id} failed, rebuilding from text:`, error.message);
      }
    }

    if (!pdfBuffer) {
      const text = await extractPlainText(sourceBuffer, file.originalName || file.fileName);
      if (!text) {
        return res.status(422).json({ message: 'This file cannot be displayed as a PDF' });
      }
      pdfBuffer = await buildPdfFromText({
        title: project.title,
        text,
        ...options
      });
    }

    const disposition = String(req.query.download || '') === '1' ? 'attachment' : 'inline';

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `${disposition}; filename="${pdfFileName(project, file)}"`
    );
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');

    // Stream so documents larger than Vercel's 4.5 MB buffered response cap
    // still reach the customer.
    return streamBuffer(res, pdfBuffer);
  } catch (error) {
    console.error('Watermarked PDF error:', error);
    if (!res.headersSent) {
      return res.status(500).json({ message: 'Server error rendering the PDF' });
    }
    return undefined;
  }
};
