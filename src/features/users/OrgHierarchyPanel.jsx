import { useEffect, useState } from 'react';
import { api } from '../../shared/api.js';

function OrgTreeNode({ node, depth = 0, onSelect }) {
  const inactive = node.isActive === false;
  return (
    <li className="org-tree-item">
      <button
        type="button"
        className={`org-tree-row${inactive ? ' is-inactive' : ''}`}
        style={{ paddingLeft: `${12 + depth * 20}px` }}
        onClick={() => onSelect?.(node.id)}
      >
        <span className="org-tree-name">{node.fullName || node.email}</span>
        {node.designation ? <span className="org-tree-designation">{node.designation}</span> : null}
        {inactive ? <span className="org-tree-badge">Inactive</span> : null}
      </button>
      {node.directReports?.length > 0 && (
        <ul className="org-tree-children">
          {node.directReports.map((child) => (
            <OrgTreeNode key={child.id} node={child} depth={depth + 1} onSelect={onSelect} />
          ))}
        </ul>
      )}
    </li>
  );
}

export default function OrgHierarchyPanel({ canWrite, onEditPerson }) {
  const [tree, setTree] = useState([]);
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    api('/users/hierarchy')
      .then((res) => {
        if (cancelled) return;
        setTree(res.data?.tree || []);
        setPeople(res.data?.people || []);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Failed to load org hierarchy');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const unassigned = people.filter(
    (person) => !person.reportingManagerId && !tree.some((node) => String(node.id) === String(person.id))
  );

  return (
    <div className="org-hierarchy card rp-panel">
      <div className="org-hierarchy-head">
        <div>
          <h3>Organizational hierarchy</h3>
          <p className="muted rp-hint">
            Reporting lines are defined per person under the People tab. Sign-in stays email + password only.
          </p>
        </div>
        <div className="org-hierarchy-stats muted mono-sm">
          <span>{people.length} people</span>
          <span>{tree.length} top-level</span>
        </div>
      </div>

      {error && <p className="error">{error}</p>}
      {loading && <p className="muted">Loading hierarchy…</p>}

      {!loading && !error && (
        <>
          {tree.length > 0 ? (
            <ul className="org-tree" role="tree" aria-label="Reporting hierarchy">
              {tree.map((node) => (
                <OrgTreeNode key={node.id} node={node} onSelect={onEditPerson} />
              ))}
            </ul>
          ) : (
            <p className="muted rp-empty">No reporting lines yet. Set a reporting manager on each person.</p>
          )}

          {unassigned.length > 0 && (
            <section className="org-unassigned">
              <h4>Without a reporting manager</h4>
              <ul className="org-unassigned-list">
                {unassigned.map((person) => (
                  <li key={person.id}>
                    <button
                      type="button"
                      className="org-tree-row"
                      onClick={() => onEditPerson?.(person.id)}
                      disabled={!canWrite}
                    >
                      <span className="org-tree-name">{person.fullName || person.email}</span>
                      {person.designation ? (
                        <span className="org-tree-designation">{person.designation}</span>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
