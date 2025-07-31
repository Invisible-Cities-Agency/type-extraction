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
export * from './core/types';
export { BaseTypeExtractor } from './core/extractor';
export { TypeGenerator } from './core/generator';
export * from './core/config';

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
} from './core/types';

export type { TypeExtractionConfig } from './core/config';

// Version
export const VERSION = '1.0.0';