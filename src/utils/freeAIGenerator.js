/**
 * Free AI Generator - Template-based academic document generation
 * 
 * This module generates academic project documentation using templates
 * and dynamic content expansion, simulating AI-generated content.
 */

/**
 * Generate academic document using template-based approach
 */
export const generateFreeDocument = (project) => {
  const {
    title = 'Project Title',
    description = 'No description available',
    category = null,
    level = 'ND',
    institution = 'N/A'
  } = project;

  const courseName = category?.name || 'General Studies';
  const projectDescription = description || 'No description available';

  // Helper function to generate detailed paragraphs
  const generateParagraph = (topic, context = '') => {
    const templates = [
      `This section provides a comprehensive examination of ${topic}. ${context} The analysis delves into various aspects that are crucial for understanding the subject matter in depth.`,
      `${topic} represents a significant area of study that requires thorough investigation. ${context} Through systematic research and analysis, this study aims to contribute valuable insights to the field.`,
      `The exploration of ${topic} is essential for advancing knowledge in this domain. ${context} This research adopts a structured approach to examine the various dimensions and implications.`,
      `Understanding ${topic} is fundamental to the overall objectives of this research. ${context} The study employs rigorous methodologies to ensure comprehensive coverage of all relevant aspects.`
    ];
    return templates[Math.floor(Math.random() * templates.length)];
  };

  // Helper function to generate multiple paragraphs
  const generateMultipleParagraphs = (topic, count = 3, context = '') => {
    let paragraphs = '';
    for (let i = 0; i < count; i++) {
      paragraphs += generateParagraph(topic, context) + '\n\n';
    }
    return paragraphs.trim();
  };

  // Helper function to generate table
  const generateTable = (title, headers, rows) => {
    let table = `\n\n**Table ${title}**\n\n`;
    table += `| ${headers.join(' | ')} |\n`;
    table += `| ${headers.map(() => '---').join(' | ')} |\n`;
    rows.forEach(row => {
      table += `| ${row.join(' | ')} |\n`;
    });
    return table;
  };

  // Build the document
  let document = '';

  // Title Page
  document += `**${title.toUpperCase()}**\n\n`;
  document += `\nA ${level} PROJECT\n\n`;
  document += `Submitted to the Department of ${courseName}\n`;
  document += `${institution}\n\n`;
  document += `In Partial Fulfillment of the Requirements for the Award of\n`;
  document += `${level} in ${courseName}\n\n`;
  document += `\n---\n\n`;

  // Certification
  document += `**CERTIFICATION**\n\n`;
  document += `This is to certify that this project titled "${title}" was carried out by the undersigned in the Department of ${courseName}, ${institution}.\n\n`;
  document += `---\n\n`;

  // Dedication
  document += `**DEDICATION**\n\n`;
  document += `This project is dedicated to Almighty God, my family, and all those who have contributed to the successful completion of this research work.\n\n`;
  document += `---\n\n`;

  // Acknowledgement
  document += `**ACKNOWLEDGEMENT**\n\n`;
  document += `I wish to express my profound gratitude to my supervisor, Dr. [Supervisor Name], for his invaluable guidance, constructive criticism, and encouragement throughout the period of this research. I am also grateful to the staff and management of ${institution} for providing the necessary facilities and support.\n\n`;
  document += `My sincere appreciation goes to my family and friends for their moral and financial support. I am also indebted to all those who participated in this study and provided valuable data.\n\n`;
  document += `---\n\n`;

  // Abstract
  document += `**ABSTRACT**\n\n`;
  document += `${generateMultipleParagraphs('the research project', 2, `This study focuses on ${title}. ${projectDescription}`)}\n\n`;
  document += `The research employed a ${level === 'ND' || level === 'HND' ? 'descriptive' : 'quantitative'} research design and utilized appropriate data collection and analysis methods. The findings reveal significant insights that contribute to the body of knowledge in ${courseName}.\n\n`;
  document += `---\n\n`;

  // Table of Contents
  document += `**TABLE OF CONTENTS**\n\n`;
  document += `**Title Page**\n`;
  document += `**Certification**\n`;
  document += `**Dedication**\n`;
  document += `**Acknowledgement**\n`;
  document += `**Abstract**\n`;
  document += `**Table of Contents**\n`;
  document += `**List of Tables**\n`;
  document += `**List of Figures**\n\n`;
  document += `---\n\n`;
  document += `### **CHAPTER ONE: INTRODUCTION**\n\n`;
  document += `1.1 Background of the Study\n`;
  document += `1.2 Statement of the Problem\n`;
  document += `1.3 Aim and Objectives of the Study\n`;
  document += `1.4 Research Questions\n`;
  document += `1.5 Research Hypotheses\n`;
  document += `1.6 Significance of the Study\n`;
  document += `1.7 Scope and Delimitation of the Study\n`;
  document += `1.8 Limitations of the Study\n`;
  document += `1.9 Definition of Terms\n\n`;
  document += `---\n\n`;
  document += `### **CHAPTER TWO: REVIEW OF RELATED LITERATURE**\n\n`;
  document += `2.1 Introduction\n`;
  document += `2.2 Conceptual Framework\n`;
  document += `   2.2.1 Concept of the Study Variables\n`;
  document += `   2.2.2 Overview of the Subject Area\n`;
  document += `2.3 Theoretical Framework\n`;
  document += `   2.3.1 Relevant Theory/Theories\n`;
  document += `2.4 Empirical Review\n`;
  document += `2.5 Summary of Literature Review\n\n`;
  document += `---\n\n`;
  document += `### **CHAPTER THREE: RESEARCH METHODOLOGY**\n\n`;
  document += `3.1 Introduction\n`;
  document += `3.2 Research Design\n`;
  document += `3.3 Area of the Study\n`;
  document += `3.4 Population of the Study\n`;
  document += `3.5 Sample Size and Sampling Technique\n`;
  document += `3.6 Research Instruments\n`;
  document += `3.7 Validity of the Instrument\n`;
  document += `3.8 Reliability of the Instrument\n`;
  document += `3.9 Method of Data Collection\n`;
  document += `3.10 Method of Data Analysis\n`;
  document += `3.11 Ethical Considerations\n\n`;
  document += `---\n\n`;
  document += `### **CHAPTER FOUR: DATA PRESENTATION, ANALYSIS AND DISCUSSION**\n\n`;
  document += `4.1 Introduction\n`;
  document += `4.2 Data Presentation\n`;
  document += `4.3 Analysis of Research Questions\n`;
  document += `4.4 Test of Hypotheses\n`;
  document += `4.5 Discussion of Findings\n\n`;
  document += `---\n\n`;
  document += `### **CHAPTER FIVE: SUMMARY, CONCLUSION AND RECOMMENDATIONS**\n\n`;
  document += `5.1 Summary of Findings\n`;
  document += `5.2 Conclusion\n`;
  document += `5.3 Recommendations\n`;
  document += `5.4 Suggestions for Further Studies\n\n`;
  document += `---\n\n`;
  document += `**REFERENCES**\n\n`;
  document += `**APPENDICES**\n`;
  document += `Appendix A: Questionnaire / Interview Guide\n`;
  document += `Appendix B: Additional Data\n\n`;
  document += `\n\n========================================\n\n`;

  // CHAPTER ONE: INTRODUCTION
  document += `# CHAPTER ONE: INTRODUCTION\n\n`;
  
  document += `## 1.1 Background of the Study\n\n`;
  document += `${generateMultipleParagraphs('the background and context', 4, `The field of ${courseName} has witnessed significant developments in recent years. This research project titled "${title}" emerges from the need to address contemporary challenges and contribute to the existing body of knowledge. ${projectDescription}`)}\n\n`;
  
  document += `## 1.2 Statement of the Problem\n\n`;
  document += `${generateMultipleParagraphs('the problem statement', 3, `Despite various efforts in the field of ${courseName}, there remain critical issues that require investigation. This study identifies and addresses specific problems related to ${title}.`)}\n\n`;
  
  document += `## 1.3 Aim and Objectives of the Study\n\n`;
  document += `### Aim\n\n`;
  document += `The main aim of this study is to investigate and analyze ${title.toLowerCase()} within the context of ${courseName}.\n\n`;
  document += `### Objectives\n\n`;
  document += `The specific objectives of this study are:\n\n`;
  document += `1. To examine the current state of ${title.toLowerCase()} in ${courseName}.\n`;
  document += `2. To identify the key factors influencing ${title.toLowerCase()}.\n`;
  document += `3. To analyze the relationship between various variables related to the study.\n`;
  document += `4. To evaluate the effectiveness of existing approaches and methodologies.\n`;
  document += `5. To provide recommendations for improvement and future research directions.\n\n`;
  
  document += `## 1.4 Research Questions\n\n`;
  document += `The following research questions guide this study:\n\n`;
  document += `1. What is the current state of ${title.toLowerCase()} in the context of ${courseName}?\n`;
  document += `2. What are the key factors that influence ${title.toLowerCase()}?\n`;
  document += `3. How do various variables relate to each other in this study?\n`;
  document += `4. What are the challenges and opportunities in this area of research?\n`;
  document += `5. What recommendations can be made based on the findings?\n\n`;
  
  document += `## 1.5 Research Hypotheses\n\n`;
  document += `${generateMultipleParagraphs('research hypotheses', 2, `Based on the research questions, the following hypotheses are formulated:`)}\n\n`;
  document += `**H1:** There is a significant relationship between the variables under investigation.\n\n`;
  document += `**H2:** The identified factors have a measurable impact on the outcomes.\n\n`;
  
  document += `## 1.6 Significance of the Study\n\n`;
  document += `${generateMultipleParagraphs('the significance', 3, `This research contributes to the field of ${courseName} in several ways.`)}\n\n`;
  document += `The findings of this study will be beneficial to:\n\n`;
  document += `- Academic researchers and scholars in ${courseName}\n`;
  document += `- Practitioners and professionals in the field\n`;
  document += `- Policy makers and decision makers\n`;
  document += `- Students and future researchers\n\n`;
  
  document += `## 1.7 Scope and Delimitation of the Study\n\n`;
  document += `${generateMultipleParagraphs('scope and delimitation', 2, `This study focuses specifically on ${title.toLowerCase()} within the context of ${courseName} at ${institution}.`)}\n\n`;
  document += `The study is delimited to:\n\n`;
  document += `- The specific area of ${courseName}\n`;
  document += `- The time frame of the research period\n`;
  document += `- The geographical location of ${institution}\n`;
  document += `- The specific variables and factors identified in the research objectives\n\n`;
  
  document += `## 1.8 Limitations of the Study\n\n`;
  document += `${generateMultipleParagraphs('limitations', 2, `While this study aims for comprehensive coverage, certain limitations are acknowledged.`)}\n\n`;
  document += `The limitations include:\n\n`;
  document += `- Constraints related to data collection methods\n`;
  document += `- Time and resource limitations\n`;
  document += `- Access to certain information or participants\n`;
  document += `- Generalizability of findings to other contexts\n\n`;
  
  document += `## 1.9 Definition of Terms\n\n`;
  document += `For the purpose of clarity and consistency, the following terms are defined:\n\n`;
  document += `**${title}:** ${projectDescription.substring(0, 100)}...\n\n`;
  document += `**${courseName}:** The academic discipline focusing on [relevant description].\n\n`;
  document += `**Research:** A systematic investigation aimed at discovering new knowledge or validating existing theories.\n\n`;
  document += `**Methodology:** The systematic approach and procedures used in conducting research.\n\n`;

  // CHAPTER TWO: REVIEW OF RELATED LITERATURE
  document += `\n\n# CHAPTER TWO: REVIEW OF RELATED LITERATURE\n\n`;
  
  document += `## 2.1 Introduction\n\n`;
  document += `${generateMultipleParagraphs('literature review', 3, `This chapter presents a comprehensive review of existing literature related to ${title.toLowerCase()}.`)}\n\n`;
  
  document += `## 2.2 Conceptual Framework\n\n`;
  document += `${generateMultipleParagraphs('conceptual framework', 2, `The conceptual framework provides the theoretical foundation for understanding the key concepts in this study.`)}\n\n`;
  
  document += `### 2.2.1 Concept of the Study Variables\n\n`;
  document += `${generateMultipleParagraphs('study variables', 3, `The variables in this study include various factors related to ${title.toLowerCase()}.`)}\n\n`;
  
  document += generateTable('2.1: Study Variables', 
    ['Variable', 'Type', 'Description'],
    [
      ['Independent Variable 1', 'Quantitative', 'Primary factor influencing outcomes'],
      ['Independent Variable 2', 'Qualitative', 'Secondary influencing factor'],
      ['Dependent Variable', 'Quantitative', 'Measured outcome of the study'],
      ['Control Variable', 'Mixed', 'Variables held constant during research']
    ]
  );
  document += `\n\n`;
  
  document += `### 2.2.2 Overview of the Subject Area\n\n`;
  document += `${generateMultipleParagraphs('subject area overview', 4, `The field of ${courseName} encompasses various aspects that are relevant to this research.`)}\n\n`;
  
  document += `## 2.3 Theoretical Framework\n\n`;
  document += `${generateMultipleParagraphs('theoretical framework', 3, `The theoretical framework guides the research by providing a lens through which to interpret findings.`)}\n\n`;
  
  document += `### 2.3.1 Relevant Theory/Theories\n\n`;
  document += `${generateMultipleParagraphs('relevant theories', 4, `Several theories are relevant to understanding ${title.toLowerCase()}.`)}\n\n`;
  
  document += `## 2.4 Empirical Review\n\n`;
  document += `${generateMultipleParagraphs('empirical studies', 5, `Previous empirical studies have investigated various aspects related to ${title.toLowerCase()}.`)}\n\n`;
  
  document += generateTable('2.2: Summary of Empirical Studies',
    ['Author(s)', 'Year', 'Focus', 'Key Findings'],
    [
      ['Smith & Johnson', '2020', 'Related Study 1', 'Significant positive correlation identified'],
      ['Williams et al.', '2021', 'Related Study 2', 'Mixed results with contextual variations'],
      ['Brown', '2022', 'Related Study 3', 'Strong evidence supporting theoretical framework'],
      ['Davis & Miller', '2023', 'Related Study 4', 'Novel approach with promising outcomes']
    ]
  );
  document += `\n\n`;
  
  document += `## 2.5 Summary of Literature Review\n\n`;
  document += `${generateMultipleParagraphs('literature review summary', 3, `The literature review reveals several key themes and gaps in existing research.`)}\n\n`;

  // CHAPTER THREE: RESEARCH METHODOLOGY
  document += `\n\n# CHAPTER THREE: RESEARCH METHODOLOGY\n\n`;
  
  document += `## 3.1 Introduction\n\n`;
  document += `${generateMultipleParagraphs('research methodology', 2, `This chapter outlines the research design and methodology employed in this study.`)}\n\n`;
  
  document += `## 3.2 Research Design\n\n`;
  document += `${generateMultipleParagraphs('research design', 3, `The research adopts a ${level === 'ND' || level === 'HND' ? 'descriptive' : 'quantitative'} research design.`)}\n\n`;
  
  document += `## 3.3 Area of the Study\n\n`;
  document += `${generateMultipleParagraphs('study area', 2, `This study is conducted at ${institution}, located in [geographical location].`)}\n\n`;
  
  document += `## 3.4 Population of the Study\n\n`;
  document += `${generateMultipleParagraphs('study population', 2, `The population for this study consists of [relevant population description].`)}\n\n`;
  
  document += `## 3.5 Sample Size and Sampling Technique\n\n`;
  document += `${generateMultipleParagraphs('sampling', 3, `A sample size of [appropriate number] participants was selected using [sampling method].`)}\n\n`;
  
  document += generateTable('3.1: Sample Distribution',
    ['Category', 'Number', 'Percentage'],
    [
      ['Category A', '50', '40%'],
      ['Category B', '45', '36%'],
      ['Category C', '30', '24%'],
      ['Total', '125', '100%']
    ]
  );
  document += `\n\n`;
  
  document += `## 3.6 Research Instruments\n\n`;
  document += `${generateMultipleParagraphs('research instruments', 3, `The following instruments were used for data collection:`)}\n\n`;
  document += `1. Questionnaire: Structured questionnaire designed to collect quantitative data\n`;
  document += `2. Interview Guide: Semi-structured interview guide for qualitative insights\n`;
  document += `3. Observation Checklist: For systematic observation of relevant phenomena\n\n`;
  
  document += `## 3.7 Validity of the Instrument\n\n`;
  document += `${generateMultipleParagraphs('validity', 2, `To ensure validity, the research instruments were reviewed by experts in the field.`)}\n\n`;
  
  document += `## 3.8 Reliability of the Instrument\n\n`;
  document += `${generateMultipleParagraphs('reliability', 2, `Reliability was established through pilot testing and statistical analysis.`)}\n\n`;
  
  document += `## 3.9 Method of Data Collection\n\n`;
  document += `${generateMultipleParagraphs('data collection', 3, `Data collection was carried out over a period of [timeframe] using multiple methods.`)}\n\n`;
  
  document += `## 3.10 Method of Data Analysis\n\n`;
  document += `${generateMultipleParagraphs('data analysis', 3, `The collected data were analyzed using appropriate statistical and qualitative methods.`)}\n\n`;
  
  document += generateTable('3.2: Data Analysis Methods',
    ['Research Question', 'Analysis Method', 'Statistical Tool'],
    [
      ['RQ1', 'Descriptive Statistics', 'Mean, Standard Deviation'],
      ['RQ2', 'Correlation Analysis', 'Pearson Correlation'],
      ['RQ3', 'Regression Analysis', 'Multiple Regression'],
      ['RQ4', 'Content Analysis', 'Thematic Analysis']
    ]
  );
  document += `\n\n`;
  
  document += `## 3.11 Ethical Considerations\n\n`;
  document += `${generateMultipleParagraphs('ethical considerations', 2, `Ethical approval was obtained and all participants provided informed consent.`)}\n\n`;

  // CHAPTER FOUR: DATA PRESENTATION, ANALYSIS AND DISCUSSION
  document += `\n\n# CHAPTER FOUR: DATA PRESENTATION, ANALYSIS AND DISCUSSION\n\n`;
  
  document += `## 4.1 Introduction\n\n`;
  document += `${generateMultipleParagraphs('data presentation', 2, `This chapter presents the analysis of collected data and discusses the findings.`)}\n\n`;
  
  document += `## 4.2 Data Presentation\n\n`;
  document += `${generateMultipleParagraphs('data presentation', 3, `The collected data are presented in various formats including tables, charts, and descriptive narratives.`)}\n\n`;
  
  document += generateTable('4.1: Demographic Characteristics of Respondents',
    ['Characteristic', 'Category', 'Frequency', 'Percentage'],
    [
      ['Gender', 'Male', '65', '52%'],
      ['Gender', 'Female', '60', '48%'],
      ['Age Group', '18-25', '45', '36%'],
      ['Age Group', '26-35', '50', '40%'],
      ['Age Group', '36+', '30', '24%']
    ]
  );
  document += `\n\n`;
  
  document += `**Figure 4.1: System Architecture Diagram**\n\n`;
  document += `The system architecture diagram illustrates the overall structure and components of ${title.toLowerCase()}. The diagram shows the relationships between various modules and subsystems, demonstrating how data flows through the system.\n\n`;
  
  document += `**Figure 4.2: Data Flow Diagram**\n\n`;
  document += `The data flow diagram represents the movement of information within the system, showing inputs, processes, and outputs at different levels of abstraction.\n\n`;
  
  document += `## 4.3 Analysis of Research Questions\n\n`;
  document += `${generateMultipleParagraphs('research question analysis', 4, `Each research question is analyzed in detail with supporting data and evidence.`)}\n\n`;
  
  document += generateTable('4.2: Summary of Research Question Analysis',
    ['Research Question', 'Finding', 'Significance'],
    [
      ['RQ1', 'Positive correlation identified', 'p < 0.05'],
      ['RQ2', 'Strong relationship confirmed', 'p < 0.01'],
      ['RQ3', 'Moderate association found', 'p < 0.05'],
      ['RQ4', 'Significant difference observed', 'p < 0.001']
    ]
  );
  document += `\n\n`;
  
  document += `## 4.4 Test of Hypotheses\n\n`;
  document += `${generateMultipleParagraphs('hypothesis testing', 3, `The formulated hypotheses are tested using appropriate statistical methods.`)}\n\n`;
  
  document += generateTable('4.3: Hypothesis Test Results',
    ['Hypothesis', 'Test Statistic', 'P-value', 'Decision'],
    [
      ['H1', 't = 3.45', '0.001', 'Rejected'],
      ['H2', 'F = 5.67', '0.003', 'Rejected'],
      ['H3', 'χ² = 12.34', '0.002', 'Rejected']
    ]
  );
  document += `\n\n`;
  
  document += `## 4.5 Discussion of Findings\n\n`;
  document += `${generateMultipleParagraphs('findings discussion', 5, `The findings are discussed in relation to existing literature and theoretical frameworks.`)}\n\n`;

  // CHAPTER FIVE: SUMMARY, CONCLUSION AND RECOMMENDATIONS
  document += `\n\n# CHAPTER FIVE: SUMMARY, CONCLUSION AND RECOMMENDATIONS\n\n`;
  
  document += `## 5.1 Summary of Findings\n\n`;
  document += `${generateMultipleParagraphs('findings summary', 4, `This chapter summarizes the key findings of the research.`)}\n\n`;
  
  document += `The main findings include:\n\n`;
  document += `1. ${generateParagraph('finding one', `Related to ${title.toLowerCase()}`)}\n\n`;
  document += `2. ${generateParagraph('finding two', `In the context of ${courseName}`)}\n\n`;
  document += `3. ${generateParagraph('finding three', `At ${institution}`)}\n\n`;
  document += `4. ${generateParagraph('finding four', `For ${level} level research`)}\n\n`;
  
  document += `## 5.2 Conclusion\n\n`;
  document += `${generateMultipleParagraphs('conclusion', 3, `Based on the comprehensive analysis, this study concludes that...`)}\n\n`;
  
  document += `## 5.3 Recommendations\n\n`;
  document += `${generateMultipleParagraphs('recommendations', 2, `Based on the findings, the following recommendations are made:`)}\n\n`;
  document += `1. It is recommended that [specific recommendation related to ${title.toLowerCase()}].\n\n`;
  document += `2. Stakeholders should consider [relevant action or policy].\n\n`;
  document += `3. Future research should focus on [identified research gaps].\n\n`;
  document += `4. Practitioners in the field of ${courseName} should [practical recommendation].\n\n`;
  
  document += `## 5.4 Suggestions for Further Studies\n\n`;
  document += `${generateMultipleParagraphs('further studies', 2, `While this study provides valuable insights, there are areas that warrant further investigation.`)}\n\n`;
  document += `Future research could explore:\n\n`;
  document += `- Longitudinal studies to examine long-term effects\n`;
  document += `- Comparative studies across different institutions\n`;
  document += `- Integration of emerging technologies and methodologies\n`;
  document += `- Expanded sample sizes and diverse populations\n\n`;

  // REFERENCES
  document += `\n\n# REFERENCES\n\n`;
  document += `Adeyemi, A. B. (2020). *Research Methods in ${courseName}*. Lagos: Academic Press.\n\n`;
  document += `Bello, C. D., & Okonkwo, E. F. (2021). "Contemporary Issues in ${courseName}." *Journal of Academic Research*, 15(3), 45-62.\n\n`;
  document += `Chukwu, G. H. (2022). *Theoretical Foundations of ${courseName}*. Abuja: University Publishers.\n\n`;
  document += `Eze, I. K., & Mohammed, S. A. (2023). "Empirical Analysis of ${title}." *International Journal of Studies*, 28(4), 112-130.\n\n`;
  document += `Federal Ministry of Education. (2023). *Guidelines for ${level} Project Writing*. Abuja: Government Press.\n\n`;
  document += `Ibrahim, M. O. (2021). "Methodological Approaches in ${courseName} Research." *Research Quarterly*, 12(2), 78-95.\n\n`;
  document += `Johnson, P. R., & Williams, L. M. (2020). *Academic Writing Standards*. Ibadan: Educational Publishers.\n\n`;
  document += `Kolawole, A. T. (2022). "Best Practices in ${courseName}." *Academic Review*, 19(1), 34-51.\n\n`;
  document += `Lawal, B. C., & Adebayo, F. G. (2023). "Statistical Analysis in Research." *Data Science Journal*, 8(3), 67-84.\n\n`;
  document += `Musa, H. I., & Okafor, J. N. (2021). *Research Ethics and Methodology*. Enugu: Academic House.\n\n`;
  document += `Nwosu, K. E. (2022). "Contemporary Trends in ${courseName}." *Modern Studies*, 14(5), 23-40.\n\n`;
  document += `Obi, C. M., & Uche, P. A. (2020). *Data Collection and Analysis*. Port Harcourt: Research Publishers.\n\n`;
  document += `Okoro, S. T. (2023). "Theoretical Perspectives in ${courseName}." *Theory and Practice*, 11(2), 56-73.\n\n`;
  document += `Oluwaseun, A. B., & Fatima, K. M. (2021). "Empirical Evidence in ${courseName}." *Evidence-Based Research*, 7(4), 89-106.\n\n`;
  document += `Umar, Y. I. (2022). *Academic Project Writing Guide*. Kano: Educational Press.\n\n`;

  // APPENDICES
  document += `\n\n# APPENDICES\n\n`;
  document += `## Appendix A: Questionnaire / Interview Guide\n\n`;
  document += `**SECTION A: DEMOGRAPHIC INFORMATION**\n\n`;
  document += `1. Gender: [ ] Male [ ] Female\n\n`;
  document += `2. Age Group: [ ] 18-25 [ ] 26-35 [ ] 36-45 [ ] 46+\n\n`;
  document += `3. Educational Level: [ ] ${level} [ ] Other\n\n`;
  document += `**SECTION B: RESEARCH QUESTIONS**\n\n`;
  document += `[Questionnaire items related to ${title.toLowerCase()}]\n\n`;
  document += `## Appendix B: Additional Data\n\n`;
  document += `[Additional supporting data, charts, and supplementary information]\n\n`;

  return document;
};
