async function walletTest() {
    const connection = new Connection(clusterApiUrl('mainnet-beta'));
    const wallet = getPhantomWallet();
    wallet.connect();
    const disconnectWallet = wallet.disconnect();
    const isWalletConnected =  wallet.connected;
  }