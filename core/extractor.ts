/**
 * @fileoverview Type Extraction Framework - Base Extractor
 * 
 * @description
 * Provides an abstract base class for extracting TypeScript type definitions
 * from source code using ts-morph for AST manipulation. This ensures accurate
 * parsing of complex types and compliance with RFC-2025-TS-A01.
 * 
 * @module @invisiblecities/type-extraction/core
 * @since 2.0.0
 */

import { Project, SourceFile, Node, InterfaceDeclaration, TypeAliasDeclaration, EnumDeclaration, ClassDeclaration, PropertySignature, JSDocableNode, Type, ScriptTarget, ModuleKind } from 'ts-morph';
import { resolve } from 'node:path';
import type {
  ExtractedType,
  ExtractionContext,
  ExtractionRules,
  PropertyInfo,
  ExtractionError,
  ExtractionMetrics,
  BrandedUnknown
} from './types.js';

/**
 * @class BaseTypeExtractor
 * @abstract
 * @description Base class for API-specific type extractors using ts-morph
 * 
 * @example
 * class MyAPIExtractor extends BaseTypeExtractor {
 *   protected async applyTransformations(): Promise<void> {
 *     // Apply API-specific transformations
 *   }
 *   
 *   protected async validateTypes(): Promise<void> {
 *     // Validate extracted types
 *   }
 * }
 * 
 * @since 2.0.0
 */
export abstract class BaseTypeExtractor {
  protected context: ExtractionContext;
  protected project: Project;

  constructor(rules: ExtractionRules) {
    this.context = {
      sourceFiles: [],
      types: new Map(),
      rules,
      metrics: {
        startTime: Date.now(),
        filesParsed: 0,
        typesExtracted: 0,
        transformsApplied: 0,
        validationsPassed: 0,
        validationsFailed: 0,
        anyTypeViolations: 0
      },
      errors: []
    };

    // Initialize ts-morph project
    this.project = new Project({
      compilerOptions: {
        target: ScriptTarget.ES2022,
        module: ModuleKind.ESNext,
        lib: ["es2022"],
        allowJs: false,
        skipLibCheck: true,
        strict: true,
        esModuleInterop: true,
        resolveJsonModule: true
      }
    });
  }

  /**
   * @method extract
   * @description Main entry point for type extraction process
   * @param {string[]} sourceFiles - Array of absolute paths to TypeScript files
   * @returns {Promise<ExtractionContext>} Extraction results with types, errors, and metrics
   * @public
   * @async
   * 
   * @example
   * const extractor = new GuestyExtractor();
   * const context = await extractor.extract([
   *   '/path/to/api/types.ts',
   *   '/path/to/api/models.ts'
   * ]);
   */
  async extract(sourceFiles: string[]): Promise<ExtractionContext> {
    this.context.sourceFiles = sourceFiles;
    
    try {
      // Add source files to project
      for (const file of sourceFiles) {
        this.project.addSourceFileAtPath(file);
      }
      
      // Parse each source file
      for (const sourceFile of this.project.getSourceFiles()) {
        await this.parseFile(sourceFile);
      }
      
      // Apply API-specific transformations
      await this.applyTransformations();
      
      // Validate extracted types
      await this.validateTypes();
      
      // Check for any type violations
      this.detectAnyTypes();
      
    } catch (error) {
      this.addError('', `Extraction failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    
    return this.context;
  }

  /**
   * Parse a single source file
   */
  protected async parseFile(sourceFile: SourceFile): Promise<void> {
    this.context.metrics.filesParsed++;
    
    // Extract interfaces
    for (const interfaceDecl of sourceFile.getInterfaces()) {
      this.extractInterface(interfaceDecl);
    }
    
    // Extract type aliases
    for (const typeAlias of sourceFile.getTypeAliases()) {
      this.extractTypeAlias(typeAlias);
    }
    
    // Extract enums
    for (const enumDecl of sourceFile.getEnums()) {
      this.extractEnum(enumDecl);
    }
    
    // Extract classes (if needed)
    for (const classDecl of sourceFile.getClasses()) {
      if (this.shouldExtractClass(classDecl)) {
        this.extractClass(classDecl);
      }
    }
  }

  /**
   * @method detectAnyTypes
   * @description Detects 'any' types in extracted types and fails extraction if found
   * @protected
   */
  protected detectAnyTypes(): void {
    for (const [name, extractedType] of this.context.types) {
      const anyOccurrences = this.findAnyInDefinition(extractedType.definition);
      
      if (anyOccurrences.length > 0) {
        this.context.metrics.anyTypeViolations++;
        
        for (const occurrence of anyOccurrences) {
          this.addError(
            extractedType.sourceFile,
            `Type '${name}' contains 'any' type: ${occurrence.context}. Use a specific type or branded unknown instead.`,
            'any-type-violation',
            occurrence.line,
            occurrence.column
          );
        }
        
        // Fail the extraction
        throw new Error(`Extraction failed: ${anyOccurrences.length} 'any' type violations found. See errors for details.`);
      }
    }
  }

  /**
   * Find 'any' types in a definition string
   */
  protected findAnyInDefinition(definition: string): Array<{ context: string; line?: number; column?: number }> {
    const occurrences: Array<{ context: string; line?: number; column?: number }> = [];
    
    // Regex to find 'any' as a type (not part of a word)
    const anyRegex = /\b(any)\b(?![\w])/g;
    let match;
    
    while ((match = anyRegex.exec(definition)) !== null) {
      const startIndex = Math.max(0, match.index - 20);
      const endIndex = Math.min(definition.length, match.index + 20);
      const context = definition.substring(startIndex, endIndex);
      
      occurrences.push({ context });
    }
    
    return occurrences;
  }

  /**
   * @method extractInterface
   * @description Extracts interface declaration with all properties and metadata
   * @param {InterfaceDeclaration} node - Interface declaration node
   * @protected
   */
  protected extractInterface(node: InterfaceDeclaration): void {
    const name = node.getName();
    
    // Skip if excluded
    if (this.context.rules.excludeTypes?.includes(name)) {
      return;
    }

    const extractedType: ExtractedType = {
      name,
      kind: 'interface',
      definition: node.getFullText(),
      sourceFile: node.getSourceFile().getFilePath(),
      location: {
        line: node.getStartLineNumber(),
        column: node.getStartLinePos()
      },
      isExported: node.isExported(),
      documentation: this.getJSDoc(node),
      properties: this.extractProperties(node),
      typeParameters: node.getTypeParameters().map(tp => tp.getName()),
      extends: node.getExtends().map(ext => ext.getText()),
      astNode: node
    };

    this.context.types.set(name, extractedType);
    this.context.metrics.typesExtracted++;
  }

  /**
   * Extract properties from interface
   */
  protected extractProperties(node: InterfaceDeclaration): PropertyInfo[] {
    const properties: PropertyInfo[] = [];
    
    for (const prop of node.getProperties()) {
      const propInfo: PropertyInfo = {
        name: prop.getName(),
        type: this.getPropertyTypeString(prop),
        optional: prop.hasQuestionToken(),
        readonly: prop.isReadonly(),
        documentation: this.getJSDoc(prop)
      };
      properties.push(propInfo);
    }
    
    return properties;
  }

  /**
   * Get property type as string with 'any' to branded unknown conversion
   */
  protected getPropertyTypeString(prop: PropertySignature): string {
    const typeNode = prop.getTypeNode();
    
    if (!typeNode) {
      return this.createBrandedUnknown('property', prop.getName());
    }
    
    let typeString = typeNode.getText();
    
    // Convert 'any' to branded unknown
    if (typeString === 'any') {
      const propertyName = prop.getName();
      const interfaceName = prop.getParent()?.getKindName() || 'unknown';
      return this.createBrandedUnknown('property', `${interfaceName}.${propertyName}`);
    }
    
    // Handle nested any types
    typeString = this.replaceSenseAnyTypes(typeString, prop.getName());
    
    return typeString;
  }

  /**
   * @method createBrandedUnknown
   * @description Creates a branded unknown type with context
   * @param {string} context - Context for the unknown type
   * @param {string} detail - Additional detail about where this unknown came from
   * @returns {string} Branded unknown type string
   * @protected
   */
  protected createBrandedUnknown(context: string, detail: string): string {
    return `unknown & { readonly __brand: '${context}'; readonly __context: '${detail}' }`;
  }

  /**
   * Replace any types in a type string with branded unknowns
   */
  protected replaceSenseAnyTypes(typeString: string, context: string): string {
    // Replace standalone 'any' with branded unknown
    return typeString.replace(/\bany\b/g, () => {
      return this.createBrandedUnknown('replaced-any', context);
    });
  }

  /**
   * Get JSDoc comment from a node
   */
  protected getJSDoc(node: JSDocableNode): string | undefined {
    const jsDocs = node.getJsDocs();
    if (jsDocs.length > 0) {
      return jsDocs[0].getDescription().trim();
    }
    return undefined;
  }

  /**
   * Extract type alias
   */
  protected extractTypeAlias(node: TypeAliasDeclaration): void {
    const name = node.getName();
    
    if (this.context.rules.excludeTypes?.includes(name)) {
      return;
    }

    const extractedType: ExtractedType = {
      name,
      kind: 'type',
      definition: node.getFullText(),
      sourceFile: node.getSourceFile().getFilePath(),
      location: {
        line: node.getStartLineNumber(),
        column: node.getStartLinePos()
      },
      isExported: node.isExported(),
      documentation: this.getJSDoc(node),
      typeParameters: node.getTypeParameters().map(tp => tp.getName()),
      astNode: node
    };

    this.context.types.set(name, extractedType);
    this.context.metrics.typesExtracted++;
  }

  /**
   * Extract enum
   */
  protected extractEnum(node: EnumDeclaration): void {
    const name = node.getName();
    
    if (this.context.rules.excludeTypes?.includes(name)) {
      return;
    }

    const extractedType: ExtractedType = {
      name,
      kind: 'enum',
      definition: node.getFullText(),
      sourceFile: node.getSourceFile().getFilePath(),
      location: {
        line: node.getStartLineNumber(),
        column: node.getStartLinePos()
      },
      isExported: node.isExported(),
      documentation: this.getJSDoc(node),
      astNode: node
    };

    this.context.types.set(name, extractedType);
    this.context.metrics.typesExtracted++;
  }

  /**
   * Extract class (if needed)
   */
  protected extractClass(node: ClassDeclaration): void {
    const name = node.getName() || 'AnonymousClass';
    
    if (this.context.rules.excludeTypes?.includes(name)) {
      return;
    }

    const extractedType: ExtractedType = {
      name,
      kind: 'class',
      definition: node.getFullText(),
      sourceFile: node.getSourceFile().getFilePath(),
      location: {
        line: node.getStartLineNumber(),
        column: node.getStartLinePos()
      },
      isExported: node.isExported(),
      documentation: this.getJSDoc(node),
      typeParameters: node.getTypeParameters().map(tp => tp.getName()),
      extends: node.getExtends() ? [node.getExtends()!.getText()] : undefined,
      astNode: node
    };

    this.context.types.set(name, extractedType);
    this.context.metrics.typesExtracted++;
  }

  /**
   * Determine if class should be extracted
   */
  protected shouldExtractClass(node: ClassDeclaration): boolean {
    // Override in subclasses for API-specific logic
    return false;
  }

  /**
   * @method applyTransformations
   * @abstract
   * @description Apply API-specific type transformations
   * @returns {Promise<void>}
   * @protected
   * 
   * @remarks
   * Implement this method to:
   * - Rename types according to naming conventions
   * - Create discriminated unions
   * - Add or remove properties
   * - Apply custom transformations
   */
  protected abstract applyTransformations(): Promise<void>;

  /**
   * @method validateTypes  
   * @abstract
   * @description Validate extracted types against API-specific rules
   * @returns {Promise<void>}
   * @protected
   * 
   * @remarks  
   * Implement this method to:
   * - Check required properties
   * - Validate type safety (no 'any')
   * - Ensure naming conventions
   * - Verify relationships between types
   */
  protected abstract validateTypes(): Promise<void>;

  /**
   * Add error to context
   */
  protected addError(file: string, message: string, type?: string, line?: number, column?: number): void {
    this.context.errors.push({ file, message, type, line, column });
  }
}