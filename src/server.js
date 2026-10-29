import './config/env.js';
import app from './app.js';
import { connectDatabase } from './config/mongo.js';

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    await connectDatabase();

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
    console.error('Unable to connect to the database:', error.message);
    process.exit(1);
  }
}

// Vercel imports this module and uses the exported Express app; starting a
// listener there is neither needed nor supported. Local development (`npm run
// dev` / `npm start`) keeps the traditional long-running server.
if (process.env.VERCEL !== '1') {
  startServer();
}

export default app;
