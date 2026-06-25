'use client';

import { useState, useEffect, useRef } from 'react';
import { useAccount, useReadContract } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Providers } from './providers';

const CLAWD_GATE = '0xc22B7b983EC81523c969753c2385106835E8CfCE' as const;
const CLAWD_GATE_ABI = [{
  name: 'hasAccess',
  type: 'function',
  inputs: [{ name: 'wallet', type: 'address' }, { name: 'tier', type: 'uint8' }],
  outputs: [{ type: 'bool' }],
  stateMutability: 'view',
}] as const;

const FREE_LIMIT = 2;

const LABELS: Record<string, string> = {
  '0x3154cf16ccdb4c6d922629664174b904d80f2c35': 'Base Bridge',
  '0x4200000000000000000000000000000000000006': 'WETH',
  '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913': 'USDC',
  '0x2626664c2603336e57b271c5c0b26f421741e481': 'Uniswap V3 Router',
  '0x000000000000000000000000000000000000dead': 'Burn Address',
  '0x4c0c863aa884b8d8e0b25f2e27b9d30a81a35e0e': 'Aerodrome Router',
  '0xaaa87963efeb6f7e0a2711f397663105acb1805e': 'Aerodrome Pool',
  '0x6921b130d297cc43754afba22e5eac0fbf8db75b': 'Base Bridge Official',
  '0x19793c7824be70ec58bb673ca42d2779d12581be': 'Moonwell',
  '0x23a491f5c05e8f748cc97bab3d738f2d93ff6e01': 'Polymarket',
  '0xdef1c0ded9bec7f1a1670819833240f027b25eff': '0x Exchange',
  '0x1231deb6f5749ef6ce6943a275a1d3e7486f4eae': 'LI.FI Router',
};

const LEGIT_ASSETS = new Set(['ETH', 'WETH', 'USDC', 'USDT', 'DAI', 'cbETH', 'wstETH']);

function labelAddr(addr: string) {
  if (!addr) return '?';
  return LABELS[addr.toLowerCase()] || (addr.slice(0, 6) + '…' + addr.slice(-4));
}

function blockToDate(blockHex: string) {
  try {
    const block = parseInt(blockHex, 16);
    const baseGenesis = new Date('2023-08-09T00:00:00Z').getTime();
    const ms = baseGenesis + block * 2000;
    return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch { return 'Unknown date'; }
}

function scoreTransfer(t: any) {
  let s = 0;
  if (LABELS[(t.from || '').toLowerCase()]) s += 25;
  if (LABELS[(t.to || '').toLowerCase()]) s += 25;
  const v = parseFloat(t.value || 0);
  if (v > 100) s += 20;
  if (v > 1000) s += 20;
  if (t.asset && t.asset !== 'ETH') s += 10;
  s += Math.random() * 5;
  return s;
}

function isAirdrop(t: any, filterOn: boolean) {
  if (!filterOn) return false;
  const v = parseFloat(t.value || 0);
  const asset = t.asset || '';
  if (LEGIT_ASSETS.has(asset)) return false;
  if (LABELS[(t.from || '').toLowerCase()]) return false;
  return v < 0.0001;
}

const D = {
  bg: '#080808',
  cardBg: '#111111',
  border: '#1E1E1E',
  text: '#F0EBE0',
  sub: '#3A3A3A',
  placeholder: '#252525',
  accent: '#00D4C8',
  orange: '#C45C26',
  orangeHover: '#D96A30',
  storyText: '#D4C8A8',
  evText: '#555555',
  addrBg: '#1A1A1A',
  foot: '#282828',
  demoColor: '#383838',
  mutedText: '#404040',
};

const L = {
  bg: '#F5F5F2',
  cardBg: '#FFFFFF',
  border: '#E0E0DC',
  text: '#1A1A1A',
  sub: '#888888',
  placeholder: '#BBBBBB',
  accent: '#007A74',
  orange: '#C45C26',
  orangeHover: '#D96A30',
  storyText: '#2A2A2A',
  evText: '#555555',
  addrBg: '#F0F0EC',
  foot: '#AAAAAA',
  demoColor: '#888888',
  mutedText: '#BBBBBB',
};

function App() {
  const [dark, setDark] = useState(true);
  const [walletInput, setWalletInput] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [filterAirdrops, setFilterAirdrops] = useState(false);
  const [useCount, setUseCount] = useState(0);
  const [showGate, setShowGate] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [titleText, setTitleText] = useState('');
  const [showCursor, setShowCursor] = useState(true);
  const [shareLabel, setShareLabel] = useState('Share');
  const [pupilX, setPupilX] = useState(0);
  const [pupilY, setPupilY] = useState(0);
  const eyeRef = useRef<SVGSVGElement>(null);
  const storyRef = useRef<HTMLParagraphElement>(null);

  const v = dark ? D : L;

  const { address, isConnected } = useAccount();
  const { data: hasAccess } = useReadContract({
    address: CLAWD_GATE,
    abi: CLAWD_GATE_ABI,
    functionName: 'hasAccess',
    args: address ? [address, 1] : undefined,
    chainId: 8453,
    query: { enabled: !!address },
  });

  const isUnlocked = isConnected && Boolean(hasAccess);

  useEffect(() => {
    const stored = parseInt(localStorage.getItem('ist_uses') || '0');
    setUseCount(stored);
  }, []);

  useEffect(() => {
    if (isUnlocked && showGate) setShowGate(false);
  }, [isUnlocked, showGate]);

  // Typewriter
  useEffect(() => {
    const TITLE = "I've Seen Things";
    let i = 0;
    const type = () => {
      if (i <= TITLE.length) {
        setTitleText(TITLE.slice(0, i));
        i++;
        setTimeout(type, i === 1 ? 400 : 55 + Math.random() * 40);
      } else {
        setTimeout(() => setShowCursor(false), 1800);
      }
    };
    setTimeout(type, 400);
  }, []);

  // Eye tracking — fixed to top right corner
  useEffect(() => {
    function handleMouseMove(e: MouseEvent) {
      if (!eyeRef.current) return;
      const rect = eyeRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const dx = e.clientX - centerX;
      const dy = e.clientY - centerY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const maxMove = 3.5;
      const px = dist > 0 ? (dx / dist) * Math.min(dist / 15, maxMove) : 0;
      const py = dist > 0 ? (dy / dist) * Math.min(dist / 15, maxMove) : 0;
      setPupilX(px);
      setPupilY(py);
    }
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const isGated = !isUnlocked && useCount >= FREE_LIMIT;

  function typeStory(text: string) {
    if (!storyRef.current) return;
    storyRef.current.textContent = '';
    let i = 0;
    const chars = text.split('');
    function tick() {
      if (!storyRef.current) return;
      if (i < chars.length) {
        storyRef.current.textContent += chars[i++];
        setTimeout(tick, 18);
      }
    }
    setTimeout(tick, 400);
  }

  async function handleTrace() {
    if (isGated) { setShowGate(true); return; }
    const addr = walletInput.trim();
    if (!/^0x[0-9a-fA-F]{40}$/.test(addr)) {
      setError('Please enter a valid Base wallet address (0x...)');
      return;
    }
    setError(''); setResult(null); setLoading(true);
    setStatus('Scanning transfer history via Alchemy…');
    try {
      const res = await fetch('/api/trace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: addr }),
      });
      const json = await res.json();
      let transfers: any[] = json.result?.transfers || [];
      if (!transfers.length) {
        setStatus(''); setError('No transfers found. Try a different wallet.'); setLoading(false); return;
      }
      const filtered = transfers.filter(t => !isAirdrop(t, filterAirdrops));
      const workingSet = filtered.length > 0 ? filtered : transfers;
      setStatus('Picking the most interesting coin…');
      await new Promise(r => setTimeout(r, 300));
      const sorted = [...workingSet].sort((a, b) => scoreTransfer(b) - scoreTransfer(a));
      const top = sorted[0];
      const topTokenTransfers = workingSet.filter(t => t.asset === top.asset);
      const events = topTokenTransfers.slice(0, 6).map(t => ({
        from: t.from, to: t.to,
        asset: t.asset || '?',
        value: parseFloat(t.value || 0).toFixed(4),
        block: t.blockNum,
        date: blockToDate(t.blockNum),
      }));
      setStatus('Writing the story…');
      const eventSummary = events.map(e =>
        `  ${e.asset} from ${labelAddr(e.from)} → ${labelAddr(e.to)}, value: ${e.value}, block: ${e.block}`
      ).join('\n');
      const prompt = `You are writing a short, dramatic, first-person biography of a crypto token on Base blockchain — told from the token's perspective. The tone should be darkly comedic, world-weary, and vivid. The coin has been through it — gambling, degen trades, MEV bots, shady wallets, bridges, swaps. It has seen things and has feelings about them. Reference real on-chain events from the data below.

Wallet: ${addr}
Top token: ${top.asset || 'ETH'}
Recent inbound transfers:
${eventSummary}

Write 4-6 sentences. First person. No markdown. Gambling and chaos should feature prominently if the data supports it. Make it feel like the coin lived a full, chaotic life before landing here. End with dark humor or quiet resignation. Be specific — name Uniswap, Aerodrome, Base Bridge etc. where relevant.`;

      const storyRes = await fetch('/api/story', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      const storyData = await storyRes.json();
      const story = storyData.content?.[0]?.text || 'Story unavailable.';

      if (!isUnlocked) {
        const newCount = useCount + 1;
        setUseCount(newCount);
        localStorage.setItem('ist_uses', String(newCount));
        if (newCount >= FREE_LIMIT) setTimeout(() => setShowGate(true), 800);
      }

      setResult({ top, events, story, total: workingSet.length });
      setStatus('');
      setTimeout(() => typeStory(story), 100);
    } catch (e: any) {
      setStatus(''); setError('Error: ' + (e.message || 'Something went wrong.'));
    }
    setLoading(false);
  }

  async function handleShare() {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({
          title: "I've Seen Things",
          text: result?.top ? `${result.top.asset} has a story. Find yours.` : "Every wallet holds one coin that's seen things.",
          url,
        });
      } else {
        await navigator.clipboard.writeText(url);
        setShareLabel('Copied!');
        setTimeout(() => setShareLabel('Share'), 1800);
      }
    } catch { }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: v.bg,
      color: v.text,
      fontFamily: "'Space Mono', monospace",
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem',
      position: 'relative',
      overflowX: 'hidden',
      transition: 'background 0.3s, color 0.3s',
    }}>

      {/* Film grain */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 9999,
        opacity: dark ? 0.04 : 0.02,
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        backgroundSize: '128px 128px',
      }} />

      {/* Vignette */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 9998,
        background: dark
          ? 'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.8) 100%)'
          : 'radial-gradient(ellipse at center, transparent 50%, rgba(200,200,190,0.3) 100%)',
      }} />

      {/* Eye — fixed top right corner, tracks mouse */}
      <div style={{ position: 'fixed', top: 28, right: 32, zIndex: 9997 }}>
        <svg
          ref={eyeRef}
          width="44" height="28" viewBox="0 0 44 28" fill="none"
          style={{ opacity: dark ? 0.65 : 0.4, display: 'block' }}
        >
          <path d="M1 14 C11 2, 33 2, 43 14 C33 26, 11 26, 1 14 Z"
            stroke={v.text} strokeWidth="1.2" fill="none" />
          <circle cx={22 + pupilX} cy={14 + pupilY} r="6.5"
            stroke={v.text} strokeWidth="1" fill="none" />
          <circle cx={22 + pupilX} cy={14 + pupilY} r="2.8" fill={v.text} />
        </svg>
      </div>

      <div style={{ maxWidth: 680, width: '100%', position: 'relative', zIndex: 1 }}>

        {/* Top bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2.5rem' }}>
          <div>
            {/* Title */}
            <h1 style={{
              fontFamily: "'Libre Baskerville', serif", fontStyle: 'italic',
              fontSize: 38, color: v.text, lineHeight: 1, marginBottom: 10, minHeight: 46,
            }}>
              {titleText}
              {showCursor && (
                <span style={{
                  display: 'inline-block', width: 2, height: '0.85em',
                  background: v.orange, marginLeft: 2, verticalAlign: 'middle',
                  animation: 'blink 1s step-end infinite',
                }} />
              )}
            </h1>
            {/* Subtitle — option 1 only, no mechanic line */}
            <p style={{
              fontFamily: "'Libre Baskerville', serif", fontStyle: 'italic',
              fontSize: 13, color: v.sub, lineHeight: 1.65, margin: 0,
            }}>
              Every wallet holds one coin that's seen things. We find it and it tells you everything.
            </p>
          </div>
          {/* Light toggle */}
          <button onClick={() => setDark(d => !d)} style={{
            background: 'transparent', border: `1px solid ${v.border}`,
            borderRadius: 4, color: v.mutedText, fontFamily: "'Space Mono', monospace",
            fontSize: 10, padding: '7px 11px', cursor: 'pointer', flexShrink: 0,
            marginLeft: '1rem', marginTop: 4, letterSpacing: '0.05em',
          }}>
            {dark ? '☀ Light' : '☾ Dark'}
          </button>
        </div>

        {/* Input row */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
          <input
            value={walletInput}
            onChange={e => setWalletInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleTrace()}
            placeholder="Paste a Base wallet address (0x...)"
            disabled={loading}
            style={{
              flex: 1, background: v.cardBg, border: `1px solid ${v.border}`,
              borderRadius: 4, color: v.text, fontFamily: "'Space Mono', monospace",
              fontSize: 12, padding: '12px 16px', outline: 'none',
              transition: 'border-color 0.2s',
            }}
          />
          <button onClick={handleTrace} disabled={loading} style={{
            background: v.orange, border: 'none', borderRadius: 4,
            color: '#F0E8D8', fontFamily: "'Space Mono', monospace",
            fontSize: 12, padding: '12px 24px', cursor: loading ? 'not-allowed' : 'pointer',
            fontWeight: 700, letterSpacing: '0.06em', opacity: loading ? 0.6 : 1,
          }}>
            {loading ? 'Tracing…' : 'Trace'}
          </button>
        </div>

        {/* Controls row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.75rem', flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 10, color: v.sub }}>try:</span>
            {[
              ['0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045', 'vitalik.eth'],
              ['0x4838B106FCe9647Bdf1E7877BF73cE8B0BAD5f97', 'hayden.eth'],
              ['0x3cd751e6b0078be393132286c442345e5dc49699', 'coinbase hot wallet'],
            ].map(([addr, label]) => (
              <button key={addr} onClick={() => setWalletInput(addr)} style={{
                background: 'transparent', border: `1px solid ${v.border}`, borderRadius: 3,
                color: v.demoColor, fontFamily: "'Space Mono', monospace",
                fontSize: 10, padding: '3px 9px', cursor: 'pointer',
              }}>
                {label}
              </button>
            ))}
            <button onClick={() => setFilterAirdrops(f => !f)} style={{
              background: filterAirdrops ? 'rgba(0,212,200,0.06)' : 'transparent',
              border: `1px solid ${filterAirdrops ? v.accent : v.border}`,
              borderRadius: 3, color: filterAirdrops ? v.accent : v.sub,
              fontFamily: "'Space Mono', monospace", fontSize: 9,
              padding: '3px 9px', cursor: 'pointer', letterSpacing: '0.04em', textTransform: 'uppercase',
            }}>
              {filterAirdrops ? 'airdrops hidden' : 'hide airdrops'}
            </button>
          </div>
          {!isUnlocked && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 9, color: v.foot, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Free traces</span>
              <div style={{ display: 'flex', gap: 4 }}>
                {[1, 2].map(n => (
                  <div key={n} style={{
                    width: 6, height: 6, borderRadius: '50%',
                    border: `1px solid ${useCount >= n ? v.orange : v.border}`,
                    background: useCount >= n ? v.orange : 'transparent',
                    transition: 'all 0.3s',
                  }} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Gate */}
        {showGate && (
          <div style={{
            background: v.cardBg, border: `1px solid ${v.border}`,
            borderRadius: 6, padding: '1.5rem', marginBottom: '1rem',
            animation: 'fadeUp 0.4s ease',
          }}>
            <p style={{
              fontFamily: "'Libre Baskerville', serif", fontStyle: 'italic',
              fontSize: 15, color: v.text, marginBottom: 6,
            }}>
              Want to see more?
            </p>
            <p style={{ fontSize: 11, color: v.sub, marginBottom: '1rem', lineHeight: 1.7 }}>
              Show me 10,000,000 CLAWD in your wallet and I'll show you everything.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
              <ConnectButton />
            </div>
            {isConnected && !hasAccess && (
              <p style={{ fontSize: 10, color: v.orange, marginTop: 10 }}>
                Wallet connected but insufficient CLAWD balance. Required: 10,000,000.
              </p>
            )}
          </div>
        )}

        {/* Status / error */}
        {status && (
          <p style={{ fontSize: 11, color: v.accent, minHeight: 16, marginBottom: 4 }}>
            <span style={{
              display: 'inline-block', width: 9, height: 9,
              border: `1px solid transparent`, borderTopColor: v.accent,
              borderRadius: '50%', animation: 'spin 0.7s linear infinite',
              marginRight: 6, verticalAlign: 'middle',
            }} />
            {status}
          </p>
        )}
        {error && <p style={{ color: v.orange, fontSize: 11, marginBottom: 6 }}>{error}</p>}

        {/* Result card */}
        {result && (
          <div style={{
            background: v.cardBg, border: `1px solid ${v.border}`,
            borderRadius: 6, padding: '1.5rem', marginTop: '1.25rem',
            animation: 'developPhoto 1.2s ease forwards',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
              <div>
                <p style={{ fontSize: 9, color: v.sub, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 4 }}>
                  Most Interesting Token Found
                </p>
                <p style={{
                  fontSize: 22, color: v.accent, fontWeight: 700, marginBottom: 4,
                  fontFamily: "'Libre Baskerville', serif", fontStyle: 'italic',
                }}>
                  {result.top.asset || 'ETH'}
                </p>
                <p style={{ fontSize: 10, color: v.foot }}>
                  {result.total} transfers found · Most recent from {labelAddr(result.top.from)}
                </p>
              </div>
              <button onClick={handleShare} style={{
                background: 'transparent',
                border: `1px solid ${shareLabel === 'Copied!' ? v.accent : v.border}`,
                borderRadius: 4, color: shareLabel === 'Copied!' ? v.accent : v.foot,
                fontFamily: "'Space Mono', monospace", fontSize: 9,
                padding: '5px 10px', cursor: 'pointer', letterSpacing: '0.05em',
                textTransform: 'uppercase', flexShrink: 0,
              }}>
                {shareLabel}
              </button>
            </div>

            <p ref={storyRef} style={{
              fontFamily: "'Libre Baskerville', serif", fontStyle: 'italic',
              fontSize: 15, lineHeight: 2, color: v.storyText,
              borderLeft: `2px solid ${v.orange}`, paddingLeft: '1.25rem',
              marginTop: '1.25rem',
            }} />

            <hr style={{ border: 'none', borderTop: `1px solid ${v.border}`, margin: '1.25rem 0' }} />

            <p style={{ fontSize: 9, color: v.foot, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 14 }}>
              Transfer trail
            </p>

            {result.events.map((e: any, i: number) => {
              const dotColors = [v.accent, '#C4962A', v.orange];
              return (
                <div key={i} style={{ display: 'flex', gap: 12, marginBottom: 12, alignItems: 'flex-start' }}>
                  <div style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: dotColors[i % 3], marginTop: 5, flexShrink: 0,
                  }} />
                  <div>
                    <div style={{ fontSize: 10, color: v.foot, marginBottom: 3, fontStyle: 'italic' }}>
                      {e.date} &nbsp;·&nbsp; {e.asset} {e.value}
                    </div>
                    <div style={{ fontSize: 11, color: v.evText, lineHeight: 1.6 }}>
                      <span style={{ fontSize: 10, background: v.addrBg, color: v.accent, borderRadius: 2, padding: '1px 5px' }}>
                        {labelAddr(e.from)}
                      </span>
                      <span style={{ color: v.foot, margin: '0 6px' }}>→</span>
                      <span style={{ fontSize: 10, background: v.addrBg, color: v.accent, borderRadius: 2, padding: '1px 5px' }}>
                        {labelAddr(e.to)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}

            <p style={{ fontSize: 9, color: v.foot, marginTop: '1.25rem', lineHeight: 1.8, letterSpacing: '0.02em' }}>
              Transfer history via Alchemy &nbsp;·&nbsp; Base mainnet &nbsp;·&nbsp; Labels from curated contract registry
            </p>
          </div>
        )}

      </div>

      <style>{`
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
        @keyframes developPhoto {
          0% { opacity:0; filter:brightness(2) saturate(0); }
          30% { opacity:0.6; filter:brightness(1.3) saturate(0.3); }
          100% { opacity:1; filter:brightness(1) saturate(1); }
        }
        * { box-sizing: border-box; }
        input::placeholder { color: #252525; }
      `}</style>
    </div>
  );
}

export default function Home() {
  const [dark, setDark] = useState(true);
  return (
    <Providers dark={dark}>
      <App />
    </Providers>
  );
}
