export class PaginationInfo {
  totalCount: number;
  totalPages: number;
  currentPage: number;
  perPage: number;
  nextPage: number | null;
  prevPage: number | null;

  constructor(totalCount: number, currentPage: number, perPage: number) {
    this.totalCount = totalCount;
    this.currentPage = currentPage;
    this.perPage = perPage;
    this.totalPages = Math.ceil(totalCount / perPage);
    this.prevPage = currentPage > 1 ? currentPage - 1 : currentPage;
    this.nextPage = currentPage < this.totalPages ? currentPage + 1 : this.totalPages;
  }
}