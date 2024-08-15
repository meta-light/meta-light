'use client';
import { useCluster } from './stake-data-access';

export function ExplorerLink({ path, label, className }: { path: string; label: string; className?: string }) {
  const { getExplorerUrl } = useCluster();
  return (<a href={getExplorerUrl(path)} target="_blank" rel="noopener noreferrer" className={className ? className : `link font-mono`}>{label}</a>);
}

export function Snapshot() {
  const postOptions = { method: 'POST', headers: {accept: 'application/json', 'content-type': 'application/json'} };
  fetch('https://devnet.underdogprotocol.com/v2/snapshots', postOptions)
    .then(response => response.json())
    .then(response => console.log(response))
    .catch(err => console.error(err));

  const getOptions = {method: 'GET', headers: {accept: 'application/json'}};
  fetch('https://devnet.underdogprotocol.com/v2/snapshots?page=1&limit=10', getOptions)
    .then(response => response.json())
    .then(response => console.log(response))
    .catch(err => console.error(err));
  
  return (<div>{"data"}</div>); // update
}

export function Mintsite() {return (<iframe src="https://shop.underdogprotocol.com/BQakVcDe1xMywcetx9Yj3iAQWKf5or92F9hEf1yRH8ZM" width="90%" height="400" name="iframe" title="This is my video"></iframe>);}

