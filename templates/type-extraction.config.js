/**
 * Type Extraction Configuration
 * 
 * This file configures how types are extracted from your API implementation.
 * Place this file in your project root as 'type-extraction.config.js'
 */

export default {
  // REQUIRED: API identifier
  api: 'myapi',

  // Source file configuration
  source: {
    // Root directory containing your API implementation
    root: './lib/myapi',
    
    // Glob patterns for finding TypeScript files
    patterns: [
      '**/*.ts',
      '**/*.tsx'
    ],
    
    // Files to exclude
    exclude: [
      '**/*.test.ts',
      '**/*.spec.ts',
      '**/*.d.ts',
      '**/node_modules/**',
      '**/dist/**'
    ]
  },

  // Output configuration
  output: {
    // Where to write generated types (relative to project root)
    directory: './src/types/generated',
    
    // Output filename ({api} will be replaced with your API name)
    filename: '{api}.types.ts',
    
    // Generate an index.ts file that exports all types
    generateIndex: true,
    
    // Split each type into its own file (false = single file)
    splitTypes: false,
    
    // Custom header for generated files
    header: `/**
 * Generated TypeScript types for MyAPI
 * DO NOT EDIT - This file is auto-generated
 * Generated: ${new Date().toISOString()}
 */`
  },

  // Extraction rules (optional - these can also be defined in your adapter)
  rules: {
    // Transform specific types
    transforms: {
      // Example: Create discriminated unions
      'Order': {
        discriminate: 'status',
        variants: {
          'pending': 'PendingOrder',
          'completed': 'CompletedOrder',
          'cancelled': 'CancelledOrder'
        }
      },
      
      // Example: Add properties
      'User': {
        addProperties: [{
          name: 'fullName',
          type: 'string',
          optional: true,
          readonly: false,
          documentation: 'Computed full name'
        }]
      }
    },
    
    // Types to exclude from extraction
    excludeTypes: [
      'InternalConfig',
      'PrivateData',
      'TestHelper'
    ],
    
    // Custom validators
    validators: {
      'Product': (type) => {
        // Ensure required fields
        const required = ['id', 'name', 'price'];
        const props = type.properties?.map(p => p.name) || [];
        const missing = required.filter(r => !props.includes(r));
        
        return {
          valid: missing.length === 0,
          errors: missing.map(m => `Missing required property: ${m}`)
        };
      }
    },
    
    // Naming conventions
    naming: {
      // Add prefix to all types
      prefix: 'MyAPI',
      
      // Or use a custom transform function
      transform: (name) => {
        // Don't double-prefix
        if (name.startsWith('MyAPI')) return name;
        // Special cases
        if (name === 'User') return 'MyAPIUser';
        if (name === 'Order') return 'MyAPIOrder';
        // Default
        return `MyAPI${name}`;
      }
    }
  },

  // Development options
  watch: false,        // Watch mode (not yet implemented)
  verbose: false       // Verbose logging
};

/**
 * Alternative: Export as a function for dynamic configuration
 */
// export default function(env) {
//   return {
//     api: env.API_NAME || 'myapi',
//     source: {
//       root: env.SOURCE_DIR || './lib/myapi'
//     },
//     // ... rest of config
//   };
// }