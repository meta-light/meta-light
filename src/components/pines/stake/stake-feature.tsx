'use client';
import { AppHero } from '../ui/ui-layout';
import { StakeGridUpdog } from './stake-dash';

export default function StakeFeature() {
  return (
    <div>
      <AppHero title="Pines Staking" subtitle="Pines -> Sticks"></AppHero>
      <StakeGridUpdog/>
    </div>
    );
}
