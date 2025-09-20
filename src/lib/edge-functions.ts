import { backendConfig } from '@/lib/backendConfig';
import { supabase } from '@/integrations/supabase/client';

type InvokeOptions = { body?: unknown };

type InvokeResult = { data: unknown | null; error: { message: string } | null };

export async function invokeFunction(name: string, options?: InvokeOptions): Promise<InvokeResult> {
  // Default: call Supabase Edge Functions
  const { data, error } = await supabase.functions.invoke(name, options as InvokeOptions);
  return { data: data ?? null, error: error as unknown as { message: string } | null };
}
