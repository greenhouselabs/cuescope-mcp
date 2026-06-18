/**
 * vMix client modules
 * @module clients
 */

export type {
  IVmixHttpClient,
  IVmixTcpClient,
  IVmixClient,
  TcpClientEvents,
  TcpClientStatus,
  ActivatorEvent,
  HttpClientOptions,
  TcpClientOptions,
  VmixClientOptions,
} from './types.js';

export { VmixHttpClient } from './http-client.js';
export { VmixTcpClient } from './tcp-client.js';
export { VmixClient } from './vmix-client.js';
