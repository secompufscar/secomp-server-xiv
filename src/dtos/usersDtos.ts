export interface SignupUserDTO {
  nome: string;
  email: string;
  senha: string;
}

export interface CreateUserDTOS extends SignupUserDTO {
  tipo: string;
}

export interface UpdateUserDTOS {
  nome?: string;
  email?: string;
  senha?: string;
  confirmed?: boolean;
  pushToken?: string;
}

export interface UpdateQrCodeUsersDTOS {
  qrCode: string | null;
}

export interface UpdateProfileDTO {
  nome?: string;
  email?: string;
}
