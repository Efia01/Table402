import { useState } from 'react';
import { shortAddress } from '../lib/wallet';

const EXPLORER = 'https://explore.testnet.tempo.xyz';

/**
 * A click-to-copy address chip: shows the shortened address, copies the FULL
 * address to the clipboard on click, and links to the Tempo explorer.
 */
export function CopyAddress({
  address,
  label,
  showExplorer = true,
}: {
  address: string;
  label?: string;
  showExplorer?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(address);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = address;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
      } catch {
        /* ignore */
      }
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      {label && (
        <span className="font-mono text-[10px] uppercase tracking-widest2 text-bone-faint">{label}</span>
      )}
      <button
        onClick={() => void copy()}
        title={`Copy ${address}`}
        className="stat-num inline-flex items-center gap-1.5 rounded-[3px] px-1.5 py-0.5 text-sm text-bone transition hover:bg-noir-700/60"
      >
        {shortAddress(address)}
        <span className="text-bone-faint">{copied ? '✓' : '⧉'}</span>
      </button>
      {showExplorer && (
        <a
          href={`${EXPLORER}/address/${address}`}
          target="_blank"
          rel="noreferrer"
          title="View on Tempo explorer"
          className="text-bone-faint transition hover:text-crimson-bright"
        >
          ↗
        </a>
      )}
      {copied && <span className="text-[10px] uppercase tracking-widest2 text-emerald-400">copied</span>}
    </span>
  );
}
