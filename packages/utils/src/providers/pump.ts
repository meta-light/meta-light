import { WebSocket } from 'ws';

// https://pumpportal.fun/data-api/real-time

const ws = new WebSocket('wss://pumpportal.fun/api/data');

ws.on('open', function open() {
  let subscribeNewToken = { method: 'subscribeNewToken' };
  ws.send(JSON.stringify(subscribeNewToken));
  let subscribeMigration = { method: 'subscribeMigration' };
  ws.send(JSON.stringify(subscribeMigration));
  let subscribeAccountTrade = {
    method: 'subscribeAccountTrade',
    keys: ['AArPXm8JatJiuyEffuC1un2Sc835SULa4uQqDcaGpAjV'],
  }; 
  ws.send(JSON.stringify(subscribeAccountTrade));
  let subscribeTokenTrade = {
    method: 'subscribeTokenTrade',
    keys: ['91WNez8D22NwBssQbkzjy4s2ipFrzpmn5hfvWVe2aY5p'],
  }; 
  ws.send(JSON.stringify(subscribeTokenTrade));
  let unsubscribeTokenTrade = {
    method: 'unsubscribeTokenTrade',
    keys: ['Bwc4EBE65qXVzZ9ZiieBraj9GZL4Y2d7NN7B9pXENWR2'],
  };
});

ws.on('message', function message(data: any) {
  console.log(JSON.parse(data));
});
