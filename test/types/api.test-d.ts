// Compile-time exercise of the public surface. Not run — `tsc --noEmit` over
// this file is the assertion.
//
// It imports the package by name, so resolution goes through the "exports"
// map's types conditions exactly as a consumer's does, rather than reaching
// for the declaration files by path.
//
// What it cannot prove on its own: that a declared value actually exists at
// runtime. Code that should compile says nothing about a declaration with no
// counterpart in the bundle. test/export-parity.mjs covers that direction.
import {
  createSiftController,
  createSiftView,
  EmailClient,
  LoadViewResult,
  PresentViewParams,
  SiftController,
  SiftView,
} from '@redsift/sift-sdk-web';
import { useSiftView } from '@redsift/sift-sdk-web/react';

// --- the class form -------------------------------------------------------
class MyView extends SiftView {
  constructor() {
    super({ clientOrigin: 'https://app.redsift.com' });
  }
  presentView(params: PresentViewParams) {
    const rows = params.data;
    this.publish('ready', rows);
    this.notifyClient('showBillingPortal', {});
  }
}
const view = new MyView();
view.showOAuthPopup({ provider: 'google', options: { email: 'a@b.co' } });
view.navigate({ href: '/x', openInNewTab: true });
view.login({ redirectUri: '/back' });
view.logout();
view.destroy();
view.controller.subscribe('topic', (message) => void message);
const plugin = view.getPlugin<{ setup(o: unknown): void }>({ id: 'sync-history' });
plugin?.setup({});

// an array of allowed client origins is accepted
new SiftView({ clientOrigin: ['https://a.example', 'https://b.example'] });

// --- the factory form keeps the extra methods visible ---------------------
const factoryView = createSiftView(
  {
    presentView(params: PresentViewParams) {
      void params;
    },
    myOwnHelper(n: number): string {
      return String(n);
    },
  },
  { clientOrigin: 'https://app.redsift.com' }
);
const helped: string = factoryView.myOwnHelper(1);
factoryView.notifyClient('topic');
void helped;

// --- the controller -------------------------------------------------------
class MyController extends SiftController {
  loadView(): LoadViewResult {
    return { html: 'index.html', data: Promise.resolve([1, 2, 3]) };
  }
}
const controller = new MyController();
controller.publish('controllerAction', { type: 'X' });
controller.view.subscribe('fromView', () => {});
void controller.storage.getAll({ bucket: 'b' });

const factoryController = createSiftController({
  loadView(): LoadViewResult {
    return { data: [] };
  },
});
void factoryController;

// --- the hook -------------------------------------------------------------
function useIt() {
  const [params, siftView] = useSiftView({
    clientOrigin: 'https://app.redsift.com',
    willPresentView: (p) => void p.sizeClass,
  });
  if (params) void params.data;
  siftView.notifyClient('openRadarChatBot', { product: 'ondmarc' });
  siftView.publish('t', 1);
  return siftView;
}
void useIt;

// --- EmailClient is reachable as a type, not as a constructor -------------
const composer: EmailClient = controller.emailclient;
composer.goto({ threadId: 't' });
composer.close();

// --- negative assertions --------------------------------------------------
// `@ts-expect-error` fails the build when its line *stops* erroring, so these
// are what stop the declarations loosening into uselessness. Each was checked
// to fail for the stated reason, not incidentally.

// @ts-expect-error `login` requires a redirectUri
view.login({});
// @ts-expect-error `navigate` requires an href
view.navigate({});
// @ts-expect-error `showOAuthPopup` requires a provider
view.showOAuthPopup({});
// @ts-expect-error `clientOrigin` is a string or an array of strings
new SiftView({ clientOrigin: 123 });
// @ts-expect-error the package exports the EmailClient type, not a constructor
void new EmailClient();
