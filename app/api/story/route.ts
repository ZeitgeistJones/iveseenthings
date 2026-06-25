import { NextRequest, NextResponse } from 'next/server';

const ALCHEMY_KEY = process.env.ALCHEMY_KEY;
const BASE_URL = `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`;

const CLAWD_CONTRACT = '0x9f86dB9fc6f7c9408e8Fda3Ff8ce4e78ac7a6b07';

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
  '0x9f86db9fc6f7c9408e8fda3ff8ce4e78ac7a6b07': 'CLAWD Token',
};

const KNOWN_TOKENS = new Set(['USDC', 'ETH', 'WETH', 'cbETH', 'wstETH', 'DAI', 'USDT', 'cbBTC', 'AERO', 'CLAWD']);

function scoreTransfer(t: any) {
  let s = 0;
  if (LABELS[(t.from || '').toLowerCase()]) s += 25;
  if (LABELS[(t.to || '').toLowerCase()]) s += 25;
  const v = parseFloat(t.value || 0);
  if (v > 100) s += 20;
  if (v > 1000) s += 20;
  if (t.asset && t.asset !== 'ETH') s += 10;
  if (KNOWN_TOKENS.has(t.asset)) s += 50;
  s += Math.random() * 5;
  return s;
}

async function getTransfersTo(address: string, contractAddress?: string) {
  const params: any = {
    toAddress: address,
    category: ['erc20', 'external'],
    maxCount: '0x14',
    withMetadata: true,
    order: 'desc',
  };
  if (contractAddress) {
    params.contractAddresses = [contractAddress];
    params.category = ['erc20'];
  }

  const res = await fetch(BASE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0', id: 1,
      method: 'alchemy_getAssetTransfers',
      params: [params],
    }),
  });
  const data = await res.json();
  return data.result?.transfers || [];
}

async function getTransfersFrom(address: string, contractAddress?: string) {
  const params: any = {
    fromAddress: address,
    category: ['erc20', 'external'],
    maxCount: '0x14',
    withMetadata: true,
    order: 'desc',
  };
  if (contractAddress) {
    params.contractAddresses = [contractAddress];
    params.category = ['erc20'];
  }

  const res = await fetch(BASE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0', id: 1,
      method: 'alchemy_getAssetTransfers',
      params: [params],
    }),
  });
  const data = await res.json();
  return data.result?.transfers || [];
}

// Walk backwards from a wallet: who sent this token to them, and who sent it to THAT wallet, etc.
// Returns an ordered list of transfers from origin → destination (oldest first)
async function traceInboundJourney(
  walletAddress: string,
  contractAddress: string,
  maxHops = 5
): Promise<any[]> {
  const journey: any[] = [];
  let currentWallet = walletAddress.toLowerCase();
  const visited = new Set<string>();

  for (let hop = 0; hop < maxHops; hop++) {
    if (visited.has(currentWallet)) break;
    visited.add(currentWallet);

    // Find who sent this token to currentWallet
    const inbound = await getTransfersTo(currentWallet, contractAddress);
    if (!inbound.length) break;

    // Take the most recent inbound transfer of this token
    const transfer = inbound[0];
    journey.unshift(transfer); // prepend so we build oldest-first

    const sender = (transfer.from || '').toLowerCase();
    if (!sender || sender === currentWallet) break;

    // If sender is a known protocol/contract (not a person), stop — we found the origin
    if (LABELS[sender]) break;

    // Otherwise walk back one more hop
    currentWallet = sender;
  }

  return journey;
}

export async function POST(req: NextRequest) {
  try {
    const { address, clawdMode } = await req.json();
    if (!address) return NextResponse.json({ error: 'No address provided' }, { status: 400 });

    // --- CLAWD MODE ---
    if (clawdMode) {
      const journey = await traceInboundJourney(address, CLAWD_CONTRACT, 5);

      // Also get the wallet's inbound CLAWD transfers for context
      const inbound = await getTransfersTo(address, CLAWD_CONTRACT);

      return NextResponse.json({
        result: {
          transfers: inbound,
          journey,
          topAsset: 'CLAWD',
          journeySpanDays: journeySpanDays(journey),
          clawdMode: true,
        }
      });
    }

    // --- NORMAL MODE ---
    // Step 1: Get wallet's recent inbound transfers
    const walletTransfers = await getTransfersTo(address);
    if (!walletTransfers.length) {
      return NextResponse.json({ result: { transfers: [] } });
    }

    // Step 2: Score and pick best candidates
    const sorted = [...walletTransfers].sort((a: any, b: any) => scoreTransfer(b) - scoreTransfer(a));

    const seen = new Set<string>();
    const candidates: any[] = [];
    for (const t of sorted) {
      const contractAddr = t.rawContract?.address;
      if (!seen.has(t.asset) && contractAddr) {
        seen.add(t.asset);
        candidates.push(t);
      }
      if (candidates.length >= 4) break;
    }

    // Step 3: For each candidate, trace the inbound journey and pick the one with the most hops
    let bestTransfer = sorted[0];
    let bestJourney: any[] = [];
    let bestScore = 0;

    for (const candidate of candidates) {
      const contractAddr = candidate.rawContract?.address;
      if (!contractAddr) continue;

      const journey = await traceInboundJourney(address, contractAddr, 5);
      const score = journey.length * 10 + journeySpanDays(journey);

      if (score > bestScore) {
        bestScore = score;
        bestJourney = journey;
        bestTransfer = candidate;
      }

      if (journey.length >= 4) break; // good enough
    }

    return NextResponse.json({
      result: {
        transfers: walletTransfers,
        journey: bestJourney,
        topAsset: bestTransfer.asset,
        journeySpanDays: Math.round(journeySpanDays(bestJourney)),
      }
    });

  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

function journeySpanDays(transfers: any[]): number {
  if (transfers.length < 2) return 0;
  const first = parseInt(transfers[0].blockNum, 16);
  const last = parseInt(transfers[transfers.length - 1].blockNum, 16);
  return ((last - first) * 2) / (60 * 60 * 24);
}
