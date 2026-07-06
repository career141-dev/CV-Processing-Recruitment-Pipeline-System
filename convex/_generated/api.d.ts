/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin_cleanup from "../admin/cleanup.js";
import type * as admin_fix from "../admin/fix.js";
import type * as admin_scratch from "../admin/scratch.js";
import type * as analytics from "../analytics.js";
import type * as applications_applications from "../applications/applications.js";
import type * as candidates_candidates from "../candidates/candidates.js";
import type * as candidates_derivations from "../candidates/derivations.js";
import type * as candidates_profile from "../candidates/profile.js";
import type * as communications_emailAgent from "../communications/emailAgent.js";
import type * as communications_graphEmail from "../communications/graphEmail.js";
import type * as communications_graphEmailMutations from "../communications/graphEmailMutations.js";
import type * as communications_graphSubscriptionQueries from "../communications/graphSubscriptionQueries.js";
import type * as communications_graphSubscriptions from "../communications/graphSubscriptions.js";
import type * as communications_inboundExtraction from "../communications/inboundExtraction.js";
import type * as communications_localWhatsappAgent from "../communications/localWhatsappAgent.js";
import type * as communications_metaWhatsappAgent from "../communications/metaWhatsappAgent.js";
import type * as communications_whatchimp from "../communications/whatchimp.js";
import type * as communications_whatsappAgent from "../communications/whatsappAgent.js";
import type * as communications_whatsappOutbound from "../communications/whatsappOutbound.js";
import type * as crons from "../crons.js";
import type * as cvs_batches from "../cvs/batches.js";
import type * as cvs_cvExtraction from "../cvs/cvExtraction.js";
import type * as cvs_cvScoring from "../cvs/cvScoring.js";
import type * as cvs_cvScoringActions from "../cvs/cvScoringActions.js";
import type * as cvs_cvUploads from "../cvs/cvUploads.js";
import type * as cvs_ingestion from "../cvs/ingestion.js";
import type * as cvs_lazyParsing from "../cvs/lazyParsing.js";
import type * as http from "../http.js";
import type * as integrations_elevenlabs from "../integrations/elevenlabs.js";
import type * as integrations_workable from "../integrations/workable.js";
import type * as integrations_workableActions from "../integrations/workableActions.js";
import type * as jobs_assignments from "../jobs/assignments.js";
import type * as jobs_jobs from "../jobs/jobs.js";
import type * as lib_activityLog from "../lib/activityLog.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_graphClient from "../lib/graphClient.js";
import type * as lib_jdParser from "../lib/jdParser.js";
import type * as lib_llm from "../lib/llm.js";
import type * as lib_permissions from "../lib/permissions.js";
import type * as lib_validate from "../lib/validate.js";
import type * as lib_webhookSecurity from "../lib/webhookSecurity.js";
import type * as matching_agent2 from "../matching/agent2.js";
import type * as matching_queries from "../matching/queries.js";
import type * as matching_reverse from "../matching/reverse.js";
import type * as matching_search from "../matching/search.js";
import type * as pipeline_followUpHelper from "../pipeline/followUpHelper.js";
import type * as pipeline_headhunt from "../pipeline/headhunt.js";
import type * as pipeline_ingestion from "../pipeline/ingestion.js";
import type * as pipeline_outreach from "../pipeline/outreach.js";
import type * as pipeline_stages from "../pipeline/stages.js";
import type * as stats_stats from "../stats/stats.js";
import type * as users_users from "../users/users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "admin/cleanup": typeof admin_cleanup;
  "admin/fix": typeof admin_fix;
  "admin/scratch": typeof admin_scratch;
  analytics: typeof analytics;
  "applications/applications": typeof applications_applications;
  "candidates/candidates": typeof candidates_candidates;
  "candidates/derivations": typeof candidates_derivations;
  "candidates/profile": typeof candidates_profile;
  "communications/emailAgent": typeof communications_emailAgent;
  "communications/graphEmail": typeof communications_graphEmail;
  "communications/graphEmailMutations": typeof communications_graphEmailMutations;
  "communications/graphSubscriptionQueries": typeof communications_graphSubscriptionQueries;
  "communications/graphSubscriptions": typeof communications_graphSubscriptions;
  "communications/inboundExtraction": typeof communications_inboundExtraction;
  "communications/localWhatsappAgent": typeof communications_localWhatsappAgent;
  "communications/metaWhatsappAgent": typeof communications_metaWhatsappAgent;
  "communications/whatchimp": typeof communications_whatchimp;
  "communications/whatsappAgent": typeof communications_whatsappAgent;
  "communications/whatsappOutbound": typeof communications_whatsappOutbound;
  crons: typeof crons;
  "cvs/batches": typeof cvs_batches;
  "cvs/cvExtraction": typeof cvs_cvExtraction;
  "cvs/cvScoring": typeof cvs_cvScoring;
  "cvs/cvScoringActions": typeof cvs_cvScoringActions;
  "cvs/cvUploads": typeof cvs_cvUploads;
  "cvs/ingestion": typeof cvs_ingestion;
  "cvs/lazyParsing": typeof cvs_lazyParsing;
  http: typeof http;
  "integrations/elevenlabs": typeof integrations_elevenlabs;
  "integrations/workable": typeof integrations_workable;
  "integrations/workableActions": typeof integrations_workableActions;
  "jobs/assignments": typeof jobs_assignments;
  "jobs/jobs": typeof jobs_jobs;
  "lib/activityLog": typeof lib_activityLog;
  "lib/auth": typeof lib_auth;
  "lib/graphClient": typeof lib_graphClient;
  "lib/jdParser": typeof lib_jdParser;
  "lib/llm": typeof lib_llm;
  "lib/permissions": typeof lib_permissions;
  "lib/validate": typeof lib_validate;
  "lib/webhookSecurity": typeof lib_webhookSecurity;
  "matching/agent2": typeof matching_agent2;
  "matching/queries": typeof matching_queries;
  "matching/reverse": typeof matching_reverse;
  "matching/search": typeof matching_search;
  "pipeline/followUpHelper": typeof pipeline_followUpHelper;
  "pipeline/headhunt": typeof pipeline_headhunt;
  "pipeline/ingestion": typeof pipeline_ingestion;
  "pipeline/outreach": typeof pipeline_outreach;
  "pipeline/stages": typeof pipeline_stages;
  "stats/stats": typeof stats_stats;
  "users/users": typeof users_users;
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
