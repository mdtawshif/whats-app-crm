import * as fs from 'fs';
import * as path from 'path';

let language: string = 'en';

// Load translations for a specific language
function loadTranslations(
  language: string,
): Record<string, string> | undefined {
  let translationFilePath = `${language}/translation.json`;
  const filePath = path.resolve(`./locales/${translationFilePath}`);

  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } else {
    if (process.env.APP_ENVIRONMENT === 'development') {
      throw new Error('Translation file not found');
    }
  }
}

// Function to handle placeholder replacements in translations
function getTranslationWithPlaceholders(
  str: string,
  translations: Record<string, string>,
  values: Record<string, string>,
): string {
  let result = translations[str] || str;

  try {
    const parsed = JSON.parse(str);
    console.log('++++++++++++++++++++++==', parsed, typeof parsed);
    if (typeof parsed === 'object' && parsed !== null) {
      const { message_key, ...rest } = parsed;
      console.log('message_key1', message_key, rest);
      if (!message_key) {
        result = str;
      } else {
        result = translations[message_key];
        if (result && rest) {
          Object.keys(rest).forEach((placeholder) => {
            const regex = new RegExp(`{{${placeholder}}}`, 'g');
            result = result.replace(regex, rest[placeholder]);
            console.log('result', result);
          });
        } else {
          result = message_key;
        }
      }
    }
  } catch (error) {
    result = result || str;
  }

  // Replace placeholders with actual values
  Object.keys(values).forEach((placeholder) => {
    const regex = new RegExp(`{{${placeholder}}}`, 'g');
    result = result.replace(regex, values[placeholder]);
  });

  return result;
}

// Translation function that handles both single and array keys
export function translateInternal(
  message_key: string | string[],
  languageInput?: string,
  values: Record<string, string> = {},
): string | string[] {
  if (languageInput) language = languageInput;

  const translations = loadTranslations(language);
  let translatedMessage = message_key;

  if (!translations) return translatedMessage;
  console.log('message_key', message_key);
  if (Array.isArray(message_key)) {
    return message_key
      .map((str) => {
        str = str?.split('.')[str.split('.').length - 1] || str;
        return getTranslationWithPlaceholders(str, translations, values);
      })
      .filter((value) => value !== null && value !== undefined);
  }

  // Handle single string input
  return getTranslationWithPlaceholders(message_key, translations, values);
}
