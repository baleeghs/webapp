import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeAll } from 'vitest';
import { useUiStore } from '@/stores/ui-store';
import { server, unhandled } from './mock-api';

// DOM gaps, kept minimal and close to the real behaviour.
if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}
if (!HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.open = false;
    this.dispatchEvent(new Event('close'));
  };
}

// The router's scroll restoration calls scrollTo, which the test DOM only stubs.
window.scrollTo = () => {};
Element.prototype.scrollTo = () => {};

beforeAll(() => server.install());

afterEach(() => {
  cleanup();
  // A request without a route means the test depended on something it did not set up.
  const missed = [...unhandled];
  server.reset();
  useUiStore.setState({ sidebarOpen: false, sidebarCollapsed: false });
  localStorage.clear();
  if (missed.length) {
    throw new Error(
      `Requests with no mock route (add one in src/test/mock-api.ts or server.use): ${missed.join(', ')}`,
    );
  }
});
