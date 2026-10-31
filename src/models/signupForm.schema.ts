import { z } from "zod";
import { NewPasswordSchema, UsernameSchema } from "./auth.schema";
export const SignupFormSchema = z.object({ username: UsernameSchema, password: NewPasswordSchema });
