import { NavLink, Outlet } from 'react-router-dom';

export default function CommunicationsLayout() {
  return (
    <div className="communications-hub">
      <div className="page-tabs" role="tablist" aria-label="Manual paste and email">
        <NavLink
          to="/camps/communications/paste"
          end
          role="tab"
          className={({ isActive }) => `page-tab${isActive ? ' is-active' : ''}`}
        >
          Manual Paste
        </NavLink>
        <NavLink
          to="/camps/communications/email"
          end
          role="tab"
          className={({ isActive }) => `page-tab${isActive ? ' is-active' : ''}`}
        >
          Email
        </NavLink>
      </div>
      <Outlet />
    </div>
  );
}
