export type ChatMsg = { role: "system" | "user" | "assistant"; content: string };

export type DealMemory = {
    customerName: string;
    company: string;
    industry: string;
    painPoints: string[];
    budget: string;
    timeline: string;
    objections: string[];
    nextSteps: string[];
};

export type FinalOutputs = {
    summaryBullets: string[];
    actionItems: { owner: "Rep" | "Customer"; item: string }[];
    followupEmail: string;
} | null;

export type AgentState = {
    messages: { role: "user" | "assistant"; content: string }[];
    rollingSummary: string;
    dealMemory: DealMemory;
    final: FinalOutputs;
    userTurnCount: number;
};

export const DEFAULT_DEAL_MEMORY: DealMemory = {
    customerName: "",
    company: "",
    industry: "",
    painPoints: [],
    budget: "",
    timeline: "",
    objections: [],
    nextSteps: [],
};

export const DEFAULT_STATE: AgentState = {
    messages: [],
    rollingSummary: "",
    dealMemory: DEFAULT_DEAL_MEMORY,
    final: null,
    userTurnCount: 0,
};
