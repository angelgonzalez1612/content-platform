// Vercel serverless entry point. Plain JS on purpose: it just requires the
// already-compiled Nest app from dist/ (built by `nest build`, which uses
// the real TypeScript compiler and correctly emits decorator metadata —
// something Vercel's default esbuild function bundler doesn't reliably do
// for Nest's DI decorators).
const { getApp } = require('../dist/src/vercel-entry');

module.exports = async (req, res) => {
  const app = await getApp();
  app(req, res);
};
