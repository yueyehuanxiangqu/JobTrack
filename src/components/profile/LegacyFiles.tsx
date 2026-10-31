"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { getResumeList, getDefaultContactInfo } from "@/actions/profile.actions";
import { getCoverLetterList } from "@/actions/coverLetter.actions";
import { Resume, CoverLetter, ContactInfo } from "@/models/profile.model";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { TipTapContentViewer } from "../TipTapContentViewer";
import { CoverLetterExportDialog } from "./CoverLetterExportDialog";

export default function LegacyFiles() {
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [letters, setLetters] = useState<CoverLetter[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [letter, setLetter] = useState<CoverLetter | null>(null);
  const [contactInfo, setContactInfo] = useState<ContactInfo | null>(null);
  useEffect(() => {
    let active = true;
    setBusy(true);
    Promise.all([getResumeList(page, 25), getCoverLetterList(page, 25), getDefaultContactInfo()]).then(([cv, cover, info]) => {
      if (!active) return;
      if (!cv?.success || !cover?.success) throw new Error();
      setResumes(cv.data); setLetters(cover.data); setTotal(Math.max(cv.total, cover.total));
      setContactInfo(info ?? null); setError("");
    }).catch(() => { if (active) setError("Could not load legacy files. Reopen this page to retry."); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [page]);
  return <Card className="col-span-3">
    <CardHeader><CardTitle>Legacy Files</CardTitle></CardHeader>
    <CardContent className="space-y-4">
      <p className="text-sm text-muted-foreground">Your existing library is preserved here for viewing, downloading and PDF export. New CV and Cover Letter files belong in each job&apos;s Documents section. Legacy files are not automatically moved or assigned.</p>
      {busy && <p>Loading…</p>}{error && <p role="alert">{error}</p>}
      {!busy && !error && !resumes.length && !letters.length && <p>No legacy files.</p>}
      {resumes.map((resume) => <div key={resume.id} className="space-y-2 rounded-md border p-3">
        <Link className="font-medium underline" href={`/dashboard/profile/resume/${resume.id}`}>{resume.title}</Link>
        {resume.FileId && <div><a className="text-sm underline" href={`/api/profile/resume?resumeId=${encodeURIComponent(resume.id!)}`} download>Download {resume.File?.fileName ?? resume.title}</a></div>}
      </div>)}
      {letters.map((cover) => <details key={cover.id} className="space-y-2 rounded-md border p-3"><summary className="cursor-pointer font-medium">{cover.title}</summary>
        <TipTapContentViewer content={cover.content} />
        <Button type="button" variant="outline" onClick={() => setLetter(cover)}>Export PDF</Button>
      </details>)}
      <div className="flex items-center gap-2"><Button type="button" variant="outline" disabled={page === 1 || busy} onClick={() => setPage((p) => p - 1)}>Previous</Button><span>Page {page}</span><Button type="button" variant="outline" disabled={page * 25 >= total || busy} onClick={() => setPage((p) => p + 1)}>Next</Button></div>
      <CoverLetterExportDialog open={!!letter} onOpenChange={(open) => { if (!open) setLetter(null); }} letter={letter} contactInfo={contactInfo} />
    </CardContent>
  </Card>;
}
