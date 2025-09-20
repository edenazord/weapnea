
import React from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, UserCheck, UserX, Trash2 } from "lucide-react";
import { AdminUser } from "@/lib/admin-users-api";

interface UserStatusDropdownProps {
  user: AdminUser;
  onToggleActive: (userId: string, isActive: boolean) => void;
  onDeleteUser: (userId: string) => void;
}

const UserStatusDropdown = ({ user, onToggleActive, onDeleteUser }: UserStatusDropdownProps) => {
  const isActive = user.profile?.is_active !== false;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-8 w-8 p-0">
          <span className="sr-only">Apri menu</span>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={() => onToggleActive(user.id, !isActive)}
          className="flex items-center gap-2"
        >
          {isActive ? (
            <>
              <UserX className="h-4 w-4" />
              Disattiva utente
            </>
          ) : (
            <>
              <UserCheck className="h-4 w-4" />
              Attiva utente
            </>
          )}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => {
            if (confirm(`Sei sicuro di voler eliminare l'utente ${user.profile?.full_name || user.email}? Questa azione non può essere annullata.`)) {
              onDeleteUser(user.id);
            }
          }}
          className="flex items-center gap-2 text-red-600 hover:text-red-700"
        >
          <Trash2 className="h-4 w-4" />
          Elimina utente
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default UserStatusDropdown;
