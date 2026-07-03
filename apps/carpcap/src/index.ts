import mongoose from 'mongoose';
import * as cron from 'node-cron';
import { MONGODB_URI, ENABLE_TRADING } from './env';
import { initTelegram } from './utils/telegram';
import { startApiServer } from './services/api';
import { checkGitHubRepos } from './services/github';
import { startTradingBot } from './services/trading';
import { ingest0xMetaLightTweets } from './services/social/utils';
import { runSocialV2 } from './services/social';
import { bootstrapRemoteAuth } from './utils/ai/openai-oauth';
import { runPortfolioTask, seedWallets } from './services/portfolio';
import { runRentalsNotificationTask } from './services/rentals';

export async function tryCatch (method: any) {try {await method();} catch(e) {console.log(e);}};
export interface ISchedule { expression: string, method: Function, timeZone: string | null };

export const schedule: ISchedule[] = [
  { expression: '*/30 9-16 * * *', method: checkGitHubRepos, timeZone: 'America/Chicago' }, // every 30 minutes between 9am-4pm CST
  // { expression: '0 */4 * * *', method: ingest0xMetaLightTweets, timeZone: 'America/Chicago' }, // every 4 hours
  { expression: '0 8 * * *', method: runPortfolioTask, timeZone: 'America/Chicago' }, // daily at 8am CST/CDT
  // { expression: '0 9 * * *', method: runSocialV2, timeZone: 'America/Chicago' }, // daily at 9am CST/CDT
  // { expression: '0 7,19 * * *', method: runRentalsNotificationTask, timeZone: 'America/New_York' } // daily at 7am and 7pm Eastern
];

export async function startCarpServer() {
  await seedWallets();
  await bootstrapRemoteAuth();
  if (!MONGODB_URI) {throw new Error('MONGODB_URI not set');}
  const connectWithRetry = async () => {
    try {
      await mongoose.connect(MONGODB_URI!);  
      console.log('Mongoose connected successfully');
      startApiServer();
      await initTelegram();
      if (ENABLE_TRADING === 'true') {startTradingBot();}
      await runPortfolioTask();
      for (const event of schedule) {cron.schedule(event.expression, async () => {tryCatch(event.method);}, event.timeZone ? {timezone: event.timeZone} : {});};
      console.log('Cron schedulers started');
    } 
    catch (error) {
      console.error('MongoDB connection unsuccessful, retry after 5 seconds.', error);
      setTimeout(connectWithRetry, 5000);
    }
  };
  connectWithRetry();
}

startCarpServer();
