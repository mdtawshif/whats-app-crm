// src/utils/search.utils.ts

export class SearchUtils {
    /**
     * Build a precise search query for Prisma
     * @param search The search string to process
     * @param options Configuration options for the search
     * @param options.fields Array of field names to search in the main model
     * @param options.relationFields Object mapping relation names to their searchable fields
     * @param options.strategy Search strategy ('EXACT', 'ALL', 'ANY')
     * @param options.minTermLength Minimum character length for a term
     * @param options.maxTerms Maximum number of terms to include
     * @param options.caseSensitive Whether the search is case-sensitive
     */
    static buildSearchQuery<T = any>(
        search: string,
        options: {
            fields: (keyof T)[];
            relationFields?: Record<string, string[]>;
            strategy?: 'EXACT' | 'ALL' | 'ANY';
            minTermLength?: number;
            maxTerms?: number;
            caseSensitive?: boolean;
        }
    ): Record<string, any> {
        if (!search?.trim()) return {};

        const {
            fields,
            relationFields = {},
            strategy = 'ALL',
            minTermLength = 2,
            maxTerms = 5,
            caseSensitive = false,
        } = options;

        // Clean and normalize search string
        const cleanedSearch = search.trim();

        // For EXACT strategy, handle both main and relation fields
        if (strategy === 'EXACT') {
            const mainConditions = fields.map((field) => ({
                [field]: {
                    contains: cleanedSearch,
                    ...(this.getCaseOption(caseSensitive)),
                },
            }));

            const relationConditions = Object.entries(relationFields).flatMap(([relation, relFields]) =>
                relFields.map((field) => ({
                    [relation]: {
                        [field]: {
                            contains: cleanedSearch,
                            ...(this.getCaseOption(caseSensitive)),
                        },
                    },
                }))
            );

            return {
                OR: [...mainConditions, ...relationConditions],
            };
        }

        // Split into terms
        const terms = cleanedSearch
            .split(/\s+/)
            .filter((term) => term.length >= minTermLength)
            .slice(0, maxTerms);

        if (terms.length === 0) return {};

        // Build conditions based on strategy
        switch (strategy) {
            case 'ALL':
                return this.buildAllTermsQuery(fields, relationFields, terms, caseSensitive);
            case 'ANY':
                return this.buildAnyTermQuery(fields, relationFields, terms, caseSensitive);
            default:
                return this.buildAllTermsQuery(fields, relationFields, terms, caseSensitive);
        }
    }

    /**
     * Build query where ALL terms must be present in at least one field (main or relation)
     */
    private static buildAllTermsQuery<T = any>(
        fields: (keyof T)[],
        relationFields: Record<string, string[]>,
        terms: string[],
        caseSensitive: boolean
    ) {
        return {
            AND: terms.map((term) => ({
                OR: [
                    // Main model fields
                    ...fields.map((field) => ({
                        [field]: {
                            contains: term,
                            ...(this.getCaseOption(caseSensitive)),
                        },
                    })),
                    // Relation fields
                    ...Object.entries(relationFields).flatMap(([relation, relFields]) =>
                        relFields.map((field) => ({
                            [relation]: {
                                [field]: {
                                    contains: term,
                                    ...(this.getCaseOption(caseSensitive)),
                                },
                            },
                        }))
                    ),
                ],
            })),
        };
    }

    /**
     * Build query where ANY term can be present in any field (main or relation)
     */
    private static buildAnyTermQuery<T = any>(
        fields: (keyof T)[],
        relationFields: Record<string, string[]>,
        terms: string[],
        caseSensitive: boolean
    ) {
        return {
            OR: terms.flatMap((term) =>
                [
                    ...fields.map((field) => ({
                        [field]: {
                            contains: term,
                            ...(this.getCaseOption(caseSensitive)),
                        },
                    })),
                    ...Object.entries(relationFields).flatMap(([relation, relFields]) =>
                        relFields.map((field) => ({
                            [relation]: {
                                [field]: {
                                    contains: term,
                                    ...(this.getCaseOption(caseSensitive)),
                                },
                            },
                        }))
                    ),
                ]
            ),
        };
    }

    /**
     * Get case sensitivity option based on database support
     */
    private static getCaseOption(caseSensitive: boolean) {
        // Keep original behavior: no 'mode' for MySQL compatibility
        return caseSensitive ? {} : {};
    }

    /**
     * Apply search to an existing where clause
     */
    static applySearch<T = any>(
        where: Record<string, any>,
        search: string,
        options: {
            fields: (keyof T)[];
            relationFields?: Record<string, string[]>;
            strategy?: 'EXACT' | 'ALL' | 'ANY';
            minTermLength?: number;
            maxTerms?: number;
            caseSensitive?: boolean;
        }
    ) {
        const searchQuery = this.buildSearchQuery<T>(search, options);

        if (Object.keys(searchQuery).length === 0) {
            return where;
        }

        if (Object.keys(where).length === 0) {
            return searchQuery;
        }

        return {
            AND: [where, searchQuery],
        };
    }
}