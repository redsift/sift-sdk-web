/**
 * Type declarations for @redsift/sift-sdk-web.
 *
 * A sift is two halves talking over postMessage, brokered by the client that
 * embeds it (the Red Sift Cloud shell):
 *
 *   - a **view**, an iframe page, built on {@link SiftView};
 *   - a **controller**, a Web Worker, built on {@link SiftController}.
 *
 * The client drives the lifecycle: it posts `init` then `loadView` to the
 * controller, and `presentView` to the view once the controller answers. The
 * view talks back with {@link SiftView.notifyClient} (topics the client acts
 * on) and {@link SiftView.publish} (messages relayed to the controller).
 */

/** Minimal shape of @redsift/observable, which ships no types of its own. */
export interface Observable<T = unknown> {
  subscribe(topic: string | string[], observer: (message: T) => void): void;
  unsubscribe(topic: string | string[], observer: (message: T) => void): void;
  unsubscribeAll(topic: string): void;
  publish(topic: string | string[], message?: T): void;
}

/** Ids of the plugins the SDK ships. The client decides which are enabled. */
export type SiftPluginId = 'sync-history' | 'track-ui-activity';

export interface SiftViewOptions {
  /**
   * Origin(s) of the client embedding this view. Outbound messages are posted
   * only to it and inbound messages are accepted only from it.
   *
   * Omit it and the SDK works the origin out itself — `location.ancestorOrigins`
   * where available, else `document.referrer` — falling back to the legacy
   * accept-any behaviour with a warning when neither is usable. Pass it
   * explicitly if the view ever navigates in-frame, since a referrer goes
   * stale after that. Pass `'*'` to opt back into the legacy behaviour.
   *
   * A value that yields no valid origin throws, rather than silently
   * downgrading to discovery.
   */
  clientOrigin?: string | string[];
}

/** Params the client sends with `presentView`. */
export interface PresentViewParams {
  client?: string;
  type?: string;
  sizeClass?: string;
  /** Whatever the controller's `loadView` resolved, plus the client's own data. */
  data?: unknown;
  [key: string]: unknown;
}

export interface OAuthPopupRequest {
  provider: string;
  /**
   * Passed through to the client. An `email` here is replaced by `subject`, a
   * truncated SHA-256 of it, so the raw address does not travel through the
   * redirect chain.
   */
  options?: ({ email?: string } & Record<string, unknown>) | null;
}

export interface NavigateRequest {
  href: string;
  openInNewTab?: boolean;
}

/** A history object compatible with the `sync-history` plugin. */
export interface SyncHistoryLike {
  listen(listener: (...args: never[]) => void): (() => void) | void;
  push(path: string): void;
  replace(path: string): void;
}

export interface SetupSyncHistoryRequest {
  history: SyncHistoryLike;
  initialPath?: string | null;
}

/**
 * Base class for a sift's view. Subclass it, or use {@link createSiftView},
 * and implement the lifecycle hooks the client calls.
 */
export class SiftView {
  constructor(options?: SiftViewOptions);

  /** Messages the controller published to this view. */
  readonly controller: Observable;

  /** Relays a message to the sift's controller, via the client. */
  publish(topic: string, value?: unknown): void;

  /**
   * Sends a topic the client itself acts on (OAuth, billing, navigation,
   * anything the shell owns). Prefer this over reaching for internals: it is
   * what applies the origin pinning.
   */
  notifyClient(topic: string, value?: unknown): void;

  /** Removes the window message listener and stops any active plugins. */
  destroy(): void;

  showOAuthPopup(request: OAuthPopupRequest): void;
  removeOAuthIdentity(request: OAuthPopupRequest): void;
  signup(): void;
  login(request: { redirectUri: string }): void;
  logout(): void;
  navigate(request: NavigateRequest): void;

  /** Requires the `sync-history` plugin to be enabled by the client. */
  setupSyncHistory(request: SetupSyncHistoryRequest): void;

  getPlugin<P = unknown>(request: { id: SiftPluginId | string }): P | undefined;

  /** Called by the client with the data the controller loaded. Implement it. */
  presentView?(params: PresentViewParams): void;

  /** Called by the client before `presentView`. Optional. */
  willPresentView?(params: PresentViewParams): void;
}

/** What a controller's `loadView` may return. */
export interface LoadViewResult {
  /** Path to the view's HTML, relative to the sift's web root. */
  html?: string;
  /** Data for the view, or a promise of it. */
  data?: unknown | Promise<unknown>;
}

export interface LoadViewRequest {
  sizeClass?: string;
  type?: string;
  params?: unknown;
}

/** Per-sift storage, mirroring @redsift/rs-storage and observable on changes. */
export class SiftStorage implements Observable {
  init(storage: unknown): void;
  get(query: unknown): Promise<unknown>;
  getIndexKeys(query: unknown): Promise<unknown>;
  getIndex(query: unknown): Promise<unknown>;
  getWithIndex(query: unknown): Promise<unknown>;
  getAllKeys(query: unknown): Promise<unknown>;
  getAll(query: unknown): Promise<unknown>;
  getUser(query: unknown): Promise<unknown>;
  putUser(query: unknown): Promise<unknown>;
  delUser(query: unknown): Promise<unknown>;
  /** Subscribe to `'*'` for every bucket, or to a bucket name. */
  subscribe(topic: string | string[], observer: (message: unknown) => void): void;
  unsubscribe(topic: string | string[], observer: (message: unknown) => void): void;
  unsubscribeAll(topic: string): void;
  publish(topic: string | string[], message?: unknown): void;
}

export class EmailClient implements Observable {
  goto(params?: unknown): void;
  close(): void;
  subscribe(topic: string | string[], observer: (message: unknown) => void): void;
  unsubscribe(topic: string | string[], observer: (message: unknown) => void): void;
  unsubscribeAll(topic: string): void;
  publish(topic: string | string[], message?: unknown): void;
}

/**
 * Base class for a sift's controller, which runs in a Web Worker. Subclass it,
 * or use {@link createSiftController}, and implement `loadView`.
 */
export class SiftController {
  constructor();

  /** Messages the view published to this controller. */
  readonly view: Observable;
  readonly emailclient: EmailClient;
  /** Available once the client's `init` message has been handled. */
  readonly storage: SiftStorage;

  /** Relays a message to the sift's view, via the client. */
  publish(topic: string, value?: unknown): void;

  /**
   * Called by the client to load a view. Implement it. Returning nothing, or
   * a `data` promise that rejects, reports `loadViewFailedCallback` to the
   * client rather than leaving the view waiting.
   */
  loadView?(request: LoadViewRequest): LoadViewResult;
}

/** Controller for email-client integrations. */
export class EmailClientController {
  constructor();
  onstats?(name: string, value: unknown): void;
  loadThreadListView?(list: unknown, supportedTemplates: unknown): unknown;
}

export function createSiftView<T extends object>(
  instanceMethods: T,
  options?: SiftViewOptions
): SiftView & T;

export function createSiftController<T extends object>(
  instanceMethods: T,
  options?: unknown
): SiftController & T;

export function createEmailClientController<T extends object>(
  instanceMethods: T,
  options?: unknown
): EmailClientController & T;

/** @deprecated No-ops kept for backwards compatibility; they only log. */
export function registerSiftView(siftView?: unknown): void;
/** @deprecated No-ops kept for backwards compatibility; they only log. */
export function registerSiftController(siftController?: unknown): void;
/** @deprecated No-ops kept for backwards compatibility; they only log. */
export function registerEmailClientController(controller?: unknown): void;
