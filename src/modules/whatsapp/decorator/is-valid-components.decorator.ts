// is-valid-components.decorator.ts
import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { BUTTON_FORMAT, COMPONENT_TYPE, HEADER_FORMAT } from '../interface/wab.message.template.info.interface';

@ValidatorConstraint({ name: 'IsValidComponents', async: false })
export class IsValidComponentsConstraint implements ValidatorConstraintInterface {
  private lastError = '';
  validate(value: unknown, _args: ValidationArguments): boolean {
    const errors: string[] = [];

    // Basic shape
    if (!Array.isArray(value)) {
      this.lastError = 'components must be an array';
      return false;
    }
    if (value.length === 0) {
      this.lastError = 'components must contain at least one item';
      return false;
    }

    // Must contain BODY at least once
    const hasBody = value.some((c) => c && typeof c === 'object' && (c as any).type === 'BODY');
    if (!hasBody) {
      errors.push('At least one component of type "BODY" is required');
    }

    // Per‑child checks
    value.forEach((raw, idx) => {
      const c = raw as any;
      if (!c || typeof c !== 'object') {
        errors.push(`components[${idx}] must be an object`);
        return;
      }

      const { type } = c as { type?: COMPONENT_TYPE };
      if (!type) {
        errors.push(`components[${idx}].type is required`);
        return;
      }

      switch (type) {
        case 'HEADER': {
          const format = c.format as HEADER_FORMAT | undefined;
          if (!format) {
            errors.push(`components[${idx}].format is required for HEADER`);
            break;
          }
          if (format === 'TEXT') {
            if (typeof c.text !== 'string' || !c.text.trim()) {
              errors.push(`components[${idx}].text is required for HEADER(TEXT)`);
            }
          } else if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(format)) {
            if (typeof c.header_handle !== 'string' || !c.header_handle.trim()) {
              // errors.push(`components[${idx}].header_handle is required for HEADER(${format})`);
            }
          } else if (format === 'LOCATION') {
            // no extra fields required
          } else {
            errors.push(`components[${idx}].format is invalid for HEADER`);
          }
          break;
        }

        case 'BODY': {
          if (typeof c.text !== 'string' || !c.text.trim()) {
            errors.push(`components[${idx}].text is required for BODY`);
          }
          // Optional: validate BODY example structure if you need
          break;
        }

        case 'FOOTER': {
          if (typeof c.text !== 'string' || !c.text.trim()) {
            errors.push(`components[${idx}].text is required for FOOTER`);
          }
          break;
        }

        case 'BUTTONS': {
          if (!Array.isArray(c.buttons) || c.buttons.length === 0) {
            errors.push(`components[${idx}].buttons must be a non-empty array`);
            break;
          }
          c.buttons.forEach((b: any, bIdx: number) => {
            if (!b || typeof b !== 'object') {
              errors.push(`components[${idx}].buttons[${bIdx}] must be an object`);
              return;
            }
            const fmt = b.type as BUTTON_FORMAT | undefined;
            if (!fmt) {
              errors.push(`components[${idx}].buttons[${bIdx}].type is required`);
              return;
            }
            if (typeof b.text !== 'string' || !b.text.trim()) {
              errors.push(`components[${idx}].buttons[${bIdx}].text is required`);
            }
            switch (fmt) {
              case 'PHONE_NUMBER':
                if (typeof b.phone_number !== 'string' || !b.phone_number.trim()) {
                  errors.push(`components[${idx}].buttons[${bIdx}].phone_number is required`);
                }
                break;
              case 'URL':
                if (typeof b.url !== 'string' || !b.url.trim()) {
                  errors.push(`components[${idx}].buttons[${bIdx}].url is required`);
                }
                break;
              case 'COPY_CODE':
              case 'FLOW':
              case 'QUICK_REPLY':
                // no extra required beyond text
                break;
              case 'CATALOG':
                // no extra required beyond text
                break;
              default:
                errors.push(`components[${idx}].buttons[${bIdx}].type is invalid`);
            }
          });
          break;
        }

        default:
          errors.push(`components[${idx}].type "${type}" is not supported`);
      }
    });

    this.lastError = errors.join('; ');
    return errors.length === 0;
  }

  defaultMessage(): string {
    return this.lastError || 'components is invalid';
  }
}

export function IsValidComponents(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'IsValidComponents',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: IsValidComponentsConstraint,
    });
  };
}
