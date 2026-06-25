import { NextRequest, NextResponse } from 'next/server';

const ALCHEMY_KEY = process.env.ALCHEMY_API_KEY;
const BASE_URL = `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`;
const CLAWD_CONTRACT = '0x9f86dB9fc6f7c9408e8Fda3Ff8ce4e78ac7a6b07'.toLowerCase();
const MAX_JOURNEY_HOPS = 5;

type Transfer = {
  blockNum?: string;
  uniqueId?: string;
  hash?: string;
  from?: string;
  to?: string;
  value?: string;
  erc721TokenId?: string | null;
  erc1155Metadata?: any | null;
  tokenId?: string | null;
  asset?: string;
  category?: string;
  rawContract?: {
    value?: string | null;
    address?: string;
    decimal?: string | null;
  };
  metadata?: {
    blockTimestamp?: string;
  };
};

async function alchemy(body: Record<string, any>) {
  const res = await fetch(BASE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: 1,
      jsonrpc: '2.0',
      ...body,
    }),
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error(`Alchemy error ${res.status}`);
  }

  const json = await res.json();

  if (json.error) {
    throw new Error(json.error.message || 'Alchemy request failed');
  }

  return json.result;
}

async function getAssetTransfers(params: Record<string, any>) {
  return alchemy({
    method: 'alchemy_getAssetTransfers',
    params: [params],
  });
}

function normalizeAddress(addr?: string) {
  return (addr || '').toLowerCase();
}

function parseTransferValue(t: Transfer) {
  const direct = parseFloat(t.value || '0');
  if (Number.isFinite(direct) && direct > 0) return direct;

  const raw = t.rawContract?.value;
  const dec = Number(t.rawContract?.decimal || '18');

  if (!raw) return 0;

  try {
    const n = Number(raw);
    if (!Number.isFinite(n)) return 0;
    return n / 10 ** dec;
  } catch {
    return 0;
  }
}

function isClawdTransfer(t: Transfer) {
  return normalizeAddress(t.rawContract?.address) === CLAWD_CONTRACT;
}

function sortOldestFirst(transfers: Transfer[]) {
  return [...transfers].sort((a, b) => {
    const aNum = parseInt(a.blockNum || '0x0', 16);
    const bNum = parseInt(b.blockNum || '0x0', 16);
    return aNum - bNum;
  });
}

async function getRecentWalletTransfers(address: string, clawdMode: boolean) {
  const common = {
    fromBlock: '0x0',
    withMetadata: true,
    excludeZeroValue: false,
    maxCount: '0x64',
    order: 'desc',
    category: ['external', 'erc20', 'internal'],
  };

  if (clawdMode) {
    const [incoming, outgoing] = await Promise.all([
      getAssetTransfers({
        ...common,
        toAddress: address,
        contractAddresses: [CLAWD_CONTRACT],
      }),
      getAssetTransfers({
        ...common,
        fromAddress: address,
        contractAddresses: [CLAWD_CONTRACT],
      }),
    ]);

    const transfers = [
      ...(incoming?.transfers || []),
      ...(outgoing?.transfers || []),
    ].filter(isClawdTransfer);

    return sortOldestFirst(transfers);
  }

  const [incoming, outgoing] = await Promise.all([
    getAssetTransfers({
      ...common,
      toAddress: address,
    }),
    getAssetTransfers({
      ...common,
      fromAddress: address,
    }),
  ]);

  const transfers = [
    ...(incoming?.transfers || []),
    ...(outgoing?.transfers || []),
  ];

  const deduped = Array.from(
    new Map(
      transfers.map((t: Transfer) => [
        t.uniqueId || `${t.hash}-${t.from}-${t.to}-${t.asset}-${t.value}`,
        t,
      ]),
    ).values(),
  );

  return sortOldestFirst(deduped);
}

function chooseTopAsset(transfers: Transfer[]) {
  const scores = new Map<string, number>();

  for (const t of transfers) {
    const asset = t.asset || 'UNKNOWN';
    const value = parseTransferValue(t);
    const current = scores.get(asset) || 0;
    scores.set(asset, current + Math.max(value, 1));
  }

  let best = 'ETH';
  let bestScore = -1;

  for (const [asset, score] of scores.entries()) {
    if (score > bestScore) {
      best = asset;
      bestScore = score;
    }
  }

  return best;
}

function sameAsset(t: Transfer, asset: string) {
  return (t.asset || '').toUpperCase() === asset.toUpperCase();
}

async function findPreviousInboundTransfer(
  currentHolder: string,
  asset: string,
  clawdMode: boolean,
) {
  const params: Record<string, any> = {
    fromBlock: '0x0',
    toAddress: currentHolder,
    withMetadata: true,
    excludeZeroValue: false,
    maxCount: '0x14',
    order: 'desc',
    category: ['external', 'erc20', 'internal'],
  };

  if (clawdMode) {
    params.contractAddresses = [CLAWD_CONTRACT];
  }

  const result = await getAssetTransfers(params);
  const transfers: Transfer[] = result?.transfers || [];

  if (clawdMode) {
    return transfers.find(isClawdTransfer) || null;
  }

  return transfers.find(t => sameAsset(t, asset)) || null;
}

async function buildJourneyIntoWallet(
  destinationWallet: string,
  asset: string,
  clawdMode: boolean,
) {
  const journey: Transfer[] = [];
  let currentWallet = normalizeAddress(destinationWallet);

  for (let i = 0; i < MAX_JOURNEY_HOPS; i++) {
    const prev = await findPreviousInboundTransfer(currentWallet, asset, clawdMode);
    if (!prev) break;

    journey.push(prev);

    const priorWallet = normalizeAddress(prev.from);
    if (!priorWallet || priorWallet === currentWallet) break;

    currentWallet = priorWallet;
  }

  return sortOldestFirst(journey);
}

export async function POST(req: NextRequest) {
  try {
    if (!ALCHEMY_KEY) {
      return NextResponse.json(
        { error: 'Missing ALCHEMY_API_KEY' },
        { status: 500 },
      );
    }

    const body = await req.json();
    const address = normalizeAddress(body?.address);
    const clawdMode = Boolean(body?.clawdMode);

    if (!/^0x[a-f0-9]{40}$/.test(address)) {
      return NextResponse.json(
        { error: 'Invalid wallet address' },
        { status: 400 },
      );
    }

    const transfers = await getRecentWalletTransfers(address, clawdMode);

    if (clawdMode) {
      const journey = await buildJourneyIntoWallet(address, 'CLAWD', true);

      return NextResponse.json({
        result: {
          transfers,
          topAsset: 'CLAWD',
          journey,
        },
      });
    }

    const topAsset = chooseTopAsset(transfers);
    const journey = await buildJourneyIntoWallet(address, topAsset, false);

    return NextResponse.json({
      result: {
        transfers,
        topAsset,
        journey,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Trace failed' },
      { status: 500 },
    );
  }
}
