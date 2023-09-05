---
title: "@rslike/dbg: Debug your variables like never before!"
description: At this article I'll share about printing debug information
pubDate: 2023-09-05
# updatedDate: 2023-09-05
hero: "../../assets/images/08-console-log-hero.png"
heroAlt: "console.log"
---


Today, I'm gonna show you how to print your variables for forget about `console.log`.

## The problem

Assume that you have a variable. What you does to print information? I suppose something like that:

```typescript
// some.ts
const a = 123;

// somewhere after

console.log("a:", a); // a: 123
```

But what if variable name will be changed, or you would need to change the text for `log` function.

## The Solution

Let me introduce [`@rslike/dbg`](https://www.npmjs.com/package/@rslike/dbg) package. This package is a part of the global `rslike` repository.

How to install:

```bash
npm install @rslike/dbg
# or via yarn
yarn add @rslike/dbg
# or via pnpm
pnpm add @rslike/dbg
```

Usage:

```ts
// some.ts
import { dbg } from '@rslike/dbg'

const variable = 123;

dbg(() => variable) // dbg | variable: 123
```

Easy, isn't it?

## Advanced Usage

What if you would like to use another delimiter between variable name and value?

```ts
// advanced/delimiter.ts

import { dbg } from '@rslike/dbg'

const a = 123;
dbg(() => a, {delimiter: ':= '}) // "dbg | a:= 123"
```

What if you would like to change log function? That's easy

```ts
// advanced/output.ts
import { dbg } from '@rslike/dbg'

const a = 123;
dbg(() => a, {outputFunction: console.warn}) // in console waring: "dbg | a: 123"
```

You also can handle information by yourself:

```ts
// advanced/result.ts
import { dbg } from '@rslike/dbg'

const a = 123;
const result = dbg(() => a, {outputFunction: () => {}}) // nothing will be printed in console, since noop function declared

console.log(result)
/**
// result object
{
  name: 'a',
  result: 123,
  type: 'number' // from typeof operator
}
*/
```

## Anatomy of dbg

```ts
const a = 123;
const res = dbg(() => a, {outputFunction: () => {}, prefix: 'DEBUG | ', delimiter: ' = '});

res === {
"name": 'a' // variable name
"type": "number" // returns from typeof operator.
"value": 123 // variable value.
"prefix": 'DEBUG | ' // called prefix from options
"delimiter": " = " // called delimiter from options
"message": "DEBUG | a = 123"
//          ^prefix   ^delimiter
}
```

Where `message` is a message which you can call with your function.

Here is 2 related packages from `@rslike` org:

- [std](https://www.npmjs.com/package/@rslike/std)
- [cmp](https://www.npmjs.com/package/@rslike/cmp)

## Cheers
