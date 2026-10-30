import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download } from 'lucide-react';
import FeedbackBanner from '../../../components/ui/FeedbackBanner.jsx';
import { DateRangeFilters } from './DateRangeFilters';
import { CampClientTypeahead } from './CampClientTypeahead.jsx';
import { dashboardApi, campApi, clientMasterApi } from '../campOpsApi.js';
import { CAMP_PATH } from '../../../shared/moduleRoutes.js';
import { ACTION, MODULE } from '../../../shared/labels.js';
import {
  campNamesForDivision,
  parseClientMasterDivisions,
} from '../utils/clientMasterCascade.js';
import {
  operationsBoardExportFilename,
  operationsBoardExportPath,
} from '../utils/campOperationsBoardQuery.js';
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
} = {}) {
  const params = new URLSearchParams();
  if (stageId) params.set('stage', stageId);
  if (statusValue) params.set('status', statusValue);
  if (dateFrom) params.set('dateFrom', dateFrom);
  if (dateTo) params.set('dateTo', dateTo);
  if (client) params.set('client', client);
  if (campaignType) params.set('campaignType', campaignType);
  if (campaign) params.set('campaign', campaign);
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
  const [clientName, setClientName] = useState('');
  const [campaignType, setCampaignType] = useState('');
  const [campaignName, setCampaignName] = useState('');
  const [divisionPrograms, setDivisionPrograms] = useState([]);
  const [divisionOptions, setDivisionOptions] = useState([]);
  const [programsLoading, setProgramsLoading] = useState(false);

  const methodOptions = useMemo(
    () => campNamesForDivision(divisionPrograms, campaignType),
    [divisionPrograms, campaignType],
  );

  const boardQuery = useMemo(() => ({
    dateFrom: appliedRange.dateFrom,
    dateTo: appliedRange.dateTo,
    ...(clientId ? { client: clientId } : {}),
    ...(campaignType ? { campaignType } : {}),
    ...(campaignName ? { campaign: campaignName } : {}),
  }), [appliedRange, clientId, campaignType, campaignName]);

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
    if (!clientId) {
      setDivisionPrograms([]);
      setDivisionOptions([]);
      setProgramsLoading(false);
      return undefined;
    }
    let cancelled = false;
    setProgramsLoading(true);
    clientMasterApi.listDivisionsByClient(
      clientId,
      clientName ? { clientName } : undefined,
    )
      .then(({ data }) => {
        if (cancelled) return;
        const parsed = parseClientMasterDivisions(data);
        setDivisionPrograms(parsed.programs);
        setDivisionOptions(parsed.divisions);
      })
      .catch(() => {
        if (!cancelled) {
          setDivisionPrograms([]);
          setDivisionOptions([]);
        }
      })
      .finally(() => {
        if (!cancelled) setProgramsLoading(false);
      });
    return () => { cancelled = true; };
  }, [clientId, clientName]);

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
    return <div className="empty-state">Loading operations board…</div>;
  }

  const manageQuery = {
    dateFrom: appliedRange.dateFrom,
    dateTo: appliedRange.dateTo,
    client: clientId,
    campaignType,
    campaign: campaignName,
  };

  function onClientChange(id, client) {
    const nextId = String(id || '').trim();
    setClientId(nextId);
    setClientName(String(client?.name || '').trim());
    setCampaignType('');
    setCampaignName('');
  }

  function onDivisionChange(value) {
    setCampaignType(value);
    setCampaignName('');
  }

  return (
    <div className={`camp-ops-root ops-board-host${embedded ? ' ops-board-host--embedded' : ''}`}>
      <div className="ops-board">
        <div className="ops-board__main">
          {error ? <FeedbackBanner variant="error">{error}</FeedbackBanner> : null}
          {exportError ? (
            <p className="ops-board-export-status" role="alert">{exportError}</p>
          ) : null}

          <section className={`ops-board-hero${embedded ? ' ops-board-hero--embedded' : ''}`} aria-label="Total camps">
            <Link
              className="ops-board-hero__total"
              to={buildManagePath(manageQuery)}
              title="Open all camps in Manage"
            >
              <span className="ops-board-hero__label">Total Camps</span>
              <strong className="ops-board-hero__value">{board.total ?? 0}</strong>
            </Link>
            <div className="ops-board-hero__filters">
              <div className="ops-board-hero__filter">
                <span>Client Name</span>
                <CampClientTypeahead
                  value={clientId}
                  selectedLabel={clientName}
                  onChange={onClientChange}
                  hideLabel
                />
              </div>
              <label className="ops-board-hero__filter" htmlFor="ops-board-division">
                <span>{MODULE.DIVISION_THERAPY}</span>
                <select
                  id="ops-board-division"
                  className="tylo-select"
                  aria-label={MODULE.DIVISION_THERAPY}
                  value={campaignType}
                  disabled={!clientId || programsLoading}
                  onChange={(e) => onDivisionChange(e.target.value)}
                >
                  <option value="">
                    {programsLoading ? 'Loading…' : 'All'}
                  </option>
                  {divisionOptions.map((division) => (
                    <option key={division} value={division}>{division}</option>
                  ))}
                </select>
              </label>
              <label className="ops-board-hero__filter" htmlFor="ops-board-method">
                <span>{MODULE.METHOD}</span>
                <select
                  id="ops-board-method"
                  className="tylo-select"
                  aria-label={MODULE.METHOD}
                  value={campaignName}
                  disabled={!campaignType || programsLoading}
                  onChange={(e) => setCampaignName(e.target.value)}
                >
                  <option value="">
                    {programsLoading ? 'Loading…' : 'All'}
                  </option>
                  {methodOptions.map((method) => (
                    <option key={method} value={method}>{method}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="ops-board-hero__meta">
              <p className="meta-text">
                Scoped to your Camp One access
                {board.scope?.designation ? ` · ${board.scope.designation}` : ''}
              </p>
              {!embedded ? (
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
              ) : null}
            </div>
          </section>

          <section className="ops-board-grid" aria-label="Lifecycle stage board">
            {stages.map((stage) => (
              <article key={stage.id} className={`ops-board-card ops-board-card--${stage.id}`}>
                <header className="ops-board-card__header">
                  <Link
                    className="ops-board-card__stage"
                    to={buildManagePath({ stageId: stage.id, ...manageQuery })}
                    title={`Open ${stage.label} camps in Manage`}
                  >
                    <span>{stage.label}</span>
                    <strong>{stage.total}</strong>
                  </Link>
                </header>
                <ul className="ops-board-card__statuses">
                  {(stage.statuses || []).map((row) => {
                    const key = sliceKey({ stageId: stage.id, statusValue: row.value });
                    const slice = {
                      stageId: stage.id,
                      stageLabel: stage.label,
                      statusValue: row.value,
                      statusLabel: row.label,
                      count: row.count,
                    };
                    return (
                      <li key={row.value}>
                        <Link
                          className={[
                            'ops-board-status',
                            `ops-board-status--${row.value}`,
                            row.attention ? 'is-attention' : '',
                          ].filter(Boolean).join(' ')}
                          to={buildManagePath({
                            stageId: stage.id,
                            statusValue: row.value,
                            ...manageQuery,
                          })}
                          title={`Open ${row.label} camps in Manage`}
                        >
                          <span className="ops-board-status__label">{row.label}</span>
                          <span className="ops-board-status__count">{row.count}</span>
                        </Link>
                        <button
                          type="button"
                          className="ops-board-status__download"
                          aria-label={`Download ${row.label} camps`}
                          title={`Download Excel of ${row.label} camps`}
                          disabled={exportBusy || !(row.count > 0)}
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            exportSlice(slice);
                          }}
                        >
                          <Download size={15} strokeWidth={2} aria-hidden="true" />
                          <span className="sr-only">
                            {exportBusy && exportingKey === key ? ACTION.DOWNLOADING : ACTION.DOWNLOAD}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
                <footer className="ops-board-card__footer">
                  <Link
                    className="meta-text"
                    to={buildManagePath({
                      stageId: stage.id,
                      ...manageQuery,
                    })}
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
