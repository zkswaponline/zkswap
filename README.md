# zkSwap

zkSwap is a swap interface for Robinhood Chain, for people who want to read what they are about to sign. Most swap screens show one price and one button, so the route, the allowance and the transaction itself stay out of sight. zkSwap compares quotes across venues at one block, shows the permission a route needs, decodes and simulates the exact transaction, and then your own wallet signs it directly to the venue. An optional zero-knowledge access proof lets a group open a screen to its members without a list of member wallets.

Compare. Verify. Swap. Exploring clearer swap routes, permission checks, and optional ZK-gated access.

## Read this before anything else

This repository is the working code behind https://zkswap.online.

- **Runs today.** Route comparison over Uniswap v2, v3, v4 and Pons curves, a permission check with exact approvals by default, decoded calldata with an `eth_call` simulation before the wallet prompt, and browser proving of a real Noir circuit with a group-gated desk.
- **Reads live data.** Quotes, allowances and chain readings come from Robinhood Chain through `eth_call`. Nothing on the site is a sample number; what cannot be read shows "—".
- **The contract is live.** `ZkswapAccessBook` and its verifier are on Robinhood Chain with verified source. The access screens read the book and send real transactions from your wallet.
- **An access proof does not make a swap anonymous.** On an EVM chain your address, the tokens, the amounts and your activity stay visible. The gate is at the app level: pools and routers never look at it.
- **Planned, not built:** pools that enforce a proof on chain, a developer API, and any utility for $ZKSWAP.
- **What nothing here claims.** No safety guarantee for any token or route, and no promised value for $ZKSWAP. A clean simulation describes one block. Not financial advice.

## Layout

| Path | What it is |
|---|---|
| `src/app/` | Pages and API routes (Next.js App Router). |
| `src/components/` | Interface components, including the wallet dialog and the swap and access screens. |
| `src/config/` | `brand.ts` (name, ticker, token address, links), `contracts.ts` (deployed addresses), `dex.ts` and `venues.ts` (venue facts), `assets.ts` (image paths). |
| `src/content/` | Guides, FAQ and navigation text. |
| `src/lib/swap/` | Quotes, transaction building, the decoder and the pure facts the tests cover. |
| `src/lib/zk/` | Tree, witness, prover worker and the book client. |
| `circuits/access/` | The Noir circuit, and `circuits/build.sh`, which regenerates the verifier and the browser artifact. |
| `contracts/` | Solidity sources (`src/`) and Foundry tests (`test/`). |
| `scripts/` | `verify-deployment`, the artifact builder and the prover bundler. |
| `public/` | Images, wallet and token logos, the compiled circuit and the public SRS points. |

## Run the tests

Node.js 20 or newer.

```
npm install
npm run typecheck
npm test
```

Contracts use [Foundry](https://book.getfoundry.sh/):

```
cd contracts
bash setup.sh
forge test
```

### What was checked for this snapshot

Checked on 2026-11-02 (UTC), Node.js 25.8.2, forge 1.5.1, nargo 1.0.0-beta.22, bb 5.0.0-nightly.20260522:

- `npm run typecheck`: exit 0. `npm test`: 71 pass, 0 fail, including a real proof made and verified in Node.
- `forge test`: 60 passed, 0 failed. 52 unit and fuzz tests (permission matrix, state machine, roots, nullifiers), 5 invariants, 3 with real UltraHonk proofs against the generated verifier. Line coverage of `ZkswapAccessBook`: 195 of 195.
- `nargo test` in `circuits/access`: 7 passed. `bash circuits/build.sh --check`: the verifier and the browser artifact match a fresh build.
- `npm run build`: 36 routes.
- Browser run on a local anvil chain with an injected wallet: a group created, a proof made in the browser worker, recorded through the real verifier, the gated desk opened. On a local fork of Robinhood Chain: a real ETH to USDG swap through the review flow, an exact approval, the swap back, an allowance set to zero. 21 of 21 steps passed. `verify-deployment` printed MATCH for the local deployment.

Deployed to Robinhood Chain on 2 Nov 2026: `npm run verify-deployment` prints MATCH for every contract and Blockscout shows the source as verified. Not run: creating a group or recording a proof on the live book; those flows were run on the local chain. The browser scripts are not in this repository. Slither was not run. No outside party has reviewed this code.

## Look at the site

```
npm install
npm run build
npm start
```

Open http://localhost:6040. Everything works with no configuration, on public RPC endpoints. Without `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` the wallet dialog shows WalletConnect as "Not configured on this site yet". The first proof downloads about 11 MB from this site, once.

## Contracts

| Contract | Address | Explorer |
|---|---|---|
| `ZkswapAccessBook` | `0x97e0ceec519579354279c52f1530a1d8a063fd69` | [Blockscout](https://robinhoodchain.blockscout.com/address/0x97e0ceec519579354279c52f1530a1d8a063fd69?tab=contract) |
| `ZkswapGateCheck` (generated verifier) | `0x999737ba57321588ea80d7d139b7dd1939246abe` | [Blockscout](https://robinhoodchain.blockscout.com/address/0x999737ba57321588ea80d7d139b7dd1939246abe?tab=contract) |
| `ZkswapFiatTape` (verifier library) | `0x8137fd32c0f0ac5a4c8f64a8d764e130ecfe13ce` | [Blockscout](https://robinhoodchain.blockscout.com/address/0x8137fd32c0f0ac5a4c8f64a8d764e130ecfe13ce?tab=contract) |
| `ZkswapRelationSet` (verifier library) | `0x5666e904bdd6bfd4d7b4454c586d53f03be3663b` | [Blockscout](https://robinhoodchain.blockscout.com/address/0x5666e904bdd6bfd4d7b4454c586d53f03be3663b?tab=contract) |

The book records access groups: per-group admin and curators, member entries, published roots, and a one-time tag per member per epoch. A group moves through Forming, Open, Suspended and Retired. It has no global owner, no fee and no upgrade path, holds no funds or tokens, and is never in a swap's path. It cannot check a root against its entries; the site recomputes every root in the browser and shows the result. A group is only as honest as its curator.

Rebuild the circuit and verifier with `bash circuits/build.sh` (nargo 1.0.0-beta.22, bb 5.0.0-nightly.20260522).

## Verify a deployment

```
npm run verify-deployment -- <book address> --tx <creation tx hash>
```

The script compares the bytecode on Robinhood Chain with the build in this repository and prints MATCH or the first difference.

## Add the network to your wallet

| Field | Value |
|---|---|
| Network | Robinhood Chain |
| Chain ID | 4663 |
| Currency | ETH |
| RPC | https://rpc.mainnet.chain.robinhood.com |
| Explorer | https://robinhoodchain.blockscout.com |

The site offers to add it when you connect.

## Data sources and limits

- **Robinhood Chain RPC.** All quotes, allowances, simulations and readings, through `/api/*` with per-network and site-wide budgets. The public endpoint first, then `robinhood-rpc.publicnode.com`, then `robinhood.drpc.org`.
- **GeckoTerminal public API.** Used only to find which Uniswap v4 pools a token trades in; the quote itself comes from chain. Without it, those pools are absent.
- **Quotes** hold for the block they were read at. Selling into a Pons curve is an estimate from its reserves until the allowance exists, and is labelled.
- **Permissions page** asks about the listed tokens and the venues' spenders. It does not search history, so approvals to other contracts do not appear.
- **Chain readings** on the home page are sampled since the page opened; nothing is stored. A source that does not answer shows "—".

## Token

$ZKSWAP is the community token of zkSwap on Robinhood Chain. Contract address: announced on https://zkswap.online at launch. It has no promised value. Any use of it inside the product is planned, not built; every feature works without it.

## Deploy your own

Import into a Next.js host (preset Next.js, root `./`). No variable is required.

| Variable | What it is for | Format |
|---|---|---|
| `ROBINHOOD_RPC_URL` | Server reads | https URL |
| `NEXT_PUBLIC_ROBINHOOD_RPC_URL` | Browser fallback reads | https URL |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | WalletConnect option | 32 hex characters |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | Shared rate-limit counters | https URL, token |

After the deploy, check that `/` answers 200, and `/api/chain` returns JSON. For the contracts: from `contracts/`, use `forge create` for `ZkswapFiatTape`, `ZkswapRelationSet`, `ZkswapGateCheck` (linked to both) and `ZkswapAccessBook` (constructor: the verifier address), put the addresses and block into `src/config/contracts.ts`, then run `npm run verify-deployment`.

## Contributing

Fork the repository, branch from `main`, and run `npm run typecheck`, `npm test` and `npm run build`, and `bash setup.sh && forge test` in `contracts/` before opening a pull request. For a bug, open an issue with the expected and actual behavior and minimal steps. Keep private keys, seed phrases and environment values out of issues.

## Security

Please do not open a public issue for a suspected vulnerability. Use GitHub private vulnerability reporting: open the **Security** tab of this repository and choose **Report a vulnerability**. The contracts, the circuit, the API routes and transaction building are in scope; wallets, RPC providers, explorers and venues are not. There is no bug bounty.

## Notices and license

This project's original code is released under the [MIT License](LICENSE). Self-hosted fonts: Inter, Geist Mono and Gasoek One, under the SIL Open Font License. Wallet and token logos belong to their projects and are used only to identify them. `contracts/src/ZkswapGateCheck.sol` is generated by Barretenberg (Apache-2.0). `public/zk/crs/` holds public SRS points from the Aztec Ignition ceremony. The zkSwap name, logo and artwork belong to the project and are not licensed for reuse as a brand.
