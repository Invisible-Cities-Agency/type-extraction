/**
 * @fileoverview Type Extraction Framework - Core Types
 * 
 * @description
 * Defines the core interfaces and types for the extensible type extraction system.
 * This framework is designed to extract TypeScript types from third-party APIs that
 * don't provide official TypeScript clients. Complies with RFC-2025-TS-A01.
 * 
 * @module @invisiblecities/type-extraction/core
 * @since 1.0.0
 */

// ============================================================================
// Core Extraction Types
// ============================================================================

/**
 * @type BrandedUnknown
 * @description RFC-compliant branded unknown type with context
 * @since 2.0.0
 */
export type BrandedUnknown<TBrand extends string = string, TContext extends string = string> = 
  unknown & { readonly __brand: TBrand; readonly __context: TContext };

/**
 * @interface ExtractedType
 * @description Represents a type definition extracted from source code
 * @since 1.0.0
 */
export interface ExtractedType {
  /** Type name (e.g., 'CalendarEntry', 'GuestyReservation') */
  name: string;
  
  /** Kind of type declaration */
  kind: 'interface' | 'type' | 'enum' | 'class';
  
  /** Full TypeScript definition */
  definition: string;
  
  /** Source file path */
  sourceFile: string;
  
  /** Location in source file */
  location: {
    line: number;
    column: number;
  };
  
  /** Whether the type is exported */
  isExported: boolean;
  
  /** JSDoc documentation */
  documentation?: string;
  
  /** Properties for interfaces */
  properties?: PropertyInfo[];
  
  /** Type parameters (generics) */
  typeParameters?: string[];
  
  /** What this type extends */
  extends?: string[];
  
  /** Raw AST node (for advanced processing) */
  astNode?: unknown;
}

/**
 * @interface PropertyInfo  
 * @description Information about a property within an interface or type literal
 * @since 1.0.0
 */
export interface PropertyInfo {
  name: string;
  type: string;
  optional: boolean;
  readonly: boolean;
  documentation?: string;
}

// ============================================================================
// Transformation Rules
// ============================================================================

/**
 * @interface ExtractionRules
 * @description Configuration rules for API-specific type extraction and transformation
 * @since 1.0.0
 * 
 * @example
 * const guestyRules: ExtractionRules = {
 *   apiId: 'guesty',
 *   transforms: {
 *     'CalendarEntry': {
 *       discriminate: 'status',
 *       variants: {
 *         'available': 'CalendarAvailable',
 *         'blocked': 'CalendarBlocked'
 *       }
 *     }
 *   },
 *   excludeTypes: ['InternalConfig'],
 *   naming: {
 *     prefix: 'Guesty'
 *   }
 * };
 */
export interface ExtractionRules {
  /** API identifier (e.g., 'guesty', 'stripe') */
  apiId: string;
  
  /** Type transformations */
  transforms?: Record<string, TypeTransform>;
  
  /** Discriminated union configurations */
  discriminators?: Record<string, DiscriminatorConfig>;
  
  /** Types to exclude from extraction */
  excludeTypes?: string[];
  
  /** Custom type validators */
  validators?: Record<string, TypeValidator>;
  
  /** Naming conventions */
  naming?: NamingRules;
}

/**
 * Transformation for a specific type
 */
export interface TypeTransform {
  /** Target type name (if renaming) */
  rename?: string;
  
  /** Properties to add */
  addProperties?: PropertyInfo[];
  
  /** Properties to remove */
  removeProperties?: string[];
  
  /** Properties to transform */
  transformProperties?: Record<string, PropertyTransform>;
  
  /** Convert to discriminated union */
  discriminate?: string;
  
  /** Discriminated union variants */
  variants?: Record<string, string>;
}

/**
 * Property-level transformation
 */
export interface PropertyTransform {
  /** New property name */
  rename?: string;
  
  /** New type */
  type?: string;
  
  /** Make optional/required */
  optional?: boolean;
  
  /** Make readonly */
  readonly?: boolean;
}

/**
 * @interface DiscriminatorConfig
 * @description Configuration for creating discriminated union types
 * @since 1.0.0
 * 
 * @example
 * // Convert a type with status field to discriminated union
 * const config: DiscriminatorConfig = {
 *   property: 'status',
 *   variants: {
 *     'active': 'ActiveItem',
 *     'inactive': 'InactiveItem'
 *   }
 * };
 */
export interface DiscriminatorConfig {
  /** Discriminator property name */
  property: string;
  
  /** Map of discriminator values to type names */
  variants: Record<string, string>;
  
  /** Base properties shared by all variants */
  baseProperties?: PropertyInfo[];
}

/**
 * @typedef {Function} TypeValidator
 * @description Function that validates an extracted type
 * @param {ExtractedType} type - The type to validate
 * @returns {ValidationResult} Validation results with errors/warnings
 * @since 1.0.0
 */
export type TypeValidator = (type: ExtractedType) => ValidationResult;

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors?: string[];
  warnings?: string[];
}

/**
 * Naming convention rules
 */
export interface NamingRules {
  /** Prefix for all types */
  prefix?: string;
  
  /** Suffix for all types */
  suffix?: string;
  
  /** Transform function for type names */
  transform?: (name: string) => string;
}

// ============================================================================
// Extraction Context
// ============================================================================

/**
 * @interface ExtractionContext
 * @description Runtime context containing all extraction state and results
 * @since 1.0.0
 */
export interface ExtractionContext {
  /** Source files being processed */
  sourceFiles: string[];
  
  /** Extracted types by name */
  types: Map<string, ExtractedType>;
  
  /** API-specific rules */
  rules: ExtractionRules;
  
  /** Performance metrics */
  metrics: ExtractionMetrics;
  
  /** Errors encountered */
  errors: ExtractionError[];
}

/**
 * Performance metrics for extraction
 */
export interface ExtractionMetrics {
  startTime: number;
  filesParsed: number;
  typesExtracted: number;
  transformsApplied: number;
  validationsPassed: number;
  validationsFailed: number;
  anyTypeViolations: number;
}

/**
 * Error during extraction
 */
export interface ExtractionError {
  file: string;
  type?: string;
  message: string;
  line?: number;
  column?: number;
}

// ============================================================================
// Output Configuration
// ============================================================================

/**
 * @interface OutputConfig
 * @description Configuration for how extracted types are written to files
 * @since 1.0.0
 * 
 * @example
 * const config: OutputConfig = {
 *   outputDir: './src/generated',
 *   filePattern: '{api}-types.ts',
 *   generateIndex: true,
 *   splitTypes: false,
 *   header: '// Generated types',
 *   sourceMaps: false
 * };
 */
export interface OutputConfig {
  /** Output directory */
  outputDir: string;
  
  /** Output file name pattern */
  filePattern: string;
  
  /** Whether to generate index file */
  generateIndex: boolean;
  
  /** Whether to generate separate files per type */
  splitTypes: boolean;
  
  /** Header comment for generated files */
  header?: string;
  
  /** Whether to include source maps */
  sourceMaps: boolean;
}