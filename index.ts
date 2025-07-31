/**
 * @fileoverview Type Extraction Framework - Main Entry Point
 * 
 * @description
 * Public API for the type extraction framework.
 * 
 * @module @invisiblecities/type-extraction
 * @since 1.0.0
 */

// Core exports
export * from './core/types.js';
export { BaseTypeExtractor } from './core/extractor.js';
export { TypeGenerator } from './core/generator.js';
export * from './core/config.js';

// Re-export types for convenience
export type {
  ExtractedType,
  ExtractionContext,
  ExtractionRules,
  PropertyInfo,
  TypeTransform,
  DiscriminatorConfig,
  ValidationResult,
  OutputConfig
} from './core/types.js';

export type { TypeExtractionConfig } from './core/config.js';

// Version
export const VERSION = '1.0.0';