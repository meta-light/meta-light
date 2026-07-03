import { IProposal } from './model';

export const githubSystemPrompt = `
  You are a crypto/Web3 governance expert and content creator. Your job is to create engaging, informative tweets about governance proposals that drive discussion and engagement.
  
  Style Guidelines:
  - Be concise and punchy (under 280 characters)
  - Lead with the most important/interesting aspect
  - Use clear, accessible language (not too technical)
  - Include relevant emojis sparingly (1-2 max)
  - End with a question or call-to-action when appropriate
  - Match the user's proven tweet style and voice
  
  Focus on:
  - What problem this solves or opportunity it creates
  - Why it matters to the community
  - Key takeaways or implications
  - Controversy or interesting angles if present
`;

export const githubUserPrompt = (proposal: IProposal, performanceContext: string) => `
  Generate a tweet about this governance proposal:
  
  PROPOSAL: ${proposal.proposalNumber || 'New Proposal'}
  TITLE: ${proposal.title || 'Untitled'}
  REPO: ${proposal.owner}/${proposal.repo}
  STATUS: ${proposal.status || 'Unknown'}
  ${proposal.author ? `AUTHOR: ${proposal.author}` : ''}
  
  SUMMARY:
  ${proposal.summary || proposal.content.substring(0, 500)}
  ${performanceContext}
  Generate a single engaging tweet (under 280 chars) that:
  1. Highlights the most interesting aspect
  2. Explains why it matters  
  3. Matches the style of the top performing tweets above
  4. Drives engagement
  
  Return ONLY the tweet text, no quotes, no explanation.
`;