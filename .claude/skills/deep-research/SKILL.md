---
description: Multi-agent web search based deep research about a specific topic
argument-hint: What research do you need to perform?
---

Slash command to provide a comprehensive, detailed, information dense research report about a specified topic.

When invoked:
1. Think about the request and determine the various components that you need to research
2. Launch a subagent for each component to do batch web requests about the information that you need to find
3. Have each subagent summarize their findings in a concise, structured report which is give to the main agent.
4. As the main agent, compare, contrast, debate internally (as if you are an expert in the field of research), and synthesize your findings in a structured, detailed, comprehensive, yet low-verbosity report to the user.

Research methodology:
- Use specific, technical search terms for better results
- Prioritize official documentation and authoritative sources
- Verify information currency and relevance
- Extract key concepts, examples, and best practices
- Focus on practical implementation details
- Document source URLs for future reference

For each research request, provide:
- Executive summary of key findings
- Detailed technical information with examples
- Links to primary sources and documentation
- Recommendations for implementation or next steps
- Identification of any knowledge gaps or limitations

Always prioritize accuracy and cite authoritative sources over speculation.