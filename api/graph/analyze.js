/**
 * @file api/graph/analyze.js
 * Vercel Serverless Function entry point for POST /api/graph/analyze
 */

import { handleRequest } from '../../src/server/app.js';

export const config = {
  api: {
    // Disable Vercel's default body parser so multipart binary stream can be parsed directly
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  return handleRequest(req, res);
}
