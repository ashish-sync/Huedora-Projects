/** Client Master lives under Master One (not Camp One). */

export const CLIENT_MASTER_SCOPE = 'camp';
export const CLIENT_MASTER_ENTITY = 'client-masters';

export function clientMasterListPath({ tab, search } = {}) {
  const params = new URLSearchParams({
    scope: CLIENT_MASTER_SCOPE,
    entity: CLIENT_MASTER_ENTITY,
  });
  if (tab) params.set('tab', tab);
  if (search) params.set('search', search);
  return `/master-one?${params}`;
}

export const CLIENT_MASTER_NEW_PATH = '/master-one/client-masters/new';

export function clientMasterEditPath(id) {
  return `/master-one/client-masters/${id}/edit`;
}
