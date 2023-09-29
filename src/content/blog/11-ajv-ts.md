---
title: "Zod is dead. Long live ajv-ts!"
description: Why ajv-ts is a future! And how it solves problems on the current project?
pubDate: 2023-09-29
# updatedDate: 2023-09-05
hero: "../../assets/images/11-zod-hero.png"
heroAlt: "zod is dead!"
---

## What is Zod?

Zod is a schema-level validation library with a first-class Typescript types support.

I want examples! Okay, here you are.

Let's imagine that we want to create an object `User` with email and passowrd fields. Both are them - required.

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

Zod will handle incoming arguments into the `parse` function and throws if argument not matches the schema

## Why zod does not works for us?

On the current project we use `ajv` schema validator. Since zod has it's own validation, it does not matched our requirements.

But! Our models are JSON-schema compatible - My thoughts. This is a entry point of my adventure which has name `ajv-ts`.

## Attempt 1. Types

First of all, I define base type:

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

The next step - Define Builder. But some methods should be inherited. So I made desicion to create a class `SchemaBuilder`.

It have next signature

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
- Because we don't need to allow create `SchemaBuilder` istance
- Why you need to define `Output` generic?
- Transformers! - my answer.
- What is the `transformers`?

Well, `transformers` - function which transform input or output result. It works as hooks before or after `safeParse` method.
`parse` method use `safeParse` to not throw any errors

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
  // if we got date - transform it into "ISO" format
  if (x instanceof Date) {
    return x.toISOString();
  }
  return x;
});

const a = MySchema.parse(new Date()); // returns "2023-09-27T12:25:05.870Z"
```

And Same for `postprocess`. The idea is simple. `parse` method returns `Output` generic.
Input is an "incoming type" and used to define input arguments.

Example with an `NumberSchemaBuilder`

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

`Input` generic is defines `number` type.

The idea is manipulation with JSON-schema, since many validators understands JSON-schema - it's a standard de-facto!

**BUT:** zod have its own-written parser and it does not respects JSON-Schema notations. hello `bigint`, `function`, `Map`, `Set`, `never` functions.

Bonus: Define `number` function:

```ts
// builder.ts

export function number() {
  return new NumberSchema();
}
```

## Attempt 3. Infer parameters

How `zod` understands which type is your schema. I mean how `z.infer<Schema>` works?

As you may found `Output` is a exact type which we need because it respects typescript parser output result.
That means you only need to call `Output` generic, but how it's possible? `NumberSchema` does not have such parameter, only `SchemaBuilder`.

The answer is tricky - we can define "empty" by value type and set it's incoming generic input or output.

Let's switch it up to `SchemaBuilder` again and define "tricky" hack!

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

Gotha! BTW `zod` works with same way. I cannot find any other solution.

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

Library have same API as `zod` have. Now any team in the project can simple define schemas. Here is an few example, more on the [project readme](https://github.com/vitalics/ajv-ts?tab=readme-ov-file#ajv-ts):

```ts
// user.schema.ts
import s from 'ajv-ts'

export const LoginUserRequestData = s.object({
  email: s.string().format('email'),
  password: s.string()
}).strict().required().meta({
description: 'request data for "/login" endpoint'})

export default {
"User Login Schema" : LoginUserRequestData.schema
}
```

We Also use our builder to create "swagger" like schema. In codegen:

```ts
const schemaDefs = (await import('./schema.ts')).default

await fs.writeFile('swagger-like.json', JSON.stringify(schemaDefs, null, 2))
```

And the output will be:

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

Okay, it's time to stop. My final words will be comparison between our solution and `zod`.

Advantages:

1. Meets our requirements and expectations.
2. Less lines of code. `zod` have more than 4k lines in main file (`src/types.ts`) while we have only 1k lines of code.
3. `ajv-ts` respects JSON-Schema since it's standard. JSON-schema is available under `schema` property and easy to generate output.
4. uses `ajv` under the hood which reduce our bundle size, cost of support for validation.

Disadvantages:

1. Cost of support and buggy(while we are not in stable release)
2. Types overload, but zod have same issue.
3. Not world spreaded, we just released our solution
4. we are not fully compatable with `zod`. But in most cases you can reimport without any problems(in you are not use transformations or custom errors)
5. Custom errors are not supported.

## GoodSchemaDay

## Useful Links

1. [ajv-ts](https://github.com/vitalics/ajv-ts)
2. [ajv](https://ajv.js.org/)
3. [JSON-schema specification](https://json-schema.org/)
4. [zod](https://zod.dev/)
