/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as agent2_matching from "../agent2_matching.js";
import type * as agent2_matching_queries from "../agent2_matching_queries.js";
import type * as applications from "../applications.js";
import type * as candidateProfile from "../candidateProfile.js";
import type * as candidates from "../candidates.js";
import type * as cleanup from "../cleanup.js";
import type * as communications_emailAgent from "../communications/emailAgent.js";
import type * as communications_metaWhatsappAgent from "../communications/metaWhatsappAgent.js";
import type * as communications_whatsappAgent from "../communications/whatsappAgent.js";
import type * as communications_whatsappOutbound from "../communications/whatsappOutbound.js";
import type * as crons from "../crons.js";
import type * as cvs_cvExtraction from "../cvs/cvExtraction.js";
import type * as cvs_cvScoring from "../cvs/cvScoring.js";
import type * as cvs_cvScoringActions from "../cvs/cvScoringActions.js";
import type * as cvs_cvUploads from "../cvs/cvUploads.js";
import type * as cvs_ingestion from "../cvs/ingestion.js";
import type * as cvs_lazyParsing from "../cvs/lazyParsing.js";
import type * as fix from "../fix.js";
import type * as http from "../http.js";
import type * as ingestionBatches from "../ingestionBatches.js";
import type * as integrations_elevenlabs from "../integrations/elevenlabs.js";
import type * as integrations_workable from "../integrations/workable.js";
import type * as integrations_workableActions from "../integrations/workableActions.js";
import type * as jobAssignments from "../jobAssignments.js";
import type * as jobs from "../jobs.js";
import type * as lib_activityLog from "../lib/activityLog.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_jdParser from "../lib/jdParser.js";
import type * as lib_llm from "../lib/llm.js";
import type * as lib_permissions from "../lib/permissions.js";
import type * as lib_validate from "../lib/validate.js";
import type * as lib_webhookSecurity from "../lib/webhookSecurity.js";
import type * as pipeline_followUpHelper from "../pipeline/followUpHelper.js";
import type * as pipeline_headhunt from "../pipeline/headhunt.js";
import type * as pipeline_ingestion from "../pipeline/ingestion.js";
import type * as pipeline_outreach from "../pipeline/outreach.js";
import type * as pipeline_stages from "../pipeline/stages.js";
import type * as reverseMatch from "../reverseMatch.js";
import type * as scratch from "../scratch.js";
import type * as search from "../search.js";
import type * as stats from "../stats.js";
import type * as tier2Derivations from "../tier2Derivations.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  agent2_matching: typeof agent2_matching;
  agent2_matching_queries: typeof agent2_matching_queries;
  applications: typeof applications;
  candidateProfile: typeof candidateProfile;
  candidates: typeof candidates;
  cleanup: typeof cleanup;
  "communications/emailAgent": typeof communications_emailAgent;
  "communications/metaWhatsappAgent": typeof communications_metaWhatsappAgent;
  "communications/whatsappAgent": typeof communications_whatsappAgent;
  "communications/whatsappOutbound": typeof communications_whatsappOutbound;
  crons: typeof crons;
  "cvs/cvExtraction": typeof cvs_cvExtraction;
  "cvs/cvScoring": typeof cvs_cvScoring;
  "cvs/cvScoringActions": typeof cvs_cvScoringActions;
  "cvs/cvUploads": typeof cvs_cvUploads;
  "cvs/ingestion": typeof cvs_ingestion;
  "cvs/lazyParsing": typeof cvs_lazyParsing;
  fix: typeof fix;
  http: typeof http;
  ingestionBatches: typeof ingestionBatches;
  "integrations/elevenlabs": typeof integrations_elevenlabs;
  "integrations/workable": typeof integrations_workable;
  "integrations/workableActions": typeof integrations_workableActions;
  jobAssignments: typeof jobAssignments;
  jobs: typeof jobs;
  "lib/activityLog": typeof lib_activityLog;
  "lib/auth": typeof lib_auth;
  "lib/jdParser": typeof lib_jdParser;
  "lib/llm": typeof lib_llm;
  "lib/permissions": typeof lib_permissions;
  "lib/validate": typeof lib_validate;
  "lib/webhookSecurity": typeof lib_webhookSecurity;
  "pipeline/followUpHelper": typeof pipeline_followUpHelper;
  "pipeline/headhunt": typeof pipeline_headhunt;
  "pipeline/ingestion": typeof pipeline_ingestion;
  "pipeline/outreach": typeof pipeline_outreach;
  "pipeline/stages": typeof pipeline_stages;
  reverseMatch: typeof reverseMatch;
  scratch: typeof scratch;
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
