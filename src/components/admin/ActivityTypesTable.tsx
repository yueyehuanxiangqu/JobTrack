"use client";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { MoreVertical, Trash } from "lucide-react";
import { useState } from "react";
import { deleteActivityTypeById } from "@/actions/activity.actions";
import { toastSuccess, toastError } from "@/lib/toast";
import { DeleteAlertDialog } from "../DeleteAlertDialog";
import { AlertDialog } from "@/models/alertDialog.model";

type ActivityTypeRow = {
  id: string;
  label: string;
  value: string;
  _count?: { Activities?: number; Tasks?: number };
};

type ActivityTypesTableProps = {
  activityTypes: ActivityTypeRow[];
  reloadActivityTypes: () => void;
};

function ActivityTypesTable({
  activityTypes,
  reloadActivityTypes,
}: ActivityTypesTableProps) {
  const [alert, setAlert] = useState<AlertDialog>({
    openState: false,
    deleteAction: false,
  });

  const onDelete = (at: ActivityTypeRow) => {
    const activityCount = at._count?.Activities ?? 0;
    const taskCount = at._count?.Tasks ?? 0;

    if (activityCount > 0 || taskCount > 0) {
      const links = [
        activityCount > 0 ? `${activityCount} historical activity record(s)` : "",
        taskCount > 0 ? `${taskCount} task(s)` : "",
      ]
        .filter(Boolean)
        .join(" and ");

      setAlert({
        openState: true,
        title: "Task category is in use!",
        description: `This task category is linked to ${links} and cannot be deleted.`,
        deleteAction: false,
      });
    } else {
      setAlert({
        openState: true,
        deleteAction: true,
        itemId: at.id,
      });
    }
  };

  const deleteType = async (id: string | undefined) => {
    if (!id) return;
    const { success, message } = await deleteActivityTypeById(id);
    if (success) {
      toastSuccess("Task category has been deleted successfully");
      reloadActivityTypes();
    } else {
      toastError(message);
    }
  };

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Label</TableHead>
            <TableHead className="hidden sm:table-cell">Value</TableHead>
            <TableHead># Tasks</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {activityTypes.map((at) => (
            <TableRow key={at.id}>
              <TableCell className="font-medium">{at.label}</TableCell>
              <TableCell className="font-medium hidden sm:table-cell">
                {at.value}
              </TableCell>
              <TableCell className="font-medium">
                {at._count?.Tasks ?? 0}
              </TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button aria-haspopup="true" size="icon" variant="ghost">
                      <MoreVertical className="h-4 w-4" />
                      <span className="sr-only">Toggle menu</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                    <DropdownMenuItem
                      className="text-red-600 cursor-pointer"
                      onClick={() => onDelete(at)}
                    >
                      <Trash className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <DeleteAlertDialog
        pageTitle="task category"
        open={alert.openState}
        onOpenChange={() => setAlert({ openState: false, deleteAction: false })}
        onDelete={() => deleteType(alert.itemId)}
        alertTitle={alert.title}
        alertDescription={alert.description}
        deleteAction={alert.deleteAction}
      />
    </>
  );
}

export default ActivityTypesTable;
