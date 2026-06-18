/**
 * Resource count metadata. Derived lazily from the registry so it never drifts
 * from the real resource list. `allResources` is only dereferenced at call time,
 * which sidesteps the resources/index <-> resource-module circular import.
 */

import { allResources } from './index.js';

export function getResourceCount(): number {
  return allResources.length;
}
