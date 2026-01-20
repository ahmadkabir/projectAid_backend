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
    const {
      category,
      search = '',
      status = 'all',
      type,
      projectType,
      startDate,
      endDate,
      page,
      limit
    } = req.query;

    const baseWhere = {};

    if (status && status !== 'all' && status !== '') {
      baseWhere.status = status;
    }

    if (category && category !== 'all') {
      baseWhere.categoryId = category;
    }

    if (startDate || endDate) {
      baseWhere.createdAt = {};
      if (startDate) {
        baseWhere.createdAt[Op.gte] = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        baseWhere.createdAt[Op.lte] = end;
      }
    }

    const requestedType = (type || projectType)?.toLowerCase()?.trim();
    const typeConditions = [];

    if (requestedType) {
      const validTypes = ['documentation', 'software'];
      if (!validTypes.includes(requestedType)) {
        console.warn('Invalid projectType filter requested: ' + requestedType + ". Valid values are 'documentation' or 'software'. Returning empty result.");
        return res.json({ success: true, projects: [], total: 0 });
      }

      if (requestedType === 'documentation') {
        typeConditions.push({ projectType: 'documentation' }, { projectType: null });
      } else if (requestedType === 'software') {
        baseWhere.projectType = 'software';
      }
    }

    const searchConditions = [];
    if (search) {
      const like = { [Op.like]: `%${search}%` };
      searchConditions.push(
        { title: like },
        { description: like },
        { '$category.name$': like }
      );
    }

    const andConditions = [];
    if (typeConditions.length > 0) {
      andConditions.push({ [Op.or]: typeConditions });
    }
    if (searchConditions.length > 0) {
      andConditions.push({ [Op.or]: searchConditions });
    }

    const finalWhere = { ...baseWhere };
    if (andConditions.length > 0) {
      finalWhere[Op.and] = andConditions;
    }

    const include = [{
      model: ProjectCategory,
      as: 'category',
      attributes: ['id', 'name']
    }];

    const pageNumber = page ? parseInt(page, 10) : null;
    const pageSize = limit ? parseInt(limit, 10) : 10;
    const shouldPaginate = Number.isInteger(pageNumber) && pageNumber > 0;

    let projects;
    let total = 0;
    let pagination;

    if (shouldPaginate) {
      const { rows, count } = await Project.findAndCountAll({
        where: finalWhere,
        include,
        order: [['createdAt', 'DESC']],
        limit: pageSize,
        offset: (pageNumber - 1) * pageSize
      });
      projects = rows;
      total = count;
      pagination = { page: pageNumber, pageSize, total };
    } else {
      projects = await Project.findAll({
        where: finalWhere,
        include,
        order: [['createdAt', 'DESC']]
      });
      total = projects.length;
    }

    const normalizedProjects = projects.map(normalizeProject);

    res.json({
      success: true,
      projects: normalizedProjects,
      total,
      ...(pagination ? { pagination } : {})
    });
  } catch (error) {
    console.error('Get projects error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
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

