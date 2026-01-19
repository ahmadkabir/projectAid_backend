import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { mockProjects, generateFileName } from '../config/mockProjects.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.join(__dirname, '../../uploads');

// Generate mock PDF content
function generatePDFContent(title, description, techStack) {
  return `%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj

2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj

3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Contents 4 0 R
/Resources <<
/Font <<
/F1 <<
/Type /Font
/Subtype /Type1
/BaseFont /Helvetica-Bold
>>
/F2 <<
/Type /Font
/Subtype /Type1
/BaseFont /Helvetica
>>
>>
>>
>>
endobj

4 0 obj
<<
/Length 200
>>
stream
BT
/F1 24 Tf
100 700 Td
(${title}) Tj
0 -30 Td
/F2 12 Tf
(${description}) Tj
0 -20 Td
(Technology Stack: ${techStack.join(', ')}) Tj
ET
endstream
endobj

xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000317 00000 n 
trailer
<<
/Size 5
/Root 1 0 R
>>
startxref
517
%%EOF`;
}

// Generate mock ZIP content (simplified - in production, use a proper ZIP library)
function generateZIPContent(title, techStack) {
  const readmeContent = `# ${title}

## Project Description
This is a complete implementation of ${title}.

## Technology Stack
${techStack.map(tech => `- ${tech}`).join('\n')}

## Installation
1. Install dependencies
2. Configure environment variables
3. Run the application

## Features
- Feature 1
- Feature 2
- Feature 3

## Usage
Follow the documentation for detailed usage instructions.

## License
This project is provided for educational purposes.
`;

  const sampleCode = `// ${title} - Main Application File
// Generated for ProjectAid Platform

console.log('Welcome to ${title}');

function initialize() {
    console.log('Initializing application...');
    // Application initialization code
}

function main() {
    initialize();
    console.log('Application started successfully!');
}

main();
`;

  return {
    'README.md': readmeContent,
    'src/main.js': sampleCode,
    'package.json': JSON.stringify({
      name: title.toLowerCase().replace(/\s+/g, '-'),
      version: '1.0.0',
      description: title,
      main: 'src/main.js',
      dependencies: {}
    }, null, 2),
    'config.json': JSON.stringify({
      project: title,
      techStack: techStack,
      version: '1.0.0'
    }, null, 2)
  };
}

// Generate all mock files
export async function generateAllMockFiles() {
  console.log('Generating mock files...');
  
  const docDir = path.join(uploadsDir, 'documentation');
  const softwareDir = path.join(uploadsDir, 'software');
  const thumbnailDir = path.join(uploadsDir, 'thumbnails');

  // Ensure directories exist
  [docDir, softwareDir, thumbnailDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });

  for (const project of mockProjects) {
    // Generate PDF if documentation price > 0
    if (project.documentationPrice > 0) {
      const pdfFileName = generateFileName(project.title, 'documentation');
      const pdfPath = path.join(docDir, pdfFileName);
      const pdfContent = generatePDFContent(project.title, project.description, project.techStack);
      fs.writeFileSync(pdfPath, pdfContent);
      console.log(`✓ Generated PDF: ${pdfFileName}`);
    }

    // Generate ZIP if software price > 0
    if (project.softwarePrice > 0) {
      const zipFileName = generateFileName(project.title, 'software');
      const zipPath = path.join(softwareDir, zipFileName);
      const zipContent = generateZIPContent(project.title, project.techStack);
      
      // Create a simple text representation (in production, use a ZIP library)
      const zipText = Object.entries(zipContent)
        .map(([file, content]) => `=== ${file} ===\n${content}\n`)
        .join('\n');
      
      fs.writeFileSync(zipPath, zipText);
      console.log(`✓ Generated ZIP: ${zipFileName}`);
    }

    // Generate placeholder thumbnail
    const thumbFileName = generateFileName(project.title, 'thumbnail');
    const thumbPath = path.join(thumbnailDir, thumbFileName);
    // Create a simple placeholder (in production, generate actual image)
    const thumbContent = `Placeholder thumbnail for: ${project.title}`;
    fs.writeFileSync(thumbPath, thumbContent);
    console.log(`✓ Generated thumbnail: ${thumbFileName}`);
  }

  console.log('\n✅ All mock files generated successfully!');
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  generateAllMockFiles().catch(console.error);
}
