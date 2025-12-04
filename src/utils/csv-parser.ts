import Papa from 'papaparse';
import type { CSVParseResult, CSVParserConfig, CSVParseError } from '../types/csv-parser';



/**
 * Parses CSV content into headers and rows with maximum optimization.
 * @param content - CSV content as a string
 * @param fileName - Original file name
 * @param config - Parsing configuration
 * @returns Promise resolving to CSVParseResult
 * @example
 * ```typescript
 * const result = await parseCSV(content, 'contacts.csv', { hasHeaders: true, chunkSize: 1000 });
 * console.log(result.headers, result.rows);
 * ```
 */
export async function parseCSV(
    content: string,
    fileName: string,
    config: CSVParserConfig = { hasHeaders: true }
): Promise<CSVParseResult> {
    const {
        hasHeaders = true,
        delimiter = '',
        skipEmptyLines = true,
        dynamicTyping = false,
        encoding = 'UTF-8',
        maxRows = 100000,
        strictColumnCount = true,
        chunkSize = 2, // Default to 1000 rows per chunk
    } = config;

    const fileFormat = fileName.toLowerCase().endsWith('.csv') ? 'csv' : 'txt';
    const fileSize = Buffer.byteLength(content, 'utf8');

    // --- Start Chunk-Related Change ---
    let headers: string[] = [];
    let allRows: (string | number | boolean | null)[][] = [];
    let errors: CSVParseError[] = [];
    let detectedDelimiter: string | undefined;
    let totalRows = 0;
    let validRows = 0;
    let isFirstChunk = true;

    return new Promise((resolve) => {
        Papa.parse<(string | number | boolean | null)[]>(content, {
            header: false,
            skipEmptyLines,
            dynamicTyping,
            delimiter,
            encoding,
            chunkSize, // Enable chunked processing
            transform: transformValue,
            transformHeader,
            chunk: async ({ data, meta, errors: parseErrors }, parser) => {
                // Pause parser to process chunk asynchronously
                parser.pause();

                // Map parse errors
                const chunkErrors = parseErrors.map((e) => ({
                    message: e.message,
                    row: e.row ? e.row + totalRows : undefined,
                    type: 'format' as const,
                }));

                // Process chunk with processResults
                const result = await processResults(
                    data,
                    { name: fileName, size: fileSize },
                    { hasHeaders, strictColumnCount, maxRows, fileFormat, detectedDelimiter: meta.delimiter },
                    chunkErrors,
                    isFirstChunk
                );
                console.log(`Content: Rows = ............. ${content.length}`);

                // Update state
                if (isFirstChunk) {
                    headers = result.headers;
                    detectedDelimiter = meta.delimiter;
                    isFirstChunk = false;
                }
                allRows = [...allRows, ...result.rows];
                errors = [...errors, ...result.errors];
                totalRows += result.totalRows;
                validRows += result.validRows;

                // Truncate if exceeding maxRows
                if (totalRows > maxRows) {
                    errors.push({ message: `File truncated to ${maxRows} rows`, type: 'validation' });
                    allRows = allRows.slice(0, maxRows - (hasHeaders ? 1 : 0));
                    parser.abort(); // Stop parsing
                }

                parser.resume(); // Continue with next chunk
            },
            complete: () => {
                resolve({
                    headers,
                    rows: allRows,
                    fileName,
                    fileSize,
                    totalRows,
                    validRows,
                    hasHeaders,
                    errors,
                    detectedDelimiter,
                    fileFormat,
                });
            },
            error: (error) =>
                resolve({
                    headers: [],
                    rows: [],
                    fileName,
                    fileSize,
                    totalRows: 0,
                    validRows: 0,
                    hasHeaders: false,
                    errors: [{ message: `Parse error: ${error.message}`, type: 'encoding' }],
                    fileFormat,
                }),
        });
    });
    // --- End Chunk-Related Change ---
}

/**
 * Processes parsed CSV data into structured output with parallel tasks, optimized for chunked processing.
 * @param data - Raw parsed data (chunk)
 * @param fileInfo - File metadata
 * @param options - Processing options
 * @param parseErrors - Errors from Papa Parse
 * @param isFirstChunk - Whether this is the first chunk (for header extraction)
 * @returns Formatted CSVParseResult
 */
async function processResults(
    data: (string | number | boolean | null)[][],
    fileInfo: { name: string; size: number },
    options: {
        hasHeaders: boolean;
        strictColumnCount: boolean;
        maxRows: number;
        fileFormat: 'csv' | 'txt';
        detectedDelimiter?: string;
    },
    parseErrors: CSVParseError[],
    // --- Start Chunk-Related Change ---
    isFirstChunk: boolean // Added to handle headers in first chunk only
    // --- End Chunk-Related Change ---
): Promise<CSVParseResult> {
    const { hasHeaders, strictColumnCount, maxRows, fileFormat, detectedDelimiter } = options;

    // --- Start Chunk-Related Change ---
    // Clean rows in one pass, limit to remaining rows within maxRows
    const remainingRows = maxRows - (hasHeaders && isFirstChunk ? 1 : 0);
    // console.log("MaxRows: ............. " + maxRows);
    // console.log("remainingRows: ............. " + remainingRows);
    
    const cleanedData = cleanRows(data.slice(0, remainingRows));
    const errors: CSVParseError[] = [
        ...parseErrors,
        ...(data.length > remainingRows ? [{ message: `Chunk truncated to ${remainingRows} rows`, type: 'validation' }] : []),
    ];

    // Extract headers only in the first chunk
    const headers = isFirstChunk ? await extractHeaders(cleanedData, hasHeaders) : [];

    // Process rows (skip headers in first chunk if hasHeaders)
    const rowsToProcess = hasHeaders && isFirstChunk ? cleanedData.slice(1) : cleanedData;

    // Parallelize row normalization and metrics
    const [normalized, metrics] = await Promise.all([
        normalizeRows(rowsToProcess, headers.length || cleanedData[0]?.length || 0, strictColumnCount),
        calculateMetrics(rowsToProcess, headers.length || cleanedData[0]?.length || 0),
    ]);

    return {
        headers,
        rows: normalized.rows,
        fileName: fileInfo.name,
        fileSize: fileInfo.size,
        totalRows: metrics.totalRows,
        validRows: metrics.validRows,
        hasHeaders,
        errors: [...errors, ...normalized.errors],
        detectedDelimiter,
        fileFormat,
    };
    // --- End Chunk-Related Change ---
}

/**
 * Normalizes row lengths to match header count.
 * @param rows - Raw CSV rows
 * @param headerCount - Number of headers
 * @param strictColumnCount - Whether to enforce consistent columns
 * @returns Normalized rows and errors
 */
async function normalizeRows(
    rows: (string | number | boolean | null)[][],
    headerCount: number,
    strictColumnCount: boolean
): Promise<{ rows: (string | number | boolean | null)[][]; errors: CSVParseError[] }> {
    if (!strictColumnCount || !headerCount || !rows.length) return { rows, errors: [] };

    const inconsistentRowsCount = rows.reduce(
        (count, row) => (row.length !== headerCount ? count + 1 : count),
        0
    );
    const errors: CSVParseError[] = inconsistentRowsCount
        ? [{ message: `${inconsistentRowsCount} rows have inconsistent column count`, type: 'structure' }]
        : [];

    const normalizedRows = rows.map((row) =>
        row.length < headerCount
            ? [...row, ...Array(headerCount - row.length).fill(null)]
            : row.length > headerCount
                ? row.slice(0, headerCount)
                : row
    );

    return { rows: normalizedRows, errors };
}

/**
 * Calculates row metrics in one pass.
 * @param rows - Normalized CSV rows
 * @param headerCount - Number of headers
 * @returns Total and valid row counts
 */
async function calculateMetrics(
    rows: (string | number | boolean | null)[][],
    headerCount: number
): Promise<{ totalRows: number; validRows: number }> {
    const totalRows = rows.length;
    const validRows = rows.reduce(
        (count, row) =>
            row.length === headerCount && row.some((cell) => cell !== null && cell !== '') ? count + 1 : count,
        0
    );
    return { totalRows, validRows };
}



/**
 * Transforms raw cell value for CSV parsing.
 * @param value - Raw cell value
 * @returns Transformed value
 */
function transformValue(value: string): string | number | boolean | null {
    const trimmed = value?.trim();
    return trimmed
        ? trimmed.startsWith('=') ? trimmed.slice(1) : trimmed.replace(/^"|"$/g, '')
        : null;
}

/**
 * Filters out invalid rows in one pass.
 * @param data - Raw CSV data
 * @returns Cleaned data
 */
function cleanRows(data: (string | number | boolean | null)[][]): (string | number | boolean | null)[][] {
    return data.filter((row) => row?.length && row.some((cell) => cell !== null && cell.toString().trim()));
}

/**
 * Normalizes header names for consistency.
 * @param header - Raw header string
 * @returns Normalized header
 */
function transformHeader(header: string): string {
    return header.trim().replace(/\s+/g, '_').toLowerCase();
}



/**
 * Extracts headers based on configuration.
 * @param data - Cleaned CSV data
 * @param hasHeaders - Whether the first row is headers
 * @returns Headers
 */
async function extractHeaders(
    data: (string | number | boolean | null)[][],
    hasHeaders: boolean
): Promise<string[]> {
    if (!data[0]?.length) return [];
    return hasHeaders
        ? data[0].map((h) => transformHeader(h?.toString() ?? ''))
        : Array.from({ length: data[0].length }, (_, i) => `column_${i + 1}`);
}
