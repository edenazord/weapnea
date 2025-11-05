import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export type CenteredNoticeProps = {
  open: boolean;
  title?: string;
  message: string;
  okLabel?: string;
  onClose: () => void;
};

export function CenteredNotice({ open, title = "Operazione completata", message, okLabel = "OK", onClose }: CenteredNoticeProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent
        className="sm:max-w-md text-center"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{message}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="sm:justify-center">
          <Button variant="brand" onClick={onClose}>{okLabel}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
