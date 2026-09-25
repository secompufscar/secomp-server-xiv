export interface CreateCategoryrDTOS {
  nome: string;
  slug?: string;
  requiresEnrollment?: boolean;
}

export interface UpdateCategoryrDTOS {
  nome?: string;
  slug?: string;
  requiresEnrollment?: boolean;
}

export interface CategoryrDTOS {
  nome: string;
  id: string;
  slug: string;
  requiresEnrollment: boolean;
}
