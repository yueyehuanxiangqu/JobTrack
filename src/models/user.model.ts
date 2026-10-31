export interface User {
  id: string;
  name: string;
  email: string | null;
  username?: string | null;
  password: string;
}

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  username?: string | null;
  iat?: number;
  exp?: number;
};
