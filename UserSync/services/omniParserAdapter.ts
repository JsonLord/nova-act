export interface OmniParserElement {
  id: string;
  type: 'button' | 'input' | 'link' | 'panel' | 'graph-node' | 'text';
  label: string;
  bbox: [number, number, number, number];
  interactable: boolean;
  description: string;
}

export interface OmniParserTransition {
  source: 'microsoft/OmniParser-adapter';
  screenshotId: string;
  elements: OmniParserElement[];
  llmLanguage: string;
}

export function buildOmniParserTransition(screenName: string, elements: OmniParserElement[]): OmniParserTransition {
  const interactable = elements.filter((element) => element.interactable);
  const llmLanguage = [
    `Screen: ${screenName}.`,
    `Detected ${elements.length} UI elements; ${interactable.length} are interactable.`,
    ...interactable.map((element) => `Use ${element.type} "${element.label}" at bbox [${element.bbox.join(', ')}] to ${element.description}.`),
  ].join(' ');

  return {
    source: 'microsoft/OmniParser-adapter',
    screenshotId: `${screenName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-synthetic`,
    elements,
    llmLanguage,
  };
}

export function buildSuiteOmniParserElements(activeTab: string, activeView: string): OmniParserElement[] {
  return [
    {
      id: 'main-tab',
      type: 'button',
      label: activeTab,
      bbox: [8, 6, 18, 11],
      interactable: true,
      description: `open the ${activeTab} workspace`,
    },
    {
      id: 'subview-slider',
      type: 'panel',
      label: `${activeView} subview slider`,
      bbox: [3, 13, 96, 25],
      interactable: true,
      description: `switch between sorted subviews inside ${activeTab}`,
    },
    {
      id: 'mindwalk-graph',
      type: 'graph-node',
      label: 'Mindwalk navigation graph',
      bbox: [5, 28, 62, 92],
      interactable: true,
      description: 'select UI touch-state nodes to generate Nova Act prompt context',
    },
    {
      id: 'limitations-button',
      type: 'button',
      label: 'Inject selected limitations',
      bbox: [72, 19, 94, 25],
      interactable: true,
      description: 'inject persona-specific limitation functions into the Nova Act context',
    },
  ];
}
