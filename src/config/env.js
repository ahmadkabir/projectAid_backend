import dotenv from 'dotenv';

/**
 * Load `.env` once, before any other module reads `process.env`.
 *
 * ESM evaluates imports depth-first, so importing this file as the first import
 * of the entry point guarantees configuration is available when modules such as
 * storageService or the database layer compute their defaults.
 *
 * On Vercel the variables come from the project settings; dotenv simply finds
 * no file and leaves them untouched.
 */
dotenv.config();
