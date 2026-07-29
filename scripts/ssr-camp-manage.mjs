import { renderToString } from 'react-dom/server';
import { createElement } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import CampsPage from '../src/features/camps/CampManagePage.jsx';
import { CampWorkingStageProvider } from '../src/features/camps/CampWorkingStageContext.jsx';

// Minimal mocks before importing page deps
globalThis.sessionStorage = {
  getItem: () => 'request',
  setItem: () => {},
  removeItem: () => {},
};

const tree = createElement(
  MemoryRouter,
  { initialEntries: ['/camps/manage'] },
  createElement(
    CampWorkingStageProvider,
    null,
    createElement(
      Routes,
      null,
      createElement(Route, { path: '/camps/manage', element: createElement(CampsPage) }),
    ),
  ),
);

try {
  const html = renderToString(tree);
  console.log('render ok, length:', html.length);
  console.log(html.slice(0, 400));
} catch (err) {
  console.error('render failed:', err);
  process.exit(1);
}
