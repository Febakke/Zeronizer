"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
const CONFIG = {
    searchValue: 0,
    targetCollectionName: 'Semantic',
    targetVariableName: 'size/0'
};
const SPACING_FIELDS = [
    'itemSpacing',
    'paddingTop',
    'paddingRight',
    'paddingBottom',
    'paddingLeft'
];
void run();
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const selectedNode = getValidatedSelection();
            const targetVariable = yield getTargetVariable();
            const components = getComponentsToProcess(selectedNode);
            const stats = {
                componentsProcessed: components.length,
                nodesScanned: 0,
                fieldsUpdated: 0,
                staticMatchesIgnoredBecauseBound: 0,
                instancesSkipped: 0
            };
            for (const component of components) {
                scanNode(component, targetVariable, stats);
            }
            figma.closePlugin(`Done. Updated ${stats.fieldsUpdated} field(s) across ${stats.componentsProcessed} component(s). ` +
                `Scanned ${stats.nodesScanned} node(s), skipped ${stats.instancesSkipped} instance(s), ` +
                `ignored ${stats.staticMatchesIgnoredBecauseBound} already-bound match(es).`);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            figma.closePlugin(message);
        }
    });
}
function getValidatedSelection() {
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
function getTargetVariable() {
    return __awaiter(this, void 0, void 0, function* () {
        const collections = yield figma.variables.getLocalVariableCollectionsAsync();
        const semanticCollection = collections.find((collection) => collection.name === CONFIG.targetCollectionName);
        if (!semanticCollection) {
            throw new Error(`Missing variable collection "${CONFIG.targetCollectionName}".`);
        }
        const variables = yield figma.variables.getLocalVariablesAsync();
        const matches = variables.filter((variable) => variable.variableCollectionId === semanticCollection.id &&
            variable.name === CONFIG.targetVariableName);
        if (matches.length === 0) {
            throw new Error(`Missing variable "${CONFIG.targetCollectionName}/${CONFIG.targetVariableName}".`);
        }
        if (matches.length > 1) {
            throw new Error(`Found multiple "${CONFIG.targetCollectionName}/${CONFIG.targetVariableName}" variables. Keep only one.`);
        }
        const [targetVariable] = matches;
        if (targetVariable.resolvedType !== 'FLOAT') {
            throw new Error(`Variable "${CONFIG.targetCollectionName}/${CONFIG.targetVariableName}" must be a number variable.`);
        }
        return targetVariable;
    });
}
function getComponentsToProcess(selectedNode) {
    if (selectedNode.type === 'COMPONENT') {
        return [selectedNode];
    }
    return selectedNode.children.filter((child) => child.type === 'COMPONENT');
}
function scanNode(node, targetVariable, stats) {
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
function applySpacingVariableBindings(node, targetVariable, stats) {
    if (!('setBoundVariable' in node) || typeof node.setBoundVariable !== 'function') {
        return;
    }
    const nodeWithVariableBindings = node;
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
function getBoundVariableMap(node) {
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
