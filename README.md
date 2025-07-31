# Type Extraction Framework

A powerful TypeScript type extraction system that uses the TypeScript Compiler API to generate type definitions from third-party APIs that don't provide official TypeScript clients.

## Overview

This framework solves a common problem: many third-party APIs (like Guesty, Stripe, Twilio) provide comprehensive REST APIs but lack official TypeScript type definitions. Rather than manually maintaining types or using error-prone regex patterns, this framework uses the TypeScript AST to extract accurate type definitions from existing code.

### Key Features

- **AST-based extraction** - Uses TypeScript Compiler API for accurate parsing
- **Handles complex types** - Nested objects, generics, unions, intersections
- **API-specific adapters** - Extensible architecture for different APIs
- **Type transformations** - Rename, add/remove properties, create discriminated unions
- **JSDoc preservation** - Maintains documentation and comments
- **Zero `any` usage** - Converts `any` to `unknown` for type safety
- **Performance optimized** - Sub-second extraction for large codebases

## Architecture

```
app/build/types/
├── core/                      # Core framework
│   ├── types.ts              # Type definitions
│   ├── extractor.ts          # Base extractor class
│   ├── generator.ts          # File generator
│   └── index.ts              # Public API
├── adapters/                  # API-specific implementations
│   ├── guesty/               # Guesty adapter
│   ├── stripe/               # Stripe adapter (future)
│   └── twilio/               # Twilio adapter (future)
└── README.md                 # This file
```

## Installation

```bash
# Install as a dev dependency (when published to npm)
npm install --save-dev @invisiblecities/type-extraction

# Or copy the framework to your project
cp -r app/build/types ./type-extraction
```

## Quick Start

### 1. Create Configuration File

Create `type-extraction.config.js` in your project root:

```javascript
export default {
  api: 'myapi',
  source: {
    root: './lib/myapi',
    patterns: ['**/*.ts']
  },
  output: {
    directory: './src/types/generated',
    filename: '{api}.types.ts'
  }
};
```

### 2. Run Extraction

```bash
# Using config file
type-extract

# Or with CLI options
type-extract --api myapi --source ./lib/myapi

# This generates:
# - src/types/generated/myapi.types.ts
# - src/types/generated/index.ts
```

## Configuration

### Configuration File

The framework looks for configuration in these locations:
- `type-extraction.config.js`
- `type-extraction.config.mjs`
- `type-extraction.config.json`
- `.type-extractionrc.js`
- `.type-extractionrc.json`

### Default Output Locations

```javascript
{
  output: {
    // Generated types go here (relative to project root)
    directory: './src/types/generated',
    
    // Filename pattern
    filename: '{api}.types.ts',
    
    // Also generates index.ts
    generateIndex: true
  }
}
```

**Important**: Generated files should be:
- ✅ Committed to version control
- ✅ Added to `.prettierignore` (they're auto-formatted)
- ❌ NOT in `node_modules` (not persistent)
- ❌ NOT in `dist/` or `build/` (often gitignored)

## Plugin Architecture

The type extraction framework uses a flexible plugin architecture that allows you to keep API-specific adapters in your project while using the framework from npm.

### Adapter Loading Order

When you run `type-extract --api guesty`, the CLI searches for adapters in this order:

1. **Built-in adapters** (inside the npm package)
   ```
   node_modules/@invisiblecities/type-extraction/adapters/guesty/
   ```

2. **Separate npm packages**
   ```
   node_modules/@invisiblecities/type-extraction-guesty/
   ```

3. **Local project adapters** (recommended for client-specific APIs)
   ```
   ./type-extraction/adapters/guesty/extractor.js
   ```

### Recommended Setup

After installing the framework as a dev dependency:

```bash
npm install --save-dev @invisiblecities/type-extraction
```

Create your adapter in your project:

```
your-project/
├── type-extraction/
│   └── adapters/
│       └── guesty/
│           ├── extractor.ts    # Your Guesty adapter
│           └── index.ts        # Exports
├── src/
└── package.json
```

This keeps your proprietary API logic in your codebase while leveraging the framework's infrastructure.

### Creating a New API Adapter

1. **Create adapter directory**
   ```bash
   mkdir -p type-extraction/adapters/myapi
   ```

2. **Implement the extractor**
   ```typescript
   // type-extraction/adapters/myapi/extractor.ts
   import { BaseTypeExtractor } from '@invisiblecities/type-extraction';
   import type { ExtractionRules } from '@invisiblecities/type-extraction';

   export class MyAPIExtractor extends BaseTypeExtractor {
     constructor() {
       const rules: ExtractionRules = {
         apiId: 'myapi',
         
         // Define transformations
         transforms: {
           'Order': {
             // Add discriminated union
             discriminate: 'status',
             variants: {
               'pending': 'PendingOrder',
               'completed': 'CompletedOrder'
             }
           }
         },
         
         // Exclude internal types
         excludeTypes: ['InternalConfig'],
         
         // Custom naming
         naming: {
           prefix: 'MyAPI',
           transform: (name: string) => `MyAPI${name}`
         }
       };
       
       super(rules);
     }

     protected async applyTransformations(): Promise<void> {
       // Apply API-specific transformations
       // The base class handles standard transforms
     }

     protected async validateTypes(): Promise<void> {
       // Validate extracted types
       // Add custom validation logic
     }
   }
   ```

3. **Create extraction script**
   ```javascript
   // scripts/extract-myapi-types.mjs
   import { MyAPIExtractor } from '../app/build/types/adapters/myapi/extractor.js';
   import { TypeGenerator } from '../app/build/types/core/generator.js';
   import { glob } from 'glob';

   async function main() {
     // Discover source files
     const files = await glob('lib/myapi/**/*.ts', {
       absolute: true,
       ignore: ['**/*.test.ts']
     });

     // Extract types
     const extractor = new MyAPIExtractor();
     const context = await extractor.extract(files);

     // Generate output
     const generator = new TypeGenerator({
       outputDir: './src/generated',
       filePattern: '{api}-types.ts',
       generateIndex: true,
       splitTypes: false
     });

     await generator.generate(context);
   }

   main();
   ```

## API-Specific Rules

### Transformations

Transform extracted types to match your application's conventions:

```typescript
transforms: {
  'User': {
    // Rename the type
    rename: 'AppUser',
    
    // Add properties
    addProperties: [{
      name: 'fullName',
      type: 'string',
      optional: true,
      readonly: false
    }],
    
    // Remove properties
    removeProperties: ['internalId'],
    
    // Transform properties
    transformProperties: {
      'email': {
        type: 'Email', // Use branded type
        optional: false
      }
    }
  }
}
```

### Discriminated Unions

Convert regular types to discriminated unions for better type safety:

```typescript
transforms: {
  'Payment': {
    discriminate: 'method',
    variants: {
      'card': 'CardPayment',
      'bank': 'BankPayment',
      'crypto': 'CryptoPayment'
    }
  }
}
```

This generates:
```typescript
interface PaymentBase {
  amount: number;
  currency: string;
}

interface CardPayment extends PaymentBase {
  method: 'card';
  last4: string;
}

interface BankPayment extends PaymentBase {
  method: 'bank';
  accountNumber: string;
}

type Payment = CardPayment | BankPayment | CryptoPayment;
```

### Validation

Add custom validators to ensure type quality:

```typescript
validators: {
  'Order': (type: ExtractedType) => {
    const required = ['id', 'customerId', 'items'];
    const props = type.properties?.map(p => p.name) || [];
    
    const missing = required.filter(r => !props.includes(r));
    
    return {
      valid: missing.length === 0,
      errors: missing.map(m => `Missing required property: ${m}`)
    };
  }
}
```

## Output Options

### Unified File (Default)

All types in a single file:
```typescript
const generator = new TypeGenerator({
  outputDir: './generated',
  filePattern: '{api}-types.ts',
  splitTypes: false
});
```

### Split Files

One file per type:
```typescript
const generator = new TypeGenerator({
  outputDir: './generated/types',
  splitTypes: true,
  generateIndex: true
});
```

## Best Practices

### 1. Source Organization

Keep API implementation code organized:
```
lib/myapi/
├── client.ts         # API client
├── endpoints/        # Endpoint implementations
├── types/           # Manual type definitions
└── utils/           # Helper functions
```

### 2. Type Safety

- Never use `any` - the framework converts to `unknown`
- Use branded types for primitive values (emails, IDs, etc.)
- Implement proper validation for all external data

### 3. Documentation

- Preserve JSDoc comments in source files
- Document transformations and their rationale
- Keep extraction rules well-commented

### 4. Performance

- Target < 500ms extraction time
- Use file patterns to limit scope
- Cache results when appropriate

## Common Issues

### Missing Closing Braces

**Problem**: Regex-based extraction truncates at first `}`

**Solution**: This framework uses AST parsing which handles nested objects correctly

### Duplicate Exports

**Problem**: JSDoc comments between export keywords

**Solution**: The framework intelligently merges JSDoc with declarations

### Type Conflicts

**Problem**: Same type name from multiple sources

**Solution**: Use naming rules to add prefixes/suffixes

## Performance Metrics

The framework tracks:
- Files parsed
- Types extracted  
- Transformations applied
- Validation results
- Extraction time

Example output:
```
📊 Extraction Results:
   Files parsed: 54
   Types extracted: 633
   Transforms applied: 12
   Validations passed: 621
   Validations failed: 12
   Extraction time: 505ms
```

## CLI Usage

```bash
# Using configuration file
type-extract

# Specify API directly
type-extract --api stripe --source ./lib/stripe

# Custom output directory
type-extract --api twilio --output ./types/twilio

# Verbose mode
type-extract --verbose

# Show help
type-extract --help
```

## Project Structure Conventions

```
my-project/
├── type-extraction.config.js    # Configuration file
├── src/
│   ├── types/
│   │   └── generated/           # Default output location
│   │       ├── myapi.types.ts   # Generated types
│   │       └── index.ts         # Index file
│   └── lib/
│       └── myapi/               # API implementation
└── package.json
```

## Future Enhancements

- [x] Configuration system
- [x] CLI interface
- [ ] Watch mode for continuous extraction
- [ ] Incremental extraction (only changed files)
- [ ] Type dependency graph visualization
- [ ] Automatic discriminated union detection
- [ ] Integration with OpenAPI specs
- [ ] Type compatibility checking
- [ ] NPM package publication

## Contributing

To add support for a new API:

1. Create an adapter in `app/build/types/adapters/[api-name]/`
2. Implement extraction rules and transformations
3. Add comprehensive tests
4. Document the adapter's specific features
5. Submit a PR with examples

## License

MIT