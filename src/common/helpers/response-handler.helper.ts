import { ApiServiceResponse } from '../type/api-service.type';

const returnError = (statusCode: number, message: string, data?: [] | object | boolean,) => {
  const response: ApiServiceResponse = {
    responseCode: statusCode,
    message,
    success: false,
    data: data
  };

  return response;
};

const returnSuccess = (
  statusCode: number,
  message: string,
  data?: [] | object | boolean,
  pagination?: object,
) => {
  const response: ApiServiceResponse = {
    responseCode: statusCode,
    success: true,
    message,
    extraData: pagination,
    data,
  };

  return response;
};

const getPaginationData = (page, total, limit) => {
  const currentPage = page ? +page : 0;
  const totalPages = Math.ceil(total / limit);

  return {
    total,
    totalPages,
    currentPage,
    perPage: limit,
  };
};

export { getPaginationData, returnError, returnSuccess };
