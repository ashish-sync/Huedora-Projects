import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download } from 'lucide-react';
import FeedbackBanner from '../../../components/ui/FeedbackBanner.jsx';
import { DateRangeFilters } from './DateRangeFilters';
import { dashboardApi, campApi, clientMasterApi } from '../campOpsApi.js';
import { CAMP_PATH } from '../../../shared/moduleRoutes.js';
import { ACTION, MODULE } from '../../../shared/labels.js';
import {
  clientsForOpsBoardScope,
  divisionsForOpsBoardMethod,
  parseOpsBoardFilterCatalog,
} from '../utils/clientMasterCascade.js';
import {
  operationsBoardExportFilename,
  operationsBoardExportPath,
} from '../utils/campOperationsBoardQuery.js';
import { OpsReviewSlot, useOpsReviewSlotState } from '../../dashboards/OpsReviewHeader.jsx';
import '../campOps.css';
import '../campOps.theme.css';

const EMPTY_RANGE = { dateFrom: '', dateTo: '' };

function buildManagePath({
  stageId,
  statusValue = '',
  dateFrom = '',
  dateTo = '',
  client = '',
  campaignType = '',
  campaign = '',
  assignedUser = '',
} = {}) {
  const params = new URLSearchParams();
  if (stageId) params.set('stage', stageId);
  if (statusValue) params.set('status', statusValue);
  if (dateFrom) params.set('dateFrom', dateFrom);
  if (dateTo) params.set('dateTo', dateTo);
  if (client) params.set('client', client);
  if (campaignType) params.set('campaignType', campaignType);
  if (campaign) params.set('campaign', campaign);
  if (assignedUser) params.set('assignedUser', assignedUser);
  const query = params.toString();
  return `${CAMP_PATH.MANAGE}${query ? `?${query}` : ''}`;
}

async function downloadOperationsSlice(slice, extra = {}) {
  const path = operationsBoardExportPath({ ...slice, ...extra });
  const filename = operationsBoardExportFilename(slice);
  await campApi.downloadListExport(path, filename);
}

/** Camp One lifecycle operations board (Module Review → Camp One). */
export default function CampOperationsBoard({
  embedded = false,
  initialFrom = '',
  initialTo = '',
} = {}) {
  const [board, setBoard] = useState(null);
  const [error, setError] = useState('');
  const [dateFrom, setDateFrom] = useState(initialFrom || '');
  const [dateTo, setDateTo] = useState(initialTo || '');
  const [appliedRange, setAppliedRange] = useState({
    dateFrom: initialFrom || '',
    dateTo: initialTo || '',
  });
  const [exportBusy, setExportBusy] = useState(false);
  const [exportError, setExportError] = useState('');
  const [exportingKey, setExportingKey] = useState('');
  const [clientId, setClientId] = useState('');
  const [campaignType, setCampaignType] = useState('');
  const [campaignName, setCampaignName] = useState('');
  const [assignedUserEmail, setAssignedUserEmail] = useState('');
  const [filterCatalog, setFilterCatalog] = useState(() => parseOpsBoardFilterCatalog());
  const [catalogLoading, setCatalogLoading] = useState(true);
  const reviewSlot = useOpsReviewSlotState();
  const useSharedHeader = Boolean(embedded && reviewSlot);

  const methodOptions = filterCatalog.methods;
  const divisionOptions = useMemo(
    () => divisionsForOpsBoardMethod(filterCatalog, campaignName),
    [filterCatalog, campaignName],
  );
  const clientOptions = useMemo(
    () => clientsForOpsBoardScope(filterCatalog, {
      campaign: campaignName,
      campaignType,
    }),
    [filterCatalog, campaignName, campaignType],
  );
  const assignedUserOptions = useMemo(
    () => (filterCatalog.assignedUsers || []).map((user) => ({
      email: user.email,
      label: user.name ? `${user.name} · ${user.email}` : user.email,
    })),
    [filterCatalog],
  );

  const boardQuery = useMemo(() => ({
    dateFrom: appliedRange.dateFrom,
    dateTo: appliedRange.dateTo,
    ...(clientId ? { client: clientId } : {}),
    ...(campaignType ? { campaignType } : {}),
    ...(campaignName ? { campaign: campaignName } : {}),
    ...(assignedUserEmail ? { assignedUser: assignedUserEmail } : {}),
  }), [appliedRange, clientId, campaignType, campaignName, assignedUserEmail]);

  const loadBoard = useCallback(async (params = boardQuery) => {
    try {
      const { data } = await dashboardApi.operations(params);
      setBoard(data);
      setError('');
    } catch (err) {
      setError(err?.message || 'Failed to load operations board');
    }
  }, [boardQuery]);

  useEffect(() => {
    loadBoard();
  }, [loadBoard]);

  useEffect(() => {
    const next = { dateFrom: initialFrom || '', dateTo: initialTo || '' };
    setDateFrom(next.dateFrom);
    setDateTo(next.dateTo);
    setAppliedRange(next);
  }, [initialFrom, initialTo]);

  useEffect(() => {
    let cancelled = false;
    setCatalogLoading(true);
    clientMasterApi.listOpsBoardFilters()
      .then(({ data }) => {
        if (cancelled) return;
        setFilterCatalog(parseOpsBoardFilterCatalog(data));
      })
      .catch(() => {
        if (!cancelled) setFilterCatalog(parseOpsBoardFilterCatalog());
      })
      .finally(() => {
        if (!cancelled) setCatalogLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  function applyRange(range) {
    setDateFrom(range.dateFrom);
    setDateTo(range.dateTo);
    setAppliedRange(range);
  }

  const stages = useMemo(() => board?.stages || [], [board]);

  function sliceKey({ stageId, statusValue = '' } = {}) {
    return `${stageId || ''}:${statusValue || ''}`;
  }

  async function exportSlice(slice) {
    if (!slice?.stageId || exportBusy) return;
    setExportBusy(true);
    setExportingKey(sliceKey(slice));
    setExportError('');
    try {
      await downloadOperationsSlice(slice, boardQuery);
    } catch (err) {
      setExportError(err?.message || 'Download failed');
    } finally {
      setExportBusy(false);
      setExportingKey('');
    }
  }

  if (error && !board) {
    return <FeedbackBanner variant="error">{error}</FeedbackBanner>;
  }

  if (!board) {
    return (
      <>
        {useSharedHeader ? <OpsReviewSlot totalLabel="Total Camps" totalValue={0} /> : null}
        <div className="empty-state">Loading operations board…</div>
      </>
    );
  }

  const manageQuery = {
    dateFrom: appliedRange.dateFrom,
    dateTo: appliedRange.dateTo,
    client: clientId,
    campaignType,
    campaign: campaignName,
    assignedUser: assignedUserEmail,
  };

  function onMethodChange(value) {
    setCampaignName(value);
    setCampaignType('');
    setClientId('');
  }

  function onDivisionChange(value) {
    setCampaignType(value);
    setClientId('');
  }

  function onClientChange(id) {
    setClientId(String(id || '').trim());
  }

  const filterFields = (
    <>
      <label className="ops-board-hero__filter" htmlFor="ops-board-method">
        <span>{MODULE.METHOD}</span>
        <select
          id="ops-board-method"
          className="tylo-select"
          aria-label={MODULE.METHOD}
          value={campaignName}
          disabled={catalogLoading}
          onChange={(e) => onMethodChange(e.target.value)}
        >
          <option value="">
            {catalogLoading ? 'Loading…' : 'All'}
          </option>
          {methodOptions.map((method) => (
            <option key={method} value={method}>{method}</option>
          ))}
        </select>
      </label>
      <label className="ops-board-hero__filter" htmlFor="ops-board-division">
        <span>{MODULE.DIVISION_THERAPY}</span>
        <select
          id="ops-board-division"
          className="tylo-select"
          aria-label={MODULE.DIVISION_THERAPY}
          value={campaignType}
          disabled={!campaignName || catalogLoading}
          onChange={(e) => onDivisionChange(e.target.value)}
        >
          <option value="">
            {catalogLoading ? 'Loading…' : 'All'}
          </option>
          {divisionOptions.map((division) => (
            <option key={division} value={division}>{division}</option>
          ))}
        </select>
      </label>
      <label className="ops-board-hero__filter" htmlFor="ops-board-client">
        <span>Client Name</span>
        <select
          id="ops-board-client"
          className="tylo-select"
          aria-label="Client Name"
          value={clientId}
          disabled={!campaignName || catalogLoading}
          onChange={(e) => onClientChange(e.target.value)}
        >
          <option value="">
            {catalogLoading ? 'Loading…' : 'All'}
          </option>
          {clientOptions.map((client) => (
            <option key={client._id} value={client._id}>{client.name}</option>
          ))}
        </select>
      </label>
      <label className="ops-board-hero__filter" htmlFor="ops-board-assigned-user">
        <span>{MODULE.ASSIGNED_USERS}</span>
        <select
          id="ops-board-assigned-user"
          className="tylo-select"
          aria-label={MODULE.ASSIGNED_USERS}
          value={assignedUserEmail}
          disabled={catalogLoading}
          onChange={(e) => setAssignedUserEmail(e.target.value)}
        >
          <option value="">
            {catalogLoading ? 'Loading…' : 'All'}
          </option>
          {assignedUserOptions.map((user) => (
            <option key={user.email} value={user.email}>{user.label}</option>
          ))}
        </select>
      </label>
    </>
  );

  return (
    <div className={`camp-ops-root ops-board-host${embedded ? ' ops-board-host--embedded' : ''}`}>
      <div className="ops-board">
        <div className="ops-board__main">
          {error ? <FeedbackBanner variant="error">{error}</FeedbackBanner> : null}
          {exportError ? (
            <p className="ops-board-export-status" role="alert">{exportError}</p>
          ) : null}

          {useSharedHeader ? (
            <OpsReviewSlot
              totalLabel="Total Camps"
              totalValue={board.total ?? 0}
              totalHref={buildManagePath(manageQuery)}
            >
              {filterFields}
            </OpsReviewSlot>
          ) : (
          <section className="ops-board-hero" aria-label="Total camps">
            <Link
              className="ops-board-hero__total"
              to={buildManagePath(manageQuery)}
              title="Open all camps in Manage"
            >
              <span className="ops-board-hero__label">Total Camps</span>
              <strong className="ops-board-hero__value">{board.total ?? 0}</strong>
            </Link>
            <div className="ops-board-hero__filters">
              {filterFields}
            </div>
            <div className="ops-board-hero__meta">
                <DateRangeFilters
                  idPrefix="ops-board-date"
                  dateFrom={dateFrom}
                  dateTo={dateTo}
                  appliedFrom={appliedRange.dateFrom}
                  appliedTo={appliedRange.dateTo}
                  onDateFromChange={setDateFrom}
                  onDateToChange={setDateTo}
                  onApply={() => applyRange({ dateFrom, dateTo })}
                  onQuickSelect={(range) => applyRange(range)}
                  onClear={() => applyRange(EMPTY_RANGE)}
                  showClear={Boolean(appliedRange.dateFrom || appliedRange.dateTo)}
                />
            </div>
          </section>
          )}
                  >
                    Open in Manage →
                  </Link>
                </footer>
              </article>
            ))}
          </section>
        </div>
      </div>
    </div>
  );
}
