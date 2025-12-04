import {
  isArray,
  isBoolean,
  isDateString,
  isEmail,
  isLowercase,
  isNotEmpty,
  isNumber,
  isObject,
  isURL,
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';

interface CustomValidationOptions extends ValidationOptions {
  key_message?: string; // Custom option for key message
}

function registerCustomValidator(
  validatorFn: (value: any) => boolean,
  defaultMessage: (
    args: ValidationArguments,
    options?: CustomValidationOptions,
  ) => string,
  options?: CustomValidationOptions,
) {
  return function (object: Object, propertyName: string) {
    const combinedOptions = { ...options };
    registerDecorator({
      name: 'customValidator',
      target: object.constructor,
      propertyName: propertyName,
      options,
      validator: {
        validate(value: any, args: ValidationArguments) {
          return validatorFn(value);
        },

        defaultMessage(args: ValidationArguments) {
          if (typeof combinedOptions?.message === 'function') {
            return combinedOptions.message(args);
          }
          return defaultMessage(args, combinedOptions);
        },
      },
    });
  };
}

// CustomIsNotEmpty decorator function with dynamic field name and optional key_message
export function CustomIsNotEmpty(options?: CustomValidationOptions) {
  return registerCustomValidator(
    isNotEmpty,
    (args: ValidationArguments, options?: CustomValidationOptions) => {
      // Return message including key_message if available
      const message = {
        fieldName: args.property,
        key: options?.key_message ? options.key_message : 'NOT_EMPTY_MESSAGE',
      };
      return JSON.stringify(message);
    },
    options,
  );
}

// Example CustomIsString decorator for string validation
export function CustomIsString(options?: CustomValidationOptions) {
  return registerCustomValidator(
    (value) => typeof value === 'string',
    (args: ValidationArguments, options?: CustomValidationOptions) => {
      const message = {
        fieldName: args.property,
        expectedType: 'string',
        invalidType: typeof args.value,
        key: options?.key_message ? options.key_message : 'TYPE_MISMATCH_ERROR',
      };
      return JSON.stringify(message);
    },
    options,
  );
}

export function CustomIsNumber(options?: CustomValidationOptions) {
  return registerCustomValidator(
    isNumber,
    (args: ValidationArguments, options?: CustomValidationOptions) => {
      const message = {
        fieldName: args.property,
        expectedType: 'number',
        invalidType: typeof args.value,
        key: options?.key_message ? options.key_message : 'TYPE_MISMATCH_ERROR',
      };
      return JSON.stringify(message);
    },
    options,
  );
}

export function CustomIsBoolean(options?: CustomValidationOptions) {
  return registerCustomValidator(
    isBoolean,
    (args: ValidationArguments, options?: CustomValidationOptions) => {
      const message = {
        fieldName: args.property,
        expectedType: 'boolean',
        invalidType: typeof args.value,
        key: options?.key_message ? options.key_message : 'TYPE_MISMATCH_ERROR',
      };
      return JSON.stringify(message);
    },
    options,
  );
}

export function CustomIsEmail(options?: CustomValidationOptions) {
  return registerCustomValidator(
    isEmail,
    (args: ValidationArguments, options?: CustomValidationOptions) => {
      const message = {
        fieldName: args.property,
        expectedType: 'Email',
        invalidType: 'Non Email',
        key: options?.key_message ? options.key_message : 'TYPE_MISMATCH_ERROR',
      };
      return JSON.stringify(message);
    },
    options,
  );
}

export function CustomIsObject(options?: CustomValidationOptions) {
  return registerCustomValidator(
    isObject,
    (args: ValidationArguments, options?: CustomValidationOptions) => {
      const message = {
        fieldName: args.property,
        expectedType: 'Object',
        invalidType: typeof args.value,
        key: options?.key_message ? options.key_message : 'TYPE_MISMATCH_ERROR',
      };
      return JSON.stringify(message);
    },
    options,
  );
}

export function CustomIsBigint(options?: CustomValidationOptions) {
  return registerCustomValidator(
    (value) => typeof value === 'bigint',
    (args: ValidationArguments, options?: CustomValidationOptions) => {
      const message = {
        fieldName: args.property,
        expectedType: 'bigint',
        invalidType: typeof args.value,
        key: options?.key_message ? options.key_message : 'TYPE_MISMATCH_ERROR',
      };
      return JSON.stringify(message);
    },
    options,
  );
}

export function CustomIsArray(options?: CustomValidationOptions) {
  return registerCustomValidator(
    isArray,
    (args: ValidationArguments, options?: CustomValidationOptions) => {
      const message = {
        fieldName: args.property,
        expectedType: 'Array',
        invalidType: typeof args.value,
        key: options?.key_message ? options.key_message : 'TYPE_MISMATCH_ERROR',
      };
      return JSON.stringify(message);
    },
    options,
  );
}

export function CustomMaxLength(
  maxLength: number,
  options?: CustomValidationOptions,
) {
  return registerCustomValidator(
    (value) => typeof value === 'string' && value.length <= maxLength,
    (args: ValidationArguments, options?: CustomValidationOptions) => {
      const message = {
        fieldName: args.property,
        maxLength: maxLength,
        length: args?.value?.length,
        key: options?.key_message ? options.key_message : 'MAX_LENGTH_ERROR',
      };
      return JSON.stringify(message);
    },
    options,
  );
}

export function CustomMinLength(
  minLength: number,
  options?: CustomValidationOptions,
) {
  return registerCustomValidator(
    (value) => typeof value === 'string' && value.length >= minLength,
    (args: ValidationArguments, options?: CustomValidationOptions) => {
      const message = {
        fieldName: args.property,
        minLength: minLength,
        length: args.value.length,
        key: options?.key_message ? options.key_message : 'MIN_LENGTH_ERROR',
      };
      return JSON.stringify(message);
    },
    options,
  );
}

export function CustomIsEnum<T extends object>(
  enumType: T,
  options?: CustomValidationOptions,
) {
  const enumValues = Object.values(enumType);

  return registerCustomValidator(
    (value) => enumValues.includes(value as unknown as T[keyof T]),
    (args: ValidationArguments, options?: CustomValidationOptions) => {
      const message = {
        fieldName: args.property,
        expectedValues: `${enumValues.join(', ')}`,
        key: options?.key_message ? options.key_message : 'ENUM_VALUE_ERROR',
      };
      return JSON.stringify(message);
    },
    options,
  );
}

export function CustomIsUrl(options?: CustomValidationOptions) {
  return registerCustomValidator(
    isURL,
    (args: ValidationArguments, options?: CustomValidationOptions) => {
      const message = {
        fieldName: args.property,
        expectedType: 'Url',
        invalidType: 'Non Url',
        key: options?.key_message ? options.key_message : 'TYPE_MISMATCH_ERROR',
      };
      return JSON.stringify(message);
    },
    options,
  );
}

export function CustomIsDateString(options?: CustomValidationOptions) {
  return registerCustomValidator(
    isDateString,
    (args: ValidationArguments, options?: CustomValidationOptions) => {
      const message = {
        fieldName: args.property,
        expectedType: 'DateString',
        invalidType: typeof args.value,
        key: options?.key_message ? options.key_message : 'TYPE_MISMATCH_ERROR',
      };
      return JSON.stringify(message);
    },
    options,
  );
}

export function CustomIsLowercase(options?: CustomValidationOptions) {
  return registerCustomValidator(
    isLowercase,
    (args: ValidationArguments, options?: CustomValidationOptions) => {
      const message = {
        fieldName: args.property,
        expectedType: 'lowercase',
        invalidType: typeof args.value,
        key: options?.key_message ? options.key_message : 'CASE_MISMATCH_ERROR',
      };
      return JSON.stringify(message);
    },
    options,
  );
}

export function CustomMax(maxValue: number, options?: CustomValidationOptions) {
  return registerCustomValidator(
    (value) => typeof value === 'number' && value <= maxValue,
    (args: ValidationArguments, options?: CustomValidationOptions) => {
      const message = {
        fieldName: args.property,
        maxLength: maxValue,
        length: args?.value?.length,
        key: options?.key_message ? options.key_message : 'MAX_LENGTH_ERROR',
      };
      return JSON.stringify(message);
    },
    options,
  );
}

export function CustomMin(minValue: number, options?: CustomValidationOptions) {
  return registerCustomValidator(
    (value) => typeof value === 'number' && value >= minValue,
    (args: ValidationArguments, options?: CustomValidationOptions) => {
      const message = {
        fieldName: args.property,
        minLength: minValue,
        length: args?.value?.length,
        key: options?.key_message ? options.key_message : 'MIN_LENGTH_ERROR',
      };
      return JSON.stringify(message);
    },
    options,
  );
}
