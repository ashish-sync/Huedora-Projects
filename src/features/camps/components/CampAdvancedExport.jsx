import { useEffect, useMemo, useState } from 'react';
import { exportApi } from '../campOpsApi.js';
import { trimString } from '../utils/trimInput';
import {
  ASSIGNMENT_STAGE_FILTER_OPTIONS,
  EXECUTION_STAGE_FILTER_OPTIONS,
  FINANCIAL_STAGE_FILTER_OPTIONS,
} from '../constants/campStageFilters.js';
import { ACTION } from '../../../shared/labels.js';
import { CAMP_LIFECYCLE_STAGES } from '../constants/campLifecycle.js';
import {
  EXPORT_PRESET_TEMPLATES,
  columnKeysForPreset,
  columnKeysForSections,
} from '../constants/campExportPresets.js';

const LIFECYCLE_FILTER_OPTIONS = [
  { value: '', label: 'All stages' },
  ...CAMP_LIFECYCLE_STAGES.map((stage) => ({ value: stage.id, label: stage.short || stage.label })),
];

const STATUS_FILTER_OPTIONS = [
  { value: '', label: 'Any status' },
  { value: 'pending_review', label: 'Pending review' },
  { value: 'approved', label: 'Approved' },
  { value: 'executed', label: 'Executed' },
  { value: 'rejected', label: 'Refused' },
  { value: 'cancelled', label: 'Cancelled' },
];

const EMPTY_FILTERS = {
  lifecycleStage: '',
  stageFilter: '',
  status: '',
  client: '',
  campaignType: '',
  search: '',
  overdue: false,
};

function stageFilterOptions(lifecycleStage) {
  if (lifecycleStage === 'request') return REQUEST_REVIEW_FILTER_OPTIONS;
  if (lifecycleStage === 'assignment') return ASSIGNMENT_STAGE_FILTER_OPTIONS;
  if (lifecycleStage === 'execution') return EXECUTION_STAGE_FILTER_OPTIONS;
  if (lifecycleStage === 'financial') return FINANCIAL_STAGE_FILTER_OPTIONS;
  return [];
}

function buildExportFilters(filters = {}) {
  const payload = {};
  const search = trimString(filters.search);
  const client = trimString(filters.client);
  const campaignType = trimString(filters.campaignType);
  const status = trimString(filters.status);
  const lifecycleStage = trimString(filters.lifecycleStage);
  const stageFilter = trimString(filters.stageFilter);

  if (search) payload.search = search;
  if (client) payload.client = client;
  if (campaignType) payload.campaignType = campaignType;
  if (status) payload.status = status;
  if (filters.overdue) payload.overdue = '1';
  if (lifecycleStage) payload.lifecycleStage = lifecycleStage;

  if (lifecycleStage === 'request' && stageFilter) payload.requestReviewStatus = stageFilter;
  if (lifecycleStage === 'assignment' && stageFilter) payload.assignmentFilter = stageFilter;
  if (lifecycleStage === 'execution' && stageFilter) payload.executionFilter = stageFilter;
  if (lifecycleStage === 'financial' && stageFilter) payload.financialFilter = stageFilter;

  return payload;
}

function allColumnKeys(sections = []) {
  return columnKeysForSections(sections, null);
}

function orderSelectedKeys(allKeys, selected) {
  const selectedSet = new Set(selected);
  return allKeys.filter((key) => selectedSet.has(key));
}

export function CampAdvancedExport({ dateFrom, dateTo, format }) {
  const [sections, setSections] = useState([]);
  const [loadingSchema, setLoadingSchema] = useState(true);
  const [exportBusy, setExportBusy] = useState(false);
  const [templateBusy, setTemplateBusy] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [activePresetId, setActivePresetId] = useState('operations');
  const [activeModuleId, setActiveModuleId] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [headerSearch, setHeaderSearch] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedColumns, setSelectedColumns] = useState([]);
  const [filters, setFilters] = useState(EMPTY_FILTERS);

  const columnKeys = useMemo(() => allColumnKeys(sections), [sections]);
  const selectedSet = useMemo(() => new Set(selectedColumns), [selectedColumns]);
  const normalizedSearch = trimString(headerSearch).toLowerCase();
  const hasDateRange = Boolean(dateFrom || dateTo);
  const canExport = hasDateRange && selectedColumns.length > 0 && !exportBusy;

  const moduleStats = useMemo(() => sections.map((section) => {
    const keys = (section.columns || []).map((column) => column.key);
    const selected = keys.filter((key) => selectedSet.has(key)).length;
    return {
      id: section.id,
      label: section.label || section.id,
      total: keys.length,
      selected,
      allSelected: keys.length > 0 && selected === keys.length,
      indeterminate: selected > 0 && selected < keys.length,
    };
  }), [sections, selectedSet]);

  const visibleSections = useMemo(() => {
    const filtered = sections.map((section) => {
      const columns = (section.columns || []).filter((column) => {
        if (!normalizedSearch) return true;
        return String(column.label || '').toLowerCase().includes(normalizedSearch)
          || String(column.key || '').toLowerCase().includes(normalizedSearch);
      });
      return { ...section, columns };
    }).filter((section) => section.columns.length > 0);

    if (normalizedSearch) return filtered;
    if (!activeModuleId) return filtered;
    return filtered.filter((section) => section.id === activeModuleId);
  }, [sections, normalizedSearch, activeModuleId]);

  const stageOptions = stageFilterOptions(filters.lifecycleStage);
  const selectedCount = selectedColumns.length;
  const activeFiltersCount = [
    filters.lifecycleStage,
    filters.stageFilter,
    filters.status,
    filters.client,
    filters.campaignType,
    filters.search,
    filters.overdue,
  ].filter(Boolean).length;

  useEffect(() => {
    let cancelled = false;
    async function loadSchema() {
      setLoadingSchema(true);
      try {
        const [{ data: fieldsBody }, { data: templatesBody }] = await Promise.all([
          exportApi.fields(),
          exportApi.templates(),
        ]);
        if (cancelled) return;
        const nextSections = fieldsBody?.data?.sections || fieldsBody?.sections || [];
        setSections(nextSections);
        setTemplates(templatesBody?.data || []);
        setActiveModuleId(nextSections[0]?.id || '');
        setSelectedColumns(columnKeysForPreset(nextSections, 'operations'));
      } catch (err) {
        if (!cancelled) window.alert(err?.message || 'Failed to load export fields');
      } finally {
        if (!cancelled) setLoadingSchema(false);
      }
    }
    loadSchema();
    return () => { cancelled = true; };
  }, []);

  function updateFilter(key, value) {
    setFilters((prev) => {
      const next = { ...prev, [key]: value };
      if (key === 'lifecycleStage') next.stageFilter = '';
      return next;
    });
    setActivePresetId('');
    setSelectedTemplateId('');
  }

  function setSelection(nextKeys) {
    setSelectedColumns(orderSelectedKeys(columnKeys, nextKeys));
    setActivePresetId('');
    setSelectedTemplateId('');
  }

  function toggleColumn(key) {
    setSelection(
      selectedSet.has(key)
        ? selectedColumns.filter((item) => item !== key)
        : [...selectedColumns, key],
    );
  }

  function toggleSection(section) {
    const keys = (section.columns || []).map((column) => column.key);
    const allInSection = keys.every((key) => selectedSet.has(key));
    const next = new Set(selectedColumns);
    if (allInSection) {
      keys.forEach((key) => next.delete(key));
    } else {
      keys.forEach((key) => next.add(key));
    }
    setSelection([...next]);
  }

  function selectAllColumns() {
    setSelection([...columnKeys]);
  }

  function clearAllColumns() {
    setSelection([]);
  }

  function applyPreset(presetId) {
    setActivePresetId(presetId);
    setSelectedTemplateId('');
    setSelectedColumns(columnKeysForPreset(sections, presetId));
  }

  function applySavedTemplate(templateId) {
    setSelectedTemplateId(templateId);
    setActivePresetId('');
    if (!templateId) return;
    const template = templates.find((item) => String(item.id) === String(templateId));
    if (!template) return;
    if (Array.isArray(template.columns) && template.columns.length) {
      setSelectedColumns(orderSelectedKeys(columnKeys, template.columns));
    }
    if (template.filters && typeof template.filters === 'object') {
      setFilters({
        lifecycleStage: template.filters.lifecycleStage || '',
        stageFilter: template.filters.stageFilter || '',
        status: template.filters.status || '',
        client: template.filters.client || '',
        campaignType: template.filters.campaignType || '',
        search: template.filters.search || '',
        overdue: Boolean(template.filters.overdue),
      });
    }
  }

  async function handleSaveTemplate() {
    const name = trimString(templateName);
    if (!name) {
      window.alert('Enter a template name before saving.');
      return;
    }
    if (!selectedColumns.length) {
      window.alert('Select at least one column before saving a template.');
      return;
    }
    setTemplateBusy(true);
    try {
      const { data } = await exportApi.saveTemplate({
        name,
        columns: selectedColumns,
        filters,
        format,
      });
      const saved = data?.data || data;
      setTemplates((prev) => [saved, ...prev.filter((item) => String(item.id) !== String(saved.id))]);
      setSelectedTemplateId(String(saved.id));
      setTemplateName('');
      setActivePresetId('');
    } catch (err) {
      window.alert(err?.message || 'Failed to save export template');
    } finally {
      setTemplateBusy(false);
    }
  }

  async function handleDeleteTemplate() {
    if (!selectedTemplateId) return;
    if (!window.confirm('Delete this saved template?')) return;
    setTemplateBusy(true);
    try {
      await exportApi.deleteTemplate(selectedTemplateId);
      setTemplates((prev) => prev.filter((item) => String(item.id) !== String(selectedTemplateId)));
      setSelectedTemplateId('');
    } catch (err) {
      window.alert(err?.message || 'Failed to delete export template');
    } finally {
      setTemplateBusy(false);
    }
  }

  async function handleExport() {
    if (!canExport) return;
    setExportBusy(true);
    try {
      await exportApi.download({
        dateFrom,
        dateTo,
        format,
        columns: selectedColumns,
        filters: buildExportFilters(filters),
      });
    } catch (err) {
      window.alert(err?.message || 'Failed to export camps');
    } finally {
      setExportBusy(false);
    }
  }

  if (loadingSchema) {
    return <div className="camp-export-loading">Loading export builder…</div>;
  }

  return (
    <div className="camp-export-builder">
      <div className="camp-export-presets" role="toolbar" aria-label="Column presets">
        {EXPORT_PRESET_TEMPLATES.map((preset) => (
          <button
            key={preset.id}
            type="button"
            className={`camp-export-preset-chip${activePresetId === preset.id ? ' is-active' : ''}`}
            onClick={() => applyPreset(preset.id)}
            title={preset.hint}
          >
            <span className="camp-export-preset-label">{preset.label}</span>
            <span className="camp-export-preset-hint">{preset.hint}</span>
          </button>
        ))}
      </div>

      <div className="camp-export-saved-row">
        <label className="camp-export-saved-field">
          <span>Saved template</span>
          <select
            value={selectedTemplateId}
            onChange={(e) => applySavedTemplate(e.target.value)}
            aria-label="Load saved export template"
          >
            <option value="">Choose saved…</option>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>{template.name}</option>
            ))}
          </select>
        </label>
        <label className="camp-export-saved-field camp-export-saved-name">
          <span>Save as</span>
          <input
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            onBlur={(e) => setTemplateName(trimString(e.target.value))}
            placeholder="Template name"
          />
        </label>
        <button className="btn secondary btn-compact" type="button" disabled={templateBusy} onClick={handleSaveTemplate}>
          Save
        </button>
        <button
          className="btn secondary btn-compact"
          type="button"
          disabled={templateBusy || !selectedTemplateId}
          onClick={handleDeleteTemplate}
        >
          Delete
        </button>
      </div>

      <div className="camp-export-workspace">
        <aside className="camp-export-filters-pane">
          <button
            type="button"
            className="camp-export-filters-toggle"
            onClick={() => setFiltersOpen((open) => !open)}
            aria-expanded={filtersOpen}
          >
            <span>Filters</span>
            {activeFiltersCount > 0 && (
              <span className="camp-export-filter-badge">{activeFiltersCount}</span>
            )}
          </button>
          {filtersOpen && (
            <div className="camp-export-filters-body">
              <label className="camp-export-filter-item">
                <span>Lifecycle</span>
                <select
                  value={filters.lifecycleStage}
                  onChange={(e) => updateFilter('lifecycleStage', e.target.value)}
                >
                  {LIFECYCLE_FILTER_OPTIONS.map((option) => (
                    <option key={option.value || 'all'} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              {stageOptions.length > 0 && (
                <label className="camp-export-filter-item">
                  <span>Stage filter</span>
                  <select
                    value={filters.stageFilter}
                    onChange={(e) => updateFilter('stageFilter', e.target.value)}
                  >
                    {stageOptions.map((option) => (
                      <option key={option.value || 'all'} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
              )}
              <label className="camp-export-filter-item">
                <span>Status</span>
                <select
                  value={filters.status}
                  onChange={(e) => updateFilter('status', e.target.value)}
                >
                  {STATUS_FILTER_OPTIONS.map((option) => (
                    <option key={option.value || 'any'} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label className="camp-export-filter-item">
                <span>Client ID</span>
                <input
                  value={filters.client}
                  onChange={(e) => updateFilter('client', e.target.value)}
                  placeholder="Optional"
                />
              </label>
              <label className="camp-export-filter-item">
                <span>Division</span>
                <input
                  value={filters.campaignType}
                  onChange={(e) => updateFilter('campaignType', e.target.value)}
                  placeholder="Optional"
                />
              </label>
              <label className="camp-export-filter-item">
                <span>Search</span>
                <input
                  value={filters.search}
                  onChange={(e) => updateFilter('search', e.target.value)}
                  placeholder="Camp ID, doctor…"
                />
              </label>
              <label className="camp-export-filter-check">
                <input
                  type="checkbox"
                  checked={filters.overdue}
                  onChange={(e) => updateFilter('overdue', e.target.checked)}
                />
                <span>Overdue only</span>
              </label>
            </div>
          )}
        </aside>

        <div className="camp-export-columns-pane">
          <div className="camp-export-columns-toolbar">
            <div className="camp-export-columns-toolbar-main">
              <strong className="camp-export-counter" aria-live="polite">
                {selectedCount}
                <span> / {columnKeys.length} columns</span>
              </strong>
              <input
                type="search"
                className="camp-export-header-search"
                placeholder="Search headers…"
                value={headerSearch}
                onChange={(e) => setHeaderSearch(e.target.value)}
                aria-label="Search export headers"
              />
            </div>
            <div className="camp-export-columns-toolbar-actions">
              <button className="btn secondary btn-compact" type="button" onClick={selectAllColumns}>
                Select all
              </button>
              <button className="btn secondary btn-compact" type="button" onClick={clearAllColumns}>
                Clear all
              </button>
            </div>
          </div>

          {!normalizedSearch && (
            <div className="camp-export-module-rail" role="tablist" aria-label="Export modules">
              {moduleStats.map((module) => (
                <button
                  key={module.id}
                  type="button"
                  role="tab"
                  aria-selected={activeModuleId === module.id}
                  className={`camp-export-module-tab${activeModuleId === module.id ? ' is-active' : ''}`}
                  onClick={() => setActiveModuleId(module.id)}
                >
                  <span className="camp-export-module-tab-label">{module.label}</span>
                  <span className="camp-export-module-tab-count">{module.selected}/{module.total}</span>
                </button>
              ))}
            </div>
          )}

          <div className="camp-export-column-list">
            {visibleSections.length === 0 && (
              <p className="camp-export-empty">No headers match your search.</p>
            )}
            {visibleSections.map((section) => {
              const sectionKeys = section.columns.map((column) => column.key);
              const sectionSelected = sectionKeys.filter((key) => selectedSet.has(key)).length;
              const sectionAllSelected = sectionKeys.length > 0 && sectionSelected === sectionKeys.length;
              const sectionIndeterminate = sectionSelected > 0 && !sectionAllSelected;

              return (
                <section key={section.id} className="camp-export-module-block">
                  <label className="camp-export-module-head">
                    <input
                      type="checkbox"
                      checked={sectionAllSelected}
                      ref={(node) => {
                        if (node) node.indeterminate = sectionIndeterminate;
                      }}
                      onChange={() => toggleSection(section)}
                    />
                    <span className="camp-export-module-title">{section.label || section.id}</span>
                    <span className="camp-export-module-count">{sectionSelected}/{sectionKeys.length}</span>
                  </label>
                  <div className="camp-export-column-grid">
                    {section.columns.map((column) => (
                      <label key={column.key} className="camp-export-column-item">
                        <input
                          type="checkbox"
                          checked={selectedSet.has(column.key)}
                          onChange={() => toggleColumn(column.key)}
                        />
                        <span>{column.label}</span>
                      </label>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      </div>

      <div className="camp-export-sticky-bar">
        <div className="camp-export-sticky-meta">
          <span className="camp-export-sticky-count">{selectedCount} columns selected</span>
          {!hasDateRange && (
            <span className="camp-export-sticky-hint">Select a camp date range above</span>
          )}
          {hasDateRange && selectedCount === 0 && (
            <span className="camp-export-sticky-hint">Select at least one column</span>
          )}
        </div>
        <button
          className="btn btn-compact"
          type="button"
          disabled={!canExport}
          onClick={handleExport}
        >
          {exportBusy ? ACTION.EXPORTING : format === 'csv' ? 'Download CSV' : ACTION.DOWNLOAD_EXCEL}
        </button>
      </div>
    </div>
  );
}
