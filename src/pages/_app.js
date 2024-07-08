import ProviderWrapper from '@/components/basket/providers/ProviderWrapper';

function MyApp({ Component, pageProps }) {
  return (
    <ProviderWrapper>
      <Component {...pageProps} />
    </ProviderWrapper>
  );
}

export default MyApp;