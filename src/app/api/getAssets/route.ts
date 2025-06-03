import { Helius } from 'helius-sdk';
import { HELIUS_API_KEY } from '../../env';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  if (!HELIUS_API_KEY) {return NextResponse.json({ error: 'HELIUS_API_KEY is not set' }, { status: 500 });}
  const { searchParams } = new URL(request.url);
  const ownerAddress = searchParams.get('ownerAddress') || undefined;
  const compressed = searchParams.get('compressed');
  const burnt = searchParams.get('burnt');
  const page = searchParams.get('page');
  const helius = new Helius(HELIUS_API_KEY);
  try {
    const response = await helius.rpc.searchAssets({
      ownerAddress,
      compressed: compressed === 'true',
      burnt: burnt === 'true',
      page: parseInt(page || '1', 10)
    });
    const assetInfos = response.items.map(item => ({
      name: String(item?.content?.metadata?.name),
      assetId: item.id,
      state: item?.compression?.compressed,
      image: item?.content?.links?.image,
    }));
    return NextResponse.json({ assetInfos: assetInfos.filter(info => info && info.state) }, { status: 200 });
  } 
  catch (error: any) {
    console.error("Error in searchAssets API:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}