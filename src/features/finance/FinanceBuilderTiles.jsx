import { Link } from 'react-router-dom';
import { FINANCE_BUILDER_OPTIONS } from './financeBuilderRoutes.js';

export function FinanceBuilderTiles() {
  return (
    <div className="finance-hub-tiles">
      {FINANCE_BUILDER_OPTIONS.map((item) => (
        <Link key={item.to} to={item.to} className="finance-hub-tile">
          <span className="finance-hub-tile-code" aria-hidden="true">
            {item.code}
          </span>
          <span className="finance-hub-tile-body">
            <span className="finance-hub-tile-label">{item.label}</span>
            <span className="finance-hub-tile-desc">{item.desc}</span>
          </span>
          <span className="finance-hub-tile-arrow" aria-hidden="true">
            →
          </span>
        </Link>
      ))}
    </div>
  );
}
