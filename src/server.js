import dotenv from 'dotenv';
import app from './app.js';
import sequelize from './config/database.js';

dotenv.config();

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    await sequelize.authenticate();
    console.log('Database connection established successfully.');

    const server = app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });

    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`\n❌ Port ${PORT} is already in use!`);
        console.log('\nTo fix this, run one of the following:');
        console.log(`1. Kill the process: kill -9 $(lsof -ti:${PORT})`);
        console.log('2. Or change PORT in your .env file\n');
        process.exit(1);
      } else {
        throw error;
      }
    });
  } catch (error) {
    console.error('Unable to connect to the database:', error);
    process.exit(1);
  }
}

startServer();
