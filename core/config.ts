/**
 * @fileoverview Type Extraction Configuration
 * 
 * @description
 * Configuration types and defaults for the type extraction framework.
 * Provides sensible defaults while allowing full customization.
 * 
 * @module @invisiblecities/type-extraction/core
 * @since 1.0.0
 */

import { resolve } from 'node:path';
import type { ExtractionRules, OutputConfig } from './types';

/**
 * @interface TypeExtractionConfig
 * @description Complete configuration for type extraction
 */
export interface TypeExtractionConfig {
  /** API identifier (e.g., 'guesty', 'stripe', 'twilio') */
  api: string;
  
  /** Source configuration */
  source: {
    /** Root directory to search for source files */
    root: string;
    
    /** Glob patterns for finding source files */
    patterns: string[];
    
    /** Patterns to exclude */
    exclude?: string[];
  };
  
  /** Output configuration */
  output: {
    /** Directory for generated types (relative to project root) */
    directory: string;
    
    /** Filename pattern - {api} will be replaced with API name */
    filename?: string;
    
    /** Whether to generate an index file */
    generateIndex?: boolean;
    
    /** Whether to split types into separate files */
    splitTypes?: boolean;
    
    /** Custom header for generated files */
    header?: string;
  };
  
  /** Extraction rules (optional - can be defined in adapter) */
  rules?: Partial<ExtractionRules>;
  
  /** Whether to run in watch mode */
  watch?: boolean;
  
  /** Verbose logging */
  verbose?: boolean;
}

/**
 * @constant DEFAULT_CONFIG
 * @description Default configuration values
 */
export const DEFAULT_CONFIG: Partial<TypeExtractionConfig> = {
  source: {
    root: '.',
    patterns: ['**/*.ts', '**/*.tsx'],
    exclude: [
      '**/node_modules/**',
      '**/*.test.ts',
      '**/*.spec.ts',
      '**/*.d.ts',
      '**/dist/**',
      '**/build/**',
      '**/coverage/**'
    ]
  },
  output: {
    directory: 'src/types/generated',
    filename: '{api}.types.ts',
    generateIndex: true,
    splitTypes: false
  },
  watch: false,
  verbose: false
};

/**
 * @function resolveConfig
 * @description Resolves configuration with defaults
 * @param {Partial<TypeExtractionConfig>} userConfig - User configuration
 * @param {string} projectRoot - Project root directory
 * @returns {TypeExtractionConfig} Resolved configuration
 */
export function resolveConfig(
  userConfig: Partial<TypeExtractionConfig>,
  projectRoot: string
): TypeExtractionConfig {
  if (!userConfig.api) {
    throw new Error('Configuration error: "api" field is required');
  }

  // Merge with defaults
  const config: TypeExtractionConfig = {
    api: userConfig.api,
    source: {
      ...DEFAULT_CONFIG.source!,
      ...userConfig.source,
      root: resolve(projectRoot, userConfig.source?.root || DEFAULT_CONFIG.source!.root)
    },
    output: {
      ...DEFAULT_CONFIG.output!,
      ...userConfig.output,
      directory: resolve(projectRoot, userConfig.output?.directory || DEFAULT_CONFIG.output!.directory)
    },
    rules: userConfig.rules,
    watch: userConfig.watch ?? DEFAULT_CONFIG.watch,
    verbose: userConfig.verbose ?? DEFAULT_CONFIG.verbose
  };

  // Replace {api} in filename
  if (config.output.filename) {
    config.output.filename = config.output.filename.replace('{api}', config.api);
  }

  return config;
}

/**
 * @function loadConfigFile
 * @description Loads configuration from a file
 * @param {string} configPath - Path to configuration file
 * @returns {Promise<Partial<TypeExtractionConfig>>} Configuration object
 */
export async function loadConfigFile(configPath: string): Promise<Partial<TypeExtractionConfig>> {
  try {
    // Support both .js and .json configs
    if (configPath.endsWith('.json')) {
      const { readFileSync } = await import('node:fs');
      const content = readFileSync(configPath, 'utf-8');
      return JSON.parse(content);
    } else {
      // Dynamic import for .js/.mjs files
      const module = await import(configPath);
      return module.default || module.config || module;
    }
  } catch (error) {
    throw new Error(`Failed to load config from ${configPath}: ${error}`);
  }
}

/**
 * @function createOutputConfig
 * @description Creates OutputConfig from TypeExtractionConfig
 * @param {TypeExtractionConfig} config - Extraction configuration
 * @returns {OutputConfig} Output configuration for generator
 */
export function createOutputConfig(config: TypeExtractionConfig): OutputConfig {
  return {
    outputDir: config.output.directory,
    filePattern: config.output.filename || '{api}.types.ts',
    generateIndex: config.output.generateIndex ?? true,
    splitTypes: config.output.splitTypes ?? false,
    header: config.output.header,
    sourceMaps: false
  };
}