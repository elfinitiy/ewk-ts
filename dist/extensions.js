"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ts = require("typescript");
const globals_1 = require("./globals");
const EXTENSION_NAME_OF = "__nameOf";
const EXTENSION_FIELDS_OF = "__fieldsOf";
let Log = {};
let tsProgram = {}; //Rly rly unsafe
let tsTypeChecker = {};
let tsContext = {}; // unsafe
function extensionTransformerBuilder(program) {
    Log = globals_1.getLog();
    tsProgram = program;
    tsTypeChecker = tsProgram.getTypeChecker();
    return extensionTransformer;
}
exports.extensionTransformerBuilder = extensionTransformerBuilder;
function extensionTransformer(context) {
    tsContext = context;
    return handleTransormations;
}
function handleTransormations(source) {
    return ts.visitNode(source, nodeVisitor);
}
function nodeVisitor(node) {
    if (node.kind == ts.SyntaxKind.CallExpression) {
        return handleAnyCall(node);
    }
    return ts.visitEachChild(node, nodeVisitor, tsContext);
}
function handleAnyCall(node) {
    let expression = node.expression;
    if (expression.kind == ts.SyntaxKind.PropertyAccessExpression) {
        return ts.visitEachChild(node, nodeVisitor, tsContext);
    }
    if (expression.kind != ts.SyntaxKind.Identifier) {
        return node;
    }
    const expressionIdentifier = expression.text;
    let resultNode;
    if (expressionIdentifier == EXTENSION_FIELDS_OF) {
        resultNode = handleExtensionFieldsOf(node);
    }
    else if (expressionIdentifier == EXTENSION_NAME_OF) {
        resultNode = handleExtensionNameOf(node);
    }
    else {
        resultNode = ts.visitEachChild(node, nodeVisitor, tsContext);
    }
    return resultNode;
}
function handleSharedTypeAccess(node) {
    const result = { hasValue: false, value: undefined };
    const typeArguments = node.typeArguments;
    if (typeArguments == undefined) {
        Log.warn("Using %s without a type argument exiting", EXTENSION_FIELDS_OF);
        return result;
    }
    if (typeArguments.length != 1) {
        Log.warn("Type argument count is %d but exactly 1 required", typeArguments.length);
        return result;
    }
    const firstTypeArgument = typeArguments[0];
    const kind = firstTypeArgument.kind;
    if (kind != ts.SyntaxKind.TypeReference && kind != ts.SyntaxKind.IntersectionType && kind != ts.SyntaxKind.UnionType) {
        Log.warn("Type argument is %s but TypeReference required", nodeToKindText(firstTypeArgument));
        return result;
    }
    result.hasValue = true;
    result.value = firstTypeArgument;
    return result;
}
function handleExtensionFieldsOf(node) {
    const { hasValue, value } = handleSharedTypeAccess(node);
    if (!hasValue) {
        return node;
    }
    const typeArgument = value; //no idea how to explain to TS that hasValue==true is the condition required for this to not be undefine
    const type = tsTypeChecker.getTypeAtLocation(typeArgument);
    const symbolsToHandle = [];
    let isDiscriminatedUnion = false;
    if (type.flags == ts.TypeFlags.Intersection) {
        for (let intersectionType of type.types) {
            symbolsToHandle.push(intersectionType.symbol);
        }
    }
    else if (type.flags == ts.TypeFlags.Union) {
        for (let intersectionType of type.types) {
            symbolsToHandle.push(intersectionType.symbol);
        }
        isDiscriminatedUnion = true;
    }
    else {
        symbolsToHandle.push(type.symbol);
    }
    const symbolNameToCount = {};
    let allSymbolMembers = [];
    for (let symbol of symbolsToHandle) {
        const { hasValue, value } = symbolMembersToArray(symbol);
        if (!hasValue) {
            return node; //We dont handle this partially, can be a source of bugs
        }
        if (!isDiscriminatedUnion) {
            allSymbolMembers.push(...value);
            continue;
        }
        for (let literal of value) {
            const literalText = literal.text;
            if (!(literalText in symbolNameToCount)) {
                symbolNameToCount[literalText] = 1;
                continue;
            }
            symbolNameToCount[literalText]++;
        }
    }
    if (isDiscriminatedUnion) {
        for (let key in symbolNameToCount) {
            const count = symbolNameToCount[key];
            if (count == symbolsToHandle.length) {
                allSymbolMembers.push(ts.createStringLiteral(key)); //Not optimized
            }
        }
    }
    return ts.createArrayLiteral(allSymbolMembers);
}
function handleExtensionNameOf(node) {
    const { hasValue, value } = handleSharedTypeAccess(node);
    if (!hasValue) {
        return node;
    }
    const typeArgument = value;
    const type = tsTypeChecker.getTypeAtLocation(typeArgument);
    const symbol = type.symbol;
    const typeName = symbol.name;
    return ts.createStringLiteral(typeName);
}
function symbolMembersToArray(symbol) {
    const result = { hasValue: false, value: undefined };
    const members = symbol.members;
    if (members == null) {
        Log.info("Symbol %s has no members", symbol.name);
        return result;
    }
    const allMembers = [];
    const literalList = [];
    const declarations = symbol.declarations;
    for (let declaration of declarations) {
        if (declaration.kind != ts.SyntaxKind.InterfaceDeclaration) {
            continue;
        }
        const interfaceDeclaration = declaration;
        const heritageClauses = interfaceDeclaration.heritageClauses;
        if (heritageClauses == null) {
            continue;
        }
        for (let heritageClause of heritageClauses) {
            const types = heritageClause.types;
            for (let type of types) {
                const typeNode = tsTypeChecker.getTypeAtLocation(type);
                const heritageSymbol = typeNode.symbol;
                if (heritageSymbol.members == null) {
                    Log.info("Symbol %s has no members", symbol.name);
                    return result;
                }
                allMembers.push(heritageSymbol.members);
            }
        }
    }
    allMembers.push(members);
    for (let symbolMembers of allMembers) {
        symbolMembers.forEach((sym, key) => {
            literalList.push(ts.createStringLiteral(sym.name));
        });
    }
    result.hasValue = true;
    result.value = literalList;
    return result;
}
function nodeToKindText(node) {
    return ts.SyntaxKind[node.kind];
}
