export interface CSVParseResult {
    headers: string[];
    rows: (string | number | boolean | null)[][];
    fileName: string;
    fileSize: number;
    totalRows: number;
    validRows: number;
    hasHeaders: boolean;
    errors: CSVParseError[];
    detectedDelimiter?: string;
    fileFormat: 'csv' | 'txt';
}

export interface CSVParseError {
    message: string;
    row?: number;
    type?: string | 'format' | 'validation' | 'encoding' | 'structure';
}

export interface CSVParserConfig {
    hasHeaders: boolean;
    delimiter?: string;
    skipEmptyLines?: boolean;
    dynamicTyping?: boolean;
    encoding?: string;
    maxRows?: number;
    strictColumnCount?: boolean;

    chunkSize?: number; // Number of rows per chunk
}