export interface TrackedRepo {owner: string; repo: string; branch?: string; enabled?: boolean; filePatterns?: string[]; proposalType?: 'akash-aep' | 'helium-hip' | 'helium-hrp' | 'generic'; disableTweetGeneration?: boolean; notificationOnly?: boolean; csvColumnTracking?: boolean; csvNewColumnOnly?: boolean;}
export const GITHUB_CONFIG = {initialLookbackHours: 168, maxCommitsPerFetch: 100, enableNotifications: true, minCheckInterval: 30, ignoreFiles: ['README.md', 'LICENSE', '.gitignore', 'CONTRIBUTING.md']};

export const TRACKED_REPOS: TrackedRepo[] = [
  { owner: 'akash-network', repo: 'AEP', enabled: true, filePatterns: ['aep-*.md'], proposalType: 'akash-aep' },
  { owner: 'helium', repo: 'helium-release-proposals', enabled: true, filePatterns: ['*.md'], proposalType: 'helium-hrp' },
  { owner: 'helium', repo: 'HIP', enabled: true, filePatterns: ['*.md'], proposalType: 'helium-hip' },
  { owner: 'doublezerofoundation', repo: 'fees', enabled: true, filePatterns: ['fees_and_payments.csv'], notificationOnly: true, csvColumnTracking: true, csvNewColumnOnly: true },
  { owner: 'malbeclabs', repo: 'doublezero', enabled: true, filePatterns: ['rfcs/*'], notificationOnly: true },
  { owner: 'geodnet', repo: 'GIP', enabled: true, filePatterns: ['GIP*.md'], proposalType: 'generic', csvColumnTracking: true },
];