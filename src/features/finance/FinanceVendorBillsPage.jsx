import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AdaptiveSelect from '../../components/ui/AdaptiveSelect.jsx';
import FeedbackBanner from '../../components/ui/FeedbackBanner.jsx';
import PaginationBar from '../../components/ui/PaginationBar.jsx';
import MasterFilterShell from '../../components/masters/MasterFilterShell.jsx';
import MasterSearchField from '../../components/masters/MasterSearchField.jsx';
import { api, downloadExcel } from '../../shared/api.js';
import { formatDate } from '../../shared/dateFormat.js';
import { useAuth } from '../../shared/auth.jsx';
import { ACTION, NAV } from '../../shared/labels.js';
import {
  VENDOR_BILL_STATUSES,
  formatVendorBillMoney,
  vendorBillStatusLabel,
} from './vendorBillConstants.js';
import './finance-commercial.css';

export default function FinanceVendorBillsPage() {
  const { can } = useAuth();
  const canWrite = can('finance:write') || can('*');
  const navigate = useNavigate();

  const [rows, setRows] = useState([]);
  const [listMeta, setListMeta] = useState({ page: 1, limit: 25, total: 0, pages: 0 });
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [view, setView] = useState('active');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (q.trim()) params.set('q', q.trim());
      if (status) {
        params.set('status', status);
      } else if (view === 'archive') {
        params.set('archive', '1');
      } else if (view === 'payable') {
        params.set('payable', '1');
      } else if (view === 'active') {
        params.set('active', '1');
      }
      const res = await api(`/finance/vendor-bills?${params}`);
      setRows(res.data || []);
      setListMeta(res.meta || { page, limit, total: 0, pages: 0 });
    } catch (err) {
      setError(err.message || 'Could not load vendor bills');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [page, limit, q, status, view]);

  useEffect(() => {
    load();
  }, [load]);

  async function exportRows() {
    setExportBusy(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set('q', q.trim());
      if (status) params.set('status', status);
      else if (view === 'archive') params.set('archive', '1');
      else if (view === 'payable') params.set('payable', '1');
      else if (view === 'active') params.set('active', '1');
      const qs = params.toString();
      await downloadExcel(
        qs ? `/finance-one/vendor-bills/export?${qs}` : '/finance-one/vendor-bills/export',
        'Vendor_Bills.xlsx',
      );
    } catch (err) {
      setError(err.message || 'Export failed');
    } finally {
      setExportBusy(false);
    }
  }

  return (
    <div className="finance-hub">
      <section className="finance-hub-panel card finance-vendor-bills">
        <div className="finance-vendor-bills-toolbar">
          <div className="finance-docs-head finance-docs-head--embedded">
            <div>
              <h3 className="finance-docs-title">{NAV.VENDOR_BILLS}</h3>
            </div>
          </div>

          {error ? <FeedbackBanner variant="error">{error}</FeedbackBanner> : null}

          <MasterFilterShell
            className="finance-vendor-bills-filters"
            actions={
              <div className="finance-docs-actions">
                <button type="button" className="btn secondary btn-compact" disabled={exportBusy} onClick={exportRows}>
                  {exportBusy ? ACTION.EXPORTING : ACTION.DOWNLOAD_EXCEL}
                </button>
                {canWrite ? (
                  <button
                    type="button"
                    className="btn primary btn-compact"
                    onClick={() => navigate('/finance-one/vendor-bills/new')}
                  >
                    New vendor bill
                  </button>
                ) : null}
              </div>
            }
          >
            <MasterSearchField
              value={q}
              onChange={(e) => {
                setPage(1);
                setQ(e.target.value);
              }}
              placeholder="Search bill #, vendor, category…"
            />
            <AdaptiveSelect
              value={view}
              onChange={(e) => {
                setPage(1);
                setStatus('');
                setView(e.target.value);
              }}
              aria-label="Bill view"
            >
              <option value="active">Active</option>
              <option value="payable">Ready to pay</option>
              <option value="archive">Paid / Archived</option>
              <option value="all">All</option>
            </AdaptiveSelect>
            <AdaptiveSelect
              value={status}
              onChange={(e) => {
                setPage(1);
                setStatus(e.target.value);
              }}
              aria-label="Status filter"
            >
              <option value="">All statuses</option>
              {VENDOR_BILL_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {vendorBillStatusLabel(value)}
                </option>
              ))}
            </AdaptiveSelect>
          </MasterFilterShell>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Bill ID</th>
                <th>Bill #</th>
                <th>Vendor</th>
                <th>Bill date</th>
                <th>Due</th>
                <th>Category</th>
                <th>Total</th>
                <th>Balance</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {loading && !rows.length ? (
                <tr>
                  <td colSpan={9} className="muted">
                    Loading…
                  </td>
                </tr>
              ) : null}
              {!loading && !rows.length ? (
                <tr>
                  <td colSpan={9} className="muted">
                    No vendor bills found.
                  </td>
                </tr>
              ) : null}
              {rows.map((row) => (
                <tr key={row._id}>
                  <td>
                    <Link to={`/finance-one/vendor-bills/${row._id}`}>{row.invoiceKey || '—'}</Link>
                  </td>
                  <td>{row.billNumber || row.invoiceNumber || '—'}</td>
                  <td>{row.vendorName || '—'}</td>
                  <td>{formatDate(row.billDate || row.invoiceDate) || '—'}</td>
                  <td>{formatDate(row.dueDate) || '—'}</td>
                  <td>
                    {[row.expenseCategory, row.expenseSubCategory].filter(Boolean).join(' · ') || '—'}
                  </td>
                  <td>{formatVendorBillMoney(row.totalAmount)}</td>
                  <td>{formatVendorBillMoney(row.balance)}</td>
                  <td>{row.statusLabel || vendorBillStatusLabel(row.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <PaginationBar
          page={listMeta.page || page}
          pages={listMeta.pages || 1}
          limit={listMeta.limit || limit}
          total={listMeta.total || 0}
          onPageChange={setPage}
          onLimitChange={(next) => {
            setPage(1);
            setLimit(next);
          }}
        />
      </section>
    </div>
  );
}
