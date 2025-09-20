
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
import type { ForumTopic } from "@/lib/forum-api";

interface EditTopicDialogProps {
  topic: ForumTopic;
  topicId: string;
}

const EditTopicDialog = ({ topic, topicId }: EditTopicDialogProps) => {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(topic.title);
  const [content, setContent] = useState(topic.content);
  const queryClient = useQueryClient();

  const updateMutation = useMutation({
    mutationFn: () => updateForumTopicContent(topicId, title.trim(), content.trim()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forum-topic', topicId] });
      queryClient.invalidateQueries({ queryKey: ['forum-topics'] });
      toast.success('Topic aggiornato con successo!');
      setOpen(false);
    },
    onError: (error) => {
      toast.error('Errore nell\'aggiornamento del topic: ' + error.message);
    },
  });

  const handleSubmit = () => {
    if (!title.trim() || !content.trim()) {
      toast.error('Titolo e contenuto sono obbligatori');
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
          <DialogTitle>Modifica Topic</DialogTitle>
          <DialogDescription>
            Modifica il titolo e il contenuto del tuo topic.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="title">Titolo</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Inserisci il titolo del topic..."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="content">Contenuto</Label>
            <Textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Scrivi il contenuto del topic..."
              className="min-h-32"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Annulla
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={updateMutation.isPending || !title.trim() || !content.trim()}
          >
            {updateMutation.isPending ? 'Salvataggio...' : 'Salva Modifiche'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EditTopicDialog;
