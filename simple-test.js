// Simple test to verify the build output exists
const fs = require('fs');
const path = require('path');

console.log('Checking build output...\n');

const files = [
  'dist/core/extractor.js',
  'dist/core/types.js',
  'dist/core/generator.js',
  'dist/core/rfc-generator.js',
  'dist/core/index.js'
];

let allExist = true;

files.forEach(file => {
  const filePath = path.resolve(file);
  const exists = fs.existsSync(filePath);
  console.log(`${exists ? '✅' : '❌'} ${file}`);
  if (!exists) allExist = false;
});

if (allExist) {
  console.log('\n✅ All core files built successfully!');
  console.log('\nKey changes in version 2.0.0:');
  console.log('- Now uses ts-morph instead of raw TypeScript API');
  console.log('- Detects and fails on any type usage');
  console.log('- Generates branded unknown types with context');
  console.log('- Creates RFC-compliant third-party-contracts.d.ts');
} else {
  console.log('\n❌ Some files are missing from the build');
}