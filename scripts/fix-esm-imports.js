#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs';
import { glob } from 'glob';
import { resolve, dirname, relative } from 'path';

async function fixImports() {
  const files = await glob('**/*.ts', {
    ignore: ['node_modules/**', 'dist/**', 'scripts/**']
  });

  for (const file of files) {
    let content = readFileSync(file, 'utf-8');
    let modified = false;

    // Fix relative imports to add .js extension
    content = content.replace(
      /from\s+['"](\.[^'"]+)(?<!\.js)(?<!\.json)(?<!\.css)['"];?/g,
      (match, importPath) => {
        modified = true;
        return match.replace(importPath, importPath + '.js');
      }
    );

    // Fix imports from core modules
    content = content.replace(
      /from\s+['"]@invisiblecities\/type-extraction(?!\/|'|")['"];?/g,
      (match) => {
        modified = true;
        return match.replace('@invisiblecities/type-extraction', '@invisiblecities/type-extraction/index.js');
      }
    );

    if (modified) {
      writeFileSync(file, content, 'utf-8');
      console.log(`Fixed imports in ${file}`);
    }
  }
}

fixImports().catch(console.error);