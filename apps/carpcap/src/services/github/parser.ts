export interface ParsedProposal {
  proposalNumber?: string;
  title?: string;
  status?: string;
  author?: string;
  created?: Date;
  type?: string;
  category?: string;
  summary?: string;
  motivation?: string;
  specification?: string;
}

export class ProposalParser {
  static parse(content: string, proposalType: string): ParsedProposal {
    switch (proposalType) {
      case 'akash-aep': return this.parseAkashAEP(content);
      case 'helium-hip': return this.parseHeliumHIP(content);
      case 'helium-hrp': return this.parseHeliumHRP(content);
      default: return this.parseGeneric(content);
    }
  }

  private static parseAkashAEP(content: string): ParsedProposal {
    const result: ParsedProposal = {};
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (frontmatterMatch) {
      const frontmatter = frontmatterMatch[1];
      result.proposalNumber = this.extractField(frontmatter, ['aep', 'number']);
      result.title = this.extractField(frontmatter, ['title']);
      result.status = this.extractField(frontmatter, ['status']);
      result.author = this.extractField(frontmatter, ['author', 'authors']);
      result.type = this.extractField(frontmatter, ['type']);
      result.category = this.extractField(frontmatter, ['category']);
      const createdStr = this.extractField(frontmatter, ['created', 'date']);
      if (createdStr) {result.created = new Date(createdStr);}
    }
    result.summary = this.extractSection(content, ['summary', 'abstract', 'simple summary']);
    result.motivation = this.extractSection(content, ['motivation', 'rationale']);
    result.specification = this.extractSection(content, ['specification', 'technical specification', 'implementation']);
    if (!result.title) {result.title = this.extractTitleFromContent(content);}
    if (!result.proposalNumber) {result.proposalNumber = this.extractProposalNumber(content, 'AEP');}
    return result;
  }

  private static parseHeliumHIP(content: string): ParsedProposal {
    const result: ParsedProposal = {};
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (frontmatterMatch) {
      const frontmatter = frontmatterMatch[1];
      result.proposalNumber = this.extractField(frontmatter, ['hip', 'hip-num', 'number']);
      result.title = this.extractField(frontmatter, ['title']);
      result.status = this.extractField(frontmatter, ['status']);
      result.author = this.extractField(frontmatter, ['author', 'authors']);
      result.type = this.extractField(frontmatter, ['type', 'hip-type']);
      result.category = this.extractField(frontmatter, ['category']);
      const createdStr = this.extractField(frontmatter, ['created', 'date', 'created-date']);
      if (createdStr) {result.created = new Date(createdStr);}
    }
    result.summary = this.extractSection(content, ['summary', 'abstract', 'simple summary']);
    result.motivation = this.extractSection(content, ['motivation', 'rationale', 'background']);
    result.specification = this.extractSection(content, ['specification', 'detailed explanation', 'technical implementation']);
    if (!result.title) {result.title = this.extractTitleFromContent(content);}
    if (!result.proposalNumber) {result.proposalNumber = this.extractProposalNumber(content, 'HIP');}
    return result;
  }

  private static parseHeliumHRP(content: string): ParsedProposal {
    const result: ParsedProposal = {};
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (frontmatterMatch) {
      const frontmatter = frontmatterMatch[1];
      result.proposalNumber = this.extractField(frontmatter, ['hrp', 'number']);
      result.title = this.extractField(frontmatter, ['title']);
      result.status = this.extractField(frontmatter, ['status']);
      result.author = this.extractField(frontmatter, ['author', 'authors']);
      result.type = this.extractField(frontmatter, ['type']);
      const createdStr = this.extractField(frontmatter, ['created', 'date']);
      if (createdStr) {result.created = new Date(createdStr);}
    }
    result.summary = this.extractSection(content, ['summary', 'overview']);
    result.motivation = this.extractSection(content, ['motivation', 'context']);
    result.specification = this.extractSection(content, ['changes', 'implementation', 'details']);
    if (!result.title) {result.title = this.extractTitleFromContent(content);}
    if (!result.proposalNumber) {result.proposalNumber = this.extractProposalNumber(content, 'HRP');}
    return result;
  }

  private static parseGeneric(content: string): ParsedProposal {
    const result: ParsedProposal = {};
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (frontmatterMatch) {
      const frontmatter = frontmatterMatch[1];
      result.title = this.extractField(frontmatter, ['title']);
      result.status = this.extractField(frontmatter, ['status']);
      result.author = this.extractField(frontmatter, ['author', 'authors']);
      result.type = this.extractField(frontmatter, ['type']);
      const createdStr = this.extractField(frontmatter, ['created', 'date']);
      if (createdStr) {result.created = new Date(createdStr);}
    }
    result.summary = this.extractSection(content, ['summary', 'abstract', 'overview']);
    result.motivation = this.extractSection(content, ['motivation', 'rationale', 'background']);
    result.specification = this.extractSection(content, ['specification', 'implementation', 'details']);
    if (!result.title) {result.title = this.extractTitleFromContent(content);}
    return result;
  }

  private static extractField(frontmatter: string, fieldNames: string[]): string | undefined {
    for (const fieldName of fieldNames) {
      const regex = new RegExp(`^${fieldName}\\s*:\\s*(.+?)\\s*$`, 'mi');
      const match = frontmatter.match(regex);
      if (match) {return match[1].trim().replace(/^["']|["']$/g, '');}
    }
    return undefined;
  }

  private static extractSection(content: string, sectionNames: string[]): string | undefined {
    for (const sectionName of sectionNames) {
      const regex = new RegExp(`#{1,3}\\s+${sectionName}\\s*\n([\\s\\S]*?)(?=\n#{1,3}\\s+|$)`, 'i');
      const match = content.match(regex);
      if (match) {return match[1].trim();}
    }
    return undefined;
  }

  private static extractTitleFromContent(content: string): string | undefined {
    const withoutFrontmatter = content.replace(/^---\n[\s\S]*?\n---\n/, '');
    const h1Match = withoutFrontmatter.match(/^#\s+(.+)$/m);
    if (h1Match) {return h1Match[1].trim();}
    return undefined;
  }

  private static extractProposalNumber(content: string, prefix: string): string | undefined {
    const regex = new RegExp(`${prefix}[\\s-]*(\\d+)`, 'i');
    const match = content.match(regex);
    if (match) {return `${prefix}-${match[1].padStart(3, '0')}`;}
    return undefined;
  }

  static isProposalFile(filename: string, patterns?: string[]): boolean {
    if (!patterns || patterns.length === 0) {return filename.endsWith('.md');}
    for (const pattern of patterns) {if (this.matchesPattern(filename, pattern)) {return true;}}
    return false;
  }

  private static matchesPattern(filename: string, pattern: string): boolean {
    const regexPattern = pattern.replace(/\./g, '\\.').replace(/\*/g, '.*').replace(/\?/g, '.');
    const regex = new RegExp(`^${regexPattern}$`, 'i');
    return regex.test(filename);
  }

  static parseCSVHeaders(content: string): string[] | null {
    if (!content || content.trim().length === 0) {return null;}
    const lines = content.split(/\r?\n/);
    if (lines.length === 0) {return null;}
    const firstLine = lines[0].trim();
    if (!firstLine) {return null;}
    const headers = firstLine.split(',').map(h => h.trim());
    if (headers.length === 0 || (headers.length === 1 && !headers[0])) {return null;}
    return headers;
  }

  static isCSVFile(filename: string): boolean {return filename.toLowerCase().endsWith('.csv');}
}