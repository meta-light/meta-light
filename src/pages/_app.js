import ProviderWrapper from '../components/basket/providers/ProviderWrapper';
import Head from 'next/head'
function MyApp({ Component, pageProps }) {return (<><Head><link rel="icon" href="/favicon.png" sizes="any"/></Head><ProviderWrapper><Component {...pageProps}/></ProviderWrapper></>);}
export default MyApp;