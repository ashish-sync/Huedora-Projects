import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from './useCampOpsAuth.js';
import { clientMasterApi } from './campOpsApi.js';
import { trimString } from './utils/trimInput';
import { ClientsPanel } from './components/ClientsPanel';
import { ClientMasterProgramsFilters } from './components/ClientMasterProgramsFilters';
import { Pagination } from './components/Pagination';
import { DEFAULT_PAGE_SIZE } from './constants/pagination';
import { EmptyState } from '../../components/ui/PageShell.jsx';
import FeedbackBanner from '../../components/ui/FeedbackBanner.jsx';
import { MESSAGES, formatApiError } from '../../shared/messages.js';
import MasterExcelToolbar from '../../components/masters/MasterExcelToolbar.jsx';
import { masterExcelFor } from '../masters/masterExcelConfig.js';
import {
  clientMasterEditPath,
  clientMasterListPath,
  CLIENT_MASTER_NEW_PATH,
} from './clientMasterPaths.js';
import { formatPoMoney } from './utils/clientMasterPo.js';

function listPoBalanceLabel(record) {
  if (record?.poBalance == null || record.poBalance === '') return '—';
  const amount = Number(record.poBalance);
  if (!Number.isFinite(amount)) return '—';
  return formatPoMoney(amount);
}

function listPoBalanceTitle(record) {
  if (record?.poBalance == null || record.poBalance === '') return undefined;
  const total = Number(record.poTotalValue);
  const billed = Number(record.poBilledAmount);
  const remaining = Number(record.poBalance);
  if (![total, billed, remaining].every(Number.isFinite)) return listPoBalanceLabel(record);
  return `PO ${formatPoMoney(total)} − billed ${formatPoMoney(billed)} = remaining ${formatPoMoney(remaining)}`;
}

export default function ClientMastersPage({ embedded = false } = {}) {
  const { hasPermission, isSuperAdmin } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') === 'clients' ? 'clients' : 'programs';
  const initialClientSearch = searchParams.get('search') || '';
  const [activeTab, setActiveTab] = useState(initialTab);
  const [records, setRecords] = useState([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const excelConfig = masterExcelFor('client-masters');

  async function loadRecords(nextPage = page, nextPageSize = pageSize, searchValue = search) {
    setLoading(true);
    const trimmedSearch = trimString(searchValue);
    setSearch(trimmedSearch);
    try {
      const params = { page: nextPage, limit: nextPageSize };
      if (trimmedSearch) params.search = trimmedSearch;
      const { data } = await clientMasterApi.list(params);
      setRecords(Array.isArray(data?.data) ? data.data : []);
      setPagination(data?.pagination || null);
      setPage(nextPage);
      setPageSize(nextPageSize);
      setError('');
    } catch (err) {
      setError(formatApiError(err, MESSAGES.loadFailed('Client Master records')));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const tab = searchParams.get('tab') === 'clients' ? 'clients' : 'programs';
    setActiveTab(tab);
  }, [searchParams]);

  function switchTab(tab) {
    setActiveTab(tab);
    const params = new URLSearchParams(searchParams);
    if (tab === 'clients') {
      params.set('tab', 'clients');
    } else {
      params.delete('tab');
      params.delete('search');
    }
    setSearchParams(params, { replace: true });
  }

  useEffect(() => {
    if (activeTab === 'programs') {
      loadRecords(1);
    }
  }, [activeTab]);

  async function handleDelete(id) {
    if (!isSuperAdmin()) return;
    if (!window.confirm('Archive this Client Master record?')) return;
    try {
      await clientMasterApi.remove(id);
      await loadRecords(page);
    } catch (err) {
      setError(formatApiError(err, MESSAGES.actionFailed('archive this record')));
    }
  }

  function handleSearch() {
    setPage(1);
    loadRecords(1, pageSize);
  }

  function handlePageChange(nextPage) {
    loadRecords(nextPage, pageSize);
  }

  function handlePageSizeChange(nextPageSize) {
    setPage(1);
    loadRecords(1, nextPageSize);
  }

  function clearProgramFilters() {
    setSearch('');
    setPage(1);
    loadRecords(1, pageSize, '');
  }

  const programFilterChips = search
    ? [{
      key: 'search',
      label: `Search: ${search}`,
      onRemove: () => {
        setSearch('');
        setPage(1);
        loadRecords(1, pageSize, '');
      },
    }]
    : [];

  return (
    <div className="client-masters-page">
      <div className="page-tabs" role="tablist" aria-label="Client Master views">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'programs'}
          className={`page-tab${activeTab === 'programs' ? ' is-active' : ''}`}
          onClick={() => switchTab('programs')}
        >
          Program Configuration
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'clients'}
          className={`page-tab${activeTab === 'clients' ? ' is-active' : ''}`}
          onClick={() => switchTab('clients')}
        >
          Clients
        </button>
      </div>

      {activeTab === 'clients' ? (
        <ClientsPanel
          initialSearch={initialClientSearch}
          canCreate={hasPermission('clients:create')}
          canUpdate={hasPermission('clients:update')}
          canDelete={isSuperAdmin()}
        />
      ) : (
        <>
          <ClientMasterProgramsFilters
            search={search}
            onSearchChange={setSearch}
            onSearchSubmit={handleSearch}
            showCreateLink={hasPermission('client-masters:create')}
            activeChips={programFilterChips}
            onClearAll={clearProgramFilters}
          />

          {excelConfig ? (
            <div style={{ marginBottom: 12 }}>
              <MasterExcelToolbar
                {...excelConfig}
                canImport={hasPermission('client-masters:create')}
                onImportComplete={() => loadRecords(page)}
                onError={(message) => setError(message)}
              />
            </div>
          ) : null}

          {error && (
            <div className="page-alerts">
          {error && <FeedbackBanner variant="error">{error}</FeedbackBanner>}
            </div>
          )}

          <div className="card card--flush table-wrap">
            {loading ? (
              <EmptyState title="Loading…" description="Fetching Client Master records." />
            ) : records.length === 0 ? (
              <EmptyState
                title="No Client Master records"
                description="Create a program configuration to get started."
                action={
                  hasPermission('client-masters:create') ? (
                    <Link to={CLIENT_MASTER_NEW_PATH} className="btn">
                      New Program Config
                    </Link>
                  ) : null
                }
              />
            ) : (
              <div className="table-scroll">
                <table className="client-masters-table">
                  <thead>
                    <tr>
                      <th>Client</th>
                      <th>Division / Therapy</th>
                      <th>Method</th>
                      <th>SPOC</th>
                      <th>SPOC Number</th>
                      <th>PO Balance</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((record) => (
                      <tr key={record._id}>
                        <td title={record.clientName || undefined}>{record.clientName}</td>
                        <td title={record.programName || undefined}>{record.programName || '—'}</td>
                        <td title={record.campName || undefined}>{record.campName || '—'}</td>
                        <td title={record.spocName || undefined}>{record.spocName || '—'}</td>
                        <td title={record.spocNumber || undefined}>{record.spocNumber || '—'}</td>
                        <td title={listPoBalanceTitle(record)}>{listPoBalanceLabel(record)}</td>
                        <td>{record.isActive ? 'Active' : 'Inactive'}</td>
                        <td>
                          <div className="actions">
                            {hasPermission('client-masters:update') && (
                              <Link to={clientMasterEditPath(record._id)} className="btn secondary btn-compact">Edit</Link>
                            )}
                            {isSuperAdmin() && (
                              <button type="button" className="btn danger btn-compact" onClick={() => handleDelete(record._id)}>
                                Archive
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <Pagination
            pagination={pagination}
            pageSize={pageSize}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
            itemLabel="records"
          />
        </>
      )}
    </div>
  );
}
