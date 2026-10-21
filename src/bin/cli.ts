#!/usr/bin/env node

// index.ts constructs and starts the server when it is loaded, so importing it
// is all the CLI needs. Starting a second FileMakerODataServer here would
// attach two stdio transports to the same stdin and execute every request twice.
import '../index.js';
