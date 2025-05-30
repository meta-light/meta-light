import '../app/globals.css';
import { UiLayout } from '../pines/ui/ui-layout';
import { ClusterProvider } from '../pines/cluster/cluster-data-access';
import { SolanaProvider } from '../pines/solana/solana-provider';
import { ReactQueryProvider } from '../pines/react-query-provider';
import DashboardFeature from '../pines/dashboard/dashboard-feature';

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