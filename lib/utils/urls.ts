export interface EmailSearchParams {
  page?: number;
  search?: string;
  accountId?: string;
  filter?: string;
}

export function buildEmailsUrl(params: EmailSearchParams = {}): string {
  const searchParams = new URLSearchParams();

  if (params.page) searchParams.set('page', params.page.toString());
  if (params.search) searchParams.set('search', params.search);
  if (params.accountId) searchParams.set('accountId', params.accountId);
  if (params.filter) searchParams.set('filter', params.filter);

  const queryString = searchParams.toString();
  return queryString ? `/emails?${queryString}` : '/emails';
}