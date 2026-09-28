/**
 * @file api/[...all].js
 * Vercel Serverless Function Catch-All Router for all /api/* routes
 */

import { handleRequest } from '../src/server/app.js';

export const config = {
  api: {
    // Disable default body parser so multipart form-data & raw streams can be read by handleRequest
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  return handleRequest(req, res);
}
