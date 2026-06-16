import { Role } from "@devsync/db";
import { IsEmail, IsEnum } from "class-validator";

export class InviteMemberDto {
  @IsEmail()
  email!: string;

  @IsEnum(Role)
  role!: Role;
}
