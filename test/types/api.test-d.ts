// Compile-time exercise of the public surface. Not run — `tsc --noEmit` over
// this file is the assertion: if a declaration drifts from the JS, this fails.
import {
  createSiftController,
  createSiftView,
  LoadViewResult,
  PresentViewParams,
  SiftController,
  SiftView,
} from '../../types/index';
import { useSiftView } from '../../types/react';

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
