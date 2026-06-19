import { QRCodeSVG } from 'qrcode.react';

export function JoinQR({ tableId, size = 150 }: { tableId: string; size?: number }) {
  const url = `${location.origin}/join-live?table=${encodeURIComponent(tableId)}`;
  return (
    <div className="glass flex flex-col items-center gap-3 px-5 py-5 text-center">
      <span className="font-mono text-[10px] uppercase tracking-widest3 text-crimson-bright">
        Scan to join live
      </span>
      <div className="rounded-[4px] bg-paper p-3">
        <QRCodeSVG value={url} size={size} bgColor="#f5efe4" fgColor="#13110f" level="M" />
      </div>
      <span className="max-w-[12rem] break-all text-[10px] text-bone-faint">
        Sign the 402 seat fee from your phone
      </span>
    </div>
  );
}
