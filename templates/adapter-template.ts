/**
 * @fileoverview Type Extractor Adapter Template
 * 
 * @description
 * Template for creating API-specific type extractors.
 * Copy this file to adapters/[api-name]/extractor.ts and customize.
 * 
 * @example
 * // Copy to: app/build/types/adapters/stripe/extractor.ts
 * // Rename class: StripeTypeExtractor
 * // Customize rules for Stripe API
 */

import { BaseTypeExtractor } from '../core/extractor';
import type { 
  ExtractedType, 
  ExtractionRules,
  PropertyInfo,
  TypeTransform,
  ValidationResult
} from '../core/types';
import * as ts from 'typescript';

/**
 * @class MyAPITypeExtractor
 * @extends BaseTypeExtractor
 * @description Type extractor for MyAPI
 * 
 * Replace 'MyAPI' with your API name (e.g., Stripe, Twilio, etc.)
 */
export class MyAPITypeExtractor extends BaseTypeExtractor {
  constructor(customRules?: Partial<ExtractionRules>) {
    // Define default rules for this API
    const rules: ExtractionRules = {
      apiId: 'myapi',
      
      // Type transformations
      transforms: {
        // Example: Create discriminated union based on a property
        'Payment': {
          discriminate: 'method',
          variants: {
            'card': 'CardPayment',
            'bank': 'BankPayment',
            'crypto': 'CryptoPayment'
          }
        },
        
        // Example: Add computed properties
        'User': {
          addProperties: [
            {
              name: 'displayName',
              type: 'string',
              optional: true,
              readonly: true,
              documentation: 'Formatted display name'
            }
          ]
        },
        
        // Example: Transform property types
        'Order': {
          transformProperties: {
            'status': {
              type: `'pending' | 'processing' | 'completed' | 'cancelled'`
            },
            'total': {
              type: 'number', // Ensure it's number, not string
              optional: false
            }
          }
        }
      },
      
      // Types to exclude
      excludeTypes: [
        'InternalHelper',
        'TestMock',
        'DeprecatedType'
      ],
      
      // Custom validators
      validators: {
        // These will be set after super() call
      },
      
      // Naming conventions
      naming: {
        prefix: 'MyAPI',
        transform: (name: string) => {
          // Avoid double prefixing
          if (name.startsWith('MyAPI')) return name;
          
          // Handle special cases
          const specialCases: Record<string, string> = {
            'User': 'MyAPIUser',
            'Order': 'MyAPIOrder',
            'Product': 'MyAPIProduct'
          };
          
          return specialCases[name] || `MyAPI${name}`;
        }
      },
      
      // Merge with any custom rules provided
      ...customRules
    };
    
    super(rules);
    
    // Set validators after super() call
    this.context.rules.validators = {
      'Product': this.validateProduct.bind(this),
      'Order': this.validateOrder.bind(this),
      'User': this.validateUser.bind(this),
      ...customRules?.validators
    };
  }

  /**
   * @method applyTransformations
   * @description Apply API-specific transformations
   * @protected
   */
  protected async applyTransformations(): Promise<void> {
    // Add any custom transformation logic here
    // Example: Automatically detect and create discriminated unions
    for (const [typeName, type] of this.context.types) {
      if (this.shouldCreateDiscriminatedUnion(type)) {
        // Custom logic to detect and create unions
        this.context.metrics.transformsApplied++;
      }
    }
  }

  /**
   * @method validateTypes
   * @description Validate extracted types
   * @protected
   */
  protected async validateTypes(): Promise<void> {
    // Additional API-specific validations
    for (const [typeName, type] of this.context.types) {
      // Example: Ensure all API response types have a 'success' field
      if (typeName.endsWith('Response')) {
        const hasSuccess = type.properties?.some((p: PropertyInfo) => p.name === 'success');
        if (!hasSuccess) {
          this.addError(
            type.sourceFile,
            `Response type ${typeName} missing 'success' field`,
            typeName
          );
          this.context.metrics.validationsFailed++;
        } else {
          this.context.metrics.validationsPassed++;
        }
      }
    }
  }

  /**
   * @method shouldExtractClass
   * @description Determine if a class should be extracted
   * @param {ts.ClassDeclaration} node - Class node
   * @returns {boolean}
   * @protected
   */
  protected override shouldExtractClass(node: ts.ClassDeclaration): boolean {
    const className = node.name?.getText() || '';
    
    // Extract API client classes and service classes
    return className.includes('Client') || 
           className.includes('Service') ||
           className.includes('API');
  }

  /**
   * @method shouldCreateDiscriminatedUnion
   * @description Detect if a type should be a discriminated union
   * @param {ExtractedType} type - Type to check
   * @returns {boolean}
   * @private
   */
  private shouldCreateDiscriminatedUnion(type: ExtractedType): boolean {
    // Example: Check if type has a 'type' or 'kind' field with string literal type
    const discriminatorFields = ['type', 'kind', 'status', 'state'];
    
    return type.properties?.some(prop => 
      discriminatorFields.includes((prop as PropertyInfo).name) &&
      (prop as PropertyInfo).type.includes('|') &&
      (prop as PropertyInfo).type.includes("'")
    ) || false;
  }

  /**
   * @method validateProduct
   * @description Validate Product type
   * @param {ExtractedType} type - Type to validate
   * @returns {ValidationResult}
   * @private
   */
  private validateProduct(type: ExtractedType): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Required fields
    const required = ['id', 'name', 'price', 'currency'];
    const props = type.properties?.map((p: PropertyInfo) => p.name) || [];
    
    for (const field of required) {
      if (!props.includes(field)) {
        errors.push(`Missing required field: ${field}`);
      }
    }
    
    // Check for proper types
    const priceField = type.properties?.find((p: PropertyInfo) => p.name === 'price');
    if (priceField && !priceField.type.includes('number')) {
      errors.push('Price field must be a number type');
    }
    
    // Warnings for best practices
    if (!props.includes('description')) {
      warnings.push('Consider adding a description field');
    }
    
    return { valid: errors.length === 0, errors, warnings };
  }

  /**
   * @method validateOrder
   * @description Validate Order type
   * @param {ExtractedType} type - Type to validate
   * @returns {ValidationResult}
   * @private
   */
  private validateOrder(type: ExtractedType): ValidationResult {
    const errors: string[] = [];
    
    // Orders must have items array
    const itemsField = type.properties?.find((p: PropertyInfo) => p.name === 'items');
    if (!itemsField) {
      errors.push('Order must have items field');
    } else if (!itemsField.type.includes('[]')) {
      errors.push('Order items must be an array');
    }
    
    return { valid: errors.length === 0, errors };
  }

  /**
   * @method validateUser
   * @description Validate User type
   * @param {ExtractedType} type - Type to validate
   * @returns {ValidationResult}
   * @private
   */
  private validateUser(type: ExtractedType): ValidationResult {
    const errors: string[] = [];
    
    // Users must have ID and email
    const required = ['id', 'email'];
    const props = type.properties?.map((p: PropertyInfo) => p.name) || [];
    
    for (const field of required) {
      if (!props.includes(field)) {
        errors.push(`Missing required field: ${field}`);
      }
    }
    
    // Check for 'any' types
    type.properties?.forEach((prop: PropertyInfo) => {
      if (prop.type.includes('any')) {
        errors.push(`Property ${prop.name} uses forbidden 'any' type`);
      }
    });
    
    return { valid: errors.length === 0, errors };
  }
}

// Default export for easier importing
export default MyAPITypeExtractor;