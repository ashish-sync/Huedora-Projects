/**
 * Zoho-style onboarding checklist — guides users through required fields.
 */
export default function DocumentGuide({ title = 'Getting started', items = [], actions }) {
  const done = items.filter((i) => i.done).length;
  const total = items.length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  return (
    <aside className="doc-guide" aria-label="Document checklist">
      <div className="doc-guide-head">
        <h2 className="doc-guide-title">{title}</h2>
        <p className="doc-guide-sub">Every field on the document is editable — click any placeholder.</p>
        {total > 0 ? (
          <div className="doc-guide-progress">
            <div className="doc-guide-progress-bar" style={{ width: `${pct}%` }} />
            <span className="doc-guide-progress-label">
              {done}/{total} complete
            </span>
          </div>
        ) : null}
      </div>

      <ul className="doc-guide-list">
        {items.map((item) => (
          <li key={item.id} className={`doc-guide-item${item.done ? ' is-done' : ''}`}>
            <span className="doc-guide-check" aria-hidden="true">
              {item.done ? '✓' : ''}
            </span>
            <span>{item.label}</span>
          </li>
        ))}
      </ul>

      {actions ? <div className="doc-guide-actions">{actions}</div> : null}

      <p className="doc-guide-foot">
        Inspired by{' '}
        <a href="https://www.zoho.com/in/inventory/purchaseorder-generator/" target="_blank" rel="noreferrer">
          Zoho
        </a>{' '}
        &amp;{' '}
        <a
          href="https://tallysolutions.com/business-tools-templates/free-online-invoice-generator/"
          target="_blank"
          rel="noreferrer"
        >
          Tally
        </a>{' '}
        — edit on canvas, export when ready.
      </p>
    </aside>
  );
}
