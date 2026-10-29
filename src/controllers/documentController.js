import htmlDocx from 'html-docx-js';
import { withTransaction } from '../config/mongo.js';
import { Project, ProjectCategory, ProjectDocument } from '../models/index.js';
import { generateFreeDocument } from '../utils/freeAIGenerator.js';
import { storeProjectFile } from '../services/projectFileService.js';
import { buildPdfFromText } from '../services/watermarkedPdfService.js';

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

const findDocumentForProject = async (project) => {
  const query = {
    $or: [
      { project: project._id },
      ...(project.legacyId ? [{ projectIdLegacy: project.legacyId }] : [])
    ]
  };
  return ProjectDocument.findOne(query);
};

const upsertDocumentForProject = async (project, content) => {
  let doc = await findDocumentForProject(project);
  if (!doc) {
    doc = new ProjectDocument({
      project: project._id,
      projectIdLegacy: project.legacyId || undefined,
      content
    });
  } else {
    doc.content = content;
  }
  await doc.save();
  return doc;
};

/**
 * Generate academic document using AI
 */
export const generateDocument = async (req, res) => {
  try {
    const { id } = req.params;

    const project = await Project.findByIdOrLegacy(id).populate('category');

    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    let generatedContent = '';

    // Check AI provider mode
    if (AI_PROVIDER === 'free') {
      console.log('Using FREE AI mode for document generation');
      generatedContent = generateFreeDocument(project);
    } else if (AI_PROVIDER === 'openai') {
      const openaiClient = await getOpenAI();
      if (!openaiClient) {
        console.warn('OpenAI not available, falling back to FREE AI mode');
        generatedContent = generateFreeDocument(project);
      } else {
        try {
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
1.4 Significance of the Study
1.5 Scope of the Study
1.6 Limitations of the Study
1.7 Definition of Terms

---

### **CHAPTER TWO: LITERATURE REVIEW**

2.1 Theoretical Framework
2.2 Review of Related Works
2.3 Identified Research Gaps

---

### **CHAPTER THREE: SYSTEM ANALYSIS AND DESIGN**

3.1 Analysis of the Existing System
3.2 Problems of the Existing System
3.3 Analysis of the Proposed System
3.4 System Design (Architecture, Modules, Data Flow)

---

### **CHAPTER FOUR: SYSTEM IMPLEMENTATION AND TESTING**

4.1 System Requirements (Hardware & Software)
4.2 Implementation Details
4.3 Testing and Integration
4.4 Results and Discussion

---

### **CHAPTER FIVE: SUMMARY, CONCLUSION AND RECOMMENDATION**

5.1 Summary
5.2 Conclusion
5.3 Recommendations

---

### **REFERENCES**

Generate formal, thorough, academically rigorous content suitable for higher education.`;

          const completion = await openaiClient.chat.completions.create({
            model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
            messages: [
              {
                role: 'system',
                content: 'You are an academic project supervisor and technical writer with deep expertise in academic research.'
              },
              {
                role: 'user',
                content: userPrompt
              }
            ],
            temperature: 0.7,
            max_tokens: 16000
          });

          generatedContent = completion.choices[0].message.content;
        } catch (openaiError) {
          console.warn('OpenAI API error, falling back to FREE AI mode:', openaiError.message);
          generatedContent = generateFreeDocument(project);
        }
      }
    } else {
      console.warn(`Invalid AI_PROVIDER: ${AI_PROVIDER}, using FREE AI mode`);
      generatedContent = generateFreeDocument(project);
    }

    const document = await upsertDocumentForProject(project, generatedContent);

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
    const project = await Project.findByIdOrLegacy(id);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    const document = await findDocumentForProject(project);

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

    const project = await Project.findByIdOrLegacy(id);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    const document = await upsertDocumentForProject(project, content);

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

const htmlToDocxBuffer = async (htmlString) => {
  const blob = htmlDocx.asBlob(htmlString);
  return Buffer.from(await blob.arrayBuffer());
};

/**
 * PDF export uses pdf-lib instead of PhantomJS (html-pdf). PhantomJS is EOL,
 * ships a ~40 MB binary and spawns a child process, which is unreliable on
 * serverless platforms. The generated content is the same plain-text/markdown
 * that the in-app PDF preview already renders.
 */
const htmlToPdfBuffer = async (project, rawContent) => {
  const stampDate = new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });

  return buildPdfFromText({
    title: project?.title || 'Project documentation',
    text: rawContent,
    watermark: '',
    footer: `ProjectAid - Generated documentation - ${stampDate}`
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

    const project = await Project.findByIdOrLegacy(id);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    let buffer;

    if (format === 'docx') {
      buffer = await htmlToDocxBuffer(formatHtmlForExport(project, content));
    } else {
      buffer = await htmlToPdfBuffer(project, content);
    }

    const fileName = generateDocumentFileName(project.title, format);
    const mimeType = format === 'pdf'
      ? 'application/pdf'
      : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

    const { documentFile, project: savedProject } = await withTransaction(async (session) => {
      const record = await storeProjectFile({
        projectId: project._id || project.id,
        category: 'documentation',
        createdBy: req.user?.id || null,
        session,
        file: {
          buffer,
          originalname: fileName,
          mimetype: mimeType,
          size: buffer.length
        }
      });

      project.documentationFile = record.fileName;
      await project.save({ session });

      return { documentFile: record, project };
    });

    res.json({
      status: 'success',
      message: 'Document generated and saved successfully',
      fileName: documentFile.fileName,
      projectId: project.id,
      documentationFile: savedProject.documentationFile,
      documentFile: {
        id: documentFile.id,
        fileName: documentFile.fileName,
        fileType: documentFile.fileType,
        category: documentFile.category,
        fileSize: documentFile.fileSize,
        downloadUrl: `/api/files/${documentFile.id}/download`
      }
    });
  } catch (error) {
    console.error('Save document file error:', error);
    res.status(500).json({ message: 'Server error saving document file' });
  }
};
