/* tslint:disable */
/* eslint-disable */
/**
* @param {string} id 
* @param {string} password 
* @returns {GroupWrapper} 
*/
export function start(id: string, password: string): GroupWrapper;
/**
* @param {GroupWrapper} wrapper 
* @returns {Uint8Array} 
*/
export function msg(wrapper: GroupWrapper): Uint8Array;
/**
* @param {GroupWrapper} wrapper 
* @param {Uint8Array} inbound 
* @returns {Uint8Array} 
*/
export function finish(wrapper: GroupWrapper, inbound: Uint8Array): Uint8Array;
/**
*/
export class GroupWrapper {
  free(): void;
}

/**
* If `module_or_path` is {RequestInfo}, makes a request and
* for everything else, calls `WebAssembly.instantiate` directly.
*
* @param {RequestInfo | BufferSource | WebAssembly.Module} module_or_path
*
* @returns {Promise<any>}
*/
export default function init (module_or_path?: RequestInfo | BufferSource | WebAssembly.Module): Promise<any>;
        