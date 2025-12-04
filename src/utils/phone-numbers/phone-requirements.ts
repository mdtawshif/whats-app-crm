import type { PhoneNumberRequirement } from "src/types/phone-validator";




export const PhoneNumberRequirements: PhoneNumberRequirement[] = [

    {
        country: 'BD', // Bangladesh
        countryCallingCode: '+880',
        minLength: 11,
        maxLength: 15,
        whatsappSupported: true,
        pattern: /^(?:\+?88)?01[3-9]\d{8}$/, // total 11 digits without +880, 14 with it

        notes: 'Bangladesh mobile numbers start with 01 followed by 3-9 and are 11 digits.',
    },
    {
        country: 'DEFAULT', // Default fallback for unlisted countries
        countryCallingCode: '',
        minLength: 8,
        maxLength: 15,
        whatsappSupported: false,
        notes: 'Default fallback for unlisted countries, allowing 8-15 digits.',
    },
];