// Interface for validation result
export interface PhoneValidationResult {
    success: boolean;
    message?: string;
    formattedNumber?: string;
    country?: string;
    countryCode?: string;
    isValid?: boolean;
    type?: 'international' | 'national' | 'unknown';
    suggestion?: string;
}
export interface PhoneNumberRequirement {
    country: string; // ISO 3166-1 alpha-2 country code
    countryCallingCode: string; // E.164 country code
    minLength: number; // Minimum digits (excluding country code)
    maxLength: number; // Maximum digits (excluding country code)
    whatsappSupported: boolean; // Whether WhatsApp is supported (mobile numbers)
    pattern?: RegExp; // Regex for mobile number format
    notes?: string; // Metadata for clarity
}