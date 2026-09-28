/**
 * @file api/index.js
 * Vercel Serverless Function entry point for base /api routes
 */

import { handleRequest } from '../src/server/app.js';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  return handleRequest(req, res);
}
