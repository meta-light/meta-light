'use client';
import { WalletButton } from '../solana/solana-provider';
import * as React from 'react';
import { ReactNode, Suspense, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AccountChecker } from '../account/account-ui';
import { ClusterChecker, ExplorerLink } from '../cluster/cluster-ui';
import toast, { Toaster } from 'react-hot-toast';
import { StakeGrid } from '../stake/stake-dashboard';

export function UiLayout({ children }: {children: ReactNode; }) {
  const [showStakeGrid, setShowStakeGrid] = useState(false);
  const imageLoader = ({ src, width, quality }) => {return `${process.env.NEXT_PUBLIC_BASE_URL}${src}?w=${width}&q=${quality || 75}`}
  return (
    <div className="h-full flex flex-col">
      <div className="navbar bg-base-300 text-neutral-content flex items-center justify-between p-2">
        <div className="flex items-center space-x-2">
          <Link className="btn btn-ghost normal-case text-xl p-1 mr-4" href="/pines"><Image height={40} width={40} alt="Pine Logo" src="/pines/pine.png" loader={imageLoader}/></Link>
          <div className="flex space-x-1 mr-4">
            <button onClick={() => setShowStakeGrid(!showStakeGrid)} className="btn btn-s btn-primary mr-8">
              {showStakeGrid ? 'Stake' : 'Stake'}
            </button>
            <Link href="https://shop.underdogprotocol.com/BQakVcDe1xMywcetx9Yj3iAQWKf5or92F9hEf1yRH8ZM" className="btn btn-xs btn-primary mr-8">Mint</Link>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Link className="btn btn-ghost normal-case text-xl p-1 mr-4" href="https://t.me/+03-sVDpdfLBiODlh/" target="_blank"><Image height={30} width={30} alt="Telegram" src="/pines/tg.png" loader={imageLoader}/></Link>
          <WalletButton />
        </div>
      </div>
      <ClusterChecker><AccountChecker/></ClusterChecker>
      <div className="flex-grow mx-4 lg:mx-auto">
        <Suspense fallback={<div className="text-center my-32"><span className="loading loading-spinner loading-lg"></span></div>}>
          {showStakeGrid ? <StakeGrid /> : children}
        </Suspense>
        <Toaster position="bottom-right" />
      </div>
    </div>
  );
}

export function AppModal({ children, title, hide, show, submit, submitDisabled, submitLabel }: { children: ReactNode; title: string; hide: () => void; show: boolean; submit?: () => void; submitDisabled?: boolean; submitLabel?: string; }) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  useEffect(() => {if (!dialogRef.current) return; if (show) {dialogRef.current.showModal();} else {dialogRef.current.close();}}, [show, dialogRef]);
  return (
    <dialog className="modal" ref={dialogRef}>
      <div className="modal-box space-y-5">
        <h3 className="font-bold text-lg">{title}</h3>
        {children}
        <div className="modal-action">
          <div className="join space-x-2">
            {submit ? (<button className="btn btn-xs lg:btn-md btn-primary" onClick={submit} disabled={submitDisabled}> {submitLabel || 'Save'}</button>) : null}
            <button onClick={hide} className="btn">Close</button>
          </div>
        </div>
      </div>
    </dialog>
  );
}

export function AppHero({ children, title, subtitle }: {children?: ReactNode; title: ReactNode; subtitle: ReactNode; }) {
  return (
    <div className="hero py-[64px]">
      <div className="hero-content text-center">
        <div className="max-w-2xl">
          {typeof title === 'string' ? (<h1 className="text-5xl font-bold">{title}</h1>) : (title)}
          {typeof subtitle === 'string' ? (<p>{subtitle}</p>) : (subtitle)}
          {children}
        </div>
      </div>
    </div>
  );
}

export function ellipsify(str = '', len = 4) {if (str.length > 30) { return (str.substring(0, len) + '..' + str.substring(str.length - len, str.length));} return str;}
export function useTransactionToast() {
  return (signature: string) => {
    toast.success(
      <div className={'text-center'}>
        <div className="text-lg">Transaction sent</div>
        <ExplorerLink path={`tx/${signature}`} label={'View Transaction'} className="btn btn-xs btn-primary"/>
      </div>
    );
  };
}