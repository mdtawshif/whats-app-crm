import { SearchUtils } from "./search.utils";

/**
 * Example 1: Search non-relational fields in InboxThread
 * Searches only `messageContent`, `from`, and `to` fields in InboxThread.
 * Uses 'ALL' strategy to match all terms in any of these fields.
 * @example
 */
const baseWhere = { agencyId: 1, status: 'open', userId: 2 };
const searchQuery = SearchUtils.applySearch(baseWhere, "hello world", {
    fields: ['messageContent', 'from', 'to'],
    strategy: 'ALL',
    minTermLength: 2,
    maxTerms: 5,
    caseSensitive: false,
});
// Resulting where clause:
// {
//   AND: [
//     { agencyId: 1 },
//     {
//       AND: [
//         { OR: [
//           { messageContent: { contains: 'hello' } },
//           { from: { contains: 'hello' } },
//           { to: { contains: 'hello' } }
//         ]},
//         { OR: [
//           { messageContent: { contains: 'world' } },
//           { from: { contains: 'world' } },
//           { to: { contains: 'world' } }
//         ]}
//       ]
//     }
//   ]
// }

/**
 * Example 2: Search relational Contact fields in InboxThread
 * Searches `Contact` fields (firstName, lastName) alongside InboxThread fields.
 * Uses 'ALL' strategy to ensure all terms appear in any field.
 * @example
 */
const baseWhereWithContact = { agencyId: 1 };
const searchQueryWithContact = SearchUtils.applySearch(baseWhereWithContact, "john doe", {
    fields: ['messageContent'],
    relationFields: {
        contact: ['firstName', 'lastName'],
    },
    strategy: 'ALL',
    minTermLength: 2,
    maxTerms: 5,
    caseSensitive: false,
});
// Resulting where clause:
// {
//   AND: [
//     { agencyId: 1 },
//     {
//       AND: [
//         { OR: [
//           { messageContent: { contains: 'john' } },
//           { contact: { firstName: { contains: 'john' } } },
//           { contact: { lastName: { contains: 'john' } } }
//         ]},
//         { OR: [
//           { messageContent: { contains: 'doe' } },
//           { contact: { firstName: { contains: 'doe' } } },
//           { contact: { lastName: { contains: 'doe' } } }
//         ]}
//       ]
//     }
//   ]
// }

/**
 * Example 3: Search with EXACT strategy across InboxThread and Contact
 * Searches for an exact phrase in `messageContent` or Contact's `email`.
 * @example
 */
const baseWhereExact = { agencyId: 1 };
const searchQueryExact = SearchUtils.applySearch(baseWhereExact, "john.doe@example.com", {
    fields: ['messageContent'],
    relationFields: {
        contact: ['email'],
    },
    strategy: 'EXACT',
    minTermLength: 2,
    maxTerms: 5,
    caseSensitive: false,
});
// Resulting where clause:
// {
//   AND: [
//     { agencyId: 1 },
//     {
//       OR: [
//         { messageContent: { contains: 'john.doe@example.com' } },
//         { contact: { email: { contains: 'john.doe@example.com' } } }
//       ]
//     }
//   ]
// }

/**
 * Example 4: Search multiple relational fields (Contact and User)
 * Searches InboxThread, Contact, and User fields (e.g., user email).
 * Uses 'ANY' strategy to match any term in any field.
 * @example
 */
const baseWhereMultiRelation = { agencyId: 1 };
const searchQueryMultiRelation = SearchUtils.applySearch(baseWhereMultiRelation, "john support", {
    fields: ['messageContent', 'from'],
    relationFields: {
        contact: ['firstName', 'lastName', 'email'],
        user: ['email'], // Assuming User model has an email field
    },
    strategy: 'ANY',
    minTermLength: 2,
    maxTerms: 5,
    caseSensitive: false,
});
// Resulting where clause:
// {
//   AND: [
//     { agencyId: 1 },
//     {
//       OR: [
//         { messageContent: { contains: 'john' } },
//         { from: { contains: 'john' } },
//         { contact: { firstName: { contains: 'john' } } },
//         { contact: { lastName: { contains: 'john' } } },
//         { contact: { email: { contains: 'john' } } },
//         { user: { email: { contains: 'john' } } },
//         { messageContent: { contains: 'support' } },
//         { from: { contains: 'support' } },
//         { contact: { firstName: { contains: 'support' } } },
//         { contact: { lastName: { contains: 'support' } } },
//         { contact: { email: { contains: 'support' } } },
//         { user: { email: { contains: 'support' } } }
//       ]
//     }
//   ]
// }

/**
 * Example 5: Search with no base filters, only relational Contact fields
 * Searches only Contact fields (number, city) with no base where clause.
 * Uses 'ALL' strategy to match all terms.
 * @example
 */
const emptyBaseWhere = {};
const searchQueryContactOnly = SearchUtils.applySearch(emptyBaseWhere, "new york", {
    fields: [],
    relationFields: {
        contact: ['number', 'city'],
    },
    strategy: 'ALL',
    minTermLength: 2,
    maxTerms: 5,
    caseSensitive: false,
});
// Resulting where clause:
// {
//   AND: [
//     { OR: [
//       { contact: { number: { contains: 'new' } } },
//       { contact: { city: { contains: 'new' } } }
//     ]},
//     { OR: [
//       { contact: { number: { contains: 'york' } } },
//       { contact: { city: { contains: 'york' } } }
//     ]}
//   ]
// }