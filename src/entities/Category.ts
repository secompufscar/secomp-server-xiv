export interface Category {
  id: string;
  nome: string;
  slug: string;
  requiresEnrollment: boolean;
  createdAt: Date;
  updatedAt: Date | null;
}
