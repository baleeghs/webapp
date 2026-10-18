import { test as base, type Page, type Route } from '@playwright/test';

/**
 * E2E tests drive the real UI in a real browser, with the HTTP API mocked at the network layer, so
 * they need no server or database and never flake on data. The Rust tests own the API contract;
 * these own the UI's behaviour.
 */
export interface MockNote {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export class MockApi {
  notes: MockNote[] = [];
  private seq = 0;

  seed(...titles: string[]): MockNote[] {
    return titles.map((title) => {
      this.seq += 1;
      const at = new Date(Date.UTC(2026, 9, 1, 12, 0, this.seq)).toISOString();
      const note = {
        id: `00000000-0000-7000-8000-${String(this.seq).padStart(12, '0')}`,
        title,
        body: '',
        createdAt: at,
        updatedAt: at,
      };
      this.notes.push(note);
      return note;
    });
  }

  async install(page: Page): Promise<void> {
    await page.route('**/healthz', (route) => route.fulfill({ json: { status: 'ok', version: '0.1.0' } }));
    await page.route('**/api/v1/notes**', (route) => this.handleNotes(route));
  }

  private async handleNotes(route: Route): Promise<void> {
    const request = route.request();
    const url = new URL(request.url());
    const id = url.pathname.split('/')[4];
    const note = id ? this.notes.find((n) => n.id === id) : undefined;
    const notFound = () =>
      route.fulfill({ status: 404, json: { error: { code: 'not_found', message: `note ${id} not found` } } });

    switch (`${request.method()} ${id ? 'item' : 'collection'}`) {
      case 'GET collection': {
        const limit = Number(url.searchParams.get('limit') ?? 20);
        const offset = Number(url.searchParams.get('offset') ?? 0);
        const items = [...this.notes].sort((a, b) => b.id.localeCompare(a.id)).slice(offset, offset + limit);
        return route.fulfill({ json: { items, total: this.notes.length, limit, offset } });
      }
      case 'POST collection': {
        const body = request.postDataJSON() as { title: string; body?: string };
        const [created] = this.seed(body.title.trim());
        created!.body = body.body ?? '';
        return route.fulfill({ status: 201, json: created });
      }
      case 'GET item':
        return note ? route.fulfill({ json: note }) : notFound();
      case 'PATCH item':
        if (!note) return notFound();
        Object.assign(note, request.postDataJSON(), { updatedAt: new Date().toISOString() });
        return route.fulfill({ json: note });
      case 'DELETE item':
        if (!note) return notFound();
        this.notes = this.notes.filter((n) => n.id !== id);
        return route.fulfill({ status: 204 });
      default:
        return route.fulfill({ status: 405 });
    }
  }
}

/** `test` with a fresh mocked API per test: `test('...', async ({ page, api }) => ...)`. */
export const test = base.extend<{ api: MockApi }>({
  // `auto`: installed for every test, even ones that never touch `api`, so no request can
  // reach the dev server's proxy (and a backend that is not running).
  api: [
    async ({ page }, use) => {
      const api = new MockApi();
      await api.install(page);
      await use(api);
    },
    { auto: true },
  ],
});

export { expect } from '@playwright/test';
