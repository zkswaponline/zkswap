"use client";

import { useChain } from "@/components/providers/ChainProvider";
import { BRAND, TOKEN, buyUrl, explorerToken, tokenChartUrl, isAddress, LAUNCHPAD } from "@/config/brand";

const fmt = (raw: string | null | undefined, d: number | null | undefined) => {
  if (!raw || d == null) return "—";
  return Math.round(Number(BigInt(raw) / 10n ** BigInt(Math.max(0, d - 2))) / 100).toLocaleString("en-US");
};

/** Live facts of the token: nothing before launch, and only what the token contract itself answers after it. */
export function TokenLive() {
  const { snap } = useChain();
  const t = snap?.token;
  const chart = tokenChartUrl();
  return (
    <dl data-testid="token-live">
      <div className="kv">
        <dt>Name</dt>
        <dd>{t?.name ?? BRAND.name}</dd>
      </div>
      <div className="kv">
        <dt>Symbol</dt>
        <dd>{t?.symbol ?? BRAND.ticker}</dd>
      </div>
      <div className="kv">
        <dt>Supply</dt>
        <dd>{fmt(t?.supply, t?.decimals)}</dd>
      </div>
      <div className="kv">
        <dt>Launchpad</dt>
        <dd>
          <a className="link" href={buyUrl()} target="_blank" rel="noreferrer" data-testid="buy-link">
            {LAUNCHPAD.name} {TOKEN.isLive ? "" : "(at launch)"}
          </a>
        </dd>
      </div>
      <div className="kv">
        <dt>Explorer</dt>
        <dd>
          {isAddress(BRAND.ca) ? (
            <a className="link" href={explorerToken(BRAND.ca)} target="_blank" rel="noreferrer">
              Blockscout
            </a>
          ) : (
            "At launch"
          )}
        </dd>
      </div>
      <div className="kv">
        <dt>Chart</dt>
        <dd>
          {chart ? (
            <a className="link" href={chart} target="_blank" rel="noreferrer">
              DEXTools
            </a>
          ) : (
            "At launch"
          )}
        </dd>
      </div>
    </dl>
  );
}
