import { NextRequest, NextResponse } from 'next/server';

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

// Known tokens with long histories — boost these heavily
const KNOWN_TOKENS = new Set(['USDC', 'ETH', 'WETH', 'cbETH', 'wstETH', 'DAI', 'USDT', 'cbBTC', 'AERO']);

function scoreTransfer(t: any) {
  let s = 0;
  if (LABELS[(t.from || '').toLowerCase()]) s += 25;
  if (LABELS[(t.to || '').toLowerCase()]) s += 25;
  const v = parseFloat(t.value || 0);
  if (v > 100) s += 20;
  if (v > 1000) s += 20;
  if (t.asset && t.asset !== 'ETH') s += 10;
  // Heavily bias toward known tokens with long histories
  if (KNOWN_TOKENS.has(t.asset)) s += 50;
  s += Math.random() * 5;
  return s;
}

function journeySpansDays(transfers: any[]): number {
  if (transfers.length < 2) return 0;
  const first = parseInt(transfers[0].blockNum, 16);
  const last = parseInt(transfers[transfers.length - 1].blockNum, 16);
  // ~2 seconds per block on Base
  return ((last - first) * 2) / (60 * 60 * 24);
}

export async function POST(req: NextRequest) {
  try {
    const { address } = await req.json();
    if (!address) return NextResponse.json({ error: 'No address provided' }, { status: 400 });

    const ALCHEMY_KEY = process.env.ALCHEMY_KEY;
    const url = `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`;

    // Step 1: Get wallet's recent inbound transfers
    const walletRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 1,
        method: 'alchemy_getAssetTransfers',
        params: [{
          toAddress: address,
          category: ['erc20', 'external', 'erc721'],
          maxCount: '0x28',
          withMetadata: true,
          order: 'desc',
        }]
      })
    });

    const walletData = await walletRes.json();
    const walletTransfers = walletData.result?.transfers || [];

    if (!walletTransfers.length) {
      return NextResponse.json({ result: { transfers: [] } });
    }

    // Step 2: Sort by score, try each candidate until we find one with a good journey
    const sorted = [...walletTransfers].sort((a: any, b: any) => scoreTransfer(b) - scoreTransfer(a));

    // Deduplicate by asset — try up to 4 unique tokens
    const seen = new Set<string>();
    const candidates: any[] = [];
    for (const t of sorted) {
      if (!seen.has(t.asset) && t.rawContract?.address) {
        seen.add(t.asset);
        candidates.push(t);
      }
      if (candidates.length >= 4) break;
    }

    // Step 3: For each candidate, fetch its journey and pick the one with the best span
    let bestTransfer = sorted[0];
    let bestJourney: any[] = [];
    let bestSpan = 0;

    for (const candidate of candidates) {
      const contractAddress = candidate.rawContract?.address;
      if (!contractAddress) continue;

      const journeyRes = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0', id: 2,
          method: 'alchemy_getAssetTransfers',
          params: [{
            contractAddresses: [contractAddress],
            category: ['erc20'],
            maxCount: '0x28',
            withMetadata: true,
            order: 'asc',
          }]
        })
      });

      const journeyData = await journeyRes.json();
      const journeyTransfers = journeyData.result?.transfers || [];
      const span = journeySpansDays(journeyTransfers);

      // Pick this one if it has a better span (at least 30 days is meaningful)
      if (span > bestSpan) {
        bestSpan = span;
        bestJourney = journeyTransfers;
        bestTransfer = candidate;
      }

      // If we found something spanning over 90 days, that's good enough — stop looking
      if (bestSpan > 90) break;
    }

    return NextResponse.json({
      result: {
        transfers: walletTransfers,
        journey: bestJourney,
        topAsset: bestTransfer.asset,
        journeySpanDays: Math.round(bestSpan),
      }
    });

  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
