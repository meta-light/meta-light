import { createContext } from 'react';

const BasketContext = createContext({
  assetInfoList: [],
  getTPS: () => {},
  searchAssets: () => {}
});

export default BasketContext;