// Centralized return type for parsed dates
export type ParsedDate = {
    year: number;
    month: number;
    day: number;
    date: string | Date;
};