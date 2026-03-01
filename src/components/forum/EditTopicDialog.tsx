
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { updateForumTopicContent } from "@/lib/forum-api";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import type { ForumTopic } from "@/lib/forum-api";

interface EditTopicDialogProps {
  topic: ForumTopic;
  topicId: string;
}

const EditTopicDialog = ({ topic, topicId }: EditTopicDialogProps) => {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(topic.title);
  const [content, setContent] = useState(topic.content);
  const { t } = useLanguage();
  const queryClient = useQueryClient();

  const updateMutation = useMutation({
    mutationFn: () => updateForumTopicContent(topicId, title.trim(), content.trim()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forum-topic', topicId] });
      queryClient.invalidateQueries({ queryKey: ['forum-topics'] });
      toast.success(t('forum_edit.topic_updated', 'Topic aggiornato con successo!'));
      setOpen(false);
    },
    onError: (error) => {
      toast.error(t('forum_edit.topic_update_error', 'Errore nell\'aggiornamento del topic: ') + error.message);
    },
  });

  const handleSubmit = () => {
    if (!title.trim() || !content.trim()) {
      toast.error(t('forum_edit.title_content_required', 'Titolo e contenuto sono obbligatori'));
      return;
    }

    updateMutation.mutate();
  };

  const handleCancel = () => {
    setTitle(topic.title);
    setContent(topic.content);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="text-blue-600 hover:text-blue-700 hover:bg-blue-50">
          <Pencil className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{t('forum_edit.edit_topic', 'Modifica Topic')}</DialogTitle>
          <DialogDescription>
            {t('forum_edit.edit_topic_desc', 'Modifica il titolo e il contenuto del tuo topic.')}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="title">{t('forum_edit.title_label', 'Titolo')}</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('forum_edit.title_placeholder', 'Inserisci il titolo del topic...')}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="content">{t('forum_edit.content_label', 'Contenuto')}</Label>
            <Textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={t('forum_edit.content_placeholder', 'Scrivi il contenuto del topic...')}
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
            disabled={updateMutation.isPending || !title.trim() || !content.trim()}
            variant="brand"
          >
            {updateMutation.isPending ? t('forum_edit.saving', 'Salvataggio...') : t('forum_edit.save_changes', 'Salva Modifiche')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EditTopicDialog;
