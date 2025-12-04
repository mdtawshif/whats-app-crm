class Pagination {
  page: number;
  pageSize: number;
  total: number;
}

export class SuccessApiResponse {
  responseCode?: number;
  success?: boolean;
  message?: string;
  extraData?: Pagination | any;
  data?: any;
}
