#!/usr/bin/env node

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename: string = fileURLToPath(import.meta.url);
const rootDir: string = path.join(path.dirname(__filename), '..');
const androidDir: string = path.join(rootDir, 'android');

console.log('Starting Android clean build process...\n');

// Function to remove directory recursively
function removeDir(dirPath: string): boolean {
  if (fs.existsSync(dirPath)) {
    console.log(`Removing ${path.relative(rootDir, dirPath)}...`);
    try {
      fs.rmSync(dirPath, { recursive: true, force: true });
      console.log(`Removed ${path.relative(rootDir, dirPath)}\n`);
      return true;
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code === 'EPERM' || err.code === 'EBUSY') {
        console.warn(
          `Could not remove ${path.relative(rootDir, dirPath)} - files may be in use`
        );
        console.warn(
          '   Try closing all terminals and editors, then run again\n'
        );
        return false;
      } else {
        throw error;
      }
    }
  } else {
    console.log(
      `${path.relative(rootDir, dirPath)} doesn't exist, skipping...\n`
    );
    return true;
  }
}

// Remove Android build directories
console.log('Step 1: Cleaning Android build directories');
removeDir(path.join(androidDir, '.gradle'));
removeDir(path.join(androidDir, 'app', '.cxx'));
removeDir(path.join(androidDir, 'app', 'build'));
removeDir(path.join(androidDir, 'build'));

// Run Gradle clean
console.log('Step 2: Running Gradle clean');
try {
  const isWindows: boolean = process.platform === 'win32';
  const gradlewCmd: string = isWindows ? '.\\gradlew.bat' : './gradlew';

  console.log(`Executing: ${gradlewCmd} clean\n`);
  execSync(`${gradlewCmd} clean`, {
    cwd: androidDir,
    stdio: 'inherit',
  });
  console.log('\nGradle clean completed\n');
} catch (error) {
  console.error('Error running Gradle clean:', (error as Error).message);
  process.exit(1);
}

// Remove node_modules
console.log('Step 3: Cleaning node_modules');
removeDir(path.join(rootDir, 'node_modules'));

console.log('Android clean build process completed!');
console.log('\nNext steps:');
console.log('   1. Run: pnpm install');
console.log('   2. Run: pnpm android');
