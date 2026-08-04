import { Outlet } from 'react-router-dom';
import { NAV } from '../../shared/labels.js';
import ModuleSubNav from '../../components/ui/ModuleSubNav.jsx';
import { useCampOpsAuth } from './useCampOpsAuth.js';

export default function CommunicationsLayout() {
  const { hasPermission } = useCampOpsAuth();

  const navItems = [
    {
      to: '/camp-one/communications/paste',
      end: true,
      label: NAV.CAMP_CREATE_MANUAL_PASTE,
      show: hasPermission('communications:read'),
    },
    {
      to: '/camp-one/communications/email',
      end: true,
      label: NAV.CAMP_CREATE_EMAIL,
      show: hasPermission('communications:read'),
    },
    {
      to: '/camp-one/communications/upload',
      end: true,
      label: NAV.CAMP_CREATE_UPLOAD,
      show: hasPermission('import:create') || hasPermission('import:execute'),
    },
    {
      to: '/camp-one/communications/download',
      end: true,
      label: NAV.CAMP_CREATE_DOWNLOAD,
      show: hasPermission('camps:read'),
    },
  ].filter((item) => item.show);

  return (
    <div className="communications-hub">
      {navItems.length > 0 && (
        <ModuleSubNav
          variant="segmented"
          role="tablist"
          ariaLabel="Create camps"
          items={navItems}
          className="communications-hub-tabs"
        />
      )}
      <Outlet />
    </div>
  );
}
