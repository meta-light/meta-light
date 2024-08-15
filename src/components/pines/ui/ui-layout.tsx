'use client';
import { WalletButton } from '../solana/solana-provider';
import * as React from 'react';
import { ReactNode, Suspense, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AccountChecker } from '../account/account-ui';
import { ClusterChecker, ClusterUiSelect, ExplorerLink } from '../cluster/cluster-ui';
import toast, { Toaster } from 'react-hot-toast';

export function UiLayout({ children, links }: {children: ReactNode; links: { label: string; path: string }[]; }) {
  const pathname = usePathname();
  const imageLoader = ({ src, width, quality }) => {
    return `${process.env.NEXT_PUBLIC_BASE_URL}${src}?w=${width}&q=${quality || 75}`
  }
  return (
    <div className="h-full flex flex-col">
      <div className="navbar bg-base-300 text-neutral-content flex flex-col md:flex-row space-y-4 md:space-y-0 p-4">
        <div className="flex-1 flex items-center justify-between w-full md:w-auto">
          <Link className="btn btn-ghost normal-case text-xl" href="/">
            <Image height={30} width={30} alt="Pine Logo" src="/pines/pine.png" loader={imageLoader} />
          </Link>
          <ul className="menu menu-horizontal px-1 space-x-2 flex-wrap justify-center">
            {links.map(({ label, path }) => (
              <li key={path}>
                <Link className={`${pathname?.startsWith(path) ? 'active' : ''} px-3 py-2`} href={path}>
                  {label}
                </Link>
              </li>
            ))}
            <li>
              <Link href={'https://shop.underdogprotocol.com/BQakVcDe1xMywcetx9Yj3iAQWKf5or92F9hEf1yRH8ZM'} className="px-3 py-2">
                Mint
              </Link>
            </li>
          </ul>
          <Link className="btn btn-ghost normal-case text-xl" href="https://t.me/+03-sVDpdfLBiODlh/" target="_blank">
            <Image height={30} width={30} alt="Solana Logo" src="/pines/tg.png" loader={imageLoader} />
          </Link>
        </div>
        <div className="flex-none space-x-2 mt-4 md:mt-0">
          <WalletButton />
          <ClusterUiSelect />
        </div>
      </div>
      <ClusterChecker>
        <AccountChecker />
      </ClusterChecker>
      <div className="flex-grow mx-4 lg:mx-auto">
        <Suspense fallback={<div className="text-center my-32"><span className="loading loading-spinner loading-lg"></span></div>}>
          {children}
        </Suspense>
        <Toaster position="bottom-right" />
      </div>
    </div>
  );
}

export function AppModal({ children, title, hide, show, submit, submitDisabled, submitLabel }: { children: ReactNode; title: string; hide: () => void; show: boolean; submit?: () => void; submitDisabled?: boolean; submitLabel?: string; }) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);

  useEffect(() => {
    if (!dialogRef.current) return;
    if (show) {dialogRef.current.showModal();} else {dialogRef.current.close();}
  }, [show, dialogRef]);

  return (
    <dialog className="modal" ref={dialogRef}>
      <div className="modal-box space-y-5">
        <h3 className="font-bold text-lg">{title}</h3>
        {children}
        <div className="modal-action">
          <div className="join space-x-2">
            {submit ? (<button className="btn btn-xs lg:btn-md btn-primary" onClick={submit} disabled={submitDisabled}> {submitLabel || 'Save'}</button>) : null}
            <button onClick={hide} className="btn">
              Close
            </button>
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

export function ellipsify(str = '', len = 4) {
  if (str.length > 30) { return (str.substring(0, len) + '..' + str.substring(str.length - len, str.length));}
  return str;
}

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