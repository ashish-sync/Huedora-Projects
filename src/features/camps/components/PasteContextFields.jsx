import { CampNameSelect } from './CampNameSelect';
import { CampClientTypeahead } from './CampClientTypeahead.jsx';

export function PasteContextFields({
  clients = [],
  clientId,
  campaignType,
  campaignName,
  divisionOptions = [],
  campNameOptions = [],
  programsLoading = false,
  clientsLoading = false,
  disabled = false,
  errors = {},
  onClientChange,
  onDivisionChange,
  onCampNameChange,
}) {
  const singleDivisionOption = divisionOptions.length === 1;
  const singleMethodOption = campNameOptions.length === 1;
  const selectedLabel = clients.find((c) => String(c._id) === String(clientId))?.name || '';

  return (
    <div className="paste-context-fields" aria-label="Camp context before paste">
      <div className="paste-context-fields-heading">
        <strong>Camp context</strong>
        <span>Select Client, division, and method before pasting</span>
      </div>
      <div className="paste-context-fields-grid">
        <div className={`paste-context-field${errors.clientId ? ' has-error' : ''}`}>
          <CampClientTypeahead
            value={clientId}
            selectedLabel={selectedLabel}
            onChange={(id) => onClientChange(id)}
            disabled={disabled || clientsLoading}
            required
          />
          {errors.clientId && <small className="field-error">{errors.clientId}</small>}
        </div>

        <label className="paste-context-field" htmlFor="paste-context-division">
          <span className="paste-context-field-label">Division / Therapy</span>
          <select
            id="paste-context-division"
            value={campaignType}
            onChange={(e) => onDivisionChange(e.target.value)}
            disabled={disabled || programsLoading || !clientId || !divisionOptions.length}
            className={errors.campaignType ? 'input-invalid' : ''}
            required
          >
            <option value="">
              {programsLoading
                ? 'Loading divisions…'
                : !clientId
                  ? 'Select Client first'
                  : singleDivisionOption
                    ? campaignType
                    : divisionOptions.length
                      ? 'Select division / therapy'
                      : 'No division configured'}
            </option>
            {divisionOptions.map((division) => (
              <option key={division} value={division}>{division}</option>
            ))}
          </select>
          {errors.campaignType && <small className="field-error">{errors.campaignType}</small>}
        </label>

        <label className="paste-context-field" htmlFor="paste-context-camp-name">
          <span className="paste-context-field-label">Method</span>
          <CampNameSelect
            id="paste-context-camp-name"
            value={campaignName}
            onChange={onCampNameChange}
            disabled={disabled || programsLoading || !clientId || !campaignType || !campNameOptions.length}
            required
            allowOther={false}
            error={errors.campaignName || ''}
            options={campNameOptions}
            placeholder="Select method"
            emptyLabel={
              !clientId
                ? 'Select Client first'
                : !campaignType
                  ? 'Select division / therapy first'
                  : programsLoading
                    ? 'Loading methods…'
                    : campNameOptions.length
                      ? (singleMethodOption ? campaignName : 'Select method')
                      : 'No method configured'
            }
          />
        </label>
      </div>
    </div>
  );
}
