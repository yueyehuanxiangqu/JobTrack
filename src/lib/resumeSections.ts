import { APP_CONSTANTS } from "@/lib/constants";

export const hasMinResumeSections = (
  sectionCount: number | null | undefined,
): boolean =>
  (sectionCount ?? 0) >= APP_CONSTANTS.MIN_RESUME_SECTIONS_FOR_SELECTION;

// File-backed resumes do not require the retired structured builder. Legacy
// structured resumes remain selectable and exportable without changing rows.
export const isSelectableResume = (resume: {
  FileId?: string | null;
  File?: { filePath?: string } | null;
  sectionCount?: number;
  _count?: { ResumeSections?: number };
}): boolean => Boolean(resume.FileId || resume.File?.filePath) ||
  hasMinResumeSections(resume.sectionCount ?? resume._count?.ResumeSections);

export const buildInsufficientSectionsMessage = (
  action: string,
  hint?: string,
): string => {
  const min = APP_CONSTANTS.MIN_RESUME_SECTIONS_FOR_SELECTION;
  return `Add at least ${min} sections${
    hint ? ` (${hint})` : ""
  } before ${action}.`;
};

export const buildIncompleteResumeHint = (): string =>
  `Upload a CV file, or choose a legacy structured resume with at least ${APP_CONSTANTS.MIN_RESUME_SECTIONS_FOR_SELECTION} sections.`;
