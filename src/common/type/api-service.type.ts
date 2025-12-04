export declare type ApiServiceResponse = {
  responseCode: number;
  message: string;
  data?: [] | object | boolean;
  success: boolean;
  extraData?: object;
};

export declare type DataTableResponse = {
  totalItems: number;
  totalPages: number;
  currentPage: number;
};

export declare type DataTableDaoResponse = {
  count: number;
  rows: Partial<object[]>;
};
