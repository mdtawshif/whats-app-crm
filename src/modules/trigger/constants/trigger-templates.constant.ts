export const TRIGGER_TEMPLATES = {
    WELCOME: 'welcome',
    HAPPY_BIRTHDAY: 'happy_birthday',
    ANNIVERSARY: 'anniversary',
    PROMOTIONAL: 'promotional',
    CUSTOM: 'custom',
} as const;

export type TriggerTemplateType = keyof typeof TRIGGER_TEMPLATES;