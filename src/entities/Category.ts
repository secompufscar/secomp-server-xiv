export interface Category {
  id: string;
  nome: string;
  requiresEnrollment: boolean;
  createdAt: Date;
  updatedAt: Date | null;
}
