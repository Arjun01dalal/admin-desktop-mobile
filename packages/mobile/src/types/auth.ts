export type AuthUser = {
  _id?: string;
  mobile?: string;
  name?: string;
  email?: string;
  Role_ID?: string;
  Role_Name?: string;
  Responsibilities?: string[];
  block?: boolean;
  roles?: Record<string, string> | unknown;
  empCode?: string;
  [key: string]: unknown;
};
