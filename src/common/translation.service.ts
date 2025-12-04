import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class TranslationService {
  private language: string = 'en';
  private translations: Record<string, Record<string, string>> = {};
  private resolver: string | undefined;

  // Load translations for a specific language
  private loadTranslations(): Record<string, string> {
    if (this.translations[this.language]) {
      // console.log("inside");
      return this.translations[this.language]; // Return cached translation
    }
    // console.log("outside");
    let translationFilePath = `${this.language}/translation.json`;

    const filePath = path.resolve(`./locales/${translationFilePath}`);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      this.translations[this.language] = JSON.parse(content);
      return this.translations[this.language];
    } else {
      if (process.env.APP_ENVIRONMENT === 'development') {
        throw new Error('Translation file not found');
      }
    }
  }

  translate(
    key: string | string[],
    language?: string,
    values: Record<string, string> = {},
  ): string[] | string {
    if (language) this.language = language;

    const translations: Record<string, string> = this.loadTranslations();
    // console.log("translations", key);
    let translatedMessage = key;
    if (!translations) return translatedMessage;

    if (Array.isArray(key)) {
      return key
        .map((str) => {
          str = str?.split('.')[str.split('.').length - 1] || str;
          return this.getTranslationWithPlaceholders(str, translations);
        })
        .filter((value) => value !== null && value !== undefined);
    }

    return this.getTranslationWithPlaceholders(key, translations);
  }

  private getTranslationWithPlaceholders(
    str: string,
    translation: Record<string, string>,
  ): string {
    let result = translation[str] || str;

    try {
      const parsed = JSON.parse(str);
      if (typeof parsed === 'object' && parsed !== null) {
        const { key, ...rest } = parsed;
        if (!key) {
          result = str;
        } else {
          result = translation[key];
          if (result && rest) {
            Object.keys(rest).forEach((placeholder) => {
              const regex = new RegExp(`{{${placeholder}}}`, 'g');
              result = result.replace(regex, rest[placeholder]);
              // result = result.replace(`{{${placeholder}}}`, rest[placeholder]);
            });
          } else {
            result = key;
          }
        }
      }
    } catch (error) {
      result = result || str;
    }
    return result;
  }
}
