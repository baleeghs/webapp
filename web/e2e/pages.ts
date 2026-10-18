/** Every top-level page, with the heading that proves it rendered. Add new pages here. */
export const PAGES = [
  { name: 'overview', path: '/', heading: 'Overview' },
  { name: 'notes', path: '/notes', heading: 'Notes' },
  { name: 'settings', path: '/settings', heading: 'Settings' },
  { name: 'not-found', path: '/no-such-page', heading: 'Page not found' },
] as const;
