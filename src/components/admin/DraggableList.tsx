
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { GripVertical, Save, X } from "lucide-react";

type DraggableItem = {
  id: string;
  name: string;
};

type DraggableListProps = {
  items: DraggableItem[];
  onReorder: (itemIds: string[]) => Promise<void>;
  onCancel: () => void;
};

export function DraggableList({ items, onReorder, onCancel }: DraggableListProps) {
  const [orderedItems, setOrderedItems] = useState(items);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [isReordering, setIsReordering] = useState(false);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    
    if (draggedIndex === null || draggedIndex === index) return;

    const newItems = [...orderedItems];
    const draggedItem = newItems[draggedIndex];
    
    newItems.splice(draggedIndex, 1);
    newItems.splice(index, 0, draggedItem);
    
    setOrderedItems(newItems);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const handleSave = async () => {
    setIsReordering(true);
    try {
      const itemIds = orderedItems.map(item => item.id);
      await onReorder(itemIds);
      onCancel(); // Exit reorder mode
    } catch (error) {
      console.error('Error reordering items:', error);
    } finally {
      setIsReordering(false);
    }
  };

  const handleCancel = () => {
    setOrderedItems(items); // Reset to original order
    onCancel();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Riordina elementi</h3>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleCancel}
            disabled={isReordering}
          >
            <X className="h-4 w-4 mr-1" />
            Annulla
          </Button>
          <Button 
            size="sm" 
            onClick={handleSave}
            disabled={isReordering}
            variant="brand"
          >
            <Save className="h-4 w-4 mr-1" />
            {isReordering ? 'Salvando...' : 'Salva Ordine'}
          </Button>
        </div>
      </div>
      
      <div className="space-y-2">
        {orderedItems.map((item, index) => (
          <div
            key={item.id}
            draggable
            onDragStart={(e) => handleDragStart(e, index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragEnd={handleDragEnd}
            className={`flex items-center gap-3 p-3 bg-white border rounded-lg cursor-move hover:shadow-md transition-shadow ${
              draggedIndex === index ? 'opacity-50' : ''
            }`}
          >
            <GripVertical className="h-5 w-5 text-gray-400" />
            <span className="flex-1 font-medium">{item.name}</span>
            <span className="text-sm text-gray-500">#{index + 1}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
