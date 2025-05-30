import '../app/globals.css';
import { UiLayout } from './ui/ui-layout';
import { ClusterProvider } from './cluster/cluster-data-access';
import { SolanaProvider } from './solana/solana-provider';
import { ReactQueryProvider } from './react-query-provider';
import DashboardFeature from './dashboard/dashboard-feature';

export const metadata = { title: 'The Pines', description: "There's no need to pine over spilled milk" };

export default function PinesComponent() {
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