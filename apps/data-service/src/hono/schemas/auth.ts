import { z } from "zod";

export const LoginRequestSchema = z.object({
	login: z.string().min(1),
	password: z.string().min(1),
});

export type LoginRequest = z.infer<typeof LoginRequestSchema>;
