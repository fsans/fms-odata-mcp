#!/usr/bin/env node

import { FileMakerODataServer } from '../index.js';

async function main() {
  const server = new FileMakerODataServer();
  await server.run();
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
