"use client";
import { deleteCompanyById,} from "@/actions/company.actions";
import { toastError,toastSuccess } from "@/lib/toast";
import { AlertDialog } from "@/models/alertDialog.model";
import { Company } from "@/models/job.model";
import { useState } from "react";
import { DeleteAlertDialog } from "../DeleteAlertDialog";
import {
Table,
TableBody,
TableHead,
TableHeader,
TableRow
} from "../ui/table";

type CompaniesTableProps = {
  companies: Company[];
  reloadCompanies: () => void;
  editCompany: (id: string) => void;
};

function CompaniesTable({
  companies,
  reloadCompanies,
  editCompany,
}: CompaniesTableProps) {
  const [alert, setAlert] = useState<AlertDialog>({
    openState: false,
    deleteAction: false,
  });

  const onDeleteCompany = (company: Company) => {
    const totalJobs = company._count?.jobsTotal ?? 0;
    if (totalJobs > 0) {
      setAlert({
        openState: true,
        title: "Associated jobs exist!",
        description: `This company has ${totalJobs} associated job${
          totalJobs === 1 ? "" : "s"
        } (applied or not). Remove or reassign them before deleting this company.`,
        deleteAction: false,
      });
    } else {
      setAlert({
        openState: true,
        deleteAction: true,
        itemId: company.id,
      });
    }
  };

  const detailsHref = (id: string) =>
    `/dashboard/admin/companies/${id}${""}`;

  const deleteCompany = async (companyId: string | undefined) => {
    if (companyId) {
      const { res, success, message } = await deleteCompanyById(companyId);
      if (success) {
        toastSuccess(`Company has been deleted successfully`);
        reloadCompanies();
      } else {
        toastError(message);
      }
    }
  };

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="hidden w-[100px] sm:table-cell">
              <span className="sr-only">Company Logo</span>
            </TableHead>
            <TableHead>Company Name</TableHead>
            {(
              <>
                <TableHead className="hidden sm:table-cell">Value</TableHead>
                <TableHead>Total Jobs</TableHead>
                <TableHead>Jobs Applied</TableHead>
                <TableHead>Rejected</TableHead>
                <TableHead>Contacts</TableHead>
              </>
            )}
            <TableHead>Actions</TableHead>
            <TableHead>
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>

        </TableBody>
      </Table>
      <DeleteAlertDialog
        pageTitle="company"
        open={alert.openState}
        onOpenChange={() => setAlert({ openState: false, deleteAction: false })}
        onDelete={() => deleteCompany(alert.itemId)}
        alertTitle={alert.title}
        alertDescription={alert.description}
        deleteAction={alert.deleteAction}
      />
    </>
  );
}

export default CompaniesTable;
