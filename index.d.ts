import * as ts from "typescript";
declare function __fieldsOf<T>(): string[];
declare function __nameOf<T>(): string;
declare function extensionTransformerBuilder(program: ts.Program): ts.TransformerFactory<ts.SourceFile>