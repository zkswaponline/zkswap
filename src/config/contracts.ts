/*
 * Deployed contract addresses, in one place. Empty = practice mode: the access screens run real proofs against a group
 * kept in this browser and verify them locally, and nothing is recorded on chain. Filled = the same screens read the
 * book and send real transactions from the connected wallet.
 */
const DEPLOYED = {
  /** ZkswapAccessBook. */
  book: "0x97e0ceec519579354279c52f1530a1d8a063fd69",
  /** Chain block of its creation. */
  bookBlock: 103905911,
  /** ZkswapGateCheck, the generated verifier the book calls. */
  gate: "0x999737ba57321588ea80d7d139b7dd1939246abe",
};

/** Local end-to-end builds set this; it must never be set on a real deployment. */
function testOverride(): Partial<typeof DEPLOYED> {
  const raw = process.env.NEXT_PUBLIC_ZKSWAP_TEST_CONTRACTS;
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Partial<typeof DEPLOYED>;
  } catch {
    return {};
  }
}

export const CONTRACTS = { ...DEPLOYED, ...testOverride() };

export const bookLive = () => /^0x[0-9a-fA-F]{40}$/.test(CONTRACTS.book);
