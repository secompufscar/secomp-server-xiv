export interface CreateCategoryrDTOS {
  nome: string;
  requiresEnrollment?: boolean;
}

export interface UpdateCategoryrDTOS {
  nome?: string;
  requiresEnrollment?: boolean;
}

export interface CategoryrDTOS {
  nome: string;
  id: string;
  requiresEnrollment: boolean;
}
