import OpenAI from "openai";

export const OPENAI_RATE_LIMITS = {TOKENS_PER_MINUTE: 30000, REQUESTS_PER_MINUTE: 500, TOKENS_PER_DAY: 90000}
let tokenUsage = {lastMinute: 0, lastDay: 0, lastMinuteReset: Date.now(), lastDayReset: Date.now()};
let OPENAI_API_KEY = '';
let XAI_API_KEY = "";

export const queryGrok = async (keyword: string, context: string) => {
    try {
      const formattedPrompt = prompt(keyword, context);
      const xaiURL = "https://api.x.ai/v1/chat/completions";
      const xaiHeaders = {"Content-Type": "application/json", "Authorization": `Bearer ${XAI_API_KEY}`,};
      const xaiData = {messages: [{ role: "system", content: formattedPrompt }], model: "grok-3-beta", stream: false, temperature: 0.5,};
      const response = await fetch(xaiURL, {method: "POST", headers: xaiHeaders, body: JSON.stringify(xaiData),});
      const data = await response.json();
      const responseContent = data.choices[0].message.content;
      console.log(responseContent);
      return responseContent;
    } 
    catch (error) {console.error("Error calling XAI:", error); throw error;}
};
  
export const queryGrokWithSearch = async (messages: { role: string; content: string }[], mode: 'auto' | 'on' | 'off' = 'auto', model: string = 'grok-3-latest') => {
    try {
      const xaiURL = 'https://api.x.ai/v1/chat/completions';
      const xaiHeaders = {'Content-Type': 'application/json', 'Authorization': `Bearer ${XAI_API_KEY}`};
      const xaiData = {messages, search_parameters: { mode }, model,};
      const response = await fetch(xaiURL, {method: 'POST', headers: xaiHeaders, body: JSON.stringify(xaiData)});
      const data = await response.json();
      const responseContent = data.choices?.[0]?.message?.content || 'No response generated';
      return responseContent;
    } 
    catch (error) {console.error('Error calling Grok with search:', error); throw error;}
};
  
export const queryGrokWithCitations = async (messages: { role: string; content: string }[], mode: 'auto' | 'on' | 'off' = 'auto', model: string = 'grok-3-latest') => {
    try {
      const xaiURL = 'https://api.x.ai/v1/chat/completions';
      const xaiHeaders = {'Content-Type': 'application/json', 'Authorization': `Bearer ${XAI_API_KEY}`,};
      const xaiData = {messages, search_parameters: { mode, return_citations: true }, model,};
      const response = await fetch(xaiURL, {method: 'POST', headers: xaiHeaders, body: JSON.stringify(xaiData),});
      const data = await response.json();
      const responseContent = data.choices?.[0]?.message?.content || 'No response generated';
      const citations = data.citations || [];
      return { responseContent, citations };
    } 
    catch (error) {console.error('Error calling Grok with citations:', error); throw error;}
};
  
export const queryGrokWithDateRange = async (messages: { role: string; content: string }[], {from_date, to_date, mode = 'auto', model = 'grok-3-latest'}: {from_date?: string; to_date?: string; mode?: 'auto' | 'on' | 'off'; model?: string;}) => {
    try {
      const xaiURL = 'https://api.x.ai/v1/chat/completions';
      const xaiHeaders = {'Content-Type': 'application/json', 'Authorization': `Bearer ${XAI_API_KEY}`,};
      const search_parameters: any = { mode };
      if (from_date) search_parameters.from_date = from_date;
      if (to_date) search_parameters.to_date = to_date;
      const xaiData = {messages, search_parameters, model,};
      const response = await fetch(xaiURL, {method: 'POST', headers: xaiHeaders, body: JSON.stringify(xaiData)});
      const data = await response.json();
      const responseContent = data.choices?.[0]?.message?.content || 'No response generated';
      return responseContent;
    } 
    catch (error) {console.error('Error calling Grok with date range:', error); throw error;}
};
  
export const queryGrokWithMaxResults = async (messages: { role: string; content: string }[], max_search_results: number = 20, mode: 'auto' | 'on' | 'off' = 'auto', model: string = 'grok-3-latest') => {
    try {
      const xaiURL = 'https://api.x.ai/v1/chat/completions';
      const xaiHeaders = {'Content-Type': 'application/json', 'Authorization': `Bearer ${XAI_API_KEY}`,};
      const xaiData = {messages, search_parameters: { mode, max_search_results }, model,};
      const response = await fetch(xaiURL, {method: 'POST', headers: xaiHeaders, body: JSON.stringify(xaiData),});
      const data = await response.json();
      const responseContent = data.choices?.[0]?.message?.content || 'No response generated';
      return responseContent;
    } 
    catch (error) {console.error('Error calling Grok with max results:', error); throw error;}
};
  
export const queryGrokWithSources = async (messages: { role: string; content: string }[], sources: any[], mode: 'auto' | 'on' | 'off' = 'auto', model: string = 'grok-3-latest') => {
    try {
      const xaiURL = 'https://api.x.ai/v1/chat/completions';
      const xaiHeaders = {'Content-Type': 'application/json', 'Authorization': `Bearer ${XAI_API_KEY}`,};
      const xaiData = {messages, search_parameters: { mode, sources }, model};
      const response = await fetch(xaiURL, {method: 'POST', headers: xaiHeaders, body: JSON.stringify(xaiData)});
      const data = await response.json();
      const responseContent = data.choices?.[0]?.message?.content || 'No response generated';
      return responseContent;
    } 
    catch (error) {console.error('Error calling Grok with sources:', error); throw error;}
};

export async function queryDeepSeek(keyword: string, API_KEY: string, model: string, systemPrompt: string) {
    const deepseekClient = new OpenAI({baseURL: 'https://api.deepseek.com', apiKey: API_KEY});
    const completion = await deepseekClient.chat.completions.create({messages: [{ role: "system", content: systemPrompt }], model: model,});
    console.log(completion.choices[0].message.content);
}

export async function queryOpenAI(context: string) {
  const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
  const formattedPrompt = prompt(context);
  const MAX_TOKENS = 4000;
  const RESPONSE_TOKENS = 1000;
  let totalTokens = 0;
  const now = Date.now();
  if (now - tokenUsage.lastMinuteReset > 60000) {tokenUsage.lastMinute = 0; tokenUsage.lastMinuteReset = now;}
  if (now - tokenUsage.lastDayReset > 86400000) {tokenUsage.lastDay = 0; tokenUsage.lastDayReset = now;}
  if (tokenUsage.lastMinute >= OPENAI_RATE_LIMITS.TOKENS_PER_MINUTE) {
    const waitTime = 60000 - (now - tokenUsage.lastMinuteReset);
    await new Promise(resolve => setTimeout(resolve, waitTime));
    tokenUsage.lastMinute = 0;
    tokenUsage.lastMinuteReset = Date.now();
  }
  if (tokenUsage.lastDay >= OPENAI_RATE_LIMITS.TOKENS_PER_DAY) {throw new Error('Daily token limit reached');}
  const estimatedTotalTokens = MAX_TOKENS + RESPONSE_TOKENS;
  if (tokenUsage.lastMinute + estimatedTotalTokens > OPENAI_RATE_LIMITS.TOKENS_PER_MINUTE) {
    const waitTime = 60000 - (now - tokenUsage.lastMinuteReset);
    await new Promise(resolve => setTimeout(resolve, waitTime));
    tokenUsage.lastMinute = 0;
    tokenUsage.lastMinuteReset = Date.now();
  }
  try {
    const response = await openai.chat.completions.create({
      model: "ft:gpt-4o-mini-2024-07-18:personal:carp-cap-01:AyJt1GZ9",
      messages: [{role: "system", content: context}],
      max_tokens: 500,
      temperature: 0.7,
    });
    const tokensUsed = totalTokens + (response.usage?.total_tokens || 0);
    tokenUsage.lastMinute += tokensUsed;
    tokenUsage.lastDay += tokensUsed;
    const responseContent = response.choices[0].message.content || "No response generated";
    console.log(responseContent);
    return responseContent;
  } 
  catch (error) {console.error('Error querying OpenAI:', error); throw error;}
}