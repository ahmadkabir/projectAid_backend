import sequelize from './database.js';
import { User, ProjectCategory, Project } from '../models/index.js';
import bcrypt from 'bcryptjs';
import { courses, courseBasedProjects, generateFileName } from './courseBasedProjects.js';

async function seed() {
  try {
    await sequelize.authenticate();
    console.log('Database connection established.');
    console.log('Starting database seeding...');

    console.log('Preparing seed data...');

    // Create Admin User
    const hashedAdminPassword = await bcrypt.hash('admin123', 10);
    const [admin, adminCreated] = await User.findOrCreate({
      where: { email: 'admin@projectaid.com' },
      defaults: {
        name: 'Admin User',
        email: 'admin@projectaid.com',
        password: hashedAdminPassword,
        role: 'admin'
      }
    });
    if (adminCreated) {
      console.log('Admin user created:', admin.email);
    } else {
      console.log('Admin user already exists:', admin.email);
    }

    // Create Student User
    const hashedStudentPassword = await bcrypt.hash('student123', 10);
    const [student, studentCreated] = await User.findOrCreate({
      where: { email: 'student@projectaid.com' },
      defaults: {
        name: 'Student User',
        email: 'student@projectaid.com',
        password: hashedStudentPassword,
        role: 'student'
      }
    });
    if (studentCreated) {
      console.log('Student user created:', student.email);
    } else {
      console.log('Student user already exists:', student.email);
    }

    // Create Parent Category: Technology & Engineering
    const [parentCategory, parentCreated] = await ProjectCategory.findOrCreate({
      where: { name: 'Technology & Engineering' },
      defaults: { description: 'Technology and engineering courses and projects' }
    });
    if (parentCreated) {
      console.log('Parent category created: Technology & Engineering');
    } else {
      console.log('Parent category already exists: Technology & Engineering');
    }

    // Create Course Categories
    const createdCategories = {};
    for (const course of courses) {
      const [category, created] = await ProjectCategory.findOrCreate({
        where: { name: course.name },
        defaults: { description: course.description }
      });
      createdCategories[course.name] = category;
      if (created) {
        console.log(`Course category created: ${category.name}`);
      } else {
        console.log(`Course category already exists: ${category.name}`);
      }
    }

    // Create Course-Based Projects
    console.log('\nCreating course-based projects...');
    let createdCount = 0;
    let skippedCount = 0;
    
    for (const mockProject of courseBasedProjects) {
      const category = createdCategories[mockProject.courseName];
      
      if (!category) {
        console.warn(`⚠ Course not found: ${mockProject.courseName}, skipping project: ${mockProject.title}`);
        skippedCount++;
        continue;
      }

      // Check if project already exists
      const existing = await Project.findOne({
        where: { title: mockProject.title }
      });

      if (existing) {
        console.log(`⊘ Project already exists: ${mockProject.title}`);
        skippedCount++;
        continue;
      }

      // Generate file names
      const docFile = mockProject.documentationPrice > 0 
        ? generateFileName(mockProject.title, 'documentation') 
        : null;
      const softwareFile = mockProject.softwarePrice > 0 
        ? generateFileName(mockProject.title, 'software') 
        : null;
      const thumbnail = generateFileName(mockProject.title, 'thumbnail');

      const project = await Project.create({
        title: mockProject.title,
        description: mockProject.description,
        categoryId: category.id,
        documentationPrice: mockProject.documentationPrice,
        softwarePrice: mockProject.softwarePrice,
        fullProjectPrice: mockProject.fullProjectPrice,
        documentationFile: docFile,
        softwareFile: softwareFile,
        thumbnail: thumbnail,
        status: 'active'
      });

      console.log(`✓ Created project: ${project.title} (${mockProject.courseName})`);
      createdCount++;
    }

    console.log('\n✅ Database seeding completed successfully!');
    console.log(`\nSummary:`);
    console.log(`- Users: ${await User.count()} total`);
    console.log(`- Categories: ${await ProjectCategory.count()} total (1 parent + ${courses.length} courses)`);
    console.log(`- Projects: ${await Project.count()} total (${createdCount} created, ${skippedCount} skipped)`);
    console.log(`\nLogin credentials:`);
    console.log(`Admin: admin@projectaid.com / admin123`);
    console.log(`Student: student@projectaid.com / student123`);
    console.log(`\nNote: Run 'npm run generate-files' to create mock PDF and ZIP files.`);

    await sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  }
}

seed();
