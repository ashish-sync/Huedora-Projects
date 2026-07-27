import { NavLink, Outlet } from 'react-router-dom';
import ModuleSubNav from '../../components/ui/ModuleSubNav.jsx';

const NAV_ITEMS = [
  { to: '/camps/communications/paste', end: true, label: 'Manual Paste', role: 'tab' },
  { to: '/camps/communications/email', end: true, label: 'Email', role: 'tab' },
];

export default function CommunicationsLayout() {
  return (
    <div className="communications-hub">
      <ModuleSubNav
        variant="segmented"
        role="tablist"
        ariaLabel="Manual paste and email"
        items={NAV_ITEMS}
        className="communications-hub-tabs"
      />
      <Outlet />
    </div>
  );
}
