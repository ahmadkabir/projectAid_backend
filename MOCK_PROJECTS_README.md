# Mock Projects for ProjectAid Platform

This document describes the 20 mock projects that have been generated for testing the ProjectAid platform.

## Project Distribution

### Web Development (5 projects)
1. **E-Commerce Platform with Payment Integration** - Full Project ($65)
2. **Social Media Dashboard with Analytics** - Full Project ($55)
3. **Task Management System Documentation** - Documentation Only ($15)
4. **Real-Time Chat Application** - Full Project ($70)
5. **Blog Platform with CMS** - Full Project ($50)

### Mobile Development (5 projects)
6. **Fitness Tracking Mobile App** - Full Project ($80)
7. **Food Delivery App** - Software Only ($50)
8. **Weather Forecast Application** - Full Project ($55)
9. **Expense Tracker Mobile App** - Full Project ($65)
10. **Language Learning App Documentation** - Documentation Only ($30)

### Data Science (5 projects)
11. **Customer Churn Prediction Model** - Full Project ($80)
12. **Sentiment Analysis Tool** - Full Project ($70)
13. **Sales Forecasting Dashboard** - Full Project ($60)
14. **Image Classification System** - Software Only ($60)
15. **Stock Market Analysis Tool** - Full Project ($85)

### Desktop Applications (5 projects)
16. **Library Management System** - Full Project ($55)
17. **Student Information System** - Full Project ($65)
18. **Inventory Management System Documentation** - Documentation Only ($18)
19. **Text Editor with Syntax Highlighting** - Full Project ($45)
20. **Hospital Management System** - Full Project ($80)
21. **Password Manager Application** - Full Project ($60)

## Pricing Structure

- **Documentation Only**: $10 - $30
- **Software Only**: $30 - $60
- **Full Project**: $45 - $85

## Project Types Distribution

- **Full Projects**: 15 projects
- **Documentation Only**: 3 projects
- **Software Only**: 2 projects

## Technology Stacks

Projects include various tech stacks:
- **Web**: React, Node.js, MongoDB, Express, TypeScript, Firebase
- **Mobile**: React Native, Flutter, Expo, Firebase
- **Data Science**: Python, TensorFlow, Scikit-learn, Pandas, NumPy
- **Desktop**: Java, C#, Python, Electron, .NET

## File Structure

Each project includes:
- **Documentation PDF** (if documentationPrice > 0)
- **Software ZIP** (if softwarePrice > 0)
- **Thumbnail image** (placeholder)

Files are stored in:
- `uploads/documentation/` - PDF files
- `uploads/software/` - ZIP files
- `uploads/thumbnails/` - Thumbnail images

## Usage

### Seed Database
```bash
npm run seed
```

### Generate Mock Files
```bash
npm run generate-files
```

### Complete Setup
```bash
# 1. Run migrations
npm run migrate

# 2. Generate mock files
npm run generate-files

# 3. Seed database
npm run seed
```

## Testing

After seeding, you can:
1. Browse all 20 projects on the homepage
2. Filter by category (Web, Mobile, Data Science, Desktop)
3. Filter by project type (Documentation, Software, Full)
4. View project details
5. Make mock purchases
6. Download purchased files

## Notes

- Mock files are simplified placeholders
- In production, replace with actual PDF and ZIP generation libraries
- Thumbnails are text placeholders - replace with actual images
- All projects are set to 'active' status by default
