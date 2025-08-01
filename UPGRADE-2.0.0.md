# Type Extraction Framework 2.0.0 - RFC Compliance Update

## Breaking Changes

### 1. Now Uses ts-morph
- Replaced raw TypeScript Compiler API with ts-morph for better AST manipulation
- Required by RFC-2025-TS-A01 Section 5.3
- Provides cleaner API and better error handling

### 2. Strict 'any' Detection
- Extraction now **fails immediately** when 'any' type is detected
- No more silent conversion to 'unknown'
- Provides specific error messages with context

### 3. Branded Unknown Types
- When types are genuinely unknowable, generates branded unknowns:
  ```typescript
  type DataUnknown = unknown & { 
    readonly __brand: 'api-data'; 
    readonly __context: 'fetchData-response' 
  };
  ```

### 4. RFC-Compliant Output
- New `RFCCompliantGenerator` class generates `third-party-contracts.d.ts`
- Includes drift detection capabilities
- Generates `type-extraction-map.json` for tracking

## New Features

### RFC-Compliant Generator
```typescript
import { RFCCompliantGenerator } from '@invisiblecities/type-extraction';

const generator = new RFCCompliantGenerator({
  outputPath: './app/types/generated/third-party-contracts.d.ts',
  extractionMapPath: './type-extraction-map.json',
  failOnDrift: true,
  apiVersion: '1.0.0'
});

await generator.generate(context);
```

### Enhanced Metrics
- Added `anyTypeViolations` counter
- Tracks RFC compliance status
- Better error reporting with line/column info

## Migration Guide

1. **Update imports** - No changes needed for basic usage
2. **Handle extraction failures** - Wrap extract() in try/catch for 'any' violations
3. **Use RFCCompliantGenerator** - Replace TypeGenerator with RFCCompliantGenerator for RFC compliance

## TypeScript Agent Persona

A specialized agent configuration is now available for Claude Code:
- Zero tolerance for 'any' types
- Enforces RFC-2025-TS-A01 compliance
- Specializes in React 19/Next 15 patterns
- See `claude-code-typescript-agent.md` for details