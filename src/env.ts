// Loads environment variables before anything else runs.
// Precedence: .env.local overrides .env (both are optional, both gitignored).
// Import this first ("import './env.js'") in any entrypoint.

import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

// Load .env.local first so its values win; dotenv won't overwrite already-set vars.
dotenv.config({ path: join(root, '.env.local') });
dotenv.config({ path: join(root, '.env') });
