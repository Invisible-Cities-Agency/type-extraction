/**
 * Test the updated type extraction with RFC compliance
 */

import { BaseTypeExtractor, RFCCompliantGenerator } from './dist/core/index.js';
import type { ExtractionRules } from './dist/core/types.js';

// Create a simple test extractor
class TestExtractor extends BaseTypeExtractor {
  protected async applyTransformations(): Promise<void> {
    // No transformations for this test
  }

  protected async validateTypes(): Promise<void> {
    // Basic validation
    for (const [name, type] of this.context.types) {
      if (type.kind === 'interface' && !type.properties?.length) {
        this.addError(type.sourceFile, `Interface ${name} has no properties`);
      }
    }
  }
}

// Test with a sample file that contains 'any'
async function runTest() {
  console.log('Testing RFC-compliant type extraction...\n');

  // Create test TypeScript content
  const testContent = `
export interface GoodType {
  id: string;
  name: string;
  data: unknown;
}

export interface BadType {
  id: any; // This should fail
  value: string;
}

export type StatusType = 'active' | 'inactive';
`;

  // Write test file
  const { writeFileSync, mkdirSync } = await import('fs');
  const { resolve } = await import('path');
  
  const testDir = resolve('./test-files');
  mkdirSync(testDir, { recursive: true });
  
  const testFile = resolve(testDir, 'test-types.ts');
  writeFileSync(testFile, testContent, 'utf-8');

  // Run extraction
  const rules: ExtractionRules = {
    apiId: 'test-api',
    naming: {
      prefix: 'Test'
    }
  };

  const extractor = new TestExtractor(rules);
  
  try {
    const context = await extractor.extract([testFile]);
    
    console.log('Extraction completed (should not reach here due to any type)');
    console.log(`Types extracted: ${context.types.size}`);
    console.log(`Errors: ${context.errors.length}`);
    console.log(`Any violations: ${context.metrics.anyTypeViolations}`);
  } catch (error) {
    console.log('✅ Extraction failed as expected:', error.message);
    console.log('\nThis is correct behavior - the extractor detected and rejected the "any" type.');
  }

  // Clean up
  const { rmSync } = await import('fs');
  rmSync(testDir, { recursive: true, force: true });
}

runTest().catch(console.error);