"use client";
import { useTabQueryParam } from "@/hooks/useTabQueryParam";
import {
Company,
JobLocation,
JobResponse,
JobSource,
JobStatus,
JobTitle,
Tag,
} from "@/models/job.model";
import { useRouter } from "next/navigation";
import { TipTapContentViewer } from "../TipTapContentViewer";
import { Badge } from "../ui/badge";
import { Card } from "../ui/card";
import { Tabs,TabsContent,TabsList,TabsTrigger } from "../ui/tabs";

import { useState } from "react";
import { NotesSection } from "./NotesSection";
import JobDocuments from "./JobDocuments";

import { deleteJobById,updateJobStatus } from "@/actions/job.actions";
import { toastError,toastSuccess } from "@/lib/toast";
import { DeleteAlertDialog } from "../DeleteAlertDialog";
import { AddJob } from "./AddJob";
import { JobDetailsHeader } from "./job-details/JobDetailsHeader";
import { JobSummaryCard } from "./job-details/JobSummaryCard";

import { AddStageDialog } from "@/components/AddStageDialog";
import { JobContactsTab } from "./job-details/JobContactsTab";
import { JobTimelineTab } from "./job-details/timeline/JobTimelineTab";
import { LinkInterviewersDialog } from "./job-details/timeline/LinkInterviewersDialog";
import { UpdateStatusMenu } from "./job-details/timeline/UpdateStatusMenu";
import { useJobStages } from "./job-details/timeline/useJobStages";

import type { JobStage,JobStageTypeRef } from "@/models/jobStage.model";

const JOB_DETAIL_TABS = [
  "description",
  "timeline",

  "contacts",
  "notes",
] as const;

type JobDetailsProps = {
  job: JobResponse;
  jobStatuses: JobStatus[];
  companies: Company[];
  titles: JobTitle[];
  locations: JobLocation[];
  sources: JobSource[];
  tags: Tag[];
  stageTypes: JobStageTypeRef[];
};

function JobDetails({
  job,
  jobStatuses,
  companies,
  titles,
  locations,
  sources,
  tags,
  stageTypes,
}: JobDetailsProps) {

  const [editJobTarget, setEditJobTarget] = useState<JobResponse | null>(
    null,
  );
  const [deleteAlertOpen, setDeleteAlertOpen] = useState(false);
  const [noteOpenTrigger, setNoteOpenTrigger] = useState(0);
  const [notesCount, setNotesCount] = useState(0);
  const [contactLinks, setContactLinks] = useState(job.contactLinks ?? []);
  const {
    stages,
    currentStage,
    selectedStage,
    selectedStageId,
    selectStage,
    reload: reloadStages,
  } = useJobStages(job.id, job.stages ?? []);
  // Derived, never mirrored: the status is the current stage's parent status,
  // and six server-side write paths keep Job.statusId equal to it. State here
  // would go stale on every stage add, edit or delete that moves the status.
  // job.Status covers the stageless job, which keeps whatever status it had.
  const currentStatus = currentStage?.StageType.Status ?? job.Status;
  const [addStageTarget, setAddStageTarget] = useState<
    { mode: "create" } | { mode: "edit"; stage: JobStage } | null
  >(null);
  const [linkInterviewersOpen, setLinkInterviewersOpen] = useState(false);

  const router = useRouter();
  const [activeTab, handleTabChange] = useTabQueryParam(
    JOB_DETAIL_TABS,
    "description",
  );
  const goBack = () => router.back();

  const onEditJob = () => {
    setEditJobTarget({ ...job, Status: currentStatus });
  };

  const resetEditJob = () => setEditJobTarget(null);

  const onAddNote = () => {
    handleTabChange("notes");
    setNoteOpenTrigger((prev) => prev + 1);
  };

  const onChangeStatus = async (status: JobStatus) => {
    const { success, message } = await updateJobStatus(job.id, status);
    if (success) {
      // The status change appends a stage server-side, and the badge reads
      // that stage, so this is awaited rather than fired off.
      await reloadStages();
      // applied/appliedDate may have changed too, and they come from the prop.
      router.refresh();
      toastSuccess(`Job has been updated successfully`);
    } else {
      toastError(message);
    }
  };

  const onDeleteJob = async () => {
    const { success, message } = await deleteJobById(job.id);
    if (success) {
      toastSuccess(`Job has been deleted successfully`);
      router.push("/dashboard/myjobs");
    } else {
      toastError(message);
    }
  };

  return (
    <>
      <div className="py-6 space-y-6">
        <JobDetailsHeader
          job={job}

          onBack={goBack}

          onEdit={onEditJob}
          onDelete={() => setDeleteAlertOpen(true)}
          onAddNote={onAddNote}
          updateStatusMenu={
            <UpdateStatusMenu
              targetStage={selectedStage ?? currentStage}
              jobStatuses={jobStatuses}
              currentStatusId={currentStatus.id}
              onChangeStatus={onChangeStatus}
              onAddStage={() => setAddStageTarget({ mode: "create" })}
              onLinkInterviewers={() => setLinkInterviewersOpen(true)}

            />
          }
        />

        <JobSummaryCard
          job={job}
          currentStatus={currentStatus}

        />

        <JobDocuments jobId={job.id} />
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="w-full justify-start overflow-x-auto">
            <TabsTrigger value="description">Description</TabsTrigger>
            <TabsTrigger value="timeline">
              Timeline
              {stages.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {stages.length}
                </Badge>
              )}
            </TabsTrigger>

            <TabsTrigger value="contacts">
              Contacts
              {contactLinks.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {contactLinks.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="notes">
              Notes
              {notesCount > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {notesCount}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="description" className="mt-4">
            <Card className="p-6">
              <TipTapContentViewer content={job?.description} />
            </Card>
          </TabsContent>

          <TabsContent value="timeline" className="mt-4">
            <JobTimelineTab
              stages={stages}
              stageTypes={stageTypes}
              selectedStageId={selectedStageId}
              currentStageId={currentStage?.id ?? null}
              onSelect={selectStage}
              onAddStage={() => setAddStageTarget({ mode: "create" })}
              onEditStage={(stage) => setAddStageTarget({ mode: "edit", stage })}
              onLinkInterviewers={() => setLinkInterviewersOpen(true)}

              onChanged={reloadStages}
            />
          </TabsContent>

          {/* forceMount keeps ⋮ → Add a Note and the count badge working off-tab. */}
          <TabsContent
            value="notes"
            className="mt-4 data-[state=inactive]:hidden"
            forceMount
          >
            <Card className="p-6">
              <NotesSection
                jobId={job.id}
                openTrigger={noteOpenTrigger}
                onCountChange={setNotesCount}
              />
            </Card>
          </TabsContent>
          <TabsContent value="contacts" className="mt-4">
            <Card className="p-6">
              <JobContactsTab
                jobId={job.id}
                links={contactLinks}
                onLinksChange={setContactLinks}
                companies={companies}
                locations={locations}
              />
            </Card>
          </TabsContent>
        </Tabs>
      </div>
      <AddJob
        jobStatuses={jobStatuses}
        companies={companies}
        jobTitles={titles}
        locations={locations}
        jobSources={sources}
        tags={tags}
        editJob={editJobTarget}
        resetEditJob={resetEditJob}
        hideTrigger
        redirectPath={`/dashboard/myjobs/${job.id}?tab=${activeTab}`}
      />
      <AddStageDialog
        open={!!addStageTarget}
        jobId={job.id}
        jobLabel={`${job.JobTitle?.label ?? ""}${
          job.Company?.label ? ` · ${job.Company.label}` : ""
        }`}
        stage={addStageTarget?.mode === "edit" ? addStageTarget.stage : null}
        stageTypes={stageTypes}
        jobStatuses={jobStatuses}
        onOpenChange={(open) => !open && setAddStageTarget(null)}
        onSaved={() => {
          void reloadStages();
          router.refresh();
        }}
      />
      <LinkInterviewersDialog
        open={linkInterviewersOpen}
        stage={selectedStage ?? currentStage}
        onOpenChange={setLinkInterviewersOpen}
        onLinked={() => {
          void reloadStages();
          router.refresh();
        }}
      />

      <DeleteAlertDialog
        pageTitle="job"
        open={deleteAlertOpen}
        onOpenChange={setDeleteAlertOpen}
        onDelete={onDeleteJob}
      />

    </>
  );
}

export default JobDetails;
