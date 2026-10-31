"use client";
import {
deleteCompanyById,
} from "@/actions/company.actions";
import { useTabQueryParam } from "@/hooks/useTabQueryParam";
import { toastError,toastSuccess } from "@/lib/toast";
import { AlertDialog } from "@/models/alertDialog.model";
import type { CompanyDetails as CompanyDetailsData } from "@/models/companyDetails.model";
import type { Company } from "@/models/job.model";
import { useRouter,useSearchParams } from "next/navigation";
import { useState } from "react";
import { DeleteAlertDialog } from "../DeleteAlertDialog";
import { Badge } from "../ui/badge";
import { Card } from "../ui/card";
import { Tabs,TabsContent,TabsList,TabsTrigger } from "../ui/tabs";
import AddCompany from "./AddCompany";
import { CompanyContactsTab } from "./company-details/CompanyContactsTab";
import { CompanyDetailsHeader } from "./company-details/CompanyDetailsHeader";
import { CompanyJobsTab } from "./company-details/CompanyJobsTab";
import { CompanySummaryCard } from "./company-details/CompanySummaryCard";

const LIBRARY_COMPANIES = "/dashboard/admin?tab=companies";
const COMPANY_DETAIL_TABS = ["jobs", "contacts"] as const;

type CompanyDetailsProps = {
  details: CompanyDetailsData;
};

function blockedDescription(total: number, dismissed: number) {
  const jobs = `This company has ${total} associated job${total === 1 ? "" : "s"} (applied or not).`;
  const hidden =
    dismissed > 0
      ? ` ${dismissed} of them ${dismissed === 1 ? "was" : "were"} dismissed by automations; pick Dismissed (discovered) on the Jobs page to see them.`
      : "";
  return `${jobs}${hidden} Remove or reassign them before deleting this company.`;
}

function CompanyDetails({ details }: CompanyDetailsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const backHref = LIBRARY_COMPANIES;
  const goBack = () => router.back();
  const [activeTab, handleTabChange] = useTabQueryParam(
    COMPANY_DETAIL_TABS,
    "jobs",
  );
  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Company | null>(null);
  const [alert, setAlert] = useState<AlertDialog>({
    openState: false,
    deleteAction: false,
  });

  const { jobs, dismissedJobsCount, currentContacts, formerContacts } = details;
  const contactsCount = new Set(
    [...currentContacts, ...formerContacts].map((contact) => contact.id),
  ).size;

  // AddCompany refills its form only when editCompany changes identity, so
  // a fresh copy per open discards an abandoned edit
  const openEdit = () => {
    setEditTarget({ ...details });
    setEditOpen(true);
  };

  // Jobs block up front, dismissed ones included, because the server guard
  // counts them; contacts and resume entries are left to the server message.
  const onDelete = () => {
    const total = jobs.length + dismissedJobsCount;
    if (total > 0) {
      setAlert({
        openState: true,
        deleteAction: false,
        title: "Associated jobs exist!",
        description: blockedDescription(total, dismissedJobsCount),
      });
    } else {
      setAlert({ openState: true, deleteAction: true, itemId: details.id });
    }
  };

  const deleteCompany = async () => {
    const { success, message } = await deleteCompanyById(details.id);
    if (success) {
      toastSuccess("Company has been deleted successfully");
      router.push(backHref);
    } else {
      toastError(message);
    }
  };

  return (
    <>
      <div className="py-6 space-y-6">
        <CompanyDetailsHeader
          company={details}
          onBack={goBack}

          onEdit={openEdit}
          onDelete={onDelete}
        />

        <CompanySummaryCard
          company={details}
          jobsCount={jobs.length}
          appliedCount={details.appliedCount}
          contactsCount={contactsCount}
        />

        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList>
            <TabsTrigger value="jobs">
              Jobs
              {jobs.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {jobs.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="contacts">
              Contacts
              {contactsCount > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {contactsCount}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="jobs" className="mt-4">
            <Card className="p-6">
              <CompanyJobsTab jobs={jobs} />
            </Card>
          </TabsContent>
          <TabsContent value="contacts" className="mt-4">
            <Card className="p-6">
              <CompanyContactsTab
                companyId={details.id}
                currentContacts={currentContacts}
                formerContacts={formerContacts}
              />
            </Card>
          </TabsContent>
        </Tabs>
      </div>
      <AddCompany
        hideTrigger
        editCompany={editTarget}
        reloadCompanies={() => router.refresh()}
        resetEditCompany={() => {}}
        dialogOpen={editOpen}
        setDialogOpen={setEditOpen}
      />
      <DeleteAlertDialog
        pageTitle="company"
        open={alert.openState}
        onOpenChange={() => setAlert({ openState: false, deleteAction: false })}
        onDelete={deleteCompany}
        alertTitle={alert.title}
        alertDescription={alert.description}
        deleteAction={alert.deleteAction}
      />
    </>
  );
}

export default CompanyDetails;
