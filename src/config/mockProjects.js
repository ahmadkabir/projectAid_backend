// Mock Projects Data for ProjectAid Platform
// 20 realistic projects across different categories

export const mockProjects = [
  // Web Development Projects
  {
    title: "E-Commerce Platform with Payment Integration",
    description: "A full-stack e-commerce platform built with React and Node.js, featuring secure payment processing, shopping cart functionality, order management, and admin dashboard. Includes user authentication, product catalog, and real-time inventory management.",
    categoryName: "Web Development",
    documentationPrice: 25.00,
    softwarePrice: 45.00,
    fullProjectPrice: 65.00,
    techStack: ["React", "Node.js", "MongoDB", "Stripe API", "Express"],
    tags: ["E-Commerce", "Payment", "Full-Stack", "React", "Node.js"]
  },
  {
    title: "Social Media Dashboard with Analytics",
    description: "A comprehensive social media management dashboard that allows users to schedule posts, track engagement metrics, and analyze performance across multiple platforms. Built with modern web technologies and responsive design.",
    categoryName: "Web Development",
    documentationPrice: 20.00,
    softwarePrice: 40.00,
    fullProjectPrice: 55.00,
    techStack: ["React", "TypeScript", "Chart.js", "REST API", "Firebase"],
    tags: ["Social Media", "Analytics", "Dashboard", "React", "TypeScript"]
  },
  {
    title: "Task Management System Documentation",
    description: "Complete documentation for a task management system including system architecture, database design, API documentation, user guides, and deployment instructions. Perfect for understanding project management software development.",
    categoryName: "Web Development",
    documentationPrice: 15.00,
    softwarePrice: 0,
    fullProjectPrice: 0,
    techStack: ["Documentation", "System Design", "API Design"],
    tags: ["Documentation", "Task Management", "System Design"]
  },
  {
    title: "Real-Time Chat Application",
    description: "A real-time messaging application with WebSocket support, featuring private and group chats, file sharing, message history, and user presence indicators. Built with React frontend and Node.js backend.",
    categoryName: "Web Development",
    documentationPrice: 22.00,
    softwarePrice: 50.00,
    fullProjectPrice: 70.00,
    techStack: ["React", "Socket.io", "Node.js", "MongoDB", "JWT"],
    tags: ["Real-Time", "Chat", "WebSocket", "React", "Node.js"]
  },
  {
    title: "Blog Platform with CMS",
    description: "A content management system for blogs with rich text editor, media uploads, SEO optimization, comment system, and admin panel. Includes user roles and permissions management.",
    categoryName: "Web Development",
    documentationPrice: 18.00,
    softwarePrice: 35.00,
    fullProjectPrice: 50.00,
    techStack: ["React", "Node.js", "PostgreSQL", "Rich Text Editor", "AWS S3"],
    tags: ["Blog", "CMS", "Content Management", "React", "PostgreSQL"]
  },

  // Mobile Development Projects
  {
    title: "Fitness Tracking Mobile App",
    description: "A comprehensive fitness tracking application for iOS and Android with workout logging, progress tracking, calorie counter, and social features. Includes charts and statistics visualization.",
    categoryName: "Mobile Development",
    documentationPrice: 28.00,
    softwarePrice: 55.00,
    fullProjectPrice: 80.00,
    techStack: ["React Native", "Firebase", "Chart.js", "Redux", "Expo"],
    tags: ["Mobile", "Fitness", "Health", "React Native", "Firebase"]
  },
  {
    title: "Food Delivery App - Software Only",
    description: "Complete source code for a food delivery mobile application with restaurant listings, menu browsing, cart management, order tracking, and payment integration. Ready for deployment.",
    categoryName: "Mobile Development",
    documentationPrice: 0,
    softwarePrice: 50.00,
    fullProjectPrice: 0,
    techStack: ["Flutter", "Firebase", "Google Maps API", "Payment Gateway"],
    tags: ["Mobile", "Food Delivery", "Flutter", "Firebase", "E-Commerce"]
  },
  {
    title: "Weather Forecast Application",
    description: "A beautiful weather application with location-based forecasts, hourly and daily predictions, weather maps, and alerts. Features smooth animations and intuitive user interface.",
    categoryName: "Mobile Development",
    documentationPrice: 20.00,
    softwarePrice: 38.00,
    fullProjectPrice: 55.00,
    techStack: ["React Native", "Weather API", "AsyncStorage", "Geolocation"],
    tags: ["Mobile", "Weather", "API Integration", "React Native"]
  },
  {
    title: "Expense Tracker Mobile App",
    description: "Personal finance management app with expense tracking, budget planning, category-based spending analysis, and export functionality. Includes beautiful charts and reports.",
    categoryName: "Mobile Development",
    documentationPrice: 25.00,
    softwarePrice: 45.00,
    fullProjectPrice: 65.00,
    techStack: ["Flutter", "SQLite", "Charts", "Local Storage"],
    tags: ["Mobile", "Finance", "Expense Tracking", "Flutter", "SQLite"]
  },
  {
    title: "Language Learning App Documentation",
    description: "Complete documentation package for a language learning mobile application including requirements analysis, system design, database schema, API documentation, and testing strategies.",
    categoryName: "Mobile Development",
    documentationPrice: 30.00,
    softwarePrice: 0,
    fullProjectPrice: 0,
    techStack: ["Documentation", "System Design", "Mobile Architecture"],
    tags: ["Documentation", "Language Learning", "Mobile Design"]
  },

  // Data Science Projects
  {
    title: "Customer Churn Prediction Model",
    description: "Machine learning project for predicting customer churn using various algorithms including Random Forest, XGBoost, and Neural Networks. Includes data preprocessing, feature engineering, model evaluation, and deployment guide.",
    categoryName: "Data Science",
    documentationPrice: 28.00,
    softwarePrice: 55.00,
    fullProjectPrice: 80.00,
    techStack: ["Python", "Scikit-learn", "Pandas", "NumPy", "Jupyter"],
    tags: ["Machine Learning", "Churn Prediction", "Python", "Data Science"]
  },
  {
    title: "Sentiment Analysis Tool",
    description: "Natural language processing application for analyzing sentiment in text data. Includes data collection, preprocessing, model training, and API for real-time sentiment analysis. Perfect for social media monitoring.",
    categoryName: "Data Science",
    documentationPrice: 25.00,
    softwarePrice: 48.00,
    fullProjectPrice: 70.00,
    techStack: ["Python", "NLTK", "TensorFlow", "Flask", "TextBlob"],
    tags: ["NLP", "Sentiment Analysis", "Python", "Machine Learning"]
  },
  {
    title: "Sales Forecasting Dashboard",
    description: "Data visualization dashboard for sales forecasting with time series analysis, trend prediction, and interactive charts. Includes data preprocessing scripts and forecasting models.",
    categoryName: "Data Science",
    documentationPrice: 22.00,
    softwarePrice: 42.00,
    fullProjectPrice: 60.00,
    techStack: ["Python", "Plotly", "Pandas", "Prophet", "Dash"],
    tags: ["Data Visualization", "Forecasting", "Python", "Dashboard"]
  },
  {
    title: "Image Classification System - Software Only",
    description: "Complete source code for an image classification system using deep learning. Includes CNN models, data augmentation, model training scripts, and inference code. Ready to use with your own datasets.",
    categoryName: "Data Science",
    documentationPrice: 0,
    softwarePrice: 60.00,
    fullProjectPrice: 0,
    techStack: ["Python", "TensorFlow", "Keras", "OpenCV", "NumPy"],
    tags: ["Deep Learning", "Image Classification", "CNN", "TensorFlow"]
  },
  {
    title: "Stock Market Analysis Tool",
    description: "Comprehensive stock market analysis application with data collection, technical indicators, trend analysis, and prediction models. Includes visualization tools and portfolio management features.",
    categoryName: "Data Science",
    documentationPrice: 30.00,
    softwarePrice: 58.00,
    fullProjectPrice: 85.00,
    techStack: ["Python", "Yahoo Finance API", "Matplotlib", "Pandas", "Scikit-learn"],
    tags: ["Finance", "Stock Analysis", "Python", "Data Analysis"]
  },

  // Desktop Applications Projects
  {
    title: "Library Management System",
    description: "A complete desktop application for managing library operations including book cataloging, member management, issue/return tracking, fine calculation, and report generation. Built with modern desktop framework.",
    categoryName: "Desktop Applications",
    documentationPrice: 20.00,
    softwarePrice: 40.00,
    fullProjectPrice: 55.00,
    techStack: ["Java", "JavaFX", "MySQL", "JDBC", "Maven"],
    tags: ["Desktop", "Library Management", "Java", "JavaFX", "Database"]
  },
  {
    title: "Student Information System",
    description: "Comprehensive student information management system with enrollment, attendance tracking, grade management, and report generation. Features role-based access control and data export capabilities.",
    categoryName: "Desktop Applications",
    documentationPrice: 25.00,
    softwarePrice: 45.00,
    fullProjectPrice: 65.00,
    techStack: ["C#", ".NET", "SQL Server", "Entity Framework", "WPF"],
    tags: ["Desktop", "Student Management", "C#", ".NET", "Database"]
  },
  {
    title: "Inventory Management System Documentation",
    description: "Complete documentation package for an inventory management system including requirements specification, system design, database design, user manual, and deployment guide. Perfect for understanding enterprise application development.",
    categoryName: "Desktop Applications",
    documentationPrice: 18.00,
    softwarePrice: 0,
    fullProjectPrice: 0,
    techStack: ["Documentation", "System Design", "Database Design"],
    tags: ["Documentation", "Inventory Management", "System Design"]
  },
  {
    title: "Text Editor with Syntax Highlighting",
    description: "Advanced text editor application with syntax highlighting for multiple programming languages, code folding, search and replace, file management, and plugin support. Built with Electron framework.",
    categoryName: "Desktop Applications",
    documentationPrice: 15.00,
    softwarePrice: 35.00,
    fullProjectPrice: 45.00,
    techStack: ["Electron", "JavaScript", "Node.js", "CodeMirror", "File System"],
    tags: ["Desktop", "Text Editor", "Electron", "JavaScript", "Code Editor"]
  },
  {
    title: "Hospital Management System",
    description: "Complete hospital management system with patient registration, appointment scheduling, medical records management, billing system, and staff management. Includes comprehensive reporting features.",
    categoryName: "Desktop Applications",
    documentationPrice: 30.00,
    softwarePrice: 55.00,
    fullProjectPrice: 80.00,
    techStack: ["Python", "Tkinter", "SQLite", "ReportLab", "Pillow"],
    tags: ["Desktop", "Hospital Management", "Python", "Tkinter", "Database"]
  },
  {
    title: "Password Manager Application",
    description: "Secure password management desktop application with encryption, password generation, secure storage, and cross-platform support. Features master password protection and backup functionality.",
    categoryName: "Desktop Applications",
    documentationPrice: 22.00,
    softwarePrice: 42.00,
    fullProjectPrice: 60.00,
    techStack: ["Python", "Cryptography", "SQLite", "PyQt5", "Keyring"],
    tags: ["Desktop", "Security", "Password Manager", "Python", "Encryption"]
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
