/**
 * Manual column mapping for Camp One paste Excel/CSV import.
 */
export default function PasteColumnMapper({
  fields = [],
  headers = [],
  mapping = {},
  columnResults = [],
  onMappingChange,
  disabled = false,
}) {
  const unmappedHeaders = columnResults
    .filter((item) => item.status === 'unmapped')
    .map((item) => item.header);

  return (
    <div className="paste-column-mapper panel">
      <h4>Column mapping</h4>
      <p className="meta-text">
        Headers are matched automatically. Map any <strong>Unmapped</strong> columns below.
      </p>

      {unmappedHeaders.length ? (
        <div className="info-banner">
          Unmapped file columns: {unmappedHeaders.join(', ')}
        </div>
      ) : null}

      <div className="paste-column-mapper-grid">
        {fields.map((field) => (
          <label key={field.key} className="field">
            {field.label}
            {field.required ? ' *' : ''}
            <select
              value={mapping[field.key] || ''}
              disabled={disabled}
              onChange={(e) => onMappingChange?.({
                ...mapping,
                [field.key]: e.target.value,
              })}
            >
              <option value="">Unmapped</option>
              {headers.map((header) => (
                <option key={header} value={header}>{header}</option>
              ))}
            </select>
          </label>
        ))}
      </div>

      {columnResults.length ? (
        <table className="paste-column-mapper-table">
          <thead>
            <tr>
              <th>File column</th>
              <th>Matched field</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {columnResults.map((item) => (
              <tr key={item.header}>
                <td>{item.header}</td>
                <td>{item.fieldLabel || '—'}</td>
                <td>
                  <span className={`paste-map-status paste-map-status--${item.status}`}>
                    {item.status === 'mapped' ? 'Mapped' : 'Unmapped'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </div>
  );
}
