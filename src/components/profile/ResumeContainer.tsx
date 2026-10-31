"use client";
import type { Resume } from "@/models/profile.model";
import { ArrowLeft,MoreVertical } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "../ui/button";
import { Card,CardContent } from "../ui/card";
import { DropdownMenu,DropdownMenuContent,DropdownMenuItem,DropdownMenuTrigger } from "../ui/dropdown-menu";
import { DownloadFileButton } from "./DownloadFileButton";
import { ExportPdfDialog } from "./ExportPdfDialog";
import { AttachPdfDialog } from "./resume-container/ResumeDialogs";
import { canExportResume,useResumePdfExport } from "./resume-container/useResumePdfExport";
export default function ResumeContainer({ resume }: { resume: Resume; defaultResumeId?: string | null }) {
 const router = useRouter();
 const [showExportDialog,setShowExportDialog] = useState(false);
 const { showAttachConfirm,setShowAttachConfirm,handleExportPdf,handleAttachChoice,cancelAttach } = useResumePdfExport(resume);
 return <div className="col-span-3 space-y-4">
  <div className="flex items-center gap-3">
   <Button title="Go Back" variant="ghost" size="icon" onClick={()=>router.back()}><ArrowLeft className="h-4 w-4" /></Button>
   <h1 className="flex-1 text-2xl font-semibold">{resume.title}</h1>
   <DropdownMenu><DropdownMenuTrigger asChild><Button size="sm" variant="outline" aria-label="Document actions"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem disabled={!canExportResume(resume)} onClick={()=>setShowExportDialog(true)}>Export to PDF</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
  </div>
  <Card><CardContent className="space-y-3 pt-6">
   {resume.File ? DownloadFileButton(resume.id!,resume.File.filePath,resume.File.fileName,resume.File.fileName) : <p>No attachment.</p>}
   <p className="text-sm text-muted-foreground">Existing resume content is preserved and can be viewed in the PDF export preview. Structured resume editing is no longer available.</p>
  </CardContent></Card>
  <ExportPdfDialog open={showExportDialog} onOpenChange={setShowExportDialog} resume={resume} onExport={handleExportPdf} />
  <AttachPdfDialog open={showAttachConfirm} onOpenChange={setShowAttachConfirm} onChoice={handleAttachChoice} onCancel={cancelAttach} />
 </div>;
}
