export type RegistrationStatus = 0 | 1 | 2;
export interface User {
  id: string;
  nome: string;
  email: string;
  senha: string;
  tipo: string;
  qrCode: string | null;
  createdAt: Date;
  updatedAt: Date | null;
  confirmed: boolean;
  registrationStatus: RegistrationStatus; 
  currentEdition: string | null; // Edição atual (ex: "2025")
  points: number;
  pushToken?: string | null;
  rank?: number;
}

// correção para o vazando de dados sensíveis encontrado no repositories/userRepository.ts
export type RankingUser = Omit<User, 'email' | 'senha' | 'qrCode' | 'updatedAt' | 'registrationStatus' | 'currentEdition' | 'pushToken'>;