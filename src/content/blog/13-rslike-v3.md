---
title: "RSLike@3. Well-known Symbols, Improved TypeScript, and Bundlefobia..."
description: "Not long ago, I released a library that was meant to eliminate errors related to null and undefined. Honestly, I decided ..."
pubDate: 2024-04-12
hero: "../../assets/images/13-rslike-logo.png"
heroAlt: "rs-like logo"
---

Not long ago, I released a library that was meant to eliminate errors related to **`null`** and **`undefined`**. Honestly, I admit that I decided to borrow from Rust's [Option](https://doc.rust-lang.org/std/option/) and [Result](https://doc.rust-lang.org/std/result/index.html) APIs, as I saw potential and convenience in it!

To briefly recount the history of creating this marvel, while studying Rust, I saw the potential of these wrappers. And after being inspired, I decided to write such a marvel myself for JavaScript and use it in my projects (more on that later). Quite quickly, version [1](https://github.com/vitalics/rslike/releases/tag/1.0.0) appeared, followed by a bunch of fixes ([here](https://github.com/vitalics/rslike/releases/tag/%40rslike%2Fstd%401.6.0)), then version [2](https://github.com/vitalics/rslike/releases/tag/%40rslike%2Fstd%402.0.0) emerged, introducing the **`cmp`** package and **`dbg`**. And only recently (April 10, 2024), version 3 for all packages saw the light of day: [std](https://github.com/vitalics/rslike/releases/tag/%40rslike%2Fstd%403.0.0), [cmp](https://github.com/vitalics/rslike/releases/tag/%40rslike%2Fcmp%403.0.0), [dbg](https://github.com/vitalics/rslike/releases/tag/%40rslike%2Fdbg%403.0.0).

## **Introduction to rslike**

[Rslike](https://github.com/vitalics/rslike) is a library that allows avoiding errors with the use of null, undefined, and errors through 2 main classes - **`Option`** and **`Result`**.

**`Option<T>`** - is intended for code that can be **`null`** and/or **`undefined`**. The **`Some`** and **`None`** functions allow wrapping a value, and later, where needed, one can return the value using the **`unwrap`** and **`expect`** functions, or check the presence of a variable value using the **`isSome`**, **`isNone`** functions.

For convenience, I'll show what will be called not as **`Option`** but as **`Some`**, or **`None`**

```tsx
// filename: index.ts
Some(); // None<undefined>
Some(3); // Some<3>
Some<number>(3); // Some<number>
Some(undefined); //! None<undefined>
Some<number>(undefined); //! None<number>

None(); // None<undefined>
None(null); // None<null>
None(3); // None<number>
```

**`Result<T,E>`** - is intended for working with code that can "crash". To avoid unexpected crashes, it is desirable to consider all execution options of the function, or wrap it in **`Bind`** to make the function "safe" by returning **`Result<Option<T>, E>`**. Where **`T`** and **`E`** are generics that you can pass to the function.

```tsx
// filename: index.ts
Ok(3); // Result<3, unknown>
Ok<number>(3); // Result<number, unknown>
Ok(undefined); // Result<undefined, unknown>

Err(undefined); // Result<unkown, undefined>
Err<number>("hello world"); // Result<number, string>
Err(new Error("hello world")); // Result<unkown, Error>
```

Also, thanks to the useful functions **`Bind`** and **`Async`**, functions and asynchronous code can be made safe, because the result will use double wrapping in **`Result<Option<T>, E>`**

```tsx
// filename: index.ts
import { Bind, Async } from "@rslike/std";
function external(arg1: any, arg2: any): any {
  // some implementation, can throw
}
external(1, 2); // ok. e.g. returns 5
external(1, NaN); // throws Error

const binded = Bind(external);
binded(1, 2); // Ok(Some(5))
binded(1, NaN); // Err(Error)

const promiseOk = Promise.resolve(5);
const safePromise1 = await Async(promiseOk); // Ok(Some(5))

safePromise1.isErr(); // false
safePromise1.isOk(); // true

const promiseErr = Promise.reject("I fails unexpectedly");
const safePromise2 = await Async(promiseErr); // Err('I fails unexpectedly')

safePromise2.isErr(); // true
safePromise2.isOk(); // false
```

And now to what has been changed.

## **Std. Well-known Symbols**

For convenience of use, many [Well-known Symbols](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Symbol#well-known_symbols) had to be implemented.

These symbols include:

- Symbol.iterator
- Symbol.asyncIterator
- Symbol.search
- Symbol.split
- Symbol.toPrimitive
- Symbol.toStringTag
- Symbol.inspect (yes, I know it's not well-known and is used exclusively for the [inspect](https://nodejs.org/api/util.html#utilinspectcustom) function in node.js. Why not?)

The simplest example of usage is using the **`for...of`** loop.

Before version 3, it was necessary to use **`unwrap`**

```tsx
// filename: v2.ts
import { Some } from "@rslike/std";

const a = Some([1, 2, 3]);

for (let el of a.unwrap()) {
  // el: 1,2,3
}
```

Since version 3, syntactic sugar without using unwrap is now available. It's a small thing, but nice 🙃.

```tsx
// filename: v3.ts
import { Some } from "@rslike/std";
const a = Some([1, 2, 3]);

for (let el of a) {
  // el: 1,2,3
}
```

Bonus - TS Type inferring. If the type inside **`Option`** or **`Result`** is not iterable, it will be **`never`**. And also, **`UndefinedBehaviorError`** will be thrown at runtime because a number does not have an implementation of **`Symbol.iterator`** (this method is specifically called for the wrapped value).

```tsx
// filename: v3.ts
import { Some } from "@rslike/std";

const a = Some(3);
for (let el of a) {
  // el: never
}
```

## **STD. instanceof for Some, None, Err, Ok**

To avoid importing an unnecessary class for just one **`instanceof`** check, [Symbol.hasInstance](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Symbol/hasInstance) was implemented for the Some, None, OK, and Err functions.

Let's look at an example before version 3.

```tsx
// filename: v2.ts
import { Ok, Result } from "@rslike/std";
const a = Ok(3);
a instanceof Result; // true
a instanceof Ok; // false
```

And now an example after (`Result` importing is not required).

```tsx
// filename: v3.ts
import { Ok, Err } from "@rslike/std";
const a = Ok(3);
a instanceof Ok; // true
a instanceof Err; // false
```

Yes, it's syntactic sugar to avoid unnecessary imports.

## **STD. TS types**

A separate personal pride - TypeScript and its computed types. Now in **`Some`**, **`None`**, **`Ok`**, **`Err`**, not just generics are passed, but constant generics. This allowed for some tricks. And in cases where we cannot determine the type (or it's more general), the previous implementation will be called.

```tsx
// filename: v3.ts
import { Some } from "@rslike/std";

let a: number = 5;
const a = Some(a); // Some<number>

a.isSome(); // boolean

let b: number = 5;
const c = Some(b); // Some<number>

a.isSome(); // boolean
```

But it didn't go without problems. I just can't overcome the issue of mutating the value inside the class. For example, the **`replace`** method - should mutate the value (yes, it does mutate). But how to make TypeScript allow mutating types for the class - that's a riddle 🧐. (if you know - write a comment or message me privately, contact me at the end of the article).

## **STD. match and double unwrap**

In the std package, in addition to **`Option`** and **`Result`**, there are also some utilities, such as **`Bind`**, **`Async`**, and **`match`**. While **`Bind`** and **`Async`** remain unchanged, the **`match`** function, on the contrary, acquired a useful feature - calling unwrap twice for **`Result<Option>`**. This allowed the code in the project to be halved using **`match`**.

Let's compare how it was before (67 lines)

```tsx
// filename: v2.ts
import { Bind, match, Err, Ok } from "@rslike/std";

function divide(a: number, b: number) {
  if (b === 0) Err("Divide to zero");
  if (a === 0) Ok(0);
  if (Number.isNaN(a) || Number.isNaN(b)) return Err(undefined);
  return a / b;
}

const binded = Bind(divide);
const fn1 = binded(1, 1); // Result<Option<number | undefined>, string>
const fn2 = binded(NaN, 1); // Result<Option<undefined>, string>

const res1 = match(
  fn1, // or fn2
  (res) => {
    return match(
      res,
      (value) => {
        console.log("value is:", value);
      },
      () => {
        console.log("value is None");
      },
    );
  },
  (err) => {
    console.error(err);
  },
);

console.log(res1); // value is: 1
console.log(res2); // value is None
```

You can notice that the match function is called twice here. It would be simpler to just check for **`isOk`** and **`isSome`**, and the code would be shorter.

Starting from version 3 (27 lines)

```tsx
// filename: v3.ts
import { Bind, match, Err, Ok } from "@rslike/std";

function divide(a: number, b: number) {
  if (b === 0) Err("Divide to zero");
  if (a === 0) Ok(0);
  if (Number.isNaN(a) || Number.isNaN(b)) return Err(undefined);
  return a / b;
}

const binded = Bind(divide);
const fn1 = binded(1, 1); // Result<Option<number | undefined>, string>
const fn2 = binded(NaN, 1); // Result<Option<undefined>, string>

const res1 = match(
  fn1, // or fn2
  (value) => {
    console.log("value is:", value);
  },
  (err) => {
    if (err) console.error(err);
    else console.log("value is None");
  },
);

res1; // value is: 1
// or res2 - value is None
```

## **Cmp**

For the package intended for comparison (cmp or comparison package), the methods **`equals`**, **`partialEquals`**, and **`compare`** were removed from the interfaces for **`Eq`**, **`PartialEq`**, and **`Ord`**. Instead, the interfaces require the implementation of **`Symbol.equals`**, **`Symbol.partialEquals`**, and **`Symbol.compare`**, respectively.

```tsx
// filename: v3.ts
import { type Eq, equals } from "@rslike/cmp";

class Author implements Eq {
  constructor(readonly name: string) {}

  [Symbol.equals](another: unknown) {
    return another instanceof Author && this.name === another.name;
  }
}

const pushkin = new Author("Pushkin");
const tolkien = new Author("Tolkien");

pushin[Symbol.equals](tolkien); // false
pushin[Symbol.equals](new Author("Pushkin")); // true

// or you can call the utility function
equals(pushkin, tolkien); // false
equals(pushkin, new Author("Pushkin")); // true
```

As a bonus, these well-known symbols are defined for the following global objects:

- Number
- String
- Boolean
- Date

## **Usage in the Project**

Version 3 emerged because I started using my own library at my current workplace. In short, I needed to implement a CLI in Node.js to fetch data from the server and save it to a file. This code resides within the project itself and is atomic and devoid of imports from the project (except for npm libraries). Additionally, I was given complete creative freedom for this task in terms of implementation, approaches, libraries, and ~~coding style~~. It was also desirable to ensure that the entire code fits into one file and not to inflate the CLI with multiple models, arguments, etc. Said and done.

The file itself fits into 500 lines of formatted code. Helpers (like axios instance, paths, and error code descriptions) take up ~250 lines of formatted code. So, a total of ~250 lines of logic. There are 5 commands:

- login
- logout
- ls - to list all environment variables on the server
- get - to fetch info from the server based on parameters and write to a file
- ctl - similar to get but instead of writing to a file, it passes the information obtained from the server as an argument to the command provided. For example, **`program ctl 'npm run tests'`**. The env information will be passed to tests.

I tried rewriting this file without using rslike and ended up with ~20% more code because this code is mostly checks for **`null`**, **`undefined`**, and **`try catch finally`**. For example, whether an argument was passed or not. Therefore, I consider my library quite successful.

## **In Conclusion**

In conclusion, I would like to add that the release itself turned out to be quite significant in terms of the number of changes.

![massive update](https://habrastorage.org/getpro/habr/upload_files/2ae/7ee/755/2ae7ee75560df9ea5d1a0a1189c71170.png)

Due to this, the output bundle could not help but increase. If you look at [bundlephobia](https://bundlephobia.com/package/@rslike/std@3.0.0), you can notice its "voracity". Unlike version 2, of course, JSDoc forms the basis, which has increased due to examples and the exceptions that will be thrown, as well as more complex TS typing to make it easier and more convenient for end users!

![8.3kB v2 & 12.6kB v3](https://habrastorage.org/getpro/habr/upload_files/007/62c/2bb/00762c2bbf85f376fb5516540de48f67.png)

## Contacts

As promised — my contact information.

rslike in GitHub — https://github.com/vitalics/rslike

Github — https://github.com/vitalics

Telegram — https://t.me/vitalicset
