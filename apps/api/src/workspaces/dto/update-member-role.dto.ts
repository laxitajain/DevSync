import { Role } from "@devsync/db";
import { IsEnum } from "class-validator";

export class UpdateMemberRoleDto {
  @IsEnum(Role)
  role!: Role;
}
