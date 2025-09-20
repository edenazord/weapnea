
import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Copy, Check, Clock, X } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import {
  getPasswordRecoveryTokens,
  markTokenAsUsed
} from "@/lib/admin-users-api";

const PasswordTokensManager = () => {
  const queryClient = useQueryClient();

  const { data: tokens = [], isLoading } = useQuery({
    queryKey: ['password-recovery-tokens'],
    queryFn: getPasswordRecoveryTokens,
  });

  const markAsUsedMutation = useMutation({
    mutationFn: markTokenAsUsed,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['password-recovery-tokens'] });
      toast.success("Token marcato come utilizzato");
    },
    onError: (error) => {
      toast.error(`Errore: ${error.message}`);
    },
  });

  const copyToClipboard = async (token: string) => {
    try {
      await navigator.clipboard.writeText(token);
      toast.success("Token copiato negli appunti");
    } catch (error) {
      toast.error("Errore nel copiare il token");
    }
  };

  const isTokenExpired = (expiresAt: string) => {
    return new Date(expiresAt) < new Date();
  };

  const getTokenStatus = (token: any) => {
    if (token.used) return { label: "Utilizzato", variant: "secondary" as const, color: "bg-gray-100 text-gray-800" };
    if (isTokenExpired(token.expires_at)) return { label: "Scaduto", variant: "destructive" as const, color: "bg-red-100 text-red-800" };
    return { label: "Valido", variant: "default" as const, color: "bg-green-100 text-green-800" };
  };

  if (isLoading) {
    return <div>Caricamento token...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Statistiche */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{tokens.length}</div>
            <p className="text-sm text-gray-600">Token Totali</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-600">
              {tokens.filter(t => !t.used && !isTokenExpired(t.expires_at)).length}
            </div>
            <p className="text-sm text-gray-600">Token Validi</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-gray-600">
              {tokens.filter(t => t.used).length}
            </div>
            <p className="text-sm text-gray-600">Token Utilizzati</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-red-600">
              {tokens.filter(t => !t.used && isTokenExpired(t.expires_at)).length}
            </div>
            <p className="text-sm text-gray-600">Token Scaduti</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabella Token */}
      <Card>
        <CardHeader>
          <CardTitle>Token di Recupero Password</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Token</TableHead>
                  <TableHead>Stato</TableHead>
                  <TableHead>Creato il</TableHead>
                  <TableHead>Scade il</TableHead>
                  <TableHead className="text-right">Azioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tokens.map((token) => {
                  const status = getTokenStatus(token);
                  return (
                    <TableRow key={token.id}>
                      <TableCell className="font-mono text-sm">
                        <div className="flex items-center space-x-2">
                          <span className="truncate max-w-[200px]">
                            {token.token}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard(token.token)}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={status.variant} className={status.color}>
                          {status.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {format(new Date(token.created_at), 'dd/MM/yyyy HH:mm', { locale: it })}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <span>
                            {format(new Date(token.expires_at), 'dd/MM/yyyy HH:mm', { locale: it })}
                          </span>
                          {isTokenExpired(token.expires_at) && (
                            <Clock className="h-4 w-4 text-red-500" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {!token.used && !isTokenExpired(token.expires_at) && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => markAsUsedMutation.mutate(token.id)}
                          >
                            <X className="h-4 w-4" />
                            <span className="ml-1">Segna come usato</span>
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          {tokens.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              Nessun token di recupero password trovato
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PasswordTokensManager;
