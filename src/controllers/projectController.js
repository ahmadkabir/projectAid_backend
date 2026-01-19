import { validationResult } from 'express-validator';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Project, ProjectCategory, OrderItem, SupportRequest, ProjectDocumentFile } from '../models/index.js';
import { Op } from 'sequelize';
import { validateProjectData } from '../utils/projectValidation.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../');

const fileExists = (relativePath) => {
  if (!relativePath) return false;
  const normalized = relativePath.startsWith('uploads')
    ? relativePath
    : path.join('uploads', relativePath);
  const fullPath = path.resolve(projectRoot, normalized);
  return fs.existsSync(fullPath);
};

/**
 * Normalize project data to ensure projectType defaults to 'documentation' if NULL
 * This ensures API responses always have a valid projectType value
 */
const normalizeProject = (project) => {
  if (!project) return project;
  
  const projectData = project.toJSON ? project.toJSON() : project;
  
  // Default projectType to 'documentation' if NULL or undefined
  if (!projectData.projectType) {
    projectData.projectType = 'documentation';
  }
  
  return projectData;
};

export const getAllProjects = async (req, res) => {
  try {
    const { category, search, status, type, projectType } = req.query;
    const where = {};

    // Only filter by status if explicitly provided and not 'all' or empty
    if (status && status !== 'all' && status !== '') {
      where.status = status;
    }
    // If status is not provided, empty, or 'all', don't filter by status (return all)

    if (category) {
      where.categoryId = category;
    }

    // Filter by projectType (accept both 'type' and 'projectType' query params)
    const requestedType = (type || projectType)?.toLowerCase().trim();
    const projectTypeConditions = [];
    
    if (requestedType) {
      // Database only supports 'documentation' and 'software'
      // 'full' is not a valid projectType in the database schema
      if (requestedType === 'full') {
        // 'full' projects don't exist in current schema - return empty result
        console.log(`Filter requested for 'full' projects. No projects match (projectType only supports 'documentation' or 'software').`);
        return res.json({ projects: [] });
      }
      
      // Validate and normalize projectType values
      const validTypes = ['documentation', 'software'];
      if (validTypes.includes(requestedType)) {
        // Strict filtering based on projectType
        if (requestedType === 'documentation') {
          // Include both 'documentation' and NULL (NULL will be normalized to 'documentation' in response)
          projectTypeConditions.push(
            { projectType: 'documentation' },
            { projectType: null }
          );
        } else if (requestedType === 'software') {
          // Only return projects explicitly marked as 'software'
          // NULL values are excluded (they're treated as documentation)
          where.projectType = 'software';
        }
      } else {
        // Invalid type requested - return empty result
        console.warn(`Invalid projectType filter requested: ${requestedType}. Valid values are 'documentation' or 'software'. Returning empty result.`);
        return res.json({ projects: [] });
      }
    }

    // Handle search filter
    const searchConditions = [];
    if (search) {
      searchConditions.push(
        { title: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } }
      );
    }

    // Combine projectType and search conditions properly
    if (projectTypeConditions.length > 0 && searchConditions.length > 0) {
      // Both filters exist - use Op.and to combine them
      where[Op.and] = [
        { [Op.or]: projectTypeConditions },
        { [Op.or]: searchConditions }
      ];
    } else if (projectTypeConditions.length > 0) {
      // Only projectType filter
      where[Op.or] = projectTypeConditions;
    } else if (searchConditions.length > 0) {
      // Only search filter
      where[Op.or] = searchConditions;
    }

    const projects = await Project.findAll({
      where,
      include: [{
        model: ProjectCategory,
        as: 'category',
        attributes: ['id', 'name']
      }],
      order: [['createdAt', 'DESC']]
    });

    // Normalize projects to ensure projectType defaults to 'documentation'
    const normalizedProjects = projects.map(normalizeProject);

    res.json({ projects: normalizedProjects });
  } catch (error) {
    console.error('Get projects error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const getProjectById = async (req, res) => {
  try {
    const project = await Project.findByPk(req.params.id, {
      include: [
        {
          model: ProjectCategory,
          as: 'category',
          attributes: ['id', 'name', 'description']
        },
        {
          model: ProjectDocumentFile,
          as: 'documentFiles',
          attributes: ['id', 'fileName', 'fileType', 'filePath', 'createdAt']
        }
      ]
    });

    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    const filteredFiles = (project.documentFiles || []).filter((file) => fileExists(file.filePath));
    project.documentFiles = filteredFiles;

    const normalizedProject = normalizeProject(project);

    res.json({ project: normalizedProject });
  } catch (error) {
    console.error('Get project error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const createProject = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      title,
      description,
      course, // categoryId from frontend (new field name)
      categoryId, // Legacy field name for backward compatibility
      category, // 'documentation' | 'software' (frontend field name)
      projectType, // Backend field name (renamed from category to avoid collision)
      level, // ND, HND, BSc, MSc
      institution, // Institution name (optional)
      price,
      status
    } = req.body;

    // Use course or categoryId (backward compatibility)
    const courseId = course || categoryId;
    
    // Use projectType or category (frontend sends 'category', we store as 'projectType')
    const type = projectType || category;
    
    // Validation
    if (!courseId) {
      return res.status(400).json({ message: 'Course is required' });
    }

    if (!type) {
      return res.status(400).json({ message: 'Category is required. Must be "documentation" or "software"' });
    }

    if (type !== 'documentation' && type !== 'software') {
      return res.status(400).json({ message: 'Invalid category. Must be "documentation" or "software"' });
    }

    // Fetch course category
    const courseCategory = await ProjectCategory.findByPk(courseId);
    if (!courseCategory) {
      return res.status(400).json({ message: 'Invalid course selected' });
    }

    // Validate level
    if (!level) {
      return res.status(400).json({ message: 'Level is required. Must be ND, HND, BSc, or MSc' });
    }

    const validLevels = ['ND', 'HND', 'BSc', 'MSc'];
    if (!validLevels.includes(level)) {
      return res.status(400).json({ message: 'Invalid level. Must be ND, HND, BSc, or MSc' });
    }

    // Validate category-specific requirements
    if (type === 'documentation') {
      if (!price || parseFloat(price) <= 0) {
        return res.status(400).json({ message: 'Price is required and must be greater than 0 for documentation projects' });
      }
    }

    // Build project data
    const projectData = {
      title,
      description,
      categoryId: courseId, // Keep categoryId for backward compatibility
      projectType: type, // Store as projectType (renamed from category to avoid collision)
      level: level, // ND, HND, BSc, MSc
      institution: institution || null, // Optional institution name
      price: parseFloat(price) || null,
      status: status || 'active',
      // Set legacy price fields for backward compatibility
      documentationPrice: type === 'documentation' ? parseFloat(price) : 0,
      softwarePrice: 0,
      fullProjectPrice: 0
    };

    // Handle file uploads
    if (req.files?.documentationFile) {
      projectData.documentationFile = req.files.documentationFile[0].filename;
    } else if (req.files?.documentation) {
      // Support both field names for backward compatibility
      projectData.documentationFile = req.files.documentation[0].filename;
    }

    if (req.files?.thumbnail) {
      projectData.thumbnail = req.files.thumbnail[0].filename;
    }

    const project = await Project.create(projectData);

    const createdProject = await Project.findByPk(project.id, {
      include: [{
        model: ProjectCategory,
        as: 'category'
      }]
    });

    res.status(201).json({
      message: 'Project created successfully',
      project: createdProject
    });
  } catch (error) {
    console.error('Create project error:', error);
    res.status(500).json({ message: 'Server error creating project', error: error.message });
  }
};

export const updateProject = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const project = await Project.findByPk(req.params.id);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    const {
      title,
      description,
      course, // categoryId from frontend
      categoryId, // Legacy field name
      category, // Frontend field name ('documentation' | 'software')
      projectType, // Backend field name
      level, // ND, HND, BSc, MSc
      institution, // Institution name (optional)
      price,
      status
    } = req.body;

    // Fetch current category or new category if being changed
    let courseCategory = await project.getCategory();
    const courseId = course || categoryId; // Support both field names
    if (courseId && courseId !== project.categoryId) {
      courseCategory = await ProjectCategory.findByPk(courseId);
      if (!courseCategory) {
        return res.status(400).json({ message: 'Invalid course selected' });
      }
    }

    // Validate level if provided
    if (level !== undefined) {
      const validLevels = ['ND', 'HND', 'BSc', 'MSc'];
      if (level && !validLevels.includes(level)) {
        return res.status(400).json({ message: 'Invalid level. Must be ND, HND, BSc, or MSc' });
      }
    }

    // Update basic fields
    if (title) project.title = title;
    if (description) project.description = description;
    if (courseId) project.categoryId = courseId;
    if (level !== undefined) project.level = level || null;
    if (institution !== undefined) project.institution = institution || null;
    if (status) project.status = status;

    // Handle new projectType and price fields
    const type = projectType || category; // Support both field names
    if (type) {
      if (type !== 'documentation' && type !== 'software') {
        return res.status(400).json({ message: 'Invalid category. Must be "documentation" or "software"' });
      }
      project.projectType = type; // Store as projectType
    }

    if (price !== undefined) {
      const priceValue = parseFloat(price);
      if (priceValue <= 0) {
        return res.status(400).json({ message: 'Price must be greater than 0' });
      }
      project.price = priceValue;
      
      // Update legacy price fields for backward compatibility
      const currentType = type || project.projectType;
      if (currentType === 'documentation') {
        project.documentationPrice = priceValue;
        project.softwarePrice = 0;
        project.fullProjectPrice = 0;
      }
    }

    // Handle file uploads
    if (req.files?.documentationFile) {
      project.documentationFile = req.files.documentationFile[0].filename;
    } else if (req.files?.documentation) {
      project.documentationFile = req.files.documentation[0].filename;
    }

    if (req.files?.thumbnail) {
      project.thumbnail = req.files.thumbnail[0].filename;
    }

    await project.save();

    const updatedProject = await Project.findByPk(project.id, {
      include: [{
        model: ProjectCategory,
        as: 'category'
      }]
    });

    // Normalize project to ensure projectType defaults to 'documentation'
    const normalizedProject = normalizeProject(updatedProject);

    res.json({
      message: 'Project updated successfully',
      project: normalizedProject
    });
  } catch (error) {
    console.error('Update project error:', error);
    res.status(500).json({ message: 'Server error updating project', error: error.message });
  }
};

export const deleteProject = async (req, res) => {
  try {
    const project = await Project.findByPk(req.params.id, {
      include: [
        {
          model: OrderItem,
          as: 'orderItems',
          attributes: ['id']
        },
        {
          model: SupportRequest,
          as: 'supportRequests',
          attributes: ['id']
        }
      ]
    });

    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // Check if project has associated orders or support requests
    const orderItemsCount = project.orderItems?.length || 0;
    const supportRequestsCount = project.supportRequests?.length || 0;

    if (orderItemsCount > 0 || supportRequestsCount > 0) {
      return res.status(400).json({ 
        message: 'Cannot delete project. This project has associated orders or support requests. Please remove them first or contact an administrator.',
        details: {
          orderItems: orderItemsCount,
          supportRequests: supportRequestsCount
        }
      });
    }

    // Delete the project
    await project.destroy();

    res.json({ message: 'Project deleted successfully' });
  } catch (error) {
    console.error('Delete project error:', error);
    
    // Handle foreign key constraint errors
    if (error.name === 'SequelizeForeignKeyConstraintError') {
      return res.status(400).json({ 
        message: 'Cannot delete project. This project is referenced by orders or support requests.',
        error: 'Foreign key constraint violation'
      });
    }

    // Handle other database errors
    if (error.name === 'SequelizeDatabaseError') {
      return res.status(500).json({ 
        message: 'Database error while deleting project',
        error: error.message
      });
    }

    res.status(500).json({ 
      message: 'Server error deleting project',
      error: error.message 
    });
  }
};

export const getAllCategories = async (req, res) => {
  try {
    const categories = await ProjectCategory.findAll({
      order: [['name', 'ASC']]
    });

    res.json({ categories });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const createCategory = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, description } = req.body;

    const category = await ProjectCategory.create({ name, description });

    res.status(201).json({
      message: 'Category created successfully',
      category
    });
  } catch (error) {
    console.error('Create category error:', error);
    res.status(500).json({ message: 'Server error creating category' });
  }
};
