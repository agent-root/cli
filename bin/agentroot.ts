#!/usr/bin/env node
import { main } from '../src/index';
main().then(() => process.exit(0)).catch(() => process.exit(1));
