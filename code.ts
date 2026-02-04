const CONFIG = {
  searchValue: 0,
  targetCollectionName: 'Semantic',
  targetVariableName: 'size/0'
} as const;

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

void run();

async function run() {
  try {
    const selectedNode = getValidatedSelection();
    const targetVariable = await getTargetVariable();
    const components = getComponentsToProcess(selectedNode);

    const stats: RunStats = {
      componentsProcessed: components.length,
      nodesScanned: 0,
      fieldsUpdated: 0,
      staticMatchesIgnoredBecauseBound: 0,
      instancesSkipped: 0
    };

    for (const component of components) {
      scanNode(component, targetVariable, stats);
    }

    figma.closePlugin(
      `Done. Updated ${stats.fieldsUpdated} field(s) across ${stats.componentsProcessed} component(s). ` +
      `Scanned ${stats.nodesScanned} node(s), skipped ${stats.instancesSkipped} instance(s), ` +
      `ignored ${stats.staticMatchesIgnoredBecauseBound} already-bound match(es).`
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    figma.closePlugin(message);
  }
}

function getValidatedSelection(): ComponentNode | ComponentSetNode {
  const selection = figma.currentPage.selection;

  if (selection.length !== 1) {
    throw new Error('Select exactly one component or component set.');
  }

  const selected = selection[0];
  if (selected.type !== 'COMPONENT' && selected.type !== 'COMPONENT_SET') {
    throw new Error('This plugin only runs on components.');
  }

  return selected;
}

async function getTargetVariable(): Promise<Variable> {
  const collections = await figma.variables.getLocalVariableCollectionsAsync();
  const semanticCollection = collections.find(
    (collection) => collection.name === CONFIG.targetCollectionName
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

    const value = (nodeWithVariableBindings as Record<string, unknown>)[field];
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

  const allBoundVariables = node.boundVariables as Record<string, VariableAlias | undefined>;
  return {
    itemSpacing: allBoundVariables.itemSpacing,
    paddingTop: allBoundVariables.paddingTop,
    paddingRight: allBoundVariables.paddingRight,
    paddingBottom: allBoundVariables.paddingBottom,
    paddingLeft: allBoundVariables.paddingLeft
  };
}
