export class PaginationMetaDto {
    total: number;         // total items
    perPage: number;       // items per page
    currentPage: number;   // current page
    totalPages: number;    // total pages
    nextPage?: number;     // optional next page
    prevPage?: number;     // optional previous page
}


export class ApiListResponseDto<T> {
    statusCode: number;
    message: string;
    data: T[];
    pagination?: PaginationMetaDto; // grouped pagination info
}
