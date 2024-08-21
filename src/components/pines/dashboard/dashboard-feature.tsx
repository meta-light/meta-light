'use client';
import { AppHero } from '../ui/ui-layout';
import Image from 'next/image';
const links: { label: string; href: string }[] = [
  { label: 'Mint a Pine', href: 'https://shop.underdogprotocol.com/BQakVcDe1xMywcetx9Yj3iAQWKf5or92F9hEf1yRH8ZM' },
];

export default function DashboardFeature() {
  const imageLoader = ({ src, width, quality }) => {
    return `${process.env.NEXT_PUBLIC_BASE_URL}${src}?w=${width}&q=${quality || 75}`
  }
  return (
    <div className="flex flex-col items-center">
      <AppHero title="The Pines" subtitle="There's no need to pine over spilled milk."/>
      <Image height={200} width={200} alt="PINES LOGO" src="/pines/pine.png" loader={imageLoader} />
      <div className="max-w-xl mx-auto py-6 sm:px-6 lg:px-8 text-center">
        <div className="space-y-2">
          <p>Every day when I come home from work, I cleanup the sticks that fell from the pine trees in my back yard. What started out as a simple yard cleanup quickly became a therapeutic part of my daily schedule, so I decided to share it with the Solana community.</p>
          {links.map((link, index) => (<div key={index}><a href={link.href} className="link" target="_blank" rel="noopener noreferrer">{link.label}</a></div>))}
        </div>
      </div>
    </div>
  );
}
