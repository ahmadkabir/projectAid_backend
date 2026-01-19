// Course-Based Mock Projects for ProjectAid Platform
// Projects organized by course/department

export const courses = [
  { name: 'Computer Science', description: 'Software development, algorithms, and computing systems' },
  { name: 'Computer Engineering', description: 'Hardware-software integration and embedded systems' },
  { name: 'Electrical / Electronic Engineering Technology', description: 'Electrical systems, circuits, and power engineering' },
  { name: 'Mechanical Engineering Technology', description: 'Mechanical systems, design, and manufacturing' },
  { name: 'Civil Engineering Technology', description: 'Infrastructure, construction, and structural engineering' },
  { name: 'Mechatronics Engineering Technology', description: 'Integration of mechanical, electrical, and computer engineering' },
  { name: 'Science Laboratory Technology', description: 'Laboratory analysis, testing, and quality control' },
  { name: 'Textile Technology', description: 'Textile manufacturing, quality control, and process optimization' },
  { name: 'Printing Technology', description: 'Print production, workflow, and quality management' },
  { name: 'Pharmaceutical Technology', description: 'Drug development, quality control, and pharmaceutical systems' },
  { name: 'Welding & Fabrication Technology', description: 'Metal fabrication, welding processes, and quality assurance' },
  { name: 'Fashion Design & Clothing Technology', description: 'Fashion design, garment production, and inventory management' }
];

export const courseBasedProjects = [
  // Computer Science Projects
  {
    title: "Student Result Management System",
    description: "A comprehensive web-based system for managing student academic records, grades, and transcripts. Features include grade entry, report generation, transcript printing, and academic analytics. Built with modern web technologies for scalability and user-friendly interface.",
    courseName: "Computer Science",
    documentationPrice: 25.00,
    softwarePrice: 50.00,
    fullProjectPrice: 70.00,
    techStack: ["React", "Node.js", "MySQL", "Express", "JWT"],
    tags: ["Web Application", "Database", "Management System", "React", "Node.js"]
  },
  {
    title: "Online Examination System",
    description: "A secure online examination platform with automated question generation, timer functionality, plagiarism detection, and instant result processing. Includes admin panel for question bank management and student performance analytics.",
    courseName: "Computer Science",
    documentationPrice: 28.00,
    softwarePrice: 55.00,
    fullProjectPrice: 80.00,
    techStack: ["React", "Node.js", "MongoDB", "Socket.io", "PDF Generation"],
    tags: ["E-Learning", "Online Testing", "Real-Time", "React", "Node.js"]
  },
  {
    title: "AI-Based Recommendation System",
    description: "An intelligent recommendation engine using machine learning algorithms to provide personalized suggestions. Includes collaborative filtering, content-based filtering, and hybrid approaches. Features data preprocessing, model training, and API integration.",
    courseName: "Computer Science",
    documentationPrice: 30.00,
    softwarePrice: 60.00,
    fullProjectPrice: 85.00,
    techStack: ["Python", "TensorFlow", "Flask", "Pandas", "Scikit-learn"],
    tags: ["Machine Learning", "AI", "Recommendation System", "Python", "TensorFlow"]
  },

  // Computer Engineering Projects
  {
    title: "Smart Attendance System Using RFID",
    description: "An automated attendance management system using RFID technology. Includes RFID reader integration, database storage, real-time attendance tracking, and report generation. Features web dashboard for monitoring and analytics.",
    courseName: "Computer Engineering",
    documentationPrice: 22.00,
    softwarePrice: 45.00,
    fullProjectPrice: 65.00,
    techStack: ["Arduino", "RFID Module", "PHP", "MySQL", "REST API"],
    tags: ["Embedded Systems", "RFID", "IoT", "Arduino", "Automation"]
  },
  {
    title: "Embedded Home Automation System",
    description: "A comprehensive home automation solution using microcontrollers and IoT technology. Controls lighting, temperature, security, and appliances remotely. Includes mobile app interface, sensor integration, and scheduling features.",
    courseName: "Computer Engineering",
    documentationPrice: 25.00,
    softwarePrice: 50.00,
    fullProjectPrice: 72.00,
    techStack: ["Arduino", "ESP32", "Android", "MQTT", "Sensors"],
    tags: ["IoT", "Home Automation", "Embedded Systems", "Arduino", "Mobile App"]
  },
  {
    title: "Microcontroller-Based Traffic Light System",
    description: "An intelligent traffic light control system using microcontrollers with adaptive timing based on traffic density. Includes sensor integration, LCD display, and emergency vehicle priority. Complete with circuit diagrams and programming code.",
    courseName: "Computer Engineering",
    documentationPrice: 20.00,
    softwarePrice: 40.00,
    fullProjectPrice: 55.00,
    techStack: ["8051 Microcontroller", "C Programming", "LED Control", "Sensors"],
    tags: ["Embedded Systems", "Traffic Control", "Microcontroller", "Automation"]
  },

  // Electrical / Electronic Engineering Technology Projects
  {
    title: "Solar Power Inverter Design & Analysis",
    description: "Complete design and analysis of a solar power inverter system. Includes circuit design, component selection, efficiency analysis, and performance testing. Features detailed documentation with calculations, schematics, and test results.",
    courseName: "Electrical / Electronic Engineering Technology",
    documentationPrice: 30.00,
    softwarePrice: 0,
    fullProjectPrice: 0,
    techStack: ["Power Electronics", "Circuit Design", "Simulation Software"],
    tags: ["Power Systems", "Renewable Energy", "Inverter Design", "Solar Energy"]
  },
  {
    title: "Automatic Voltage Regulator System",
    description: "Complete design and analysis documentation for an automatic voltage regulator (AVR) system for power stabilization. Includes circuit design, component selection, performance analysis, and testing procedures. Features detailed technical documentation with calculations, schematics, and test results.",
    courseName: "Electrical / Electronic Engineering Technology",
    documentationPrice: 25.00,
    softwarePrice: 0,
    fullProjectPrice: 0,
    techStack: ["Power Electronics", "Circuit Design", "Technical Documentation"],
    tags: ["Power Systems", "Voltage Regulation", "Documentation", "Electrical Engineering"]
  },
  {
    title: "Smart Energy Meter Documentation",
    description: "Comprehensive documentation for a smart energy meter system with remote monitoring capabilities. Includes system architecture, communication protocols, data logging, and billing system design. Features detailed technical specifications and implementation guide.",
    courseName: "Electrical / Electronic Engineering Technology",
    documentationPrice: 22.00,
    softwarePrice: 0,
    fullProjectPrice: 0,
    techStack: ["IoT", "Energy Monitoring", "Communication Protocols"],
    tags: ["Smart Meter", "Energy Management", "IoT", "Documentation"]
  },

  // Mechanical Engineering Technology Projects
  {
    title: "Design and Fabrication of Hydraulic Press",
    description: "Complete design, analysis, and fabrication documentation for a hydraulic press system. Includes CAD drawings, material selection, stress analysis, manufacturing process, and testing procedures. Features detailed engineering calculations and safety considerations.",
    courseName: "Mechanical Engineering Technology",
    documentationPrice: 28.00,
    softwarePrice: 0,
    fullProjectPrice: 0,
    techStack: ["CAD Software", "Engineering Analysis", "Manufacturing"],
    tags: ["Hydraulic Systems", "Machine Design", "Fabrication", "CAD"]
  },
  {
    title: "Heat Exchanger Performance Analysis",
    description: "Comprehensive analysis of heat exchanger performance including thermal calculations, efficiency evaluation, and optimization studies. Features experimental data analysis, simulation results, and design recommendations. Complete with mathematical models and test procedures.",
    courseName: "Mechanical Engineering Technology",
    documentationPrice: 25.00,
    softwarePrice: 0,
    fullProjectPrice: 0,
    techStack: ["Thermal Analysis", "Simulation Software", "Data Analysis"],
    tags: ["Heat Transfer", "Thermal Engineering", "Performance Analysis", "Simulation"]
  },
  {
    title: "Automated Conveyor Belt System",
    description: "Comprehensive documentation for an automated conveyor belt system design including mechanical design, electrical schematics, PLC programming logic, and automation procedures. Features detailed system architecture, sensor integration specifications, speed control mechanisms, and safety system documentation.",
    courseName: "Mechanical Engineering Technology",
    documentationPrice: 22.00,
    softwarePrice: 0,
    fullProjectPrice: 0,
    techStack: ["Mechanical Design", "PLC Documentation", "Automation Design", "Technical Documentation"],
    tags: ["Automation", "Conveyor System", "Mechanical Engineering", "Documentation"]
  },

  // Civil Engineering Technology Projects
  {
    title: "Structural Analysis of Residential Building",
    description: "Complete structural analysis of a residential building including load calculations, beam and column design, foundation analysis, and safety factor evaluation. Features detailed calculations, CAD drawings, and compliance with building codes.",
    courseName: "Civil Engineering Technology",
    documentationPrice: 30.00,
    softwarePrice: 0,
    fullProjectPrice: 0,
    techStack: ["Structural Analysis Software", "CAD", "Engineering Calculations"],
    tags: ["Structural Engineering", "Building Design", "Analysis", "CAD"]
  },
  {
    title: "Flood Control Drainage Design",
    description: "Comprehensive drainage system design for flood control including hydraulic calculations, channel design, and stormwater management. Features topographic analysis, flow calculations, and environmental impact assessment. Complete with design drawings and specifications.",
    courseName: "Civil Engineering Technology",
    documentationPrice: 25.00,
    softwarePrice: 0,
    fullProjectPrice: 0,
    techStack: ["Hydraulic Design", "CAD Software", "Environmental Analysis"],
    tags: ["Drainage Design", "Flood Control", "Hydraulic Engineering", "Environmental"]
  },
  {
    title: "Concrete Strength Testing Documentation",
    description: "Complete documentation of concrete strength testing procedures including mix design, sample preparation, testing methods, and result analysis. Features statistical analysis, quality control procedures, and compliance with standards. Includes test data and recommendations.",
    courseName: "Civil Engineering Technology",
    documentationPrice: 20.00,
    softwarePrice: 0,
    fullProjectPrice: 0,
    techStack: ["Testing Procedures", "Data Analysis", "Quality Control"],
    tags: ["Concrete Testing", "Material Science", "Quality Control", "Documentation"]
  },

  // Mechatronics Engineering Technology Projects
  {
    title: "PLC-Based Industrial Automation System",
    description: "Comprehensive documentation for an industrial automation system using Programmable Logic Controllers (PLC). Includes system design, ladder logic documentation, HMI interface specifications, sensor integration procedures, and motor control documentation. Features detailed wiring diagrams, operational procedures, and maintenance guidelines.",
    courseName: "Mechatronics Engineering Technology",
    documentationPrice: 25.00,
    softwarePrice: 0,
    fullProjectPrice: 0,
    techStack: ["PLC Documentation", "Automation Design", "Technical Documentation", "Industrial Control"],
    tags: ["PLC", "Industrial Automation", "Control Systems", "Documentation"]
  },
  {
    title: "Automated Bottle Filling Machine",
    description: "Complete design documentation for an automated bottle filling system including mechanical design, level detection mechanisms, conveyor control specifications, and quality assurance procedures. Features detailed system architecture, sensor integration documentation, and operational manual.",
    courseName: "Mechatronics Engineering Technology",
    documentationPrice: 22.00,
    softwarePrice: 0,
    fullProjectPrice: 0,
    techStack: ["Mechanical Design", "Automation Documentation", "Technical Documentation", "Manufacturing"],
    tags: ["Automation", "Manufacturing", "Mechatronics", "Documentation"]
  },
  {
    title: "Smart Robotic Arm Design",
    description: "Comprehensive design documentation for a 6-DOF robotic arm system including mechanical design, servo motor specifications, inverse kinematics calculations, and control system architecture. Features detailed design calculations, simulation methodology, and performance analysis documentation.",
    courseName: "Mechatronics Engineering Technology",
    documentationPrice: 28.00,
    softwarePrice: 0,
    fullProjectPrice: 0,
    techStack: ["Robotics Design", "Control Systems Documentation", "Mechanical Engineering", "Technical Documentation"],
    tags: ["Robotics", "Control Systems", "Mechatronics", "Documentation"]
  },

  // Science Laboratory Technology Projects
  {
    title: "Water Quality Analysis System",
    description: "Complete documentation for a water quality analysis system including testing procedures, data collection methods, and report generation protocols. Includes pH, turbidity, dissolved oxygen, and chemical analysis procedures. Features detailed laboratory protocols, statistical analysis methods, and quality control documentation.",
    courseName: "Science Laboratory Technology",
    documentationPrice: 22.00,
    softwarePrice: 0,
    fullProjectPrice: 0,
    techStack: ["Laboratory Procedures", "Data Analysis Documentation", "Quality Control", "Technical Documentation"],
    tags: ["Water Analysis", "Laboratory Testing", "Documentation", "Quality Control"]
  },
  {
    title: "Microbial Contamination Study",
    description: "Complete documentation of microbial contamination analysis including sampling procedures, culture techniques, identification methods, and statistical analysis. Features experimental protocols, data collection forms, and result interpretation guidelines.",
    courseName: "Science Laboratory Technology",
    documentationPrice: 25.00,
    softwarePrice: 0,
    fullProjectPrice: 0,
    techStack: ["Laboratory Procedures", "Data Analysis", "Microbiology"],
    tags: ["Microbiology", "Contamination Analysis", "Laboratory Study", "Documentation"]
  },
  {
    title: "Laboratory Safety Management Documentation",
    description: "Comprehensive laboratory safety management system documentation including safety protocols, hazard identification, emergency procedures, and compliance guidelines. Features safety checklists, incident reporting forms, and training materials.",
    courseName: "Science Laboratory Technology",
    documentationPrice: 20.00,
    softwarePrice: 0,
    fullProjectPrice: 0,
    techStack: ["Safety Management", "Documentation", "Compliance"],
    tags: ["Laboratory Safety", "Management System", "Documentation", "Compliance"]
  },

  // Textile Technology Projects
  {
    title: "Fabric Quality Inspection System",
    description: "Comprehensive documentation for a fabric quality inspection system including inspection procedures, defect detection methodologies, quality grading standards, and report generation protocols. Features detailed technical specifications, camera integration documentation, and quality control procedures.",
    courseName: "Textile Technology",
    documentationPrice: 23.00,
    softwarePrice: 0,
    fullProjectPrice: 0,
    techStack: ["Quality Control Documentation", "Technical Documentation", "Textile Technology", "Inspection Procedures"],
    tags: ["Quality Control", "Textile Technology", "Documentation", "Inspection"]
  },
  {
    title: "Dyeing Process Optimization Study",
    description: "Comprehensive study on dyeing process optimization including parameter analysis, efficiency evaluation, and cost optimization. Features experimental data, statistical analysis, and process improvement recommendations. Complete with technical documentation and results.",
    courseName: "Textile Technology",
    documentationPrice: 24.00,
    softwarePrice: 0,
    fullProjectPrice: 0,
    techStack: ["Process Analysis", "Data Analysis", "Optimization"],
    tags: ["Textile Processing", "Process Optimization", "Dyeing", "Documentation"]
  },
  {
    title: "Textile Production Workflow Documentation",
    description: "Complete documentation of textile production workflow including process mapping, quality control checkpoints, and efficiency analysis. Features workflow diagrams, standard operating procedures, and performance metrics. Includes improvement recommendations.",
    courseName: "Textile Technology",
    documentationPrice: 21.00,
    softwarePrice: 0,
    fullProjectPrice: 0,
    techStack: ["Workflow Documentation", "Process Mapping", "Quality Control"],
    tags: ["Textile Production", "Workflow Management", "Documentation", "Process Analysis"]
  },

  // Printing Technology Projects
  {
    title: "Digital Printing Workflow Automation",
    description: "Complete documentation for digital printing workflow automation including job scheduling procedures, color management protocols, and quality control standards. Features detailed workflow documentation, print queue management procedures, and reporting system specifications.",
    courseName: "Printing Technology",
    documentationPrice: 22.00,
    softwarePrice: 0,
    fullProjectPrice: 0,
    techStack: ["Workflow Documentation", "Print Management", "Technical Documentation", "Quality Control"],
    tags: ["Printing Technology", "Workflow Documentation", "Digital Printing", "Documentation"]
  },
  {
    title: "Print Quality Control System",
    description: "Comprehensive documentation for print quality control system including color accuracy measurement procedures, defect detection methodologies, and quality grading standards. Features detailed technical specifications, color calibration procedures, and statistical analysis documentation.",
    courseName: "Printing Technology",
    documentationPrice: 23.00,
    softwarePrice: 0,
    fullProjectPrice: 0,
    techStack: ["Quality Control Documentation", "Technical Documentation", "Color Management", "Printing Technology"],
    tags: ["Quality Control", "Printing", "Documentation", "Color Management"]
  },
  {
    title: "Offset Printing Process Analysis",
    description: "Comprehensive analysis of offset printing processes including parameter optimization, efficiency evaluation, and cost analysis. Features experimental data, process flow diagrams, and improvement recommendations. Complete with technical documentation.",
    courseName: "Printing Technology",
    documentationPrice: 24.00,
    softwarePrice: 0,
    fullProjectPrice: 0,
    techStack: ["Process Analysis", "Data Analysis", "Technical Documentation"],
    tags: ["Offset Printing", "Process Analysis", "Documentation", "Printing Technology"]
  },

  // Pharmaceutical Technology Projects
  {
    title: "Drug Inventory Management System",
    description: "Comprehensive drug inventory management system with stock tracking, expiry date monitoring, and automated reordering. Features barcode scanning, batch tracking, and reporting tools. Includes web interface and mobile app for field access.",
    courseName: "Pharmaceutical Technology",
    documentationPrice: 25.00,
    softwarePrice: 50.00,
    fullProjectPrice: 72.00,
    techStack: ["Web Application", "Mobile App", "Database", "Barcode System"],
    tags: ["Inventory Management", "Pharmaceutical", "Database", "Mobile App"]
  },
  {
    title: "Tablet Dissolution Analysis Documentation",
    description: "Complete documentation of tablet dissolution testing procedures including methodology, equipment setup, data collection, and result analysis. Features statistical analysis, compliance with pharmacopoeial standards, and quality assurance protocols.",
    courseName: "Pharmaceutical Technology",
    documentationPrice: 26.00,
    softwarePrice: 0,
    fullProjectPrice: 0,
    techStack: ["Laboratory Procedures", "Data Analysis", "Quality Assurance"],
    tags: ["Pharmaceutical Analysis", "Quality Control", "Documentation", "Testing"]
  },
  {
    title: "Pharmaceutical Quality Control System",
    description: "Automated quality control system for pharmaceutical manufacturing including batch tracking, test result management, and compliance monitoring. Features database integration, reporting tools, and audit trail. Includes web-based interface and data analytics.",
    courseName: "Pharmaceutical Technology",
    documentationPrice: 24.00,
    softwarePrice: 49.00,
    fullProjectPrice: 70.00,
    techStack: ["Web Application", "Database", "Quality Control", "Analytics"],
    tags: ["Quality Control", "Pharmaceutical", "Compliance", "Management System"]
  },

  // Welding & Fabrication Technology Projects
  {
    title: "Metal Strength Testing Analysis",
    description: "Comprehensive analysis of metal strength testing including tensile, compression, and hardness tests. Features experimental procedures, data collection, statistical analysis, and material characterization. Complete with test results and material specifications.",
    courseName: "Welding & Fabrication Technology",
    documentationPrice: 23.00,
    softwarePrice: 0,
    fullProjectPrice: 0,
    techStack: ["Material Testing", "Data Analysis", "Statistical Analysis"],
    tags: ["Material Testing", "Strength Analysis", "Welding", "Documentation"]
  },
  {
    title: "Welding Defect Detection Study",
    description: "Study on welding defect detection using non-destructive testing methods including ultrasonic testing, radiographic inspection, and visual examination. Features defect classification, analysis procedures, and quality assessment guidelines.",
    courseName: "Welding & Fabrication Technology",
    documentationPrice: 24.00,
    softwarePrice: 0,
    fullProjectPrice: 0,
    techStack: ["NDT Methods", "Quality Control", "Technical Documentation"],
    tags: ["Welding", "Defect Detection", "Quality Control", "NDT"]
  },
  {
    title: "Fabrication Workshop Safety System",
    description: "Comprehensive safety management system for fabrication workshops including hazard identification, safety protocols, emergency procedures, and compliance monitoring. Features safety checklists, incident reporting, and training documentation.",
    courseName: "Welding & Fabrication Technology",
    documentationPrice: 21.00,
    softwarePrice: 0,
    fullProjectPrice: 0,
    techStack: ["Safety Management", "Documentation", "Compliance"],
    tags: ["Workshop Safety", "Safety Management", "Documentation", "Compliance"]
  },

  // Fashion Design & Clothing Technology Projects
  {
    title: "Fashion Inventory & Order Management System",
    description: "Complete documentation for a fashion inventory and order management system including stock tracking procedures, order processing workflows, supplier management protocols, and sales analytics documentation. Features detailed system specifications, barcode system documentation, and reporting procedures.",
    courseName: "Fashion Design & Clothing Technology",
    documentationPrice: 22.00,
    softwarePrice: 0,
    fullProjectPrice: 0,
    techStack: ["Inventory Management Documentation", "Fashion Retail Procedures", "Technical Documentation", "Workflow Design"],
    tags: ["Inventory Management", "Fashion Retail", "Documentation", "Workflow"]
  },
  {
    title: "Clothing Size Recommendation System",
    description: "Comprehensive documentation for a clothing size recommendation system including measurement procedures, size calculation methodologies, and recommendation algorithms. Features detailed technical specifications, customer measurement protocols, and analytics documentation.",
    courseName: "Fashion Design & Clothing Technology",
    documentationPrice: 24.00,
    softwarePrice: 0,
    fullProjectPrice: 0,
    techStack: ["Fashion Technology Documentation", "Measurement Procedures", "Technical Documentation", "Design Documentation"],
    tags: ["Fashion Technology", "Documentation", "Design", "Technical Documentation"]
  },
  {
    title: "Garment Production Process Documentation",
    description: "Comprehensive documentation of garment production processes including pattern making, cutting, sewing, and finishing. Features process flow diagrams, time studies, quality control checkpoints, and efficiency analysis. Includes improvement recommendations.",
    courseName: "Fashion Design & Clothing Technology",
    documentationPrice: 23.00,
    softwarePrice: 0,
    fullProjectPrice: 0,
    techStack: ["Process Documentation", "Workflow Analysis", "Quality Control"],
    tags: ["Garment Production", "Process Documentation", "Fashion Technology", "Manufacturing"]
  }
];

// Helper function to generate file names
export const generateFileName = (title, type) => {
  const sanitized = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  
  if (type === 'documentation') {
    return `${sanitized}_documentation.pdf`;
  } else if (type === 'software') {
    return `${sanitized}_software.zip`;
  } else if (type === 'thumbnail') {
    return `${sanitized}_thumbnail.png`;
  }
  return sanitized;
};
