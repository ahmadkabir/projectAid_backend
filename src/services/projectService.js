/**
 * Project lifecycle, pricing and entitlement rules shared by the controllers.
 * Keeping this in one place means the API never trusts a price or a "what did
 * they buy" decision coming from the client.
 */

export const PROJECT_STATUSES = ['draft', 'pending_review', 'published', 'archived'];

/** Legacy statuses still accepted from older clients. */
const STATUS_ALIASES = {
  active: 'published',
  inactive: 'archived'
};

export const normalizeStatus = (status) => {
  if (!status) return null;
  const value = String(status).trim().toLowerCase();
  if (PROJECT_STATUSES.includes(value)) return value;
  return STATUS_ALIASES[value] || null;
};

const ALLOWED_TRANSITIONS = {
  draft: ['pending_review', 'published', 'archived'],
  pending_review: ['draft', 'published', 'archived'],
  published: ['pending_review', 'archived'],
  archived: ['draft', 'published']
};

export const canTransition = (from, to) => {
  const current = normalizeStatus(from) || 'draft';
  const next = normalizeStatus(to);
  if (!next) return false;
  if (current === next) return true;
  return (ALLOWED_TRANSITIONS[current] || []).includes(next);
};

export const isPublished = (project) => normalizeStatus(project?.status) === 'published';

export const toNumber = (value) => {
  const number = parseFloat(value);
  return Number.isFinite(number) ? number : 0;
};

/** True when the project currently offers accompanying software. */
export const hasActiveSoftware = (project) => {
  if (!project) return false;
  if (project.softwareStatus === 'archived') return false;
  const saleMode = project.softwareSaleMode;
  return Boolean(
    project.softwareStatus === 'active' ||
    project.softwareName ||
    project.softwareFile ||
    (saleMode && saleMode !== 'archived')
  );
};

export const saleModeOf = (project) => {
  if (!hasActiveSoftware(project)) return null;
  if (project.softwareSaleMode === 'included' || project.softwareSaleMode === 'separate') {
    return project.softwareSaleMode;
  }
  // Legacy rows: a positive software price meant it was sold on its own.
  return toNumber(project.softwarePrice) > 0 ? 'separate' : 'included';
};

export const documentationPriceOf = (project) =>
  toNumber(project?.documentationPrice) || toNumber(project?.price);

/**
 * Purchase options advertised to customers, derived from what is actually on
 * sale. Never includes software that is archived or has no installer.
 */
export const getPurchaseOptions = (project, { hasDocumentationFile = true, hasInstaller = true } = {}) => {
  const options = [];
  const docPrice = documentationPriceOf(project);
  const mode = saleModeOf(project);

  if (hasDocumentationFile && docPrice > 0) {
    options.push({
      type: 'documentation',
      label: mode === 'included' ? 'Documentation + Software' : 'Project Documentation',
      price: docPrice,
      includesSoftware: mode === 'included',
      description:
        mode === 'included'
          ? 'Full documentation with the accompanying software included.'
          : 'Complete documentation for this project.'
    });
  }

  if (mode === 'separate' && hasInstaller) {
    const softwarePrice = toNumber(project.softwarePrice);
    if (softwarePrice > 0) {
      options.push({
        type: 'software',
        label: 'Software Only',
        price: softwarePrice,
        includesSoftware: true,
        description: 'The software package and its user guide, without the written documentation.'
      });
    }

    const fullPrice = toNumber(project.fullProjectPrice);
    if (fullPrice > 0) {
      options.push({
        type: 'full',
        label: 'Full Project (Documentation + Software)',
        price: fullPrice,
        includesSoftware: true,
        description: 'Everything: documentation, software installer and user guide.'
      });
    }
  }

  return options;
};

/**
 * Authoritative price for an order item, or a reason why it cannot be bought.
 */
export const resolveItemPrice = (project, itemType, { hasDocumentationFile = true, hasInstaller = true } = {}) => {
  const mode = saleModeOf(project);

  if (itemType === 'documentation') {
    if (!hasDocumentationFile) {
      return { ok: false, error: 'Documentation is not available for this project yet' };
    }
    const price = documentationPriceOf(project);
    if (price <= 0) return { ok: false, error: 'Documentation is not for sale' };
    return { ok: true, price };
  }

  if (itemType === 'software') {
    if (mode !== 'separate') {
      return { ok: false, error: 'The software is included with the documentation and cannot be bought separately' };
    }
    if (!hasInstaller) {
      return { ok: false, error: 'The software installer is not available for this project' };
    }
    const price = toNumber(project.softwarePrice);
    if (price <= 0) return { ok: false, error: 'The software is not for sale' };
    return { ok: true, price };
  }

  if (itemType === 'full') {
    if (mode !== 'separate') {
      return { ok: false, error: 'A bundled price is not offered for this project' };
    }
    const price = toNumber(project.fullProjectPrice);
    if (price <= 0) return { ok: false, error: 'The full project bundle is not for sale' };
    if (!hasDocumentationFile) {
      return { ok: false, error: 'Documentation is not available for this project yet' };
    }
    if (!hasInstaller) {
      return { ok: false, error: 'The software installer is not available for this project' };
    }
    return { ok: true, price };
  }

  return { ok: false, error: 'Invalid purchase option' };
};

/**
 * Which file categories a purchase entitles the customer to download.
 */
export const entitledCategories = (project, itemType) => {
  const mode = saleModeOf(project);

  if (itemType === 'documentation') {
    return mode === 'included' ? ['documentation', 'software', 'guide'] : ['documentation'];
  }
  if (itemType === 'software') {
    return ['software', 'guide'];
  }
  if (itemType === 'full') {
    return ['documentation', 'software', 'guide'];
  }
  return [];
};

const REQUIRED_TEXT_FIELDS = {
  title: 'Project title',
  description: 'Project description'
};

/**
 * Validate the project payload for the requested lifecycle status.
 * Returns a list of human readable errors (empty when valid).
 */
export const validateProjectForStatus = ({
  data,
  status,
  hasDocumentationFile,
  hasInstaller,
  softwareEnabled
}) => {
  const errors = [];
  const targetStatus = normalizeStatus(status) || 'draft';

  Object.entries(REQUIRED_TEXT_FIELDS).forEach(([field, label]) => {
    if (!String(data[field] || '').trim()) errors.push(`${label} is required`);
  });

  if (!data.categoryId) errors.push('Course / department is required');
  if (!data.level) errors.push('Academic level is required');

  const docPrice = toNumber(data.documentationPrice ?? data.price);
  // A few pre-existing catalogue entries were sold as software only, with no
  // documentation and no documentation price. They keep working (and remain
  // editable) instead of being forced offline by the new documentation rule.
  const legacySoftwareOnly =
    softwareEnabled &&
    (data.softwareSaleMode === 'separate' || toNumber(data.softwarePrice) > 0) &&
    docPrice <= 0;

  if (docPrice <= 0 && !legacySoftwareOnly) {
    errors.push('Documentation price must be greater than 0');
  }

  if ((targetStatus === 'pending_review' || targetStatus === 'published') && !legacySoftwareOnly) {
    if (!hasDocumentationFile) {
      errors.push('Upload the project documentation before submitting or publishing');
    }
  }

  if (softwareEnabled) {
    if (!String(data.softwareName || '').trim()) {
      errors.push('Software name is required when the project has accompanying software');
    }

    const mode = data.softwareSaleMode;
    if (mode !== 'included' && mode !== 'separate') {
      errors.push('Choose whether the software is included with the documentation or sold separately');
    }

    if (targetStatus === 'pending_review' || targetStatus === 'published') {
      if (!hasInstaller) errors.push('Upload the software installer before submitting or publishing');
      if (mode === 'separate' && toNumber(data.softwarePrice) <= 0) {
        errors.push('Software price must be greater than 0 when it is sold separately');
      }
      if (data.softwareRedistributionAllowed === null || data.softwareRedistributionAllowed === undefined) {
        errors.push('Record whether software redistribution is permitted');
      }
    }
  }

  return errors;
};
