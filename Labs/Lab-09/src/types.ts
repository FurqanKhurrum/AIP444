import { z } from "zod";

export const CredibilityEvaluationSchema = z.object({
  source_url: z.string().describe("The URL being evaluated"),

  source_type: z
    .enum([
      "peer_reviewed_journal",
      "news_organization",
      "government_agency",
      "nonprofit_organization",
      "corporate_blog",
      "personal_blog",
      "social_media",
      "wiki",
      "unknown",
    ])
    .describe("The type of source based on your investigation"),

  author: z.object({
    name: z
      .string()
      .describe(
        "Author's full name. If unknown after investigation, write 'Unknown' and explain what you checked"
      ),
    credentials: z
      .string()
      .describe(
        "Author's qualifications and expertise. If not found, describe what you searched for"
      ),
    credibility_assessment: z
      .string()
      .describe(
        "Your assessment of the author's credibility based on your research"
      ),
  }),

  publication: z.object({
    name: z
      .string()
      .describe(
        "Publication or website name. If not a recognized outlet, use the domain name"
      ),
    reputation: z
      .string()
      .describe(
        "What your research revealed about this publication's reputation and standards"
      ),
    editorial_process: z
      .enum(["peer_reviewed", "editor_reviewed", "self_published", "unknown"])
      .describe("The editorial review process of the publication"),
  }),

  content_analysis: z.object({
    claims_supported_by_evidence: z
      .boolean()
      .describe(
        "Are the main claims backed by data, citations, or primary sources?"
      ),
    sources_cited: z
      .boolean()
      .describe("Does the article cite its sources?"),
    corroborated_by_other_sources: z
      .boolean()
      .describe(
        "Did you find other credible sources reporting the same claims?"
      ),
    contradicted_by_other_sources: z
      .boolean()
      .describe("Did you find credible sources that contradict the claims?"),
    language_is_objective: z
      .boolean()
      .describe(
        "Is the tone neutral and factual, or emotional and persuasive?"
      ),
    date_published: z
      .string()
      .describe("When was this published? Note if the information may be outdated"),
  }),

  overall_credibility: z
    .enum(["high", "medium", "low", "very_low"])
    .describe("Your overall credibility rating based on all findings"),

  reasoning: z
    .string()
    .describe(
      "Explain your overall credibility rating, citing specific evidence from your research"
    ),
});

export type CredibilityEvaluation = z.infer<typeof CredibilityEvaluationSchema>;