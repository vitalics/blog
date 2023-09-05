---
title: It's done! Rust-like API in your JavaScript code
description: Library witch handle undefined behavior
pubDate: 2023-08-08
updatedDate: 2023-08-09
hero: "../../assets/images/06-rslike-hero.webp"
heroAlt: "rust like"
---

Hello, my name is Vitali. I'm love to learning things. A few months ago I'll start learning Rust and I was impressive. The language with minimum undefined behavior. During my learning things I was found that unwrapping the Result and Option is very useful when programmer writes the code. Of course, this approach have a 1 negative point - unwrapping. It's make the reader(code reviewer) to understands what is you code does, why you are unwrapping the result, etc. Okay, so what is the reason to create a package with same approach? The answer is - undefined behavior!

During my career I'm not only to write some code, but also writes automated tests. During the tests we need to say that some thing will works on future and creates a caveats, mocks and stubs to make e2e stuff testable.

Of course this hell is made me motivation to avoid `try/catch/finally`, because we hired juniors who is not skilled to cover all possible cases.

## So, how to start?

Install the dependency:

npm i `@rslike/std` and here you go!

In your JS/TS file you can writes something like this:

```ts
import {Ok, Some, Err, None} from '@rslike/std';

const a = Ok(123);
const mapped = a.map(res => String(res));

console.log(mapped) // "123"
```

easy, isn't?

Yes API is similar from Rust as much as possible

Here is a few list of implemented API for `Option` and `Result`

- `expect(reason)`
- `unwrap`
- `unwrapOr`
- `unwrapOrElse`
- `map`
- `mapOr` and much more

Full list available in [Wiki](https://github.com/vitalics/rslike/wiki)

## Will it helps me?

Not sure that it will helps in your case, but we reduce bugs at 10% in general across all 5 projects.

# What's next?

I have a plans to develop this library. Right now test coverage is about 80% and not all cases and statements are covered.

**UPD:** now test coverage is 100%

Also I have a plans to integrate with Node.js native bindings , WebAPI and fetch. Who knows what will be next?🤔
