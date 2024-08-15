import '../app/globals.css';
import { UiLayout } from '../components/pines/ui/ui-layout';
import { ClusterProvider } from '../components/pines/cluster/cluster-data-access';
import { SolanaProvider } from '../components/pines/solana/solana-provider';
import { ReactQueryProvider } from '../components/pines/react-query-provider';
import DashboardFeature from '../components/pines/dashboard/dashboard-feature';

export const metadata = { title: 'The Pines', description: "There's no need to pine over spilled milk" };
const links: { label: string; path: string }[] = [{ label: 'Stake', path: '/stake' }];

export default function Pines() {
  return (
        <ReactQueryProvider>
          <ClusterProvider>
            <SolanaProvider>
              <UiLayout>
                <DashboardFeature />
              </UiLayout>
            </SolanaProvider>
          </ClusterProvider>
        </ReactQueryProvider>
  );
}