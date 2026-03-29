export type ObjectiveType =
  | "UI_TEXT_MATCH"
  | "ELEMENT_PRESENCE"
  | "ACTION_FLOW"
  | "NAVIGATION"
  | "VALIDATION"
  | "A11Y_RULE"
  | "API_STATUS";

export type Objective = {
  id: string;
  type: ObjectiveType;
  title: string;
  target: {
    roles?: string[];
    texts?: string[];
    notTexts?: string[];
    paths?: string[];
    selectors?: string[];
  };
  steps?: string[];
  expected?: string;
  expects: {
    exists?: boolean;
    textEquals?: string;
    navigatesToPath?: string;
    statusCode?: number;
    a11yRule?: string;
  };
  severity: "S1" | "S2" | "S3";
};

export type Scope = {
  allowedHosts: string[];
  allowedPaths?: string[];
  includeThirdParty: boolean;
  keywords: string[];
};

export type SynthesizedCase = {
  title: string;
  steps: string[];
  expected: string;
  priority?: string;
};

export type QualityScore = {
  score: number;
  label: "Low" | "Medium" | "High";
};
