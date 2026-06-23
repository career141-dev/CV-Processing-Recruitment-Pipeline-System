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
import type * as cvScoringActions from "../cvScoringActions.js";
import type * as cvUploads from "../cvUploads.js";
import type * as emailAgent from "../emailAgent.js";
import type * as http from "../http.js";
import type * as ingestion from "../ingestion.js";
import type * as jdParser from "../jdParser.js";
import type * as jobs from "../jobs.js";
import type * as lib_activityLog from "../lib/activityLog.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_validate from "../lib/validate.js";
import type * as llm from "../llm.js";
import type * as outreach from "../outreach.js";
import type * as search from "../search.js";
import type * as users from "../users.js";
import type * as whatsappAgent from "../whatsappAgent.js";
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
  cvScoringActions: typeof cvScoringActions;
  cvUploads: typeof cvUploads;
  emailAgent: typeof emailAgent;
  http: typeof http;
  ingestion: typeof ingestion;
  jdParser: typeof jdParser;
  jobs: typeof jobs;
  "lib/activityLog": typeof lib_activityLog;
  "lib/auth": typeof lib_auth;
  "lib/validate": typeof lib_validate;
  llm: typeof llm;
  outreach: typeof outreach;
  search: typeof search;
  users: typeof users;
  whatsappAgent: typeof whatsappAgent;
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
