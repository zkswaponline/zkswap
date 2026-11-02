/*
 * Node prover for the tests and the contract tests (forge ffi). Uses the same circuit artifact as the browser
 * (public/zk/access.json), so a proof made here is checked by the same verifier as a proof made in a visitor's tab.
 */
import { readFileSync } from "node:fs";
import { Noir } from "@noir-lang/noir_js";
import { Barretenberg, UltraHonkBackend } from "@aztec/bb.js";
import { accessWitness, bytesToHex, publicInputsOf, type AccessInputs, type AccessRequest } from "./core.ts";

const CIRCUIT = JSON.parse(readFileSync(new URL("../../../public/zk/access.json", import.meta.url), "utf8"));

let ready: Promise<{ noir: Noir; backend: UltraHonkBackend; api: Barretenberg }> | null = null;

function init(threads = 4) {
  ready ??= (async () => {
    const api = await Barretenberg.new({ threads });
    return { noir: new Noir(CIRCUIT), backend: new UltraHonkBackend(CIRCUIT.bytecode, api), api };
  })();
  return ready;
}

export type AccessProof = { proof: string; publicInputs: string[]; inputs: AccessInputs; index: number; ms: number };

export async function proveAccess(request: AccessRequest): Promise<AccessProof> {
  const { witness, inputs, index } = accessWitness(request);
  const { noir, backend } = await init();
  const started = Date.now();
  const { witness: solved } = await noir.execute(witness);
  const { proof, publicInputs } = await backend.generateProof(solved, { verifierTarget: "evm" });
  return { proof: `0x${bytesToHex(proof)}`, publicInputs, inputs, index, ms: Date.now() - started };
}

export async function verifyAccess(proof: string, inputs: AccessInputs) {
  const { backend } = await init();
  const bytes = Uint8Array.from(Buffer.from(proof.replace(/^0x/, ""), "hex"));
  return backend.verifyProof({ proof: bytes, publicInputs: publicInputsOf(inputs) }, { verifierTarget: "evm" });
}

export async function closeProver() {
  if (!ready) return;
  const { api } = await ready;
  await api.destroy();
  ready = null;
}
