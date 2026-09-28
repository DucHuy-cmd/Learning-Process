/**
 * @file api/health.js
 * Vercel Serverless Function entry point for GET /api/health
 */

import { handleRequest } from '../src/server/app.js';

export default async function handler(req, res) {
  return handleRequest(req, res);
}
