const CONFIG = {
  searchValue: 0,
  targetCollectionName: 'semantic',
  targetVariableName: 'size/0'
} as const;

const IGNORE_PAGE_NAMES = [
  '🚩   Introduksjon',
  '🌈   Alle komponenter',
  ' $  Focus ',
  ' $  Colors',
  ' $  Typography',
  ' $  Size',
  ' $  Shadow',
  ' $  Border radius',
  ' $  Border width',
  '👀   Test',
  '---'
] as const;

type UiToPluginMessage =
  | { type: 'run-selection' }
  | { type: 'run-whole-file' };

type SpacingField =
  | 'itemSpacing'
  | 'paddingTop'
  | 'paddingRight'
  | 'paddingBottom'
  | 'paddingLeft';

const SPACING_FIELDS: readonly SpacingField[] = [
  'itemSpacing',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft'
];

type RunStats = {
  pagesScanned: number;
  pagesIgnored: number;
  componentsProcessed: number;
  nodesScanned: number;
  fieldsUpdated: number;
  staticMatchesIgnoredBecauseBound: number;
  instancesSkipped: number;
};

type NodeWithVariableBinding = SceneNode & {
  boundVariables?: Record<string, VariableAlias | undefined>;
  setBoundVariable: (field: VariableBindableNodeField, variable: Variable) => void;
  [key: string]: unknown;
};

let isRunning = false;

figma.showUI(__html__, { width: 380, height: 280, themeColors: true });

figma.ui.onmessage = async (msg: UiToPluginMessage) => {
  if (isRunning) {
    return;
  }

  isRunning = true;

  try {
    const targetVariable = await getTargetVariable();
    const stats = createEmptyStats();

    if (msg.type === 'run-selection') {
      postStatus('Scanning selected component...');
      const selectedNode = getValidatedSelection();
      const components = getComponentsToProcess(selectedNode);
      await zeronizeComponents(components, targetVariable, stats, 'selection');
    } else {
      postStatus('Loading pages...');
      await figma.loadAllPagesAsync();
      const components = await collectComponentsFromWholeFile(stats);
      await zeronizeComponents(components, targetVariable, stats, 'whole-file');
    }

    postDone(formatSummary(stats));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error.';
    postError(message);
  } finally {
    isRunning = false;
  }
};

function createEmptyStats(): RunStats {
  return {
    pagesScanned: 0,
    pagesIgnored: 0,
    componentsProcessed: 0,
    nodesScanned: 0,
    fieldsUpdated: 0,
    staticMatchesIgnoredBecauseBound: 0,
    instancesSkipped: 0
  };
}

function postStatus(message: string): void {
  figma.ui.postMessage({
    type: 'status',
    message
  });
}

function postDone(message: string): void {
  figma.ui.postMessage({
    type: 'done',
    message
  });
}

function postError(message: string): void {
  figma.ui.postMessage({
    type: 'error',
    message
  });
}

function getValidatedSelection(): ComponentNode | ComponentSetNode {
  const selection = figma.currentPage.selection;

  if (selection.length !== 1) {
    throw new Error('Select exactly one component or component set.');
  }

  const selected = selection[0];
  if (selected.type !== 'COMPONENT' && selected.type !== 'COMPONENT_SET') {
    throw new Error('This plugin only runs on components or component sets.');
  }

  return selected;
}

async function getTargetVariable(): Promise<Variable> {
  const collections = await figma.variables.getLocalVariableCollectionsAsync();
  const semanticCollection = collections.find(
    (collection) => collection.name.toLowerCase() === CONFIG.targetCollectionName
  );

  if (!semanticCollection) {
    throw new Error(`Missing variable collection "${CONFIG.targetCollectionName}".`);
  }

  const variables = await figma.variables.getLocalVariablesAsync();
  const matches = variables.filter(
    (variable) =>
      variable.variableCollectionId === semanticCollection.id &&
      variable.name === CONFIG.targetVariableName
  );

  if (matches.length === 0) {
    throw new Error(
      `Missing variable "${CONFIG.targetCollectionName}/${CONFIG.targetVariableName}".`
    );
  }

  if (matches.length > 1) {
    throw new Error(
      `Found multiple "${CONFIG.targetCollectionName}/${CONFIG.targetVariableName}" variables. Keep only one.`
    );
  }

  const [targetVariable] = matches;
  if (targetVariable.resolvedType !== 'FLOAT') {
    throw new Error(
      `Variable "${CONFIG.targetCollectionName}/${CONFIG.targetVariableName}" must be a number variable.`
    );
  }

  return targetVariable;
}

function getComponentsToProcess(
  selectedNode: ComponentNode | ComponentSetNode
): ComponentNode[] {
  if (selectedNode.type === 'COMPONENT') {
    return [selectedNode];
  }

  return selectedNode.children.filter(
    (child): child is ComponentNode => child.type === 'COMPONENT'
  );
}

async function collectComponentsFromWholeFile(stats: RunStats): Promise<ComponentNode[]> {
  const ignoredPageNames = new Set(IGNORE_PAGE_NAMES.map((name) => name.trim()));
  const components: ComponentNode[] = [];

  for (const page of figma.root.children) {
    if (ignoredPageNames.has(page.name.trim())) {
      stats.pagesIgnored += 1;
      continue;
    }

    stats.pagesScanned += 1;
    postStatus(`Scanning page ${stats.pagesScanned}: ${page.name}`);

    const pageComponents = page.findAllWithCriteria({ types: ['COMPONENT'] });
    components.push(...pageComponents);
    await yieldToFigma();
  }

  return components;
}

async function zeronizeComponents(
  components: ComponentNode[],
  targetVariable: Variable,
  stats: RunStats,
  mode: 'selection' | 'whole-file'
): Promise<void> {
  if (components.length === 0) {
    if (mode === 'selection') {
      throw new Error('No components found in the selected node.');
    }
    throw new Error('No components found in scanned pages.');
  }

  for (let i = 0; i < components.length; i += 1) {
    if (mode === 'whole-file' && (i === 0 || i % 25 === 0)) {
      postStatus(`Zeronizing components: ${i + 1}/${components.length}`);
      await yieldToFigma();
    }

    scanNode(components[i], targetVariable, stats);
    stats.componentsProcessed += 1;
  }
}

function scanNode(node: SceneNode, targetVariable: Variable, stats: RunStats): void {
  if (node.type === 'INSTANCE') {
    stats.instancesSkipped += 1;
    return;
  }

  stats.nodesScanned += 1;
  applySpacingVariableBindings(node, targetVariable, stats);

  if ('children' in node) {
    for (const child of node.children) {
      scanNode(child, targetVariable, stats);
    }
  }
}

function applySpacingVariableBindings(
  node: SceneNode,
  targetVariable: Variable,
  stats: RunStats
): void {
  if (!('setBoundVariable' in node) || typeof node.setBoundVariable !== 'function') {
    return;
  }

  const nodeWithVariableBindings = node as NodeWithVariableBinding;
  const boundVariables = getBoundVariableMap(nodeWithVariableBindings);

  for (const field of SPACING_FIELDS) {
    if (!(field in nodeWithVariableBindings)) {
      continue;
    }

    const value = nodeWithVariableBindings[field];
    if (typeof value !== 'number' || value !== CONFIG.searchValue) {
      continue;
    }

    if (boundVariables[field]) {
      stats.staticMatchesIgnoredBecauseBound += 1;
      continue;
    }

    nodeWithVariableBindings.setBoundVariable(field, targetVariable);
    stats.fieldsUpdated += 1;
  }
}

function getBoundVariableMap(
  node: NodeWithVariableBinding
): Partial<Record<SpacingField, VariableAlias>> {
  if (!('boundVariables' in node) || !node.boundVariables) {
    return {};
  }

  const allBoundVariables = node.boundVariables;
  return {
    itemSpacing: allBoundVariables.itemSpacing,
    paddingTop: allBoundVariables.paddingTop,
    paddingRight: allBoundVariables.paddingRight,
    paddingBottom: allBoundVariables.paddingBottom,
    paddingLeft: allBoundVariables.paddingLeft
  };
}

function formatSummary(stats: RunStats): string {
  const pagePart =
    stats.pagesScanned > 0 || stats.pagesIgnored > 0
      ? `Pages scanned: ${stats.pagesScanned}, ignored: ${stats.pagesIgnored}. `
      : '';

  return (
    `${pagePart}Updated ${stats.fieldsUpdated} field(s) in ${stats.componentsProcessed} component(s). ` +
    `Scanned ${stats.nodesScanned} node(s), skipped ${stats.instancesSkipped} instance(s), ` +
    `ignored ${stats.staticMatchesIgnoredBecauseBound} already-bound match(es).`
  );
}

function yieldToFigma(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}
