import { z } from "zod";
import { ExistingPasswordSchema, UsernameSchema } from "./auth.schema";
export const SigninFormSchema = z.object({ username: UsernameSchema, password: ExistingPasswordSchema });
