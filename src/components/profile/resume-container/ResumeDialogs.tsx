"use client";
import {
AlertDialog,
AlertDialogAction,
AlertDialogCancel,
AlertDialogContent,
AlertDialogDescription,
AlertDialogFooter,
AlertDialogHeader,
AlertDialogTitle,
} from "../../ui/alert-dialog";
import { Button } from "../../ui/button";

export function AttachPdfDialog({
  open,
  onOpenChange,
  onChoice,
  onCancel,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChoice: (choice: "replace" | "download-only") => void;
  onCancel: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Replace existing attachment?</AlertDialogTitle>
          <AlertDialogDescription>
            This resume already has a file attached. Would you like to replace
            it with the exported PDF?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Cancel</AlertDialogCancel>
          <Button variant="outline" onClick={() => onChoice("download-only")}>
            Download only
          </Button>
          <AlertDialogAction onClick={() => onChoice("replace")}>
            Replace attachment
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
