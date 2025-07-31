/**
 * @fileoverview Type Extraction Framework - Base Extractor
 * 
 * @description
 * Provides an abstract base class for extracting TypeScript type definitions
 * from source code using the TypeScript Compiler API. This ensures accurate
 * parsing of complex types including nested objects, generics, and unions.
 * 
 * @module @invisiblecities/type-extraction/core
 * @since 1.0.0
 */

import * as ts from 'typescript';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type {
  ExtractedType,
  ExtractionContext,
  ExtractionRules,
  PropertyInfo,
  ExtractionError,
  ExtractionMetrics
} from './types.js';

/**
 * @class BaseTypeExtractor
 * @abstract
 * @description Base class for API-specific type extractors
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
 * @since 1.0.0
 */
export abstract class BaseTypeExtractor {
  protected context: ExtractionContext;
  protected program: ts.Program | null = null;
  protected typeChecker: ts.TypeChecker | null = null;

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
        validationsFailed: 0
      },
      errors: []
    };
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
      // Create TypeScript program
      this.createProgram(sourceFiles);
      
      // Parse each source file
      for (const file of sourceFiles) {
        await this.parseFile(file);
      }
      
      // Apply API-specific transformations
      await this.applyTransformations();
      
      // Validate extracted types
      await this.validateTypes();
      
    } catch (error) {
      this.addError('', `Extraction failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    
    return this.context;
  }

  /**
   * @method createProgram
   * @description Creates a TypeScript program for AST parsing
   * @param {string[]} sourceFiles - Source files to include in the program
   * @protected
   * @throws {Error} If program creation fails
   */
  protected createProgram(sourceFiles: string[]): void {
    const options: ts.CompilerOptions = {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      lib: ['es2022'],
      allowJs: false,
      skipLibCheck: true,
      strict: true,
      esModuleInterop: true,
      resolveJsonModule: true
    };

    this.program = ts.createProgram(sourceFiles, options);
    this.typeChecker = this.program.getTypeChecker();
  }

  /**
   * Parse a single source file
   */
  protected async parseFile(filePath: string): Promise<void> {
    if (!this.program) {
      throw new Error('TypeScript program not initialized');
    }

    const sourceFile = this.program.getSourceFile(filePath);
    if (!sourceFile) {
      this.addError(filePath, 'Failed to parse source file');
      return;
    }

    this.context.metrics.filesParsed++;
    
    // Visit all nodes in the AST
    ts.forEachChild(sourceFile, (node) => {
      this.visitNode(node, sourceFile);
    });
  }

  /**
   * @method visitNode
   * @description Recursively visits AST nodes to extract type definitions
   * @param {ts.Node} node - Current AST node
   * @param {ts.SourceFile} sourceFile - Source file containing the node
   * @protected
   */
  protected visitNode(node: ts.Node, sourceFile: ts.SourceFile): void {
    // Extract interfaces
    if (ts.isInterfaceDeclaration(node)) {
      this.extractInterface(node, sourceFile);
    }
    
    // Extract type aliases
    else if (ts.isTypeAliasDeclaration(node)) {
      this.extractTypeAlias(node, sourceFile);
    }
    
    // Extract enums
    else if (ts.isEnumDeclaration(node)) {
      this.extractEnum(node, sourceFile);
    }
    
    // Extract classes (if needed)
    else if (ts.isClassDeclaration(node) && this.shouldExtractClass(node)) {
      this.extractClass(node, sourceFile);
    }
    
    // Recursively visit child nodes
    ts.forEachChild(node, (child) => this.visitNode(child, sourceFile));
  }

  /**
   * @method extractInterface
   * @description Extracts interface declaration with all properties and metadata
   * @param {ts.InterfaceDeclaration} node - Interface AST node
   * @param {ts.SourceFile} sourceFile - Source file
   * @protected
   * 
   * @example
   * // Extracts:
   * interface User {
   *   id: string;
   *   profile: {
   *     name: string;
   *     settings: { theme: string };
   *   };
   * }
   */
  protected extractInterface(node: ts.InterfaceDeclaration, sourceFile: ts.SourceFile): void {
    const name = node.name?.getText() || 'Anonymous';
    
    // Skip if excluded
    if (this.context.rules.excludeTypes?.includes(name)) {
      return;
    }

    const extractedType: ExtractedType = {
      name,
      kind: 'interface',
      definition: this.getNodeText(node, sourceFile),
      sourceFile: sourceFile.fileName,
      location: this.getNodeLocation(node, sourceFile),
      isExported: this.isNodeExported(node),
      documentation: this.getJSDoc(node),
      properties: this.extractProperties(node),
      typeParameters: this.extractTypeParameters(node),
      extends: this.extractExtends(node),
      astNode: node
    };

    this.context.types.set(name, extractedType);
    this.context.metrics.typesExtracted++;
  }

  /**
   * Extract properties from interface
   */
  protected extractProperties(node: ts.InterfaceDeclaration): PropertyInfo[] {
    const properties: PropertyInfo[] = [];
    
    for (const member of node.members) {
      if (ts.isPropertySignature(member)) {
        const prop: PropertyInfo = {
          name: member.name?.getText() || '',
          type: this.getPropertyType(member),
          optional: !!member.questionToken,
          readonly: !!member.modifiers?.some(m => m.kind === ts.SyntaxKind.ReadonlyKeyword),
          documentation: this.getJSDoc(member)
        };
        properties.push(prop);
      }
    }
    
    return properties;
  }

  /**
   * Get property type as string
   */
  protected getPropertyType(member: ts.PropertySignature): string {
    if (!member.type) return 'unknown';
    
    // For complex types, we need to properly format them
    return this.typeNodeToString(member.type);
  }

  /**
   * @method typeNodeToString
   * @description Converts TypeScript AST TypeNode to string representation
   * @param {ts.TypeNode} typeNode - Type node from AST
   * @returns {string} String representation of the type
   * @protected
   * 
   * @remarks
   * Handles nested object types, arrays, unions, and other complex types.
   * Converts 'any' to 'unknown' for type safety.
   */
  protected typeNodeToString(typeNode: ts.TypeNode): string {
    // This is a simplified version - in production, handle all type node kinds
    switch (typeNode.kind) {
      case ts.SyntaxKind.StringKeyword:
        return 'string';
      case ts.SyntaxKind.NumberKeyword:
        return 'number';
      case ts.SyntaxKind.BooleanKeyword:
        return 'boolean';
      case ts.SyntaxKind.AnyKeyword:
        return 'unknown'; // Never use 'any'
      case ts.SyntaxKind.UnknownKeyword:
        return 'unknown';
      case ts.SyntaxKind.TypeLiteral:
        return this.typeLiteralToString(typeNode as ts.TypeLiteralNode);
      case ts.SyntaxKind.ArrayType:
        const arrayType = typeNode as ts.ArrayTypeNode;
        return `${this.typeNodeToString(arrayType.elementType)}[]`;
      case ts.SyntaxKind.UnionType:
        const unionType = typeNode as ts.UnionTypeNode;
        return unionType.types.map(t => this.typeNodeToString(t)).join(' | ');
      default:
        // For complex types, use the text representation
        return typeNode.getText();
    }
  }

  /**
   * Convert type literal to string (for nested objects)
   */
  protected typeLiteralToString(node: ts.TypeLiteralNode): string {
    const members: string[] = [];
    
    for (const member of node.members) {
      if (ts.isPropertySignature(member)) {
        const name = member.name?.getText() || '';
        const optional = member.questionToken ? '?' : '';
        const type = member.type ? this.typeNodeToString(member.type) : 'unknown';
        members.push(`${name}${optional}: ${type}`);
      }
    }
    
    return `{ ${members.join('; ')} }`;
  }

  /**
   * Get node text with proper formatting
   */
  protected getNodeText(node: ts.Node, sourceFile: ts.SourceFile): string {
    const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
    return printer.printNode(ts.EmitHint.Unspecified, node, sourceFile);
  }

  /**
   * Get node location
   */
  protected getNodeLocation(node: ts.Node, sourceFile: ts.SourceFile): { line: number; column: number } {
    const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
    return { line: line + 1, column: character + 1 };
  }

  /**
   * Check if node is exported
   */
  protected isNodeExported(node: ts.Node): boolean {
    if (!ts.canHaveModifiers(node)) return false;
    const modifiers = ts.getModifiers(node);
    return !!modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword);
  }

  /**
   * Get JSDoc comment
   */
  protected getJSDoc(node: ts.Node): string | undefined {
    const jsDocTags = ts.getJSDocTags(node);
    const comments = ts.getLeadingCommentRanges(node.getSourceFile().text, node.pos);
    
    if (comments && comments.length > 0) {
      const comment = comments[comments.length - 1];
      const text = node.getSourceFile().text.substring(comment!.pos, comment!.end);
      return text.replace(/^\/\*\*|\*\/$/g, '').replace(/^\s*\* ?/gm, '').trim();
    }
    
    return undefined;
  }

  /**
   * Extract type parameters (generics)
   */
  protected extractTypeParameters(node: ts.InterfaceDeclaration | ts.TypeAliasDeclaration | ts.ClassDeclaration): string[] {
    if (!node.typeParameters) return [];
    return node.typeParameters.map(p => p.name.getText());
  }

  /**
   * Extract extends clause
   */
  protected extractExtends(node: ts.InterfaceDeclaration | ts.ClassDeclaration): string[] {
    if (ts.isInterfaceDeclaration(node) && node.heritageClauses) {
      const extendsClause = node.heritageClauses.find(
        h => h.token === ts.SyntaxKind.ExtendsKeyword
      );
      if (extendsClause) {
        return extendsClause.types.map(t => t.expression.getText());
      }
    }
    return [];
  }

  /**
   * Extract type alias
   */
  protected extractTypeAlias(node: ts.TypeAliasDeclaration, sourceFile: ts.SourceFile): void {
    const name = node.name.getText();
    
    if (this.context.rules.excludeTypes?.includes(name)) {
      return;
    }

    const extractedType: ExtractedType = {
      name,
      kind: 'type',
      definition: this.getNodeText(node, sourceFile),
      sourceFile: sourceFile.fileName,
      location: this.getNodeLocation(node, sourceFile),
      isExported: this.isNodeExported(node),
      documentation: this.getJSDoc(node),
      typeParameters: this.extractTypeParameters(node),
      astNode: node
    };

    this.context.types.set(name, extractedType);
    this.context.metrics.typesExtracted++;
  }

  /**
   * Extract enum
   */
  protected extractEnum(node: ts.EnumDeclaration, sourceFile: ts.SourceFile): void {
    const name = node.name?.getText() || 'Anonymous';
    
    if (this.context.rules.excludeTypes?.includes(name)) {
      return;
    }

    const extractedType: ExtractedType = {
      name,
      kind: 'enum',
      definition: this.getNodeText(node, sourceFile),
      sourceFile: sourceFile.fileName,
      location: this.getNodeLocation(node, sourceFile),
      isExported: this.isNodeExported(node),
      documentation: this.getJSDoc(node),
      astNode: node
    };

    this.context.types.set(name, extractedType);
    this.context.metrics.typesExtracted++;
  }

  /**
   * Extract class (if needed)
   */
  protected extractClass(node: ts.ClassDeclaration, sourceFile: ts.SourceFile): void {
    const name = node.name?.getText() || 'Anonymous';
    
    if (this.context.rules.excludeTypes?.includes(name)) {
      return;
    }

    const extractedType: ExtractedType = {
      name,
      kind: 'class',
      definition: this.getNodeText(node, sourceFile),
      sourceFile: sourceFile.fileName,
      location: this.getNodeLocation(node, sourceFile),
      isExported: this.isNodeExported(node),
      documentation: this.getJSDoc(node),
      typeParameters: this.extractTypeParameters(node),
      extends: this.extractExtends(node),
      astNode: node
    };

    this.context.types.set(name, extractedType);
    this.context.metrics.typesExtracted++;
  }

  /**
   * Determine if class should be extracted
   */
  protected shouldExtractClass(node: ts.ClassDeclaration): boolean {
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