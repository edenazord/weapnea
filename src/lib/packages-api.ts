import { apiGet, apiSend } from "@/lib/apiClient";

export type PackageType = 'organizer' | 'sponsor';
export type PackageStatus = 'active' | 'expired' | 'cancelled';

export interface UserPackage {
  id: string;
  user_id: string;
  package_type: PackageType;
  package_id: string;
  package_name: string;
  status: PackageStatus;
  starts_at: string;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
  user_profile?: {
    full_name: string | null;
  } | null;
}

export const getUserPackages = async (_userId?: string): Promise<UserPackage[]> => {
  // In API mode, lato client usiamo solo endpoint admin per avere profili inclusi
  const data = await apiGet('/api/admin/user-packages');
  return data as UserPackage[];
};

export const activatePackage = async (
  packageType: PackageType,
  packageId: string,
  packageName: string,
  durationMonths?: number,
  targetUserId?: string
): Promise<UserPackage> => {
  // In API mode l'assegnazione è gestita dall'endpoint admin
  const data = await apiSend('/api/admin/user-packages/assign', 'POST', {
    targetUserId,
    packageType,
    packageId,
    packageName,
    durationMonths,
  });
  return data as UserPackage;
};

export const cancelPackage = async (packageId: string): Promise<void> => {
  await apiSend(`/api/admin/user-packages/${encodeURIComponent(packageId)}/cancel`, 'POST');
};

export const getAllUserPackages = async (): Promise<UserPackage[]> => {
  const data = await apiGet('/api/admin/user-packages');
  return data as UserPackage[];
};

// Nuova funzione per assegnare pacchetti come admin
export const assignPackageAsAdmin = async (
  targetUserId: string,
  packageType: PackageType,
  packageId: string,
  packageName: string,
  durationMonths?: number
): Promise<UserPackage> => {
  const data = await apiSend('/api/admin/user-packages/assign', 'POST', {
    targetUserId,
    packageType,
    packageId,
    packageName,
    durationMonths,
  });
  return data as UserPackage;
};
