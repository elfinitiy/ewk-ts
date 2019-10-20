# ewk-ts

TypeScript compiler extensions

## Features

 - Getting the fields of an interface
 - Getting the name of the interface

## Install

`yarn add ewk-ts` to install the package

## Usage
Simple pass `extensionTransformerBuilder` to the `before` category of your custom transformers

By calling `__fieldsOf<InterfaceOrTypeName>()`  we get a `string[]` with the names of all fields.

```typescript
interface User {
    id: number;
    email: string;
}
__fieldsOf<User>();
```

transforms into

```typescript
["id", "email"]
```

and than it gets transformed by the TypeScript compiler to JavaScript.

By calling `__nameOf<InterfaceOrTypeName>()` you get the name of the interface

```typescript
interface SuperUser {
    id: number;
    email: string;
}

__nameOf<SuperUser>();
```

will be transformed into 

```type
"SuperUser"
```



## Notes
 - Inheritance is supported
 - A discriminated union will contain only the fields shared by all types.
 - An intersection will contain all types. Warning, duplicates are not removed

## Author

Ruslan Cisa

<cisa.ruslan@gmail.com>

## License

MIT