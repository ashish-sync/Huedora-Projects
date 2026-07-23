import { CampNameSelect } from './CampNameSelect';

export function PasteContextFields({
  clients = [],
  clientId,
  campaignType,
  campaignName,
  divisionOptions = [],
  programsLoading = false,
  clientsLoading = false,
  disabled = false,
  errors = {},
  onClientChange,
  onDivisionChange,
  onCampNameChange,
}) {
  return (
    <div className="paste-context-fields" aria-label="Camp context before paste">
      <div className="paste-context-fields-heading">
        <strong>Camp context</strong>
        <span>Select client, division, and method before pasting</span>
      </div>
      <div className="paste-context-fields-grid">
        <label className="paste-context-field" htmlFor="paste-context-client">
          <span className="paste-context-field-label">Client Name</span>
          <select
            id="paste-context-client"
            value={clientId}
            onChange={(e) => onClientChange(e.target.value)}
            disabled={disabled || clientsLoading}
            className={errors.clientId ? 'input-invalid' : ''}
            required
          >
            <option value="">{clientsLoading ? 'Loading clients…' : 'Select client'}</option>
            {clients.map((client) => (
              <option key={client._id} value={client._id}>{client.name}</option>
            ))}
          </select>
          {errors.clientId && <small className="field-error">{errors.clientId}</small>}
        </label>

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
                  ? 'Select client first'
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
          <span className="paste-context-field-label">Method / Camp Name</span>
          <CampNameSelect
            id="paste-context-camp-name"
            value={campaignName}
            onChange={onCampNameChange}
            disabled={disabled || !clientId}
            required
            error={errors.campaignName || ''}
            placeholder="Select method / camp name"
          />
        </label>
      </div>
    </div>
  );
}
