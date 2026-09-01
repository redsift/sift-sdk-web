/**
 * Type declarations for @redsift/sift-sdk-web/react.
 *
 * The hook equivalent of {@link SiftView}: same protocol, same origin and
 * dispatch policy, but the client's `presentView` params arrive as state so a
 * React tree re-renders on them.
 */
import {
  NavigateRequest,
  OAuthPopupRequest,
  Observable,
  PresentViewParams,
  SetupSyncHistoryRequest,
  SiftPluginId,
} from './index';

export interface UseSiftViewProps {
  /** Called when the client sends `willPresentView`. Always the latest one. */
  willPresentView?: (params: PresentViewParams) => void;
  /** See `SiftViewOptions.clientOrigin` — same rules. */
  clientOrigin?: string | string[];
}

/**
 * The view API the hook returns. Stable across renders, so it is safe in
 * dependency arrays.
 */
export interface SiftViewApi {
  /** Messages the controller published to this view. */
  controller: Observable;
  /** Relays a message to the sift's controller, via the client. */
  publish(topic: string, value?: unknown): void;
  /** Sends a topic the client itself acts on. Applies the origin pinning. */
  notifyClient(topic: string, value?: unknown): void;
  showOAuthPopup(request: OAuthPopupRequest): void;
  removeOAuthIdentity(request: OAuthPopupRequest): void;
  signup(): void;
  login(request: { redirectUri: string }): void;
  logout(): void;
  navigate(request: NavigateRequest): void;
  /** Requires the `sync-history` plugin to be enabled by the client. */
  setupSyncHistory(request: SetupSyncHistoryRequest): void;
  getPlugin<P = unknown>(request: { id: SiftPluginId | string }): P | undefined;
}

/**
 * Registers the view's message listener for the life of the component, and
 * stops any plugins it started on unmount.
 *
 * @returns `[params, siftView]` — `params` is `null` until the client sends
 * `presentView`, then the params it sent.
 */
export function useSiftView(
  props?: UseSiftViewProps
): [PresentViewParams | null, SiftViewApi];
