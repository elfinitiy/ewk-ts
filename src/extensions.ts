import * as ts from "typescript";
import { ILog, getLog, TValueContainer } from "./globals";

const EXTENSION_NAME_OF = "__nameOf";
const EXTENSION_FIELDS_OF = "__fieldsOf";

let Log: ILog = {} as any;
let tsProgram: ts.Program = {} as any; //Rly rly unsafe
let tsTypeChecker: ts.TypeChecker = {} as any;
let tsContext: ts.TransformationContext = {} as any; // unsafe
export function extensionTransformerBuilder(program: ts.Program): ts.TransformerFactory<ts.SourceFile> {
	Log = getLog();
    tsProgram = program;
    tsTypeChecker = tsProgram.getTypeChecker();
    return extensionTransformer;
}

function extensionTransformer(context: ts.TransformationContext) {
    tsContext = context;
    return handleTransormations;
}

function handleTransormations(source: ts.SourceFile): ts.SourceFile {
    return ts.visitNode(source, nodeVisitor);
}

function nodeVisitor(node: ts.Node): ts.Node {
    if(node.kind == ts.SyntaxKind.CallExpression) {
        return handleAnyCall(node as ts.CallExpression);
    }
    return ts.visitEachChild(node, nodeVisitor, tsContext);
}

function handleAnyCall(node: ts.CallExpression) {
    let expression = node.expression; 
    if(expression.kind == ts.SyntaxKind.PropertyAccessExpression) {
        return ts.visitEachChild(node, nodeVisitor, tsContext);
    }

    if(expression.kind != ts.SyntaxKind.Identifier) {
        return node;
    }

    const expressionIdentifier = (expression as ts.Identifier).text;
    let resultNode: ts.Node;
    if(expressionIdentifier == EXTENSION_FIELDS_OF) {
        resultNode = handleExtensionFieldsOf(node);

    } else if(expressionIdentifier == EXTENSION_NAME_OF) {
        resultNode = handleExtensionNameOf(node);
    } else {
        resultNode = ts.visitEachChild(node, nodeVisitor, tsContext);
    }

    return resultNode;
}

function handleSharedTypeAccess(node: ts.CallExpression): TValueContainer<ts.TypeNode> {
    const result: TValueContainer<ts.TypeNode> = {hasValue: false, value: undefined}
    const typeArguments = node.typeArguments;

    if(typeArguments == undefined) {
        Log.warn("Using %s without a type argument exiting", EXTENSION_FIELDS_OF);

        return result;
    }

    if(typeArguments.length != 1) {
        Log.warn("Type argument count is %d but exactly 1 required", typeArguments.length);

        return result;
    }

    const firstTypeArgument = typeArguments[0];
    const kind = firstTypeArgument.kind;
    if(kind != ts.SyntaxKind.TypeReference && kind != ts.SyntaxKind.IntersectionType && kind != ts.SyntaxKind.UnionType) {
        Log.warn("Type argument is %s but TypeReference required", nodeToKindText(firstTypeArgument));

        return result;
    }

    result.hasValue = true;
    result.value = firstTypeArgument;
    return result;
}

function handleExtensionFieldsOf(node: ts.CallExpression) {
    const {hasValue, value} = handleSharedTypeAccess(node);
    if(!hasValue) {
        return node;
    }

    const typeArgument = value!!; //no idea how to explain to TS that hasValue==true is the condition required for this to not be undefine
    const type = tsTypeChecker.getTypeAtLocation(typeArgument);
    const symbolsToHandle: ts.Symbol[] = [];
    let isDiscriminatedUnion = false;
    if(type.flags == ts.TypeFlags.Intersection) {
        for(let intersectionType of (type as ts.IntersectionType).types) {
            symbolsToHandle.push(intersectionType.symbol);
        }
    } else if(type.flags == ts.TypeFlags.Union) {
        for(let intersectionType of (type as ts.UnionType).types) {
            symbolsToHandle.push(intersectionType.symbol);
        }

        isDiscriminatedUnion = true;
    } else {
        symbolsToHandle.push(type.symbol);
    }

    const symbolNameToCount: {[key: string]: number} = {};
    let allSymbolMembers: ts.StringLiteral[] = [];
    for(let symbol of symbolsToHandle) {
        const { hasValue, value } = symbolMembersToArray(symbol);
        if(!hasValue) {
            return node; //We dont handle this partially, can be a source of bugs
        }

        if(!isDiscriminatedUnion) {
            allSymbolMembers.push(...value!!);
            continue;
        }

        for(let literal of value!!) {
            const literalText = literal.text;
            if(!(literalText in symbolNameToCount)) {
                symbolNameToCount[literalText] = 1;
                continue;
            }

            symbolNameToCount[literalText]++;
        }
    }

    if(isDiscriminatedUnion) {
        for(let key in symbolNameToCount) {
            const count = symbolNameToCount[key];
            if(count == symbolsToHandle.length) {
                allSymbolMembers.push(ts.createStringLiteral(key)); //Not optimized
            }
        }
    }
   
    return ts.createArrayLiteral(allSymbolMembers);
}

function handleExtensionNameOf(node: ts.CallExpression) {
    const { hasValue, value } = handleSharedTypeAccess(node);
    if(!hasValue) {
        return node;
    }

    const typeArgument = value!!;
    const type = tsTypeChecker.getTypeAtLocation(typeArgument);
    const symbol = type.symbol;
    const typeName = symbol.name;

    return ts.createStringLiteral(typeName);
}

function symbolMembersToArray(symbol: ts.Symbol): TValueContainer<ts.StringLiteral[]> {
    const result: TValueContainer<ts.StringLiteral[]> = {hasValue: false, value: undefined};
    const members = symbol.members;
    if(members == null) {
        Log.info("Symbol %s has no members", symbol.name);
        return result;
    }

    const allMembers: ts.SymbolTable[] = []; 
    const literalList: ts.StringLiteral[] = [];
    const declarations = symbol.declarations;
    for(let declaration of declarations) {
        if(declaration.kind != ts.SyntaxKind.InterfaceDeclaration) {
            continue;
        }
        
        const interfaceDeclaration = declaration as ts.InterfaceDeclaration;
        const heritageClauses = interfaceDeclaration.heritageClauses;
        if(heritageClauses == null) {
            continue;
        }

        for(let heritageClause of heritageClauses) {
            const types = heritageClause.types;
            for(let type of types) {
                const typeNode = tsTypeChecker.getTypeAtLocation(type);
                const heritageSymbol = typeNode.symbol;
                if(heritageSymbol.members == null) {
                    Log.info("Symbol %s has no members", symbol.name);
                    return result;
                }

                allMembers.push(heritageSymbol.members);
            }
        }
    }

    allMembers.push(members);
    

    for(let symbolMembers of allMembers) {
        symbolMembers.forEach((sym, key) => {
            literalList.push(ts.createStringLiteral(sym.name));
        });
    }
 

    result.hasValue = true;
    result.value = literalList;

    return result;
}

function nodeToKindText(node: ts.Node) {
    return ts.SyntaxKind[node.kind];
}