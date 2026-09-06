import { clientApi, clientMasterApi } from '../campOpsApi.js';

/**
 * Search clients that have at least one Client Master program (Camp Form / paste).
 * Uses server-side q/search — no full-directory hydrate.
 */
export async function searchClientsWithMasters(query = '', { limit = 40 } = {}) {
  const q = String(query || '').trim();
  const [clientRes, masterRes] = await Promise.all([
    clientApi.list({ ...(q ? { q } : {}), limit, page: 1 }),
    clientMasterApi.list({ ...(q ? { q, search: q } : {}), limit, page: 1 }),
  ]);
  const allClients = Array.isArray(clientRes.data?.data) ? clientRes.data.data : [];
  const masters = Array.isArray(masterRes.data?.data) ? masterRes.data.data : [];
  const configuredClientIds = new Set(
    masters
      .map((row) => row.client?._id || row.clientId || row.client)
      .filter(Boolean)
      .map(String),
  );
  if (!configuredClientIds.size) return allClients.slice(0, limit);
  return allClients.filter((client) => configuredClientIds.has(String(client._id)));
}
