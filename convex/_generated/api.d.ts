/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as candidates from "../candidates.js";
import type * as cvExtraction from "../cvExtraction.js";
import type * as cvScoring from "../cvScoring.js";
import type * as cvUploads from "../cvUploads.js";
import type * as jdParser from "../jdParser.js";
import type * as llm from "../llm.js";
import type * as search from "../search.js";
import type * as stats from "../stats.js";
import type * as workable from "../workable.js";
import type * as workableActions from "../workableActions.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  candidates: typeof candidates;
  cvExtraction: typeof cvExtraction;
  cvScoring: typeof cvScoring;
  cvUploads: typeof cvUploads;
  jdParser: typeof jdParser;
  llm: typeof llm;
  search: typeof search;
  stats: typeof stats;
  workable: typeof workable;
  workableActions: typeof workableActions;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
