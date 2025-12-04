import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js'
import { PhoneNumberRequirements } from './phone-requirements'
import type {
  PhoneNumberRequirement,
  PhoneValidationResult
} from 'src/types/phone-validator'

/**
 * Get country-specific phone number requirements or fallback to default
 * @param country - ISO 3166-1 alpha-2 country code (e.g., 'US', 'BD')
 * @returns PhoneNumberRequirement for the country or default
 */
const getCountryRequirements = (country?: string): PhoneNumberRequirement => {
  return (
    PhoneNumberRequirements.find((req) => req.country === country) ||
    PhoneNumberRequirements.find((req) => req.country === 'DEFAULT')!
  )
}

/**
 * Validate and format a phone number with early country-specific checks
 * @param value - Raw phone number input
 * @param defaultCountry - Optional ISO country code (e.g., 'US')
 * @param requireWhatsApp - Whether the number must support WhatsApp (mobile only)
 * @returns Validation result with formatted number or error details
 */
export const validateAndFormatPhoneNumber = (
  value: string,
  defaultCountry?: string,
  requireWhatsApp: boolean = false
): PhoneValidationResult => {
  const stringValue = value.toString().trim() || ''

  // Clean input: remove non-digits except leading +
  const cleanedValue = stringValue?.replace(/[^\d+]/g, '')
  if (!cleanedValue || cleanedValue === '') {
    return {
      success: false,
      message: 'Phone number cannot be empty',
      type: 'unknown'
    }
  }

  // Get country requirements (or default)
  const requirements = getCountryRequirements(defaultCountry)

  // Early length validation for default country
  const digitLength = cleanedValue.replace(/^\+/, '').length

  if (defaultCountry && isValidCountryCode(defaultCountry)) {
    if (
      digitLength < requirements.minLength ||
      digitLength > requirements.maxLength
    ) {
      return {
        success: false,
        message: `Phone number must be between ${requirements.minLength} and ${requirements.maxLength} digits for ${defaultCountry}`,
        type: 'unknown',
        isValid: false
      }
    }
  } else {
    // Default validation: 8-15 digits
    if (digitLength < 8 || digitLength > 15) {
      return {
        success: false,
        message: 'Phone number must be between 8 and 15 digits',
        type: 'unknown',
        isValid: false
      }
    }
  }

  // Step 1: Try default country if provided and valid
  let defaultCountryResult: PhoneValidationResult | null = null
  // let defaultCountrySuggestions: string[] = [];
  if (defaultCountry && isValidCountryCode(defaultCountry)) {
    const phoneNumber = parsePhoneNumberFromString(
      cleanedValue,
      defaultCountry as CountryCode
    )
    defaultCountryResult = validatePhoneNumber(
      phoneNumber,
      requirements,
      requireWhatsApp,
      'national'
    )

    //if default country passed validation then return success response
    if (defaultCountryResult.success) {
      return defaultCountryResult
    } //if default country failed validation then return error response
    else {
      return {
        success: false,
        message: defaultCountryResult.message,
        type: defaultCountryResult.type,
        suggestion: defaultCountryResult.suggestion,
        isValid: false
      }
    }

    // defaultCountrySuggestions = generateNationalSuggestions(cleanedValue, defaultCountry);
  }

  // Step 2: Try international format if starts with + when default country fails
  // if (cleanedValue.startsWith('+')) {
  //     const phoneNumber = parsePhoneNumberFromString(cleanedValue);
  //     if (phoneNumber?.isValid()) {
  //         const countryRequirements = getCountryRequirements(phoneNumber.country || 'DEFAULT');
  //         const result = validatePhoneNumber(phoneNumber, countryRequirements, requireWhatsApp, 'international');
  //         if (result.success) {
  //             return result;
  //         }
  //     }
  //     const suggestions = generateInternationalSuggestions(cleanedValue);
  //     return {
  //         success: false,
  //         message: 'Invalid international phone number format',
  //         type: 'international',
  //         suggestion: suggestions.length > 0 ? `Try: ${suggestions.join(', ')}` : undefined,
  //         isValid: false,
  //     };
  // }

  // // Step 3: Try to infer country from number when no country is provided
  // const inferredResult = tryInferFromNumber(cleanedValue, requireWhatsApp);
  // if (inferredResult.success) {
  //     return inferredResult;
  // }

  // // If all else fails, return the default country error (if applicable) or a generic error
  // if (defaultCountryResult) {
  //     return {
  //         ...defaultCountryResult,
  //         suggestion: defaultCountrySuggestions.length > 0 ? `Try: ${defaultCountrySuggestions.join(', ')}` : undefined,
  //     };
  // }

  return {
    success: false,
    message:
      'Could not validate phone number. Please include country code or select a country.',
    type: 'unknown',
    suggestion: 'Try adding "+" followed by country code (e.g., +1 for US)',
    isValid: false
  }
}

/**
 * Validate a parsed phone number against requirements
 * @param phoneNumber - Parsed phone number from libphonenumber-js
 * @param requirements - Country-specific requirements
 * @param requireWhatsApp - Whether WhatsApp support is required
 * @param type - Number type (national/international)
 * @returns Validation result
 */
const validatePhoneNumber = (
  phoneNumber: ReturnType<typeof parsePhoneNumberFromString>,
  requirements: PhoneNumberRequirement,
  requireWhatsApp: boolean,
  type: 'international' | 'national'
): PhoneValidationResult => {
  if (!phoneNumber?.isValid() || !phoneNumber.isPossible()) {
    return {
      success: false,
      message: `Invalid phone number for ${requirements.country || 'unknown country'}`,
      type,
      isValid: false
    }
  }

  // Validate pattern
  // if (requirements.pattern && !requirements.pattern.test(phoneNumber.nationalNumber)) {
  //     return {
  //         success: false,
  //         message: `Invalid phone number format for ${phoneNumber.country || requirements.country}`,
  //         type,
  //         suggestion: `Ensure the number follows the format: ${requirements.notes}`,
  //         isValid: false,
  //     };
  // }

  // Validate WhatsApp support
  if (
    requireWhatsApp &&
    (!requirements.whatsappSupported || phoneNumber.getType() !== 'MOBILE')
  ) {
    return {
      success: false,
      message: `Number must be a mobile number for WhatsApp in ${phoneNumber.country || requirements.country}`,
      type,
      isValid: false
    }
  }

  return {
    success: true,
    formattedNumber: phoneNumber.format('E.164'),
    country: phoneNumber.country || requirements.country,
    countryCode: phoneNumber.countryCallingCode,
    isValid: true,
    type
  }
}

/**
 * Try to infer country from number when no country is provided
 * @param value - Cleaned phone number
 * @param requireWhatsApp - Whether WhatsApp support is required
 * @returns Validation result
 */
const tryInferFromNumber = (
  value: string,
  requireWhatsApp: boolean
): PhoneValidationResult => {
  const withPlus = `+${value}`
  const phoneNumber = parsePhoneNumberFromString(withPlus)

  if (phoneNumber?.isValid()) {
    const requirements = getCountryRequirements(
      phoneNumber.country || 'DEFAULT'
    )
    return validatePhoneNumber(
      phoneNumber,
      requirements,
      requireWhatsApp,
      'international'
    )
  }

  // Try common country codes from requirements
  const commonCodes = PhoneNumberRequirements.filter(
    (req) => req.country !== 'DEFAULT'
  ).map((req) => req.countryCallingCode.replace(/^\+/, ''))
  for (const code of commonCodes) {
    const testValue = `+${code}${value}`
    const testPhone = parsePhoneNumberFromString(testValue)
    if (testPhone?.isValid()) {
      const requirements = getCountryRequirements(
        testPhone.country || 'DEFAULT'
      )
      const result = validatePhoneNumber(
        testPhone,
        requirements,
        requireWhatsApp,
        'international'
      )
      if (result.success) {
        return result
      }
    }
  }

  return {
    success: false,
    message:
      'Could not validate phone number. Please include country code or select a country.',
    type: 'unknown',
    suggestion:
      'Try adding "+" followed by country code (e.g., +880 for Bangladesh)',
    isValid: false
  }
}

/**
 * Validate country code format
 * @param code - ISO country code
 * @returns True if valid (e.g., 'US', 'BD')
 */
const isValidCountryCode = (code: string): boolean => {
  return /^[A-Z]{2}$/.test(code.toUpperCase())
}

/**
 * Generate suggestions for international numbers
 * @param value - Cleaned phone number
 * @returns Array of suggested formats
 */
const generateInternationalSuggestions = (value: string): string[] => {
  const suggestions: string[] = []
  const digitsOnly = value.replace(/^\+/, '')
  const commonCodes = PhoneNumberRequirements.filter(
    (req) => req.country !== 'DEFAULT'
  ).map((req) => req.countryCallingCode.replace(/^\+/, ''))

  for (const code of commonCodes) {
    if (!digitsOnly.startsWith(code)) {
      suggestions.push(`+${code}${digitsOnly}`)
    }
  }

  return suggestions.slice(0, 3)
}

/**
 * Generate suggestions for national numbers
 * @param value - Cleaned phone number
 * @param country - ISO country code
 * @returns Array of suggested formats
 */
const generateNationalSuggestions = (
  value: string,
  country: string
): string[] => {
  const suggestions: string[] = []
  const commonPrefixes = ['0', '']

  for (const prefix of commonPrefixes) {
    const testValue = prefix + value
    const phoneNumber = parsePhoneNumberFromString(
      testValue,
      country as CountryCode
    )
    if (phoneNumber?.isValid()) {
      suggestions.push(phoneNumber.format('NATIONAL'))
    }
  }

  return suggestions.slice(0, 3)
}

/**
 * Format phone number for display
 * @param value - Raw phone number
 * @param defaultCountry - Optional ISO country code
 * @param format - Output format (national, international, E.164)
 * @returns Formatted number or original value if invalid
 */
export const formatForDisplay = (
  value: string,
  defaultCountry?: string,
  format: 'national' | 'international' | 'E.164' = 'international'
): string => {
  const result = validateAndFormatPhoneNumber(value, defaultCountry)
  if (!result.success) return value

  const phoneNumber = parsePhoneNumberFromString(result.formattedNumber!)
  if (!phoneNumber) return value

  switch (format) {
    case 'national':
      return phoneNumber.format('NATIONAL')
    case 'international':
      return phoneNumber.format('INTERNATIONAL')
    case 'E.164':
      return phoneNumber.format('E.164')
    default:
      return phoneNumber.format('INTERNATIONAL')
  }
}

/**
 * Normalize phone number to E.164 format
 * @param value - Raw phone number
 * @param defaultCountry - Optional ISO country code
 * @returns E.164 formatted number or original value if invalid
 */
export const normalizePhoneNumberE164Format = (
  value: string,
  defaultCountry?: string
): string => {
  const result = validateAndFormatPhoneNumber(value, defaultCountry)
  return result.formattedNumber || value
}

/**
 * Check if a phone number is valid
 * @param value - Raw phone number
 * @param defaultCountry - Optional ISO country code
 * @param requireWhatsApp - Whether WhatsApp support is required
 * @returns True if valid, else false
 */
export const isValidPhoneNumber = (
  value: string,
  defaultCountry?: string,
  requireWhatsApp: boolean = false
): boolean => {
  return validateAndFormatPhoneNumber(value, defaultCountry, requireWhatsApp)
    .success
}

/**
 * Get phone number type (e.g., mobile, landline)
 * @param value - Raw phone number
 * @param defaultCountry - Optional ISO country code
 * @returns Phone number type or undefined if invalid
 */
export const getPhoneNumberType = (
  value: string,
  defaultCountry?: string
): string | undefined => {
  const result = validateAndFormatPhoneNumber(value, defaultCountry)
  if (!result.success) return undefined
  const phoneNumber = parsePhoneNumberFromString(result.formattedNumber!)
  return phoneNumber?.getType()
}

/**
 * Get country from phone number
 * @param value - Raw phone number
 * @param defaultCountry - Optional ISO country code
 * @returns Country code or undefined if invalid
 */
export const getCountryFromPhoneNumber = (
  value: string,
  defaultCountry?: string
): string | undefined => {
  return validateAndFormatPhoneNumber(value, defaultCountry).country
}

/**
 * Batch validate phone numbers
 * @param numbers - Array of phone numbers with optional country codes
 * @param defaultCountry - Optional ISO country code
 * @returns Array of validation results with original values
 */
export const batchValidatePhoneNumbersE164Format = (
  numbers: Array<{ value: string; country?: string }>,
  defaultCountry?: string
): Array<PhoneValidationResult & { originalValue: string }> => {
  return numbers.map(({ value, country }) => ({
    originalValue: value,
    ...validateAndFormatPhoneNumber(value, country || defaultCountry)
  }))
}
