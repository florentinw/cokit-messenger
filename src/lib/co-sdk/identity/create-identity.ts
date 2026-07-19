import {
  createIdentity as sdkCreateIdentity,
} from "@1io/tauri-plugin-co-sdk";
import { assertTauriRuntime } from "@/lib/co-sdk/co";

/**
 * Create (or return) a named did:key identity in the local keystore.
 *
 * @param name - Keystore entry name (e.g. `"messenger-identity"`)
 * @param seed - Optional entropy for deterministic key generation
 * @returns did:key string for the identity
 */
export async function createIdentity(name: string, seed?: Uint8Array): Promise<string> {
  assertTauriRuntime();
  return await sdkCreateIdentity(name, seed);
}
