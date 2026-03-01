import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";

export type CenteredNoticeProps = {
  open: boolean;
  title?: string;
  message: string;
  okLabel?: string;
  onClose: () => void;
};

export function CenteredNotice({ open, title, message, okLabel, onClose }: CenteredNoticeProps) {
  const { t } = useLanguage();
  const displayTitle = title || t('centered_notice.default_title', 'Operazione completata');
  const displayOk = okLabel || "OK";
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent
        className="sm:max-w-md text-center"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{displayTitle}</DialogTitle>
          <DialogDescription>{message}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="sm:justify-center">
          <Button variant="brand" onClick={onClose}>{displayOk}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
