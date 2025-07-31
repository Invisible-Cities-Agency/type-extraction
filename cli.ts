#!/usr/bin/env node

/**
 * @fileoverview Type Extraction CLI
 * 
 * @description
 * Command-line interface for the type extraction framework.
 * Provides a clean, user-friendly way to extract types from APIs.
 * 
 * @module @invisiblecities/type-extraction/cli
 * @since 1.0.0
 */

import { resolve, dirname } from 'node:path';
import { existsSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { glob } from 'glob';
import { loadConfigFile, resolveConfig, createOutputConfig } from './core/config.js';
import { TypeGenerator } from './core/generator.js';
import type { ExtractionContext } from './core/types.js';
import type { TypeExtractionConfig } from './core/config.js';

// For ESM compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * @interface CLIOptions
 * @description Command-line options
 */
interface CLIOptions {
  config?: string;
  api?: string;
  source?: string;
  output?: string;
  watch?: boolean;
  verbose?: boolean;
  help?: boolean;
}

/**
 * @function showHelp
 * @description Displays help message
 */
function showHelp(): void {
  console.log(`
Type Extraction CLI

Usage:
  type-extract [options]

Options:
  -c, --config <path>     Path to configuration file (default: type-extraction.config.js)
  -a, --api <name>        API name (e.g., guesty, stripe)
  -s, --source <path>     Source directory to scan
  -o, --output <path>     Output directory for generated types
  -w, --watch             Watch mode for continuous extraction
  -v, --verbose           Verbose logging
  -h, --help              Show this help message

Examples:
  # Using config file
  type-extract --config ./type-extraction.config.js

  # Direct usage
  type-extract --api guesty --source ./lib/guesty --output ./src/types/generated

  # Watch mode
  type-extract --api stripe --watch

Configuration File:
  Create a type-extraction.config.js file:

  export default {
    api: 'myapi',
    source: {
      root: './lib/myapi',
      patterns: ['**/*.ts'],
      exclude: ['**/*.test.ts']
    },
    output: {
      directory: './src/types/generated',
      filename: '{api}.types.ts'
    }
  };
`);
}

/**
 * @function parseArguments
 * @description Parses command-line arguments
 * @returns {CLIOptions} Parsed options
 */
function parseArguments(): CLIOptions {
  const { values } = parseArgs({
    options: {
      config: { type: 'string', short: 'c' },
      api: { type: 'string', short: 'a' },
      source: { type: 'string', short: 's' },
      output: { type: 'string', short: 'o' },
      watch: { type: 'boolean', short: 'w' },
      verbose: { type: 'boolean', short: 'v' },
      help: { type: 'boolean', short: 'h' }
    }
  });

  return values as CLIOptions;
}

/**
 * @function findConfigFile
 * @description Finds configuration file in standard locations
 * @param {string} projectRoot - Project root directory
 * @returns {string|null} Config file path or null
 */
function findConfigFile(projectRoot: string): string | null {
  const configNames = [
    'type-extraction.config.js',
    'type-extraction.config.mjs',
    'type-extraction.config.json',
    '.type-extractionrc.js',
    '.type-extractionrc.json'
  ];

  for (const name of configNames) {
    const configPath = resolve(projectRoot, name);
    if (existsSync(configPath)) {
      return configPath;
    }
  }

  return null;
}

/**
 * @function loadAdapter
 * @description Dynamically loads an API adapter
 * @param {string} api - API name
 * @returns {Promise<any>} Extractor class
 */
async function loadAdapter(api: string): Promise<any> {
  // Try built-in adapters first
  const builtInPath = resolve(__dirname, `adapters/${api}/extractor.js`);
  if (existsSync(builtInPath)) {
    const module = await import(builtInPath);
    return module[`${api.charAt(0).toUpperCase() + api.slice(1)}TypeExtractor`] || module.default;
  }

  // Try loading from node_modules
  try {
    const module = await import(`@invisiblecities/type-extraction-${api}`);
    return module.default || module.TypeExtractor;
  } catch {
    // Try local project adapters
    const localPath = resolve(process.cwd(), `type-extraction/adapters/${api}/extractor.js`);
    if (existsSync(localPath)) {
      const module = await import(localPath);
      return module.default || module.TypeExtractor;
    }
  }

  throw new Error(`No adapter found for API: ${api}`);
}

/**
 * @function discoverSourceFiles
 * @description Discovers source files based on configuration
 * @param {TypeExtractionConfig} config - Configuration
 * @returns {Promise<string[]>} Array of file paths
 */
async function discoverSourceFiles(config: TypeExtractionConfig): Promise<string[]> {
  const files: string[] = [];
  
  for (const pattern of config.source.patterns) {
    const matches = await glob(pattern, {
      cwd: config.source.root,
      absolute: true,
      ignore: config.source.exclude
    });
    files.push(...matches);
  }

  return files;
}

/**
 * @function runExtraction
 * @description Runs the type extraction process
 * @param {TypeExtractionConfig} config - Configuration
 */
async function runExtraction(config: TypeExtractionConfig): Promise<void> {
  console.log(`🚀 Starting type extraction for ${config.api} API`);
  
  try {
    // Load adapter
    if (config.verbose) {
      console.log(`📦 Loading adapter for ${config.api}...`);
    }
    const ExtractorClass = await loadAdapter(config.api);
    const extractor = new ExtractorClass(config.rules);

    // Discover files
    console.log('🔍 Discovering source files...');
    const sourceFiles = await discoverSourceFiles(config);
    console.log(`Found ${sourceFiles.length} files\n`);

    if (sourceFiles.length === 0) {
      console.warn('⚠️  No source files found');
      return;
    }

    // Extract types
    console.log('🔧 Extracting types...');
    const context: ExtractionContext = await extractor.extract(sourceFiles);

    // Report results
    console.log('\n📊 Extraction Results:');
    console.log(`   Files parsed: ${context.metrics.filesParsed}`);
    console.log(`   Types extracted: ${context.metrics.typesExtracted}`);
    console.log(`   Transforms applied: ${context.metrics.transformsApplied}`);
    console.log(`   Validations passed: ${context.metrics.validationsPassed}`);
    console.log(`   Validations failed: ${context.metrics.validationsFailed}`);

    if (context.errors.length > 0 && config.verbose) {
      console.log(`\n⚠️  Errors: ${context.errors.length}`);
      context.errors.forEach(error => {
        console.log(`   ${error.file}: ${error.message}`);
      });
    }

    // Generate output
    console.log('\n📝 Generating TypeScript files...');
    const generator = new TypeGenerator(createOutputConfig(config));
    await generator.generate(context);

    console.log(`\n✅ Type extraction complete!`);
    console.log(`📁 Output: ${config.output.directory}`);

  } catch (error) {
    console.error(`\n❌ Extraction failed: ${error}`);
    process.exit(1);
  }
}

/**
 * @function main
 * @description Main CLI entry point
 */
async function main(): Promise<void> {
  const options = parseArguments();

  if (options.help) {
    showHelp();
    process.exit(0);
  }

  const projectRoot = process.cwd();
  let config: TypeExtractionConfig;

  try {
    // Load configuration
    if (options.config) {
      // Explicit config file
      const configPath = resolve(projectRoot, options.config);
      const userConfig = await loadConfigFile(configPath);
      config = resolveConfig(userConfig, projectRoot);
    } else {
      // Look for config file
      const configPath = findConfigFile(projectRoot);
      if (configPath) {
        if (options.verbose) {
          console.log(`📄 Using config: ${configPath}`);
        }
        const userConfig = await loadConfigFile(configPath);
        config = resolveConfig(userConfig, projectRoot);
      } else if (options.api) {
        // Use CLI options
        config = resolveConfig({
          api: options.api,
          source: options.source ? { root: options.source, patterns: ['**/*.ts'] } : undefined,
          output: options.output ? { directory: options.output } : undefined,
          verbose: options.verbose,
          watch: options.watch
        }, projectRoot);
      } else {
        console.error('❌ No configuration found. Use --config or --api option.');
        showHelp();
        process.exit(1);
      }
    }

    // Override with CLI options
    if (options.api) config.api = options.api;
    if (options.verbose !== undefined) config.verbose = options.verbose;
    if (options.watch !== undefined) config.watch = options.watch;

    // Run extraction
    await runExtraction(config);

    // Watch mode
    if (config.watch) {
      console.log('\n👀 Watching for changes...');
      // TODO: Implement file watching
      console.log('Watch mode not yet implemented');
    }

  } catch (error) {
    console.error(`❌ Error: ${error}`);
    process.exit(1);
  }
}

// Run CLI
main();