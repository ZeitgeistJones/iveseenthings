import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getAnthropicKey() {
  const key = process.env.ANTHROPIC_KEY;
  if (!key) {
    throw new Error('Missing ANTHROPIC_KEY');
  }
  return key;
}

function extractPrompt(body: any) {
  if (typeof body === 'string') {
    return body.trim();
  }

  if (typeof body?.prompt === 'string') {
    return body.prompt.trim();
  }

  if (typeof body?.message === 'string') {
    return body.message.trim();
  }

  return '';
}

export async function POST(req: NextRequest) {
  try {
    let body: any;

    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const prompt = extractPrompt(body);

    if (!prompt) {
      return NextResponse.json(
        {
          error: 'No prompt provided',
          receivedType: typeof body,
          receivedKeys: body && typeof body === 'object' ? Object.keys(body) : [],
        },
        { status: 400 },
      );
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': getAnthropicKey(),
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1000,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
      cache: 'no-store',
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data?.error?.message || 'Anthropic request failed', details: data },
        { status: response.status },
      );
    }

    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Story route failed' },
      { status: 500 },
    );
  }
}
