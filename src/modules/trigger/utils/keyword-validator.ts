/**
import { normalizeText } from "../../../utils/utils";
 * Validates if a message content matches keyword trigger criteria
 */
export class KeywordValidator {

    /**
     * Normalize text for matching
     * @param text The text to normalize
     * @returns The normalized text
     * */
    static normalizeContent(text: string): string {
        if (!text) return "";
        return text?.trim()?.toLocaleLowerCase();
    }
    /**
     * Check if message content matches the keyword criteria
     * @param messageContent The message content to check
     * @param filters Array of filters from the trigger configuration
     * @returns True if the message matches the criteria
     */
    static validate(messageContent: string, filters: any[]): boolean {
        // Debug log the filters

        // Find the keyword and match condition filters using 'field' property
        const keywordFilter = filters.find(f => f.field === 'keyword');
        const matchConditionFilter = filters.find(f => f.field === 'matchCondition');

        // Debug log the found filters
        console.log('Keyword filter:', keywordFilter);
        console.log('Match condition filter:', matchConditionFilter);

        // Validate required filters are present
        if (!keywordFilter) {
            console.warn('Missing required keyword filter');
            return false;
        }

        if (!matchConditionFilter) {
            console.warn('Missing required match condition filter');
            return false;
        }

        const normalizedKeyword = this.normalizeContent(keywordFilter.value);
        const matchCondition = matchConditionFilter.value;


        // Validate keyword is not empty
        if (!normalizedKeyword) {
            console.warn('Keyword filter value is empty');
            return false;
        }

        // Normalize message content for comparison
        const normalizedContent = this.normalizeContent(messageContent); //messageContent.trim()?.toLocaleLowerCase();
        console.log('Normalized message content:', normalizedContent);

        // Apply match condition
        let result = false;
        switch (matchCondition) {
            case 'exact':
                result = normalizedContent === normalizedKeyword;
                break;
            case 'starts_with':
                result = normalizedContent.startsWith(normalizedKeyword);
                break;
            case 'ends_with':
                result = normalizedContent.endsWith(normalizedKeyword);
                break;
            case 'contains':
                result = normalizedContent.includes(normalizedKeyword);
                break;
            default:
                console.warn(`Unknown match condition: ${matchCondition}`);
                result = false;
        }

        console.log(`Match result: ${result} (condition: ${matchCondition}, keyword: "${normalizedKeyword}", message: "${normalizedContent}")`);
        return result;
    }


}