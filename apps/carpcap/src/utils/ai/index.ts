import { XAI_BEARER_TOKEN } from '../../env';
import { model as grokModel } from '../../services/social/config'

// https://docs.coingecko.com/docs/mcp-server
// https://mcpservers.org/servers/token-metrics/mcp
// https://mcpservers.org/servers/aaronjmars/web3-research-mcp
// https://github.com/kukapay/cryptopanic-mcp-server
// https://github.com/sendaifun/solana-agent-kit/tree/v1-deprecated/examples/agent-kit-mcp-server

export interface GrokOptions {
  model?: string;
  temperature?: number;
  stream?: boolean;
  searchMode?: 'auto' | 'on' | 'off';
  returnCitations?: boolean;
  maxSearchResults?: number;
  fromDate?: string;
  toDate?: string;
  sources?: any[];
  keyword?: string;
  context?: string;
  allowedDomains?: string[];
  excludedDomains?: string[];
  allowedHandles?: string[];
  excludedHandles?: string[];
  enableImageUnderstanding?: boolean;
  enableVideoUnderstanding?: boolean;
  mcpServers?: { server_url: string; server_label: string }[];
}

export const queryGrok = async (messages: { role: string; content: string }[] | string, options: GrokOptions = {}) => {
  try {
    const {
      model = grokModel,
      temperature = 0.5,
      stream = false,
      searchMode = 'auto',
      returnCitations = false,
      maxSearchResults,
      fromDate,
      toDate,
      sources,
      keyword,
      context,
      allowedDomains,
      excludedDomains,
      allowedHandles,
      excludedHandles,
      enableImageUnderstanding,
      enableVideoUnderstanding,
      mcpServers
    } = options;
    const xaiHeaders = {'Content-Type': 'application/json', 'Authorization': `Bearer ${XAI_BEARER_TOKEN}`};
    let formattedMessages: { role: string; content: string }[];
    if (typeof messages === 'string' && keyword && context) {
      const formattedPrompt = prompt(keyword, context);
      if (!formattedPrompt) {throw new Error('Prompt cancelled or empty');}
      formattedMessages = [{ role: 'system', content: formattedPrompt }];
    } 
    else if (typeof messages === 'string') {formattedMessages = [{ role: 'user', content: messages }];} 
    else {formattedMessages = messages;}
    const hasAllowedDomains = Array.isArray(allowedDomains) && allowedDomains.length > 0;
    const hasExcludedDomains = Array.isArray(excludedDomains) && excludedDomains.length > 0;
    const hasAllowedHandles = Array.isArray(allowedHandles) && allowedHandles.length > 0;
    const hasExcludedHandles = Array.isArray(excludedHandles) && excludedHandles.length > 0;
    if (hasAllowedDomains && hasExcludedDomains) {throw new Error('Only one of allowedDomains or excludedDomains can be set.');}
    if (hasAllowedHandles && hasExcludedHandles) {throw new Error('Only one of allowedHandles or excludedHandles can be set.');}
    const wantsSearchTools = searchMode !== 'off' || hasAllowedDomains || hasExcludedDomains || hasAllowedHandles || hasExcludedHandles || !!fromDate || !!toDate || !!enableImageUnderstanding || !!enableVideoUnderstanding;
    const useTools = wantsSearchTools || !!mcpServers;
    let endpoint = 'https://api.x.ai/v1/chat/completions';
    let requestBody: any = { model, stream, temperature };
    if (useTools) {
      endpoint = 'https://api.x.ai/v1/responses';
      requestBody.input = formattedMessages;
      const tools: any[] = [];
      if (searchMode !== 'off' || hasAllowedDomains || hasExcludedDomains || enableImageUnderstanding) {
        const webSearchTool: any = { type: 'web_search' };
        const webSearchFilters: any = {};
        if (hasAllowedDomains) webSearchFilters.allowed_domains = allowedDomains;
        if (hasExcludedDomains) webSearchFilters.excluded_domains = excludedDomains;
        if (Object.keys(webSearchFilters).length > 0) webSearchTool.filters = webSearchFilters;
        if (enableImageUnderstanding) webSearchTool.enable_image_understanding = true;
        tools.push(webSearchTool);
      }
      if (hasAllowedHandles || hasExcludedHandles || fromDate || toDate || enableVideoUnderstanding) {
        const xSearchTool: any = { type: 'x_search' };
        if (hasAllowedHandles) xSearchTool.allowed_x_handles = allowedHandles.slice(0, 10);
        if (hasExcludedHandles) xSearchTool.excluded_x_handles = excludedHandles.slice(0, 10);
        if (enableVideoUnderstanding) xSearchTool.enable_video_understanding = true;
        if (enableImageUnderstanding) xSearchTool.enable_image_understanding = true;
        if (fromDate) xSearchTool.from_date = fromDate;
        if (toDate) xSearchTool.to_date = toDate;
        tools.push(xSearchTool);
      }
      if (mcpServers) {mcpServers.forEach(server => {tools.push({type: 'mcp', server_url: server.server_url, server_label: server.server_label});});}
      if (tools.length > 0) {requestBody.tools = tools;}
    } 
    else {
      requestBody.messages = formattedMessages;
    }
    const response = await fetch(endpoint, {method: 'POST', headers: xaiHeaders, body: JSON.stringify(requestBody)});
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Grok API Error (${response.status}):`, errorText);
      throw new Error(`Grok API Error: ${response.status} ${response.statusText} - ${errorText}`);
    }
    const data = await response.json();
    let responseContent = 'No response generated';
    if (data.choices?.[0]?.message?.content) {responseContent = data.choices[0].message.content;} 
    else if (data.messages?.[0]?.content) {responseContent = data.messages[0].content;} 
    else if (data.response) {responseContent = data.response;} 
    else if (data.output && Array.isArray(data.output)) {
      const messageWithContent = data.output.find((item: any) => item.content && Array.isArray(item.content));
      if (messageWithContent) {
        const textContent = messageWithContent.content.find((c: any) => c.type === 'output_text');
        if (textContent && textContent.text) {responseContent = textContent.text;}
      }
    }
    if (returnCitations) {const citations = data.citations || []; return { responseContent, citations };}
    return responseContent;
  } 
  catch (error) {console.error('Error calling Grok:', error); throw error;}
};
