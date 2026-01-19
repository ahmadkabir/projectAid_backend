// Project validation utilities
// Enforces course-based project type restrictions

export const SOFTWARE_ALLOWED_COURSES = [
  'Computer Science',
  'Computer Engineering'
];

/**
 * Check if a course allows software/full projects
 * @param {string} courseName - Name of the course
 * @returns {boolean} - True if course allows software projects
 */
export const allowsSoftwareProjects = (courseName) => {
  return SOFTWARE_ALLOWED_COURSES.includes(courseName);
};

/**
 * Validate project type based on course
 * @param {string} courseName - Name of the course
 * @param {string} projectType - Type of project (documentation, software, full)
 * @returns {object} - { valid: boolean, error?: string, correctedType?: string }
 */
export const validateProjectType = (courseName, projectType) => {
  const allowsSoftware = allowsSoftwareProjects(courseName);
  
  // If course doesn't allow software, force documentation only
  if (!allowsSoftware && (projectType === 'software' || projectType === 'full')) {
    return {
      valid: false,
      error: `Software projects are only available for ${SOFTWARE_ALLOWED_COURSES.join(' and ')}. This course only supports Documentation Only projects.`,
      correctedType: 'documentation'
    };
  }
  
  return { valid: true };
};

/**
 * Validate project data based on course restrictions
 * @param {object} projectData - Project data object
 * @param {object} category - Category/course object with name
 * @returns {object} - { valid: boolean, errors: array, warnings: array, correctedData?: object }
 */
export const validateProjectData = (projectData, category) => {
  const errors = [];
  const warnings = [];
  const correctedData = { ...projectData };
  const courseName = category?.name;
  
  if (!courseName) {
    return {
      valid: false,
      errors: ['Course/Category is required'],
      warnings: [],
      correctedData: null
    };
  }
  
  const allowsSoftware = allowsSoftwareProjects(courseName);
  
  // If course doesn't allow software, enforce documentation only
  if (!allowsSoftware) {
    // Force documentation-only pricing (these are warnings, not errors)
    if (projectData.softwarePrice > 0) {
      warnings.push(`Software pricing not allowed for ${courseName}. Setting softwarePrice to 0.`);
      correctedData.softwarePrice = 0;
    }
    
    if (projectData.fullProjectPrice > 0) {
      warnings.push(`Full project pricing not allowed for ${courseName}. Setting fullProjectPrice to 0.`);
      correctedData.fullProjectPrice = 0;
    }
    
    // Remove software file if present (warning, not error)
    if (projectData.softwareFile) {
      warnings.push(`Software files not allowed for ${courseName}. Removing softwareFile.`);
      correctedData.softwareFile = null;
    }
    
    // Ensure documentation price exists (this is a critical error)
    if (!projectData.documentationPrice || projectData.documentationPrice === 0) {
      errors.push(`Documentation price is required for ${courseName}.`);
    }
  }
  
  // Only fail if there are critical errors, not warnings
  return {
    valid: errors.length === 0,
    errors,
    warnings,
    correctedData: (warnings.length > 0 || errors.length === 0) ? correctedData : null
  };
};

/**
 * Get allowed project types for a course
 * @param {string} courseName - Name of the course
 * @returns {array} - Array of allowed project types
 */
export const getAllowedProjectTypes = (courseName) => {
  if (allowsSoftwareProjects(courseName)) {
    return ['documentation', 'software', 'full'];
  }
  return ['documentation'];
};
