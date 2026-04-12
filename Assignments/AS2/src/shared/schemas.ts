// src/shared/schemas.ts
import { z } from 'zod';

// Helper: accept string or array-of-strings, always store as string
const flexString = z.union([
  z.string(),
  z.array(z.string()).transform((a) => a.join(' ')),
  z.null().transform(() => null),
]).nullable();

// Helper: accept number, numeric-string ("3-5" -> 3), or null
const flexNumber = z.union([
  z.number(),
  z.string().transform((s) => { const n = parseFloat(s); return isNaN(n) ? null : n; }),
  z.null(),
]);

// ─── Job Posting ─────────────────────────────────────────────────────────────

export const JobPostingSchema = z.object({
  title:               z.string().nullable().transform((v) => v ?? 'Unknown Title'),
  company:             z.string().nullable().transform((v) => v ?? 'Unknown Company'),
  location:            flexString,
  remoteStatus:        z.enum(['remote', 'hybrid', 'onsite', 'not listed']).catch('not listed'),
  requiredSkills:      z.array(z.string()).default([]),
  preferredSkills:     z.array(z.string()).default([]),
  experienceYears:     flexNumber,
  seniorityLevel:      z.enum(['junior', 'mid', 'senior', 'lead', 'not listed']).catch('not listed'),
  educationRequired:   flexString,
  salaryRange: z.object({
    min:      flexNumber,
    max:      flexNumber,
    currency: flexString,
  }).catch({ min: null, max: null, currency: null }),
  keyResponsibilities: z.array(z.string()).default([]),
  companyResearch: z.object({
    size:       flexString,
    industry:   flexString,
    recentNews: flexString,
    culture:    flexString,
  }).nullable().catch(null),
});

export type JobPosting = z.infer<typeof JobPostingSchema>;

// ─── Resume ──────────────────────────────────────────────────────────────────

export const ResumeSchema = z.object({
  hardSkills:     z.array(z.string()).default([]),
  softSkills:     z.array(z.string()).default([]),
  workExperience: z.array(z.object({
    role:          z.string(),
    company:       z.string(),
    durationYears: flexNumber,
    highlights:    z.array(z.string()).default([]),
  })).default([]),
  education: z.array(z.object({
    degree:      z.string(),
    institution: z.string(),
  })).default([]),
  certifications: z.array(z.string()).default([]),
  projects: z.array(z.object({
    name:         z.string(),
    description:  z.string(),
    technologies: z.array(z.string()).default([]),
  })).default([]),
  keywords: z.array(z.string()).default([]),
});

export type Resume = z.infer<typeof ResumeSchema>;

// ─── Gap Analysis ─────────────────────────────────────────────────────────────

export const GapSchema = z.object({
  skill:     z.string(),
  frequency: z.number(),
  level:     z.enum(['quick-win', 'short-term', 'medium-term', 'long-term']),
  action:    z.string(),
});

export const GapAnalysisSchema = z.object({
  strengths:   z.array(z.string()).default([]),
  gaps:        z.array(GapSchema).default([]),
  uniqueValue: z.array(z.string()).default([]),
});

export type GapAnalysis = z.infer<typeof GapAnalysisSchema>;