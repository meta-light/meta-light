import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IPortfolioWallet extends Document {
  name: string;
  address: string;
  netuid: number;
  subnetName: string;
}

const PortfolioWalletSchema = new Schema<IPortfolioWallet>({
  name: { type: String, required: true },
  address: { type: String, required: true },
  netuid: { type: Number, required: true },
  subnetName: { type: String, required: true }
});

export const PortfolioWallet: Model<IPortfolioWallet> = (mongoose.models.PortfolioWallet as Model<IPortfolioWallet>) || mongoose.model<IPortfolioWallet>('PortfolioWallet', PortfolioWalletSchema);
export interface IPortfolioState extends Document {
  key: string;
  lastSnapshot: any;
}
const PortfolioStateSchema = new Schema<IPortfolioState>({
  key: { type: String, required: true, index: true },
  lastSnapshot: { type: Schema.Types.Mixed }
});
export const PortfolioState: Model<IPortfolioState> = (mongoose.models.PortfolioState as Model<IPortfolioState>) || mongoose.model<IPortfolioState>('PortfolioState', PortfolioStateSchema);
