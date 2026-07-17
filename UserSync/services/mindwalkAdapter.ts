export type MindwalkTouchState = 'unvisited' | 'seen' | 'read' | 'edited' | 'limited';

export interface MindwalkNode {
  id: string;
  label: string;
  kind: 'tab' | 'subview' | 'persona' | 'limitation' | 'backend';
  state: MindwalkTouchState;
  x: number;
  y: number;
  intensity: number;
  llmPhrase: string;
  personaTags: string[];
  limitationIds: string[];
}

export interface MindwalkEdge {
  source: string;
  target: string;
  relation: 'navigates-to' | 'explains' | 'constrains' | 'calls-api';
}

export interface MindwalkGraph {
  nodes: MindwalkNode[];
  edges: MindwalkEdge[];
}

export interface PersonaProfile {
  id: string;
  label: string;
  goals: string[];
  limitations: string[];
}

export interface LimitationFunction {
  id: string;
  label: string;
  guardrail: string;
  injectInto: string[];
}

const personas: PersonaProfile[] = [
  {
    id: 'persona-growth-operator',
    label: 'Growth operator',
    goals: ['compare content variants', 'prioritize conversion signals', 'export evidence'],
    limitations: ['avoid destructive browser actions', 'require citation for claims'],
  },
  {
    id: 'persona-qa-reviewer',
    label: 'QA reviewer',
    goals: ['find regressions', 'replay UI paths', 'verify acceptance criteria'],
    limitations: ['do not bypass auth', 'stop when sensitive data is visible'],
  },
  {
    id: 'persona-data-steward',
    label: 'Data steward',
    goals: ['trace source records', 'explain graph provenance', 'minimize retained PII'],
    limitations: ['redact user secrets', 'persist only typed artifacts'],
  },
];

export const limitationFunctions: LimitationFunction[] = [
  {
    id: 'limit-safe-navigation',
    label: 'Safe navigation',
    guardrail: 'Only navigate, read, extract, and verify unless the active persona explicitly allows mutation.',
    injectInto: ['nova-act', 'graph'],
  },
  {
    id: 'limit-sensitive-fields',
    label: 'Sensitive-field pause',
    guardrail: 'Pause and request supervisor review before entering passwords, tokens, payment data, or private identifiers.',
    injectInto: ['nova-act', 'usersync', 'datahub'],
  },
  {
    id: 'limit-evidence-first',
    label: 'Evidence-first output',
    guardrail: 'Return file, DOM, API, or screenshot evidence with every persona-facing recommendation.',
    injectInto: ['dev', 'graph', 'oasis'],
  },
];

const tabPositions = {
  usersync: [0.15, 0.2],
  'nova-act': [0.5, 0.12],
  datahub: [0.82, 0.25],
  oasis: [0.18, 0.72],
  graph: [0.5, 0.82],
  dev: [0.82, 0.72],
} as const;

const subviewsByTab: Record<keyof typeof tabPositions, string[]> = {
  usersync: ['overview', 'simulation', 'personas', 'content'],
  'nova-act': ['studio', 'browser', 'qa', 'verify', 'mindwalk'],
  datahub: ['extract', 'warehouse', 'deploy'],
  oasis: ['network', 'trust'],
  graph: ['live', 'signals', 'mindwalk'],
  dev: ['api', 'events', 'status'],
};

export function buildMindwalkGraph(activeTab = 'nova-act', activeView = 'mindwalk'): MindwalkGraph {
  const nodes: MindwalkNode[] = [];
  const edges: MindwalkEdge[] = [];

  Object.entries(tabPositions).forEach(([tab, [x, y]]) => {
    const state: MindwalkTouchState = tab === activeTab ? 'edited' : 'seen';
    nodes.push({
      id: tab,
      label: tab,
      kind: 'tab',
      state,
      x,
      y,
      intensity: state === 'edited' ? 1 : 0.45,
      llmPhrase: `Workspace ${tab} maps user intent to available suite actions.`,
      personaTags: personas.map((persona) => persona.id),
      limitationIds: limitationFunctions.filter((limitation) => limitation.injectInto.includes(tab)).map((limitation) => limitation.id),
    });

    subviewsByTab[tab as keyof typeof tabPositions].forEach((subview, index) => {
      const angle = (Math.PI * 2 * index) / subviewsByTab[tab as keyof typeof tabPositions].length;
      const id = `${tab}:${subview}`;
      const isActive = tab === activeTab && subview === activeView;
      nodes.push({
        id,
        label: subview,
        kind: 'subview',
        state: isActive ? 'edited' : tab === activeTab ? 'read' : 'seen',
        x: x + Math.cos(angle) * 0.075,
        y: y + Math.sin(angle) * 0.075,
        intensity: isActive ? 1 : tab === activeTab ? 0.7 : 0.35,
        llmPhrase: `Subview ${subview} in ${tab} is a navigable UI state that can be summarized for Nova Act prompts.`,
        personaTags: personas.slice(0, 2).map((persona) => persona.id),
        limitationIds: limitationFunctions.filter((limitation) => limitation.injectInto.includes(tab)).map((limitation) => limitation.id),
      });
      edges.push({ source: tab, target: id, relation: 'navigates-to' });
    });
  });

  personas.forEach((persona, index) => {
    const id = persona.id;
    nodes.push({
      id,
      label: persona.label,
      kind: 'persona',
      state: 'read',
      x: 0.25 + index * 0.25,
      y: 0.5,
      intensity: 0.8,
      llmPhrase: `${persona.label}: goals ${persona.goals.join(', ')}; constraints ${persona.limitations.join(', ')}.`,
      personaTags: [id],
      limitationIds: limitationFunctions.map((limitation) => limitation.id),
    });
    edges.push({ source: 'usersync:personas', target: id, relation: 'explains' });
    edges.push({ source: id, target: 'nova-act:mindwalk', relation: 'explains' });
  });

  limitationFunctions.forEach((limitation, index) => {
    const id = limitation.id;
    nodes.push({
      id,
      label: limitation.label,
      kind: 'limitation',
      state: 'limited',
      x: 0.18 + index * 0.32,
      y: 0.94,
      intensity: 0.95,
      llmPhrase: limitation.guardrail,
      personaTags: personas.map((persona) => persona.id),
      limitationIds: [id],
    });
    limitation.injectInto.forEach((tab) => edges.push({ source: id, target: tab, relation: 'constrains' }));
  });

  edges.push({ source: 'nova-act:mindwalk', target: 'dev:api', relation: 'calls-api' });
  edges.push({ source: 'graph:mindwalk', target: 'datahub:warehouse', relation: 'calls-api' });

  return { nodes, edges };
}

export function buildNovaActPrompt(node: MindwalkNode): string {
  const personaContext = node.personaTags.join(', ') || 'general operator';
  const limitations = node.limitationIds.join(', ') || 'default-safe-navigation';
  return `Mindwalk navigation memory: ${node.llmPhrase} Persona context: ${personaContext}. Inject limitation functions: ${limitations}.`;
}
