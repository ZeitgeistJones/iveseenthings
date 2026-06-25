import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { address } = await req.json();
    if (!address) return NextResponse.json({ error: 'No address provided' }, { status: 400 });

    const ALCHEMY_KEY = process.env.ALCHEMY_KEY;
    const url = `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'alchemy_getAssetTransfers',
        params: [{
          toAddress: address,
          category: ['erc20', 'external', 'erc721'],
          maxCount: '0x28',
          withMetadata: true,
          order: 'desc'
        }]
      })
    });

    const data = await response.json();
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
