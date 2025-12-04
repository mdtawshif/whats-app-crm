export const prepareCommonQueryParams = (data: any) => {
  const { page = 1, perPage = 10, sortDirection, sortOn, query } = data || {};

  const skip = (page - 1) * perPage;
  let orderBy: Record<string, 'asc' | 'desc'> = { id: 'desc' };

  if (sortDirection && sortOn) {
    orderBy = {
      [sortOn]: sortDirection,
    };
  }

  return {
    ...data,
    skip,
    take: perPage,
    page,
    orderBy,
    searchKey: query,
  };
};
