export interface SourceConfig {apiKey: string; backfillEnabled?: boolean; maxPages?: number; outputDir?: string;}

export interface SourceResult {
    name: string;
    success: boolean;
    totalRounds: number;
    duration: number;
    error?: string;
}

export interface LlamaRaise {
    date: number;
    name: string;
    round: string;
    amount: number;
    chains: string[];
    sector: string;
    category: string;
    categoryGroup: string;
    source: string;
    leadInvestors: string[];
    otherInvestors: string[];
    valuation: number | null;
}

export interface DecentralisedCoRaise {
    _id: string;
    uuid: string;
    __v: number;
    announcedOn: string;
    createdAt: string;
    entityDefId: string;
    fundedOrganizationCategories: Array<{
        permalink: string;
        uuid: string;
        value: string;
        _id: string;
    }>;
    fundedOrganizationDescription: string;
    fundedOrganizationFundingStage: string;
    fundedOrganizationFundingTotal: {
        valueUsd: number;
        currency: string;
        value: number;
        _id: string;
    };
    fundedOrganizationIdentifier: {
        permalink: string;
        role: string;
        uuid: string;
        value: string;
        _id: string;
    };
    fundedOrganizationLocation: Array<{
        permalink: string;
        uuid: string;
        value: string;
        _id: string;
    }>;
    identifier: {
        permalink: string;
        imageId: string;
        uuid: string;
        value: string;
        _id: string;
    };
    imageId: string;
    include: boolean;
    investmentCategory: string;
    investmentStage: string;
    investmentType: string;
    investorIdentifiers: Array<{
        permalink: string;
        role: string;
        uuid: string;
        value: string;
        _id: string;
        name: string;
        urlSlug: string;
        imageUrl: string;
    }>;
    isEquity: boolean;
    leadInvestorIdentifiers: Array<{
        permalink: string;
        uuid: string;
        value: string;
        _id: string;
        name: string;
        urlSlug: string;
        imageUrl: string;
    }>;
    moneyRaised: {
        valueUsd: number;
        currency: string;
        value: number;
        _id: string;
    };
    name: string;
    numInvestors: number;
    organizationUuid: string;
    permalink: string;
    recentlyAdded: boolean;
    shortDescription: string;
    updatedAt: string;
    companyData: {
        website: { value: string; _id: string };
        linkedIn: { value: string; _id: string };
        twitter: { value: string; _id: string };
        facebook: { value: string; _id: string };
    };
    imageUrl: string;
    founders: Array<{
        firstName: string;
        lastName: string;
        linkedIn: { value: string; _id: string };
    }>;
    secondaryCryptoCategory: string;
    cryptoInfrastructure: boolean;
    cryptoChain: string;
    primaryCryptoCategory: string;
    categoryChecked: boolean;
    urlSlug: string;
}

export interface IcoDropsRaise {
    name: string;
    round: string;
    amount: number | null;
    valuation: number | null;
    date: string;
    category: string;
    investors: string[];
    ecosystem: string[];
    link: string;
    pageFetched: number;
}

export interface CryptoRankRaise {
    name: string;
    round: string;
    amount: number | null;
    valuation: number | null;
    date: string;
    category: string;
    blockchain: string[];
    investors: string[];
    link: string;
    pageFetched: number;
}

export interface UnifiedRaise {
    date: string;
    project_name: string;
    sector: string;
    subsector: string;
    round_type: string;
    round: string;
    amount: number | null;
    valuation: number | null;
    ecosystem: string;
    investors: string;
    sources: string[];
    original_ids: string[];
}