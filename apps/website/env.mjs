import nextEnv from '@next/env'
import { join } from 'node:path';
 
const workspaceRoot = join(process.cwd(), '..', '..');
nextEnv.loadEnvConfig(workspaceRoot);
