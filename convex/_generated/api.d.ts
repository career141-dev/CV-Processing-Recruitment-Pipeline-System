/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as candidates from "../candidates/index.js";
import type * as cvs_cvExtraction from "../cvs/cvExtraction.js";
import type * as cvs_cvScoring from "../cvs/cvScoring.js";
import type * as cvs_cvScoringActions from "../cvs/cvScoringActions.js";
import type * as cvs_cvUploads from "../cvs/cvUploads.js";
import type * as communications_emailAgent from "../communications/emailAgent.js";
import type * as communications_whatsappAgent from "../communications/whatsappAgent.js";
import type * as fix from "../fix.js";
import type * as http from "../http.js";
import type * as integrations_workable from "../integrations/workable.js";
import type * as integrations_workableActions from "../integrations/workableActions.js";
import type * as jobs from "../jobs/index.js";
import type * as lib_activityLog from "../lib/activityLog.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_jdParser from "../lib/jdParser.js";
import type * as lib_llm from "../lib/llm.js";
import type * as lib_validate from "../lib/validate.js";
import type * as pipeline_ingestion from "../pipeline/ingestion.js";
import type * as pipeline_outreach from "../pipeline/outreach.js";
import type * as search from "../search/index.js";
import type * as stats from "../stats.js";
import type * as tier2Derivations from "../tier2Derivations.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  candidates: typeof candidates;
  "cvs/cvExtraction": typeof cvs_cvExtraction;
  "cvs/cvScoring": typeof cvs_cvScoring;
  "cvs/cvScoringActions": typeof cvs_cvScoringActions;
  "cvs/cvUploads": typeof cvs_cvUploads;
  "communications/emailAgent": typeof communications_emailAgent;
  "communications/whatsappAgent": typeof communications_whatsappAgent;
  fix: typeof fix;
  http: typeof http;
  "integrations/workable": typeof integrations_workable;
  "integrations/workableActions": typeof integrations_workableActions;
  jobs: typeof jobs;
  "lib/activityLog": typeof lib_activityLog;
  "lib/auth": typeof lib_auth;
  "lib/jdParser": typeof lib_jdParser;
  "lib/llm": typeof lib_llm;
  "lib/validate": typeof lib_validate;
  "pipeline/ingestion": typeof pipeline_ingestion;
  "pipeline/outreach": typeof pipeline_outreach;
  search: typeof search;
  stats: typeof stats;
  tier2Derivations: typeof tier2Derivations;
  users: typeof users;
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
