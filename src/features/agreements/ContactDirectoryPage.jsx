import { useEffect, useMemo, useState, useCallback } from 'react';
import FeedbackBanner from '../../components/ui/FeedbackBanner.jsx';
import { Link } from 'react-router-dom';
import { api } from '../../shared/api.js';
import { invalidateContactsCaches } from '../../shared/contactsApi.js';
import { useDebouncedValue } from '../../shared/useDebouncedValue.js';
import { MODULE } from '../../shared/labels.js';
import { useAuth } from '../../shared/auth.jsx';
import MasterExcelToolbar from '../../components/masters/MasterExcelToolbar.jsx';
import MasterFilterShell from '../../components/masters/MasterFilterShell.jsx';
import MasterSearchField from '../../components/masters/MasterSearchField.jsx';
import MasterListHeader from '../../components/masters/MasterListHeader.jsx';
import ConfirmDialog from '../../components/ui/ConfirmDialog.jsx';
import { masterExcelFor } from '../masters/masterExcelConfig.js';
import PageShell from '../../components/ui/PageShell.jsx';
import PaginationBar from '../../components/ui/PaginationBar.jsx';
import QieIndicator from './QieIndicator.jsx';
import QieReportDialog from './QieReportDialog.jsx';
import { isServiceProviderContact } from './contactPicklists.js';
import ContactDirectoryDrawer from './ContactDirectoryDrawer.jsx';

const CATEGORY_TABS = [
  { id: '', label: 'All Contacts' },
  { id: 'Healthcare Worker', label: 'Healthcare Workers', tone: 'tone-ok' },
  { id: 'Resource', label: 'Resources', tone: 'tone-info' },
  { id: 'Client', label: 'Clients', tone: 'tone-medical' },
];

export default function ContactDirectoryPage({ embedded = false } = {}) {
  const { can, canDelete } = useAuth();
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState('');
  const debouncedQ = useDebouncedValue(q, 300);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [error, setError] = useState('');
  const [importMsg, setImportMsg] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerContact, setDrawerContact] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const excelConfig = masterExcelFor('contacts');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [listMeta, setListMeta] = useState({ page: 1, limit: 25, total: 0, pages: 0 });
  const [listLoading, setListLoading] = useState(false);
  const [qieReportId, setQieReportId] = useState('');

  const staffCountByProvider = useMemo(() => {
    const counts = {};
    for (const row of rows) {
      if (row.serviceProviderContactId) {
        const id = String(row.serviceProviderContactId);
        counts[id] = (counts[id] || 0) + 1;
      }
    }
    return counts;
  }, [rows]);

  const load = useCallback(() => {
    setListLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (debouncedQ.trim()) params.set('q', debouncedQ.trim());
    if (categoryFilter) params.set('contactCategory', categoryFilter);
    return api(`/contacts?${params}`)
      .then((r) => {
        setRows(r.data || []);
        setListMeta(r.meta || { page, limit, total: 0, pages: 0 });
      })
      .catch((e) => setError(e.message))
      .finally(() => setListLoading(false));
  }, [page, limit, debouncedQ, categoryFilter]);

  const canWriteContacts = can('agreements:write');
  const canDeleteContacts = canDelete();

  const requestDeleteContact = (contact) => {
    if (!canDeleteContacts || !contact?._id) return;
    setDeleteTarget(contact);
  };

  const handleConfirmDeleteContact = async () => {
    if (!deleteTarget?._id || !canDeleteContacts) return;
    setDeleteBusy(true);
    setError('');
    try {
      await api(`/contacts/${deleteTarget._id}/delete`, { method: 'POST', body: {} });
      invalidateContactsCaches();
      setDeleteTarget(null);
      if (
        drawerOpen
        && drawerContact?._id
        && String(drawerContact._id) === String(deleteTarget._id)
      ) {
        setDrawerOpen(false);
        setDrawerContact(null);
      }
      await load();
    } catch (e) {
      setError(e.message || 'Could not delete contact');
    } finally {
      setDeleteBusy(false);
    }
  };

  useEffect(() => {
    setPage(1);
  }, [debouncedQ, categoryFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const startCreate = () => {
    setDrawerContact(null);
    setDrawerOpen(true);
  };

  const startEdit = (c) => {
    setDrawerContact(c);
    setDrawerOpen(true);
  };

  const closeContactDrawer = () => {
    setDrawerOpen(false);
    setDrawerContact(null);
  };

  const editingId = drawerOpen && drawerContact?._id ? drawerContact._id : null;

  const getCategoryBadgeTone = (cat) => {
    if (cat === 'Healthcare Worker') return 'tone-ok';
    if (cat === 'Resource') return 'tone-info';
    if (cat === 'Client') return 'tone-medical';
    if (cat === 'Vendor') return 'tone-warn';
    return 'tone-neutral';
  };

  return (
    <PageShell
      hideChrome={embedded}
      breadcrumbs={
        embedded
          ? []
          : [
              { to: '/', label: MODULE.HOME },
              { to: '/master-one', label: MODULE.MASTER_DATA },
              { label: MODULE.CONTACT_DIRECTORY },
            ]
      }
      title={embedded ? undefined : MODULE.CONTACT_DIRECTORY}
      description={undefined}
      actions={
        embedded || !can('agreements:write') ? null : (
          <Link className="btn" to="/document-one/new">
            + New document
          </Link>
        )
      }
      kpis={embedded ? [] : [{ label: 'Total Contacts', value: listMeta.total || rows.length }]}
    >
      {embedded && <MasterListHeader title="Contact Directory" />}
      {error && (
        <FeedbackBanner variant="error">{error}</FeedbackBanner>
      )}
      {importMsg && (
        <FeedbackBanner variant="info">{importMsg}</FeedbackBanner>
      )}
      <div className="cd-workspace">
        {/* Top Filter Shell & Actions */}
        <MasterFilterShell
          actions={
            <div className="cd-top-actions">
              {excelConfig ? (
                <MasterExcelToolbar
                  {...excelConfig}
                  canImport={canWriteContacts}
                  onImportComplete={(data) => {
                    setImportMsg(
                      `Imported: ${data.created} created · ${data.updated} updated · ${data.errorRows} errors`
                    );
                    invalidateContactsCaches();
                    load();
                  }}
                  onError={(message) => setError(message)}
                  compact
                />
              ) : null}
              <button
                className="btn secondary btn-compact"
                type="button"
                onClick={() => {
                  setPage(1);
                  load();
                }}
                title="Refresh contacts"
              >
                Refresh
              </button>
              {canWriteContacts && (
                <button
                  type="button"
                  className="btn btn-compact cd-add-btn"
                  onClick={startCreate}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  <span>Add contact</span>
                </button>
              )}
            </div>
          }
        >
          <div className="cd-filter-row">
            <MasterSearchField
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setPage(1);
                  load();
                }
              }}
              placeholder="Search by name, number, email, or provider employees…"
              aria-label="Search contacts by name, number, or email"
            />
            <div className="cd-category-tabs" role="tablist" aria-label="Filter contacts by category">
              {CATEGORY_TABS.map((tab) => {
                const isActive = categoryFilter === tab.id;
                return (
                  <button
                    key={tab.id || 'all'}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    className={`cd-cat-tab${isActive ? ' is-active' : ''}`}
                    onClick={() => {
                      setCategoryFilter(tab.id);
                      setPage(1);
                    }}
                  >
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </MasterFilterShell>

        {/* Full-Width Master Data Table */}
        <div className={`cd-table-card card card--flush${listLoading && rows.length ? ' is-loading' : ''}`}>
          <div className="table-wrap cd-table-wrap">
            <table className="inv-table cd-table">
              <thead>
                <tr>
                  <th style={{ minWidth: 200 }}>Contact Name</th>
                  <th>Category</th>
                  <th>Resource Type</th>
                  <th>Service Provider</th>
                  <th>Organization</th>
                  <th>Contact Details</th>
                  <th>Location</th>
                  <th className="cd-th-qual">Qualification</th>
                  <th className="inv-col-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => {
                  const resolvedCategory = c.contactCategory || (
                    ['Vendor', 'Supplier'].includes(c.resourceType)
                      ? 'Vendor'
                      : c.resourceType === 'Client'
                        ? 'Client'
                        : c.resourceType
                          ? 'Resource'
                          : '-'
                  );
                  const isProvider = isServiceProviderContact(c);
                  const staffCount = (c.providerEmployees || []).length + (staffCountByProvider[String(c._id)] || 0);

                  return (
                    <tr key={c._id} className={editingId === c._id ? 'is-selected' : undefined}>
                      <td className="cd-col-name">
                        <div className="cd-name-row">
                          <strong className="cd-name">{c.name}</strong>
                          <QieIndicator
                            url={c.educationalQualificationUrl}
                            summary={c.educationalQie}
                            onOpen={setQieReportId}
                          />
                        </div>
                        {c.profession ? (
                          <span className="cd-name-meta">{c.profession}</span>
                        ) : null}
                      </td>
                      <td className="cd-col-category">
                        <span className={`badge ${getCategoryBadgeTone(resolvedCategory)}`}>
                          {resolvedCategory}
                        </span>
                      </td>
                      <td className="cd-col-type">
                        {c.contactCategory === 'Resource' ||
                        c.contactCategory === 'Healthcare Worker' ||
                        (!c.contactCategory &&
                          c.resourceType &&
                          !['Vendor', 'Supplier', 'Client'].includes(c.resourceType))
                          ? c.resourceType || '-'
                          : '-'}
                      </td>
                      <td className="cd-col-provider">
                        {c.serviceProviderName ? (
                          <span className="cd-provider-link" title={`Agency: ${c.serviceProviderName}`}>
                            {c.serviceProviderName}
                          </span>
                        ) : isProvider ? (
                          <span className="badge tone-ok cd-staff-badge" title="Service Provider agency">
                            {staffCount} staff
                          </span>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="cd-col-org">{c.organization || '-'}</td>
                      <td className="cd-col-contact">
                        {c.contact || c.mobile ? (
                          <span className="cd-phone">{c.contact || c.mobile}</span>
                        ) : null}
                        {c.email ? (
                          <span className="cd-email" title={c.email}>
                            {c.email}
                          </span>
                        ) : null}
                        {!c.contact && !c.mobile && !c.email ? '-' : null}
                      </td>
                      <td className="cd-col-location">
                        {[c.city || c.district, c.state].filter(Boolean).join(', ') || '-'}
                      </td>
                      <td className="cd-col-qual">
                        <QieIndicator
                          url={c.educationalQualificationUrl}
                          summary={c.educationalQie}
                          onOpen={setQieReportId}
                        />
                      </td>
                      <td className="inv-col-actions">
                        <div className="cd-row-actions">
                          {canWriteContacts && (
                            <button
                              className="btn secondary btn-compact"
                              type="button"
                              onClick={() => startEdit(c)}
                              title={`Edit ${c.name}`}
                            >
                              Edit
                            </button>
                          )}
                          {canDeleteContacts && (
                            <button
                              className="btn danger btn-compact"
                              type="button"
                              onClick={() => requestDeleteContact(c)}
                              title={`Delete ${c.name}`}
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {listLoading && !rows.length && (
                  <tr>
                    <td colSpan={9}>
                      <div className="cd-loading-state">
                        <span className="spinner" aria-hidden="true" />
                        <span className="muted">Loading contacts…</span>
                      </div>
                    </td>
                  </tr>
                )}
                {!rows.length && !listLoading && (
                  <tr>
                    <td colSpan={9}>
                      <div className="cd-empty-state">
                        <div className="cd-empty-icon" aria-hidden="true">
                          <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" strokeWidth="1.75">
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                            <circle cx="9" cy="7" r="4" />
                            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                          </svg>
                        </div>
                        <p className="cd-empty-title">
                          {q || categoryFilter ? 'No matching contacts found' : 'No contacts in directory'}
                        </p>
                        <p className="cd-empty-sub muted">
                          {q || categoryFilter
                            ? 'Try adjusting your search query or switching category tabs.'
                            : 'Get started by adding a new contact or importing records via Excel.'}
                        </p>
                        {canWriteContacts && (
                          <div className="cd-empty-actions">
                            {q || categoryFilter ? (
                              <button
                                type="button"
                                className="btn secondary btn-compact"
                                onClick={() => {
                                  setQ('');
                                  setCategoryFilter('');
                                  setPage(1);
                                }}
                              >
                                Clear filters
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="btn btn-compact"
                                onClick={startCreate}
                              >
                                + Add contact
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <PaginationBar
            page={listMeta.page || page}
            limit={limit}
            total={listMeta.total || 0}
            pages={listMeta.pages || 0}
            loading={listLoading}
            onPageChange={setPage}
            onLimitChange={(n) => {
              setLimit(n);
              setPage(1);
            }}
          />
        </div>

        <ContactDirectoryDrawer
          open={drawerOpen}
          onClose={closeContactDrawer}
          contact={drawerContact}
          defaultCategory={categoryFilter}
          canWrite={canWriteContacts}
          onReload={load}
        />
      </div>
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete contact?"
        message={
          deleteTarget
            ? `Remove “${deleteTarget.name || 'this contact'}” from the Contact Directory? This cannot be undone from the list.`
            : ''
        }
        confirmLabel="Delete contact"
        confirmVariant="danger"
        loading={deleteBusy}
        onConfirm={handleConfirmDeleteContact}
        onCancel={() => {
          if (!deleteBusy) setDeleteTarget(null);
        }}
      />
      <QieReportDialog
        open={Boolean(qieReportId)}
        verificationId={qieReportId}
        canReview={canWriteContacts}
        onClose={() => setQieReportId('')}
        onUpdated={() => {
          load();
        }}
      />
    </PageShell>
  );
}
