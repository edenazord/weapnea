
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Pencil } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateForumReplyContent } from "@/lib/forum-api";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import type { ForumReply } from "@/lib/forum-api";

interface EditReplyDialogProps {
  reply: ForumReply;
  topicId: string;
}

const EditReplyDialog = ({ reply, topicId }: EditReplyDialogProps) => {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState(reply.content);
  const { t } = useLanguage();
  const queryClient = useQueryClient();

  const updateMutation = useMutation({
    mutationFn: (newContent: string) => updateForumReplyContent(reply.id, newContent),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forum-replies', topicId] });
      queryClient.invalidateQueries({ queryKey: ['forum-topic', topicId] });
      queryClient.invalidateQueries({ queryKey: ['forum-topics'] });
      toast.success(t('forum_edit.reply_updated', 'Risposta aggiornata con successo!'));
      setOpen(false);
    },
    onError: (error) => {
      toast.error(t('forum_edit.reply_update_error', 'Errore nell\'aggiornamento della risposta: ') + error.message);
    },
  });

  const handleSubmit = () => {
    if (!content.trim()) {
      toast.error(t('forum_edit.content_required', 'Il contenuto è obbligatorio'));
      return;
    }

    updateMutation.mutate(content.trim());
  };

  const handleCancel = () => {
    setContent(reply.content);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 h-8 w-8">
          <Pencil className="h-3 w-3" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{t('forum_edit.edit_reply', 'Modifica Risposta')}</DialogTitle>
          <DialogDescription>
            {t('forum_edit.edit_reply_desc', 'Modifica il contenuto della tua risposta.')}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="content">{t('forum_edit.content_label', 'Contenuto')}</Label>
            <Textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={t('forum_edit.reply_content_placeholder', 'Scrivi il contenuto della risposta...')}
              className="min-h-32"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            {t('forum_edit.cancel', 'Annulla')}
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={updateMutation.isPending || !content.trim()}
            variant="brand"
          >
            {updateMutation.isPending ? t('forum_edit.saving', 'Salvataggio...') : t('forum_edit.save_changes', 'Salva Modifiche')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EditReplyDialog;
