import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

let isConnected = false;

export const connectMongo = async () => {
  const { MONGO_URI } = process.env;

  if (!MONGO_URI) {
    throw new Error('MONGO_URI is not defined. Please set it in your .env file.');
  }

  if (isConnected) {
    return mongoose.connection;
  }

  try {
    await mongoose.connect(MONGO_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000
    });
    isConnected = true;
    console.log('✅ Connected to MongoDB');
    return mongoose.connection;
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    throw error;
  }
};

export const getMongoHealth = () => {
  const readyState = mongoose.connection.readyState;
  const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  return {
    state: states[readyState] || 'unknown',
    readyState
  };
};
