import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import pdf from 'html-pdf';
import htmlDocx from 'html-docx-js';
import { Project, ProjectCategory, ProjectDocument, ProjectDocumentFile } from '../models/index.js';
import { generateFreeDocument } from '../utils/freeAIGenerator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsRoot = path.resolve(__dirname, '../../uploads');

// Initialize OpenAI client (handle case where package might not be installed)
let OpenAI = null;
let openai = null;

// Get AI provider mode from environment
const AI_PROVIDER = process.env.AI_PROVIDER || 'free'; // Default to 'free' for development

// Lazy load OpenAI
const getOpenAI = async () => {
  if (openai) return openai;
  
  try {
    if (!OpenAI) {
      const openaiModule = await import('openai');
      OpenAI = openaiModule.default;
    }
    if (process.env.OPENAI_API_KEY && !openai) {
      openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });
    }
    return openai;
  } catch (error) {
    console.warn('OpenAI package not installed. Please run: npm install openai');
    return null;
  }
};

/**
 * Generate academic document using AI
 */
export const generateDocument = async (req, res) => {
  try {
    const { id } = req.params;

    // Fetch project with category
    const project = await Project.findByPk(id, {
      include: [{
        model: ProjectCategory,
        as: 'category',
        attributes: ['id', 'name']
      }]
    });

    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    let generatedContent = '';

    // Check AI provider mode
    if (AI_PROVIDER === 'free') {
      // Use FREE AI (template-based generation)
      console.log('Using FREE AI mode for document generation');
      generatedContent = generateFreeDocument(project);
    } else if (AI_PROVIDER === 'openai') {
      // Use OpenAI API
      const openaiClient = await getOpenAI();
      if (!openaiClient) {
        // Fallback to FREE AI if OpenAI is not available
        console.warn('OpenAI not available, falling back to FREE AI mode');
        generatedContent = generateFreeDocument(project);
      } else {
        try {
          // Build the user prompt
          const userPrompt = `Generate a complete academic project documentation using the following details:

Title: ${project.title}
Course: ${project.category?.name || 'N/A'}
Level: ${project.level || 'N/A'}
Institution: ${project.institution || 'N/A'}

Project Description:
${project.description || project.summary || 'No description available'}

Use the following Table of Contents STRICTLY and generate full content under each heading:

**TABLE OF CONTENTS**

**Title Page**
**Certification**
**Dedication**
**Acknowledgement**
**Abstract**
**Table of Contents**
**List of Tables**
**List of Figures**

---

### **CHAPTER ONE: INTRODUCTION**

1.1 Background of the Study
1.2 Statement of the Problem
1.3 Aim and Objectives of the Study
1.4 Research Questions
1.5 Research Hypotheses *(if applicable)*
1.6 Significance of the Study
1.7 Scope and Delimitation of the Study
1.8 Limitations of the Study
1.9 Definition of Terms

---

### **CHAPTER TWO: REVIEW OF RELATED LITERATURE**

2.1 Introduction
2.2 Conceptual Framework
   2.2.1 Concept of the Study Variables
   2.2.2 Overview of the Subject Area
2.3 Theoretical Framework
   2.3.1 Relevant Theory/Theories
2.4 Empirical Review
2.5 Summary of Literature Review

---

### **CHAPTER THREE: RESEARCH METHODOLOGY**

3.1 Introduction
3.2 Research Design
3.3 Area of the Study
3.4 Population of the Study
3.5 Sample Size and Sampling Technique
3.6 Research Instruments
3.7 Validity of the Instrument
3.8 Reliability of the Instrument
3.9 Method of Data Collection
3.10 Method of Data Analysis
3.11 Ethical Considerations

---

### **CHAPTER FOUR: DATA PRESENTATION, ANALYSIS AND DISCUSSION**

4.1 Introduction
4.2 Data Presentation
4.3 Analysis of Research Questions
4.4 Test of Hypotheses *(if applicable)*
4.5 Discussion of Findings

---

### **CHAPTER FIVE: SUMMARY, CONCLUSION AND RECOMMENDATIONS**

5.1 Summary of Findings
5.2 Conclusion
5.3 Recommendations
5.4 Suggestions for Further Studies

---

**References**

**Appendices**
Appendix A: Questionnaire / Interview Guide
Appendix B: Additional Data


Rules:
- Generate VERY DETAILED content
- Output should be equivalent to NOT LESS THAN 20+ pages
- Use formal academic English
- Include tables where appropriate (clearly labeled)
- Describe diagrams/figures where applicable (e.g. system architecture, workflows)
- Do NOT fabricate references or data
- Maintain proper academic tone and numbering
- Content must be editable (no images, no PDFs)
- Format the output in plain text with clear headings and structure`;

          const systemPrompt = `You are a senior academic writer specializing in Nigerian Polytechnic and University final year projects.

You write long-form, formal, and well-structured academic documents that strictly follow standard project formats used in ND, HND, BSc, and MSc programs.

Your writing must be detailed, professional, and suitable for direct submission.`;

          // Call OpenAI API
          const completion = await openaiClient.chat.completions.create({
            model: 'gpt-4o-mini', // Using gpt-4o-mini for cost-effectiveness, can be changed to gpt-4 if needed
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt }
            ],
            temperature: 0.7,
            max_tokens: 16000 // Increased for longer documents
          });

          generatedContent = completion.choices[0].message.content;
        } catch (openaiError) {
          // Handle OpenAI API errors (429, quota, etc.) with fallback
          console.warn('OpenAI API error, falling back to FREE AI mode:', openaiError.message);
          
          // Check for specific error codes
          if (openaiError.status === 429 || 
              openaiError.message?.includes('quota') || 
              openaiError.message?.includes('insufficient_quota')) {
            console.log('OpenAI quota exceeded, using FREE AI fallback');
          }
          
          // Fallback to FREE AI
          generatedContent = generateFreeDocument(project);
        }
      }
    } else {
      // Invalid AI_PROVIDER, default to FREE AI
      console.warn(`Invalid AI_PROVIDER: ${AI_PROVIDER}, using FREE AI mode`);
      generatedContent = generateFreeDocument(project);
    }

    // Save or update document in database
    const [document, created] = await ProjectDocument.findOrCreate({
      where: { projectId: id },
      defaults: {
        projectId: id,
        content: generatedContent
      }
    });

    if (!created) {
      // Update existing document
      document.content = generatedContent;
      await document.save();
    }

    res.json({
      message: 'Document generated successfully',
      document: {
        id: document.id,
        projectId: document.projectId,
        content: document.content,
        createdAt: document.createdAt,
        updatedAt: document.updatedAt
      }
    });
  } catch (error) {
    console.error('Generate document error:', error);
    
    // Handle OpenAI API errors
    if (OpenAI && error instanceof OpenAI.APIError) {
      // Try fallback to FREE AI
      try {
        const project = await Project.findByPk(req.params.id, {
          include: [{
            model: ProjectCategory,
            as: 'category',
            attributes: ['id', 'name']
          }]
        });
        if (project) {
          const generatedContent = generateFreeDocument(project);
          // Save the fallback-generated document
          const [document] = await ProjectDocument.findOrCreate({
            where: { projectId: req.params.id },
            defaults: {
              projectId: req.params.id,
              content: generatedContent
            }
          });
          if (!document.isNewRecord) {
            document.content = generatedContent;
            await document.save();
          }
          return res.json({
            message: 'Document generated successfully (using FREE AI fallback)',
            document: {
              id: document.id,
              projectId: document.projectId,
              content: document.content,
              createdAt: document.createdAt,
              updatedAt: document.updatedAt
            }
          });
        }
      } catch (fallbackError) {
        console.error('Fallback generation failed:', fallbackError);
      }
      
      return res.status(500).json({ 
        message: 'OpenAI API error',
        error: error.message 
      });
    }

    res.status(500).json({ 
      message: 'Server error generating document',
      error: error.message 
    });
  }
};

/**
 * Get document for a project
 */
export const getDocument = async (req, res) => {
  try {
    const { id } = req.params;

    const document = await ProjectDocument.findOne({
      where: { projectId: id }
    });

    if (!document) {
      return res.status(404).json({ message: 'Document not found for this project' });
    }

    res.json({ document });
  } catch (error) {
    console.error('Get document error:', error);
    res.status(500).json({ message: 'Server error fetching document' });
  }
};

/**
 * Save/Update document content
 */
export const saveDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({ message: 'Content is required' });
    }

    // Check if project exists
    const project = await Project.findByPk(id);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // Save or update document
    const [document, created] = await ProjectDocument.findOrCreate({
      where: { projectId: id },
      defaults: {
        projectId: id,
        content: content
      }
    });

    if (!created) {
      document.content = content;
      await document.save();
    }

    res.json({
      message: 'Document saved successfully',
      document: {
        id: document.id,
        projectId: document.projectId,
        content: document.content,
        updatedAt: document.updatedAt
      }
    });
  } catch (error) {
    console.error('Save document error:', error);
    res.status(500).json({ message: 'Server error saving document' });
  }
};

const ensureDocumentsDir = (projectId) => {
  const projectDir = path.join(uploadsRoot, 'projects', `${projectId}`, 'documents');
  if (!fs.existsSync(projectDir)) {
    fs.mkdirSync(projectDir, { recursive: true });
  }
  return projectDir;
};

const formatHtmlForExport = (project, rawContent) => {
  const projectTitle = project?.title || 'ProjectAid Document';
  const styles = `
    <style>
      body { font-family: 'Times New Roman', serif; line-height: 1.6; color: #111827; }
      h1, h2, h3, h4, h5, h6 { color: #0C3968; }
      strong { font-weight: 700; }
      table { width: 100%; border-collapse: collapse; margin: 16px 0; }
      table, th, td { border: 1px solid #d1d5db; }
      th, td { padding: 8px; }
      ul, ol { margin-left: 24px; }
      .title-page { text-align: center; margin-bottom: 32px; }
    </style>
  `;

  return `<!DOCTYPE html>
  <html>
    <head>
      <meta charset="utf-8" />
      <title>${projectTitle} Documentation</title>
      ${styles}
    </head>
    <body>
      <div class="title-page">
        <h1>${projectTitle}</h1>
        ${project?.institution ? `<p>${project.institution}</p>` : ''}
        ${project?.level ? `<p>${project.level} Project</p>` : ''}
      </div>
      <div>${rawContent}</div>
    </body>
  </html>`;
};

const generateDocumentFileName = (title = 'project', format = 'pdf') => {
  const sanitizedTitle = title
    .replace(/[^a-z0-9]+/gi, '_')
    .replace(/^_+|_+$/g, '')
    .substring(0, 80) || 'project';
  const dateString = new Date().toISOString().split('T')[0];
  const typeLabel = format === 'pdf' ? 'Documentation_PDF' : 'Documentation_DOC';
  return `${sanitizedTitle}_${typeLabel}_${dateString}.${format}`;
};

const htmlToDocxBuffer = (htmlString) => {
  return htmlDocx.asBuffer(htmlString);
};

const htmlToPdfBuffer = (htmlString) => {
  return new Promise((resolve, reject) => {
    pdf.create(htmlString, { format: 'A4', orientation: 'portrait', border: '20mm' }).toBuffer((err, buffer) => {
      if (err) {
        return reject(err);
      }
      resolve(buffer);
    });
  });
};

export const saveDocumentFile = async (req, res) => {
  try {
    const { id } = req.params;
    const { content, format } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ message: 'Content is required' });
    }

    if (!['pdf', 'docx'].includes(format)) {
      return res.status(400).json({ message: 'Invalid format. Supported formats are pdf and docx' });
    }

    const project = await Project.findByPk(id);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    const formattedHtml = formatHtmlForExport(project, content);
    let buffer;

    if (format === 'docx') {
      buffer = htmlToDocxBuffer(formattedHtml);
    } else {
      buffer = await htmlToPdfBuffer(formattedHtml);
    }

    const directory = ensureDocumentsDir(project.id);
    const fileName = generateDocumentFileName(project.title, format);
    const filePath = path.join(directory, fileName);

    fs.writeFileSync(filePath, buffer);

    const relativePath = path.relative(path.resolve(__dirname, '../../'), filePath).replace(/\\/g, '/');

    const documentFile = await ProjectDocumentFile.create({
      projectId: project.id,
      fileName,
      fileType: format,
      filePath: relativePath,
      createdBy: req.user?.id || null
    });

    res.json({
      status: 'success',
      message: 'Document generated and saved successfully',
      fileName,
      projectId: project.id,
      documentFile
    });
  } catch (error) {
    console.error('Save document file error:', error);
    res.status(500).json({ message: 'Server error saving document file' });
  }
};
