---
title: "Zod is dead. Long live ajv-ts!"
description: Why ajv-ts is a future! And how it solves problems on the current project?
pubDate: 2023-09-29
updatedDate: 2023-09-29
hero: "../../assets/images/11-zod-hero.png"
heroAlt: "zod is dead!"
---

## What is Zod?

Zod is a schema-level validation library with first-class Typescript types support.

I want examples! Okay, here you are.

Let's imagine that we want to create an object `User` with email and password fields. Both are them - required.

```ts
// example.ts
import z from "zod";

const UserSchema = z.object({
  username: z.string(),
  password: z.string(),
});
type User = z.infer<typeof UserSchema>; // {username: string, password: string}

const admin = UserSchema.parse({ username: "admin", password: "admin" }); // OK
const guesstWrong = UserSchema.parse({ username: "admin", password: 123 }); // Error. Password is not a string
```

Zod will handle incoming arguments into the `parse` function and throw if argument not match the schema

## Why Zod does not work for us?

In the current project, we use `ajv` schema validator. Since Zod has it's own validation, it does not match our requirements.

But! Our models are JSON-schema compatible - My thoughts. This is an entry point of my adventure which has the name `ajv-ts`.

## Attempt 1. Types

First of all, I define the base type:

```ts
// types.ts
export type BaseSchema = Record<string, unknown> & {
  type?: string;
  $comment?: string;
  description?: string;
  // ...etc.
};
```

based on [JSON-schema](https://json-schema.org/) specification - I define primitives(Number, String, Boolean, Null) and complex(Object, Array) types

Example of the Number schema:

```ts
// types.ts
export type NumberSchema = BaseSchema & {
  type: "number" | "int";
  format?: "int32" | "double";
  min?: number;
  max?: number;
  // ...etc number params
};
```

And Also I define `AnySchema` which takes all possible schema types:

```ts
// types.ts
export type AnySchema = NumberSchema | StringSchema | BooleanSchema; // ...etc
```

## Attempt 2. Builder

The next step is to define Builder. But some methods should be inherited. So I made the decision to create a class `SchemaBuilder`.

It has next signature

```ts
// builder.ts
import { AnySchema } from "./types";
abstract class SchemaBuilder<Input, Schema extends AnySchema, Output = Input> {
  constructor(readonly schema: Schema) {
    // schema is a JSON-schema notation
  }
  safeParse(input: unknown): SafeParseResult {
    // logic here
  }
  parse(input: unknown): Output {
    const { success, data, error } = this.safeParse(input);
    if (data && success) {
      return data;
    }
    throw error;
  }
  // rest methods
}
```

And you may ask:

- Why class is an abstract?
- Because we don't need to allow the creation of a `SchemaBuilder` instance
- Why do you need to define `Output` generic?
- Transformers! - my answer.
- What are the `transformers`?

Well, `transformers` - a function that transforms input or output results. It works as hooks before or after the `safeParse` method.
The `parse` method uses `safeParse` to not throw any errors

Let me show you an example:

```ts
// builder.ts
abstract class SchemaBuilder<Input, Schema extends AnySchema, Output = Input> {
  preprocess<Schema extends SchemaBuilder<any, any, any>>(
    fn: (x: unknown) => unknown,
    schema: Schema
  ): Schema {
    this.preprocessFns.push({ fn, schema });
    return this;
  }
  postprocess<Schema extends SchemaBuilder<any, any, any>>(
    fn: (x: unknown) => unknown,
    schema: Schema
  ): Schema {
    this.postprocessFns.push({ fn, schema });
    return this;
  }
  // rest methods
}
```

How it will used:

```ts
// example.ts
const MySchema = s.string().preprocess((x) => {
  //If we got the date - transform it into "ISO" format
  if (x instanceof Date) {
    return x.toISOString();
  }
  return x;
});

const a = MySchema.parse(new Date()); // returns "2023-09-27T12:25:05.870Z"
```

And the Same for `postprocess`. The idea is simple. the `parse` method returns the `Output` generic.
Input is an "incoming type" and is used to define input arguments.

Example with a `NumberSchemaBuilder`

```ts
// builder.ts

class NumberSchemaBuilder extends SchemaBuilder<number, NumberSchema> {
  constructor() {
    super({ type: "number" });
  }
  format(type: "int32" | "double") {
    this.schema.format = type;
  }
}
```

`Input` generic defines `number` type.

The idea is manipulation with JSON-schema, since many validators understand JSON-schema - it's a standard de facto!

**BUT:** zod has its own-written parser and it does not respect JSON-Schema notations. hello `bigint`, `function`, `Map`, `Set`, `never` functions.

Bonus: Define the `number` function:

```ts
// builder.ts

export function number() {
  return new NumberSchema();
}
```

## Attempt 3. Infer parameters

How `Zod` understands which type is your schema. I mean how `z.infer<Schema>` works?

As you may found `Output` is an exact type that we need because it respects typescript parser output result.
That means you only need to call `Output` generic, but how it's possible? `NumberSchema` does not have such a parameter, only `SchemaBuilder`.

The answer is tricky - we can define "empty" by value type and set its incoming generic input or output.

Let's switch it up to `SchemaBuilder` again and define a "tricky" hack!

```ts
// builder.ts

abstract class SchemaBuilder<Input, Schema extends AnySchema, Output = Input> {
  _input: Input;
  _output: Output;
  // ...other methods
}
```

The `_input` and `_output` is always have "undefined", but we will use them to infering parameters.

```ts
// builder.ts

export type Infer<S extends SchemaBuilder<any, any, any>> = S["_output"];
```

Now we can check that this is works:

```ts
// builder.ts

const MyNumber = s.number()
type Infered = Infer<typeof MyNumber>; // number
```

Gotha! BTW `zod` works in the same way. I cannot find any other solution.

## Attempt 4. All Together

```ts
// builder.ts

abstract class SchemaBuilder<Input, Schema extends AnySchema, Output = Input> {
  _input: Input;
  _output: Output;
  ajv: Ajv // ajv Instance, used for validation
  safeParse(input: unknown);
  parse(input: unknown);
}
class NumberSchemaBuilder extends SchemaBuilder<number, NumberSchema> {
  constructor() {
    super({ type: "number" });
  }
  format(type: "int32" | "double") {
    this.schema.format = type;
  }
}
export function number() {
  return new NumberSchema();
}
```

## Final thoughts

The main point is achieved - we define JSON-schema builder with first-class typescript type inferring! And it's awesome!

The library has the same API as `Zod`. Now any team in the project can simply define schemas. Here is a few example, more on the [project readme](https://github.com/vitalics/ajv-ts?tab=readme-ov-file#ajv-ts):

```ts
// user.schema.ts
import s from 'ajv-ts'

export const LoginUserRequestData = s.object({
  email: s.string().format('email'),
  password: s.string()
}).strict().required().meta({
description: 'request data for "/login" endpoint'})

export default {
"User Login Schema": LoginUserRequestData.schema
}
```

We also use our builder to create a "swagger" like schema. In codegen:

```ts
const schemaDefs = (await import('./schema.ts')).default

await fs.writeFile('swagger-like.json', JSON.stringify(schemaDefs, null, 2))
```

The output will be:

``` json
{
  "User Login Schema": {
    "type": "object",
    "properties": {
      "email": {
        "type": "string",
        "format": "email"
      },
      "password": {
        "type": "string"
      }
    },
    "requiredProperties": ["email", "password"],
    "additionalProperties": false
  }
}
```

Okay, it's time to stop. My final words will be a comparison between our solution and `zod`.

Advantages:

1. Meets our requirements and expectations.
2. Fewer lines of code. `zod` has more than 4k lines in the main file (`src/types.ts`) while we have only 1k lines of code.
3. `ajv-ts` respects JSON-Schema since it's standard. JSON-schema is available under the `schema` property and is easy to generate output.
4. uses `ajv` under the hood which reduces our bundle size and cost of support for validation.

Disadvantages:

1. Cost of support and buggy(while we are not in stable release)
2. Types overload, but Zod has the same issue.
3. Not world spread, we just released our solution
4. we are not fully compatible with `zod`. But in most cases, you can reimport without any problems(if you are not using transformations or custom errors)
5. Custom errors are not supported.

## GoodSchemaDay

## Useful Links

1. [ajv-ts](https://github.com/vitalics/ajv-ts)
2. [ajv](https://ajv.js.org/)
3. [JSON-schema specification](https://json-schema.org/)
4. [zod](https://zod.dev/)
