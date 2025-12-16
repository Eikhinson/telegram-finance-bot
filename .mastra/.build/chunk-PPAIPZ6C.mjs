import { RuntimeContext } from './@mastra-core-runtime-context.mjs';
import { M as MastraError } from './error.mjs';
import { WritableStream as WritableStream$1, TransformStream as TransformStream$1 } from 'stream/web';
import { i as isVercelTool, v as validateToolInput } from './tools.mjs';
import { M as MastraBase, L as LogLevel, C as ConsoleLogger, R as RegisteredLogger } from './chunk-VQASQG5D.mjs';
import { createHash } from 'crypto';
import { z } from './zod.mjs';
import { z as zodToJsonSchema } from './zod-to-json.mjs';
import { t as createIdGenerator, u as asSchema, x as safeParseJSON, y as safeValidateTypes, A as jsonSchema } from './index2.mjs';
import { e as AISDKError } from './stream.mjs';
import { u as union$1, s as string$2, x as _instanceof, y as custom$1, l as lazy, z as _null$3, n as number$2, b as boolean$2, r as record, c as array$1, o as object$2, d as literal$1, e as unknown$1, f as discriminatedUnion, D as ZodOptional$2, E as ZodObject$2, F as ZodNull$2, G as ZodNullable$1, H as ZodArray$2, I as ZodUnion$2, Z as ZodString$2, i as ZodNumber$2, t as ZodDate$1, J as ZodDefault$2, K as ZodNever$2, L as strictObject, M as ZodUnknown$1, A as looseObject } from './schemas.mjs';
import { l as literalType, k as nullType, m as arrayType, a as anyType, o as objectType, g as booleanType, u as unionType, n as numberType, s as stringType, e as enumType, w as neverType, x as intersectionType, y as ZodOptional$1, z as ZodObject$1, A as ZodNull$1, b as ZodArray$1, B as ZodUnion$1, C as ZodString$1, D as ZodNumber$1, E as ZodDate, F as ZodDefault$1, G as ZodNever$1 } from './v3.mjs';

// src/tools/stream.ts
var ToolStream = class extends WritableStream$1 {
  originalStream;
  writeQueue = Promise.resolve();
  constructor({
    prefix,
    callId,
    name,
    runId
  }, originalStream) {
    super({
      async write(chunk) {
        const writer = originalStream?.getWriter();
        try {
          await writer?.write({
            type: `${prefix}-output`,
            runId,
            from: "USER",
            payload: {
              output: chunk,
              ...prefix === "workflow-step" ? {
                runId,
                stepName: name
              } : {
                [`${prefix}CallId`]: callId,
                [`${prefix}Name`]: name
              }
            }
          });
        } finally {
          writer?.releaseLock();
        }
      }
    });
    this.originalStream = originalStream;
  }
  async write(data) {
    const writer = this.getWriter();
    try {
      await writer.write(data);
    } finally {
      writer.releaseLock();
    }
  }
  async custom(data) {
    this.writeQueue = this.writeQueue.then(async () => {
      if (!this.originalStream) {
        return;
      }
      const writer = this.originalStream.getWriter();
      try {
        await writer.write(data);
      } finally {
        writer.releaseLock();
      }
    });
    return this.writeQueue;
  }
};

const parseAnyOf = (schema, refs) => {
    return schema.anyOf.length
        ? schema.anyOf.length === 1
            ? parseSchema(schema.anyOf[0], {
                ...refs,
                path: [...refs.path, "anyOf", 0],
            })
            : `z.union([${schema.anyOf
                .map((schema, i) => parseSchema(schema, { ...refs, path: [...refs.path, "anyOf", i] }))
                .join(", ")}])`
        : `z.any()`;
};

const parseBoolean = (_schema) => {
    return "z.boolean()";
};

const parseDefault = (_schema) => {
    return "z.any()";
};

const parseMultipleType = (schema, refs) => {
    return `z.union([${schema.type
        .map((type) => parseSchema({ ...schema, type }, { ...refs, withoutDefaults: true }))
        .join(", ")}])`;
};

const parseNot = (schema, refs) => {
    return `z.any().refine((value) => !${parseSchema(schema.not, {
        ...refs,
        path: [...refs.path, "not"],
    })}.safeParse(value).success, "Invalid input: Should NOT be valid against schema")`;
};

const parseNull = (_schema) => {
    return "z.null()";
};

const half = (arr) => {
    return [arr.slice(0, arr.length / 2), arr.slice(arr.length / 2)];
};

const originalIndex = Symbol("Original index");
const ensureOriginalIndex = (arr) => {
    let newArr = [];
    for (let i = 0; i < arr.length; i++) {
        const item = arr[i];
        if (typeof item === "boolean") {
            newArr.push(item ? { [originalIndex]: i } : { [originalIndex]: i, not: {} });
        }
        else if (originalIndex in item) {
            return arr;
        }
        else {
            newArr.push({ ...item, [originalIndex]: i });
        }
    }
    return newArr;
};
function parseAllOf(schema, refs) {
    if (schema.allOf.length === 0) {
        return "z.never()";
    }
    else if (schema.allOf.length === 1) {
        const item = schema.allOf[0];
        return parseSchema(item, {
            ...refs,
            path: [...refs.path, "allOf", item[originalIndex]],
        });
    }
    else {
        const [left, right] = half(ensureOriginalIndex(schema.allOf));
        return `z.intersection(${parseAllOf({ allOf: left }, refs)}, ${parseAllOf({
            allOf: right,
        }, refs)})`;
    }
}

function withMessage(schema, key, get) {
    const value = schema[key];
    let r = "";
    if (value !== undefined) {
        const got = get({ value, json: JSON.stringify(value) });
        if (got) {
            const opener = got[0];
            const prefix = got.length === 3 ? got[1] : "";
            const closer = got.length === 3 ? got[2] : got[1];
            r += opener;
            if (schema.errorMessage?.[key] !== undefined) {
                r += prefix + JSON.stringify(schema.errorMessage[key]);
            }
            r += closer;
        }
    }
    return r;
}

const parseArray = (schema, refs) => {
    if (Array.isArray(schema.items)) {
        return `z.tuple([${schema.items.map((v, i) => parseSchema(v, { ...refs, path: [...refs.path, "items", i] }))}])`;
    }
    let r = !schema.items
        ? "z.array(z.any())"
        : `z.array(${parseSchema(schema.items, {
            ...refs,
            path: [...refs.path, "items"],
        })})`;
    r += withMessage(schema, "minItems", ({ json }) => [
        `.min(${json}`,
        ", ",
        ")",
    ]);
    r += withMessage(schema, "maxItems", ({ json }) => [
        `.max(${json}`,
        ", ",
        ")",
    ]);
    if (schema.uniqueItems === true) {
        r += withMessage(schema, "uniqueItems", () => [
            ".unique(",
            "",
            ")",
        ]);
    }
    return r;
};

const parseConst = (schema) => {
    return `z.literal(${JSON.stringify(schema.const)})`;
};

const parseEnum = (schema) => {
    if (schema.enum.length === 0) {
        return "z.never()";
    }
    else if (schema.enum.length === 1) {
        // union does not work when there is only one element
        return `z.literal(${JSON.stringify(schema.enum[0])})`;
    }
    else if (schema.enum.every((x) => typeof x === "string")) {
        return `z.enum([${schema.enum.map((x) => JSON.stringify(x))}])`;
    }
    else {
        return `z.union([${schema.enum
            .map((x) => `z.literal(${JSON.stringify(x)})`)
            .join(", ")}])`;
    }
};

const parseIfThenElse = (schema, refs) => {
    const $if = parseSchema(schema.if, { ...refs, path: [...refs.path, "if"] });
    const $then = parseSchema(schema.then, {
        ...refs,
        path: [...refs.path, "then"],
    });
    const $else = parseSchema(schema.else, {
        ...refs,
        path: [...refs.path, "else"],
    });
    return `z.union([${$then}, ${$else}]).superRefine((value,ctx) => {
  const result = ${$if}.safeParse(value).success
    ? ${$then}.safeParse(value)
    : ${$else}.safeParse(value);
  if (!result.success) {
    result.error.errors.forEach((error) => ctx.addIssue(error))
  }
})`;
};

const parseNumber = (schema) => {
    let r = "z.number()";
    if (schema.type === "integer") {
        r += withMessage(schema, "type", () => [".int(", ")"]);
    }
    else {
        r += withMessage(schema, "format", ({ value }) => {
            if (value === "int64") {
                return [".int(", ")"];
            }
        });
    }
    r += withMessage(schema, "multipleOf", ({ value, json }) => {
        if (value === 1) {
            if (r.startsWith("z.number().int(")) {
                return;
            }
            return [".int(", ")"];
        }
        return [`.multipleOf(${json}`, ", ", ")"];
    });
    if (typeof schema.minimum === "number") {
        if (schema.exclusiveMinimum === true) {
            r += withMessage(schema, "minimum", ({ json }) => [
                `.gt(${json}`,
                ", ",
                ")",
            ]);
        }
        else {
            r += withMessage(schema, "minimum", ({ json }) => [
                `.gte(${json}`,
                ", ",
                ")",
            ]);
        }
    }
    else if (typeof schema.exclusiveMinimum === "number") {
        r += withMessage(schema, "exclusiveMinimum", ({ json }) => [
            `.gt(${json}`,
            ", ",
            ")",
        ]);
    }
    if (typeof schema.maximum === "number") {
        if (schema.exclusiveMaximum === true) {
            r += withMessage(schema, "maximum", ({ json }) => [
                `.lt(${json}`,
                ", ",
                ")",
            ]);
        }
        else {
            r += withMessage(schema, "maximum", ({ json }) => [
                `.lte(${json}`,
                ", ",
                ")",
            ]);
        }
    }
    else if (typeof schema.exclusiveMaximum === "number") {
        r += withMessage(schema, "exclusiveMaximum", ({ json }) => [
            `.lt(${json}`,
            ", ",
            ")",
        ]);
    }
    return r;
};

const parseOneOf = (schema, refs) => {
    return schema.oneOf.length
        ? schema.oneOf.length === 1
            ? parseSchema(schema.oneOf[0], {
                ...refs,
                path: [...refs.path, "oneOf", 0],
            })
            : `z.any().superRefine((x, ctx) => {
    const schemas = [${schema.oneOf
                .map((schema, i) => parseSchema(schema, {
                ...refs,
                path: [...refs.path, "oneOf", i],
            }))
                .join(", ")}];
    const errors = schemas.reduce<z.ZodError[]>(
      (errors, schema) =>
        ((result) =>
          result.error ? [...errors, result.error] : errors)(
          schema.safeParse(x),
        ),
      [],
    );
    if (schemas.length - errors.length !== 1) {
      ctx.addIssue({
        path: ctx.path,
        code: "invalid_union",
        unionErrors: errors,
        message: "Invalid input: Should pass single schema",
      });
    }
  })`
        : "z.any()";
};

const expandJsdocs = (jsdocs) => {
    const lines = jsdocs.split("\n");
    const result = lines.length === 1
        ? lines[0]
        : `\n${lines.map(x => `* ${x}`)
            .join("\n")}\n`;
    return `/**${result}*/\n`;
};
const addJsdocs = (schema, parsed) => {
    const description = schema.description;
    if (!description) {
        return parsed;
    }
    return `\n${expandJsdocs(description)}${parsed}`;
};

function parseObject$1(objectSchema, refs) {
    let properties = undefined;
    if (objectSchema.properties) {
        if (!Object.keys(objectSchema.properties).length) {
            properties = "z.object({})";
        }
        else {
            properties = "z.object({ ";
            properties += Object.keys(objectSchema.properties)
                .map((key) => {
                const propSchema = objectSchema.properties[key];
                let result = `${JSON.stringify(key)}: ${parseSchema(propSchema, {
                    ...refs,
                    path: [...refs.path, "properties", key],
                })}`;
                if (refs.withJsdocs && typeof propSchema === "object") {
                    result = addJsdocs(propSchema, result);
                }
                const hasDefault = typeof propSchema === "object" && propSchema.default !== undefined;
                const required = Array.isArray(objectSchema.required)
                    ? objectSchema.required.includes(key)
                    : typeof propSchema === "object" && propSchema.required === true;
                const optional = !hasDefault && !required;
                return optional ? `${result}.optional()` : result;
            })
                .join(", ");
            properties += " })";
        }
    }
    const additionalProperties = objectSchema.additionalProperties !== undefined
        ? parseSchema(objectSchema.additionalProperties, {
            ...refs,
            path: [...refs.path, "additionalProperties"],
        })
        : undefined;
    let patternProperties = undefined;
    if (objectSchema.patternProperties) {
        const parsedPatternProperties = Object.fromEntries(Object.entries(objectSchema.patternProperties).map(([key, value]) => {
            return [
                key,
                parseSchema(value, {
                    ...refs,
                    path: [...refs.path, "patternProperties", key],
                }),
            ];
        }, {}));
        patternProperties = "";
        if (properties) {
            if (additionalProperties) {
                patternProperties += `.catchall(z.union([${[
                    ...Object.values(parsedPatternProperties),
                    additionalProperties,
                ].join(", ")}]))`;
            }
            else if (Object.keys(parsedPatternProperties).length > 1) {
                patternProperties += `.catchall(z.union([${Object.values(parsedPatternProperties).join(", ")}]))`;
            }
            else {
                patternProperties += `.catchall(${Object.values(parsedPatternProperties)})`;
            }
        }
        else {
            if (additionalProperties) {
                patternProperties += `z.record(z.union([${[
                    ...Object.values(parsedPatternProperties),
                    additionalProperties,
                ].join(", ")}]))`;
            }
            else if (Object.keys(parsedPatternProperties).length > 1) {
                patternProperties += `z.record(z.union([${Object.values(parsedPatternProperties).join(", ")}]))`;
            }
            else {
                patternProperties += `z.record(${Object.values(parsedPatternProperties)})`;
            }
        }
        patternProperties += ".superRefine((value, ctx) => {\n";
        patternProperties += "for (const key in value) {\n";
        if (additionalProperties) {
            if (objectSchema.properties) {
                patternProperties += `let evaluated = [${Object.keys(objectSchema.properties)
                    .map((key) => JSON.stringify(key))
                    .join(", ")}].includes(key)\n`;
            }
            else {
                patternProperties += `let evaluated = false\n`;
            }
        }
        for (const key in objectSchema.patternProperties) {
            patternProperties +=
                "if (key.match(new RegExp(" + JSON.stringify(key) + "))) {\n";
            if (additionalProperties) {
                patternProperties += "evaluated = true\n";
            }
            patternProperties +=
                "const result = " +
                    parsedPatternProperties[key] +
                    ".safeParse(value[key])\n";
            patternProperties += "if (!result.success) {\n";
            patternProperties += `ctx.addIssue({
          path: [...ctx.path, key],
          code: 'custom',
          message: \`Invalid input: Key matching regex /\${key}/ must match schema\`,
          params: {
            issues: result.error.issues
          }
        })\n`;
            patternProperties += "}\n";
            patternProperties += "}\n";
        }
        if (additionalProperties) {
            patternProperties += "if (!evaluated) {\n";
            patternProperties +=
                "const result = " + additionalProperties + ".safeParse(value[key])\n";
            patternProperties += "if (!result.success) {\n";
            patternProperties += `ctx.addIssue({
          path: [...ctx.path, key],
          code: 'custom',
          message: \`Invalid input: must match catchall schema\`,
          params: {
            issues: result.error.issues
          }
        })\n`;
            patternProperties += "}\n";
            patternProperties += "}\n";
        }
        patternProperties += "}\n";
        patternProperties += "})";
    }
    let output = properties
        ? patternProperties
            ? properties + patternProperties
            : additionalProperties
                ? additionalProperties === "z.never()"
                    ? properties + ".strict()"
                    : properties + `.catchall(${additionalProperties})`
                : properties
        : patternProperties
            ? patternProperties
            : additionalProperties
                ? `z.record(${additionalProperties})`
                : "z.record(z.any())";
    if (its.an.anyOf(objectSchema)) {
        output += `.and(${parseAnyOf({
            ...objectSchema,
            anyOf: objectSchema.anyOf.map((x) => typeof x === "object" &&
                !x.type &&
                (x.properties || x.additionalProperties || x.patternProperties)
                ? { ...x, type: "object" }
                : x),
        }, refs)})`;
    }
    if (its.a.oneOf(objectSchema)) {
        output += `.and(${parseOneOf({
            ...objectSchema,
            oneOf: objectSchema.oneOf.map((x) => typeof x === "object" &&
                !x.type &&
                (x.properties || x.additionalProperties || x.patternProperties)
                ? { ...x, type: "object" }
                : x),
        }, refs)})`;
    }
    if (its.an.allOf(objectSchema)) {
        output += `.and(${parseAllOf({
            ...objectSchema,
            allOf: objectSchema.allOf.map((x) => typeof x === "object" &&
                !x.type &&
                (x.properties || x.additionalProperties || x.patternProperties)
                ? { ...x, type: "object" }
                : x),
        }, refs)})`;
    }
    return output;
}

const parseString = (schema) => {
    let r = "z.string()";
    r += withMessage(schema, "format", ({ value }) => {
        switch (value) {
            case "email":
                return [".email(", ")"];
            case "ip":
                return [".ip(", ")"];
            case "ipv4":
                return ['.ip({ version: "v4"', ", message: ", " })"];
            case "ipv6":
                return ['.ip({ version: "v6"', ", message: ", " })"];
            case "uri":
                return [".url(", ")"];
            case "uuid":
                return [".uuid(", ")"];
            case "date-time":
                return [".datetime({ offset: true", ", message: ", " })"];
            case "time":
                return [".time(", ")"];
            case "date":
                return [".date(", ")"];
            case "binary":
                return [".base64(", ")"];
            case "duration":
                return [".duration(", ")"];
        }
    });
    r += withMessage(schema, "pattern", ({ json }) => [
        `.regex(new RegExp(${json})`,
        ", ",
        ")",
    ]);
    r += withMessage(schema, "minLength", ({ json }) => [
        `.min(${json}`,
        ", ",
        ")",
    ]);
    r += withMessage(schema, "maxLength", ({ json }) => [
        `.max(${json}`,
        ", ",
        ")",
    ]);
    r += withMessage(schema, "contentEncoding", ({ value }) => {
        if (value === "base64") {
            return [".base64(", ")"];
        }
    });
    const contentMediaType = withMessage(schema, "contentMediaType", ({ value }) => {
        if (value === "application/json") {
            return [
                ".transform((str, ctx) => { try { return JSON.parse(str); } catch (err) { ctx.addIssue({ code: \"custom\", message: \"Invalid JSON\" }); }}",
                ", ",
                ")"
            ];
        }
    });
    if (contentMediaType != "") {
        r += contentMediaType;
        r += withMessage(schema, "contentSchema", ({ value }) => {
            if (value && value instanceof Object) {
                return [
                    `.pipe(${parseSchema(value)}`,
                    ", ",
                    ")"
                ];
            }
        });
    }
    return r;
};

const parseSimpleDiscriminatedOneOf = (schema, refs) => {
    return schema.oneOf.length
        ? schema.oneOf.length === 1
            ? parseSchema(schema.oneOf[0], {
                ...refs,
                path: [...refs.path, "oneOf", 0],
            })
            : `z.discriminatedUnion("${schema.discriminator.propertyName}", [${schema.oneOf
                .map((schema, i) => parseSchema(schema, {
                ...refs,
                path: [...refs.path, "oneOf", i],
            }))
                .join(", ")}])`
        : "z.any()";
};

const omit$1 = (obj, ...keys) => Object.keys(obj).reduce((acc, key) => {
    if (!keys.includes(key)) {
        acc[key] = obj[key];
    }
    return acc;
}, {});

/**
 * For compatibility with open api 3.0 nullable
 */
const parseNullable = (schema, refs) => {
    return `${parseSchema(omit$1(schema, "nullable"), refs, true)}.nullable()`;
};

const parseSchema = (schema, refs = { seen: new Map(), path: [] }, blockMeta) => {
    if (typeof schema !== "object")
        return schema ? "z.any()" : "z.never()";
    if (refs.parserOverride) {
        const custom = refs.parserOverride(schema, refs);
        if (typeof custom === "string") {
            return custom;
        }
    }
    let seen = refs.seen.get(schema);
    if (seen) {
        if (seen.r !== undefined) {
            return seen.r;
        }
        if (refs.depth === undefined || seen.n >= refs.depth) {
            return "z.any()";
        }
        seen.n += 1;
    }
    else {
        seen = { r: undefined, n: 0 };
        refs.seen.set(schema, seen);
    }
    let parsed = selectParser(schema, refs);
    if (!blockMeta) {
        if (!refs.withoutDescribes) {
            parsed = addDescribes$1(schema, parsed);
        }
        if (!refs.withoutDefaults) {
            parsed = addDefaults$1(schema, parsed);
        }
        parsed = addAnnotations$1(schema, parsed);
    }
    seen.r = parsed;
    return parsed;
};
const addDescribes$1 = (schema, parsed) => {
    if (schema.description) {
        parsed += `.describe(${JSON.stringify(schema.description)})`;
    }
    return parsed;
};
const addDefaults$1 = (schema, parsed) => {
    if (schema.default !== undefined) {
        parsed += `.default(${JSON.stringify(schema.default)})`;
    }
    return parsed;
};
const addAnnotations$1 = (schema, parsed) => {
    if (schema.readOnly) {
        parsed += ".readonly()";
    }
    return parsed;
};
const selectParser = (schema, refs) => {
    if (its.a.nullable(schema)) {
        return parseNullable(schema, refs);
    }
    else if (its.an.object(schema)) {
        return parseObject$1(schema, refs);
    }
    else if (its.an.array(schema)) {
        return parseArray(schema, refs);
    }
    else if (its.an.anyOf(schema)) {
        return parseAnyOf(schema, refs);
    }
    else if (its.an.allOf(schema)) {
        return parseAllOf(schema, refs);
    }
    else if (its.a.simpleDiscriminatedOneOf(schema)) {
        return parseSimpleDiscriminatedOneOf(schema, refs);
    }
    else if (its.a.oneOf(schema)) {
        return parseOneOf(schema, refs);
    }
    else if (its.a.not(schema)) {
        return parseNot(schema, refs);
    }
    else if (its.an.enum(schema)) {
        return parseEnum(schema); //<-- needs to come before primitives
    }
    else if (its.a.const(schema)) {
        return parseConst(schema);
    }
    else if (its.a.multipleType(schema)) {
        return parseMultipleType(schema, refs);
    }
    else if (its.a.primitive(schema, "string")) {
        return parseString(schema);
    }
    else if (its.a.primitive(schema, "number") ||
        its.a.primitive(schema, "integer")) {
        return parseNumber(schema);
    }
    else if (its.a.primitive(schema, "boolean")) {
        return parseBoolean();
    }
    else if (its.a.primitive(schema, "null")) {
        return parseNull();
    }
    else if (its.a.conditional(schema)) {
        return parseIfThenElse(schema, refs);
    }
    else {
        return parseDefault();
    }
};
const its = {
    an: {
        object: (x) => x.type === "object",
        array: (x) => x.type === "array",
        anyOf: (x) => x.anyOf !== undefined,
        allOf: (x) => x.allOf !== undefined,
        enum: (x) => x.enum !== undefined,
    },
    a: {
        nullable: (x) => x.nullable === true,
        multipleType: (x) => Array.isArray(x.type),
        not: (x) => x.not !== undefined,
        const: (x) => x.const !== undefined,
        primitive: (x, p) => x.type === p,
        conditional: (x) => Boolean("if" in x && x.if && "then" in x && "else" in x && x.then && x.else),
        simpleDiscriminatedOneOf: (x) => {
            if (!x.oneOf ||
                !Array.isArray(x.oneOf) ||
                x.oneOf.length === 0 ||
                !x.discriminator ||
                typeof x.discriminator !== "object" ||
                !("propertyName" in x.discriminator) ||
                typeof x.discriminator.propertyName !== "string") {
                return false;
            }
            const discriminatorProp = x.discriminator.propertyName;
            return x.oneOf.every((schema) => {
                if (!schema ||
                    typeof schema !== "object" ||
                    schema.type !== "object" ||
                    !schema.properties ||
                    typeof schema.properties !== "object" ||
                    !(discriminatorProp in schema.properties)) {
                    return false;
                }
                const property = schema.properties[discriminatorProp];
                return (property &&
                    typeof property === "object" &&
                    property.type === "string" &&
                    // Ensure discriminator has a constant value (const or single-value enum)
                    (property.const !== undefined ||
                        (property.enum && Array.isArray(property.enum) && property.enum.length === 1)) &&
                    // Ensure discriminator property is required
                    Array.isArray(schema.required) &&
                    schema.required.includes(discriminatorProp));
            });
        },
        oneOf: (x) => x.oneOf !== undefined,
    },
};

const jsonSchemaToZod$1 = (schema, { module, name, type, noImport, ...rest } = {}) => {
    if (type && (!name || module !== "esm")) {
        throw new Error("Option `type` requires `name` to be set and `module` to be `esm`");
    }
    let result = parseSchema(schema, {
        module,
        name,
        path: [],
        seen: new Map(),
        ...rest,
    });
    const jsdocs = rest.withJsdocs && typeof schema !== "boolean" && schema.description
        ? expandJsdocs(schema.description)
        : "";
    if (module === "cjs") {
        result = `${jsdocs}module.exports = ${name ? `{ ${JSON.stringify(name)}: ${result} }` : result}
`;
        if (!noImport) {
            result = `${jsdocs}const { z } = require("zod")

${result}`;
        }
    }
    else if (module === "esm") {
        result = `${jsdocs}export ${name ? `const ${name} =` : `default`} ${result}
`;
        if (!noImport) {
            result = `import { z } from "zod"

${result}`;
        }
    }
    else if (name) {
        result = `${jsdocs}const ${name} = ${result}`;
    }
    if (type && name) {
        let typeName = typeof type === "string"
            ? type
            : `${name[0].toUpperCase()}${name.substring(1)}`;
        result += `export type ${typeName} = z.infer<typeof ${name}>
`;
    }
    return result;
};

// src/json-to-zod.ts
function parseObject(objectSchema, refs) {
  let properties = void 0;
  if (objectSchema.properties) {
    if (!Object.keys(objectSchema.properties).length) {
      properties = "z.object({})";
    } else {
      properties = "z.object({ ";
      properties += Object.keys(objectSchema.properties).map((key) => {
        const propSchema = objectSchema.properties[key];
        let result = `${JSON.stringify(key)}: ${parseSchema(propSchema, {
          ...refs,
          path: [...refs.path, "properties", key]
        })}`;
        if (refs.withJsdocs && typeof propSchema === "object") {
          result = addJsdocs(propSchema, result);
        }
        const hasDefault = typeof propSchema === "object" && propSchema.default !== void 0;
        const required = Array.isArray(objectSchema.required) ? objectSchema.required.includes(key) : typeof propSchema === "object" && propSchema.required === true;
        const optional = !hasDefault && !required;
        return optional ? `${result}.optional()` : result;
      }).join(", ");
      properties += " })";
    }
  }
  const additionalProperties = objectSchema.additionalProperties !== void 0 && objectSchema.additionalProperties !== false ? parseSchema(objectSchema.additionalProperties, {
    ...refs,
    path: [...refs.path, "additionalProperties"]
  }) : void 0;
  let patternProperties = void 0;
  if (objectSchema.patternProperties) {
    const parsedPatternProperties = Object.fromEntries(
      Object.entries(objectSchema.patternProperties).map(([key, value]) => {
        return [
          key,
          parseSchema(value, {
            ...refs,
            path: [...refs.path, "patternProperties", key]
          })
        ];
      }, {})
    );
    patternProperties = "";
    if (properties) {
      if (additionalProperties) {
        patternProperties += `.catchall(z.union([${[
          ...Object.values(parsedPatternProperties),
          additionalProperties
        ].join(", ")}]))`;
      } else if (Object.keys(parsedPatternProperties).length > 1) {
        patternProperties += `.catchall(z.union([${Object.values(parsedPatternProperties).join(", ")}]))`;
      } else {
        patternProperties += `.catchall(${Object.values(parsedPatternProperties)})`;
      }
    } else {
      if (additionalProperties) {
        patternProperties += `z.record(z.union([${[
          ...Object.values(parsedPatternProperties),
          additionalProperties
        ].join(", ")}]))`;
      } else if (Object.keys(parsedPatternProperties).length > 1) {
        patternProperties += `z.record(z.union([${Object.values(parsedPatternProperties).join(", ")}]))`;
      } else {
        patternProperties += `z.record(${Object.values(parsedPatternProperties)})`;
      }
    }
    patternProperties += ".superRefine((value, ctx) => {\n";
    patternProperties += "for (const key in value) {\n";
    if (additionalProperties) {
      if (objectSchema.properties) {
        patternProperties += `let evaluated = [${Object.keys(objectSchema.properties).map((key) => JSON.stringify(key)).join(", ")}].includes(key)
`;
      } else {
        patternProperties += `let evaluated = false
`;
      }
    }
    for (const key in objectSchema.patternProperties) {
      patternProperties += "if (key.match(new RegExp(" + JSON.stringify(key) + "))) {\n";
      if (additionalProperties) {
        patternProperties += "evaluated = true\n";
      }
      patternProperties += "const result = " + parsedPatternProperties[key] + ".safeParse(value[key])\n";
      patternProperties += "if (!result.success) {\n";
      patternProperties += `ctx.addIssue({
          path: [...ctx.path, key],
          code: 'custom',
          message: \`Invalid input: Key matching regex /\${key}/ must match schema\`,
          params: {
            issues: result.error.issues
          }
        })
`;
      patternProperties += "}\n";
      patternProperties += "}\n";
    }
    if (additionalProperties) {
      patternProperties += "if (!evaluated) {\n";
      patternProperties += "const result = " + additionalProperties + ".safeParse(value[key])\n";
      patternProperties += "if (!result.success) {\n";
      patternProperties += `ctx.addIssue({
          path: [...ctx.path, key],
          code: 'custom',
          message: \`Invalid input: must match catchall schema\`,
          params: {
            issues: result.error.issues
          }
        })
`;
      patternProperties += "}\n";
      patternProperties += "}\n";
    }
    patternProperties += "}\n";
    patternProperties += "})";
  }
  let output = properties ? patternProperties ? properties + patternProperties : additionalProperties ? additionalProperties === "z.never()" ? properties + ".strict()" : properties + `.catchall(${additionalProperties})` : properties : patternProperties ? patternProperties : additionalProperties ? `z.record(${additionalProperties})` : "z.record(z.any())";
  if (its.an.anyOf(objectSchema)) {
    output += `.and(${parseAnyOf(
      {
        ...objectSchema,
        anyOf: objectSchema.anyOf.map(
          (x) => typeof x === "object" && !x.type && (x.properties || x.additionalProperties || x.patternProperties) ? { ...x, type: "object" } : x
        )
      },
      refs
    )})`;
  }
  if (its.a.oneOf(objectSchema)) {
    output += `.and(${parseOneOf(
      {
        ...objectSchema,
        oneOf: objectSchema.oneOf.map(
          (x) => typeof x === "object" && !x.type && (x.properties || x.additionalProperties || x.patternProperties) ? { ...x, type: "object" } : x
        )
      },
      refs
    )})`;
  }
  if (its.an.allOf(objectSchema)) {
    output += `.and(${parseAllOf(
      {
        ...objectSchema,
        allOf: objectSchema.allOf.map(
          (x) => typeof x === "object" && !x.type && (x.properties || x.additionalProperties || x.patternProperties) ? { ...x, type: "object" } : x
        )
      },
      refs
    )})`;
  }
  return output;
}
var parserOverride = (schema, refs) => {
  let parsed = "";
  let seen = refs.seen.get(schema);
  if (its.an.anyOf(schema)) {
    const allObjects = schema.anyOf.every(
      (item) => typeof item === "object" && its.an.object(item) && item.properties !== void 0
    );
    if (schema.anyOf.length > 1 && allObjects) {
      const propertiesWithConst = schema.anyOf.reduce((acc, item) => {
        if (typeof item === "object" && its.an.object(item)) {
          const propertyWithConst = Object.entries(item.properties ?? {}).filter(
            ([_, value]) => typeof value === "object" && value?.const !== void 0
          );
          if (propertyWithConst?.length) {
            const ppties = propertyWithConst.map(([key, _]) => key);
            acc.push(ppties);
          }
        }
        return acc;
      }, []);
      if (propertiesWithConst.length === schema.anyOf.length) {
        if (seen) {
          if (seen.r !== void 0) {
            return seen.r;
          }
          if (refs.depth === void 0 || seen.n >= refs.depth) {
            return "z.any()";
          }
          seen.n += 1;
        } else {
          seen = { r: void 0, n: 0 };
          refs.seen.set(schema, seen);
        }
        const discriminators = propertiesWithConst.length > 0 && propertiesWithConst[0] ? propertiesWithConst.reduce((common, properties) => {
          return common.filter((prop) => properties.includes(prop));
        }, propertiesWithConst[0]) : [];
        if (discriminators.length > 0) {
          const discriminator = discriminators[0];
          if (discriminator) {
            parsed = `z.discriminatedUnion("${discriminator}", [${schema.anyOf.map(
              (schema2, i) => parseSchema(schema2, {
                ...refs,
                path: [...refs.path, "anyOf", i]
              })
            ).join(", ")}])`;
          }
        }
      }
    }
  } else if (its.an.object(schema)) {
    if (seen) {
      if (seen.r !== void 0) {
        return seen.r;
      }
      if (refs.depth === void 0 || seen.n >= refs.depth) {
        return "z.any()";
      }
      seen.n += 1;
    } else {
      seen = { r: void 0, n: 0 };
      refs.seen.set(schema, seen);
    }
    parsed = parseObject(schema, refs);
  }
  if (parsed) {
    if (!refs.withoutDescribes) {
      parsed = addDescribes(schema, parsed);
    }
    if (!refs.withoutDefaults) {
      parsed = addDefaults(schema, parsed);
    }
    parsed = addAnnotations(schema, parsed);
    if (seen) {
      seen.r = parsed;
    }
    return parsed;
  }
};
var addDescribes = (schema, parsed) => {
  if (schema.description) {
    parsed += `.describe(${JSON.stringify(schema.description)})`;
  }
  return parsed;
};
var addDefaults = (schema, parsed) => {
  if (schema.default !== void 0) {
    parsed += `.default(${JSON.stringify(schema.default)})`;
  }
  return parsed;
};
var addAnnotations = (schema, parsed) => {
  if (schema.readOnly) {
    parsed += ".readonly()";
  }
  return parsed;
};
function jsonSchemaToZod(schema, options = {}) {
  return jsonSchemaToZod$1(schema, { ...options, parserOverride });
}

var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name16 in all)
    __defProp(target, name16, { get: all[name16], enumerable: true });
};
var name6 = "AI_NoObjectGeneratedError";
var marker6 = `vercel.ai.error.${name6}`;
var symbol6 = Symbol.for(marker6);
var _a6;
var NoObjectGeneratedError = class extends AISDKError {
  constructor({
    message = "No object generated.",
    cause,
    text: text2,
    response,
    usage,
    finishReason
  }) {
    super({ name: name6, message, cause });
    this[_a6] = true;
    this.text = text2;
    this.response = response;
    this.usage = usage;
    this.finishReason = finishReason;
  }
  static isInstance(error) {
    return AISDKError.hasMarker(error, marker6);
  }
};
_a6 = symbol6;

// src/prompt/data-content.ts
var dataContentSchema = union$1([
  string$2(),
  _instanceof(Uint8Array),
  _instanceof(ArrayBuffer),
  custom$1(
    // Buffer might not be available in some environments such as CloudFlare:
    (value) => {
      var _a16, _b;
      return (_b = (_a16 = globalThis.Buffer) == null ? void 0 : _a16.isBuffer(value)) != null ? _b : false;
    },
    { message: "Must be a Buffer" }
  )
]);
var jsonValueSchema = lazy(
  () => union$1([
    _null$3(),
    string$2(),
    number$2(),
    boolean$2(),
    record(string$2(), jsonValueSchema),
    array$1(jsonValueSchema)
  ])
);

// src/types/provider-metadata.ts
var providerMetadataSchema = record(
  string$2(),
  record(string$2(), jsonValueSchema)
);
var textPartSchema = object$2({
  type: literal$1("text"),
  text: string$2(),
  providerOptions: providerMetadataSchema.optional()
});
var imagePartSchema = object$2({
  type: literal$1("image"),
  image: union$1([dataContentSchema, _instanceof(URL)]),
  mediaType: string$2().optional(),
  providerOptions: providerMetadataSchema.optional()
});
var filePartSchema = object$2({
  type: literal$1("file"),
  data: union$1([dataContentSchema, _instanceof(URL)]),
  filename: string$2().optional(),
  mediaType: string$2(),
  providerOptions: providerMetadataSchema.optional()
});
var reasoningPartSchema = object$2({
  type: literal$1("reasoning"),
  text: string$2(),
  providerOptions: providerMetadataSchema.optional()
});
var toolCallPartSchema = object$2({
  type: literal$1("tool-call"),
  toolCallId: string$2(),
  toolName: string$2(),
  input: unknown$1(),
  providerOptions: providerMetadataSchema.optional(),
  providerExecuted: boolean$2().optional()
});
var outputSchema = discriminatedUnion("type", [
  object$2({
    type: literal$1("text"),
    value: string$2()
  }),
  object$2({
    type: literal$1("json"),
    value: jsonValueSchema
  }),
  object$2({
    type: literal$1("error-text"),
    value: string$2()
  }),
  object$2({
    type: literal$1("error-json"),
    value: jsonValueSchema
  }),
  object$2({
    type: literal$1("content"),
    value: array$1(
      union$1([
        object$2({
          type: literal$1("text"),
          text: string$2()
        }),
        object$2({
          type: literal$1("media"),
          data: string$2(),
          mediaType: string$2()
        })
      ])
    )
  })
]);
var toolResultPartSchema = object$2({
  type: literal$1("tool-result"),
  toolCallId: string$2(),
  toolName: string$2(),
  output: outputSchema,
  providerOptions: providerMetadataSchema.optional()
});

// src/prompt/message.ts
var systemModelMessageSchema = object$2(
  {
    role: literal$1("system"),
    content: string$2(),
    providerOptions: providerMetadataSchema.optional()
  }
);
var userModelMessageSchema = object$2({
  role: literal$1("user"),
  content: union$1([
    string$2(),
    array$1(union$1([textPartSchema, imagePartSchema, filePartSchema]))
  ]),
  providerOptions: providerMetadataSchema.optional()
});
var assistantModelMessageSchema = object$2({
  role: literal$1("assistant"),
  content: union$1([
    string$2(),
    array$1(
      union$1([
        textPartSchema,
        filePartSchema,
        reasoningPartSchema,
        toolCallPartSchema,
        toolResultPartSchema
      ])
    )
  ]),
  providerOptions: providerMetadataSchema.optional()
});
var toolModelMessageSchema = object$2({
  role: literal$1("tool"),
  content: array$1(toolResultPartSchema),
  providerOptions: providerMetadataSchema.optional()
});
union$1([
  systemModelMessageSchema,
  userModelMessageSchema,
  assistantModelMessageSchema,
  toolModelMessageSchema
]);

// src/generate-text/generate-text.ts
createIdGenerator({
  prefix: "aitxt",
  size: 24
});

// src/ui-message-stream/json-to-sse-transform-stream.ts
(class extends TransformStream {
  constructor() {
    super({
      transform(part, controller) {
        controller.enqueue(`data: ${JSON.stringify(part)}

`);
      },
      flush(controller) {
        controller.enqueue("data: [DONE]\n\n");
      }
    });
  }
});

// src/util/fix-json.ts
function fixJson(input) {
  const stack = ["ROOT"];
  let lastValidIndex = -1;
  let literalStart = null;
  function processValueStart(char, i, swapState) {
    {
      switch (char) {
        case '"': {
          lastValidIndex = i;
          stack.pop();
          stack.push(swapState);
          stack.push("INSIDE_STRING");
          break;
        }
        case "f":
        case "t":
        case "n": {
          lastValidIndex = i;
          literalStart = i;
          stack.pop();
          stack.push(swapState);
          stack.push("INSIDE_LITERAL");
          break;
        }
        case "-": {
          stack.pop();
          stack.push(swapState);
          stack.push("INSIDE_NUMBER");
          break;
        }
        case "0":
        case "1":
        case "2":
        case "3":
        case "4":
        case "5":
        case "6":
        case "7":
        case "8":
        case "9": {
          lastValidIndex = i;
          stack.pop();
          stack.push(swapState);
          stack.push("INSIDE_NUMBER");
          break;
        }
        case "{": {
          lastValidIndex = i;
          stack.pop();
          stack.push(swapState);
          stack.push("INSIDE_OBJECT_START");
          break;
        }
        case "[": {
          lastValidIndex = i;
          stack.pop();
          stack.push(swapState);
          stack.push("INSIDE_ARRAY_START");
          break;
        }
      }
    }
  }
  function processAfterObjectValue(char, i) {
    switch (char) {
      case ",": {
        stack.pop();
        stack.push("INSIDE_OBJECT_AFTER_COMMA");
        break;
      }
      case "}": {
        lastValidIndex = i;
        stack.pop();
        break;
      }
    }
  }
  function processAfterArrayValue(char, i) {
    switch (char) {
      case ",": {
        stack.pop();
        stack.push("INSIDE_ARRAY_AFTER_COMMA");
        break;
      }
      case "]": {
        lastValidIndex = i;
        stack.pop();
        break;
      }
    }
  }
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    const currentState = stack[stack.length - 1];
    switch (currentState) {
      case "ROOT":
        processValueStart(char, i, "FINISH");
        break;
      case "INSIDE_OBJECT_START": {
        switch (char) {
          case '"': {
            stack.pop();
            stack.push("INSIDE_OBJECT_KEY");
            break;
          }
          case "}": {
            lastValidIndex = i;
            stack.pop();
            break;
          }
        }
        break;
      }
      case "INSIDE_OBJECT_AFTER_COMMA": {
        switch (char) {
          case '"': {
            stack.pop();
            stack.push("INSIDE_OBJECT_KEY");
            break;
          }
        }
        break;
      }
      case "INSIDE_OBJECT_KEY": {
        switch (char) {
          case '"': {
            stack.pop();
            stack.push("INSIDE_OBJECT_AFTER_KEY");
            break;
          }
        }
        break;
      }
      case "INSIDE_OBJECT_AFTER_KEY": {
        switch (char) {
          case ":": {
            stack.pop();
            stack.push("INSIDE_OBJECT_BEFORE_VALUE");
            break;
          }
        }
        break;
      }
      case "INSIDE_OBJECT_BEFORE_VALUE": {
        processValueStart(char, i, "INSIDE_OBJECT_AFTER_VALUE");
        break;
      }
      case "INSIDE_OBJECT_AFTER_VALUE": {
        processAfterObjectValue(char, i);
        break;
      }
      case "INSIDE_STRING": {
        switch (char) {
          case '"': {
            stack.pop();
            lastValidIndex = i;
            break;
          }
          case "\\": {
            stack.push("INSIDE_STRING_ESCAPE");
            break;
          }
          default: {
            lastValidIndex = i;
          }
        }
        break;
      }
      case "INSIDE_ARRAY_START": {
        switch (char) {
          case "]": {
            lastValidIndex = i;
            stack.pop();
            break;
          }
          default: {
            lastValidIndex = i;
            processValueStart(char, i, "INSIDE_ARRAY_AFTER_VALUE");
            break;
          }
        }
        break;
      }
      case "INSIDE_ARRAY_AFTER_VALUE": {
        switch (char) {
          case ",": {
            stack.pop();
            stack.push("INSIDE_ARRAY_AFTER_COMMA");
            break;
          }
          case "]": {
            lastValidIndex = i;
            stack.pop();
            break;
          }
          default: {
            lastValidIndex = i;
            break;
          }
        }
        break;
      }
      case "INSIDE_ARRAY_AFTER_COMMA": {
        processValueStart(char, i, "INSIDE_ARRAY_AFTER_VALUE");
        break;
      }
      case "INSIDE_STRING_ESCAPE": {
        stack.pop();
        lastValidIndex = i;
        break;
      }
      case "INSIDE_NUMBER": {
        switch (char) {
          case "0":
          case "1":
          case "2":
          case "3":
          case "4":
          case "5":
          case "6":
          case "7":
          case "8":
          case "9": {
            lastValidIndex = i;
            break;
          }
          case "e":
          case "E":
          case "-":
          case ".": {
            break;
          }
          case ",": {
            stack.pop();
            if (stack[stack.length - 1] === "INSIDE_ARRAY_AFTER_VALUE") {
              processAfterArrayValue(char, i);
            }
            if (stack[stack.length - 1] === "INSIDE_OBJECT_AFTER_VALUE") {
              processAfterObjectValue(char, i);
            }
            break;
          }
          case "}": {
            stack.pop();
            if (stack[stack.length - 1] === "INSIDE_OBJECT_AFTER_VALUE") {
              processAfterObjectValue(char, i);
            }
            break;
          }
          case "]": {
            stack.pop();
            if (stack[stack.length - 1] === "INSIDE_ARRAY_AFTER_VALUE") {
              processAfterArrayValue(char, i);
            }
            break;
          }
          default: {
            stack.pop();
            break;
          }
        }
        break;
      }
      case "INSIDE_LITERAL": {
        const partialLiteral = input.substring(literalStart, i + 1);
        if (!"false".startsWith(partialLiteral) && !"true".startsWith(partialLiteral) && !"null".startsWith(partialLiteral)) {
          stack.pop();
          if (stack[stack.length - 1] === "INSIDE_OBJECT_AFTER_VALUE") {
            processAfterObjectValue(char, i);
          } else if (stack[stack.length - 1] === "INSIDE_ARRAY_AFTER_VALUE") {
            processAfterArrayValue(char, i);
          }
        } else {
          lastValidIndex = i;
        }
        break;
      }
    }
  }
  let result = input.slice(0, lastValidIndex + 1);
  for (let i = stack.length - 1; i >= 0; i--) {
    const state = stack[i];
    switch (state) {
      case "INSIDE_STRING": {
        result += '"';
        break;
      }
      case "INSIDE_OBJECT_KEY":
      case "INSIDE_OBJECT_AFTER_KEY":
      case "INSIDE_OBJECT_AFTER_COMMA":
      case "INSIDE_OBJECT_START":
      case "INSIDE_OBJECT_BEFORE_VALUE":
      case "INSIDE_OBJECT_AFTER_VALUE": {
        result += "}";
        break;
      }
      case "INSIDE_ARRAY_START":
      case "INSIDE_ARRAY_AFTER_COMMA":
      case "INSIDE_ARRAY_AFTER_VALUE": {
        result += "]";
        break;
      }
      case "INSIDE_LITERAL": {
        const partialLiteral = input.substring(literalStart, input.length);
        if ("true".startsWith(partialLiteral)) {
          result += "true".slice(partialLiteral.length);
        } else if ("false".startsWith(partialLiteral)) {
          result += "false".slice(partialLiteral.length);
        } else if ("null".startsWith(partialLiteral)) {
          result += "null".slice(partialLiteral.length);
        }
      }
    }
  }
  return result;
}

// src/util/parse-partial-json.ts
async function parsePartialJson(jsonText) {
  if (jsonText === void 0) {
    return { value: void 0, state: "undefined-input" };
  }
  let result = await safeParseJSON({ text: jsonText });
  if (result.success) {
    return { value: result.value, state: "successful-parse" };
  }
  result = await safeParseJSON({ text: fixJson(jsonText) });
  if (result.success) {
    return { value: result.value, state: "repaired-parse" };
  }
  return { value: void 0, state: "failed-parse" };
}

// src/generate-text/stream-text.ts
createIdGenerator({
  prefix: "aitxt",
  size: 24
});

// src/generate-object/generate-object.ts
createIdGenerator({ prefix: "aiobj", size: 24 });

// src/generate-object/stream-object.ts
createIdGenerator({ prefix: "aiobj", size: 24 });

// src/generate-text/output.ts
var output_exports = {};
__export(output_exports, {
  object: () => object$1,
  text: () => text
});
var text = () => ({
  type: "text",
  responseFormat: { type: "text" },
  async parsePartial({ text: text2 }) {
    return { partial: text2 };
  },
  async parseOutput({ text: text2 }) {
    return text2;
  }
});
var object$1 = ({
  schema: inputSchema
}) => {
  const schema = asSchema(inputSchema);
  return {
    type: "object",
    responseFormat: {
      type: "json",
      schema: schema.jsonSchema
    },
    async parsePartial({ text: text2 }) {
      const result = await parsePartialJson(text2);
      switch (result.state) {
        case "failed-parse":
        case "undefined-input":
          return void 0;
        case "repaired-parse":
        case "successful-parse":
          return {
            // Note: currently no validation of partial results:
            partial: result.value
          };
        default: {
          const _exhaustiveCheck = result.state;
          throw new Error(`Unsupported parse state: ${_exhaustiveCheck}`);
        }
      }
    },
    async parseOutput({ text: text2 }, context) {
      const parseResult = await safeParseJSON({ text: text2 });
      if (!parseResult.success) {
        throw new NoObjectGeneratedError({
          message: "No object generated: could not parse the response.",
          cause: parseResult.error,
          text: text2,
          response: context.response,
          usage: context.usage,
          finishReason: context.finishReason
        });
      }
      const validationResult = await safeValidateTypes({
        value: parseResult.value,
        schema
      });
      if (!validationResult.success) {
        throw new NoObjectGeneratedError({
          message: "No object generated: response did not match schema.",
          cause: validationResult.error,
          text: text2,
          response: context.response,
          usage: context.usage,
          finishReason: context.finishReason
        });
      }
      return validationResult.value;
    }
  };
};

/** A special constant with type `never` */
function $constructor(name, initializer, params) {
    function init(inst, def) {
        if (!inst._zod) {
            Object.defineProperty(inst, "_zod", {
                value: {
                    def,
                    constr: _,
                    traits: new Set(),
                },
                enumerable: false,
            });
        }
        if (inst._zod.traits.has(name)) {
            return;
        }
        inst._zod.traits.add(name);
        initializer(inst, def);
        // support prototype modifications
        const proto = _.prototype;
        const keys = Object.keys(proto);
        for (let i = 0; i < keys.length; i++) {
            const k = keys[i];
            if (!(k in inst)) {
                inst[k] = proto[k].bind(inst);
            }
        }
    }
    // doesn't work if Parent has a constructor with arguments
    const Parent = params?.Parent ?? Object;
    class Definition extends Parent {
    }
    Object.defineProperty(Definition, "name", { value: name });
    function _(def) {
        var _a;
        const inst = params?.Parent ? new Definition() : this;
        init(inst, def);
        (_a = inst._zod).deferred ?? (_a.deferred = []);
        for (const fn of inst._zod.deferred) {
            fn();
        }
        return inst;
    }
    Object.defineProperty(_, "init", { value: init });
    Object.defineProperty(_, Symbol.hasInstance, {
        value: (inst) => {
            if (params?.Parent && inst instanceof params.Parent)
                return true;
            return inst?._zod?.traits?.has(name);
        },
    });
    Object.defineProperty(_, "name", { value: name });
    return _;
}
class $ZodAsyncError extends Error {
    constructor() {
        super(`Encountered Promise during synchronous parse. Use .parseAsync() instead.`);
    }
}
class $ZodEncodeError extends Error {
    constructor(name) {
        super(`Encountered unidirectional transform during encode: ${name}`);
        this.name = "ZodEncodeError";
    }
}
const globalConfig = {};
function config(newConfig) {
    return globalConfig;
}

// functions
function getEnumValues(entries) {
    const numericValues = Object.values(entries).filter((v) => typeof v === "number");
    const values = Object.entries(entries)
        .filter(([k, _]) => numericValues.indexOf(+k) === -1)
        .map(([_, v]) => v);
    return values;
}
function jsonStringifyReplacer(_, value) {
    if (typeof value === "bigint")
        return value.toString();
    return value;
}
function cached(getter) {
    return {
        get value() {
            {
                const value = getter();
                Object.defineProperty(this, "value", { value });
                return value;
            }
        },
    };
}
function nullish(input) {
    return input === null || input === undefined;
}
function cleanRegex(source) {
    const start = source.startsWith("^") ? 1 : 0;
    const end = source.endsWith("$") ? source.length - 1 : source.length;
    return source.slice(start, end);
}
function floatSafeRemainder(val, step) {
    const valDecCount = (val.toString().split(".")[1] || "").length;
    const stepString = step.toString();
    let stepDecCount = (stepString.split(".")[1] || "").length;
    if (stepDecCount === 0 && /\d?e-\d?/.test(stepString)) {
        const match = stepString.match(/\d?e-(\d?)/);
        if (match?.[1]) {
            stepDecCount = Number.parseInt(match[1]);
        }
    }
    const decCount = valDecCount > stepDecCount ? valDecCount : stepDecCount;
    const valInt = Number.parseInt(val.toFixed(decCount).replace(".", ""));
    const stepInt = Number.parseInt(step.toFixed(decCount).replace(".", ""));
    return (valInt % stepInt) / 10 ** decCount;
}
const EVALUATING = Symbol("evaluating");
function defineLazy(object, key, getter) {
    let value = undefined;
    Object.defineProperty(object, key, {
        get() {
            if (value === EVALUATING) {
                // Circular reference detected, return undefined to break the cycle
                return undefined;
            }
            if (value === undefined) {
                value = EVALUATING;
                value = getter();
            }
            return value;
        },
        set(v) {
            Object.defineProperty(object, key, {
                value: v,
                // configurable: true,
            });
            // object[key] = v;
        },
        configurable: true,
    });
}
function assignProp(target, prop, value) {
    Object.defineProperty(target, prop, {
        value,
        writable: true,
        enumerable: true,
        configurable: true,
    });
}
function mergeDefs(...defs) {
    const mergedDescriptors = {};
    for (const def of defs) {
        const descriptors = Object.getOwnPropertyDescriptors(def);
        Object.assign(mergedDescriptors, descriptors);
    }
    return Object.defineProperties({}, mergedDescriptors);
}
function esc(str) {
    return JSON.stringify(str);
}
function slugify(input) {
    return input
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, "")
        .replace(/[\s_-]+/g, "-")
        .replace(/^-+|-+$/g, "");
}
const captureStackTrace = ("captureStackTrace" in Error ? Error.captureStackTrace : (..._args) => { });
function isObject(data) {
    return typeof data === "object" && data !== null && !Array.isArray(data);
}
const allowsEval = cached(() => {
    // @ts-ignore
    if (typeof navigator !== "undefined" && navigator?.userAgent?.includes("Cloudflare")) {
        return false;
    }
    try {
        const F = Function;
        new F("");
        return true;
    }
    catch (_) {
        return false;
    }
});
function isPlainObject(o) {
    if (isObject(o) === false)
        return false;
    // modified constructor
    const ctor = o.constructor;
    if (ctor === undefined)
        return true;
    if (typeof ctor !== "function")
        return true;
    // modified prototype
    const prot = ctor.prototype;
    if (isObject(prot) === false)
        return false;
    // ctor doesn't have static `isPrototypeOf`
    if (Object.prototype.hasOwnProperty.call(prot, "isPrototypeOf") === false) {
        return false;
    }
    return true;
}
function shallowClone(o) {
    if (isPlainObject(o))
        return { ...o };
    if (Array.isArray(o))
        return [...o];
    return o;
}
const propertyKeyTypes = new Set(["string", "number", "symbol"]);
function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
// zod-specific utils
function clone(inst, def, params) {
    const cl = new inst._zod.constr(def ?? inst._zod.def);
    if (!def || params?.parent)
        cl._zod.parent = inst;
    return cl;
}
function normalizeParams(_params) {
    const params = _params;
    if (!params)
        return {};
    if (typeof params === "string")
        return { error: () => params };
    if (params?.message !== undefined) {
        if (params?.error !== undefined)
            throw new Error("Cannot specify both `message` and `error` params");
        params.error = params.message;
    }
    delete params.message;
    if (typeof params.error === "string")
        return { ...params, error: () => params.error };
    return params;
}
function optionalKeys(shape) {
    return Object.keys(shape).filter((k) => {
        return shape[k]._zod.optin === "optional" && shape[k]._zod.optout === "optional";
    });
}
const NUMBER_FORMAT_RANGES = {
    safeint: [Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER],
    int32: [-2147483648, 2147483647],
    uint32: [0, 4294967295],
    float32: [-34028234663852886e22, 3.4028234663852886e38],
    float64: [-Number.MAX_VALUE, Number.MAX_VALUE],
};
function pick(schema, mask) {
    const currDef = schema._zod.def;
    const def = mergeDefs(schema._zod.def, {
        get shape() {
            const newShape = {};
            for (const key in mask) {
                if (!(key in currDef.shape)) {
                    throw new Error(`Unrecognized key: "${key}"`);
                }
                if (!mask[key])
                    continue;
                newShape[key] = currDef.shape[key];
            }
            assignProp(this, "shape", newShape); // self-caching
            return newShape;
        },
        checks: [],
    });
    return clone(schema, def);
}
function omit(schema, mask) {
    const currDef = schema._zod.def;
    const def = mergeDefs(schema._zod.def, {
        get shape() {
            const newShape = { ...schema._zod.def.shape };
            for (const key in mask) {
                if (!(key in currDef.shape)) {
                    throw new Error(`Unrecognized key: "${key}"`);
                }
                if (!mask[key])
                    continue;
                delete newShape[key];
            }
            assignProp(this, "shape", newShape); // self-caching
            return newShape;
        },
        checks: [],
    });
    return clone(schema, def);
}
function extend(schema, shape) {
    if (!isPlainObject(shape)) {
        throw new Error("Invalid input to extend: expected a plain object");
    }
    const checks = schema._zod.def.checks;
    const hasChecks = checks && checks.length > 0;
    if (hasChecks) {
        throw new Error("Object schemas containing refinements cannot be extended. Use `.safeExtend()` instead.");
    }
    const def = mergeDefs(schema._zod.def, {
        get shape() {
            const _shape = { ...schema._zod.def.shape, ...shape };
            assignProp(this, "shape", _shape); // self-caching
            return _shape;
        },
        checks: [],
    });
    return clone(schema, def);
}
function safeExtend(schema, shape) {
    if (!isPlainObject(shape)) {
        throw new Error("Invalid input to safeExtend: expected a plain object");
    }
    const def = {
        ...schema._zod.def,
        get shape() {
            const _shape = { ...schema._zod.def.shape, ...shape };
            assignProp(this, "shape", _shape); // self-caching
            return _shape;
        },
        checks: schema._zod.def.checks,
    };
    return clone(schema, def);
}
function merge(a, b) {
    const def = mergeDefs(a._zod.def, {
        get shape() {
            const _shape = { ...a._zod.def.shape, ...b._zod.def.shape };
            assignProp(this, "shape", _shape); // self-caching
            return _shape;
        },
        get catchall() {
            return b._zod.def.catchall;
        },
        checks: [], // delete existing checks
    });
    return clone(a, def);
}
function partial(Class, schema, mask) {
    const def = mergeDefs(schema._zod.def, {
        get shape() {
            const oldShape = schema._zod.def.shape;
            const shape = { ...oldShape };
            if (mask) {
                for (const key in mask) {
                    if (!(key in oldShape)) {
                        throw new Error(`Unrecognized key: "${key}"`);
                    }
                    if (!mask[key])
                        continue;
                    // if (oldShape[key]!._zod.optin === "optional") continue;
                    shape[key] = Class
                        ? new Class({
                            type: "optional",
                            innerType: oldShape[key],
                        })
                        : oldShape[key];
                }
            }
            else {
                for (const key in oldShape) {
                    // if (oldShape[key]!._zod.optin === "optional") continue;
                    shape[key] = Class
                        ? new Class({
                            type: "optional",
                            innerType: oldShape[key],
                        })
                        : oldShape[key];
                }
            }
            assignProp(this, "shape", shape); // self-caching
            return shape;
        },
        checks: [],
    });
    return clone(schema, def);
}
function required(Class, schema, mask) {
    const def = mergeDefs(schema._zod.def, {
        get shape() {
            const oldShape = schema._zod.def.shape;
            const shape = { ...oldShape };
            if (mask) {
                for (const key in mask) {
                    if (!(key in shape)) {
                        throw new Error(`Unrecognized key: "${key}"`);
                    }
                    if (!mask[key])
                        continue;
                    // overwrite with non-optional
                    shape[key] = new Class({
                        type: "nonoptional",
                        innerType: oldShape[key],
                    });
                }
            }
            else {
                for (const key in oldShape) {
                    // overwrite with non-optional
                    shape[key] = new Class({
                        type: "nonoptional",
                        innerType: oldShape[key],
                    });
                }
            }
            assignProp(this, "shape", shape); // self-caching
            return shape;
        },
        checks: [],
    });
    return clone(schema, def);
}
// invalid_type | too_big | too_small | invalid_format | not_multiple_of | unrecognized_keys | invalid_union | invalid_key | invalid_element | invalid_value | custom
function aborted(x, startIndex = 0) {
    if (x.aborted === true)
        return true;
    for (let i = startIndex; i < x.issues.length; i++) {
        if (x.issues[i]?.continue !== true) {
            return true;
        }
    }
    return false;
}
function prefixIssues(path, issues) {
    return issues.map((iss) => {
        var _a;
        (_a = iss).path ?? (_a.path = []);
        iss.path.unshift(path);
        return iss;
    });
}
function unwrapMessage(message) {
    return typeof message === "string" ? message : message?.message;
}
function finalizeIssue(iss, ctx, config) {
    const full = { ...iss, path: iss.path ?? [] };
    // for backwards compatibility
    if (!iss.message) {
        const message = unwrapMessage(iss.inst?._zod.def?.error?.(iss)) ??
            unwrapMessage(ctx?.error?.(iss)) ??
            unwrapMessage(config.customError?.(iss)) ??
            unwrapMessage(config.localeError?.(iss)) ??
            "Invalid input";
        full.message = message;
    }
    // delete (full as any).def;
    delete full.inst;
    delete full.continue;
    if (!ctx?.reportInput) {
        delete full.input;
    }
    return full;
}
function getSizableOrigin(input) {
    if (input instanceof Set)
        return "set";
    if (input instanceof Map)
        return "map";
    // @ts-ignore
    if (input instanceof File)
        return "file";
    return "unknown";
}
function getLengthableOrigin(input) {
    if (Array.isArray(input))
        return "array";
    if (typeof input === "string")
        return "string";
    return "unknown";
}
function issue(...args) {
    const [iss, input, inst] = args;
    if (typeof iss === "string") {
        return {
            message: iss,
            code: "custom",
            input,
            inst,
        };
    }
    return { ...iss };
}

const initializer$1 = (inst, def) => {
    inst.name = "$ZodError";
    Object.defineProperty(inst, "_zod", {
        value: inst._zod,
        enumerable: false,
    });
    Object.defineProperty(inst, "issues", {
        value: def,
        enumerable: false,
    });
    inst.message = JSON.stringify(def, jsonStringifyReplacer, 2);
    Object.defineProperty(inst, "toString", {
        value: () => inst.message,
        enumerable: false,
    });
};
const $ZodError = $constructor("$ZodError", initializer$1);
const $ZodRealError = $constructor("$ZodError", initializer$1, { Parent: Error });
function flattenError(error, mapper = (issue) => issue.message) {
    const fieldErrors = {};
    const formErrors = [];
    for (const sub of error.issues) {
        if (sub.path.length > 0) {
            fieldErrors[sub.path[0]] = fieldErrors[sub.path[0]] || [];
            fieldErrors[sub.path[0]].push(mapper(sub));
        }
        else {
            formErrors.push(mapper(sub));
        }
    }
    return { formErrors, fieldErrors };
}
function formatError(error, mapper = (issue) => issue.message) {
    const fieldErrors = { _errors: [] };
    const processError = (error) => {
        for (const issue of error.issues) {
            if (issue.code === "invalid_union" && issue.errors.length) {
                issue.errors.map((issues) => processError({ issues }));
            }
            else if (issue.code === "invalid_key") {
                processError({ issues: issue.issues });
            }
            else if (issue.code === "invalid_element") {
                processError({ issues: issue.issues });
            }
            else if (issue.path.length === 0) {
                fieldErrors._errors.push(mapper(issue));
            }
            else {
                let curr = fieldErrors;
                let i = 0;
                while (i < issue.path.length) {
                    const el = issue.path[i];
                    const terminal = i === issue.path.length - 1;
                    if (!terminal) {
                        curr[el] = curr[el] || { _errors: [] };
                    }
                    else {
                        curr[el] = curr[el] || { _errors: [] };
                        curr[el]._errors.push(mapper(issue));
                    }
                    curr = curr[el];
                    i++;
                }
            }
        }
    };
    processError(error);
    return fieldErrors;
}

const _parse = (_Err) => (schema, value, _ctx, _params) => {
    const ctx = _ctx ? Object.assign(_ctx, { async: false }) : { async: false };
    const result = schema._zod.run({ value, issues: [] }, ctx);
    if (result instanceof Promise) {
        throw new $ZodAsyncError();
    }
    if (result.issues.length) {
        const e = new (_params?.Err ?? _Err)(result.issues.map((iss) => finalizeIssue(iss, ctx, config())));
        captureStackTrace(e, _params?.callee);
        throw e;
    }
    return result.value;
};
const _parseAsync = (_Err) => async (schema, value, _ctx, params) => {
    const ctx = _ctx ? Object.assign(_ctx, { async: true }) : { async: true };
    let result = schema._zod.run({ value, issues: [] }, ctx);
    if (result instanceof Promise)
        result = await result;
    if (result.issues.length) {
        const e = new (params?.Err ?? _Err)(result.issues.map((iss) => finalizeIssue(iss, ctx, config())));
        captureStackTrace(e, params?.callee);
        throw e;
    }
    return result.value;
};
const _safeParse = (_Err) => (schema, value, _ctx) => {
    const ctx = _ctx ? { ..._ctx, async: false } : { async: false };
    const result = schema._zod.run({ value, issues: [] }, ctx);
    if (result instanceof Promise) {
        throw new $ZodAsyncError();
    }
    return result.issues.length
        ? {
            success: false,
            error: new (_Err ?? $ZodError)(result.issues.map((iss) => finalizeIssue(iss, ctx, config()))),
        }
        : { success: true, data: result.value };
};
const safeParse$1 = /* @__PURE__*/ _safeParse($ZodRealError);
const _safeParseAsync = (_Err) => async (schema, value, _ctx) => {
    const ctx = _ctx ? Object.assign(_ctx, { async: true }) : { async: true };
    let result = schema._zod.run({ value, issues: [] }, ctx);
    if (result instanceof Promise)
        result = await result;
    return result.issues.length
        ? {
            success: false,
            error: new _Err(result.issues.map((iss) => finalizeIssue(iss, ctx, config()))),
        }
        : { success: true, data: result.value };
};
const safeParseAsync$1 = /* @__PURE__*/ _safeParseAsync($ZodRealError);
const _encode = (_Err) => (schema, value, _ctx) => {
    const ctx = _ctx ? Object.assign(_ctx, { direction: "backward" }) : { direction: "backward" };
    return _parse(_Err)(schema, value, ctx);
};
const _decode = (_Err) => (schema, value, _ctx) => {
    return _parse(_Err)(schema, value, _ctx);
};
const _encodeAsync = (_Err) => async (schema, value, _ctx) => {
    const ctx = _ctx ? Object.assign(_ctx, { direction: "backward" }) : { direction: "backward" };
    return _parseAsync(_Err)(schema, value, ctx);
};
const _decodeAsync = (_Err) => async (schema, value, _ctx) => {
    return _parseAsync(_Err)(schema, value, _ctx);
};
const _safeEncode = (_Err) => (schema, value, _ctx) => {
    const ctx = _ctx ? Object.assign(_ctx, { direction: "backward" }) : { direction: "backward" };
    return _safeParse(_Err)(schema, value, ctx);
};
const _safeDecode = (_Err) => (schema, value, _ctx) => {
    return _safeParse(_Err)(schema, value, _ctx);
};
const _safeEncodeAsync = (_Err) => async (schema, value, _ctx) => {
    const ctx = _ctx ? Object.assign(_ctx, { direction: "backward" }) : { direction: "backward" };
    return _safeParseAsync(_Err)(schema, value, ctx);
};
const _safeDecodeAsync = (_Err) => async (schema, value, _ctx) => {
    return _safeParseAsync(_Err)(schema, value, _ctx);
};

const cuid = /^[cC][^\s-]{8,}$/;
const cuid2 = /^[0-9a-z]+$/;
const ulid = /^[0-9A-HJKMNP-TV-Za-hjkmnp-tv-z]{26}$/;
const xid = /^[0-9a-vA-V]{20}$/;
const ksuid = /^[A-Za-z0-9]{27}$/;
const nanoid = /^[a-zA-Z0-9_-]{21}$/;
/** ISO 8601-1 duration regex. Does not support the 8601-2 extensions like negative durations or fractional/negative components. */
const duration$1 = /^P(?:(\d+W)|(?!.*W)(?=\d|T\d)(\d+Y)?(\d+M)?(\d+D)?(T(?=\d)(\d+H)?(\d+M)?(\d+([.,]\d+)?S)?)?)$/;
/** A regex for any UUID-like identifier: 8-4-4-4-12 hex pattern */
const guid = /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$/;
/** Returns a regex for validating an RFC 9562/4122 UUID.
 *
 * @param version Optionally specify a version 1-8. If no version is specified, all versions are supported. */
const uuid = (version) => {
    if (!version)
        return /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$/;
    return new RegExp(`^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-${version}[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12})$`);
};
/** Practical email validation */
const email = /^(?!\.)(?!.*\.\.)([A-Za-z0-9_'+\-\.]*)[A-Za-z0-9_+-]@([A-Za-z0-9][A-Za-z0-9\-]*\.)+[A-Za-z]{2,}$/;
// from https://thekevinscott.com/emojis-in-javascript/#writing-a-regular-expression
const _emoji$1 = `^(\\p{Extended_Pictographic}|\\p{Emoji_Component})+$`;
function emoji() {
    return new RegExp(_emoji$1, "u");
}
const ipv4 = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/;
const ipv6 = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:))$/;
const cidrv4 = /^((25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/([0-9]|[1-2][0-9]|3[0-2])$/;
const cidrv6 = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|::|([0-9a-fA-F]{1,4})?::([0-9a-fA-F]{1,4}:?){0,6})\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/;
// https://stackoverflow.com/questions/7860392/determine-if-string-is-in-base64-using-javascript
const base64 = /^$|^(?:[0-9a-zA-Z+/]{4})*(?:(?:[0-9a-zA-Z+/]{2}==)|(?:[0-9a-zA-Z+/]{3}=))?$/;
const base64url = /^[A-Za-z0-9_-]*$/;
// https://blog.stevenlevithan.com/archives/validate-phone-number#r4-3 (regex sans spaces)
const e164 = /^\+(?:[0-9]){6,14}[0-9]$/;
// const dateSource = `((\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-((0[13578]|1[02])-(0[1-9]|[12]\\d|3[01])|(0[469]|11)-(0[1-9]|[12]\\d|30)|(02)-(0[1-9]|1\\d|2[0-8])))`;
const dateSource = `(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))`;
const date$1 = /*@__PURE__*/ new RegExp(`^${dateSource}$`);
function timeSource(args) {
    const hhmm = `(?:[01]\\d|2[0-3]):[0-5]\\d`;
    const regex = typeof args.precision === "number"
        ? args.precision === -1
            ? `${hhmm}`
            : args.precision === 0
                ? `${hhmm}:[0-5]\\d`
                : `${hhmm}:[0-5]\\d\\.\\d{${args.precision}}`
        : `${hhmm}(?::[0-5]\\d(?:\\.\\d+)?)?`;
    return regex;
}
function time$1(args) {
    return new RegExp(`^${timeSource(args)}$`);
}
// Adapted from https://stackoverflow.com/a/3143231
function datetime$1(args) {
    const time = timeSource({ precision: args.precision });
    const opts = ["Z"];
    if (args.local)
        opts.push("");
    // if (args.offset) opts.push(`([+-]\\d{2}:\\d{2})`);
    if (args.offset)
        opts.push(`([+-](?:[01]\\d|2[0-3]):[0-5]\\d)`);
    const timeRegex = `${time}(?:${opts.join("|")})`;
    return new RegExp(`^${dateSource}T(?:${timeRegex})$`);
}
const string$1 = (params) => {
    const regex = params ? `[\\s\\S]{${params?.minimum ?? 0},${params?.maximum ?? ""}}` : `[\\s\\S]*`;
    return new RegExp(`^${regex}$`);
};
const integer = /^-?\d+$/;
const number$1 = /^-?\d+(?:\.\d+)?/;
const boolean$1 = /^(?:true|false)$/i;
const _null$2 = /^null$/i;
// regex for string with no uppercase letters
const lowercase = /^[^A-Z]*$/;
// regex for string with no lowercase letters
const uppercase = /^[^a-z]*$/;

// import { $ZodType } from "./schemas.js";
const $ZodCheck = /*@__PURE__*/ $constructor("$ZodCheck", (inst, def) => {
    var _a;
    inst._zod ?? (inst._zod = {});
    inst._zod.def = def;
    (_a = inst._zod).onattach ?? (_a.onattach = []);
});
const numericOriginMap = {
    number: "number",
    bigint: "bigint",
    object: "date",
};
const $ZodCheckLessThan = /*@__PURE__*/ $constructor("$ZodCheckLessThan", (inst, def) => {
    $ZodCheck.init(inst, def);
    const origin = numericOriginMap[typeof def.value];
    inst._zod.onattach.push((inst) => {
        const bag = inst._zod.bag;
        const curr = (def.inclusive ? bag.maximum : bag.exclusiveMaximum) ?? Number.POSITIVE_INFINITY;
        if (def.value < curr) {
            if (def.inclusive)
                bag.maximum = def.value;
            else
                bag.exclusiveMaximum = def.value;
        }
    });
    inst._zod.check = (payload) => {
        if (def.inclusive ? payload.value <= def.value : payload.value < def.value) {
            return;
        }
        payload.issues.push({
            origin,
            code: "too_big",
            maximum: def.value,
            input: payload.value,
            inclusive: def.inclusive,
            inst,
            continue: !def.abort,
        });
    };
});
const $ZodCheckGreaterThan = /*@__PURE__*/ $constructor("$ZodCheckGreaterThan", (inst, def) => {
    $ZodCheck.init(inst, def);
    const origin = numericOriginMap[typeof def.value];
    inst._zod.onattach.push((inst) => {
        const bag = inst._zod.bag;
        const curr = (def.inclusive ? bag.minimum : bag.exclusiveMinimum) ?? Number.NEGATIVE_INFINITY;
        if (def.value > curr) {
            if (def.inclusive)
                bag.minimum = def.value;
            else
                bag.exclusiveMinimum = def.value;
        }
    });
    inst._zod.check = (payload) => {
        if (def.inclusive ? payload.value >= def.value : payload.value > def.value) {
            return;
        }
        payload.issues.push({
            origin,
            code: "too_small",
            minimum: def.value,
            input: payload.value,
            inclusive: def.inclusive,
            inst,
            continue: !def.abort,
        });
    };
});
const $ZodCheckMultipleOf = 
/*@__PURE__*/ $constructor("$ZodCheckMultipleOf", (inst, def) => {
    $ZodCheck.init(inst, def);
    inst._zod.onattach.push((inst) => {
        var _a;
        (_a = inst._zod.bag).multipleOf ?? (_a.multipleOf = def.value);
    });
    inst._zod.check = (payload) => {
        if (typeof payload.value !== typeof def.value)
            throw new Error("Cannot mix number and bigint in multiple_of check.");
        const isMultiple = typeof payload.value === "bigint"
            ? payload.value % def.value === BigInt(0)
            : floatSafeRemainder(payload.value, def.value) === 0;
        if (isMultiple)
            return;
        payload.issues.push({
            origin: typeof payload.value,
            code: "not_multiple_of",
            divisor: def.value,
            input: payload.value,
            inst,
            continue: !def.abort,
        });
    };
});
const $ZodCheckNumberFormat = /*@__PURE__*/ $constructor("$ZodCheckNumberFormat", (inst, def) => {
    $ZodCheck.init(inst, def); // no format checks
    def.format = def.format || "float64";
    const isInt = def.format?.includes("int");
    const origin = isInt ? "int" : "number";
    const [minimum, maximum] = NUMBER_FORMAT_RANGES[def.format];
    inst._zod.onattach.push((inst) => {
        const bag = inst._zod.bag;
        bag.format = def.format;
        bag.minimum = minimum;
        bag.maximum = maximum;
        if (isInt)
            bag.pattern = integer;
    });
    inst._zod.check = (payload) => {
        const input = payload.value;
        if (isInt) {
            if (!Number.isInteger(input)) {
                // invalid_format issue
                // payload.issues.push({
                //   expected: def.format,
                //   format: def.format,
                //   code: "invalid_format",
                //   input,
                //   inst,
                // });
                // invalid_type issue
                payload.issues.push({
                    expected: origin,
                    format: def.format,
                    code: "invalid_type",
                    continue: false,
                    input,
                    inst,
                });
                return;
                // not_multiple_of issue
                // payload.issues.push({
                //   code: "not_multiple_of",
                //   origin: "number",
                //   input,
                //   inst,
                //   divisor: 1,
                // });
            }
            if (!Number.isSafeInteger(input)) {
                if (input > 0) {
                    // too_big
                    payload.issues.push({
                        input,
                        code: "too_big",
                        maximum: Number.MAX_SAFE_INTEGER,
                        note: "Integers must be within the safe integer range.",
                        inst,
                        origin,
                        continue: !def.abort,
                    });
                }
                else {
                    // too_small
                    payload.issues.push({
                        input,
                        code: "too_small",
                        minimum: Number.MIN_SAFE_INTEGER,
                        note: "Integers must be within the safe integer range.",
                        inst,
                        origin,
                        continue: !def.abort,
                    });
                }
                return;
            }
        }
        if (input < minimum) {
            payload.issues.push({
                origin: "number",
                input,
                code: "too_small",
                minimum,
                inclusive: true,
                inst,
                continue: !def.abort,
            });
        }
        if (input > maximum) {
            payload.issues.push({
                origin: "number",
                input,
                code: "too_big",
                maximum,
                inst,
            });
        }
    };
});
const $ZodCheckMaxSize = /*@__PURE__*/ $constructor("$ZodCheckMaxSize", (inst, def) => {
    var _a;
    $ZodCheck.init(inst, def);
    (_a = inst._zod.def).when ?? (_a.when = (payload) => {
        const val = payload.value;
        return !nullish(val) && val.size !== undefined;
    });
    inst._zod.onattach.push((inst) => {
        const curr = (inst._zod.bag.maximum ?? Number.POSITIVE_INFINITY);
        if (def.maximum < curr)
            inst._zod.bag.maximum = def.maximum;
    });
    inst._zod.check = (payload) => {
        const input = payload.value;
        const size = input.size;
        if (size <= def.maximum)
            return;
        payload.issues.push({
            origin: getSizableOrigin(input),
            code: "too_big",
            maximum: def.maximum,
            inclusive: true,
            input,
            inst,
            continue: !def.abort,
        });
    };
});
const $ZodCheckMinSize = /*@__PURE__*/ $constructor("$ZodCheckMinSize", (inst, def) => {
    var _a;
    $ZodCheck.init(inst, def);
    (_a = inst._zod.def).when ?? (_a.when = (payload) => {
        const val = payload.value;
        return !nullish(val) && val.size !== undefined;
    });
    inst._zod.onattach.push((inst) => {
        const curr = (inst._zod.bag.minimum ?? Number.NEGATIVE_INFINITY);
        if (def.minimum > curr)
            inst._zod.bag.minimum = def.minimum;
    });
    inst._zod.check = (payload) => {
        const input = payload.value;
        const size = input.size;
        if (size >= def.minimum)
            return;
        payload.issues.push({
            origin: getSizableOrigin(input),
            code: "too_small",
            minimum: def.minimum,
            inclusive: true,
            input,
            inst,
            continue: !def.abort,
        });
    };
});
const $ZodCheckMaxLength = /*@__PURE__*/ $constructor("$ZodCheckMaxLength", (inst, def) => {
    var _a;
    $ZodCheck.init(inst, def);
    (_a = inst._zod.def).when ?? (_a.when = (payload) => {
        const val = payload.value;
        return !nullish(val) && val.length !== undefined;
    });
    inst._zod.onattach.push((inst) => {
        const curr = (inst._zod.bag.maximum ?? Number.POSITIVE_INFINITY);
        if (def.maximum < curr)
            inst._zod.bag.maximum = def.maximum;
    });
    inst._zod.check = (payload) => {
        const input = payload.value;
        const length = input.length;
        if (length <= def.maximum)
            return;
        const origin = getLengthableOrigin(input);
        payload.issues.push({
            origin,
            code: "too_big",
            maximum: def.maximum,
            inclusive: true,
            input,
            inst,
            continue: !def.abort,
        });
    };
});
const $ZodCheckMinLength = /*@__PURE__*/ $constructor("$ZodCheckMinLength", (inst, def) => {
    var _a;
    $ZodCheck.init(inst, def);
    (_a = inst._zod.def).when ?? (_a.when = (payload) => {
        const val = payload.value;
        return !nullish(val) && val.length !== undefined;
    });
    inst._zod.onattach.push((inst) => {
        const curr = (inst._zod.bag.minimum ?? Number.NEGATIVE_INFINITY);
        if (def.minimum > curr)
            inst._zod.bag.minimum = def.minimum;
    });
    inst._zod.check = (payload) => {
        const input = payload.value;
        const length = input.length;
        if (length >= def.minimum)
            return;
        const origin = getLengthableOrigin(input);
        payload.issues.push({
            origin,
            code: "too_small",
            minimum: def.minimum,
            inclusive: true,
            input,
            inst,
            continue: !def.abort,
        });
    };
});
const $ZodCheckLengthEquals = /*@__PURE__*/ $constructor("$ZodCheckLengthEquals", (inst, def) => {
    var _a;
    $ZodCheck.init(inst, def);
    (_a = inst._zod.def).when ?? (_a.when = (payload) => {
        const val = payload.value;
        return !nullish(val) && val.length !== undefined;
    });
    inst._zod.onattach.push((inst) => {
        const bag = inst._zod.bag;
        bag.minimum = def.length;
        bag.maximum = def.length;
        bag.length = def.length;
    });
    inst._zod.check = (payload) => {
        const input = payload.value;
        const length = input.length;
        if (length === def.length)
            return;
        const origin = getLengthableOrigin(input);
        const tooBig = length > def.length;
        payload.issues.push({
            origin,
            ...(tooBig ? { code: "too_big", maximum: def.length } : { code: "too_small", minimum: def.length }),
            inclusive: true,
            exact: true,
            input: payload.value,
            inst,
            continue: !def.abort,
        });
    };
});
const $ZodCheckStringFormat = /*@__PURE__*/ $constructor("$ZodCheckStringFormat", (inst, def) => {
    var _a, _b;
    $ZodCheck.init(inst, def);
    inst._zod.onattach.push((inst) => {
        const bag = inst._zod.bag;
        bag.format = def.format;
        if (def.pattern) {
            bag.patterns ?? (bag.patterns = new Set());
            bag.patterns.add(def.pattern);
        }
    });
    if (def.pattern)
        (_a = inst._zod).check ?? (_a.check = (payload) => {
            def.pattern.lastIndex = 0;
            if (def.pattern.test(payload.value))
                return;
            payload.issues.push({
                origin: "string",
                code: "invalid_format",
                format: def.format,
                input: payload.value,
                ...(def.pattern ? { pattern: def.pattern.toString() } : {}),
                inst,
                continue: !def.abort,
            });
        });
    else
        (_b = inst._zod).check ?? (_b.check = () => { });
});
const $ZodCheckRegex = /*@__PURE__*/ $constructor("$ZodCheckRegex", (inst, def) => {
    $ZodCheckStringFormat.init(inst, def);
    inst._zod.check = (payload) => {
        def.pattern.lastIndex = 0;
        if (def.pattern.test(payload.value))
            return;
        payload.issues.push({
            origin: "string",
            code: "invalid_format",
            format: "regex",
            input: payload.value,
            pattern: def.pattern.toString(),
            inst,
            continue: !def.abort,
        });
    };
});
const $ZodCheckLowerCase = /*@__PURE__*/ $constructor("$ZodCheckLowerCase", (inst, def) => {
    def.pattern ?? (def.pattern = lowercase);
    $ZodCheckStringFormat.init(inst, def);
});
const $ZodCheckUpperCase = /*@__PURE__*/ $constructor("$ZodCheckUpperCase", (inst, def) => {
    def.pattern ?? (def.pattern = uppercase);
    $ZodCheckStringFormat.init(inst, def);
});
const $ZodCheckIncludes = /*@__PURE__*/ $constructor("$ZodCheckIncludes", (inst, def) => {
    $ZodCheck.init(inst, def);
    const escapedRegex = escapeRegex(def.includes);
    const pattern = new RegExp(typeof def.position === "number" ? `^.{${def.position}}${escapedRegex}` : escapedRegex);
    def.pattern = pattern;
    inst._zod.onattach.push((inst) => {
        const bag = inst._zod.bag;
        bag.patterns ?? (bag.patterns = new Set());
        bag.patterns.add(pattern);
    });
    inst._zod.check = (payload) => {
        if (payload.value.includes(def.includes, def.position))
            return;
        payload.issues.push({
            origin: "string",
            code: "invalid_format",
            format: "includes",
            includes: def.includes,
            input: payload.value,
            inst,
            continue: !def.abort,
        });
    };
});
const $ZodCheckStartsWith = /*@__PURE__*/ $constructor("$ZodCheckStartsWith", (inst, def) => {
    $ZodCheck.init(inst, def);
    const pattern = new RegExp(`^${escapeRegex(def.prefix)}.*`);
    def.pattern ?? (def.pattern = pattern);
    inst._zod.onattach.push((inst) => {
        const bag = inst._zod.bag;
        bag.patterns ?? (bag.patterns = new Set());
        bag.patterns.add(pattern);
    });
    inst._zod.check = (payload) => {
        if (payload.value.startsWith(def.prefix))
            return;
        payload.issues.push({
            origin: "string",
            code: "invalid_format",
            format: "starts_with",
            prefix: def.prefix,
            input: payload.value,
            inst,
            continue: !def.abort,
        });
    };
});
const $ZodCheckEndsWith = /*@__PURE__*/ $constructor("$ZodCheckEndsWith", (inst, def) => {
    $ZodCheck.init(inst, def);
    const pattern = new RegExp(`.*${escapeRegex(def.suffix)}$`);
    def.pattern ?? (def.pattern = pattern);
    inst._zod.onattach.push((inst) => {
        const bag = inst._zod.bag;
        bag.patterns ?? (bag.patterns = new Set());
        bag.patterns.add(pattern);
    });
    inst._zod.check = (payload) => {
        if (payload.value.endsWith(def.suffix))
            return;
        payload.issues.push({
            origin: "string",
            code: "invalid_format",
            format: "ends_with",
            suffix: def.suffix,
            input: payload.value,
            inst,
            continue: !def.abort,
        });
    };
});
const $ZodCheckMimeType = /*@__PURE__*/ $constructor("$ZodCheckMimeType", (inst, def) => {
    $ZodCheck.init(inst, def);
    const mimeSet = new Set(def.mime);
    inst._zod.onattach.push((inst) => {
        inst._zod.bag.mime = def.mime;
    });
    inst._zod.check = (payload) => {
        if (mimeSet.has(payload.value.type))
            return;
        payload.issues.push({
            code: "invalid_value",
            values: def.mime,
            input: payload.value.type,
            inst,
            continue: !def.abort,
        });
    };
});
const $ZodCheckOverwrite = /*@__PURE__*/ $constructor("$ZodCheckOverwrite", (inst, def) => {
    $ZodCheck.init(inst, def);
    inst._zod.check = (payload) => {
        payload.value = def.tx(payload.value);
    };
});

class Doc {
    constructor(args = []) {
        this.content = [];
        this.indent = 0;
        if (this)
            this.args = args;
    }
    indented(fn) {
        this.indent += 1;
        fn(this);
        this.indent -= 1;
    }
    write(arg) {
        if (typeof arg === "function") {
            arg(this, { execution: "sync" });
            arg(this, { execution: "async" });
            return;
        }
        const content = arg;
        const lines = content.split("\n").filter((x) => x);
        const minIndent = Math.min(...lines.map((x) => x.length - x.trimStart().length));
        const dedented = lines.map((x) => x.slice(minIndent)).map((x) => " ".repeat(this.indent * 2) + x);
        for (const line of dedented) {
            this.content.push(line);
        }
    }
    compile() {
        const F = Function;
        const args = this?.args;
        const content = this?.content ?? [``];
        const lines = [...content.map((x) => `  ${x}`)];
        // console.log(lines.join("\n"));
        return new F(...args, lines.join("\n"));
    }
}

const version = {
    major: 4,
    minor: 2,
    patch: 1,
};

const $ZodType = /*@__PURE__*/ $constructor("$ZodType", (inst, def) => {
    var _a;
    inst ?? (inst = {});
    inst._zod.def = def; // set _def property
    inst._zod.bag = inst._zod.bag || {}; // initialize _bag object
    inst._zod.version = version;
    const checks = [...(inst._zod.def.checks ?? [])];
    // if inst is itself a checks.$ZodCheck, run it as a check
    if (inst._zod.traits.has("$ZodCheck")) {
        checks.unshift(inst);
    }
    for (const ch of checks) {
        for (const fn of ch._zod.onattach) {
            fn(inst);
        }
    }
    if (checks.length === 0) {
        // deferred initializer
        // inst._zod.parse is not yet defined
        (_a = inst._zod).deferred ?? (_a.deferred = []);
        inst._zod.deferred?.push(() => {
            inst._zod.run = inst._zod.parse;
        });
    }
    else {
        const runChecks = (payload, checks, ctx) => {
            let isAborted = aborted(payload);
            let asyncResult;
            for (const ch of checks) {
                if (ch._zod.def.when) {
                    const shouldRun = ch._zod.def.when(payload);
                    if (!shouldRun)
                        continue;
                }
                else if (isAborted) {
                    continue;
                }
                const currLen = payload.issues.length;
                const _ = ch._zod.check(payload);
                if (_ instanceof Promise && ctx?.async === false) {
                    throw new $ZodAsyncError();
                }
                if (asyncResult || _ instanceof Promise) {
                    asyncResult = (asyncResult ?? Promise.resolve()).then(async () => {
                        await _;
                        const nextLen = payload.issues.length;
                        if (nextLen === currLen)
                            return;
                        if (!isAborted)
                            isAborted = aborted(payload, currLen);
                    });
                }
                else {
                    const nextLen = payload.issues.length;
                    if (nextLen === currLen)
                        continue;
                    if (!isAborted)
                        isAborted = aborted(payload, currLen);
                }
            }
            if (asyncResult) {
                return asyncResult.then(() => {
                    return payload;
                });
            }
            return payload;
        };
        const handleCanaryResult = (canary, payload, ctx) => {
            // abort if the canary is aborted
            if (aborted(canary)) {
                canary.aborted = true;
                return canary;
            }
            // run checks first, then
            const checkResult = runChecks(payload, checks, ctx);
            if (checkResult instanceof Promise) {
                if (ctx.async === false)
                    throw new $ZodAsyncError();
                return checkResult.then((checkResult) => inst._zod.parse(checkResult, ctx));
            }
            return inst._zod.parse(checkResult, ctx);
        };
        inst._zod.run = (payload, ctx) => {
            if (ctx.skipChecks) {
                return inst._zod.parse(payload, ctx);
            }
            if (ctx.direction === "backward") {
                // run canary
                // initial pass (no checks)
                const canary = inst._zod.parse({ value: payload.value, issues: [] }, { ...ctx, skipChecks: true });
                if (canary instanceof Promise) {
                    return canary.then((canary) => {
                        return handleCanaryResult(canary, payload, ctx);
                    });
                }
                return handleCanaryResult(canary, payload, ctx);
            }
            // forward
            const result = inst._zod.parse(payload, ctx);
            if (result instanceof Promise) {
                if (ctx.async === false)
                    throw new $ZodAsyncError();
                return result.then((result) => runChecks(result, checks, ctx));
            }
            return runChecks(result, checks, ctx);
        };
    }
    inst["~standard"] = {
        validate: (value) => {
            try {
                const r = safeParse$1(inst, value);
                return r.success ? { value: r.data } : { issues: r.error?.issues };
            }
            catch (_) {
                return safeParseAsync$1(inst, value).then((r) => (r.success ? { value: r.data } : { issues: r.error?.issues }));
            }
        },
        vendor: "zod",
        version: 1,
    };
});
const $ZodString = /*@__PURE__*/ $constructor("$ZodString", (inst, def) => {
    $ZodType.init(inst, def);
    inst._zod.pattern = [...(inst?._zod.bag?.patterns ?? [])].pop() ?? string$1(inst._zod.bag);
    inst._zod.parse = (payload, _) => {
        if (def.coerce)
            try {
                payload.value = String(payload.value);
            }
            catch (_) { }
        if (typeof payload.value === "string")
            return payload;
        payload.issues.push({
            expected: "string",
            code: "invalid_type",
            input: payload.value,
            inst,
        });
        return payload;
    };
});
const $ZodStringFormat = /*@__PURE__*/ $constructor("$ZodStringFormat", (inst, def) => {
    // check initialization must come first
    $ZodCheckStringFormat.init(inst, def);
    $ZodString.init(inst, def);
});
const $ZodGUID = /*@__PURE__*/ $constructor("$ZodGUID", (inst, def) => {
    def.pattern ?? (def.pattern = guid);
    $ZodStringFormat.init(inst, def);
});
const $ZodUUID = /*@__PURE__*/ $constructor("$ZodUUID", (inst, def) => {
    if (def.version) {
        const versionMap = {
            v1: 1,
            v2: 2,
            v3: 3,
            v4: 4,
            v5: 5,
            v6: 6,
            v7: 7,
            v8: 8,
        };
        const v = versionMap[def.version];
        if (v === undefined)
            throw new Error(`Invalid UUID version: "${def.version}"`);
        def.pattern ?? (def.pattern = uuid(v));
    }
    else
        def.pattern ?? (def.pattern = uuid());
    $ZodStringFormat.init(inst, def);
});
const $ZodEmail = /*@__PURE__*/ $constructor("$ZodEmail", (inst, def) => {
    def.pattern ?? (def.pattern = email);
    $ZodStringFormat.init(inst, def);
});
const $ZodURL = /*@__PURE__*/ $constructor("$ZodURL", (inst, def) => {
    $ZodStringFormat.init(inst, def);
    inst._zod.check = (payload) => {
        try {
            // Trim whitespace from input
            const trimmed = payload.value.trim();
            // @ts-ignore
            const url = new URL(trimmed);
            if (def.hostname) {
                def.hostname.lastIndex = 0;
                if (!def.hostname.test(url.hostname)) {
                    payload.issues.push({
                        code: "invalid_format",
                        format: "url",
                        note: "Invalid hostname",
                        pattern: def.hostname.source,
                        input: payload.value,
                        inst,
                        continue: !def.abort,
                    });
                }
            }
            if (def.protocol) {
                def.protocol.lastIndex = 0;
                if (!def.protocol.test(url.protocol.endsWith(":") ? url.protocol.slice(0, -1) : url.protocol)) {
                    payload.issues.push({
                        code: "invalid_format",
                        format: "url",
                        note: "Invalid protocol",
                        pattern: def.protocol.source,
                        input: payload.value,
                        inst,
                        continue: !def.abort,
                    });
                }
            }
            // Set the output value based on normalize flag
            if (def.normalize) {
                // Use normalized URL
                payload.value = url.href;
            }
            else {
                // Preserve the original input (trimmed)
                payload.value = trimmed;
            }
            return;
        }
        catch (_) {
            payload.issues.push({
                code: "invalid_format",
                format: "url",
                input: payload.value,
                inst,
                continue: !def.abort,
            });
        }
    };
});
const $ZodEmoji = /*@__PURE__*/ $constructor("$ZodEmoji", (inst, def) => {
    def.pattern ?? (def.pattern = emoji());
    $ZodStringFormat.init(inst, def);
});
const $ZodNanoID = /*@__PURE__*/ $constructor("$ZodNanoID", (inst, def) => {
    def.pattern ?? (def.pattern = nanoid);
    $ZodStringFormat.init(inst, def);
});
const $ZodCUID = /*@__PURE__*/ $constructor("$ZodCUID", (inst, def) => {
    def.pattern ?? (def.pattern = cuid);
    $ZodStringFormat.init(inst, def);
});
const $ZodCUID2 = /*@__PURE__*/ $constructor("$ZodCUID2", (inst, def) => {
    def.pattern ?? (def.pattern = cuid2);
    $ZodStringFormat.init(inst, def);
});
const $ZodULID = /*@__PURE__*/ $constructor("$ZodULID", (inst, def) => {
    def.pattern ?? (def.pattern = ulid);
    $ZodStringFormat.init(inst, def);
});
const $ZodXID = /*@__PURE__*/ $constructor("$ZodXID", (inst, def) => {
    def.pattern ?? (def.pattern = xid);
    $ZodStringFormat.init(inst, def);
});
const $ZodKSUID = /*@__PURE__*/ $constructor("$ZodKSUID", (inst, def) => {
    def.pattern ?? (def.pattern = ksuid);
    $ZodStringFormat.init(inst, def);
});
const $ZodISODateTime = /*@__PURE__*/ $constructor("$ZodISODateTime", (inst, def) => {
    def.pattern ?? (def.pattern = datetime$1(def));
    $ZodStringFormat.init(inst, def);
});
const $ZodISODate = /*@__PURE__*/ $constructor("$ZodISODate", (inst, def) => {
    def.pattern ?? (def.pattern = date$1);
    $ZodStringFormat.init(inst, def);
});
const $ZodISOTime = /*@__PURE__*/ $constructor("$ZodISOTime", (inst, def) => {
    def.pattern ?? (def.pattern = time$1(def));
    $ZodStringFormat.init(inst, def);
});
const $ZodISODuration = /*@__PURE__*/ $constructor("$ZodISODuration", (inst, def) => {
    def.pattern ?? (def.pattern = duration$1);
    $ZodStringFormat.init(inst, def);
});
const $ZodIPv4 = /*@__PURE__*/ $constructor("$ZodIPv4", (inst, def) => {
    def.pattern ?? (def.pattern = ipv4);
    $ZodStringFormat.init(inst, def);
    inst._zod.bag.format = `ipv4`;
});
const $ZodIPv6 = /*@__PURE__*/ $constructor("$ZodIPv6", (inst, def) => {
    def.pattern ?? (def.pattern = ipv6);
    $ZodStringFormat.init(inst, def);
    inst._zod.bag.format = `ipv6`;
    inst._zod.check = (payload) => {
        try {
            // @ts-ignore
            new URL(`http://[${payload.value}]`);
            // return;
        }
        catch {
            payload.issues.push({
                code: "invalid_format",
                format: "ipv6",
                input: payload.value,
                inst,
                continue: !def.abort,
            });
        }
    };
});
const $ZodCIDRv4 = /*@__PURE__*/ $constructor("$ZodCIDRv4", (inst, def) => {
    def.pattern ?? (def.pattern = cidrv4);
    $ZodStringFormat.init(inst, def);
});
const $ZodCIDRv6 = /*@__PURE__*/ $constructor("$ZodCIDRv6", (inst, def) => {
    def.pattern ?? (def.pattern = cidrv6); // not used for validation
    $ZodStringFormat.init(inst, def);
    inst._zod.check = (payload) => {
        const parts = payload.value.split("/");
        try {
            if (parts.length !== 2)
                throw new Error();
            const [address, prefix] = parts;
            if (!prefix)
                throw new Error();
            const prefixNum = Number(prefix);
            if (`${prefixNum}` !== prefix)
                throw new Error();
            if (prefixNum < 0 || prefixNum > 128)
                throw new Error();
            // @ts-ignore
            new URL(`http://[${address}]`);
        }
        catch {
            payload.issues.push({
                code: "invalid_format",
                format: "cidrv6",
                input: payload.value,
                inst,
                continue: !def.abort,
            });
        }
    };
});
//////////////////////////////   ZodBase64   //////////////////////////////
function isValidBase64(data) {
    if (data === "")
        return true;
    if (data.length % 4 !== 0)
        return false;
    try {
        // @ts-ignore
        atob(data);
        return true;
    }
    catch {
        return false;
    }
}
const $ZodBase64 = /*@__PURE__*/ $constructor("$ZodBase64", (inst, def) => {
    def.pattern ?? (def.pattern = base64);
    $ZodStringFormat.init(inst, def);
    inst._zod.bag.contentEncoding = "base64";
    inst._zod.check = (payload) => {
        if (isValidBase64(payload.value))
            return;
        payload.issues.push({
            code: "invalid_format",
            format: "base64",
            input: payload.value,
            inst,
            continue: !def.abort,
        });
    };
});
//////////////////////////////   ZodBase64   //////////////////////////////
function isValidBase64URL(data) {
    if (!base64url.test(data))
        return false;
    const base64 = data.replace(/[-_]/g, (c) => (c === "-" ? "+" : "/"));
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    return isValidBase64(padded);
}
const $ZodBase64URL = /*@__PURE__*/ $constructor("$ZodBase64URL", (inst, def) => {
    def.pattern ?? (def.pattern = base64url);
    $ZodStringFormat.init(inst, def);
    inst._zod.bag.contentEncoding = "base64url";
    inst._zod.check = (payload) => {
        if (isValidBase64URL(payload.value))
            return;
        payload.issues.push({
            code: "invalid_format",
            format: "base64url",
            input: payload.value,
            inst,
            continue: !def.abort,
        });
    };
});
const $ZodE164 = /*@__PURE__*/ $constructor("$ZodE164", (inst, def) => {
    def.pattern ?? (def.pattern = e164);
    $ZodStringFormat.init(inst, def);
});
//////////////////////////////   ZodJWT   //////////////////////////////
function isValidJWT(token, algorithm = null) {
    try {
        const tokensParts = token.split(".");
        if (tokensParts.length !== 3)
            return false;
        const [header] = tokensParts;
        if (!header)
            return false;
        // @ts-ignore
        const parsedHeader = JSON.parse(atob(header));
        if ("typ" in parsedHeader && parsedHeader?.typ !== "JWT")
            return false;
        if (!parsedHeader.alg)
            return false;
        if (algorithm && (!("alg" in parsedHeader) || parsedHeader.alg !== algorithm))
            return false;
        return true;
    }
    catch {
        return false;
    }
}
const $ZodJWT = /*@__PURE__*/ $constructor("$ZodJWT", (inst, def) => {
    $ZodStringFormat.init(inst, def);
    inst._zod.check = (payload) => {
        if (isValidJWT(payload.value, def.alg))
            return;
        payload.issues.push({
            code: "invalid_format",
            format: "jwt",
            input: payload.value,
            inst,
            continue: !def.abort,
        });
    };
});
const $ZodNumber = /*@__PURE__*/ $constructor("$ZodNumber", (inst, def) => {
    $ZodType.init(inst, def);
    inst._zod.pattern = inst._zod.bag.pattern ?? number$1;
    inst._zod.parse = (payload, _ctx) => {
        if (def.coerce)
            try {
                payload.value = Number(payload.value);
            }
            catch (_) { }
        const input = payload.value;
        if (typeof input === "number" && !Number.isNaN(input) && Number.isFinite(input)) {
            return payload;
        }
        const received = typeof input === "number"
            ? Number.isNaN(input)
                ? "NaN"
                : !Number.isFinite(input)
                    ? "Infinity"
                    : undefined
            : undefined;
        payload.issues.push({
            expected: "number",
            code: "invalid_type",
            input,
            inst,
            ...(received ? { received } : {}),
        });
        return payload;
    };
});
const $ZodNumberFormat = /*@__PURE__*/ $constructor("$ZodNumberFormat", (inst, def) => {
    $ZodCheckNumberFormat.init(inst, def);
    $ZodNumber.init(inst, def); // no format checks
});
const $ZodBoolean = /*@__PURE__*/ $constructor("$ZodBoolean", (inst, def) => {
    $ZodType.init(inst, def);
    inst._zod.pattern = boolean$1;
    inst._zod.parse = (payload, _ctx) => {
        if (def.coerce)
            try {
                payload.value = Boolean(payload.value);
            }
            catch (_) { }
        const input = payload.value;
        if (typeof input === "boolean")
            return payload;
        payload.issues.push({
            expected: "boolean",
            code: "invalid_type",
            input,
            inst,
        });
        return payload;
    };
});
const $ZodNull = /*@__PURE__*/ $constructor("$ZodNull", (inst, def) => {
    $ZodType.init(inst, def);
    inst._zod.pattern = _null$2;
    inst._zod.values = new Set([null]);
    inst._zod.parse = (payload, _ctx) => {
        const input = payload.value;
        if (input === null)
            return payload;
        payload.issues.push({
            expected: "null",
            code: "invalid_type",
            input,
            inst,
        });
        return payload;
    };
});
const $ZodAny = /*@__PURE__*/ $constructor("$ZodAny", (inst, def) => {
    $ZodType.init(inst, def);
    inst._zod.parse = (payload) => payload;
});
const $ZodUnknown = /*@__PURE__*/ $constructor("$ZodUnknown", (inst, def) => {
    $ZodType.init(inst, def);
    inst._zod.parse = (payload) => payload;
});
const $ZodNever = /*@__PURE__*/ $constructor("$ZodNever", (inst, def) => {
    $ZodType.init(inst, def);
    inst._zod.parse = (payload, _ctx) => {
        payload.issues.push({
            expected: "never",
            code: "invalid_type",
            input: payload.value,
            inst,
        });
        return payload;
    };
});
function handleArrayResult(result, final, index) {
    if (result.issues.length) {
        final.issues.push(...prefixIssues(index, result.issues));
    }
    final.value[index] = result.value;
}
const $ZodArray = /*@__PURE__*/ $constructor("$ZodArray", (inst, def) => {
    $ZodType.init(inst, def);
    inst._zod.parse = (payload, ctx) => {
        const input = payload.value;
        if (!Array.isArray(input)) {
            payload.issues.push({
                expected: "array",
                code: "invalid_type",
                input,
                inst,
            });
            return payload;
        }
        payload.value = Array(input.length);
        const proms = [];
        for (let i = 0; i < input.length; i++) {
            const item = input[i];
            const result = def.element._zod.run({
                value: item,
                issues: [],
            }, ctx);
            if (result instanceof Promise) {
                proms.push(result.then((result) => handleArrayResult(result, payload, i)));
            }
            else {
                handleArrayResult(result, payload, i);
            }
        }
        if (proms.length) {
            return Promise.all(proms).then(() => payload);
        }
        return payload; //handleArrayResultsAsync(parseResults, final);
    };
});
function handlePropertyResult(result, final, key, input) {
    if (result.issues.length) {
        final.issues.push(...prefixIssues(key, result.issues));
    }
    if (result.value === undefined) {
        if (key in input) {
            final.value[key] = undefined;
        }
    }
    else {
        final.value[key] = result.value;
    }
}
function normalizeDef(def) {
    const keys = Object.keys(def.shape);
    for (const k of keys) {
        if (!def.shape?.[k]?._zod?.traits?.has("$ZodType")) {
            throw new Error(`Invalid element at key "${k}": expected a Zod schema`);
        }
    }
    const okeys = optionalKeys(def.shape);
    return {
        ...def,
        keys,
        keySet: new Set(keys),
        numKeys: keys.length,
        optionalKeys: new Set(okeys),
    };
}
function handleCatchall(proms, input, payload, ctx, def, inst) {
    const unrecognized = [];
    // iterate over input keys
    const keySet = def.keySet;
    const _catchall = def.catchall._zod;
    const t = _catchall.def.type;
    for (const key in input) {
        if (keySet.has(key))
            continue;
        if (t === "never") {
            unrecognized.push(key);
            continue;
        }
        const r = _catchall.run({ value: input[key], issues: [] }, ctx);
        if (r instanceof Promise) {
            proms.push(r.then((r) => handlePropertyResult(r, payload, key, input)));
        }
        else {
            handlePropertyResult(r, payload, key, input);
        }
    }
    if (unrecognized.length) {
        payload.issues.push({
            code: "unrecognized_keys",
            keys: unrecognized,
            input,
            inst,
        });
    }
    if (!proms.length)
        return payload;
    return Promise.all(proms).then(() => {
        return payload;
    });
}
const $ZodObject = /*@__PURE__*/ $constructor("$ZodObject", (inst, def) => {
    // requires cast because technically $ZodObject doesn't extend
    $ZodType.init(inst, def);
    // const sh = def.shape;
    const desc = Object.getOwnPropertyDescriptor(def, "shape");
    if (!desc?.get) {
        const sh = def.shape;
        Object.defineProperty(def, "shape", {
            get: () => {
                const newSh = { ...sh };
                Object.defineProperty(def, "shape", {
                    value: newSh,
                });
                return newSh;
            },
        });
    }
    const _normalized = cached(() => normalizeDef(def));
    defineLazy(inst._zod, "propValues", () => {
        const shape = def.shape;
        const propValues = {};
        for (const key in shape) {
            const field = shape[key]._zod;
            if (field.values) {
                propValues[key] ?? (propValues[key] = new Set());
                for (const v of field.values)
                    propValues[key].add(v);
            }
        }
        return propValues;
    });
    const isObject$1 = isObject;
    const catchall = def.catchall;
    let value;
    inst._zod.parse = (payload, ctx) => {
        value ?? (value = _normalized.value);
        const input = payload.value;
        if (!isObject$1(input)) {
            payload.issues.push({
                expected: "object",
                code: "invalid_type",
                input,
                inst,
            });
            return payload;
        }
        payload.value = {};
        const proms = [];
        const shape = value.shape;
        for (const key of value.keys) {
            const el = shape[key];
            const r = el._zod.run({ value: input[key], issues: [] }, ctx);
            if (r instanceof Promise) {
                proms.push(r.then((r) => handlePropertyResult(r, payload, key, input)));
            }
            else {
                handlePropertyResult(r, payload, key, input);
            }
        }
        if (!catchall) {
            return proms.length ? Promise.all(proms).then(() => payload) : payload;
        }
        return handleCatchall(proms, input, payload, ctx, _normalized.value, inst);
    };
});
const $ZodObjectJIT = /*@__PURE__*/ $constructor("$ZodObjectJIT", (inst, def) => {
    // requires cast because technically $ZodObject doesn't extend
    $ZodObject.init(inst, def);
    const superParse = inst._zod.parse;
    const _normalized = cached(() => normalizeDef(def));
    const generateFastpass = (shape) => {
        const doc = new Doc(["shape", "payload", "ctx"]);
        const normalized = _normalized.value;
        const parseStr = (key) => {
            const k = esc(key);
            return `shape[${k}]._zod.run({ value: input[${k}], issues: [] }, ctx)`;
        };
        doc.write(`const input = payload.value;`);
        const ids = Object.create(null);
        let counter = 0;
        for (const key of normalized.keys) {
            ids[key] = `key_${counter++}`;
        }
        // A: preserve key order {
        doc.write(`const newResult = {};`);
        for (const key of normalized.keys) {
            const id = ids[key];
            const k = esc(key);
            doc.write(`const ${id} = ${parseStr(key)};`);
            doc.write(`
        if (${id}.issues.length) {
          payload.issues = payload.issues.concat(${id}.issues.map(iss => ({
            ...iss,
            path: iss.path ? [${k}, ...iss.path] : [${k}]
          })));
        }
        
        
        if (${id}.value === undefined) {
          if (${k} in input) {
            newResult[${k}] = undefined;
          }
        } else {
          newResult[${k}] = ${id}.value;
        }
        
      `);
        }
        doc.write(`payload.value = newResult;`);
        doc.write(`return payload;`);
        const fn = doc.compile();
        return (payload, ctx) => fn(shape, payload, ctx);
    };
    let fastpass;
    const isObject$1 = isObject;
    const jit = !globalConfig.jitless;
    const allowsEval$1 = allowsEval;
    const fastEnabled = jit && allowsEval$1.value; // && !def.catchall;
    const catchall = def.catchall;
    let value;
    inst._zod.parse = (payload, ctx) => {
        value ?? (value = _normalized.value);
        const input = payload.value;
        if (!isObject$1(input)) {
            payload.issues.push({
                expected: "object",
                code: "invalid_type",
                input,
                inst,
            });
            return payload;
        }
        if (jit && fastEnabled && ctx?.async === false && ctx.jitless !== true) {
            // always synchronous
            if (!fastpass)
                fastpass = generateFastpass(def.shape);
            payload = fastpass(payload, ctx);
            if (!catchall)
                return payload;
            return handleCatchall([], input, payload, ctx, value, inst);
        }
        return superParse(payload, ctx);
    };
});
function handleUnionResults(results, final, inst, ctx) {
    for (const result of results) {
        if (result.issues.length === 0) {
            final.value = result.value;
            return final;
        }
    }
    const nonaborted = results.filter((r) => !aborted(r));
    if (nonaborted.length === 1) {
        final.value = nonaborted[0].value;
        return nonaborted[0];
    }
    final.issues.push({
        code: "invalid_union",
        input: final.value,
        inst,
        errors: results.map((result) => result.issues.map((iss) => finalizeIssue(iss, ctx, config()))),
    });
    return final;
}
const $ZodUnion = /*@__PURE__*/ $constructor("$ZodUnion", (inst, def) => {
    $ZodType.init(inst, def);
    defineLazy(inst._zod, "optin", () => def.options.some((o) => o._zod.optin === "optional") ? "optional" : undefined);
    defineLazy(inst._zod, "optout", () => def.options.some((o) => o._zod.optout === "optional") ? "optional" : undefined);
    defineLazy(inst._zod, "values", () => {
        if (def.options.every((o) => o._zod.values)) {
            return new Set(def.options.flatMap((option) => Array.from(option._zod.values)));
        }
        return undefined;
    });
    defineLazy(inst._zod, "pattern", () => {
        if (def.options.every((o) => o._zod.pattern)) {
            const patterns = def.options.map((o) => o._zod.pattern);
            return new RegExp(`^(${patterns.map((p) => cleanRegex(p.source)).join("|")})$`);
        }
        return undefined;
    });
    const single = def.options.length === 1;
    const first = def.options[0]._zod.run;
    inst._zod.parse = (payload, ctx) => {
        if (single) {
            return first(payload, ctx);
        }
        let async = false;
        const results = [];
        for (const option of def.options) {
            const result = option._zod.run({
                value: payload.value,
                issues: [],
            }, ctx);
            if (result instanceof Promise) {
                results.push(result);
                async = true;
            }
            else {
                if (result.issues.length === 0)
                    return result;
                results.push(result);
            }
        }
        if (!async)
            return handleUnionResults(results, payload, inst, ctx);
        return Promise.all(results).then((results) => {
            return handleUnionResults(results, payload, inst, ctx);
        });
    };
});
const $ZodIntersection = /*@__PURE__*/ $constructor("$ZodIntersection", (inst, def) => {
    $ZodType.init(inst, def);
    inst._zod.parse = (payload, ctx) => {
        const input = payload.value;
        const left = def.left._zod.run({ value: input, issues: [] }, ctx);
        const right = def.right._zod.run({ value: input, issues: [] }, ctx);
        const async = left instanceof Promise || right instanceof Promise;
        if (async) {
            return Promise.all([left, right]).then(([left, right]) => {
                return handleIntersectionResults(payload, left, right);
            });
        }
        return handleIntersectionResults(payload, left, right);
    };
});
function mergeValues(a, b) {
    // const aType = parse.t(a);
    // const bType = parse.t(b);
    if (a === b) {
        return { valid: true, data: a };
    }
    if (a instanceof Date && b instanceof Date && +a === +b) {
        return { valid: true, data: a };
    }
    if (isPlainObject(a) && isPlainObject(b)) {
        const bKeys = Object.keys(b);
        const sharedKeys = Object.keys(a).filter((key) => bKeys.indexOf(key) !== -1);
        const newObj = { ...a, ...b };
        for (const key of sharedKeys) {
            const sharedValue = mergeValues(a[key], b[key]);
            if (!sharedValue.valid) {
                return {
                    valid: false,
                    mergeErrorPath: [key, ...sharedValue.mergeErrorPath],
                };
            }
            newObj[key] = sharedValue.data;
        }
        return { valid: true, data: newObj };
    }
    if (Array.isArray(a) && Array.isArray(b)) {
        if (a.length !== b.length) {
            return { valid: false, mergeErrorPath: [] };
        }
        const newArray = [];
        for (let index = 0; index < a.length; index++) {
            const itemA = a[index];
            const itemB = b[index];
            const sharedValue = mergeValues(itemA, itemB);
            if (!sharedValue.valid) {
                return {
                    valid: false,
                    mergeErrorPath: [index, ...sharedValue.mergeErrorPath],
                };
            }
            newArray.push(sharedValue.data);
        }
        return { valid: true, data: newArray };
    }
    return { valid: false, mergeErrorPath: [] };
}
function handleIntersectionResults(result, left, right) {
    if (left.issues.length) {
        result.issues.push(...left.issues);
    }
    if (right.issues.length) {
        result.issues.push(...right.issues);
    }
    if (aborted(result))
        return result;
    const merged = mergeValues(left.value, right.value);
    if (!merged.valid) {
        throw new Error(`Unmergable intersection. Error path: ` + `${JSON.stringify(merged.mergeErrorPath)}`);
    }
    result.value = merged.data;
    return result;
}
const $ZodTuple = /*@__PURE__*/ $constructor("$ZodTuple", (inst, def) => {
    $ZodType.init(inst, def);
    const items = def.items;
    inst._zod.parse = (payload, ctx) => {
        const input = payload.value;
        if (!Array.isArray(input)) {
            payload.issues.push({
                input,
                inst,
                expected: "tuple",
                code: "invalid_type",
            });
            return payload;
        }
        payload.value = [];
        const proms = [];
        const reversedIndex = [...items].reverse().findIndex((item) => item._zod.optin !== "optional");
        const optStart = reversedIndex === -1 ? 0 : items.length - reversedIndex;
        if (!def.rest) {
            const tooBig = input.length > items.length;
            const tooSmall = input.length < optStart - 1;
            if (tooBig || tooSmall) {
                payload.issues.push({
                    ...(tooBig ? { code: "too_big", maximum: items.length } : { code: "too_small", minimum: items.length }),
                    input,
                    inst,
                    origin: "array",
                });
                return payload;
            }
        }
        let i = -1;
        for (const item of items) {
            i++;
            if (i >= input.length)
                if (i >= optStart)
                    continue;
            const result = item._zod.run({
                value: input[i],
                issues: [],
            }, ctx);
            if (result instanceof Promise) {
                proms.push(result.then((result) => handleTupleResult(result, payload, i)));
            }
            else {
                handleTupleResult(result, payload, i);
            }
        }
        if (def.rest) {
            const rest = input.slice(items.length);
            for (const el of rest) {
                i++;
                const result = def.rest._zod.run({
                    value: el,
                    issues: [],
                }, ctx);
                if (result instanceof Promise) {
                    proms.push(result.then((result) => handleTupleResult(result, payload, i)));
                }
                else {
                    handleTupleResult(result, payload, i);
                }
            }
        }
        if (proms.length)
            return Promise.all(proms).then(() => payload);
        return payload;
    };
});
function handleTupleResult(result, final, index) {
    if (result.issues.length) {
        final.issues.push(...prefixIssues(index, result.issues));
    }
    final.value[index] = result.value;
}
const $ZodRecord = /*@__PURE__*/ $constructor("$ZodRecord", (inst, def) => {
    $ZodType.init(inst, def);
    inst._zod.parse = (payload, ctx) => {
        const input = payload.value;
        if (!isPlainObject(input)) {
            payload.issues.push({
                expected: "record",
                code: "invalid_type",
                input,
                inst,
            });
            return payload;
        }
        const proms = [];
        const values = def.keyType._zod.values;
        if (values) {
            payload.value = {};
            const recordKeys = new Set();
            for (const key of values) {
                if (typeof key === "string" || typeof key === "number" || typeof key === "symbol") {
                    recordKeys.add(typeof key === "number" ? key.toString() : key);
                    const result = def.valueType._zod.run({ value: input[key], issues: [] }, ctx);
                    if (result instanceof Promise) {
                        proms.push(result.then((result) => {
                            if (result.issues.length) {
                                payload.issues.push(...prefixIssues(key, result.issues));
                            }
                            payload.value[key] = result.value;
                        }));
                    }
                    else {
                        if (result.issues.length) {
                            payload.issues.push(...prefixIssues(key, result.issues));
                        }
                        payload.value[key] = result.value;
                    }
                }
            }
            let unrecognized;
            for (const key in input) {
                if (!recordKeys.has(key)) {
                    unrecognized = unrecognized ?? [];
                    unrecognized.push(key);
                }
            }
            if (unrecognized && unrecognized.length > 0) {
                payload.issues.push({
                    code: "unrecognized_keys",
                    input,
                    inst,
                    keys: unrecognized,
                });
            }
        }
        else {
            payload.value = {};
            for (const key of Reflect.ownKeys(input)) {
                if (key === "__proto__")
                    continue;
                const keyResult = def.keyType._zod.run({ value: key, issues: [] }, ctx);
                if (keyResult instanceof Promise) {
                    throw new Error("Async schemas not supported in object keys currently");
                }
                if (keyResult.issues.length) {
                    if (def.mode === "loose") {
                        // Pass through unchanged
                        payload.value[key] = input[key];
                    }
                    else {
                        // Default "strict" behavior: error on invalid key
                        payload.issues.push({
                            code: "invalid_key",
                            origin: "record",
                            issues: keyResult.issues.map((iss) => finalizeIssue(iss, ctx, config())),
                            input: key,
                            path: [key],
                            inst,
                        });
                    }
                    continue;
                }
                const result = def.valueType._zod.run({ value: input[key], issues: [] }, ctx);
                if (result instanceof Promise) {
                    proms.push(result.then((result) => {
                        if (result.issues.length) {
                            payload.issues.push(...prefixIssues(key, result.issues));
                        }
                        payload.value[keyResult.value] = result.value;
                    }));
                }
                else {
                    if (result.issues.length) {
                        payload.issues.push(...prefixIssues(key, result.issues));
                    }
                    payload.value[keyResult.value] = result.value;
                }
            }
        }
        if (proms.length) {
            return Promise.all(proms).then(() => payload);
        }
        return payload;
    };
});
const $ZodEnum = /*@__PURE__*/ $constructor("$ZodEnum", (inst, def) => {
    $ZodType.init(inst, def);
    const values = getEnumValues(def.entries);
    const valuesSet = new Set(values);
    inst._zod.values = valuesSet;
    inst._zod.pattern = new RegExp(`^(${values
        .filter((k) => propertyKeyTypes.has(typeof k))
        .map((o) => (typeof o === "string" ? escapeRegex(o) : o.toString()))
        .join("|")})$`);
    inst._zod.parse = (payload, _ctx) => {
        const input = payload.value;
        if (valuesSet.has(input)) {
            return payload;
        }
        payload.issues.push({
            code: "invalid_value",
            values,
            input,
            inst,
        });
        return payload;
    };
});
const $ZodLiteral = /*@__PURE__*/ $constructor("$ZodLiteral", (inst, def) => {
    $ZodType.init(inst, def);
    if (def.values.length === 0) {
        throw new Error("Cannot create literal schema with no valid values");
    }
    const values = new Set(def.values);
    inst._zod.values = values;
    inst._zod.pattern = new RegExp(`^(${def.values
        .map((o) => (typeof o === "string" ? escapeRegex(o) : o ? escapeRegex(o.toString()) : String(o)))
        .join("|")})$`);
    inst._zod.parse = (payload, _ctx) => {
        const input = payload.value;
        if (values.has(input)) {
            return payload;
        }
        payload.issues.push({
            code: "invalid_value",
            values: def.values,
            input,
            inst,
        });
        return payload;
    };
});
const $ZodFile = /*@__PURE__*/ $constructor("$ZodFile", (inst, def) => {
    $ZodType.init(inst, def);
    inst._zod.parse = (payload, _ctx) => {
        const input = payload.value;
        // @ts-ignore
        if (input instanceof File)
            return payload;
        payload.issues.push({
            expected: "file",
            code: "invalid_type",
            input,
            inst,
        });
        return payload;
    };
});
const $ZodTransform = /*@__PURE__*/ $constructor("$ZodTransform", (inst, def) => {
    $ZodType.init(inst, def);
    inst._zod.parse = (payload, ctx) => {
        if (ctx.direction === "backward") {
            throw new $ZodEncodeError(inst.constructor.name);
        }
        const _out = def.transform(payload.value, payload);
        if (ctx.async) {
            const output = _out instanceof Promise ? _out : Promise.resolve(_out);
            return output.then((output) => {
                payload.value = output;
                return payload;
            });
        }
        if (_out instanceof Promise) {
            throw new $ZodAsyncError();
        }
        payload.value = _out;
        return payload;
    };
});
function handleOptionalResult(result, input) {
    if (result.issues.length && input === undefined) {
        return { issues: [], value: undefined };
    }
    return result;
}
const $ZodOptional = /*@__PURE__*/ $constructor("$ZodOptional", (inst, def) => {
    $ZodType.init(inst, def);
    inst._zod.optin = "optional";
    inst._zod.optout = "optional";
    defineLazy(inst._zod, "values", () => {
        return def.innerType._zod.values ? new Set([...def.innerType._zod.values, undefined]) : undefined;
    });
    defineLazy(inst._zod, "pattern", () => {
        const pattern = def.innerType._zod.pattern;
        return pattern ? new RegExp(`^(${cleanRegex(pattern.source)})?$`) : undefined;
    });
    inst._zod.parse = (payload, ctx) => {
        if (def.innerType._zod.optin === "optional") {
            const result = def.innerType._zod.run(payload, ctx);
            if (result instanceof Promise)
                return result.then((r) => handleOptionalResult(r, payload.value));
            return handleOptionalResult(result, payload.value);
        }
        if (payload.value === undefined) {
            return payload;
        }
        return def.innerType._zod.run(payload, ctx);
    };
});
const $ZodNullable = /*@__PURE__*/ $constructor("$ZodNullable", (inst, def) => {
    $ZodType.init(inst, def);
    defineLazy(inst._zod, "optin", () => def.innerType._zod.optin);
    defineLazy(inst._zod, "optout", () => def.innerType._zod.optout);
    defineLazy(inst._zod, "pattern", () => {
        const pattern = def.innerType._zod.pattern;
        return pattern ? new RegExp(`^(${cleanRegex(pattern.source)}|null)$`) : undefined;
    });
    defineLazy(inst._zod, "values", () => {
        return def.innerType._zod.values ? new Set([...def.innerType._zod.values, null]) : undefined;
    });
    inst._zod.parse = (payload, ctx) => {
        // Forward direction (decode): allow null to pass through
        if (payload.value === null)
            return payload;
        return def.innerType._zod.run(payload, ctx);
    };
});
const $ZodDefault = /*@__PURE__*/ $constructor("$ZodDefault", (inst, def) => {
    $ZodType.init(inst, def);
    // inst._zod.qin = "true";
    inst._zod.optin = "optional";
    defineLazy(inst._zod, "values", () => def.innerType._zod.values);
    inst._zod.parse = (payload, ctx) => {
        if (ctx.direction === "backward") {
            return def.innerType._zod.run(payload, ctx);
        }
        // Forward direction (decode): apply defaults for undefined input
        if (payload.value === undefined) {
            payload.value = def.defaultValue;
            /**
             * $ZodDefault returns the default value immediately in forward direction.
             * It doesn't pass the default value into the validator ("prefault"). There's no reason to pass the default value through validation. The validity of the default is enforced by TypeScript statically. Otherwise, it's the responsibility of the user to ensure the default is valid. In the case of pipes with divergent in/out types, you can specify the default on the `in` schema of your ZodPipe to set a "prefault" for the pipe.   */
            return payload;
        }
        // Forward direction: continue with default handling
        const result = def.innerType._zod.run(payload, ctx);
        if (result instanceof Promise) {
            return result.then((result) => handleDefaultResult(result, def));
        }
        return handleDefaultResult(result, def);
    };
});
function handleDefaultResult(payload, def) {
    if (payload.value === undefined) {
        payload.value = def.defaultValue;
    }
    return payload;
}
const $ZodPrefault = /*@__PURE__*/ $constructor("$ZodPrefault", (inst, def) => {
    $ZodType.init(inst, def);
    inst._zod.optin = "optional";
    defineLazy(inst._zod, "values", () => def.innerType._zod.values);
    inst._zod.parse = (payload, ctx) => {
        if (ctx.direction === "backward") {
            return def.innerType._zod.run(payload, ctx);
        }
        // Forward direction (decode): apply prefault for undefined input
        if (payload.value === undefined) {
            payload.value = def.defaultValue;
        }
        return def.innerType._zod.run(payload, ctx);
    };
});
const $ZodNonOptional = /*@__PURE__*/ $constructor("$ZodNonOptional", (inst, def) => {
    $ZodType.init(inst, def);
    defineLazy(inst._zod, "values", () => {
        const v = def.innerType._zod.values;
        return v ? new Set([...v].filter((x) => x !== undefined)) : undefined;
    });
    inst._zod.parse = (payload, ctx) => {
        const result = def.innerType._zod.run(payload, ctx);
        if (result instanceof Promise) {
            return result.then((result) => handleNonOptionalResult(result, inst));
        }
        return handleNonOptionalResult(result, inst);
    };
});
function handleNonOptionalResult(payload, inst) {
    if (!payload.issues.length && payload.value === undefined) {
        payload.issues.push({
            code: "invalid_type",
            expected: "nonoptional",
            input: payload.value,
            inst,
        });
    }
    return payload;
}
const $ZodCatch = /*@__PURE__*/ $constructor("$ZodCatch", (inst, def) => {
    $ZodType.init(inst, def);
    defineLazy(inst._zod, "optin", () => def.innerType._zod.optin);
    defineLazy(inst._zod, "optout", () => def.innerType._zod.optout);
    defineLazy(inst._zod, "values", () => def.innerType._zod.values);
    inst._zod.parse = (payload, ctx) => {
        if (ctx.direction === "backward") {
            return def.innerType._zod.run(payload, ctx);
        }
        // Forward direction (decode): apply catch logic
        const result = def.innerType._zod.run(payload, ctx);
        if (result instanceof Promise) {
            return result.then((result) => {
                payload.value = result.value;
                if (result.issues.length) {
                    payload.value = def.catchValue({
                        ...payload,
                        error: {
                            issues: result.issues.map((iss) => finalizeIssue(iss, ctx, config())),
                        },
                        input: payload.value,
                    });
                    payload.issues = [];
                }
                return payload;
            });
        }
        payload.value = result.value;
        if (result.issues.length) {
            payload.value = def.catchValue({
                ...payload,
                error: {
                    issues: result.issues.map((iss) => finalizeIssue(iss, ctx, config())),
                },
                input: payload.value,
            });
            payload.issues = [];
        }
        return payload;
    };
});
const $ZodPipe = /*@__PURE__*/ $constructor("$ZodPipe", (inst, def) => {
    $ZodType.init(inst, def);
    defineLazy(inst._zod, "values", () => def.in._zod.values);
    defineLazy(inst._zod, "optin", () => def.in._zod.optin);
    defineLazy(inst._zod, "optout", () => def.out._zod.optout);
    defineLazy(inst._zod, "propValues", () => def.in._zod.propValues);
    inst._zod.parse = (payload, ctx) => {
        if (ctx.direction === "backward") {
            const right = def.out._zod.run(payload, ctx);
            if (right instanceof Promise) {
                return right.then((right) => handlePipeResult(right, def.in, ctx));
            }
            return handlePipeResult(right, def.in, ctx);
        }
        const left = def.in._zod.run(payload, ctx);
        if (left instanceof Promise) {
            return left.then((left) => handlePipeResult(left, def.out, ctx));
        }
        return handlePipeResult(left, def.out, ctx);
    };
});
function handlePipeResult(left, next, ctx) {
    if (left.issues.length) {
        // prevent further checks
        left.aborted = true;
        return left;
    }
    return next._zod.run({ value: left.value, issues: left.issues }, ctx);
}
const $ZodReadonly = /*@__PURE__*/ $constructor("$ZodReadonly", (inst, def) => {
    $ZodType.init(inst, def);
    defineLazy(inst._zod, "propValues", () => def.innerType._zod.propValues);
    defineLazy(inst._zod, "values", () => def.innerType._zod.values);
    defineLazy(inst._zod, "optin", () => def.innerType?._zod?.optin);
    defineLazy(inst._zod, "optout", () => def.innerType?._zod?.optout);
    inst._zod.parse = (payload, ctx) => {
        if (ctx.direction === "backward") {
            return def.innerType._zod.run(payload, ctx);
        }
        const result = def.innerType._zod.run(payload, ctx);
        if (result instanceof Promise) {
            return result.then(handleReadonlyResult);
        }
        return handleReadonlyResult(result);
    };
});
function handleReadonlyResult(payload) {
    payload.value = Object.freeze(payload.value);
    return payload;
}
const $ZodCustom = /*@__PURE__*/ $constructor("$ZodCustom", (inst, def) => {
    $ZodCheck.init(inst, def);
    $ZodType.init(inst, def);
    inst._zod.parse = (payload, _) => {
        return payload;
    };
    inst._zod.check = (payload) => {
        const input = payload.value;
        const r = def.fn(input);
        if (r instanceof Promise) {
            return r.then((r) => handleRefineResult(r, payload, input, inst));
        }
        handleRefineResult(r, payload, input, inst);
        return;
    };
});
function handleRefineResult(result, payload, input, inst) {
    if (!result) {
        const _iss = {
            code: "custom",
            input,
            inst, // incorporates params.error into issue reporting
            path: [...(inst._zod.def.path ?? [])], // incorporates params.error into issue reporting
            continue: !inst._zod.def.abort,
            // params: inst._zod.def.params,
        };
        if (inst._zod.def.params)
            _iss.params = inst._zod.def.params;
        payload.issues.push(issue(_iss));
    }
}

var _a;
class $ZodRegistry {
    constructor() {
        this._map = new WeakMap();
        this._idmap = new Map();
    }
    add(schema, ..._meta) {
        const meta = _meta[0];
        this._map.set(schema, meta);
        if (meta && typeof meta === "object" && "id" in meta) {
            if (this._idmap.has(meta.id)) {
                throw new Error(`ID ${meta.id} already exists in the registry`);
            }
            this._idmap.set(meta.id, schema);
        }
        return this;
    }
    clear() {
        this._map = new WeakMap();
        this._idmap = new Map();
        return this;
    }
    remove(schema) {
        const meta = this._map.get(schema);
        if (meta && typeof meta === "object" && "id" in meta) {
            this._idmap.delete(meta.id);
        }
        this._map.delete(schema);
        return this;
    }
    get(schema) {
        // return this._map.get(schema) as any;
        // inherit metadata
        const p = schema._zod.parent;
        if (p) {
            const pm = { ...(this.get(p) ?? {}) };
            delete pm.id; // do not inherit id
            const f = { ...pm, ...this._map.get(schema) };
            return Object.keys(f).length ? f : undefined;
        }
        return this._map.get(schema);
    }
    has(schema) {
        return this._map.has(schema);
    }
}
// registries
function registry() {
    return new $ZodRegistry();
}
(_a = globalThis).__zod_globalRegistry ?? (_a.__zod_globalRegistry = registry());
const globalRegistry = globalThis.__zod_globalRegistry;

function _string(Class, params) {
    return new Class({
        type: "string",
        ...normalizeParams(params),
    });
}
function _email(Class, params) {
    return new Class({
        type: "string",
        format: "email",
        check: "string_format",
        abort: false,
        ...normalizeParams(params),
    });
}
function _guid(Class, params) {
    return new Class({
        type: "string",
        format: "guid",
        check: "string_format",
        abort: false,
        ...normalizeParams(params),
    });
}
function _uuid(Class, params) {
    return new Class({
        type: "string",
        format: "uuid",
        check: "string_format",
        abort: false,
        ...normalizeParams(params),
    });
}
function _uuidv4(Class, params) {
    return new Class({
        type: "string",
        format: "uuid",
        check: "string_format",
        abort: false,
        version: "v4",
        ...normalizeParams(params),
    });
}
function _uuidv6(Class, params) {
    return new Class({
        type: "string",
        format: "uuid",
        check: "string_format",
        abort: false,
        version: "v6",
        ...normalizeParams(params),
    });
}
function _uuidv7(Class, params) {
    return new Class({
        type: "string",
        format: "uuid",
        check: "string_format",
        abort: false,
        version: "v7",
        ...normalizeParams(params),
    });
}
function _url(Class, params) {
    return new Class({
        type: "string",
        format: "url",
        check: "string_format",
        abort: false,
        ...normalizeParams(params),
    });
}
function _emoji(Class, params) {
    return new Class({
        type: "string",
        format: "emoji",
        check: "string_format",
        abort: false,
        ...normalizeParams(params),
    });
}
function _nanoid(Class, params) {
    return new Class({
        type: "string",
        format: "nanoid",
        check: "string_format",
        abort: false,
        ...normalizeParams(params),
    });
}
function _cuid(Class, params) {
    return new Class({
        type: "string",
        format: "cuid",
        check: "string_format",
        abort: false,
        ...normalizeParams(params),
    });
}
function _cuid2(Class, params) {
    return new Class({
        type: "string",
        format: "cuid2",
        check: "string_format",
        abort: false,
        ...normalizeParams(params),
    });
}
function _ulid(Class, params) {
    return new Class({
        type: "string",
        format: "ulid",
        check: "string_format",
        abort: false,
        ...normalizeParams(params),
    });
}
function _xid(Class, params) {
    return new Class({
        type: "string",
        format: "xid",
        check: "string_format",
        abort: false,
        ...normalizeParams(params),
    });
}
function _ksuid(Class, params) {
    return new Class({
        type: "string",
        format: "ksuid",
        check: "string_format",
        abort: false,
        ...normalizeParams(params),
    });
}
function _ipv4(Class, params) {
    return new Class({
        type: "string",
        format: "ipv4",
        check: "string_format",
        abort: false,
        ...normalizeParams(params),
    });
}
function _ipv6(Class, params) {
    return new Class({
        type: "string",
        format: "ipv6",
        check: "string_format",
        abort: false,
        ...normalizeParams(params),
    });
}
function _cidrv4(Class, params) {
    return new Class({
        type: "string",
        format: "cidrv4",
        check: "string_format",
        abort: false,
        ...normalizeParams(params),
    });
}
function _cidrv6(Class, params) {
    return new Class({
        type: "string",
        format: "cidrv6",
        check: "string_format",
        abort: false,
        ...normalizeParams(params),
    });
}
function _base64(Class, params) {
    return new Class({
        type: "string",
        format: "base64",
        check: "string_format",
        abort: false,
        ...normalizeParams(params),
    });
}
function _base64url(Class, params) {
    return new Class({
        type: "string",
        format: "base64url",
        check: "string_format",
        abort: false,
        ...normalizeParams(params),
    });
}
function _e164(Class, params) {
    return new Class({
        type: "string",
        format: "e164",
        check: "string_format",
        abort: false,
        ...normalizeParams(params),
    });
}
function _jwt(Class, params) {
    return new Class({
        type: "string",
        format: "jwt",
        check: "string_format",
        abort: false,
        ...normalizeParams(params),
    });
}
function _isoDateTime(Class, params) {
    return new Class({
        type: "string",
        format: "datetime",
        check: "string_format",
        offset: false,
        local: false,
        precision: null,
        ...normalizeParams(params),
    });
}
function _isoDate(Class, params) {
    return new Class({
        type: "string",
        format: "date",
        check: "string_format",
        ...normalizeParams(params),
    });
}
function _isoTime(Class, params) {
    return new Class({
        type: "string",
        format: "time",
        check: "string_format",
        precision: null,
        ...normalizeParams(params),
    });
}
function _isoDuration(Class, params) {
    return new Class({
        type: "string",
        format: "duration",
        check: "string_format",
        ...normalizeParams(params),
    });
}
function _number(Class, params) {
    return new Class({
        type: "number",
        checks: [],
        ...normalizeParams(params),
    });
}
function _int(Class, params) {
    return new Class({
        type: "number",
        check: "number_format",
        abort: false,
        format: "safeint",
        ...normalizeParams(params),
    });
}
function _boolean(Class, params) {
    return new Class({
        type: "boolean",
        ...normalizeParams(params),
    });
}
function _null$1(Class, params) {
    return new Class({
        type: "null",
        ...normalizeParams(params),
    });
}
function _any(Class) {
    return new Class({
        type: "any",
    });
}
function _unknown(Class) {
    return new Class({
        type: "unknown",
    });
}
function _never(Class, params) {
    return new Class({
        type: "never",
        ...normalizeParams(params),
    });
}
function _lt(value, params) {
    return new $ZodCheckLessThan({
        check: "less_than",
        ...normalizeParams(params),
        value,
        inclusive: false,
    });
}
function _lte(value, params) {
    return new $ZodCheckLessThan({
        check: "less_than",
        ...normalizeParams(params),
        value,
        inclusive: true,
    });
}
function _gt(value, params) {
    return new $ZodCheckGreaterThan({
        check: "greater_than",
        ...normalizeParams(params),
        value,
        inclusive: false,
    });
}
function _gte(value, params) {
    return new $ZodCheckGreaterThan({
        check: "greater_than",
        ...normalizeParams(params),
        value,
        inclusive: true,
    });
}
function _multipleOf(value, params) {
    return new $ZodCheckMultipleOf({
        check: "multiple_of",
        ...normalizeParams(params),
        value,
    });
}
function _maxSize(maximum, params) {
    return new $ZodCheckMaxSize({
        check: "max_size",
        ...normalizeParams(params),
        maximum,
    });
}
function _minSize(minimum, params) {
    return new $ZodCheckMinSize({
        check: "min_size",
        ...normalizeParams(params),
        minimum,
    });
}
function _maxLength(maximum, params) {
    const ch = new $ZodCheckMaxLength({
        check: "max_length",
        ...normalizeParams(params),
        maximum,
    });
    return ch;
}
function _minLength(minimum, params) {
    return new $ZodCheckMinLength({
        check: "min_length",
        ...normalizeParams(params),
        minimum,
    });
}
function _length(length, params) {
    return new $ZodCheckLengthEquals({
        check: "length_equals",
        ...normalizeParams(params),
        length,
    });
}
function _regex(pattern, params) {
    return new $ZodCheckRegex({
        check: "string_format",
        format: "regex",
        ...normalizeParams(params),
        pattern,
    });
}
function _lowercase(params) {
    return new $ZodCheckLowerCase({
        check: "string_format",
        format: "lowercase",
        ...normalizeParams(params),
    });
}
function _uppercase(params) {
    return new $ZodCheckUpperCase({
        check: "string_format",
        format: "uppercase",
        ...normalizeParams(params),
    });
}
function _includes(includes, params) {
    return new $ZodCheckIncludes({
        check: "string_format",
        format: "includes",
        ...normalizeParams(params),
        includes,
    });
}
function _startsWith(prefix, params) {
    return new $ZodCheckStartsWith({
        check: "string_format",
        format: "starts_with",
        ...normalizeParams(params),
        prefix,
    });
}
function _endsWith(suffix, params) {
    return new $ZodCheckEndsWith({
        check: "string_format",
        format: "ends_with",
        ...normalizeParams(params),
        suffix,
    });
}
function _mime(types, params) {
    return new $ZodCheckMimeType({
        check: "mime_type",
        mime: types,
        ...normalizeParams(params),
    });
}
function _overwrite(tx) {
    return new $ZodCheckOverwrite({
        check: "overwrite",
        tx,
    });
}
// normalize
function _normalize(form) {
    return _overwrite((input) => input.normalize(form));
}
// trim
function _trim() {
    return _overwrite((input) => input.trim());
}
// toLowerCase
function _toLowerCase() {
    return _overwrite((input) => input.toLowerCase());
}
// toUpperCase
function _toUpperCase() {
    return _overwrite((input) => input.toUpperCase());
}
// slugify
function _slugify() {
    return _overwrite((input) => slugify(input));
}
function _array(Class, element, params) {
    return new Class({
        type: "array",
        element,
        // get element() {
        //   return element;
        // },
        ...normalizeParams(params),
    });
}
function _file(Class, params) {
    return new Class({
        type: "file",
        ...normalizeParams(params),
    });
}
function _custom(Class, fn, _params) {
    const norm = normalizeParams(_params);
    norm.abort ?? (norm.abort = true); // default to abort:false
    const schema = new Class({
        type: "custom",
        check: "custom",
        fn: fn,
        ...norm,
    });
    return schema;
}
// same as _custom but defaults to abort:false
function _refine(Class, fn, _params) {
    const schema = new Class({
        type: "custom",
        check: "custom",
        fn: fn,
        ...normalizeParams(_params),
    });
    return schema;
}
function _superRefine(fn) {
    const ch = _check((payload) => {
        payload.addIssue = (issue$1) => {
            if (typeof issue$1 === "string") {
                payload.issues.push(issue(issue$1, payload.value, ch._zod.def));
            }
            else {
                // for Zod 3 backwards compatibility
                const _issue = issue$1;
                if (_issue.fatal)
                    _issue.continue = false;
                _issue.code ?? (_issue.code = "custom");
                _issue.input ?? (_issue.input = payload.value);
                _issue.inst ?? (_issue.inst = ch);
                _issue.continue ?? (_issue.continue = !ch._zod.def.abort); // abort is always undefined, so this is always true...
                payload.issues.push(issue(_issue));
            }
        };
        return fn(payload.value, payload);
    });
    return ch;
}
function _check(fn, params) {
    const ch = new $ZodCheck({
        check: "custom",
        ...normalizeParams(params),
    });
    ch._zod.check = fn;
    return ch;
}

// function initializeContext<T extends schemas.$ZodType>(inputs: JSONSchemaGeneratorParams<T>): ToJSONSchemaContext<T> {
//   return {
//     processor: inputs.processor,
//     metadataRegistry: inputs.metadata ?? globalRegistry,
//     target: inputs.target ?? "draft-2020-12",
//     unrepresentable: inputs.unrepresentable ?? "throw",
//   };
// }
function initializeContext(params) {
    // Normalize target: convert old non-hyphenated versions to hyphenated versions
    let target = params?.target ?? "draft-2020-12";
    if (target === "draft-4")
        target = "draft-04";
    if (target === "draft-7")
        target = "draft-07";
    return {
        processors: params.processors ?? {},
        metadataRegistry: params?.metadata ?? globalRegistry,
        target,
        unrepresentable: params?.unrepresentable ?? "throw",
        override: params?.override ?? (() => { }),
        io: params?.io ?? "output",
        counter: 0,
        seen: new Map(),
        cycles: params?.cycles ?? "ref",
        reused: params?.reused ?? "inline",
        external: params?.external ?? undefined,
    };
}
function process$1(schema, ctx, _params = { path: [], schemaPath: [] }) {
    var _a;
    const def = schema._zod.def;
    // check for schema in seens
    const seen = ctx.seen.get(schema);
    if (seen) {
        seen.count++;
        // check if cycle
        const isCycle = _params.schemaPath.includes(schema);
        if (isCycle) {
            seen.cycle = _params.path;
        }
        return seen.schema;
    }
    // initialize
    const result = { schema: {}, count: 1, cycle: undefined, path: _params.path };
    ctx.seen.set(schema, result);
    // custom method overrides default behavior
    const overrideSchema = schema._zod.toJSONSchema?.();
    if (overrideSchema) {
        result.schema = overrideSchema;
    }
    else {
        const params = {
            ..._params,
            schemaPath: [..._params.schemaPath, schema],
            path: _params.path,
        };
        const parent = schema._zod.parent;
        if (parent) {
            // schema was cloned from another schema
            result.ref = parent;
            process$1(parent, ctx, params);
            ctx.seen.get(parent).isParent = true;
        }
        else if (schema._zod.processJSONSchema) {
            schema._zod.processJSONSchema(ctx, result.schema, params);
        }
        else {
            const _json = result.schema;
            const processor = ctx.processors[def.type];
            if (!processor) {
                throw new Error(`[toJSONSchema]: Non-representable type encountered: ${def.type}`);
            }
            processor(schema, ctx, _json, params);
        }
    }
    // metadata
    const meta = ctx.metadataRegistry.get(schema);
    if (meta)
        Object.assign(result.schema, meta);
    if (ctx.io === "input" && isTransforming(schema)) {
        // examples/defaults only apply to output type of pipe
        delete result.schema.examples;
        delete result.schema.default;
    }
    // set prefault as default
    if (ctx.io === "input" && result.schema._prefault)
        (_a = result.schema).default ?? (_a.default = result.schema._prefault);
    delete result.schema._prefault;
    // pulling fresh from ctx.seen in case it was overwritten
    const _result = ctx.seen.get(schema);
    return _result.schema;
}
function extractDefs(ctx, schema
// params: EmitParams
) {
    // iterate over seen map;
    const root = ctx.seen.get(schema);
    if (!root)
        throw new Error("Unprocessed schema. This is a bug in Zod.");
    // returns a ref to the schema
    // defId will be empty if the ref points to an external schema (or #)
    const makeURI = (entry) => {
        // comparing the seen objects because sometimes
        // multiple schemas map to the same seen object.
        // e.g. lazy
        // external is configured
        const defsSegment = ctx.target === "draft-2020-12" ? "$defs" : "definitions";
        if (ctx.external) {
            const externalId = ctx.external.registry.get(entry[0])?.id; // ?? "__shared";// `__schema${ctx.counter++}`;
            // check if schema is in the external registry
            const uriGenerator = ctx.external.uri ?? ((id) => id);
            if (externalId) {
                return { ref: uriGenerator(externalId) };
            }
            // otherwise, add to __shared
            const id = entry[1].defId ?? entry[1].schema.id ?? `schema${ctx.counter++}`;
            entry[1].defId = id; // set defId so it will be reused if needed
            return { defId: id, ref: `${uriGenerator("__shared")}#/${defsSegment}/${id}` };
        }
        if (entry[1] === root) {
            return { ref: "#" };
        }
        // self-contained schema
        const uriPrefix = `#`;
        const defUriPrefix = `${uriPrefix}/${defsSegment}/`;
        const defId = entry[1].schema.id ?? `__schema${ctx.counter++}`;
        return { defId, ref: defUriPrefix + defId };
    };
    // stored cached version in `def` property
    // remove all properties, set $ref
    const extractToDef = (entry) => {
        // if the schema is already a reference, do not extract it
        if (entry[1].schema.$ref) {
            return;
        }
        const seen = entry[1];
        const { ref, defId } = makeURI(entry);
        seen.def = { ...seen.schema };
        // defId won't be set if the schema is a reference to an external schema
        // or if the schema is the root schema
        if (defId)
            seen.defId = defId;
        // wipe away all properties except $ref
        const schema = seen.schema;
        for (const key in schema) {
            delete schema[key];
        }
        schema.$ref = ref;
    };
    // throw on cycles
    // break cycles
    if (ctx.cycles === "throw") {
        for (const entry of ctx.seen.entries()) {
            const seen = entry[1];
            if (seen.cycle) {
                throw new Error("Cycle detected: " +
                    `#/${seen.cycle?.join("/")}/<root>` +
                    '\n\nSet the `cycles` parameter to `"ref"` to resolve cyclical schemas with defs.');
            }
        }
    }
    // extract schemas into $defs
    for (const entry of ctx.seen.entries()) {
        const seen = entry[1];
        // convert root schema to # $ref
        if (schema === entry[0]) {
            extractToDef(entry); // this has special handling for the root schema
            continue;
        }
        // extract schemas that are in the external registry
        if (ctx.external) {
            const ext = ctx.external.registry.get(entry[0])?.id;
            if (schema !== entry[0] && ext) {
                extractToDef(entry);
                continue;
            }
        }
        // extract schemas with `id` meta
        const id = ctx.metadataRegistry.get(entry[0])?.id;
        if (id) {
            extractToDef(entry);
            continue;
        }
        // break cycles
        if (seen.cycle) {
            // any
            extractToDef(entry);
            continue;
        }
        // extract reused schemas
        if (seen.count > 1) {
            if (ctx.reused === "ref") {
                extractToDef(entry);
                // biome-ignore lint:
                continue;
            }
        }
    }
}
function finalize(ctx, schema) {
    //
    // iterate over seen map;
    const root = ctx.seen.get(schema);
    if (!root)
        throw new Error("Unprocessed schema. This is a bug in Zod.");
    // flatten _refs
    const flattenRef = (zodSchema) => {
        const seen = ctx.seen.get(zodSchema);
        const schema = seen.def ?? seen.schema;
        const _cached = { ...schema };
        // already seen
        if (seen.ref === null) {
            return;
        }
        // flatten ref if defined
        const ref = seen.ref;
        seen.ref = null; // prevent recursion
        if (ref) {
            flattenRef(ref);
            // merge referenced schema into current
            const refSchema = ctx.seen.get(ref).schema;
            if (refSchema.$ref && (ctx.target === "draft-07" || ctx.target === "draft-04" || ctx.target === "openapi-3.0")) {
                schema.allOf = schema.allOf ?? [];
                schema.allOf.push(refSchema);
            }
            else {
                Object.assign(schema, refSchema);
                Object.assign(schema, _cached); // prevent overwriting any fields in the original schema
            }
        }
        // execute overrides
        if (!seen.isParent)
            ctx.override({
                zodSchema: zodSchema,
                jsonSchema: schema,
                path: seen.path ?? [],
            });
    };
    for (const entry of [...ctx.seen.entries()].reverse()) {
        flattenRef(entry[0]);
    }
    const result = {};
    if (ctx.target === "draft-2020-12") {
        result.$schema = "https://json-schema.org/draft/2020-12/schema";
    }
    else if (ctx.target === "draft-07") {
        result.$schema = "http://json-schema.org/draft-07/schema#";
    }
    else if (ctx.target === "draft-04") {
        result.$schema = "http://json-schema.org/draft-04/schema#";
    }
    else if (ctx.target === "openapi-3.0") ;
    else ;
    if (ctx.external?.uri) {
        const id = ctx.external.registry.get(schema)?.id;
        if (!id)
            throw new Error("Schema is missing an `id` property");
        result.$id = ctx.external.uri(id);
    }
    Object.assign(result, root.def ?? root.schema);
    // build defs object
    const defs = ctx.external?.defs ?? {};
    for (const entry of ctx.seen.entries()) {
        const seen = entry[1];
        if (seen.def && seen.defId) {
            defs[seen.defId] = seen.def;
        }
    }
    // set definitions in result
    if (ctx.external) ;
    else {
        if (Object.keys(defs).length > 0) {
            if (ctx.target === "draft-2020-12") {
                result.$defs = defs;
            }
            else {
                result.definitions = defs;
            }
        }
    }
    try {
        // this "finalizes" this schema and ensures all cycles are removed
        // each call to finalize() is functionally independent
        // though the seen map is shared
        const finalized = JSON.parse(JSON.stringify(result));
        Object.defineProperty(finalized, "~standard", {
            value: {
                ...schema["~standard"],
                jsonSchema: {
                    input: createStandardJSONSchemaMethod(schema, "input"),
                    output: createStandardJSONSchemaMethod(schema, "output"),
                },
            },
            enumerable: false,
            writable: false,
        });
        return finalized;
    }
    catch (_err) {
        throw new Error("Error converting schema to JSON.");
    }
}
function isTransforming(_schema, _ctx) {
    const ctx = _ctx ?? { seen: new Set() };
    if (ctx.seen.has(_schema))
        return false;
    ctx.seen.add(_schema);
    const def = _schema._zod.def;
    if (def.type === "transform")
        return true;
    if (def.type === "array")
        return isTransforming(def.element, ctx);
    if (def.type === "set")
        return isTransforming(def.valueType, ctx);
    if (def.type === "lazy")
        return isTransforming(def.getter(), ctx);
    if (def.type === "promise" ||
        def.type === "optional" ||
        def.type === "nonoptional" ||
        def.type === "nullable" ||
        def.type === "readonly" ||
        def.type === "default" ||
        def.type === "prefault") {
        return isTransforming(def.innerType, ctx);
    }
    if (def.type === "intersection") {
        return isTransforming(def.left, ctx) || isTransforming(def.right, ctx);
    }
    if (def.type === "record" || def.type === "map") {
        return isTransforming(def.keyType, ctx) || isTransforming(def.valueType, ctx);
    }
    if (def.type === "pipe") {
        return isTransforming(def.in, ctx) || isTransforming(def.out, ctx);
    }
    if (def.type === "object") {
        for (const key in def.shape) {
            if (isTransforming(def.shape[key], ctx))
                return true;
        }
        return false;
    }
    if (def.type === "union") {
        for (const option of def.options) {
            if (isTransforming(option, ctx))
                return true;
        }
        return false;
    }
    if (def.type === "tuple") {
        for (const item of def.items) {
            if (isTransforming(item, ctx))
                return true;
        }
        if (def.rest && isTransforming(def.rest, ctx))
            return true;
        return false;
    }
    return false;
}
/**
 * Creates a toJSONSchema method for a schema instance.
 * This encapsulates the logic of initializing context, processing, extracting defs, and finalizing.
 */
const createToJSONSchemaMethod = (schema, processors = {}) => (params) => {
    const ctx = initializeContext({ ...params, processors });
    process$1(schema, ctx);
    extractDefs(ctx, schema);
    return finalize(ctx, schema);
};
const createStandardJSONSchemaMethod = (schema, io) => (params) => {
    const { libraryOptions, target } = params ?? {};
    const ctx = initializeContext({ ...(libraryOptions ?? {}), target, io, processors: {} });
    process$1(schema, ctx);
    extractDefs(ctx, schema);
    return finalize(ctx, schema);
};

const formatMap = {
    guid: "uuid",
    url: "uri",
    datetime: "date-time",
    json_string: "json-string",
    regex: "", // do not set
};
// ==================== SIMPLE TYPE PROCESSORS ====================
const stringProcessor = (schema, ctx, _json, _params) => {
    const json = _json;
    json.type = "string";
    const { minimum, maximum, format, patterns, contentEncoding } = schema._zod
        .bag;
    if (typeof minimum === "number")
        json.minLength = minimum;
    if (typeof maximum === "number")
        json.maxLength = maximum;
    // custom pattern overrides format
    if (format) {
        json.format = formatMap[format] ?? format;
        if (json.format === "")
            delete json.format; // empty format is not valid
    }
    if (contentEncoding)
        json.contentEncoding = contentEncoding;
    if (patterns && patterns.size > 0) {
        const regexes = [...patterns];
        if (regexes.length === 1)
            json.pattern = regexes[0].source;
        else if (regexes.length > 1) {
            json.allOf = [
                ...regexes.map((regex) => ({
                    ...(ctx.target === "draft-07" || ctx.target === "draft-04" || ctx.target === "openapi-3.0"
                        ? { type: "string" }
                        : {}),
                    pattern: regex.source,
                })),
            ];
        }
    }
};
const numberProcessor = (schema, ctx, _json, _params) => {
    const json = _json;
    const { minimum, maximum, format, multipleOf, exclusiveMaximum, exclusiveMinimum } = schema._zod.bag;
    if (typeof format === "string" && format.includes("int"))
        json.type = "integer";
    else
        json.type = "number";
    if (typeof exclusiveMinimum === "number") {
        if (ctx.target === "draft-04" || ctx.target === "openapi-3.0") {
            json.minimum = exclusiveMinimum;
            json.exclusiveMinimum = true;
        }
        else {
            json.exclusiveMinimum = exclusiveMinimum;
        }
    }
    if (typeof minimum === "number") {
        json.minimum = minimum;
        if (typeof exclusiveMinimum === "number" && ctx.target !== "draft-04") {
            if (exclusiveMinimum >= minimum)
                delete json.minimum;
            else
                delete json.exclusiveMinimum;
        }
    }
    if (typeof exclusiveMaximum === "number") {
        if (ctx.target === "draft-04" || ctx.target === "openapi-3.0") {
            json.maximum = exclusiveMaximum;
            json.exclusiveMaximum = true;
        }
        else {
            json.exclusiveMaximum = exclusiveMaximum;
        }
    }
    if (typeof maximum === "number") {
        json.maximum = maximum;
        if (typeof exclusiveMaximum === "number" && ctx.target !== "draft-04") {
            if (exclusiveMaximum <= maximum)
                delete json.maximum;
            else
                delete json.exclusiveMaximum;
        }
    }
    if (typeof multipleOf === "number")
        json.multipleOf = multipleOf;
};
const booleanProcessor = (_schema, _ctx, json, _params) => {
    json.type = "boolean";
};
const nullProcessor = (_schema, ctx, json, _params) => {
    if (ctx.target === "openapi-3.0") {
        json.type = "string";
        json.nullable = true;
        json.enum = [null];
    }
    else {
        json.type = "null";
    }
};
const neverProcessor = (_schema, _ctx, json, _params) => {
    json.not = {};
};
const anyProcessor = (_schema, _ctx, _json, _params) => {
    // empty schema accepts anything
};
const unknownProcessor = (_schema, _ctx, _json, _params) => {
    // empty schema accepts anything
};
const enumProcessor = (schema, _ctx, json, _params) => {
    const def = schema._zod.def;
    const values = getEnumValues(def.entries);
    // Number enums can have both string and number values
    if (values.every((v) => typeof v === "number"))
        json.type = "number";
    if (values.every((v) => typeof v === "string"))
        json.type = "string";
    json.enum = values;
};
const literalProcessor = (schema, ctx, json, _params) => {
    const def = schema._zod.def;
    const vals = [];
    for (const val of def.values) {
        if (val === undefined) {
            if (ctx.unrepresentable === "throw") {
                throw new Error("Literal `undefined` cannot be represented in JSON Schema");
            }
        }
        else if (typeof val === "bigint") {
            if (ctx.unrepresentable === "throw") {
                throw new Error("BigInt literals cannot be represented in JSON Schema");
            }
            else {
                vals.push(Number(val));
            }
        }
        else {
            vals.push(val);
        }
    }
    if (vals.length === 0) ;
    else if (vals.length === 1) {
        const val = vals[0];
        json.type = val === null ? "null" : typeof val;
        if (ctx.target === "draft-04" || ctx.target === "openapi-3.0") {
            json.enum = [val];
        }
        else {
            json.const = val;
        }
    }
    else {
        if (vals.every((v) => typeof v === "number"))
            json.type = "number";
        if (vals.every((v) => typeof v === "string"))
            json.type = "string";
        if (vals.every((v) => typeof v === "boolean"))
            json.type = "boolean";
        if (vals.every((v) => v === null))
            json.type = "null";
        json.enum = vals;
    }
};
const fileProcessor = (schema, _ctx, json, _params) => {
    const _json = json;
    const file = {
        type: "string",
        format: "binary",
        contentEncoding: "binary",
    };
    const { minimum, maximum, mime } = schema._zod.bag;
    if (minimum !== undefined)
        file.minLength = minimum;
    if (maximum !== undefined)
        file.maxLength = maximum;
    if (mime) {
        if (mime.length === 1) {
            file.contentMediaType = mime[0];
            Object.assign(_json, file);
        }
        else {
            _json.anyOf = mime.map((m) => {
                const mFile = { ...file, contentMediaType: m };
                return mFile;
            });
        }
    }
    else {
        Object.assign(_json, file);
    }
};
const customProcessor = (_schema, ctx, _json, _params) => {
    if (ctx.unrepresentable === "throw") {
        throw new Error("Custom types cannot be represented in JSON Schema");
    }
};
const transformProcessor = (_schema, ctx, _json, _params) => {
    if (ctx.unrepresentable === "throw") {
        throw new Error("Transforms cannot be represented in JSON Schema");
    }
};
// ==================== COMPOSITE TYPE PROCESSORS ====================
const arrayProcessor = (schema, ctx, _json, params) => {
    const json = _json;
    const def = schema._zod.def;
    const { minimum, maximum } = schema._zod.bag;
    if (typeof minimum === "number")
        json.minItems = minimum;
    if (typeof maximum === "number")
        json.maxItems = maximum;
    json.type = "array";
    json.items = process$1(def.element, ctx, { ...params, path: [...params.path, "items"] });
};
const objectProcessor = (schema, ctx, _json, params) => {
    const json = _json;
    const def = schema._zod.def;
    json.type = "object";
    json.properties = {};
    const shape = def.shape;
    for (const key in shape) {
        json.properties[key] = process$1(shape[key], ctx, {
            ...params,
            path: [...params.path, "properties", key],
        });
    }
    // required keys
    const allKeys = new Set(Object.keys(shape));
    const requiredKeys = new Set([...allKeys].filter((key) => {
        const v = def.shape[key]._zod;
        if (ctx.io === "input") {
            return v.optin === undefined;
        }
        else {
            return v.optout === undefined;
        }
    }));
    if (requiredKeys.size > 0) {
        json.required = Array.from(requiredKeys);
    }
    // catchall
    if (def.catchall?._zod.def.type === "never") {
        // strict
        json.additionalProperties = false;
    }
    else if (!def.catchall) {
        // regular
        if (ctx.io === "output")
            json.additionalProperties = false;
    }
    else if (def.catchall) {
        json.additionalProperties = process$1(def.catchall, ctx, {
            ...params,
            path: [...params.path, "additionalProperties"],
        });
    }
};
const unionProcessor = (schema, ctx, json, params) => {
    const def = schema._zod.def;
    // Exclusive unions (inclusive === false) use oneOf (exactly one match) instead of anyOf (one or more matches)
    // This includes both z.xor() and discriminated unions
    const isExclusive = def.inclusive === false;
    const options = def.options.map((x, i) => process$1(x, ctx, {
        ...params,
        path: [...params.path, isExclusive ? "oneOf" : "anyOf", i],
    }));
    if (isExclusive) {
        json.oneOf = options;
    }
    else {
        json.anyOf = options;
    }
};
const intersectionProcessor = (schema, ctx, json, params) => {
    const def = schema._zod.def;
    const a = process$1(def.left, ctx, {
        ...params,
        path: [...params.path, "allOf", 0],
    });
    const b = process$1(def.right, ctx, {
        ...params,
        path: [...params.path, "allOf", 1],
    });
    const isSimpleIntersection = (val) => "allOf" in val && Object.keys(val).length === 1;
    const allOf = [
        ...(isSimpleIntersection(a) ? a.allOf : [a]),
        ...(isSimpleIntersection(b) ? b.allOf : [b]),
    ];
    json.allOf = allOf;
};
const tupleProcessor = (schema, ctx, _json, params) => {
    const json = _json;
    const def = schema._zod.def;
    json.type = "array";
    const prefixPath = ctx.target === "draft-2020-12" ? "prefixItems" : "items";
    const restPath = ctx.target === "draft-2020-12" ? "items" : ctx.target === "openapi-3.0" ? "items" : "additionalItems";
    const prefixItems = def.items.map((x, i) => process$1(x, ctx, {
        ...params,
        path: [...params.path, prefixPath, i],
    }));
    const rest = def.rest
        ? process$1(def.rest, ctx, {
            ...params,
            path: [...params.path, restPath, ...(ctx.target === "openapi-3.0" ? [def.items.length] : [])],
        })
        : null;
    if (ctx.target === "draft-2020-12") {
        json.prefixItems = prefixItems;
        if (rest) {
            json.items = rest;
        }
    }
    else if (ctx.target === "openapi-3.0") {
        json.items = {
            anyOf: prefixItems,
        };
        if (rest) {
            json.items.anyOf.push(rest);
        }
        json.minItems = prefixItems.length;
        if (!rest) {
            json.maxItems = prefixItems.length;
        }
    }
    else {
        json.items = prefixItems;
        if (rest) {
            json.additionalItems = rest;
        }
    }
    // length
    const { minimum, maximum } = schema._zod.bag;
    if (typeof minimum === "number")
        json.minItems = minimum;
    if (typeof maximum === "number")
        json.maxItems = maximum;
};
const recordProcessor = (schema, ctx, _json, params) => {
    const json = _json;
    const def = schema._zod.def;
    json.type = "object";
    if (ctx.target === "draft-07" || ctx.target === "draft-2020-12") {
        json.propertyNames = process$1(def.keyType, ctx, {
            ...params,
            path: [...params.path, "propertyNames"],
        });
    }
    json.additionalProperties = process$1(def.valueType, ctx, {
        ...params,
        path: [...params.path, "additionalProperties"],
    });
};
const nullableProcessor = (schema, ctx, json, params) => {
    const def = schema._zod.def;
    const inner = process$1(def.innerType, ctx, params);
    const seen = ctx.seen.get(schema);
    if (ctx.target === "openapi-3.0") {
        seen.ref = def.innerType;
        json.nullable = true;
    }
    else {
        json.anyOf = [inner, { type: "null" }];
    }
};
const nonoptionalProcessor = (schema, ctx, _json, params) => {
    const def = schema._zod.def;
    process$1(def.innerType, ctx, params);
    const seen = ctx.seen.get(schema);
    seen.ref = def.innerType;
};
const defaultProcessor = (schema, ctx, json, params) => {
    const def = schema._zod.def;
    process$1(def.innerType, ctx, params);
    const seen = ctx.seen.get(schema);
    seen.ref = def.innerType;
    json.default = JSON.parse(JSON.stringify(def.defaultValue));
};
const prefaultProcessor = (schema, ctx, json, params) => {
    const def = schema._zod.def;
    process$1(def.innerType, ctx, params);
    const seen = ctx.seen.get(schema);
    seen.ref = def.innerType;
    if (ctx.io === "input")
        json._prefault = JSON.parse(JSON.stringify(def.defaultValue));
};
const catchProcessor = (schema, ctx, json, params) => {
    const def = schema._zod.def;
    process$1(def.innerType, ctx, params);
    const seen = ctx.seen.get(schema);
    seen.ref = def.innerType;
    let catchValue;
    try {
        catchValue = def.catchValue(undefined);
    }
    catch {
        throw new Error("Dynamic catch values are not supported in JSON Schema");
    }
    json.default = catchValue;
};
const pipeProcessor = (schema, ctx, _json, params) => {
    const def = schema._zod.def;
    const innerType = ctx.io === "input" ? (def.in._zod.def.type === "transform" ? def.out : def.in) : def.out;
    process$1(innerType, ctx, params);
    const seen = ctx.seen.get(schema);
    seen.ref = innerType;
};
const readonlyProcessor = (schema, ctx, json, params) => {
    const def = schema._zod.def;
    process$1(def.innerType, ctx, params);
    const seen = ctx.seen.get(schema);
    seen.ref = def.innerType;
    json.readOnly = true;
};
const optionalProcessor = (schema, ctx, _json, params) => {
    const def = schema._zod.def;
    process$1(def.innerType, ctx, params);
    const seen = ctx.seen.get(schema);
    seen.ref = def.innerType;
};

const ZodISODateTime = /*@__PURE__*/ $constructor("ZodISODateTime", (inst, def) => {
    $ZodISODateTime.init(inst, def);
    ZodStringFormat.init(inst, def);
});
function datetime(params) {
    return _isoDateTime(ZodISODateTime, params);
}
const ZodISODate = /*@__PURE__*/ $constructor("ZodISODate", (inst, def) => {
    $ZodISODate.init(inst, def);
    ZodStringFormat.init(inst, def);
});
function date(params) {
    return _isoDate(ZodISODate, params);
}
const ZodISOTime = /*@__PURE__*/ $constructor("ZodISOTime", (inst, def) => {
    $ZodISOTime.init(inst, def);
    ZodStringFormat.init(inst, def);
});
function time(params) {
    return _isoTime(ZodISOTime, params);
}
const ZodISODuration = /*@__PURE__*/ $constructor("ZodISODuration", (inst, def) => {
    $ZodISODuration.init(inst, def);
    ZodStringFormat.init(inst, def);
});
function duration(params) {
    return _isoDuration(ZodISODuration, params);
}

const initializer = (inst, issues) => {
    $ZodError.init(inst, issues);
    inst.name = "ZodError";
    Object.defineProperties(inst, {
        format: {
            value: (mapper) => formatError(inst, mapper),
            // enumerable: false,
        },
        flatten: {
            value: (mapper) => flattenError(inst, mapper),
            // enumerable: false,
        },
        addIssue: {
            value: (issue) => {
                inst.issues.push(issue);
                inst.message = JSON.stringify(inst.issues, jsonStringifyReplacer, 2);
            },
            // enumerable: false,
        },
        addIssues: {
            value: (issues) => {
                inst.issues.push(...issues);
                inst.message = JSON.stringify(inst.issues, jsonStringifyReplacer, 2);
            },
            // enumerable: false,
        },
        isEmpty: {
            get() {
                return inst.issues.length === 0;
            },
            // enumerable: false,
        },
    });
    // Object.defineProperty(inst, "isEmpty", {
    //   get() {
    //     return inst.issues.length === 0;
    //   },
    // });
};
const ZodRealError = $constructor("ZodError", initializer, {
    Parent: Error,
});
// /** @deprecated Use `z.core.$ZodErrorMapCtx` instead. */
// export type ErrorMapCtx = core.$ZodErrorMapCtx;

const parse = /* @__PURE__ */ _parse(ZodRealError);
const parseAsync = /* @__PURE__ */ _parseAsync(ZodRealError);
const safeParse = /* @__PURE__ */ _safeParse(ZodRealError);
const safeParseAsync = /* @__PURE__ */ _safeParseAsync(ZodRealError);
// Codec functions
const encode = /* @__PURE__ */ _encode(ZodRealError);
const decode = /* @__PURE__ */ _decode(ZodRealError);
const encodeAsync = /* @__PURE__ */ _encodeAsync(ZodRealError);
const decodeAsync = /* @__PURE__ */ _decodeAsync(ZodRealError);
const safeEncode = /* @__PURE__ */ _safeEncode(ZodRealError);
const safeDecode = /* @__PURE__ */ _safeDecode(ZodRealError);
const safeEncodeAsync = /* @__PURE__ */ _safeEncodeAsync(ZodRealError);
const safeDecodeAsync = /* @__PURE__ */ _safeDecodeAsync(ZodRealError);

const ZodType = /*@__PURE__*/ $constructor("ZodType", (inst, def) => {
    $ZodType.init(inst, def);
    Object.assign(inst["~standard"], {
        jsonSchema: {
            input: createStandardJSONSchemaMethod(inst, "input"),
            output: createStandardJSONSchemaMethod(inst, "output"),
        },
    });
    inst.toJSONSchema = createToJSONSchemaMethod(inst, {});
    inst.def = def;
    inst.type = def.type;
    Object.defineProperty(inst, "_def", { value: def });
    // base methods
    inst.check = (...checks) => {
        return inst.clone(mergeDefs(def, {
            checks: [
                ...(def.checks ?? []),
                ...checks.map((ch) => typeof ch === "function" ? { _zod: { check: ch, def: { check: "custom" }, onattach: [] } } : ch),
            ],
        }));
    };
    inst.clone = (def, params) => clone(inst, def, params);
    inst.brand = () => inst;
    inst.register = ((reg, meta) => {
        reg.add(inst, meta);
        return inst;
    });
    // parsing
    inst.parse = (data, params) => parse(inst, data, params, { callee: inst.parse });
    inst.safeParse = (data, params) => safeParse(inst, data, params);
    inst.parseAsync = async (data, params) => parseAsync(inst, data, params, { callee: inst.parseAsync });
    inst.safeParseAsync = async (data, params) => safeParseAsync(inst, data, params);
    inst.spa = inst.safeParseAsync;
    // encoding/decoding
    inst.encode = (data, params) => encode(inst, data, params);
    inst.decode = (data, params) => decode(inst, data, params);
    inst.encodeAsync = async (data, params) => encodeAsync(inst, data, params);
    inst.decodeAsync = async (data, params) => decodeAsync(inst, data, params);
    inst.safeEncode = (data, params) => safeEncode(inst, data, params);
    inst.safeDecode = (data, params) => safeDecode(inst, data, params);
    inst.safeEncodeAsync = async (data, params) => safeEncodeAsync(inst, data, params);
    inst.safeDecodeAsync = async (data, params) => safeDecodeAsync(inst, data, params);
    // refinements
    inst.refine = (check, params) => inst.check(refine(check, params));
    inst.superRefine = (refinement) => inst.check(superRefine(refinement));
    inst.overwrite = (fn) => inst.check(_overwrite(fn));
    // wrappers
    inst.optional = () => optional(inst);
    inst.nullable = () => nullable(inst);
    inst.nullish = () => optional(nullable(inst));
    inst.nonoptional = (params) => nonoptional(inst, params);
    inst.array = () => array(inst);
    inst.or = (arg) => union([inst, arg]);
    inst.and = (arg) => intersection(inst, arg);
    inst.transform = (tx) => pipe(inst, transform(tx));
    inst.default = (def) => _default(inst, def);
    inst.prefault = (def) => prefault(inst, def);
    // inst.coalesce = (def, params) => coalesce(inst, def, params);
    inst.catch = (params) => _catch(inst, params);
    inst.pipe = (target) => pipe(inst, target);
    inst.readonly = () => readonly(inst);
    // meta
    inst.describe = (description) => {
        const cl = inst.clone();
        globalRegistry.add(cl, { description });
        return cl;
    };
    Object.defineProperty(inst, "description", {
        get() {
            return globalRegistry.get(inst)?.description;
        },
        configurable: true,
    });
    inst.meta = (...args) => {
        if (args.length === 0) {
            return globalRegistry.get(inst);
        }
        const cl = inst.clone();
        globalRegistry.add(cl, args[0]);
        return cl;
    };
    // helpers
    inst.isOptional = () => inst.safeParse(undefined).success;
    inst.isNullable = () => inst.safeParse(null).success;
    return inst;
});
/** @internal */
const _ZodString = /*@__PURE__*/ $constructor("_ZodString", (inst, def) => {
    $ZodString.init(inst, def);
    ZodType.init(inst, def);
    inst._zod.processJSONSchema = (ctx, json, params) => stringProcessor(inst, ctx, json);
    const bag = inst._zod.bag;
    inst.format = bag.format ?? null;
    inst.minLength = bag.minimum ?? null;
    inst.maxLength = bag.maximum ?? null;
    // validations
    inst.regex = (...args) => inst.check(_regex(...args));
    inst.includes = (...args) => inst.check(_includes(...args));
    inst.startsWith = (...args) => inst.check(_startsWith(...args));
    inst.endsWith = (...args) => inst.check(_endsWith(...args));
    inst.min = (...args) => inst.check(_minLength(...args));
    inst.max = (...args) => inst.check(_maxLength(...args));
    inst.length = (...args) => inst.check(_length(...args));
    inst.nonempty = (...args) => inst.check(_minLength(1, ...args));
    inst.lowercase = (params) => inst.check(_lowercase(params));
    inst.uppercase = (params) => inst.check(_uppercase(params));
    // transforms
    inst.trim = () => inst.check(_trim());
    inst.normalize = (...args) => inst.check(_normalize(...args));
    inst.toLowerCase = () => inst.check(_toLowerCase());
    inst.toUpperCase = () => inst.check(_toUpperCase());
    inst.slugify = () => inst.check(_slugify());
});
const ZodString = /*@__PURE__*/ $constructor("ZodString", (inst, def) => {
    $ZodString.init(inst, def);
    _ZodString.init(inst, def);
    inst.email = (params) => inst.check(_email(ZodEmail, params));
    inst.url = (params) => inst.check(_url(ZodURL, params));
    inst.jwt = (params) => inst.check(_jwt(ZodJWT, params));
    inst.emoji = (params) => inst.check(_emoji(ZodEmoji, params));
    inst.guid = (params) => inst.check(_guid(ZodGUID, params));
    inst.uuid = (params) => inst.check(_uuid(ZodUUID, params));
    inst.uuidv4 = (params) => inst.check(_uuidv4(ZodUUID, params));
    inst.uuidv6 = (params) => inst.check(_uuidv6(ZodUUID, params));
    inst.uuidv7 = (params) => inst.check(_uuidv7(ZodUUID, params));
    inst.nanoid = (params) => inst.check(_nanoid(ZodNanoID, params));
    inst.guid = (params) => inst.check(_guid(ZodGUID, params));
    inst.cuid = (params) => inst.check(_cuid(ZodCUID, params));
    inst.cuid2 = (params) => inst.check(_cuid2(ZodCUID2, params));
    inst.ulid = (params) => inst.check(_ulid(ZodULID, params));
    inst.base64 = (params) => inst.check(_base64(ZodBase64, params));
    inst.base64url = (params) => inst.check(_base64url(ZodBase64URL, params));
    inst.xid = (params) => inst.check(_xid(ZodXID, params));
    inst.ksuid = (params) => inst.check(_ksuid(ZodKSUID, params));
    inst.ipv4 = (params) => inst.check(_ipv4(ZodIPv4, params));
    inst.ipv6 = (params) => inst.check(_ipv6(ZodIPv6, params));
    inst.cidrv4 = (params) => inst.check(_cidrv4(ZodCIDRv4, params));
    inst.cidrv6 = (params) => inst.check(_cidrv6(ZodCIDRv6, params));
    inst.e164 = (params) => inst.check(_e164(ZodE164, params));
    // iso
    inst.datetime = (params) => inst.check(datetime(params));
    inst.date = (params) => inst.check(date(params));
    inst.time = (params) => inst.check(time(params));
    inst.duration = (params) => inst.check(duration(params));
});
function string(params) {
    return _string(ZodString, params);
}
const ZodStringFormat = /*@__PURE__*/ $constructor("ZodStringFormat", (inst, def) => {
    $ZodStringFormat.init(inst, def);
    _ZodString.init(inst, def);
});
const ZodEmail = /*@__PURE__*/ $constructor("ZodEmail", (inst, def) => {
    // ZodStringFormat.init(inst, def);
    $ZodEmail.init(inst, def);
    ZodStringFormat.init(inst, def);
});
const ZodGUID = /*@__PURE__*/ $constructor("ZodGUID", (inst, def) => {
    // ZodStringFormat.init(inst, def);
    $ZodGUID.init(inst, def);
    ZodStringFormat.init(inst, def);
});
const ZodUUID = /*@__PURE__*/ $constructor("ZodUUID", (inst, def) => {
    // ZodStringFormat.init(inst, def);
    $ZodUUID.init(inst, def);
    ZodStringFormat.init(inst, def);
});
const ZodURL = /*@__PURE__*/ $constructor("ZodURL", (inst, def) => {
    // ZodStringFormat.init(inst, def);
    $ZodURL.init(inst, def);
    ZodStringFormat.init(inst, def);
});
const ZodEmoji = /*@__PURE__*/ $constructor("ZodEmoji", (inst, def) => {
    // ZodStringFormat.init(inst, def);
    $ZodEmoji.init(inst, def);
    ZodStringFormat.init(inst, def);
});
const ZodNanoID = /*@__PURE__*/ $constructor("ZodNanoID", (inst, def) => {
    // ZodStringFormat.init(inst, def);
    $ZodNanoID.init(inst, def);
    ZodStringFormat.init(inst, def);
});
const ZodCUID = /*@__PURE__*/ $constructor("ZodCUID", (inst, def) => {
    // ZodStringFormat.init(inst, def);
    $ZodCUID.init(inst, def);
    ZodStringFormat.init(inst, def);
});
const ZodCUID2 = /*@__PURE__*/ $constructor("ZodCUID2", (inst, def) => {
    // ZodStringFormat.init(inst, def);
    $ZodCUID2.init(inst, def);
    ZodStringFormat.init(inst, def);
});
const ZodULID = /*@__PURE__*/ $constructor("ZodULID", (inst, def) => {
    // ZodStringFormat.init(inst, def);
    $ZodULID.init(inst, def);
    ZodStringFormat.init(inst, def);
});
const ZodXID = /*@__PURE__*/ $constructor("ZodXID", (inst, def) => {
    // ZodStringFormat.init(inst, def);
    $ZodXID.init(inst, def);
    ZodStringFormat.init(inst, def);
});
const ZodKSUID = /*@__PURE__*/ $constructor("ZodKSUID", (inst, def) => {
    // ZodStringFormat.init(inst, def);
    $ZodKSUID.init(inst, def);
    ZodStringFormat.init(inst, def);
});
const ZodIPv4 = /*@__PURE__*/ $constructor("ZodIPv4", (inst, def) => {
    // ZodStringFormat.init(inst, def);
    $ZodIPv4.init(inst, def);
    ZodStringFormat.init(inst, def);
});
const ZodIPv6 = /*@__PURE__*/ $constructor("ZodIPv6", (inst, def) => {
    // ZodStringFormat.init(inst, def);
    $ZodIPv6.init(inst, def);
    ZodStringFormat.init(inst, def);
});
const ZodCIDRv4 = /*@__PURE__*/ $constructor("ZodCIDRv4", (inst, def) => {
    $ZodCIDRv4.init(inst, def);
    ZodStringFormat.init(inst, def);
});
const ZodCIDRv6 = /*@__PURE__*/ $constructor("ZodCIDRv6", (inst, def) => {
    $ZodCIDRv6.init(inst, def);
    ZodStringFormat.init(inst, def);
});
const ZodBase64 = /*@__PURE__*/ $constructor("ZodBase64", (inst, def) => {
    // ZodStringFormat.init(inst, def);
    $ZodBase64.init(inst, def);
    ZodStringFormat.init(inst, def);
});
const ZodBase64URL = /*@__PURE__*/ $constructor("ZodBase64URL", (inst, def) => {
    // ZodStringFormat.init(inst, def);
    $ZodBase64URL.init(inst, def);
    ZodStringFormat.init(inst, def);
});
const ZodE164 = /*@__PURE__*/ $constructor("ZodE164", (inst, def) => {
    // ZodStringFormat.init(inst, def);
    $ZodE164.init(inst, def);
    ZodStringFormat.init(inst, def);
});
const ZodJWT = /*@__PURE__*/ $constructor("ZodJWT", (inst, def) => {
    // ZodStringFormat.init(inst, def);
    $ZodJWT.init(inst, def);
    ZodStringFormat.init(inst, def);
});
const ZodNumber = /*@__PURE__*/ $constructor("ZodNumber", (inst, def) => {
    $ZodNumber.init(inst, def);
    ZodType.init(inst, def);
    inst._zod.processJSONSchema = (ctx, json, params) => numberProcessor(inst, ctx, json);
    inst.gt = (value, params) => inst.check(_gt(value, params));
    inst.gte = (value, params) => inst.check(_gte(value, params));
    inst.min = (value, params) => inst.check(_gte(value, params));
    inst.lt = (value, params) => inst.check(_lt(value, params));
    inst.lte = (value, params) => inst.check(_lte(value, params));
    inst.max = (value, params) => inst.check(_lte(value, params));
    inst.int = (params) => inst.check(int(params));
    inst.safe = (params) => inst.check(int(params));
    inst.positive = (params) => inst.check(_gt(0, params));
    inst.nonnegative = (params) => inst.check(_gte(0, params));
    inst.negative = (params) => inst.check(_lt(0, params));
    inst.nonpositive = (params) => inst.check(_lte(0, params));
    inst.multipleOf = (value, params) => inst.check(_multipleOf(value, params));
    inst.step = (value, params) => inst.check(_multipleOf(value, params));
    // inst.finite = (params) => inst.check(core.finite(params));
    inst.finite = () => inst;
    const bag = inst._zod.bag;
    inst.minValue =
        Math.max(bag.minimum ?? Number.NEGATIVE_INFINITY, bag.exclusiveMinimum ?? Number.NEGATIVE_INFINITY) ?? null;
    inst.maxValue =
        Math.min(bag.maximum ?? Number.POSITIVE_INFINITY, bag.exclusiveMaximum ?? Number.POSITIVE_INFINITY) ?? null;
    inst.isInt = (bag.format ?? "").includes("int") || Number.isSafeInteger(bag.multipleOf ?? 0.5);
    inst.isFinite = true;
    inst.format = bag.format ?? null;
});
function number(params) {
    return _number(ZodNumber, params);
}
const ZodNumberFormat = /*@__PURE__*/ $constructor("ZodNumberFormat", (inst, def) => {
    $ZodNumberFormat.init(inst, def);
    ZodNumber.init(inst, def);
});
function int(params) {
    return _int(ZodNumberFormat, params);
}
const ZodBoolean = /*@__PURE__*/ $constructor("ZodBoolean", (inst, def) => {
    $ZodBoolean.init(inst, def);
    ZodType.init(inst, def);
    inst._zod.processJSONSchema = (ctx, json, params) => booleanProcessor(inst, ctx, json);
});
function boolean(params) {
    return _boolean(ZodBoolean, params);
}
const ZodNull = /*@__PURE__*/ $constructor("ZodNull", (inst, def) => {
    $ZodNull.init(inst, def);
    ZodType.init(inst, def);
    inst._zod.processJSONSchema = (ctx, json, params) => nullProcessor(inst, ctx, json);
});
function _null(params) {
    return _null$1(ZodNull, params);
}
const ZodAny = /*@__PURE__*/ $constructor("ZodAny", (inst, def) => {
    $ZodAny.init(inst, def);
    ZodType.init(inst, def);
    inst._zod.processJSONSchema = (ctx, json, params) => anyProcessor();
});
function any() {
    return _any(ZodAny);
}
const ZodUnknown = /*@__PURE__*/ $constructor("ZodUnknown", (inst, def) => {
    $ZodUnknown.init(inst, def);
    ZodType.init(inst, def);
    inst._zod.processJSONSchema = (ctx, json, params) => unknownProcessor();
});
function unknown() {
    return _unknown(ZodUnknown);
}
const ZodNever = /*@__PURE__*/ $constructor("ZodNever", (inst, def) => {
    $ZodNever.init(inst, def);
    ZodType.init(inst, def);
    inst._zod.processJSONSchema = (ctx, json, params) => neverProcessor(inst, ctx, json);
});
function never(params) {
    return _never(ZodNever, params);
}
const ZodArray = /*@__PURE__*/ $constructor("ZodArray", (inst, def) => {
    $ZodArray.init(inst, def);
    ZodType.init(inst, def);
    inst._zod.processJSONSchema = (ctx, json, params) => arrayProcessor(inst, ctx, json, params);
    inst.element = def.element;
    inst.min = (minLength, params) => inst.check(_minLength(minLength, params));
    inst.nonempty = (params) => inst.check(_minLength(1, params));
    inst.max = (maxLength, params) => inst.check(_maxLength(maxLength, params));
    inst.length = (len, params) => inst.check(_length(len, params));
    inst.unwrap = () => inst.element;
});
function array(element, params) {
    return _array(ZodArray, element, params);
}
const ZodObject = /*@__PURE__*/ $constructor("ZodObject", (inst, def) => {
    $ZodObjectJIT.init(inst, def);
    ZodType.init(inst, def);
    inst._zod.processJSONSchema = (ctx, json, params) => objectProcessor(inst, ctx, json, params);
    defineLazy(inst, "shape", () => {
        return def.shape;
    });
    inst.keyof = () => _enum(Object.keys(inst._zod.def.shape));
    inst.catchall = (catchall) => inst.clone({ ...inst._zod.def, catchall: catchall });
    inst.passthrough = () => inst.clone({ ...inst._zod.def, catchall: unknown() });
    inst.loose = () => inst.clone({ ...inst._zod.def, catchall: unknown() });
    inst.strict = () => inst.clone({ ...inst._zod.def, catchall: never() });
    inst.strip = () => inst.clone({ ...inst._zod.def, catchall: undefined });
    inst.extend = (incoming) => {
        return extend(inst, incoming);
    };
    inst.safeExtend = (incoming) => {
        return safeExtend(inst, incoming);
    };
    inst.merge = (other) => merge(inst, other);
    inst.pick = (mask) => pick(inst, mask);
    inst.omit = (mask) => omit(inst, mask);
    inst.partial = (...args) => partial(ZodOptional, inst, args[0]);
    inst.required = (...args) => required(ZodNonOptional, inst, args[0]);
});
function object(shape, params) {
    const def = {
        type: "object",
        shape: shape ?? {},
        ...normalizeParams(params),
    };
    return new ZodObject(def);
}
const ZodUnion = /*@__PURE__*/ $constructor("ZodUnion", (inst, def) => {
    $ZodUnion.init(inst, def);
    ZodType.init(inst, def);
    inst._zod.processJSONSchema = (ctx, json, params) => unionProcessor(inst, ctx, json, params);
    inst.options = def.options;
});
function union(options, params) {
    return new ZodUnion({
        type: "union",
        options: options,
        ...normalizeParams(params),
    });
}
const ZodIntersection = /*@__PURE__*/ $constructor("ZodIntersection", (inst, def) => {
    $ZodIntersection.init(inst, def);
    ZodType.init(inst, def);
    inst._zod.processJSONSchema = (ctx, json, params) => intersectionProcessor(inst, ctx, json, params);
});
function intersection(left, right) {
    return new ZodIntersection({
        type: "intersection",
        left: left,
        right: right,
    });
}
const ZodTuple = /*@__PURE__*/ $constructor("ZodTuple", (inst, def) => {
    $ZodTuple.init(inst, def);
    ZodType.init(inst, def);
    inst._zod.processJSONSchema = (ctx, json, params) => tupleProcessor(inst, ctx, json, params);
    inst.rest = (rest) => inst.clone({
        ...inst._zod.def,
        rest: rest,
    });
});
function tuple(items, _paramsOrRest, _params) {
    const hasRest = _paramsOrRest instanceof $ZodType;
    const params = hasRest ? _params : _paramsOrRest;
    const rest = hasRest ? _paramsOrRest : null;
    return new ZodTuple({
        type: "tuple",
        items: items,
        rest,
        ...normalizeParams(params),
    });
}
const ZodRecord = /*@__PURE__*/ $constructor("ZodRecord", (inst, def) => {
    $ZodRecord.init(inst, def);
    ZodType.init(inst, def);
    inst._zod.processJSONSchema = (ctx, json, params) => recordProcessor(inst, ctx, json, params);
    inst.keyType = def.keyType;
    inst.valueType = def.valueType;
});
const ZodEnum = /*@__PURE__*/ $constructor("ZodEnum", (inst, def) => {
    $ZodEnum.init(inst, def);
    ZodType.init(inst, def);
    inst._zod.processJSONSchema = (ctx, json, params) => enumProcessor(inst, ctx, json);
    inst.enum = def.entries;
    inst.options = Object.values(def.entries);
    const keys = new Set(Object.keys(def.entries));
    inst.extract = (values, params) => {
        const newEntries = {};
        for (const value of values) {
            if (keys.has(value)) {
                newEntries[value] = def.entries[value];
            }
            else
                throw new Error(`Key ${value} not found in enum`);
        }
        return new ZodEnum({
            ...def,
            checks: [],
            ...normalizeParams(params),
            entries: newEntries,
        });
    };
    inst.exclude = (values, params) => {
        const newEntries = { ...def.entries };
        for (const value of values) {
            if (keys.has(value)) {
                delete newEntries[value];
            }
            else
                throw new Error(`Key ${value} not found in enum`);
        }
        return new ZodEnum({
            ...def,
            checks: [],
            ...normalizeParams(params),
            entries: newEntries,
        });
    };
});
function _enum(values, params) {
    const entries = Array.isArray(values) ? Object.fromEntries(values.map((v) => [v, v])) : values;
    return new ZodEnum({
        type: "enum",
        entries,
        ...normalizeParams(params),
    });
}
const ZodLiteral = /*@__PURE__*/ $constructor("ZodLiteral", (inst, def) => {
    $ZodLiteral.init(inst, def);
    ZodType.init(inst, def);
    inst._zod.processJSONSchema = (ctx, json, params) => literalProcessor(inst, ctx, json);
    inst.values = new Set(def.values);
    Object.defineProperty(inst, "value", {
        get() {
            if (def.values.length > 1) {
                throw new Error("This schema contains multiple valid literal values. Use `.values` instead.");
            }
            return def.values[0];
        },
    });
});
function literal(value, params) {
    return new ZodLiteral({
        type: "literal",
        values: Array.isArray(value) ? value : [value],
        ...normalizeParams(params),
    });
}
const ZodFile = /*@__PURE__*/ $constructor("ZodFile", (inst, def) => {
    $ZodFile.init(inst, def);
    ZodType.init(inst, def);
    inst._zod.processJSONSchema = (ctx, json, params) => fileProcessor(inst, ctx, json);
    inst.min = (size, params) => inst.check(_minSize(size, params));
    inst.max = (size, params) => inst.check(_maxSize(size, params));
    inst.mime = (types, params) => inst.check(_mime(Array.isArray(types) ? types : [types], params));
});
function file(params) {
    return _file(ZodFile, params);
}
const ZodTransform = /*@__PURE__*/ $constructor("ZodTransform", (inst, def) => {
    $ZodTransform.init(inst, def);
    ZodType.init(inst, def);
    inst._zod.processJSONSchema = (ctx, json, params) => transformProcessor(inst, ctx);
    inst._zod.parse = (payload, _ctx) => {
        if (_ctx.direction === "backward") {
            throw new $ZodEncodeError(inst.constructor.name);
        }
        payload.addIssue = (issue$1) => {
            if (typeof issue$1 === "string") {
                payload.issues.push(issue(issue$1, payload.value, def));
            }
            else {
                // for Zod 3 backwards compatibility
                const _issue = issue$1;
                if (_issue.fatal)
                    _issue.continue = false;
                _issue.code ?? (_issue.code = "custom");
                _issue.input ?? (_issue.input = payload.value);
                _issue.inst ?? (_issue.inst = inst);
                // _issue.continue ??= true;
                payload.issues.push(issue(_issue));
            }
        };
        const output = def.transform(payload.value, payload);
        if (output instanceof Promise) {
            return output.then((output) => {
                payload.value = output;
                return payload;
            });
        }
        payload.value = output;
        return payload;
    };
});
function transform(fn) {
    return new ZodTransform({
        type: "transform",
        transform: fn,
    });
}
const ZodOptional = /*@__PURE__*/ $constructor("ZodOptional", (inst, def) => {
    $ZodOptional.init(inst, def);
    ZodType.init(inst, def);
    inst._zod.processJSONSchema = (ctx, json, params) => optionalProcessor(inst, ctx, json, params);
    inst.unwrap = () => inst._zod.def.innerType;
});
function optional(innerType) {
    return new ZodOptional({
        type: "optional",
        innerType: innerType,
    });
}
const ZodNullable = /*@__PURE__*/ $constructor("ZodNullable", (inst, def) => {
    $ZodNullable.init(inst, def);
    ZodType.init(inst, def);
    inst._zod.processJSONSchema = (ctx, json, params) => nullableProcessor(inst, ctx, json, params);
    inst.unwrap = () => inst._zod.def.innerType;
});
function nullable(innerType) {
    return new ZodNullable({
        type: "nullable",
        innerType: innerType,
    });
}
const ZodDefault = /*@__PURE__*/ $constructor("ZodDefault", (inst, def) => {
    $ZodDefault.init(inst, def);
    ZodType.init(inst, def);
    inst._zod.processJSONSchema = (ctx, json, params) => defaultProcessor(inst, ctx, json, params);
    inst.unwrap = () => inst._zod.def.innerType;
    inst.removeDefault = inst.unwrap;
});
function _default(innerType, defaultValue) {
    return new ZodDefault({
        type: "default",
        innerType: innerType,
        get defaultValue() {
            return typeof defaultValue === "function" ? defaultValue() : shallowClone(defaultValue);
        },
    });
}
const ZodPrefault = /*@__PURE__*/ $constructor("ZodPrefault", (inst, def) => {
    $ZodPrefault.init(inst, def);
    ZodType.init(inst, def);
    inst._zod.processJSONSchema = (ctx, json, params) => prefaultProcessor(inst, ctx, json, params);
    inst.unwrap = () => inst._zod.def.innerType;
});
function prefault(innerType, defaultValue) {
    return new ZodPrefault({
        type: "prefault",
        innerType: innerType,
        get defaultValue() {
            return typeof defaultValue === "function" ? defaultValue() : shallowClone(defaultValue);
        },
    });
}
const ZodNonOptional = /*@__PURE__*/ $constructor("ZodNonOptional", (inst, def) => {
    $ZodNonOptional.init(inst, def);
    ZodType.init(inst, def);
    inst._zod.processJSONSchema = (ctx, json, params) => nonoptionalProcessor(inst, ctx, json, params);
    inst.unwrap = () => inst._zod.def.innerType;
});
function nonoptional(innerType, params) {
    return new ZodNonOptional({
        type: "nonoptional",
        innerType: innerType,
        ...normalizeParams(params),
    });
}
const ZodCatch = /*@__PURE__*/ $constructor("ZodCatch", (inst, def) => {
    $ZodCatch.init(inst, def);
    ZodType.init(inst, def);
    inst._zod.processJSONSchema = (ctx, json, params) => catchProcessor(inst, ctx, json, params);
    inst.unwrap = () => inst._zod.def.innerType;
    inst.removeCatch = inst.unwrap;
});
function _catch(innerType, catchValue) {
    return new ZodCatch({
        type: "catch",
        innerType: innerType,
        catchValue: (typeof catchValue === "function" ? catchValue : () => catchValue),
    });
}
const ZodPipe = /*@__PURE__*/ $constructor("ZodPipe", (inst, def) => {
    $ZodPipe.init(inst, def);
    ZodType.init(inst, def);
    inst._zod.processJSONSchema = (ctx, json, params) => pipeProcessor(inst, ctx, json, params);
    inst.in = def.in;
    inst.out = def.out;
});
function pipe(in_, out) {
    return new ZodPipe({
        type: "pipe",
        in: in_,
        out: out,
        // ...util.normalizeParams(params),
    });
}
const ZodReadonly = /*@__PURE__*/ $constructor("ZodReadonly", (inst, def) => {
    $ZodReadonly.init(inst, def);
    ZodType.init(inst, def);
    inst._zod.processJSONSchema = (ctx, json, params) => readonlyProcessor(inst, ctx, json, params);
    inst.unwrap = () => inst._zod.def.innerType;
});
function readonly(innerType) {
    return new ZodReadonly({
        type: "readonly",
        innerType: innerType,
    });
}
const ZodCustom = /*@__PURE__*/ $constructor("ZodCustom", (inst, def) => {
    $ZodCustom.init(inst, def);
    ZodType.init(inst, def);
    inst._zod.processJSONSchema = (ctx, json, params) => customProcessor(inst, ctx);
});
function custom(fn, _params) {
    return _custom(ZodCustom, fn ?? (() => true), _params);
}
function refine(fn, _params = {}) {
    return _refine(ZodCustom, fn, _params);
}
// superRefine
function superRefine(fn) {
    return _superRefine(fn);
}

// src/core/converter.ts
var TypeHandler = class {
  apply(types, schema) {
    if (!schema.type) return;
    const allowedTypes = Array.isArray(schema.type) ? schema.type : [schema.type];
    const typeSet = new Set(allowedTypes);
    if (!typeSet.has("string")) {
      types.string = false;
    }
    if (!typeSet.has("number") && !typeSet.has("integer")) {
      types.number = false;
    }
    if (!typeSet.has("boolean")) {
      types.boolean = false;
    }
    if (!typeSet.has("null")) {
      types.null = false;
    }
    if (!typeSet.has("array")) {
      types.array = false;
    }
    if (!typeSet.has("object")) {
      types.object = false;
    }
    if (typeSet.has("integer") && types.number !== false) {
      const currentNumber = types.number || number();
      if (currentNumber instanceof ZodNumber) {
        types.number = currentNumber.int();
      }
    }
  }
};
var ConstHandler = class {
  apply(types, schema) {
    if (schema.const === void 0) return;
    const constValue = schema.const;
    types.string = false;
    types.number = false;
    types.boolean = false;
    types.null = false;
    types.array = false;
    types.object = false;
    if (typeof constValue === "string") {
      types.string = literal(constValue);
    } else if (typeof constValue === "number") {
      types.number = literal(constValue);
    } else if (typeof constValue === "boolean") {
      types.boolean = literal(constValue);
    } else if (constValue === null) {
      types.null = _null();
    } else if (Array.isArray(constValue)) {
      types.array = void 0;
    } else if (typeof constValue === "object") {
      types.object = void 0;
    }
  }
};
var EnumHandler = class {
  apply(types, schema) {
    if (!schema.enum) return;
    if (schema.enum.length === 0) {
      if (!schema.type) {
        types.string = false;
        types.number = false;
        types.boolean = false;
        types.null = false;
        types.array = false;
        types.object = false;
      }
      return;
    }
    const valuesByType = {
      string: schema.enum.filter((v) => typeof v === "string"),
      number: schema.enum.filter((v) => typeof v === "number"),
      boolean: schema.enum.filter((v) => typeof v === "boolean"),
      null: schema.enum.filter((v) => v === null),
      array: schema.enum.filter((v) => Array.isArray(v)),
      object: schema.enum.filter((v) => typeof v === "object" && v !== null && !Array.isArray(v))
    };
    types.string = this.createTypeSchema(valuesByType.string, "string");
    types.number = this.createTypeSchema(valuesByType.number, "number");
    types.boolean = this.createTypeSchema(valuesByType.boolean, "boolean");
    types.null = valuesByType.null.length > 0 ? _null() : false;
    types.array = valuesByType.array.length > 0 ? void 0 : false;
    types.object = valuesByType.object.length > 0 ? void 0 : false;
  }
  createTypeSchema(values, type) {
    if (values.length === 0) return false;
    if (values.length === 1) {
      return literal(values[0]);
    }
    if (type === "string") {
      return _enum(values);
    }
    if (type === "number") {
      const [first, second, ...rest] = values;
      return union([literal(first), literal(second), ...rest.map((v) => literal(v))]);
    }
    if (type === "boolean") {
      return union([literal(true), literal(false)]);
    }
    return false;
  }
};
var FileHandler = class {
  apply(types, schema) {
    const stringSchema = schema;
    if (stringSchema.type === "string" && stringSchema.format === "binary" && stringSchema.contentEncoding === "binary") {
      let fileSchema = file();
      if (stringSchema.minLength !== void 0) {
        fileSchema = fileSchema.min(stringSchema.minLength);
      }
      if (stringSchema.maxLength !== void 0) {
        fileSchema = fileSchema.max(stringSchema.maxLength);
      }
      if (stringSchema.contentMediaType !== void 0) {
        fileSchema = fileSchema.mime(stringSchema.contentMediaType);
      }
      types.file = fileSchema;
      types.string = false;
    }
  }
};
var ImplicitStringHandler = class {
  apply(types, schema) {
    const stringSchema = schema;
    if (schema.type === void 0 && (stringSchema.minLength !== void 0 || stringSchema.maxLength !== void 0 || stringSchema.pattern !== void 0)) {
      if (types.string === void 0) {
        types.string = string();
      }
    }
  }
};
var MinLengthHandler = class {
  apply(types, schema) {
    const stringSchema = schema;
    if (stringSchema.minLength === void 0) return;
    if (types.string !== false) {
      const currentString = types.string || string();
      if (currentString instanceof ZodString) {
        types.string = currentString.refine(
          (value) => {
            const graphemeLength = Array.from(value).length;
            return graphemeLength >= stringSchema.minLength;
          },
          { message: `String must be at least ${stringSchema.minLength} characters long` }
        );
      }
    }
  }
};
var MaxLengthHandler = class {
  apply(types, schema) {
    const stringSchema = schema;
    if (stringSchema.maxLength === void 0) return;
    if (types.string !== false) {
      const currentString = types.string || string();
      if (currentString instanceof ZodString) {
        types.string = currentString.refine(
          (value) => {
            const graphemeLength = Array.from(value).length;
            return graphemeLength <= stringSchema.maxLength;
          },
          { message: `String must be at most ${stringSchema.maxLength} characters long` }
        );
      }
    }
  }
};
var PatternHandler = class {
  apply(types, schema) {
    const stringSchema = schema;
    if (!stringSchema.pattern) return;
    if (types.string !== false) {
      const currentString = types.string || string();
      if (currentString instanceof ZodString) {
        const regex = new RegExp(stringSchema.pattern);
        types.string = currentString.regex(regex);
      }
    }
  }
};
var MinimumHandler = class {
  apply(types, schema) {
    const numberSchema = schema;
    if (numberSchema.minimum === void 0) return;
    if (types.number !== false) {
      const currentNumber = types.number || number();
      if (currentNumber instanceof ZodNumber) {
        types.number = currentNumber.min(numberSchema.minimum);
      }
    }
  }
};
var MaximumHandler = class {
  apply(types, schema) {
    const numberSchema = schema;
    if (numberSchema.maximum === void 0) return;
    if (types.number !== false) {
      const currentNumber = types.number || number();
      if (currentNumber instanceof ZodNumber) {
        types.number = currentNumber.max(numberSchema.maximum);
      }
    }
  }
};
var ExclusiveMinimumHandler = class {
  apply(types, schema) {
    const numberSchema = schema;
    if (numberSchema.exclusiveMinimum === void 0) return;
    if (types.number !== false) {
      const currentNumber = types.number || number();
      if (currentNumber instanceof ZodNumber) {
        if (typeof numberSchema.exclusiveMinimum === "number") {
          types.number = currentNumber.gt(numberSchema.exclusiveMinimum);
        } else {
          types.number = false;
        }
      }
    }
  }
};
var ExclusiveMaximumHandler = class {
  apply(types, schema) {
    const numberSchema = schema;
    if (numberSchema.exclusiveMaximum === void 0) return;
    if (types.number !== false) {
      const currentNumber = types.number || number();
      if (currentNumber instanceof ZodNumber) {
        if (typeof numberSchema.exclusiveMaximum === "number") {
          types.number = currentNumber.lt(numberSchema.exclusiveMaximum);
        } else {
          types.number = false;
        }
      }
    }
  }
};
var MultipleOfHandler = class {
  apply(types, schema) {
    const numberSchema = schema;
    if (numberSchema.multipleOf === void 0) return;
    if (types.number !== false) {
      const currentNumber = types.number || number();
      if (currentNumber instanceof ZodNumber) {
        types.number = currentNumber.refine(
          (value) => {
            if (numberSchema.multipleOf === 0) return false;
            const quotient = value / numberSchema.multipleOf;
            const rounded = Math.round(quotient);
            const tolerance = Math.min(
              Math.abs(value) * Number.EPSILON * 10,
              Math.abs(numberSchema.multipleOf) * Number.EPSILON * 10
            );
            return Math.abs(quotient - rounded) <= tolerance / Math.abs(numberSchema.multipleOf);
          },
          { message: `Must be a multiple of ${numberSchema.multipleOf}` }
        );
      }
    }
  }
};
var ImplicitArrayHandler = class {
  apply(types, schema) {
    const arraySchema = schema;
    if (schema.type === void 0 && (arraySchema.minItems !== void 0 || arraySchema.maxItems !== void 0 || arraySchema.items !== void 0 || arraySchema.prefixItems !== void 0)) {
      if (types.array === void 0) {
        types.array = array(any());
      }
    }
  }
};
var MinItemsHandler = class {
  apply(types, schema) {
    const arraySchema = schema;
    if (arraySchema.minItems === void 0) return;
    if (types.array !== false) {
      types.array = (types.array || array(any())).min(arraySchema.minItems);
    }
  }
};
var MaxItemsHandler = class {
  apply(types, schema) {
    const arraySchema = schema;
    if (arraySchema.maxItems === void 0) return;
    if (types.array !== false) {
      types.array = (types.array || array(any())).max(arraySchema.maxItems);
    }
  }
};
var ItemsHandler = class {
  apply(types, schema) {
    const arraySchema = schema;
    if (types.array === false) return;
    if (Array.isArray(arraySchema.items)) {
      types.array = types.array || array(any());
    } else if (arraySchema.items && typeof arraySchema.items !== "boolean" && !arraySchema.prefixItems) {
      const itemSchema = convertJsonSchemaToZod$1(arraySchema.items);
      let newArray = array(itemSchema);
      if (types.array && types.array instanceof ZodArray) {
        const existingDef = types.array._def;
        if (existingDef.checks) {
          existingDef.checks.forEach((check) => {
            if (check._zod && check._zod.def) {
              const def = check._zod.def;
              if (def.check === "min_length" && def.minimum !== void 0) {
                newArray = newArray.min(def.minimum);
              } else if (def.check === "max_length" && def.maximum !== void 0) {
                newArray = newArray.max(def.maximum);
              }
            }
          });
        }
      }
      types.array = newArray;
    } else if (typeof arraySchema.items === "boolean" && arraySchema.items === false) {
      if (!arraySchema.prefixItems) {
        types.array = array(any()).max(0);
      } else {
        types.array = types.array || array(any());
      }
    } else if (typeof arraySchema.items === "boolean" && arraySchema.items === true) {
      types.array = types.array || array(any());
    } else if (arraySchema.prefixItems) {
      types.array = types.array || array(any());
    }
  }
};
var TupleHandler = class {
  apply(types, schema) {
    if (schema.type !== "array") return;
    const arraySchema = schema;
    if (!Array.isArray(arraySchema.items)) return;
    if (types.array === false) return;
    const itemSchemas = arraySchema.items.map((itemSchema) => convertJsonSchemaToZod$1(itemSchema));
    let tuple$1;
    if (itemSchemas.length === 0) {
      tuple$1 = tuple([]);
    } else {
      tuple$1 = tuple(itemSchemas);
    }
    if (arraySchema.minItems !== void 0 && arraySchema.minItems > itemSchemas.length) {
      tuple$1 = false;
    }
    if (arraySchema.maxItems !== void 0 && arraySchema.maxItems < itemSchemas.length) {
      tuple$1 = false;
    }
    types.tuple = tuple$1;
    types.array = false;
  }
};
var PropertiesHandler = class {
  apply(types, schema) {
    const objectSchema = schema;
    if (types.object === false) return;
    if (objectSchema.properties || objectSchema.required || objectSchema.additionalProperties !== void 0) {
      types.object = types.object || object({}).passthrough();
    }
  }
};
var ImplicitObjectHandler = class {
  apply(types, schema) {
    const objectSchema = schema;
    if (schema.type === void 0 && (objectSchema.maxProperties !== void 0 || objectSchema.minProperties !== void 0)) {
      if (types.object === void 0) {
        types.object = object({}).passthrough();
      }
    }
  }
};
var MaxPropertiesHandler = class {
  apply(types, schema) {
    const objectSchema = schema;
    if (objectSchema.maxProperties === void 0) return;
    if (types.object !== false) {
      const baseObject = types.object || object({}).passthrough();
      types.object = baseObject.refine(
        (obj) => Object.keys(obj).length <= objectSchema.maxProperties,
        { message: `Object must have at most ${objectSchema.maxProperties} properties` }
      );
    }
  }
};
var MinPropertiesHandler = class {
  apply(types, schema) {
    const objectSchema = schema;
    if (objectSchema.minProperties === void 0) return;
    if (types.object !== false) {
      const baseObject = types.object || object({}).passthrough();
      types.object = baseObject.refine(
        (obj) => Object.keys(obj).length >= objectSchema.minProperties,
        { message: `Object must have at least ${objectSchema.minProperties} properties` }
      );
    }
  }
};

// src/core/utils.ts
function deepEqual(a, b) {
  if (a === b) return true;
  if (a == null || b == null) return a === b;
  if (typeof a !== typeof b) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((item, index) => deepEqual(item, b[index]));
  }
  if (typeof a === "object" && typeof b === "object") {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;
    return keysA.every((key) => keysB.includes(key) && deepEqual(a[key], b[key]));
  }
  return false;
}
function createUniqueItemsValidator() {
  return (value) => {
    if (!Array.isArray(value)) {
      return true;
    }
    const seen = [];
    return value.every((item) => {
      const isDuplicate = seen.some((seenItem) => deepEqual(item, seenItem));
      if (isDuplicate) {
        return false;
      }
      seen.push(item);
      return true;
    });
  };
}
function isValidWithSchema(schema, value) {
  return schema.safeParse(value).success;
}

// src/handlers/refinement/not.ts
var NotHandler = class {
  apply(zodSchema, schema) {
    if (!schema.not) return zodSchema;
    const notSchema = convertJsonSchemaToZod$1(schema.not);
    return zodSchema.refine(
      (value) => !isValidWithSchema(notSchema, value),
      { message: "Value must not match the 'not' schema" }
    );
  }
};

// src/handlers/refinement/uniqueItems.ts
var UniqueItemsHandler = class {
  apply(zodSchema, schema) {
    const arraySchema = schema;
    if (arraySchema.uniqueItems !== true) return zodSchema;
    return zodSchema.refine(createUniqueItemsValidator(), {
      message: "Array items must be unique"
    });
  }
};
var AllOfHandler = class {
  apply(zodSchema, schema) {
    if (!schema.allOf || schema.allOf.length === 0) return zodSchema;
    const allOfSchemas = schema.allOf.map((s) => convertJsonSchemaToZod$1(s));
    return allOfSchemas.reduce(
      (acc, s) => intersection(acc, s),
      zodSchema
    );
  }
};
var AnyOfHandler = class {
  apply(zodSchema, schema) {
    if (!schema.anyOf || schema.anyOf.length === 0) return zodSchema;
    const anyOfSchema = schema.anyOf.length === 1 ? convertJsonSchemaToZod$1(schema.anyOf[0]) : union([
      convertJsonSchemaToZod$1(schema.anyOf[0]),
      convertJsonSchemaToZod$1(schema.anyOf[1]),
      ...schema.anyOf.slice(2).map((s) => convertJsonSchemaToZod$1(s))
    ]);
    return intersection(zodSchema, anyOfSchema);
  }
};

// src/handlers/refinement/oneOf.ts
var OneOfHandler = class {
  apply(zodSchema, schema) {
    if (!schema.oneOf || schema.oneOf.length === 0) return zodSchema;
    const oneOfSchemas = schema.oneOf.map((s) => convertJsonSchemaToZod$1(s));
    return zodSchema.refine(
      (value) => {
        let validCount = 0;
        for (const oneOfSchema of oneOfSchemas) {
          const result = oneOfSchema.safeParse(value);
          if (result.success) {
            validCount++;
            if (validCount > 1) return false;
          }
        }
        return validCount === 1;
      },
      { message: "Value must match exactly one of the oneOf schemas" }
    );
  }
};

// src/handlers/refinement/arrayItems.ts
var PrefixItemsHandler = class {
  apply(zodSchema, schema) {
    const arraySchema = schema;
    if (arraySchema.prefixItems && Array.isArray(arraySchema.prefixItems)) {
      const prefixItems = arraySchema.prefixItems;
      const prefixSchemas = prefixItems.map((itemSchema) => convertJsonSchemaToZod$1(itemSchema));
      return zodSchema.refine(
        (value) => {
          if (!Array.isArray(value)) return true;
          for (let i = 0; i < Math.min(value.length, prefixSchemas.length); i++) {
            if (!isValidWithSchema(prefixSchemas[i], value[i])) {
              return false;
            }
          }
          if (value.length > prefixSchemas.length) {
            if (typeof arraySchema.items === "boolean" && arraySchema.items === false) {
              return false;
            } else if (arraySchema.items && typeof arraySchema.items === "object" && !Array.isArray(arraySchema.items)) {
              const additionalItemSchema = convertJsonSchemaToZod$1(arraySchema.items);
              for (let i = prefixSchemas.length; i < value.length; i++) {
                if (!isValidWithSchema(additionalItemSchema, value[i])) {
                  return false;
                }
              }
            }
          }
          return true;
        },
        { message: "Array does not match prefixItems schema" }
      );
    }
    return zodSchema;
  }
};
var ObjectPropertiesHandler = class {
  apply(zodSchema, schema) {
    const objectSchema = schema;
    if (!objectSchema.properties && !objectSchema.required && objectSchema.additionalProperties !== false) {
      return zodSchema;
    }
    if (zodSchema instanceof ZodObject || zodSchema instanceof ZodRecord) {
      const shape = {};
      if (objectSchema.properties) {
        for (const [key, propSchema] of Object.entries(objectSchema.properties)) {
          if (propSchema !== void 0) {
            shape[key] = convertJsonSchemaToZod$1(propSchema);
          }
        }
      }
      if (objectSchema.required && Array.isArray(objectSchema.required)) {
        const required = new Set(objectSchema.required);
        for (const key of Object.keys(shape)) {
          if (!required.has(key)) {
            shape[key] = shape[key].optional();
          }
        }
      } else {
        for (const key of Object.keys(shape)) {
          shape[key] = shape[key].optional();
        }
      }
      if (objectSchema.additionalProperties === false) {
        return object(shape);
      } else {
        return object(shape).passthrough();
      }
    }
    return zodSchema.refine(
      (value) => {
        if (typeof value !== "object" || value === null || Array.isArray(value)) {
          return true;
        }
        if (objectSchema.properties) {
          for (const [propName, propSchema] of Object.entries(objectSchema.properties)) {
            if (propSchema !== void 0) {
              const propExists = Object.getOwnPropertyDescriptor(value, propName) !== void 0;
              if (propExists) {
                const zodPropSchema = convertJsonSchemaToZod$1(propSchema);
                const propResult = zodPropSchema.safeParse(value[propName]);
                if (!propResult.success) {
                  return false;
                }
              }
            }
          }
        }
        if (objectSchema.required && Array.isArray(objectSchema.required)) {
          for (const requiredProp of objectSchema.required) {
            const propExists = Object.getOwnPropertyDescriptor(value, requiredProp) !== void 0;
            if (!propExists) {
              return false;
            }
          }
        }
        if (objectSchema.additionalProperties === false && objectSchema.properties) {
          const allowedProps = new Set(Object.keys(objectSchema.properties));
          for (const prop in value) {
            if (!allowedProps.has(prop)) {
              return false;
            }
          }
        }
        return true;
      },
      { message: "Object constraints validation failed" }
    );
  }
};

// src/handlers/refinement/enumComplex.ts
var EnumComplexHandler = class {
  apply(zodSchema, schema) {
    if (!schema.enum || schema.enum.length === 0) return zodSchema;
    const complexValues = schema.enum.filter(
      (v) => Array.isArray(v) || typeof v === "object" && v !== null
    );
    if (complexValues.length === 0) return zodSchema;
    return zodSchema.refine(
      (value) => {
        if (typeof value !== "object" || value === null) return true;
        return complexValues.some(
          (enumValue) => deepEqual(value, enumValue)
        );
      },
      { message: "Value must match one of the enum values" }
    );
  }
};

// src/handlers/refinement/constComplex.ts
var ConstComplexHandler = class {
  apply(zodSchema, schema) {
    if (schema.const === void 0) return zodSchema;
    const constValue = schema.const;
    if (typeof constValue !== "object" || constValue === null) {
      return zodSchema;
    }
    return zodSchema.refine(
      (value) => deepEqual(value, constValue),
      { message: "Value must equal the const value" }
    );
  }
};

// src/handlers/refinement/metadata.ts
var MetadataHandler = class {
  apply(zodSchema, schema) {
    if (schema.description) {
      zodSchema = zodSchema.describe(schema.description);
    }
    return zodSchema;
  }
};
var ProtoRequiredHandler = class {
  apply(zodSchema, schema) {
    var _a;
    const objectSchema = schema;
    if (!((_a = objectSchema.required) == null ? void 0 : _a.includes("__proto__")) || schema.type !== void 0) {
      return zodSchema;
    }
    return any().refine(
      (value) => this.validateRequired(value, objectSchema.required),
      { message: "Missing required properties" }
    );
  }
  validateRequired(value, required) {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      return true;
    }
    return required.every(
      (prop) => Object.prototype.hasOwnProperty.call(value, prop)
    );
  }
};

// src/handlers/refinement/contains.ts
var ContainsHandler = class {
  apply(zodSchema, schema) {
    var _a;
    const arraySchema = schema;
    if (arraySchema.contains === void 0) return zodSchema;
    const containsSchema = convertJsonSchemaToZod$1(arraySchema.contains);
    const minContains = (_a = arraySchema.minContains) != null ? _a : 1;
    const maxContains = arraySchema.maxContains;
    return zodSchema.refine(
      (value) => {
        if (!Array.isArray(value)) {
          return true;
        }
        let matchCount = 0;
        for (const item of value) {
          if (isValidWithSchema(containsSchema, item)) {
            matchCount++;
          }
        }
        if (matchCount < minContains) {
          return false;
        }
        if (maxContains !== void 0 && matchCount > maxContains) {
          return false;
        }
        return true;
      },
      { message: "Array must contain required items matching the schema" }
    );
  }
};

// src/handlers/refinement/default.ts
var DefaultHandler = class {
  apply(zodSchema, schema) {
    const { default: v } = schema;
    if (v === void 0) return zodSchema;
    if (!zodSchema.safeParse(v).success) {
      return zodSchema;
    }
    return zodSchema.default(v);
  }
};

// src/core/converter.ts
var primitiveHandlers = [
  // Type constraints - should run first
  new ConstHandler(),
  new EnumHandler(),
  new TypeHandler(),
  // File schema detection - must run before string constraints
  new FileHandler(),
  // Implicit type detection - must run before other constraints
  new ImplicitStringHandler(),
  new ImplicitArrayHandler(),
  new ImplicitObjectHandler(),
  // String constraints
  new MinLengthHandler(),
  new MaxLengthHandler(),
  new PatternHandler(),
  // Number constraints
  new MinimumHandler(),
  new MaximumHandler(),
  new ExclusiveMinimumHandler(),
  new ExclusiveMaximumHandler(),
  new MultipleOfHandler(),
  // Array constraints - TupleHandler must run before ItemsHandler
  new TupleHandler(),
  new MinItemsHandler(),
  new MaxItemsHandler(),
  new ItemsHandler(),
  // Object constraints
  new MaxPropertiesHandler(),
  new MinPropertiesHandler(),
  new PropertiesHandler()
];
var refinementHandlers = [
  // Handle special cases first
  new ProtoRequiredHandler(),
  new EnumComplexHandler(),
  new ConstComplexHandler(),
  // Logical combinations
  new AllOfHandler(),
  new AnyOfHandler(),
  new OneOfHandler(),
  // Type-specific refinements
  new PrefixItemsHandler(),
  new ObjectPropertiesHandler(),
  // Array refinements
  new ContainsHandler(),
  // Other refinements
  new NotHandler(),
  new UniqueItemsHandler(),
  new DefaultHandler(),
  // Metadata last
  new MetadataHandler()
];
function convertJsonSchemaToZod$1(schema) {
  if (typeof schema === "boolean") {
    return schema ? any() : never();
  }
  const types = {};
  for (const handler of primitiveHandlers) {
    handler.apply(types, schema);
  }
  const allowedSchemas = [];
  if (types.string !== false) {
    allowedSchemas.push(types.string || string());
  }
  if (types.number !== false) {
    allowedSchemas.push(types.number || number());
  }
  if (types.boolean !== false) {
    allowedSchemas.push(types.boolean || boolean());
  }
  if (types.null !== false) {
    allowedSchemas.push(types.null || _null());
  }
  if (types.array !== false) {
    allowedSchemas.push(types.array || array(any()));
  }
  if (types.tuple !== false && types.tuple !== void 0) {
    allowedSchemas.push(types.tuple);
  }
  if (types.object !== false) {
    if (types.object) {
      allowedSchemas.push(types.object);
    } else {
      const objectSchema = custom((val) => {
        return typeof val === "object" && val !== null && !Array.isArray(val);
      }, "Must be an object, not an array");
      allowedSchemas.push(objectSchema);
    }
  }
  if (types.file !== false && types.file !== void 0) {
    allowedSchemas.push(types.file);
  }
  let zodSchema;
  if (allowedSchemas.length === 0) {
    zodSchema = never();
  } else if (allowedSchemas.length === 1) {
    zodSchema = allowedSchemas[0];
  } else {
    const hasConstraints = Object.keys(schema).some(
      (key) => key !== "$schema" && key !== "title" && key !== "description"
    );
    if (!hasConstraints) {
      zodSchema = any();
    } else {
      zodSchema = union(allowedSchemas);
    }
  }
  for (const handler of refinementHandlers) {
    zodSchema = handler.apply(zodSchema, schema);
  }
  return zodSchema;
}

// src/index.ts
function convertJsonSchemaToZod(schema) {
  function addMetadata(zodSchema, jsonSchema) {
    if (jsonSchema.description) {
      zodSchema = zodSchema.describe(jsonSchema.description);
    }
    return zodSchema;
  }
  if (schema.const !== void 0) {
    if (typeof schema.const === "string") {
      return addMetadata(literalType(schema.const), schema);
    } else if (typeof schema.const === "number") {
      return addMetadata(literalType(schema.const), schema);
    } else if (typeof schema.const === "boolean") {
      return addMetadata(literalType(schema.const), schema);
    } else if (schema.const === null) {
      return addMetadata(nullType(), schema);
    }
    return addMetadata(literalType(schema.const), schema);
  }
  if (schema.type) {
    switch (schema.type) {
      case "string": {
        if (schema.enum) {
          if (schema.enum.length === 0) {
            return addMetadata(stringType(), schema);
          }
          return addMetadata(enumType(schema.enum), schema);
        }
        let stringSchema = stringType();
        if (schema.minLength !== void 0) {
          stringSchema = stringSchema.min(schema.minLength);
        }
        if (schema.maxLength !== void 0) {
          stringSchema = stringSchema.max(schema.maxLength);
        }
        if (schema.pattern !== void 0) {
          const regex = new RegExp(schema.pattern);
          stringSchema = stringSchema.regex(regex);
        }
        return addMetadata(stringSchema, schema);
      }
      case "number":
      case "integer": {
        if (schema.enum) {
          if (schema.enum.length === 0) {
            return addMetadata(numberType(), schema);
          }
          const options = schema.enum.map((val) => literalType(val));
          if (options.length === 1) {
            return addMetadata(options[0], schema);
          }
          if (options.length >= 2) {
            const unionSchema = unionType([options[0], options[1], ...options.slice(2)]);
            return addMetadata(unionSchema, schema);
          }
        }
        let numberSchema = schema.type === "integer" ? numberType().int() : numberType();
        if (schema.minimum !== void 0) {
          numberSchema = numberSchema.min(schema.minimum);
        }
        if (schema.maximum !== void 0) {
          numberSchema = numberSchema.max(schema.maximum);
        }
        if (schema.exclusiveMinimum !== void 0) {
          numberSchema = numberSchema.gt(schema.exclusiveMinimum);
        }
        if (schema.exclusiveMaximum !== void 0) {
          numberSchema = numberSchema.lt(schema.exclusiveMaximum);
        }
        if (schema.multipleOf !== void 0) {
          numberSchema = numberSchema.multipleOf(schema.multipleOf);
        }
        return addMetadata(numberSchema, schema);
      }
      case "boolean":
        if (schema.enum) {
          if (schema.enum.length === 0) {
            return addMetadata(booleanType(), schema);
          }
          const options = schema.enum.map((val) => literalType(val));
          if (options.length === 1) {
            return addMetadata(options[0], schema);
          }
          if (options.length >= 2) {
            const unionSchema = unionType([options[0], options[1], ...options.slice(2)]);
            return addMetadata(unionSchema, schema);
          }
        }
        return addMetadata(booleanType(), schema);
      case "null":
        return addMetadata(nullType(), schema);
      case "object":
        if (schema.properties) {
          const shape = {};
          for (const [key, propSchema] of Object.entries(
            schema.properties
          )) {
            shape[key] = convertJsonSchemaToZod(propSchema);
          }
          if (schema.required && Array.isArray(schema.required)) {
            const required = new Set(schema.required);
            for (const key of Object.keys(shape)) {
              if (!required.has(key)) {
                shape[key] = shape[key].optional();
              }
            }
          } else {
            for (const key of Object.keys(shape)) {
              shape[key] = shape[key].optional();
            }
          }
          let zodSchema;
          if (schema.additionalProperties !== false) {
            zodSchema = objectType(shape).passthrough();
          } else {
            zodSchema = objectType(shape);
          }
          return addMetadata(zodSchema, schema);
        }
        return addMetadata(objectType({}), schema);
      case "array": {
        let arraySchema;
        if (schema.items) {
          arraySchema = arrayType(convertJsonSchemaToZod(schema.items));
        } else {
          arraySchema = arrayType(anyType());
        }
        if (schema.minItems !== void 0) {
          arraySchema = arraySchema.min(schema.minItems);
        }
        if (schema.maxItems !== void 0) {
          arraySchema = arraySchema.max(schema.maxItems);
        }
        if (schema.uniqueItems === true) {
          arraySchema = arraySchema.refine(
            (items) => {
              const seen = /* @__PURE__ */ new Set();
              return items.every((item) => {
                if (typeof item === "string" || typeof item === "number" || typeof item === "boolean") {
                  if (seen.has(item)) return false;
                  seen.add(item);
                  return true;
                }
                const serialized = JSON.stringify(item);
                if (seen.has(serialized)) return false;
                seen.add(serialized);
                return true;
              });
            },
            { message: "Array items must be unique" }
          );
        }
        return addMetadata(arraySchema, schema);
      }
    }
  }
  if (schema.enum) {
    if (schema.enum.length === 0) {
      return addMetadata(neverType(), schema);
    }
    const allStrings = schema.enum.every((val) => typeof val === "string");
    if (allStrings) {
      return addMetadata(enumType(schema.enum), schema);
    } else {
      const options = schema.enum.map((val) => literalType(val));
      if (options.length === 1) {
        return addMetadata(options[0], schema);
      }
      if (options.length >= 2) {
        const unionSchema = unionType([options[0], options[1], ...options.slice(2)]);
        return addMetadata(unionSchema, schema);
      }
    }
  }
  if (schema.anyOf && schema.anyOf.length >= 2) {
    const schemas = schema.anyOf.map(convertJsonSchemaToZod);
    return addMetadata(
      unionType([schemas[0], schemas[1], ...schemas.slice(2)]),
      schema
    );
  }
  if (schema.allOf) {
    return addMetadata(
      schema.allOf.reduce(
        (acc, s) => intersectionType(acc, convertJsonSchemaToZod(s)),
        objectType({})
      ),
      schema
    );
  }
  if (schema.oneOf && schema.oneOf.length >= 2) {
    const schemas = schema.oneOf.map(convertJsonSchemaToZod);
    return addMetadata(
      unionType([schemas[0], schemas[1], ...schemas.slice(2)]),
      schema
    );
  }
  return addMetadata(anyType(), schema);
}

function convertZodSchemaToAISDKSchema(zodSchema, target = "jsonSchema7") {
  const jsonSchemaToUse = zodToJsonSchema(zodSchema, target);
  return jsonSchema(jsonSchemaToUse, {
    validate: (value) => {
      const result = zodSchema.safeParse(value);
      return result.success ? { success: true, value: result.data } : { success: false, error: result.error };
    }
  });
}
function isZodType$1(value) {
  return typeof value === "object" && value !== null && "_def" in value && "parse" in value && typeof value.parse === "function" && "safeParse" in value && typeof value.safeParse === "function";
}
function convertSchemaToZod(schema) {
  if (isZodType$1(schema)) {
    return schema;
  } else {
    const jsonSchemaToConvert = "jsonSchema" in schema ? schema.jsonSchema : schema;
    try {
      if (false) ; else {
        return convertJsonSchemaToZod(jsonSchemaToConvert);
      }
    } catch (e) {
      const errorMessage = `[Schema Builder] Failed to convert schema parameters to Zod. Original schema: ${JSON.stringify(jsonSchemaToConvert)}`;
      console.error(errorMessage, e);
      throw new Error(errorMessage + (e instanceof Error ? `
${e.stack}` : "\nUnknown error object"));
    }
  }
}
function applyCompatLayer({
  schema,
  compatLayers,
  mode
}) {
  let zodSchema;
  if (!isZodType$1(schema)) {
    zodSchema = convertSchemaToZod(schema);
  } else {
    zodSchema = schema;
  }
  for (const compat of compatLayers) {
    if (compat.shouldApply()) {
      return mode === "jsonSchema" ? compat.processToJSONSchema(zodSchema) : compat.processToAISDKSchema(zodSchema);
    }
  }
  {
    return convertZodSchemaToAISDKSchema(zodSchema);
  }
}

// src/schema-compatibility-v3.ts
var ALL_STRING_CHECKS = ["regex", "emoji", "email", "url", "uuid", "cuid", "min", "max"];
var ALL_NUMBER_CHECKS = [
  "min",
  // gte internally
  "max",
  // lte internally
  "multipleOf"
];
var ALL_ARRAY_CHECKS = ["min", "max", "length"];
var UNSUPPORTED_ZOD_TYPES = ["ZodIntersection", "ZodNever", "ZodNull", "ZodTuple", "ZodUndefined"];
var SUPPORTED_ZOD_TYPES = [
  "ZodObject",
  "ZodArray",
  "ZodUnion",
  "ZodString",
  "ZodNumber",
  "ZodDate",
  "ZodAny",
  "ZodDefault",
  "ZodNullable"
];
[...SUPPORTED_ZOD_TYPES, ...UNSUPPORTED_ZOD_TYPES];
var SchemaCompatLayer = class {
  model;
  parent;
  /**
   * Creates a new schema compatibility instance.
   *
   * @param model - The language model this compatibility layer applies to
   */
  constructor(model, parent) {
    this.model = model;
    this.parent = parent;
  }
  /**
   * Gets the language model associated with this compatibility layer.
   *
   * @returns The language model instance
   */
  getModel() {
    return this.model;
  }
  getUnsupportedZodTypes() {
    return UNSUPPORTED_ZOD_TYPES;
  }
  /**
   * Type guard for optional Zod types
   */
  isOptional(v) {
    return v instanceof ZodOptional$1;
  }
  /**
   * Type guard for object Zod types
   */
  isObj(v) {
    return v instanceof ZodObject$1;
  }
  /**
   * Type guard for null Zod types
   */
  isNull(v) {
    return v instanceof ZodNull$1;
  }
  /**
   * Type guard for array Zod types
   */
  isArr(v) {
    return v instanceof ZodArray$1;
  }
  /**
   * Type guard for union Zod types
   */
  isUnion(v) {
    return v instanceof ZodUnion$1;
  }
  /**
   * Type guard for string Zod types
   */
  isString(v) {
    return v instanceof ZodString$1;
  }
  /**
   * Type guard for number Zod types
   */
  isNumber(v) {
    return v instanceof ZodNumber$1;
  }
  /**
   * Type guard for date Zod types
   */
  isDate(v) {
    return v instanceof ZodDate;
  }
  /**
   * Type guard for default Zod types
   */
  isDefault(v) {
    return v instanceof ZodDefault$1;
  }
  /**
   * Determines whether this compatibility layer should be applied for the current model.
   *
   * @returns True if this compatibility layer should be used, false otherwise
   * @abstract
   */
  shouldApply() {
    return this.parent.shouldApply();
  }
  /**
   * Returns the JSON Schema target format for this provider.
   *
   * @returns The schema target format, or undefined to use the default 'jsonSchema7'
   * @abstract
   */
  getSchemaTarget() {
    return this.parent.getSchemaTarget();
  }
  /**
   * Processes a specific Zod type according to the provider's requirements.
   *
   * @param value - The Zod type to process
   * @returns The processed Zod type
   * @abstract
   */
  processZodType(value) {
    return this.parent.processZodType(value);
  }
  /**
   * Default handler for Zod object types. Recursively processes all properties in the object.
   *
   * @param value - The Zod object to process
   * @returns The processed Zod object
   */
  defaultZodObjectHandler(value, options = { passthrough: true }) {
    const processedShape = Object.entries(value.shape).reduce((acc, [key, propValue]) => {
      acc[key] = this.processZodType(propValue);
      return acc;
    }, {});
    let result = objectType(processedShape);
    if (value._def.unknownKeys === "strict") {
      result = result.strict();
    }
    if (value._def.catchall && !(value._def.catchall instanceof ZodNever$1)) {
      result = result.catchall(value._def.catchall);
    }
    if (value.description) {
      result = result.describe(value.description);
    }
    if (options.passthrough && value._def.unknownKeys === "passthrough") {
      result = result.passthrough();
    }
    return result;
  }
  /**
   * Merges validation constraints into a parameter description.
   *
   * This helper method converts validation constraints that may not be supported
   * by a provider into human-readable descriptions.
   *
   * @param description - The existing parameter description
   * @param constraints - The validation constraints to merge
   * @returns The updated description with constraints, or undefined if no constraints
   */
  mergeParameterDescription(description, constraints) {
    if (constraints.length > 0) {
      return (description ? description + "\n" : "") + `constraints: ${constraints.join(`, `)}`;
    } else {
      return description;
    }
  }
  /**
   * Default handler for unsupported Zod types. Throws an error for specified unsupported types.
   *
   * @param value - The Zod type to check
   * @param throwOnTypes - Array of type names to throw errors for
   * @returns The original value if not in the throw list
   * @throws Error if the type is in the unsupported list
   */
  defaultUnsupportedZodTypeHandler(value, throwOnTypes = UNSUPPORTED_ZOD_TYPES) {
    if (throwOnTypes.includes(value._def?.typeName)) {
      throw new Error(`${this.model.modelId} does not support zod type: ${value._def?.typeName}`);
    }
    return value;
  }
  /**
   * Default handler for Zod array types. Processes array constraints according to provider support.
   *
   * @param value - The Zod array to process
   * @param handleChecks - Array constraints to convert to descriptions vs keep as validation
   * @returns The processed Zod array
   */
  defaultZodArrayHandler(value, handleChecks = ALL_ARRAY_CHECKS) {
    const zodArrayDef = value._def;
    const processedType = this.processZodType(zodArrayDef.type);
    let result = arrayType(processedType);
    const constraints = [];
    if (zodArrayDef.minLength?.value !== void 0) {
      if (handleChecks.includes("min")) {
        constraints.push(`minimum length ${zodArrayDef.minLength.value}`);
      } else {
        result = result.min(zodArrayDef.minLength.value);
      }
    }
    if (zodArrayDef.maxLength?.value !== void 0) {
      if (handleChecks.includes("max")) {
        constraints.push(`maximum length ${zodArrayDef.maxLength.value}`);
      } else {
        result = result.max(zodArrayDef.maxLength.value);
      }
    }
    if (zodArrayDef.exactLength?.value !== void 0) {
      if (handleChecks.includes("length")) {
        constraints.push(`exact length ${zodArrayDef.exactLength.value}`);
      } else {
        result = result.length(zodArrayDef.exactLength.value);
      }
    }
    const description = this.mergeParameterDescription(value.description, constraints);
    if (description) {
      result = result.describe(description);
    }
    return result;
  }
  /**
   * Default handler for Zod union types. Processes all union options.
   *
   * @param value - The Zod union to process
   * @returns The processed Zod union
   * @throws Error if union has fewer than 2 options
   */
  defaultZodUnionHandler(value) {
    const processedOptions = value._def.options.map((option) => this.processZodType(option));
    if (processedOptions.length < 2) throw new Error("Union must have at least 2 options");
    let result = unionType(processedOptions);
    if (value.description) {
      result = result.describe(value.description);
    }
    return result;
  }
  /**
   * Default handler for Zod string types. Processes string validation constraints.
   *
   * @param value - The Zod string to process
   * @param handleChecks - String constraints to convert to descriptions vs keep as validation
   * @returns The processed Zod string
   */
  defaultZodStringHandler(value, handleChecks = ALL_STRING_CHECKS) {
    const constraints = [];
    const checks = value._def.checks || [];
    const newChecks = [];
    for (const check of checks) {
      if ("kind" in check) {
        if (handleChecks.includes(check.kind)) {
          switch (check.kind) {
            case "regex": {
              constraints.push(`input must match this regex ${check.regex.source}`);
              break;
            }
            case "emoji":
            case "email":
            case "url":
            case "uuid":
            case "cuid": {
              constraints.push(`a valid ${check.kind}`);
              break;
            }
            case "min":
            case "max": {
              constraints.push(`${check.kind}imum length ${check.value}`);
              break;
            }
          }
        } else {
          newChecks.push(check);
        }
      }
    }
    let result = stringType();
    for (const check of newChecks) {
      result = result._addCheck(check);
    }
    const description = this.mergeParameterDescription(value.description, constraints);
    if (description) {
      result = result.describe(description);
    }
    return result;
  }
  /**
   * Default handler for Zod number types. Processes number validation constraints.
   *
   * @param value - The Zod number to process
   * @param handleChecks - Number constraints to convert to descriptions vs keep as validation
   * @returns The processed Zod number
   */
  defaultZodNumberHandler(value, handleChecks = ALL_NUMBER_CHECKS) {
    const constraints = [];
    const checks = value._def.checks || [];
    const newChecks = [];
    for (const check of checks) {
      if ("kind" in check) {
        if (handleChecks.includes(check.kind)) {
          switch (check.kind) {
            case "min":
              if (check.inclusive) {
                constraints.push(`greater than or equal to ${check.value}`);
              } else {
                constraints.push(`greater than ${check.value}`);
              }
              break;
            case "max":
              if (check.inclusive) {
                constraints.push(`lower than or equal to ${check.value}`);
              } else {
                constraints.push(`lower than ${check.value}`);
              }
              break;
            case "multipleOf": {
              constraints.push(`multiple of ${check.value}`);
              break;
            }
          }
        } else {
          newChecks.push(check);
        }
      }
    }
    let result = numberType();
    for (const check of newChecks) {
      switch (check.kind) {
        case "int":
          result = result.int();
          break;
        case "finite":
          result = result.finite();
          break;
        default:
          result = result._addCheck(check);
      }
    }
    const description = this.mergeParameterDescription(value.description, constraints);
    if (description) {
      result = result.describe(description);
    }
    return result;
  }
  /**
   * Default handler for Zod date types. Converts dates to ISO strings with constraint descriptions.
   *
   * @param value - The Zod date to process
   * @returns A Zod string schema representing the date in ISO format
   */
  defaultZodDateHandler(value) {
    const constraints = [];
    const checks = value._def.checks || [];
    for (const check of checks) {
      if ("kind" in check) {
        switch (check.kind) {
          case "min":
            const minDate = new Date(check.value);
            if (!isNaN(minDate.getTime())) {
              constraints.push(`Date must be newer than ${minDate.toISOString()} (ISO)`);
            }
            break;
          case "max":
            const maxDate = new Date(check.value);
            if (!isNaN(maxDate.getTime())) {
              constraints.push(`Date must be older than ${maxDate.toISOString()} (ISO)`);
            }
            break;
        }
      }
    }
    constraints.push(`Date format is date-time`);
    let result = stringType().describe("date-time");
    const description = this.mergeParameterDescription(value.description, constraints);
    if (description) {
      result = result.describe(description);
    }
    return result;
  }
  /**
   * Default handler for Zod optional types. Processes the inner type and maintains optionality.
   *
   * @param value - The Zod optional to process
   * @param handleTypes - Types that should be processed vs passed through
   * @returns The processed Zod optional
   */
  defaultZodOptionalHandler(value, handleTypes = SUPPORTED_ZOD_TYPES) {
    if (handleTypes.includes(value._def.innerType._def.typeName)) {
      return this.processZodType(value._def.innerType).optional();
    } else {
      return value;
    }
  }
  /**
   * Processes a Zod object schema and converts it to an AI SDK Schema.
   *
   * @param zodSchema - The Zod object schema to process
   * @returns An AI SDK Schema with provider-specific compatibility applied
   */
  processToAISDKSchema(zodSchema) {
    const processedSchema = this.processZodType(zodSchema);
    return convertZodSchemaToAISDKSchema(processedSchema, this.getSchemaTarget());
  }
  /**
   * Processes a Zod object schema and converts it to a JSON Schema.
   *
   * @param zodSchema - The Zod object schema to process
   * @returns A JSONSchema7 object with provider-specific compatibility applied
   */
  processToJSONSchema(zodSchema) {
    return this.processToAISDKSchema(zodSchema).jsonSchema;
  }
};
var ALL_STRING_CHECKS2 = [
  "regex",
  "emoji",
  "email",
  "url",
  "uuid",
  "cuid",
  "min_length",
  "max_length",
  "string_format"
];
var ALL_NUMBER_CHECKS2 = ["greater_than", "less_than", "multiple_of"];
var ALL_ARRAY_CHECKS2 = ["min", "max", "length"];
var UNSUPPORTED_ZOD_TYPES2 = ["ZodIntersection", "ZodNever", "ZodNull", "ZodTuple", "ZodUndefined"];
var SUPPORTED_ZOD_TYPES2 = [
  "ZodObject",
  "ZodArray",
  "ZodUnion",
  "ZodString",
  "ZodNumber",
  "ZodDate",
  "ZodAny",
  "ZodDefault",
  "ZodNullable"
];
var SchemaCompatLayer2 = class {
  model;
  parent;
  /**
   * Creates a new schema compatibility instance.
   *
   * @param model - The language model this compatibility layer applies to
   */
  constructor(model, parent) {
    this.model = model;
    this.parent = parent;
  }
  /**
   * Gets the language model associated with this compatibility layer.
   *
   * @returns The language model instance
   */
  getModel() {
    return this.model;
  }
  getUnsupportedZodTypes() {
    return UNSUPPORTED_ZOD_TYPES2;
  }
  /**
   * Type guard for optional Zod types
   */
  isOptional(v) {
    return v instanceof ZodOptional$2;
  }
  /**
   * Type guard for object Zod types
   */
  isObj(v) {
    return v instanceof ZodObject$2;
  }
  /**
   * Type guard for null Zod types
   */
  isNull(v) {
    return v instanceof ZodNull$2;
  }
  /**
   * Type guard for nullable Zod types
   */
  isNullable(v) {
    return v instanceof ZodNullable$1;
  }
  /**
   * Type guard for array Zod types
   */
  isArr(v) {
    return v instanceof ZodArray$2;
  }
  /**
   * Type guard for union Zod types
   */
  isUnion(v) {
    return v instanceof ZodUnion$2;
  }
  /**
   * Type guard for string Zod types
   */
  isString(v) {
    return v instanceof ZodString$2;
  }
  /**
   * Type guard for number Zod types
   */
  isNumber(v) {
    return v instanceof ZodNumber$2;
  }
  /**
   * Type guard for date Zod types
   */
  isDate(v) {
    return v instanceof ZodDate$1;
  }
  /**
   * Type guard for default Zod types
   */
  isDefault(v) {
    return v instanceof ZodDefault$2;
  }
  /**
   * Determines whether this compatibility layer should be applied for the current model.
   *
   * @returns True if this compatibility layer should be used, false otherwise
   * @abstract
   */
  shouldApply() {
    return this.parent.shouldApply();
  }
  /**
   * Returns the JSON Schema target format for this provider.
   *
   * @returns The schema target format, or undefined to use the default 'jsonSchema7'
   * @abstract
   */
  getSchemaTarget() {
    return this.parent.getSchemaTarget();
  }
  /**
   * Processes a specific Zod type according to the provider's requirements.
   *
   * @param value - The Zod type to process
   * @returns The processed Zod type
   * @abstract
   */
  processZodType(value) {
    return this.parent.processZodType(value);
  }
  /**
   * Default handler for Zod object types. Recursively processes all properties in the object.
   *
   * @param value - The Zod object to process
   * @returns The processed Zod object
   */
  defaultZodObjectHandler(value, options = { passthrough: true }) {
    const processedShape = Object.entries(value.shape).reduce((acc, [key, propValue]) => {
      acc[key] = this.processZodType(propValue);
      return acc;
    }, {});
    let result = object$2(processedShape);
    if (value._zod.def.catchall instanceof ZodNever$2) {
      result = strictObject(processedShape);
    }
    if (value._zod.def.catchall && !(value._zod.def.catchall instanceof ZodNever$2)) {
      result = result.catchall(value._zod.def.catchall);
    }
    if (value.description) {
      result = result.describe(value.description);
    }
    if (options.passthrough && value._zod.def.catchall instanceof ZodUnknown$1) {
      result = looseObject(processedShape);
    }
    return result;
  }
  /**
   * Merges validation constraints into a parameter description.
   *
   * This helper method converts validation constraints that may not be supported
   * by a provider into human-readable descriptions.
   *
   * @param description - The existing parameter description
   * @param constraints - The validation constraints to merge
   * @returns The updated description with constraints, or undefined if no constraints
   */
  mergeParameterDescription(description, constraints) {
    if (constraints.length > 0) {
      return (description ? description + "\n" : "") + `constraints: ${constraints.join(`, `)}`;
    } else {
      return description;
    }
  }
  /**
   * Default handler for unsupported Zod types. Throws an error for specified unsupported types.
   *
   * @param value - The Zod type to check
   * @param throwOnTypes - Array of type names to throw errors for
   * @returns The original value if not in the throw list
   * @throws Error if the type is in the unsupported list
   */
  defaultUnsupportedZodTypeHandler(value, throwOnTypes = UNSUPPORTED_ZOD_TYPES2) {
    if (throwOnTypes.includes(value.constructor.name)) {
      throw new Error(`${this.model.modelId} does not support zod type: ${value.constructor.name}`);
    }
    return value;
  }
  /**
   * Default handler for Zod array types. Processes array constraints according to provider support.
   *
   * @param value - The Zod array to process
   * @param handleChecks - Array constraints to convert to descriptions vs keep as validation
   * @returns The processed Zod array
   */
  defaultZodArrayHandler(value, handleChecks = ALL_ARRAY_CHECKS2) {
    const zodArrayDef = value._zod.def;
    const processedType = this.processZodType(zodArrayDef.element);
    let result = array$1(processedType);
    const constraints = [];
    if (zodArrayDef.checks) {
      for (const check of zodArrayDef.checks) {
        if (check._zod.def.check === "min_length") {
          if (handleChecks.includes("min")) {
            constraints.push(`minimum length ${check._zod.def.minimum}`);
          } else {
            result = result.min(check._zod.def.minimum);
          }
        }
        if (check._zod.def.check === "max_length") {
          if (handleChecks.includes("max")) {
            constraints.push(`maximum length ${check._zod.def.maximum}`);
          } else {
            result = result.max(check._zod.def.maximum);
          }
        }
        if (check._zod.def.check === "length_equals") {
          if (handleChecks.includes("length")) {
            constraints.push(`exact length ${check._zod.def.length}`);
          } else {
            result = result.length(check._zod.def.length);
          }
        }
      }
    }
    const metaDescription = value.meta()?.description;
    const legacyDescription = value.description;
    const description = this.mergeParameterDescription(metaDescription || legacyDescription, constraints);
    if (description) {
      result = result.describe(description);
    }
    return result;
  }
  /**
   * Default handler for Zod union types. Processes all union options.
   *
   * @param value - The Zod union to process
   * @returns The processed Zod union
   * @throws Error if union has fewer than 2 options
   */
  defaultZodUnionHandler(value) {
    const processedOptions = value._zod.def.options.map((option) => this.processZodType(option));
    if (processedOptions.length < 2) throw new Error("Union must have at least 2 options");
    let result = union$1(processedOptions);
    if (value.description) {
      result = result.describe(value.description);
    }
    return result;
  }
  /**
   * Default handler for Zod string types. Processes string validation constraints.
   *
   * @param value - The Zod string to process
   * @param handleChecks - String constraints to convert to descriptions vs keep as validation
   * @returns The processed Zod string
   */
  defaultZodStringHandler(value, handleChecks = ALL_STRING_CHECKS2) {
    const constraints = [];
    const checks = value._zod.def.checks || [];
    const newChecks = [];
    if (checks) {
      for (const check of checks) {
        if (handleChecks.includes(check._zod.def.check)) {
          switch (check._zod.def.check) {
            case "min_length":
              constraints.push(`minimum length ${check._zod.def.minimum}`);
              break;
            case "max_length":
              constraints.push(`maximum length ${check._zod.def.maximum}`);
              break;
            case "string_format":
              {
                switch (check._zod.def.format) {
                  case "email":
                  case "url":
                  case "emoji":
                  case "uuid":
                  case "cuid":
                    constraints.push(`a valid ${check._zod.def.format}`);
                    break;
                  case "regex":
                    constraints.push(`input must match this regex ${check._zod.def.pattern}`);
                    break;
                }
              }
              break;
          }
        } else {
          newChecks.push(check);
        }
      }
    }
    let result = string$2();
    for (const check of newChecks) {
      result = result.check(check);
    }
    const metaDescription = value.meta()?.description;
    const legacyDescription = value.description;
    const description = this.mergeParameterDescription(metaDescription || legacyDescription, constraints);
    if (description) {
      result = result.describe(description);
    }
    return result;
  }
  /**
   * Default handler for Zod number types. Processes number validation constraints.
   *
   * @param value - The Zod number to process
   * @param handleChecks - Number constraints to convert to descriptions vs keep as validation
   * @returns The processed Zod number
   */
  defaultZodNumberHandler(value, handleChecks = ALL_NUMBER_CHECKS2) {
    const constraints = [];
    const checks = value._zod.def.checks || [];
    const newChecks = [];
    if (checks) {
      for (const check of checks) {
        if (handleChecks.includes(check._zod.def.check)) {
          switch (check._zod.def.check) {
            case "greater_than":
              if (check._zod.def.inclusive) {
                constraints.push(`greater than or equal to ${check._zod.def.value}`);
              } else {
                constraints.push(`greater than ${check._zod.def.value}`);
              }
              break;
            case "less_than":
              if (check._zod.def.inclusive) {
                constraints.push(`lower than or equal to ${check._zod.def.value}`);
              } else {
                constraints.push(`lower than ${check._zod.def.value}`);
              }
              break;
            case "multiple_of": {
              constraints.push(`multiple of ${check._zod.def.value}`);
              break;
            }
          }
        } else {
          newChecks.push(check);
        }
      }
    }
    let result = number$2();
    for (const check of newChecks) {
      switch (check._zod.def.check) {
        case "number_format": {
          switch (check._zod.def.format) {
            case "safeint":
              result = result.int();
              break;
          }
          break;
        }
        default:
          result = result.check(check);
      }
    }
    const description = this.mergeParameterDescription(value.description, constraints);
    if (description) {
      result = result.describe(description);
    }
    return result;
  }
  /**
   * Default handler for Zod date types. Converts dates to ISO strings with constraint descriptions.
   *
   * @param value - The Zod date to process
   * @returns A Zod string schema representing the date in ISO format
   */
  defaultZodDateHandler(value) {
    const constraints = [];
    const checks = value._zod.def.checks || [];
    if (checks) {
      for (const check of checks) {
        switch (check._zod.def.check) {
          case "less_than":
            const minDate = new Date(check._zod.def.value);
            if (!isNaN(minDate.getTime())) {
              constraints.push(`Date must be newer than ${minDate.toISOString()} (ISO)`);
            }
            break;
          case "greater_than":
            const maxDate = new Date(check._zod.def.value);
            if (!isNaN(maxDate.getTime())) {
              constraints.push(`Date must be older than ${maxDate.toISOString()} (ISO)`);
            }
            break;
        }
      }
    }
    constraints.push(`Date format is date-time`);
    let result = string$2().describe("date-time");
    const description = this.mergeParameterDescription(value.description, constraints);
    if (description) {
      result = result.describe(description);
    }
    return result;
  }
  /**
   * Default handler for Zod optional types. Processes the inner type and maintains optionality.
   *
   * @param value - The Zod optional to process
   * @param handleTypes - Types that should be processed vs passed through
   * @returns The processed Zod optional
   */
  defaultZodOptionalHandler(value, handleTypes = SUPPORTED_ZOD_TYPES2) {
    if (handleTypes.includes(value.constructor.name)) {
      return this.processZodType(value._zod.def.innerType).optional();
    } else {
      return value;
    }
  }
  /**
   * Processes a Zod object schema and converts it to an AI SDK Schema.
   *
   * @param zodSchema - The Zod object schema to process
   * @returns An AI SDK Schema with provider-specific compatibility applied
   */
  processToAISDKSchema(zodSchema) {
    const processedSchema = this.processZodType(zodSchema);
    return convertZodSchemaToAISDKSchema(processedSchema, this.getSchemaTarget());
  }
  /**
   * Processes a Zod object schema and converts it to a JSON Schema.
   *
   * @param zodSchema - The Zod object schema to process
   * @returns A JSONSchema7 object with provider-specific compatibility applied
   */
  processToJSONSchema(zodSchema) {
    return this.processToAISDKSchema(zodSchema).jsonSchema;
  }
};

// src/schema-compatibility.ts
var SchemaCompatLayer3 = class {
  model;
  v3Layer;
  v4Layer;
  /**
   * Creates a new schema compatibility instance.
   *
   * @param model - The language model this compatibility layer applies to
   */
  constructor(model) {
    this.model = model;
    this.v3Layer = new SchemaCompatLayer(model, this);
    this.v4Layer = new SchemaCompatLayer2(model, this);
  }
  /**
   * Gets the language model associated with this compatibility layer.
   *
   * @returns The language model instance
   */
  getModel() {
    return this.model;
  }
  getUnsupportedZodTypes(v) {
    if ("_zod" in v) {
      return this.v4Layer.getUnsupportedZodTypes();
    } else {
      return this.v3Layer.getUnsupportedZodTypes();
    }
  }
  isOptional(v) {
    if ("_zod" in v) {
      return this.v4Layer.isOptional(v);
    } else {
      return this.v3Layer.isOptional(v);
    }
  }
  isObj(v) {
    if ("_zod" in v) {
      return this.v4Layer.isObj(v);
    } else {
      return this.v3Layer.isObj(v);
    }
  }
  isNull(v) {
    if ("_zod" in v) {
      return this.v4Layer.isNull(v);
    } else {
      return this.v3Layer.isNull(v);
    }
  }
  isArr(v) {
    if ("_zod" in v) {
      return this.v4Layer.isArr(v);
    } else {
      return this.v3Layer.isArr(v);
    }
  }
  isUnion(v) {
    if ("_zod" in v) {
      return this.v4Layer.isUnion(v);
    } else {
      return this.v3Layer.isUnion(v);
    }
  }
  isString(v) {
    if ("_zod" in v) {
      return this.v4Layer.isString(v);
    } else {
      return this.v3Layer.isString(v);
    }
  }
  isNumber(v) {
    if ("_zod" in v) {
      return this.v4Layer.isNumber(v);
    } else {
      return this.v3Layer.isNumber(v);
    }
  }
  isDate(v) {
    if ("_zod" in v) {
      return this.v4Layer.isDate(v);
    } else {
      return this.v3Layer.isDate(v);
    }
  }
  isDefault(v) {
    if ("_zod" in v) {
      return this.v4Layer.isDefault(v);
    } else {
      return this.v3Layer.isDefault(v);
    }
  }
  defaultZodObjectHandler(value, options = { passthrough: true }) {
    if ("_zod" in value) {
      return this.v4Layer.defaultZodObjectHandler(value, options);
    } else {
      return this.v3Layer.defaultZodObjectHandler(value, options);
    }
  }
  /**
   * Merges validation constraints into a parameter description.
   *
   * This helper method converts validation constraints that may not be supported
   * by a provider into human-readable descriptions.
   *
   * @param description - The existing parameter description
   * @param constraints - The validation constraints to merge
   * @returns The updated description with constraints, or undefined if no constraints
   */
  mergeParameterDescription(description, constraints) {
    return this.v3Layer.mergeParameterDescription(description, constraints);
  }
  /**
   * Default handler for unsupported Zod types. Throws an error for specified unsupported types.
   *
   * @param value - The Zod type to check
   * @param throwOnTypes - Array of type names to throw errors for
   * @returns The original value if not in the throw list
   * @throws Error if the type is in the unsupported list
   */
  defaultUnsupportedZodTypeHandler(value, throwOnTypes) {
    if ("_zod" in value) {
      return this.v4Layer.defaultUnsupportedZodTypeHandler(
        // @ts-expect-error - fix later
        value,
        throwOnTypes ?? UNSUPPORTED_ZOD_TYPES2
      );
    } else {
      return this.v3Layer.defaultUnsupportedZodTypeHandler(
        value,
        throwOnTypes ?? UNSUPPORTED_ZOD_TYPES
      );
    }
  }
  defaultZodArrayHandler(value, handleChecks = ALL_ARRAY_CHECKS) {
    if ("_zod" in value) {
      return this.v4Layer.defaultZodArrayHandler(value, handleChecks);
    } else {
      return this.v3Layer.defaultZodArrayHandler(value, handleChecks);
    }
  }
  defaultZodUnionHandler(value) {
    if ("_zod" in value) {
      return this.v4Layer.defaultZodUnionHandler(value);
    } else {
      return this.v3Layer.defaultZodUnionHandler(value);
    }
  }
  defaultZodStringHandler(value, handleChecks = ALL_STRING_CHECKS) {
    if ("_zod" in value) {
      return this.v4Layer.defaultZodStringHandler(value);
    } else {
      return this.v3Layer.defaultZodStringHandler(value, handleChecks);
    }
  }
  defaultZodNumberHandler(value, handleChecks = ALL_NUMBER_CHECKS) {
    if ("_zod" in value) {
      return this.v4Layer.defaultZodNumberHandler(value);
    } else {
      return this.v3Layer.defaultZodNumberHandler(value, handleChecks);
    }
  }
  defaultZodDateHandler(value) {
    if ("_zod" in value) {
      return this.v4Layer.defaultZodDateHandler(value);
    } else {
      return this.v3Layer.defaultZodDateHandler(value);
    }
  }
  defaultZodOptionalHandler(value, handleTypes) {
    if ("_zod" in value) {
      return this.v4Layer.defaultZodOptionalHandler(value, handleTypes ?? SUPPORTED_ZOD_TYPES2);
    } else {
      return this.v3Layer.defaultZodOptionalHandler(value, handleTypes ?? SUPPORTED_ZOD_TYPES);
    }
  }
  /**
   * Processes a Zod object schema and converts it to an AI SDK Schema.
   *
   * @param zodSchema - The Zod object schema to process
   * @returns An AI SDK Schema with provider-specific compatibility applied
   */
  processToAISDKSchema(zodSchema) {
    const processedSchema = this.processZodType(zodSchema);
    return convertZodSchemaToAISDKSchema(processedSchema, this.getSchemaTarget());
  }
  /**
   * Processes a Zod object schema and converts it to a JSON Schema.
   *
   * @param zodSchema - The Zod object schema to process
   * @returns A JSONSchema7 object with provider-specific compatibility applied
   */
  processToJSONSchema(zodSchema) {
    return this.processToAISDKSchema(zodSchema).jsonSchema;
  }
};

// src/zodTypes.ts
function isOptional2(z10) {
  return (v) => v instanceof z10["ZodOptional"];
}
function isObj2(z10) {
  return (v) => v instanceof z10["ZodObject"];
}
function isNull(z10) {
  return (v) => v instanceof z10["ZodNull"];
}
function isArr2(z10) {
  return (v) => v instanceof z10["ZodArray"];
}
function isUnion2(z10) {
  return (v) => v instanceof z10["ZodUnion"];
}
function isString2(z10) {
  return (v) => v instanceof z10["ZodString"];
}
function isNumber2(z10) {
  return (v) => v instanceof z10["ZodNumber"];
}
function isDate(z10) {
  return (v) => v instanceof z10["ZodDate"];
}
function isDefault(z10) {
  return (v) => v instanceof z10["ZodDefault"];
}
function isNullable(z10) {
  return (v) => v instanceof z10["ZodNullable"];
}

// src/provider-compats/anthropic.ts
var AnthropicSchemaCompatLayer = class extends SchemaCompatLayer3 {
  constructor(model) {
    super(model);
  }
  getSchemaTarget() {
    return "jsonSchema7";
  }
  shouldApply() {
    return this.getModel().modelId.includes("claude");
  }
  processZodType(value) {
    if (isOptional2(z)(value)) {
      const handleTypes = [
        "ZodObject",
        "ZodArray",
        "ZodUnion",
        "ZodNever",
        "ZodUndefined",
        "ZodTuple"
      ];
      if (this.getModel().modelId.includes("claude-3.5-haiku")) handleTypes.push("ZodString");
      return this.defaultZodOptionalHandler(value, handleTypes);
    } else if (isObj2(z)(value)) {
      return this.defaultZodObjectHandler(value);
    } else if (isArr2(z)(value)) {
      return this.defaultZodArrayHandler(value, []);
    } else if (isUnion2(z)(value)) {
      return this.defaultZodUnionHandler(value);
    } else if (isString2(z)(value)) {
      if (this.getModel().modelId.includes("claude-3.5-haiku")) {
        return this.defaultZodStringHandler(value, ["max", "min"]);
      } else {
        return value;
      }
    }
    return this.defaultUnsupportedZodTypeHandler(value, [
      "ZodNever",
      "ZodTuple",
      "ZodUndefined"
    ]);
  }
};
var DeepSeekSchemaCompatLayer = class extends SchemaCompatLayer3 {
  constructor(model) {
    super(model);
  }
  getSchemaTarget() {
    return "jsonSchema7";
  }
  shouldApply() {
    return this.getModel().modelId.includes("deepseek") && !this.getModel().modelId.includes("r1");
  }
  processZodType(value) {
    if (isOptional2(z)(value)) {
      return this.defaultZodOptionalHandler(value, ["ZodObject", "ZodArray", "ZodUnion", "ZodString", "ZodNumber"]);
    } else if (isObj2(z)(value)) {
      return this.defaultZodObjectHandler(value);
    } else if (isArr2(z)(value)) {
      return this.defaultZodArrayHandler(value, ["min", "max"]);
    } else if (isUnion2(z)(value)) {
      return this.defaultZodUnionHandler(value);
    } else if (isString2(z)(value)) {
      return this.defaultZodStringHandler(value);
    }
    return value;
  }
};
var GoogleSchemaCompatLayer = class extends SchemaCompatLayer3 {
  constructor(model) {
    super(model);
  }
  getSchemaTarget() {
    return "jsonSchema7";
  }
  shouldApply() {
    return this.getModel().provider.includes("google") || this.getModel().modelId.includes("google");
  }
  processZodType(value) {
    if (isOptional2(z)(value)) {
      return this.defaultZodOptionalHandler(value, ["ZodObject", "ZodArray", "ZodUnion", "ZodString", "ZodNumber"]);
    } else if (isNull(z)(value)) {
      return anyType().refine((v) => v === null, { message: "must be null" }).describe(value.description || "must be null");
    } else if (isObj2(z)(value)) {
      return this.defaultZodObjectHandler(value);
    } else if (isArr2(z)(value)) {
      return this.defaultZodArrayHandler(value, []);
    } else if (isUnion2(z)(value)) {
      return this.defaultZodUnionHandler(value);
    } else if (isString2(z)(value)) {
      return this.defaultZodStringHandler(value);
    } else if (isNumber2(z)(value)) {
      return this.defaultZodNumberHandler(value);
    }
    return this.defaultUnsupportedZodTypeHandler(value);
  }
};
var MetaSchemaCompatLayer = class extends SchemaCompatLayer3 {
  constructor(model) {
    super(model);
  }
  getSchemaTarget() {
    return "jsonSchema7";
  }
  shouldApply() {
    return this.getModel().modelId.includes("meta");
  }
  processZodType(value) {
    if (isOptional2(z)(value)) {
      return this.defaultZodOptionalHandler(value, ["ZodObject", "ZodArray", "ZodUnion", "ZodString", "ZodNumber"]);
    } else if (isObj2(z)(value)) {
      return this.defaultZodObjectHandler(value);
    } else if (isArr2(z)(value)) {
      return this.defaultZodArrayHandler(value, ["min", "max"]);
    } else if (isUnion2(z)(value)) {
      return this.defaultZodUnionHandler(value);
    } else if (isNumber2(z)(value)) {
      return this.defaultZodNumberHandler(value);
    } else if (isString2(z)(value)) {
      return this.defaultZodStringHandler(value);
    }
    return value;
  }
};
var OpenAISchemaCompatLayer = class extends SchemaCompatLayer3 {
  constructor(model) {
    super(model);
  }
  getSchemaTarget() {
    return `jsonSchema7`;
  }
  shouldApply() {
    if (!this.getModel().supportsStructuredOutputs && (this.getModel().provider.includes(`openai`) || this.getModel().modelId.includes(`openai`))) {
      return true;
    }
    return false;
  }
  processZodType(value) {
    if (isOptional2(z)(value)) {
      const innerType = "_def" in value ? value._def.innerType : value._zod?.def?.innerType;
      if (innerType) {
        if (isNullable(z)(innerType)) {
          const processed = this.processZodType(innerType);
          return processed.transform((val) => val === null ? void 0 : val);
        }
        const processedInner = this.processZodType(innerType);
        return processedInner.nullable().transform((val) => val === null ? void 0 : val);
      }
      return value;
    } else if (isNullable(z)(value)) {
      const innerType = "_def" in value ? value._def.innerType : value._zod?.def?.innerType;
      if (innerType) {
        if (isOptional2(z)(innerType)) {
          const innerInnerType = "_def" in innerType ? innerType._def.innerType : innerType._zod?.def?.innerType;
          if (innerInnerType) {
            const processedInnerInner = this.processZodType(innerInnerType);
            return processedInnerInner.nullable().transform((val) => val === null ? void 0 : val);
          }
        }
        const processedInner = this.processZodType(innerType);
        return processedInner.nullable();
      }
      return value;
    } else if (isObj2(z)(value)) {
      return this.defaultZodObjectHandler(value);
    } else if (isUnion2(z)(value)) {
      return this.defaultZodUnionHandler(value);
    } else if (isArr2(z)(value)) {
      return this.defaultZodArrayHandler(value);
    } else if (isString2(z)(value)) {
      const model = this.getModel();
      const checks = ["emoji"];
      if (model.modelId.includes("gpt-4o-mini")) {
        return this.defaultZodStringHandler(value, ["emoji", "regex"]);
      }
      return this.defaultZodStringHandler(value, checks);
    }
    return this.defaultUnsupportedZodTypeHandler(value, [
      "ZodNever",
      "ZodUndefined",
      "ZodTuple"
    ]);
  }
};
var OpenAIReasoningSchemaCompatLayer = class extends SchemaCompatLayer3 {
  constructor(model) {
    super(model);
  }
  getSchemaTarget() {
    return `openApi3`;
  }
  isReasoningModel() {
    return this.getModel().modelId.includes(`o3`) || this.getModel().modelId.includes(`o4`) || this.getModel().modelId.includes(`o1`);
  }
  shouldApply() {
    if ((this.getModel().supportsStructuredOutputs || this.isReasoningModel()) && (this.getModel().provider.includes(`openai`) || this.getModel().modelId.includes(`openai`))) {
      return true;
    }
    return false;
  }
  processZodType(value) {
    if (isOptional2(z)(value)) {
      const innerType = "_def" in value ? value._def.innerType : value._zod?.def?.innerType;
      if (innerType) {
        if (isNullable(z)(innerType)) {
          const processed = this.processZodType(innerType);
          return processed.transform((val) => val === null ? void 0 : val);
        }
        const processedInner = this.processZodType(innerType);
        return processedInner.nullable().transform((val) => val === null ? void 0 : val);
      }
      return value;
    } else if (isNullable(z)(value)) {
      const innerType = "_def" in value ? value._def.innerType : value._zod?.def?.innerType;
      if (innerType && isOptional2(z)(innerType)) {
        const innerInnerType = "_def" in innerType ? innerType._def.innerType : innerType._zod?.def?.innerType;
        if (innerInnerType) {
          const processedInnerInner = this.processZodType(innerInnerType);
          return processedInnerInner.nullable().transform((val) => val === null ? void 0 : val);
        }
      }
      if (innerType) {
        const processedInner = this.processZodType(innerType);
        return processedInner.nullable();
      }
      return value;
    } else if (isObj2(z)(value)) {
      return this.defaultZodObjectHandler(value, { passthrough: false });
    } else if (isArr2(z)(value)) {
      return this.defaultZodArrayHandler(value);
    } else if (isUnion2(z)(value)) {
      return this.defaultZodUnionHandler(value);
    } else if (isDefault(z)(value)) {
      const defaultDef = value._def;
      const innerType = defaultDef.innerType;
      const defaultValue = typeof defaultDef.defaultValue === "function" ? defaultDef.defaultValue() : defaultDef.defaultValue;
      const constraints = [];
      if (defaultValue !== void 0) {
        constraints.push(`the default value is ${defaultValue}`);
      }
      const description = this.mergeParameterDescription(value.description, constraints);
      let result = this.processZodType(innerType);
      if (description) {
        result = result.describe(description);
      }
      return result;
    } else if (isNumber2(z)(value)) {
      return this.defaultZodNumberHandler(value);
    } else if (isString2(z)(value)) {
      return this.defaultZodStringHandler(value);
    } else if (isDate(z)(value)) {
      return this.defaultZodDateHandler(value);
    } else if (value.constructor.name === "ZodAny") {
      return stringType().describe(
        (value.description ?? "") + `
Argument was an "any" type, but you (the LLM) do not support "any", so it was cast to a "string" type`
      );
    }
    return this.defaultUnsupportedZodTypeHandler(value);
  }
};

// src/ai-tracing/types.ts
var AISpanType = /* @__PURE__ */ ((AISpanType2) => {
  AISpanType2["AGENT_RUN"] = "agent_run";
  AISpanType2["GENERIC"] = "generic";
  AISpanType2["MODEL_GENERATION"] = "model_generation";
  AISpanType2["MODEL_STEP"] = "model_step";
  AISpanType2["MODEL_CHUNK"] = "model_chunk";
  AISpanType2["MCP_TOOL_CALL"] = "mcp_tool_call";
  AISpanType2["PROCESSOR_RUN"] = "processor_run";
  AISpanType2["TOOL_CALL"] = "tool_call";
  AISpanType2["WORKFLOW_RUN"] = "workflow_run";
  AISpanType2["WORKFLOW_STEP"] = "workflow_step";
  AISpanType2["WORKFLOW_CONDITIONAL"] = "workflow_conditional";
  AISpanType2["WORKFLOW_CONDITIONAL_EVAL"] = "workflow_conditional_eval";
  AISpanType2["WORKFLOW_PARALLEL"] = "workflow_parallel";
  AISpanType2["WORKFLOW_LOOP"] = "workflow_loop";
  AISpanType2["WORKFLOW_SLEEP"] = "workflow_sleep";
  AISpanType2["WORKFLOW_WAIT_EVENT"] = "workflow_wait_event";
  return AISpanType2;
})(AISpanType || {});

// src/ai-tracing/spans/base.ts
function isSpanInternal(spanType, flags) {
  if (flags === void 0 || flags === 0 /* NONE */) {
    return false;
  }
  switch (spanType) {
    // Workflow-related spans
    case "workflow_run" /* WORKFLOW_RUN */:
    case "workflow_step" /* WORKFLOW_STEP */:
    case "workflow_conditional" /* WORKFLOW_CONDITIONAL */:
    case "workflow_conditional_eval" /* WORKFLOW_CONDITIONAL_EVAL */:
    case "workflow_parallel" /* WORKFLOW_PARALLEL */:
    case "workflow_loop" /* WORKFLOW_LOOP */:
    case "workflow_sleep" /* WORKFLOW_SLEEP */:
    case "workflow_wait_event" /* WORKFLOW_WAIT_EVENT */:
      return (flags & 1 /* WORKFLOW */) !== 0;
    // Agent-related spans
    case "agent_run" /* AGENT_RUN */:
      return (flags & 2 /* AGENT */) !== 0;
    // Tool-related spans
    case "tool_call" /* TOOL_CALL */:
    case "mcp_tool_call" /* MCP_TOOL_CALL */:
      return (flags & 4 /* TOOL */) !== 0;
    // Model-related spans
    case "model_generation" /* MODEL_GENERATION */:
    case "model_step" /* MODEL_STEP */:
    case "model_chunk" /* MODEL_CHUNK */:
      return (flags & 8 /* MODEL */) !== 0;
    // Default: never internal
    default:
      return false;
  }
}
var BaseAISpan = class {
  name;
  type;
  attributes;
  parent;
  startTime;
  endTime;
  isEvent;
  isInternal;
  aiTracing;
  input;
  output;
  errorInfo;
  metadata;
  traceState;
  /** Parent span ID (for root spans that are children of external spans) */
  parentSpanId;
  constructor(options, aiTracing) {
    this.name = options.name;
    this.type = options.type;
    this.attributes = deepClean(options.attributes) || {};
    this.metadata = deepClean(options.metadata);
    this.parent = options.parent;
    this.startTime = /* @__PURE__ */ new Date();
    this.aiTracing = aiTracing;
    this.isEvent = options.isEvent ?? false;
    this.isInternal = isSpanInternal(this.type, options.tracingPolicy?.internal);
    this.traceState = options.traceState;
    if (this.isEvent) {
      this.output = deepClean(options.output);
    } else {
      this.input = deepClean(options.input);
    }
  }
  createChildSpan(options) {
    return this.aiTracing.startSpan({ ...options, parent: this, isEvent: false });
  }
  createEventSpan(options) {
    return this.aiTracing.startSpan({ ...options, parent: this, isEvent: true });
  }
  /** Returns `TRUE` if the span is the root span of a trace */
  get isRootSpan() {
    return !this.parent;
  }
  /** Get the closest parent spanId that isn't an internal span */
  getParentSpanId(includeInternalSpans) {
    if (!this.parent) {
      return this.parentSpanId;
    }
    if (includeInternalSpans) return this.parent.id;
    if (this.parent.isInternal) return this.parent.getParentSpanId(includeInternalSpans);
    return this.parent.id;
  }
  /** Find the closest parent span of a specific type by walking up the parent chain */
  findParent(spanType) {
    let current = this.parent;
    while (current) {
      if (current.type === spanType) {
        return current;
      }
      current = current.parent;
    }
    return void 0;
  }
  /** Returns a lightweight span ready for export */
  exportSpan(includeInternalSpans) {
    return {
      id: this.id,
      traceId: this.traceId,
      name: this.name,
      type: this.type,
      attributes: this.attributes,
      metadata: this.metadata,
      startTime: this.startTime,
      endTime: this.endTime,
      input: this.input,
      output: this.output,
      errorInfo: this.errorInfo,
      isEvent: this.isEvent,
      isRootSpan: this.isRootSpan,
      parentSpanId: this.getParentSpanId(includeInternalSpans)
    };
  }
};
var DEFAULT_KEYS_TO_STRIP = /* @__PURE__ */ new Set([
  "logger",
  "experimental_providerMetadata",
  "providerMetadata",
  "steps",
  "tracingContext"
]);
function deepClean(value, options = {}, _seen = /* @__PURE__ */ new WeakSet(), _depth = 0) {
  const { keysToStrip = DEFAULT_KEYS_TO_STRIP, maxDepth = 10 } = options;
  if (_depth > maxDepth) {
    return "[MaxDepth]";
  }
  if (value === null || typeof value !== "object") {
    try {
      JSON.stringify(value);
      return value;
    } catch (error) {
      return `[${error instanceof Error ? error.message : String(error)}]`;
    }
  }
  if (_seen.has(value)) {
    return "[Circular]";
  }
  _seen.add(value);
  if (Array.isArray(value)) {
    return value.map((item) => deepClean(item, options, _seen, _depth + 1));
  }
  const cleaned = {};
  for (const [key, val] of Object.entries(value)) {
    if (keysToStrip.has(key)) {
      continue;
    }
    try {
      cleaned[key] = deepClean(val, options, _seen, _depth + 1);
    } catch (error) {
      cleaned[key] = `[${error instanceof Error ? error.message : String(error)}]`;
    }
  }
  return cleaned;
}

// src/ai-tracing/spans/default.ts
var DefaultAISpan = class extends BaseAISpan {
  id;
  traceId;
  constructor(options, aiTracing) {
    super(options, aiTracing);
    this.id = generateSpanId();
    if (options.parent) {
      this.traceId = options.parent.traceId;
    } else if (options.traceId) {
      if (isValidTraceId(options.traceId)) {
        this.traceId = options.traceId;
      } else {
        console.error(
          `[Mastra Tracing] Invalid traceId: must be 1-32 hexadecimal characters, got "${options.traceId}". Generating new trace ID.`
        );
        this.traceId = generateTraceId();
      }
    } else {
      this.traceId = generateTraceId();
    }
    if (!options.parent && options.parentSpanId) {
      if (isValidSpanId(options.parentSpanId)) {
        this.parentSpanId = options.parentSpanId;
      } else {
        console.error(
          `[Mastra Tracing] Invalid parentSpanId: must be 1-16 hexadecimal characters, got "${options.parentSpanId}". Ignoring parent span ID.`
        );
      }
    }
  }
  end(options) {
    if (this.isEvent) {
      return;
    }
    this.endTime = /* @__PURE__ */ new Date();
    if (options?.output !== void 0) {
      this.output = deepClean(options.output);
    }
    if (options?.attributes) {
      this.attributes = { ...this.attributes, ...deepClean(options.attributes) };
    }
    if (options?.metadata) {
      this.metadata = { ...this.metadata, ...deepClean(options.metadata) };
    }
  }
  error(options) {
    if (this.isEvent) {
      return;
    }
    const { error, endSpan = true, attributes, metadata } = options;
    this.errorInfo = error instanceof MastraError ? {
      id: error.id,
      details: error.details,
      category: error.category,
      domain: error.domain,
      message: error.message
    } : {
      message: error.message
    };
    if (attributes) {
      this.attributes = { ...this.attributes, ...deepClean(attributes) };
    }
    if (metadata) {
      this.metadata = { ...this.metadata, ...deepClean(metadata) };
    }
    if (endSpan) {
      this.end();
    } else {
      this.update({});
    }
  }
  update(options) {
    if (this.isEvent) {
      return;
    }
    if (options.input !== void 0) {
      this.input = deepClean(options.input);
    }
    if (options.output !== void 0) {
      this.output = deepClean(options.output);
    }
    if (options.attributes) {
      this.attributes = { ...this.attributes, ...deepClean(options.attributes) };
    }
    if (options.metadata) {
      this.metadata = { ...this.metadata, ...deepClean(options.metadata) };
    }
  }
  get isValid() {
    return true;
  }
  async export() {
    return JSON.stringify({
      spanId: this.id,
      traceId: this.traceId,
      startTime: this.startTime,
      endTime: this.endTime,
      attributes: this.attributes,
      metadata: this.metadata
    });
  }
};
function generateSpanId() {
  const bytes = new Uint8Array(8);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 8; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
function generateTraceId() {
  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
function isValidTraceId(traceId) {
  return /^[0-9a-f]{1,32}$/i.test(traceId);
}
function isValidSpanId(spanId) {
  return /^[0-9a-f]{1,16}$/i.test(spanId);
}

// src/ai-tracing/spans/no-op.ts
var NoOpAISpan = class extends BaseAISpan {
  id;
  traceId;
  constructor(options, aiTracing) {
    super(options, aiTracing);
    this.id = "no-op";
    this.traceId = "no-op-trace";
  }
  end(_options) {
  }
  error(_options) {
  }
  update(_options) {
  }
  get isValid() {
    return false;
  }
};

// src/ai-tracing/exporters/base.ts
var BaseExporter = class {
  /** Mastra logger instance */
  logger;
  /** Whether this exporter is disabled */
  isDisabled = false;
  /**
   * Initialize the base exporter with logger
   */
  constructor(config = {}) {
    const logLevel = this.resolveLogLevel(config.logLevel);
    this.logger = config.logger ?? new ConsoleLogger({ level: logLevel, name: this.constructor.name });
  }
  /**
   * Set the logger for the exporter (called by Mastra/AITracing during initialization)
   */
  __setLogger(logger) {
    this.logger = logger;
    this.logger.debug(`Logger updated for exporter [name=${this.name}]`);
  }
  /**
   * Convert string log level to LogLevel enum
   */
  resolveLogLevel(logLevel) {
    if (!logLevel) {
      return LogLevel.INFO;
    }
    if (typeof logLevel === "number") {
      return logLevel;
    }
    const logLevelMap = {
      debug: LogLevel.DEBUG,
      info: LogLevel.INFO,
      warn: LogLevel.WARN,
      error: LogLevel.ERROR
    };
    return logLevelMap[logLevel] ?? LogLevel.INFO;
  }
  /**
   * Mark the exporter as disabled and log a message
   *
   * @param reason - Reason why the exporter is disabled
   */
  setDisabled(reason) {
    this.isDisabled = true;
    this.logger.warn(`${this.name} disabled: ${reason}`);
  }
  /**
   * Export a tracing event
   *
   * This method checks if the exporter is disabled before calling _exportEvent.
   * Subclasses should implement _exportEvent instead of overriding this method.
   */
  async exportEvent(event) {
    if (this.isDisabled) {
      return;
    }
    await this._exportEvent(event);
  }
  /**
   * Shutdown the exporter and clean up resources
   *
   * Default implementation just logs. Override to add custom cleanup.
   */
  async shutdown() {
    this.logger.info(`${this.name} shutdown complete`);
  }
};
var CoreToolBuilder = class extends MastraBase {
  originalTool;
  options;
  logType;
  constructor(input) {
    super({ name: "CoreToolBuilder" });
    this.originalTool = input.originalTool;
    this.options = input.options;
    this.logType = input.logType;
  }
  // Helper to get parameters based on tool type
  getParameters = () => {
    if (isVercelTool(this.originalTool)) {
      let schema2 = this.originalTool.parameters ?? ("inputSchema" in this.originalTool ? this.originalTool.inputSchema : void 0) ?? objectType({});
      if (typeof schema2 === "function") {
        schema2 = schema2();
      }
      return schema2;
    }
    let schema = this.originalTool.inputSchema ?? objectType({});
    if (typeof schema === "function") {
      schema = schema();
    }
    return schema;
  };
  getOutputSchema = () => {
    if ("outputSchema" in this.originalTool) {
      let schema = this.originalTool.outputSchema;
      if (typeof schema === "function") {
        schema = schema();
      }
      return schema;
    }
    return null;
  };
  // For provider-defined tools, we need to include all required properties
  buildProviderTool(tool) {
    if ("type" in tool && tool.type === "provider-defined" && "id" in tool && typeof tool.id === "string" && tool.id.includes(".")) {
      const parameters = this.getParameters();
      const outputSchema = this.getOutputSchema();
      return {
        type: "provider-defined",
        id: tool.id,
        args: "args" in this.originalTool ? this.originalTool.args : {},
        description: tool.description,
        parameters: parameters.jsonSchema ? parameters : convertZodSchemaToAISDKSchema(parameters),
        ...outputSchema ? { outputSchema: outputSchema.jsonSchema ? outputSchema : convertZodSchemaToAISDKSchema(outputSchema) } : {},
        execute: this.originalTool.execute ? this.createExecute(
          this.originalTool,
          { ...this.options, description: this.originalTool.description },
          this.logType
        ) : void 0
      };
    }
    return void 0;
  }
  createLogMessageOptions({ agentName, toolName, type }) {
    if (!agentName) {
      return {
        start: `Executing tool ${toolName}`,
        error: `Failed tool execution`
      };
    }
    const prefix = `[Agent:${agentName}]`;
    const toolType = type === "toolset" ? "toolset" : "tool";
    return {
      start: `${prefix} - Executing ${toolType} ${toolName}`,
      error: `${prefix} - Failed ${toolType} execution`
    };
  }
  createExecute(tool, options, logType, processedSchema) {
    const { logger, mastra: _mastra, memory: _memory, runtimeContext, model, ...rest } = options;
    const logModelObject = {
      modelId: model?.modelId,
      provider: model?.provider,
      specificationVersion: model?.specificationVersion
    };
    const { start, error } = this.createLogMessageOptions({
      agentName: options.agentName,
      toolName: options.name,
      type: logType
    });
    const execFunction = async (args, execOptions) => {
      const tracingContext = execOptions.tracingContext || options.tracingContext;
      const toolSpan = tracingContext?.currentSpan?.createChildSpan({
        type: "tool_call" /* TOOL_CALL */,
        name: `tool: '${options.name}'`,
        input: args,
        attributes: {
          toolId: options.name,
          toolDescription: options.description,
          toolType: logType || "tool"
        },
        tracingPolicy: options.tracingPolicy
      });
      try {
        let result;
        if (isVercelTool(tool)) {
          result = await tool?.execute?.(args, execOptions);
        } else {
          const wrappedMastra = options.mastra ? wrapMastra(options.mastra, { currentSpan: toolSpan }) : options.mastra;
          result = await tool?.execute?.(
            {
              context: args,
              threadId: options.threadId,
              resourceId: options.resourceId,
              mastra: wrappedMastra,
              memory: options.memory,
              runId: options.runId,
              runtimeContext: options.runtimeContext ?? new RuntimeContext(),
              writer: new ToolStream(
                {
                  prefix: "tool",
                  callId: execOptions.toolCallId,
                  name: options.name,
                  runId: options.runId
                },
                options.writableStream || execOptions.writableStream
              ),
              tracingContext: { currentSpan: toolSpan }
            },
            execOptions
          );
        }
        toolSpan?.end({ output: result });
        return result ?? void 0;
      } catch (error2) {
        toolSpan?.error({ error: error2 });
        throw error2;
      }
    };
    return async (args, execOptions) => {
      let logger2 = options.logger || this.logger;
      try {
        logger2.debug(start, { ...rest, model: logModelObject, args });
        const parameters = processedSchema || this.getParameters();
        const { data, error: error2 } = validateToolInput(parameters, args, options.name);
        if (error2) {
          logger2.warn(`Tool input validation failed for '${options.name}'`, {
            toolName: options.name,
            errors: error2.validationErrors,
            args
          });
          return error2;
        }
        args = data;
        return await new Promise((resolve, reject) => {
          setImmediate(async () => {
            try {
              const result = await execFunction(args, execOptions);
              resolve(result);
            } catch (err) {
              reject(err);
            }
          });
        });
      } catch (err) {
        const mastraError = new MastraError(
          {
            id: "TOOL_EXECUTION_FAILED",
            domain: "TOOL" /* TOOL */,
            category: "USER" /* USER */,
            details: {
              errorMessage: String(error),
              argsJson: JSON.stringify(args),
              model: model?.modelId ?? ""
            }
          },
          err
        );
        logger2.trackException(mastraError);
        logger2.error(error, { ...rest, model: logModelObject, error: mastraError, args });
        return mastraError;
      }
    };
  }
  buildV5() {
    const builtTool = this.build();
    if (!builtTool.parameters) {
      throw new Error("Tool parameters are required");
    }
    const base = {
      ...builtTool,
      inputSchema: builtTool.parameters,
      onInputStart: "onInputStart" in this.originalTool ? this.originalTool.onInputStart : void 0,
      onInputDelta: "onInputDelta" in this.originalTool ? this.originalTool.onInputDelta : void 0,
      onInputAvailable: "onInputAvailable" in this.originalTool ? this.originalTool.onInputAvailable : void 0
    };
    if (builtTool.type === "provider-defined") {
      const { execute, parameters, ...rest } = base;
      const name = builtTool.id.split(".")[1] || builtTool.id;
      return {
        ...rest,
        type: builtTool.type,
        id: builtTool.id,
        name,
        args: builtTool.args
      };
    }
    return base;
  }
  build() {
    const providerTool = this.buildProviderTool(this.originalTool);
    if (providerTool) {
      return providerTool;
    }
    const model = this.options.model;
    const schemaCompatLayers = [];
    if (model) {
      const supportsStructuredOutputs = model.specificationVersion !== "v2" ? model.supportsStructuredOutputs ?? false : false;
      const modelInfo = {
        modelId: model.modelId,
        supportsStructuredOutputs,
        provider: model.provider
      };
      schemaCompatLayers.push(
        new OpenAIReasoningSchemaCompatLayer(modelInfo),
        new OpenAISchemaCompatLayer(modelInfo),
        new GoogleSchemaCompatLayer(modelInfo),
        new AnthropicSchemaCompatLayer(modelInfo),
        new DeepSeekSchemaCompatLayer(modelInfo),
        new MetaSchemaCompatLayer(modelInfo)
      );
    }
    let processedZodSchema;
    let processedSchema;
    const originalSchema = this.getParameters();
    const applicableLayer = schemaCompatLayers.find((layer) => layer.shouldApply());
    if (applicableLayer && originalSchema) {
      processedZodSchema = applicableLayer.processZodType(originalSchema);
      processedSchema = applyCompatLayer({
        schema: originalSchema,
        compatLayers: schemaCompatLayers,
        mode: "aiSdkSchema"
      });
    } else {
      processedZodSchema = originalSchema;
      processedSchema = applyCompatLayer({
        schema: originalSchema,
        compatLayers: schemaCompatLayers,
        mode: "aiSdkSchema"
      });
    }
    let processedOutputSchema;
    if (this.getOutputSchema()) {
      processedOutputSchema = applyCompatLayer({
        schema: this.getOutputSchema(),
        compatLayers: [],
        mode: "aiSdkSchema"
      });
    }
    const definition = {
      type: "function",
      description: this.originalTool.description,
      parameters: this.getParameters(),
      outputSchema: this.getOutputSchema(),
      requireApproval: this.options.requireApproval,
      execute: this.originalTool.execute ? this.createExecute(
        this.originalTool,
        { ...this.options, description: this.originalTool.description },
        this.logType,
        processedZodSchema
        // Pass the processed Zod schema for validation
      ) : void 0
    };
    return {
      ...definition,
      id: "id" in this.originalTool ? this.originalTool.id : void 0,
      parameters: processedSchema,
      outputSchema: processedOutputSchema
    };
  }
};

// src/utils.ts
var delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
function deepMerge(target, source) {
  const output = { ...target };
  if (!source) return output;
  Object.keys(source).forEach((key) => {
    const targetValue = output[key];
    const sourceValue = source[key];
    if (Array.isArray(targetValue) && Array.isArray(sourceValue)) {
      output[key] = sourceValue;
    } else if (sourceValue instanceof Object && targetValue instanceof Object && !Array.isArray(sourceValue) && !Array.isArray(targetValue)) {
      output[key] = deepMerge(targetValue, sourceValue);
    } else if (sourceValue !== void 0) {
      output[key] = sourceValue;
    }
  });
  return output;
}
function generateEmptyFromSchema(schema) {
  try {
    const parsedSchema = JSON.parse(schema);
    if (!parsedSchema || parsedSchema.type !== "object" || !parsedSchema.properties) return {};
    const obj = {};
    const TYPE_DEFAULTS = {
      string: "",
      array: [],
      object: {},
      number: 0,
      integer: 0,
      boolean: false
    };
    for (const [key, prop] of Object.entries(parsedSchema.properties)) {
      obj[key] = TYPE_DEFAULTS[prop.type] ?? null;
    }
    return obj;
  } catch {
    return {};
  }
}
function resolveSerializedZodOutput(schema) {
  return Function("z", `"use strict";return (${schema});`)(z);
}
function isZodType(value) {
  return typeof value === "object" && value !== null && "_def" in value && "parse" in value && typeof value.parse === "function" && "safeParse" in value && typeof value.safeParse === "function";
}
function createDeterministicId(input) {
  return createHash("sha256").update(input).digest("hex").slice(0, 8);
}
function setVercelToolProperties(tool) {
  const inputSchema = "inputSchema" in tool ? tool.inputSchema : convertVercelToolParameters(tool);
  const toolId = !("id" in tool) ? tool.description ? `tool-${createDeterministicId(tool.description)}` : `tool-${Math.random().toString(36).substring(2, 9)}` : tool.id;
  return {
    ...tool,
    id: toolId,
    inputSchema
  };
}
function ensureToolProperties(tools) {
  const toolsWithProperties = Object.keys(tools).reduce((acc, key) => {
    const tool = tools?.[key];
    if (tool) {
      if (isVercelTool(tool)) {
        acc[key] = setVercelToolProperties(tool);
      } else {
        acc[key] = tool;
      }
    }
    return acc;
  }, {});
  return toolsWithProperties;
}
function convertVercelToolParameters(tool) {
  let schema = tool.parameters ?? objectType({});
  if (typeof schema === "function") {
    schema = schema();
  }
  return isZodType(schema) ? schema : resolveSerializedZodOutput(jsonSchemaToZod(schema));
}
function makeCoreTool(originalTool, options, logType) {
  return new CoreToolBuilder({ originalTool, options, logType }).build();
}
function createMastraProxy({ mastra, logger }) {
  return new Proxy(mastra, {
    get(target, prop) {
      const hasProp = Reflect.has(target, prop);
      if (hasProp) {
        const value = Reflect.get(target, prop);
        const isFunction = typeof value === "function";
        if (isFunction) {
          return value.bind(target);
        }
        return value;
      }
      if (prop === "logger") {
        logger.warn(`Please use 'getLogger' instead, logger is deprecated`);
        return Reflect.apply(target.getLogger, target, []);
      }
      if (prop === "telemetry") {
        logger.warn(`Please use 'getTelemetry' instead, telemetry is deprecated`);
        return Reflect.apply(target.getTelemetry, target, []);
      }
      if (prop === "storage") {
        logger.warn(`Please use 'getStorage' instead, storage is deprecated`);
        return Reflect.get(target, "storage");
      }
      if (prop === "agents") {
        logger.warn(`Please use 'getAgents' instead, agents is deprecated`);
        return Reflect.apply(target.getAgents, target, []);
      }
      if (prop === "tts") {
        logger.warn(`Please use 'getTTS' instead, tts is deprecated`);
        return Reflect.apply(target.getTTS, target, []);
      }
      if (prop === "vectors") {
        logger.warn(`Please use 'getVectors' instead, vectors is deprecated`);
        return Reflect.apply(target.getVectors, target, []);
      }
      if (prop === "memory") {
        logger.warn(`Please use 'getMemory' instead, memory is deprecated`);
        return Reflect.get(target, "memory");
      }
      return Reflect.get(target, prop);
    }
  });
}
function checkEvalStorageFields(traceObject, logger) {
  const missingFields = [];
  if (!traceObject.input) missingFields.push("input");
  if (!traceObject.output) missingFields.push("output");
  if (!traceObject.agentName) missingFields.push("agent_name");
  if (!traceObject.metricName) missingFields.push("metric_name");
  if (!traceObject.instructions) missingFields.push("instructions");
  if (!traceObject.globalRunId) missingFields.push("global_run_id");
  if (!traceObject.runId) missingFields.push("run_id");
  if (missingFields.length > 0) {
    if (logger) {
      logger.warn("Skipping evaluation storage due to missing required fields", {
        missingFields,
        runId: traceObject.runId,
        agentName: traceObject.agentName
      });
    } else {
      console.warn("Skipping evaluation storage due to missing required fields", {
        missingFields,
        runId: traceObject.runId,
        agentName: traceObject.agentName
      });
    }
    return false;
  }
  return true;
}
var SQL_IDENTIFIER_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
function parseSqlIdentifier(name, kind = "identifier") {
  if (!SQL_IDENTIFIER_PATTERN.test(name) || name.length > 63) {
    throw new Error(
      `Invalid ${kind}: ${name}. Must start with a letter or underscore, contain only letters, numbers, or underscores, and be at most 63 characters long.`
    );
  }
  return name;
}
function parseFieldKey(key) {
  if (!key) throw new Error("Field key cannot be empty");
  const segments = key.split(".");
  for (const segment of segments) {
    if (!SQL_IDENTIFIER_PATTERN.test(segment) || segment.length > 63) {
      throw new Error(`Invalid field key segment: ${segment} in ${key}`);
    }
  }
  return key;
}
async function fetchWithRetry(url, options = {}, maxRetries = 3) {
  let retryCount = 0;
  let lastError = null;
  while (retryCount < maxRetries) {
    try {
      const response = await fetch(url, options);
      if (!response.ok) {
        throw new Error(`Request failed with status: ${response.status} ${response.statusText}`);
      }
      return response;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      retryCount++;
      if (retryCount >= maxRetries) {
        break;
      }
      const delay2 = Math.min(1e3 * Math.pow(2, retryCount) * 1e3, 1e4);
      await new Promise((resolve) => setTimeout(resolve, delay2));
    }
  }
  throw lastError || new Error("Request failed after multiple retry attempts");
}
var removeUndefinedValues = (obj) => {
  return Object.fromEntries(Object.entries(obj).filter(([_, value]) => value !== void 0));
};

// src/ai-tracing/exporters/cloud.ts
var CloudExporter = class extends BaseExporter {
  name = "mastra-cloud-ai-tracing-exporter";
  config;
  buffer;
  flushTimer = null;
  constructor(config = {}) {
    super(config);
    const accessToken = config.accessToken ?? process.env.MASTRA_CLOUD_ACCESS_TOKEN;
    if (!accessToken) {
      this.setDisabled(
        "MASTRA_CLOUD_ACCESS_TOKEN environment variable not set.\n\u{1F680} Sign up at https://cloud.mastra.ai to see your AI traces online and obtain your access token."
      );
    }
    const endpoint = config.endpoint ?? process.env.MASTRA_CLOUD_AI_TRACES_ENDPOINT ?? "https://api.mastra.ai/ai/spans/publish";
    this.config = {
      logger: this.logger,
      logLevel: config.logLevel ?? LogLevel.INFO,
      maxBatchSize: config.maxBatchSize ?? 1e3,
      maxBatchWaitMs: config.maxBatchWaitMs ?? 5e3,
      maxRetries: config.maxRetries ?? 3,
      accessToken: accessToken || "",
      endpoint
    };
    this.buffer = {
      spans: [],
      totalSize: 0
    };
  }
  async _exportEvent(event) {
    if (event.type !== "span_ended" /* SPAN_ENDED */) {
      return;
    }
    this.addToBuffer(event);
    if (this.shouldFlush()) {
      this.flush().catch((error) => {
        this.logger.error("Batch flush failed", {
          error: error instanceof Error ? error.message : String(error)
        });
      });
    } else if (this.buffer.totalSize === 1) {
      this.scheduleFlush();
    }
  }
  addToBuffer(event) {
    if (this.buffer.totalSize === 0) {
      this.buffer.firstEventTime = /* @__PURE__ */ new Date();
    }
    const spanRecord = this.formatSpan(event.exportedSpan);
    this.buffer.spans.push(spanRecord);
    this.buffer.totalSize++;
  }
  formatSpan(span) {
    const spanRecord = {
      traceId: span.traceId,
      spanId: span.id,
      parentSpanId: span.parentSpanId ?? null,
      name: span.name,
      spanType: span.type,
      attributes: span.attributes ?? null,
      metadata: span.metadata ?? null,
      startedAt: span.startTime,
      endedAt: span.endTime ?? null,
      input: span.input ?? null,
      output: span.output ?? null,
      error: span.errorInfo,
      isEvent: span.isEvent,
      createdAt: /* @__PURE__ */ new Date(),
      updatedAt: null
    };
    return spanRecord;
  }
  shouldFlush() {
    if (this.buffer.totalSize >= this.config.maxBatchSize) {
      return true;
    }
    if (this.buffer.firstEventTime && this.buffer.totalSize > 0) {
      const elapsed = Date.now() - this.buffer.firstEventTime.getTime();
      if (elapsed >= this.config.maxBatchWaitMs) {
        return true;
      }
    }
    return false;
  }
  scheduleFlush() {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
    }
    this.flushTimer = setTimeout(() => {
      this.flush().catch((error) => {
        const mastraError = new MastraError(
          {
            id: `CLOUD_AI_TRACING_FAILED_TO_SCHEDULE_FLUSH`,
            domain: "MASTRA_OBSERVABILITY" /* MASTRA_OBSERVABILITY */,
            category: "USER" /* USER */
          },
          error
        );
        this.logger.trackException(mastraError);
        this.logger.error("Scheduled flush failed", mastraError);
      });
    }, this.config.maxBatchWaitMs);
  }
  async flush() {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    if (this.buffer.totalSize === 0) {
      return;
    }
    const startTime = Date.now();
    const spansCopy = [...this.buffer.spans];
    const flushReason = this.buffer.totalSize >= this.config.maxBatchSize ? "size" : "time";
    this.resetBuffer();
    try {
      await this.batchUpload(spansCopy);
      const elapsed = Date.now() - startTime;
      this.logger.debug("Batch flushed successfully", {
        batchSize: spansCopy.length,
        flushReason,
        durationMs: elapsed
      });
    } catch (error) {
      const mastraError = new MastraError(
        {
          id: `CLOUD_AI_TRACING_FAILED_TO_BATCH_UPLOAD`,
          domain: "MASTRA_OBSERVABILITY" /* MASTRA_OBSERVABILITY */,
          category: "USER" /* USER */,
          details: {
            droppedBatchSize: spansCopy.length
          }
        },
        error
      );
      this.logger.trackException(mastraError);
      this.logger.error("Batch upload failed after all retries, dropping batch", mastraError);
    }
  }
  /**
   * Uploads spans to cloud API using fetchWithRetry for all retry logic
   */
  async batchUpload(spans) {
    const headers = {
      Authorization: `Bearer ${this.config.accessToken}`,
      "Content-Type": "application/json"
    };
    const options = {
      method: "POST",
      headers,
      body: JSON.stringify({ spans })
    };
    await fetchWithRetry(this.config.endpoint, options, this.config.maxRetries);
  }
  resetBuffer() {
    this.buffer.spans = [];
    this.buffer.firstEventTime = void 0;
    this.buffer.totalSize = 0;
  }
  async shutdown() {
    if (this.isDisabled) {
      return;
    }
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    if (this.buffer.totalSize > 0) {
      this.logger.info("Flushing remaining events on shutdown", {
        remainingEvents: this.buffer.totalSize
      });
      try {
        await this.flush();
      } catch (error) {
        const mastraError = new MastraError(
          {
            id: `CLOUD_AI_TRACING_FAILED_TO_FLUSH_REMAINING_EVENTS_DURING_SHUTDOWN`,
            domain: "MASTRA_OBSERVABILITY" /* MASTRA_OBSERVABILITY */,
            category: "USER" /* USER */,
            details: {
              remainingEvents: this.buffer.totalSize
            }
          },
          error
        );
        this.logger.trackException(mastraError);
        this.logger.error("Failed to flush remaining events during shutdown", mastraError);
      }
    }
    this.logger.info("CloudExporter shutdown complete");
  }
};

// src/ai-tracing/exporters/default.ts
function resolveStrategy(userConfig, storage, logger) {
  if (userConfig.strategy && userConfig.strategy !== "auto") {
    const hints = storage.aiTracingStrategy;
    if (hints.supported.includes(userConfig.strategy)) {
      return userConfig.strategy;
    }
    logger.warn("User-specified AI tracing strategy not supported by storage adapter, falling back to auto-selection", {
      userStrategy: userConfig.strategy,
      storageAdapter: storage.constructor.name,
      supportedStrategies: hints.supported,
      fallbackStrategy: hints.preferred
    });
  }
  return storage.aiTracingStrategy.preferred;
}
var DefaultExporter = class {
  name = "tracing-default-exporter";
  logger;
  mastra = null;
  config;
  resolvedStrategy;
  buffer;
  flushTimer = null;
  // Track all spans that have been created, persists across flushes
  allCreatedSpans = /* @__PURE__ */ new Set();
  constructor(config = {}, logger) {
    if (logger) {
      this.logger = logger;
    } else {
      this.logger = new ConsoleLogger({ level: LogLevel.INFO });
    }
    this.config = {
      maxBatchSize: config.maxBatchSize ?? 1e3,
      maxBufferSize: config.maxBufferSize ?? 1e4,
      maxBatchWaitMs: config.maxBatchWaitMs ?? 5e3,
      maxRetries: config.maxRetries ?? 4,
      retryDelayMs: config.retryDelayMs ?? 500,
      strategy: config.strategy ?? "auto"
    };
    this.buffer = {
      creates: [],
      updates: [],
      insertOnly: [],
      seenSpans: /* @__PURE__ */ new Set(),
      spanSequences: /* @__PURE__ */ new Map(),
      completedSpans: /* @__PURE__ */ new Set(),
      outOfOrderCount: 0,
      totalSize: 0
    };
    this.resolvedStrategy = "batch-with-updates";
  }
  strategyInitialized = false;
  /**
   * Register the Mastra instance (called after Mastra construction is complete)
   */
  __registerMastra(mastra) {
    this.mastra = mastra;
  }
  /**
   * Initialize the exporter (called after all dependencies are ready)
   */
  init(_config) {
    if (!this.mastra) {
      throw new Error("DefaultExporter: init() called before __registerMastra()");
    }
    const storage = this.mastra.getStorage();
    if (!storage) {
      this.logger.warn("DefaultExporter disabled: Storage not available. Traces will not be persisted.");
      return;
    }
    this.initializeStrategy(storage);
  }
  /**
   * Initialize the resolved strategy once storage is available
   */
  initializeStrategy(storage) {
    if (this.strategyInitialized) return;
    this.resolvedStrategy = resolveStrategy(this.config, storage, this.logger);
    this.strategyInitialized = true;
    this.logger.debug("AI tracing exporter initialized", {
      strategy: this.resolvedStrategy,
      source: this.config.strategy !== "auto" ? "user" : "auto",
      storageAdapter: storage.constructor.name,
      maxBatchSize: this.config.maxBatchSize,
      maxBatchWaitMs: this.config.maxBatchWaitMs
    });
  }
  /**
   * Builds a unique span key for tracking
   */
  buildSpanKey(traceId, spanId) {
    return `${traceId}:${spanId}`;
  }
  /**
   * Gets the next sequence number for a span
   */
  getNextSequence(spanKey) {
    const current = this.buffer.spanSequences.get(spanKey) || 0;
    const next = current + 1;
    this.buffer.spanSequences.set(spanKey, next);
    return next;
  }
  /**
   * Handles out-of-order span updates by logging and skipping
   */
  handleOutOfOrderUpdate(event) {
    this.logger.warn("Out-of-order span update detected - skipping event", {
      spanId: event.exportedSpan.id,
      traceId: event.exportedSpan.traceId,
      spanName: event.exportedSpan.name,
      eventType: event.type
    });
  }
  /**
   * Adds an event to the appropriate buffer based on strategy
   */
  addToBuffer(event) {
    const spanKey = this.buildSpanKey(event.exportedSpan.traceId, event.exportedSpan.id);
    if (this.buffer.totalSize === 0) {
      this.buffer.firstEventTime = /* @__PURE__ */ new Date();
    }
    switch (event.type) {
      case "span_started" /* SPAN_STARTED */:
        if (this.resolvedStrategy === "batch-with-updates") {
          const createRecord = this.buildCreateRecord(event.exportedSpan);
          this.buffer.creates.push(createRecord);
          this.buffer.seenSpans.add(spanKey);
          this.allCreatedSpans.add(spanKey);
        }
        break;
      case "span_updated" /* SPAN_UPDATED */:
        if (this.resolvedStrategy === "batch-with-updates") {
          if (this.allCreatedSpans.has(spanKey)) {
            this.buffer.updates.push({
              traceId: event.exportedSpan.traceId,
              spanId: event.exportedSpan.id,
              updates: this.buildUpdateRecord(event.exportedSpan),
              sequenceNumber: this.getNextSequence(spanKey)
            });
          } else {
            this.handleOutOfOrderUpdate(event);
            this.buffer.outOfOrderCount++;
          }
        }
        break;
      case "span_ended" /* SPAN_ENDED */:
        if (this.resolvedStrategy === "batch-with-updates") {
          if (this.allCreatedSpans.has(spanKey)) {
            this.buffer.updates.push({
              traceId: event.exportedSpan.traceId,
              spanId: event.exportedSpan.id,
              updates: this.buildUpdateRecord(event.exportedSpan),
              sequenceNumber: this.getNextSequence(spanKey)
            });
            this.buffer.completedSpans.add(spanKey);
          } else if (event.exportedSpan.isEvent) {
            const createRecord = this.buildCreateRecord(event.exportedSpan);
            this.buffer.creates.push(createRecord);
            this.buffer.seenSpans.add(spanKey);
            this.allCreatedSpans.add(spanKey);
            this.buffer.completedSpans.add(spanKey);
          } else {
            this.handleOutOfOrderUpdate(event);
            this.buffer.outOfOrderCount++;
          }
        } else if (this.resolvedStrategy === "insert-only") {
          const createRecord = this.buildCreateRecord(event.exportedSpan);
          this.buffer.insertOnly.push(createRecord);
          this.buffer.completedSpans.add(spanKey);
          this.allCreatedSpans.add(spanKey);
        }
        break;
    }
    this.buffer.totalSize = this.buffer.creates.length + this.buffer.updates.length + this.buffer.insertOnly.length;
  }
  /**
   * Checks if buffer should be flushed based on size or time triggers
   */
  shouldFlush() {
    if (this.buffer.totalSize >= this.config.maxBufferSize) {
      return true;
    }
    if (this.buffer.totalSize >= this.config.maxBatchSize) {
      return true;
    }
    if (this.buffer.firstEventTime && this.buffer.totalSize > 0) {
      const elapsed = Date.now() - this.buffer.firstEventTime.getTime();
      if (elapsed >= this.config.maxBatchWaitMs) {
        return true;
      }
    }
    return false;
  }
  /**
   * Resets the buffer after successful flush
   */
  resetBuffer(completedSpansToCleanup = /* @__PURE__ */ new Set()) {
    this.buffer.creates = [];
    this.buffer.updates = [];
    this.buffer.insertOnly = [];
    this.buffer.seenSpans.clear();
    this.buffer.spanSequences.clear();
    this.buffer.completedSpans.clear();
    this.buffer.outOfOrderCount = 0;
    this.buffer.firstEventTime = void 0;
    this.buffer.totalSize = 0;
    for (const spanKey of completedSpansToCleanup) {
      this.allCreatedSpans.delete(spanKey);
    }
  }
  /**
   * Schedules a flush using setTimeout
   */
  scheduleFlush() {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
    }
    this.flushTimer = setTimeout(() => {
      this.flush().catch((error) => {
        this.logger.error("Scheduled flush failed", {
          error: error instanceof Error ? error.message : String(error)
        });
      });
    }, this.config.maxBatchWaitMs);
  }
  /**
   * Serializes span attributes to storage record format
   * Handles all AI span types and their specific attributes
   */
  serializeAttributes(span) {
    if (!span.attributes) {
      return null;
    }
    try {
      return JSON.parse(
        JSON.stringify(span.attributes, (_key, value) => {
          if (value instanceof Date) {
            return value.toISOString();
          }
          if (typeof value === "object" && value !== null) {
            return value;
          }
          return value;
        })
      );
    } catch (error) {
      this.logger.warn("Failed to serialize span attributes, storing as null", {
        spanId: span.id,
        spanType: span.type,
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }
  buildCreateRecord(span) {
    return {
      traceId: span.traceId,
      spanId: span.id,
      parentSpanId: span.parentSpanId ?? null,
      name: span.name,
      scope: null,
      spanType: span.type,
      attributes: this.serializeAttributes(span),
      metadata: span.metadata ?? null,
      links: null,
      startedAt: span.startTime,
      endedAt: span.endTime ?? null,
      input: span.input,
      output: span.output,
      error: span.errorInfo,
      isEvent: span.isEvent
    };
  }
  buildUpdateRecord(span) {
    return {
      name: span.name,
      scope: null,
      attributes: this.serializeAttributes(span),
      metadata: span.metadata ?? null,
      links: null,
      endedAt: span.endTime ?? null,
      input: span.input,
      output: span.output,
      error: span.errorInfo
    };
  }
  /**
   * Handles realtime strategy - processes each event immediately
   */
  async handleRealtimeEvent(event, storage) {
    const span = event.exportedSpan;
    const spanKey = this.buildSpanKey(span.traceId, span.id);
    if (span.isEvent) {
      if (event.type === "span_ended" /* SPAN_ENDED */) {
        await storage.createAISpan(this.buildCreateRecord(event.exportedSpan));
      } else {
        this.logger.warn(`Tracing event type not implemented for event spans: ${event.type}`);
      }
    } else {
      switch (event.type) {
        case "span_started" /* SPAN_STARTED */:
          await storage.createAISpan(this.buildCreateRecord(event.exportedSpan));
          this.allCreatedSpans.add(spanKey);
          break;
        case "span_updated" /* SPAN_UPDATED */:
          await storage.updateAISpan({
            traceId: span.traceId,
            spanId: span.id,
            updates: this.buildUpdateRecord(span)
          });
          break;
        case "span_ended" /* SPAN_ENDED */:
          await storage.updateAISpan({
            traceId: span.traceId,
            spanId: span.id,
            updates: this.buildUpdateRecord(span)
          });
          this.allCreatedSpans.delete(spanKey);
          break;
        default:
          this.logger.warn(`Tracing event type not implemented for span spans: ${event.type}`);
      }
    }
  }
  /**
   * Handles batch-with-updates strategy - buffers events and processes in batches
   */
  handleBatchWithUpdatesEvent(event) {
    this.addToBuffer(event);
    if (this.shouldFlush()) {
      this.flush().catch((error) => {
        this.logger.error("Batch flush failed", {
          error: error instanceof Error ? error.message : String(error)
        });
      });
    } else if (this.buffer.totalSize === 1) {
      this.scheduleFlush();
    }
  }
  /**
   * Handles insert-only strategy - only processes SPAN_ENDED events in batches
   */
  handleInsertOnlyEvent(event) {
    if (event.type === "span_ended" /* SPAN_ENDED */) {
      this.addToBuffer(event);
      if (this.shouldFlush()) {
        this.flush().catch((error) => {
          this.logger.error("Batch flush failed", {
            error: error instanceof Error ? error.message : String(error)
          });
        });
      } else if (this.buffer.totalSize === 1) {
        this.scheduleFlush();
      }
    }
  }
  /**
   * Calculates retry delay using exponential backoff
   */
  calculateRetryDelay(attempt) {
    return this.config.retryDelayMs * Math.pow(2, attempt);
  }
  /**
   * Flushes the current buffer to storage with retry logic
   */
  async flush() {
    if (!this.mastra) {
      this.logger.debug("Cannot flush traces. Mastra instance not registered yet.");
      return;
    }
    const storage = this.mastra.getStorage();
    if (!storage) {
      this.logger.debug("Cannot flush traces. Mastra storage is not initialized");
      return;
    }
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    if (this.buffer.totalSize === 0) {
      return;
    }
    const startTime = Date.now();
    const flushReason = this.buffer.totalSize >= this.config.maxBufferSize ? "overflow" : this.buffer.totalSize >= this.config.maxBatchSize ? "size" : "time";
    const bufferCopy = {
      creates: [...this.buffer.creates],
      updates: [...this.buffer.updates],
      insertOnly: [...this.buffer.insertOnly],
      seenSpans: new Set(this.buffer.seenSpans),
      spanSequences: new Map(this.buffer.spanSequences),
      completedSpans: new Set(this.buffer.completedSpans),
      outOfOrderCount: this.buffer.outOfOrderCount,
      firstEventTime: this.buffer.firstEventTime,
      totalSize: this.buffer.totalSize
    };
    this.resetBuffer();
    await this.flushWithRetries(storage, bufferCopy, 0);
    const elapsed = Date.now() - startTime;
    this.logger.debug("Batch flushed", {
      strategy: this.resolvedStrategy,
      batchSize: bufferCopy.totalSize,
      flushReason,
      durationMs: elapsed,
      outOfOrderCount: bufferCopy.outOfOrderCount > 0 ? bufferCopy.outOfOrderCount : void 0
    });
  }
  /**
   * Attempts to flush with exponential backoff retry logic
   */
  async flushWithRetries(storage, buffer, attempt) {
    try {
      if (this.resolvedStrategy === "batch-with-updates") {
        if (buffer.creates.length > 0) {
          await storage.batchCreateAISpans({ records: buffer.creates });
        }
        if (buffer.updates.length > 0) {
          const sortedUpdates = buffer.updates.sort((a, b) => {
            const spanCompare = this.buildSpanKey(a.traceId, a.spanId).localeCompare(
              this.buildSpanKey(b.traceId, b.spanId)
            );
            if (spanCompare !== 0) return spanCompare;
            return a.sequenceNumber - b.sequenceNumber;
          });
          await storage.batchUpdateAISpans({ records: sortedUpdates });
        }
      } else if (this.resolvedStrategy === "insert-only") {
        if (buffer.insertOnly.length > 0) {
          await storage.batchCreateAISpans({ records: buffer.insertOnly });
        }
      }
      for (const spanKey of buffer.completedSpans) {
        this.allCreatedSpans.delete(spanKey);
      }
    } catch (error) {
      if (attempt < this.config.maxRetries) {
        const retryDelay = this.calculateRetryDelay(attempt);
        this.logger.warn("Batch flush failed, retrying", {
          attempt: attempt + 1,
          maxRetries: this.config.maxRetries,
          nextRetryInMs: retryDelay,
          error: error instanceof Error ? error.message : String(error)
        });
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
        return this.flushWithRetries(storage, buffer, attempt + 1);
      } else {
        this.logger.error("Batch flush failed after all retries, dropping batch", {
          finalAttempt: attempt + 1,
          maxRetries: this.config.maxRetries,
          droppedBatchSize: buffer.totalSize,
          error: error instanceof Error ? error.message : String(error)
        });
        for (const spanKey of buffer.completedSpans) {
          this.allCreatedSpans.delete(spanKey);
        }
      }
    }
  }
  async exportEvent(event) {
    if (!this.mastra) {
      this.logger.debug("Cannot export AI tracing event. Mastra instance not registered yet.");
      return;
    }
    const storage = this.mastra.getStorage();
    if (!storage) {
      this.logger.debug("Cannot store traces. Mastra storage is not initialized");
      return;
    }
    if (!this.strategyInitialized) {
      this.initializeStrategy(storage);
    }
    switch (this.resolvedStrategy) {
      case "realtime":
        await this.handleRealtimeEvent(event, storage);
        break;
      case "batch-with-updates":
        this.handleBatchWithUpdatesEvent(event);
        break;
      case "insert-only":
        this.handleInsertOnlyEvent(event);
        break;
    }
  }
  async shutdown() {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    if (this.buffer.totalSize > 0) {
      this.logger.info("Flushing remaining events on shutdown", {
        remainingEvents: this.buffer.totalSize
      });
      try {
        await this.flush();
      } catch (error) {
        this.logger.error("Failed to flush remaining events during shutdown", {
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
    this.logger.info("DefaultExporter shutdown complete");
  }
};

// src/ai-tracing/span_processors/sensitive-data-filter.ts
var SensitiveDataFilter = class {
  name = "sensitive-data-filter";
  sensitiveFields;
  redactionToken;
  redactionStyle;
  constructor(options = {}) {
    this.sensitiveFields = (options.sensitiveFields || [
      "password",
      "token",
      "secret",
      "key",
      "apikey",
      "auth",
      "authorization",
      "bearer",
      "bearertoken",
      "jwt",
      "credential",
      "clientsecret",
      "privatekey",
      "refresh",
      "ssn"
    ]).map((f) => this.normalizeKey(f));
    this.redactionToken = options.redactionToken ?? "[REDACTED]";
    this.redactionStyle = options.redactionStyle ?? "full";
  }
  /**
   * Process a span by filtering sensitive data across its key fields.
   * Fields processed: attributes, metadata, input, output, errorInfo.
   *
   * @param span - The input span to filter
   * @returns A new span with sensitive values redacted
   */
  process(span) {
    span.attributes = this.tryFilter(span.attributes);
    span.metadata = this.tryFilter(span.metadata);
    span.input = this.tryFilter(span.input);
    span.output = this.tryFilter(span.output);
    span.errorInfo = this.tryFilter(span.errorInfo);
    return span;
  }
  /**
   * Recursively filter objects/arrays for sensitive keys.
   * Handles circular references by replacing with a marker.
   */
  deepFilter(obj, seen = /* @__PURE__ */ new WeakSet()) {
    if (obj === null || typeof obj !== "object") {
      return obj;
    }
    if (seen.has(obj)) {
      return "[Circular Reference]";
    }
    seen.add(obj);
    if (Array.isArray(obj)) {
      return obj.map((item) => this.deepFilter(item, seen));
    }
    const filtered = {};
    for (const key of Object.keys(obj)) {
      const normKey = this.normalizeKey(key);
      if (this.isSensitive(normKey)) {
        if (obj[key] && typeof obj[key] === "object") {
          filtered[key] = this.deepFilter(obj[key], seen);
        } else {
          filtered[key] = this.redactValue(obj[key]);
        }
      } else {
        filtered[key] = this.deepFilter(obj[key], seen);
      }
    }
    return filtered;
  }
  tryFilter(value) {
    try {
      return this.deepFilter(value);
    } catch {
      return { error: { processor: this.name } };
    }
  }
  /**
   * Normalize keys by lowercasing and stripping non-alphanumeric characters.
   * Ensures consistent matching for variants like "api-key", "api_key", "Api Key".
   */
  normalizeKey(key) {
    return key.toLowerCase().replace(/[^a-z0-9]/g, "");
  }
  /**
   * Check whether a normalized key exactly matches any sensitive field.
   * Both key and sensitive fields are normalized by removing all non-alphanumeric
   * characters and converting to lowercase before comparison.
   *
   * Examples:
   * - "api_key", "api-key", "ApiKey" all normalize to "apikey" → MATCHES "apikey"
   * - "promptTokens", "prompt_tokens" normalize to "prompttokens" → DOES NOT MATCH "token"
   */
  isSensitive(normalizedKey) {
    return this.sensitiveFields.some((sensitiveField) => {
      return normalizedKey === sensitiveField;
    });
  }
  /**
   * Redact a sensitive value.
   * - Full style: replaces with a fixed token.
   * - Partial style: shows 3 chars at start and end, hides the middle.
   *
   * Non-string values are converted to strings before partial redaction.
   */
  redactValue(value) {
    if (this.redactionStyle === "full") {
      return this.redactionToken;
    }
    const str = String(value);
    const len = str.length;
    if (len <= 6) {
      return this.redactionToken;
    }
    return str.slice(0, 3) + "\u2026" + str.slice(len - 3);
  }
  async shutdown() {
  }
};

// src/ai-tracing/registry.ts
var AITracingRegistry = class {
  instances = /* @__PURE__ */ new Map();
  defaultInstance;
  configSelector;
  /**
   * Register a tracing instance
   */
  register(name, instance, isDefault = false) {
    if (this.instances.has(name)) {
      throw new Error(`AI Tracing instance '${name}' already registered`);
    }
    this.instances.set(name, instance);
    if (isDefault || !this.defaultInstance) {
      this.defaultInstance = instance;
    }
  }
  /**
   * Get a tracing instance by name
   */
  get(name) {
    return this.instances.get(name);
  }
  /**
   * Get the default tracing instance
   */
  getDefault() {
    return this.defaultInstance;
  }
  /**
   * Set the tracing selector function
   */
  setSelector(selector) {
    this.configSelector = selector;
  }
  /**
   * Get the selected tracing instance based on context
   */
  getSelected(options) {
    if (this.configSelector) {
      const selected = this.configSelector(options, this.instances);
      if (selected && this.instances.has(selected)) {
        return this.instances.get(selected);
      }
    }
    return this.defaultInstance;
  }
  /**
   * Unregister a tracing instance
   */
  unregister(name) {
    return this.instances.delete(name);
  }
  /**
   * Shutdown all instances and clear the registry
   */
  async shutdown() {
    const shutdownPromises = Array.from(this.instances.values()).map((instance) => instance.shutdown());
    await Promise.allSettled(shutdownPromises);
    this.instances.clear();
  }
  /**
   * Clear all instances without shutdown
   */
  clear() {
    this.instances.clear();
    this.defaultInstance = void 0;
    this.configSelector = void 0;
  }
  /**
   * Get all registered instances
   */
  getAll() {
    return new Map(this.instances);
  }
};
var aiTracingRegistry = new AITracingRegistry();
function registerAITracing(name, instance, isDefault = false) {
  aiTracingRegistry.register(name, instance, isDefault);
}
function setSelector(selector) {
  aiTracingRegistry.setSelector(selector);
}
function getSelectedAITracing(options) {
  return aiTracingRegistry.getSelected(options);
}
async function shutdownAITracingRegistry() {
  await aiTracingRegistry.shutdown();
}
function getAllAITracing() {
  return aiTracingRegistry.getAll();
}
function isAITracingInstance(obj) {
  return obj instanceof BaseAITracing;
}
function setupAITracing(config) {
  if (!config) {
    return;
  }
  if (config.default?.enabled && config.configs?.["default"]) {
    throw new Error(
      "Cannot use 'default' as a custom config name when default tracing is enabled. Please rename your custom config to avoid conflicts."
    );
  }
  if (config.default?.enabled) {
    const defaultInstance = new DefaultAITracing({
      serviceName: "mastra",
      name: "default",
      sampling: { type: "always" /* ALWAYS */ },
      exporters: [new DefaultExporter(), new CloudExporter()],
      processors: [new SensitiveDataFilter()]
    });
    registerAITracing("default", defaultInstance, true);
  }
  if (config.configs) {
    const instances = Object.entries(config.configs);
    instances.forEach(([name, tracingDef], index) => {
      const instance = isAITracingInstance(tracingDef) ? tracingDef : new DefaultAITracing({ ...tracingDef, name });
      const isDefault = !config.default?.enabled && index === 0;
      registerAITracing(name, instance, isDefault);
    });
  }
  if (config.configSelector) {
    setSelector(config.configSelector);
  }
}
function selectFields2(obj, fields) {
  if (!obj || typeof obj !== "object") {
    return obj;
  }
  const result = {};
  for (const field of fields) {
    const value = getNestedValue2(obj, field);
    if (value !== void 0) {
      setNestedValue2(result, field, value);
    }
  }
  return result;
}
function getNestedValue2(obj, path) {
  return path.split(".").reduce((current, key) => {
    return current && typeof current === "object" ? current[key] : void 0;
  }, obj);
}
function setNestedValue2(obj, path, value) {
  const keys = path.split(".");
  const lastKey = keys.pop();
  if (!lastKey) {
    return;
  }
  const target = keys.reduce((current, key) => {
    if (!current[key] || typeof current[key] !== "object") {
      current[key] = {};
    }
    return current[key];
  }, obj);
  target[lastKey] = value;
}
function getValidTraceId(span) {
  return span?.isValid ? span.traceId : void 0;
}
function getOrCreateSpan(options) {
  const { type, attributes, tracingContext, runtimeContext, tracingOptions, ...rest } = options;
  const metadata = {
    ...rest.metadata ?? {},
    ...tracingOptions?.metadata ?? {}
  };
  if (tracingContext?.currentSpan) {
    return tracingContext.currentSpan.createChildSpan({
      type,
      attributes,
      ...rest,
      metadata
    });
  }
  const aiTracing = getSelectedAITracing({
    runtimeContext
  });
  return aiTracing?.startSpan({
    type,
    attributes,
    ...rest,
    metadata,
    runtimeContext,
    tracingOptions,
    traceId: tracingOptions?.traceId,
    parentSpanId: tracingOptions?.parentSpanId,
    customSamplerOptions: {
      runtimeContext,
      metadata
    }
  });
}

// src/ai-tracing/tracers/base.ts
var BaseAITracing = class extends MastraBase {
  config;
  constructor(config) {
    super({ component: RegisteredLogger.AI_TRACING, name: config.serviceName });
    this.config = {
      serviceName: config.serviceName,
      name: config.name,
      sampling: config.sampling ?? { type: "always" /* ALWAYS */ },
      exporters: config.exporters ?? [],
      processors: config.processors ?? [],
      includeInternalSpans: config.includeInternalSpans ?? false,
      runtimeContextKeys: config.runtimeContextKeys ?? []
    };
  }
  /**
   * Override setLogger to add AI tracing specific initialization log
   * and propagate logger to exporters
   */
  __setLogger(logger) {
    super.__setLogger(logger);
    this.exporters.forEach((exporter) => {
      if (typeof exporter.__setLogger === "function") {
        exporter.__setLogger(logger);
      }
    });
    this.logger.debug(
      `[AI Tracing] Initialized [service=${this.config.serviceName}] [instance=${this.config.name}] [sampling=${this.config.sampling.type}]`
    );
  }
  // ============================================================================
  // Protected getters for clean config access
  // ============================================================================
  get exporters() {
    return this.config.exporters || [];
  }
  get processors() {
    return this.config.processors || [];
  }
  // ============================================================================
  // Public API - Single type-safe span creation method
  // ============================================================================
  /**
   * Start a new span of a specific AISpanType
   */
  startSpan(options) {
    const { customSamplerOptions, runtimeContext, metadata, tracingOptions, ...rest } = options;
    if (!this.shouldSample(customSamplerOptions)) {
      return new NoOpAISpan({ ...rest, metadata }, this);
    }
    let traceState;
    if (options.parent) {
      traceState = options.parent.traceState;
    } else {
      traceState = this.computeTraceState(tracingOptions);
    }
    const enrichedMetadata = this.extractMetadataFromRuntimeContext(runtimeContext, metadata, traceState);
    const span = this.createSpan({
      ...rest,
      metadata: enrichedMetadata,
      traceState
    });
    if (span.isEvent) {
      this.emitSpanEnded(span);
    } else {
      this.wireSpanLifecycle(span);
      this.emitSpanStarted(span);
    }
    return span;
  }
  // ============================================================================
  // Configuration Management
  // ============================================================================
  /**
   * Get current configuration
   */
  getConfig() {
    return { ...this.config };
  }
  // ============================================================================
  // Plugin Access
  // ============================================================================
  /**
   * Get all exporters
   */
  getExporters() {
    return [...this.exporters];
  }
  /**
   * Get all processors
   */
  getProcessors() {
    return [...this.processors];
  }
  /**
   * Get the logger instance (for exporters and other components)
   */
  getLogger() {
    return this.logger;
  }
  // ============================================================================
  // Span Lifecycle Management
  // ============================================================================
  /**
   * Automatically wires up AI tracing lifecycle events for any span
   * This ensures all spans emit events regardless of implementation
   */
  wireSpanLifecycle(span) {
    if (!this.config.includeInternalSpans && span.isInternal) {
      return;
    }
    const originalEnd = span.end.bind(span);
    const originalUpdate = span.update.bind(span);
    span.end = (options) => {
      if (span.isEvent) {
        this.logger.warn(`End event is not available on event spans`);
        return;
      }
      originalEnd(options);
      this.emitSpanEnded(span);
    };
    span.update = (options) => {
      if (span.isEvent) {
        this.logger.warn(`Update() is not available on event spans`);
        return;
      }
      originalUpdate(options);
      this.emitSpanUpdated(span);
    };
  }
  // ============================================================================
  // Utility Methods
  // ============================================================================
  /**
   * Check if an AI trace should be sampled
   */
  shouldSample(options) {
    const { sampling } = this.config;
    switch (sampling.type) {
      case "always" /* ALWAYS */:
        return true;
      case "never" /* NEVER */:
        return false;
      case "ratio" /* RATIO */:
        if (sampling.probability === void 0 || sampling.probability < 0 || sampling.probability > 1) {
          this.logger.warn(
            `Invalid sampling probability: ${sampling.probability}. Expected value between 0 and 1. Defaulting to no sampling.`
          );
          return false;
        }
        return Math.random() < sampling.probability;
      case "custom" /* CUSTOM */:
        return sampling.sampler(options);
      default:
        throw new Error(`Sampling strategy type not implemented: ${sampling.type}`);
    }
  }
  /**
   * Compute TraceState for a new trace based on configured and per-request keys
   */
  computeTraceState(tracingOptions) {
    const configuredKeys = this.config.runtimeContextKeys ?? [];
    const additionalKeys = tracingOptions?.runtimeContextKeys ?? [];
    const allKeys = [...configuredKeys, ...additionalKeys];
    if (allKeys.length === 0) {
      return void 0;
    }
    return {
      runtimeContextKeys: allKeys
    };
  }
  /**
   * Extract metadata from RuntimeContext using TraceState
   */
  extractMetadataFromRuntimeContext(runtimeContext, explicitMetadata, traceState) {
    if (!runtimeContext || !traceState || traceState.runtimeContextKeys.length === 0) {
      return explicitMetadata;
    }
    const extracted = this.extractKeys(runtimeContext, traceState.runtimeContextKeys);
    if (Object.keys(extracted).length === 0 && !explicitMetadata) {
      return void 0;
    }
    return {
      ...extracted,
      ...explicitMetadata
      // Explicit metadata always wins
    };
  }
  /**
   * Extract specific keys from RuntimeContext
   */
  extractKeys(runtimeContext, keys) {
    const result = {};
    for (const key of keys) {
      const parts = key.split(".");
      const rootKey = parts[0];
      const value = runtimeContext.get(rootKey);
      if (value !== void 0) {
        if (parts.length > 1) {
          const nestedPath = parts.slice(1).join(".");
          const nestedValue = getNestedValue2(value, nestedPath);
          if (nestedValue !== void 0) {
            setNestedValue2(result, key, nestedValue);
          }
        } else {
          setNestedValue2(result, key, value);
        }
      }
    }
    return result;
  }
  /**
   * Process a span through all processors
   */
  processSpan(span) {
    for (const processor of this.processors) {
      if (!span) {
        break;
      }
      try {
        span = processor.process(span);
      } catch (error) {
        this.logger.error(`[AI Tracing] Processor error [name=${processor.name}]`, error);
      }
    }
    return span;
  }
  // ============================================================================
  // Event-driven Export Methods
  // ============================================================================
  getSpanForExport(span) {
    if (!span.isValid) return void 0;
    if (span.isInternal && !this.config.includeInternalSpans) return void 0;
    const processedSpan = this.processSpan(span);
    return processedSpan?.exportSpan(this.config.includeInternalSpans);
  }
  /**
   * Emit a span started event
   */
  emitSpanStarted(span) {
    const exportedSpan = this.getSpanForExport(span);
    if (exportedSpan) {
      this.exportEvent({ type: "span_started" /* SPAN_STARTED */, exportedSpan }).catch((error) => {
        this.logger.error("[AI Tracing] Failed to export span_started event", error);
      });
    }
  }
  /**
   * Emit a span ended event (called automatically when spans end)
   */
  emitSpanEnded(span) {
    const exportedSpan = this.getSpanForExport(span);
    if (exportedSpan) {
      this.exportEvent({ type: "span_ended" /* SPAN_ENDED */, exportedSpan }).catch((error) => {
        this.logger.error("[AI Tracing] Failed to export span_ended event", error);
      });
    }
  }
  /**
   * Emit a span updated event
   */
  emitSpanUpdated(span) {
    const exportedSpan = this.getSpanForExport(span);
    if (exportedSpan) {
      this.exportEvent({ type: "span_updated" /* SPAN_UPDATED */, exportedSpan }).catch((error) => {
        this.logger.error("[AI Tracing] Failed to export span_updated event", error);
      });
    }
  }
  /**
   * Export tracing event through all exporters (realtime mode)
   */
  async exportEvent(event) {
    const exportPromises = this.exporters.map(async (exporter) => {
      try {
        if (exporter.exportEvent) {
          await exporter.exportEvent(event);
          this.logger.debug(`[AI Tracing] Event exported [exporter=${exporter.name}] [type=${event.type}]`);
        }
      } catch (error) {
        this.logger.error(`[AI Tracing] Export error [exporter=${exporter.name}]`, error);
      }
    });
    await Promise.allSettled(exportPromises);
  }
  // ============================================================================
  // Lifecycle Management
  // ============================================================================
  /**
   * Initialize AI tracing (called by Mastra during component registration)
   */
  init() {
    this.logger.debug(`[AI Tracing] Initialization started [name=${this.name}]`);
    this.logger.info(`[AI Tracing] Initialized successfully [name=${this.name}]`);
  }
  /**
   * Shutdown AI tracing and clean up resources
   */
  async shutdown() {
    this.logger.debug(`[AI Tracing] Shutdown started [name=${this.name}]`);
    const shutdownPromises = [...this.exporters.map((e) => e.shutdown()), ...this.processors.map((p) => p.shutdown())];
    await Promise.allSettled(shutdownPromises);
    this.logger.info(`[AI Tracing] Shutdown completed [name=${this.name}]`);
  }
};

// src/ai-tracing/tracers/default.ts
var DefaultAITracing = class extends BaseAITracing {
  constructor(config) {
    super(config);
  }
  createSpan(options) {
    return new DefaultAISpan(options, this);
  }
};

// src/ai-tracing/context.ts
var AGENT_GETTERS = ["getAgent", "getAgentById"];
var AGENT_METHODS_TO_WRAP = ["generate", "stream", "generateLegacy", "streamLegacy"];
var WORKFLOW_GETTERS = ["getWorkflow", "getWorkflowById"];
var WORKFLOW_METHODS_TO_WRAP = ["execute", "createRun", "createRunAsync"];
function isNoOpSpan(span) {
  return span.constructor.name === "NoOpAISpan" || span.__isNoOp === true;
}
function isMastra(mastra) {
  const hasAgentGetters = AGENT_GETTERS.every((method) => typeof mastra?.[method] === "function");
  const hasWorkflowGetters = WORKFLOW_GETTERS.every((method) => typeof mastra?.[method] === "function");
  return hasAgentGetters && hasWorkflowGetters;
}
function wrapMastra(mastra, tracingContext) {
  if (!tracingContext.currentSpan || isNoOpSpan(tracingContext.currentSpan)) {
    return mastra;
  }
  if (!isMastra(mastra)) {
    return mastra;
  }
  try {
    return new Proxy(mastra, {
      get(target, prop) {
        try {
          if (AGENT_GETTERS.includes(prop)) {
            return (...args) => {
              const agent = target[prop](...args);
              return wrapAgent(agent, tracingContext);
            };
          }
          if (WORKFLOW_GETTERS.includes(prop)) {
            return (...args) => {
              const workflow = target[prop](...args);
              return wrapWorkflow(workflow, tracingContext);
            };
          }
          const value = target[prop];
          return typeof value === "function" ? value.bind(target) : value;
        } catch (error) {
          console.warn("AI Tracing: Failed to wrap method, falling back to original", error);
          const value = target[prop];
          return typeof value === "function" ? value.bind(target) : value;
        }
      }
    });
  } catch (error) {
    console.warn("AI Tracing: Failed to create proxy, using original Mastra instance", error);
    return mastra;
  }
}
function wrapAgent(agent, tracingContext) {
  if (!tracingContext.currentSpan || isNoOpSpan(tracingContext.currentSpan)) {
    return agent;
  }
  try {
    return new Proxy(agent, {
      get(target, prop) {
        try {
          if (AGENT_METHODS_TO_WRAP.includes(prop)) {
            return (input, options = {}) => {
              return target[prop](input, {
                ...options,
                tracingContext
              });
            };
          }
          const value = target[prop];
          return typeof value === "function" ? value.bind(target) : value;
        } catch (error) {
          console.warn("AI Tracing: Failed to wrap agent method, falling back to original", error);
          const value = target[prop];
          return typeof value === "function" ? value.bind(target) : value;
        }
      }
    });
  } catch (error) {
    console.warn("AI Tracing: Failed to create agent proxy, using original instance", error);
    return agent;
  }
}
function wrapWorkflow(workflow, tracingContext) {
  if (!tracingContext.currentSpan || isNoOpSpan(tracingContext.currentSpan)) {
    return workflow;
  }
  try {
    return new Proxy(workflow, {
      get(target, prop) {
        try {
          if (WORKFLOW_METHODS_TO_WRAP.includes(prop)) {
            if (prop === "createRun" || prop === "createRunAsync") {
              return async (options = {}) => {
                const run = await target[prop](options);
                return run ? wrapRun(run, tracingContext) : run;
              };
            }
            return (input, options = {}) => {
              return target[prop](input, {
                ...options,
                tracingContext
              });
            };
          }
          const value = target[prop];
          return typeof value === "function" ? value.bind(target) : value;
        } catch (error) {
          console.warn("AI Tracing: Failed to wrap workflow method, falling back to original", error);
          const value = target[prop];
          return typeof value === "function" ? value.bind(target) : value;
        }
      }
    });
  } catch (error) {
    console.warn("AI Tracing: Failed to create workflow proxy, using original instance", error);
    return workflow;
  }
}
function wrapRun(run, tracingContext) {
  if (!tracingContext.currentSpan || isNoOpSpan(tracingContext.currentSpan)) {
    return run;
  }
  try {
    return new Proxy(run, {
      get(target, prop) {
        try {
          if (prop === "start") {
            return (startOptions = {}) => {
              return target.start({
                ...startOptions,
                tracingContext: startOptions.tracingContext ?? tracingContext
              });
            };
          }
          const value = target[prop];
          return typeof value === "function" ? value.bind(target) : value;
        } catch (error) {
          console.warn("AI Tracing: Failed to wrap run method, falling back to original", error);
          const value = target[prop];
          return typeof value === "function" ? value.bind(target) : value;
        }
      }
    });
  } catch (error) {
    console.warn("AI Tracing: Failed to create run proxy, using original instance", error);
    return run;
  }
}
var ModelSpanTracker = class {
  #modelSpan;
  #currentStepSpan;
  #currentChunkSpan;
  #accumulator = {};
  #stepIndex = 0;
  #chunkSequence = 0;
  constructor(modelSpan) {
    this.#modelSpan = modelSpan;
  }
  /**
   * Get the tracing context for creating child spans.
   * Returns the current step span if active, otherwise the model span.
   */
  getTracingContext() {
    return {
      currentSpan: this.#currentStepSpan ?? this.#modelSpan
    };
  }
  /**
   * Report an error on the generation span
   */
  reportGenerationError(options) {
    this.#modelSpan?.error(options);
  }
  /**
   * End the generation span
   */
  endGeneration(options) {
    this.#modelSpan?.end(options);
  }
  /**
   * Update the generation span
   */
  updateGeneration(options) {
    this.#modelSpan?.update(options);
  }
  /**
   * Start a new Model execution step
   */
  #startStepSpan(payload) {
    this.#currentStepSpan = this.#modelSpan?.createChildSpan({
      name: `step: ${this.#stepIndex}`,
      type: "model_step" /* MODEL_STEP */,
      attributes: {
        stepIndex: this.#stepIndex,
        ...payload?.messageId ? { messageId: payload.messageId } : {},
        ...payload?.warnings?.length ? { warnings: payload.warnings } : {}
      },
      input: payload?.request
    });
    this.#chunkSequence = 0;
  }
  /**
   * End the current Model execution step with token usage, finish reason, output, and metadata
   */
  #endStepSpan(payload) {
    if (!this.#currentStepSpan) return;
    const output = payload.output;
    const { usage, ...otherOutput } = output;
    const stepResult = payload.stepResult;
    const metadata = payload.metadata;
    const cleanMetadata = metadata ? { ...metadata } : void 0;
    if (cleanMetadata?.request) {
      delete cleanMetadata.request;
    }
    this.#currentStepSpan.end({
      output: otherOutput,
      attributes: {
        usage,
        isContinued: stepResult.isContinued,
        finishReason: stepResult.reason,
        warnings: stepResult.warnings
      },
      metadata: {
        ...cleanMetadata
      }
    });
    this.#currentStepSpan = void 0;
    this.#stepIndex++;
  }
  /**
   * Create a new chunk span (for multi-part chunks like text-start/delta/end)
   */
  #startChunkSpan(chunkType, initialData) {
    if (!this.#currentStepSpan) {
      this.#startStepSpan();
    }
    this.#currentChunkSpan = this.#currentStepSpan?.createChildSpan({
      name: `chunk: '${chunkType}'`,
      type: "model_chunk" /* MODEL_CHUNK */,
      attributes: {
        chunkType,
        sequenceNumber: this.#chunkSequence
      }
    });
    this.#accumulator = initialData || {};
  }
  /**
   * Append string content to a specific field in the accumulator
   */
  #appendToAccumulator(field, text) {
    if (this.#accumulator[field] === void 0) {
      this.#accumulator[field] = text;
    } else {
      this.#accumulator[field] += text;
    }
  }
  /**
   * End the current chunk span.
   * Safe to call multiple times - will no-op if span already ended.
   */
  #endChunkSpan(output) {
    if (!this.#currentChunkSpan) return;
    this.#currentChunkSpan.end({
      output: output !== void 0 ? output : this.#accumulator
    });
    this.#currentChunkSpan = void 0;
    this.#accumulator = {};
    this.#chunkSequence++;
  }
  /**
   * Create an event span (for single chunks like tool-call)
   */
  #createEventSpan(chunkType, output) {
    if (!this.#currentStepSpan) {
      this.#startStepSpan();
    }
    const span = this.#currentStepSpan?.createEventSpan({
      name: `chunk: '${chunkType}'`,
      type: "model_chunk" /* MODEL_CHUNK */,
      attributes: {
        chunkType,
        sequenceNumber: this.#chunkSequence
      },
      output
    });
    if (span) {
      this.#chunkSequence++;
    }
  }
  /**
   * Check if there is currently an active chunk span
   */
  #hasActiveChunkSpan() {
    return !!this.#currentChunkSpan;
  }
  /**
   * Get the current accumulator value
   */
  #getAccumulator() {
    return this.#accumulator;
  }
  /**
   * Handle text chunk spans (text-start/delta/end)
   */
  #handleTextChunk(chunk) {
    switch (chunk.type) {
      case "text-start":
        this.#startChunkSpan("text");
        break;
      case "text-delta":
        this.#appendToAccumulator("text", chunk.payload.text);
        break;
      case "text-end": {
        this.#endChunkSpan();
        break;
      }
    }
  }
  /**
   * Handle reasoning chunk spans (reasoning-start/delta/end)
   */
  #handleReasoningChunk(chunk) {
    switch (chunk.type) {
      case "reasoning-start":
        this.#startChunkSpan("reasoning");
        break;
      case "reasoning-delta":
        this.#appendToAccumulator("text", chunk.payload.text);
        break;
      case "reasoning-end": {
        this.#endChunkSpan();
        break;
      }
    }
  }
  /**
   * Handle tool call chunk spans (tool-call-input-streaming-start/delta/end, tool-call)
   */
  #handleToolCallChunk(chunk) {
    switch (chunk.type) {
      case "tool-call-input-streaming-start":
        this.#startChunkSpan("tool-call", {
          toolName: chunk.payload.toolName,
          toolCallId: chunk.payload.toolCallId
        });
        break;
      case "tool-call-delta":
        this.#appendToAccumulator("toolInput", chunk.payload.argsTextDelta);
        break;
      case "tool-call-input-streaming-end":
      case "tool-call": {
        const acc = this.#getAccumulator();
        let toolInput;
        try {
          toolInput = acc.toolInput ? JSON.parse(acc.toolInput) : {};
        } catch {
          toolInput = acc.toolInput;
        }
        this.#endChunkSpan({
          toolName: acc.toolName,
          toolCallId: acc.toolCallId,
          toolInput
        });
        break;
      }
    }
  }
  /**
   * Handle object chunk spans (object, object-result)
   */
  #handleObjectChunk(chunk) {
    switch (chunk.type) {
      case "object":
        if (!this.#hasActiveChunkSpan()) {
          this.#startChunkSpan("object");
        }
        break;
      case "object-result":
        this.#endChunkSpan(chunk.object);
        break;
    }
  }
  /**
   * Wraps a stream with model tracing transform to track MODEL_STEP and MODEL_CHUNK spans.
   *
   * This should be added to the stream pipeline to automatically
   * create MODEL_STEP and MODEL_CHUNK spans for each semantic unit in the stream.
   */
  wrapStream(stream) {
    return stream.pipeThrough(
      new TransformStream$1({
        transform: (chunk, controller) => {
          controller.enqueue(chunk);
          switch (chunk.type) {
            case "text-start":
            case "text-delta":
            case "text-end":
              this.#handleTextChunk(chunk);
              break;
            case "tool-call-input-streaming-start":
            case "tool-call-delta":
            case "tool-call-input-streaming-end":
            case "tool-call":
              this.#handleToolCallChunk(chunk);
              break;
            case "reasoning-start":
            case "reasoning-delta":
            case "reasoning-end":
              this.#handleReasoningChunk(chunk);
              break;
            case "object":
            case "object-result":
              this.#handleObjectChunk(chunk);
              break;
            case "step-start":
              this.#startStepSpan(chunk.payload);
              break;
            case "step-finish":
              this.#endStepSpan(chunk.payload);
              break;
            case "raw":
            // Skip raw chunks as they're redundant
            case "start":
            case "finish":
              break;
            // Default: auto-create event span for all other chunk types
            default: {
              let outputPayload = chunk.payload;
              if (outputPayload && typeof outputPayload === "object" && "data" in outputPayload) {
                const typedPayload = outputPayload;
                outputPayload = { ...typedPayload };
                if (typedPayload.data) {
                  outputPayload.size = typeof typedPayload.data === "string" ? typedPayload.data.length : typedPayload.data instanceof Uint8Array ? typedPayload.data.length : void 0;
                  delete outputPayload.data;
                }
              }
              this.#createEventSpan(chunk.type, outputPayload);
              break;
            }
          }
        }
      })
    );
  }
};

export { AISpanType as A, DeepSeekSchemaCompatLayer as D, GoogleSchemaCompatLayer as G, MetaSchemaCompatLayer as M, OpenAIReasoningSchemaCompatLayer as O, ToolStream as T, getAllAITracing as a, shutdownAITracingRegistry as b, checkEvalStorageFields as c, deepMerge as d, OpenAISchemaCompatLayer as e, AnthropicSchemaCompatLayer as f, generateEmptyFromSchema as g, applyCompatLayer as h, isZodType as i, delay as j, getOrCreateSpan as k, getValidTraceId as l, ensureToolProperties as m, makeCoreTool as n, createMastraProxy as o, selectFields2 as p, ModelSpanTracker as q, removeUndefinedValues as r, setupAITracing as s, fetchWithRetry as t, parseFieldKey as u, parseSqlIdentifier as v, wrapMastra as w };
//# sourceMappingURL=chunk-PPAIPZ6C.mjs.map
