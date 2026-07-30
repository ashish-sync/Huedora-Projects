import { useEffect, useMemo, useState } from 'react';
import { api } from '../../shared/api.js';

function getInitials(fullName = '', email = '') {
  const parts = String(fullName || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  const local = String(email || '').split('@')[0] || '?';
  return local.slice(0, 2).toUpperCase();
}

function countDescendants(node) {
  const kids = node.directReports || [];
  return kids.reduce((sum, child) => sum + 1 + countDescendants(child), 0);
}

function OrgTreeNode({ node, depth = 0, onSelect, defaultExpanded = true }) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const inactive = node.isActive === false;
  const reports = node.directReports || [];
  const reportCount = reports.length;
  const teamSize = countDescendants(node);

  return (
    <li className="org-tree-item" role="treeitem" aria-expanded={reportCount ? expanded : undefined}>
      <div className="org-node" data-depth={Math.min(depth, 5)}>
        {depth > 0 && <span className="org-node-connector" aria-hidden="true" />}
        <div className={`org-node-card${inactive ? ' is-inactive' : ''}`}>
          <button
            type="button"
            className="org-node-main"
            onClick={() => onSelect?.(node.id)}
            title={node.email ? `${node.fullName || node.email} · ${node.email}` : node.fullName}
          >
            <span className="org-avatar" aria-hidden="true">
              {getInitials(node.fullName, node.email)}
            </span>
            <span className="org-node-body">
              <span className="org-node-name">{node.fullName || node.email}</span>
              {node.designation ? (
                <span className="org-node-designation">{node.designation}</span>
              ) : (
                <span className="org-node-designation org-node-designation--empty">No designation</span>
              )}
              {node.email ? <span className="org-node-email">{node.email}</span> : null}
            </span>
          </button>

          <div className="org-node-meta">
            {inactive ? <span className="org-pill org-pill--muted">Inactive</span> : null}
            {teamSize > 0 ? (
              <span className="org-pill org-pill--team" title="Total people in this branch">
                {teamSize} in team
              </span>
            ) : null}
            {reportCount > 0 ? (
              <button
                type="button"
                className={`org-node-toggle${expanded ? ' is-open' : ''}`}
                onClick={() => setExpanded((open) => !open)}
                aria-label={expanded ? 'Collapse direct reports' : 'Expand direct reports'}
              >
                <span className="org-node-toggle-icon" aria-hidden="true" />
                {reportCount} direct
              </button>
            ) : null}
          </div>
        </div>

        {reportCount > 0 && expanded ? (
          <ul className="org-tree-children" role="group">
            {reports.map((child) => (
              <OrgTreeNode
                key={child.id}
                node={child}
                depth={depth + 1}
                onSelect={onSelect}
                defaultExpanded={depth < 2}
              />
            ))}
          </ul>
        ) : null}
      </div>
    </li>
  );
}

function UnassignedPerson({ person, canWrite, onSelect }) {
  return (
    <li>
      <button
        type="button"
        className="org-unassigned-card"
        onClick={() => onSelect?.(person.id)}
        disabled={!canWrite}
      >
        <span className="org-avatar org-avatar--sm" aria-hidden="true">
          {getInitials(person.fullName, person.email)}
        </span>
        <span className="org-unassigned-body">
          <span className="org-node-name">{person.fullName || person.email}</span>
          {person.designation ? (
            <span className="org-node-designation">{person.designation}</span>
          ) : null}
        </span>
      </button>
    </li>
  );
}

export default function OrgHierarchyPanel({ canWrite, onEditPerson }) {
  const [tree, setTree] = useState([]);
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');

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
    (person) =>
      !person.reportingManagerId && !tree.some((node) => String(node.id) === String(person.id))
  );

  const managerCount = useMemo(
    () => people.filter((person) => people.some((p) => String(p.reportingManagerId) === String(person.id))).length,
    [people]
  );

  const normalizedQuery = query.trim().toLowerCase();
  const filteredTree = useMemo(() => {
    if (!normalizedQuery) return tree;

    function filterNode(node) {
      const haystack = [node.fullName, node.email, node.designation]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      const kids = (node.directReports || []).map(filterNode).filter(Boolean);
      if (haystack.includes(normalizedQuery) || kids.length) {
        return { ...node, directReports: kids };
      }
      return null;
    }

    return tree.map(filterNode).filter(Boolean);
  }, [tree, normalizedQuery]);

  return (
    <div className="org-hierarchy card rp-panel">
      <div className="org-hierarchy-head">
        <div className="org-hierarchy-intro">
          <h3>Organizational hierarchy</h3>
          <p className="muted rp-hint">
            Reporting lines from the People tab. Click a person to edit their profile.
          </p>
        </div>
        <div className="org-hierarchy-stats">
          <span className="org-stat-pill">
            <strong>{people.length}</strong>
            <span>people</span>
          </span>
          <span className="org-stat-pill">
            <strong>{managerCount}</strong>
            <span>managers</span>
          </span>
          <span className="org-stat-pill">
            <strong>{tree.length}</strong>
            <span>top-level</span>
          </span>
        </div>
      </div>

      {!loading && !error && people.length > 0 ? (
        <div className="org-hierarchy-toolbar">
          <input
            type="search"
            className="org-hierarchy-search rp-search"
            placeholder="Search name, role, or email…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search org hierarchy"
          />
        </div>
      ) : null}

      {error && <p className="error">{error}</p>}
      {loading && <p className="muted org-hierarchy-loading">Loading hierarchy…</p>}

      {!loading && !error && (
        <>
          {filteredTree.length > 0 ? (
            <div className="org-tree-scroll">
              <ul className="org-tree" role="tree" aria-label="Reporting hierarchy">
                {filteredTree.map((node) => (
                  <OrgTreeNode key={node.id} node={node} onSelect={onEditPerson} />
                ))}
              </ul>
            </div>
          ) : tree.length > 0 ? (
            <p className="muted rp-empty">No matches for your search.</p>
          ) : (
            <p className="muted rp-empty">No reporting lines yet. Set a reporting manager on each person.</p>
          )}

          {unassigned.length > 0 && !normalizedQuery ? (
            <section className="org-unassigned">
              <div className="org-unassigned-head">
                <h4>Without a reporting manager</h4>
                <span className="org-pill org-pill--muted">{unassigned.length}</span>
              </div>
              <ul className="org-unassigned-list">
                {unassigned.map((person) => (
                  <UnassignedPerson
                    key={person.id}
                    person={person}
                    canWrite={canWrite}
                    onSelect={onEditPerson}
                  />
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
