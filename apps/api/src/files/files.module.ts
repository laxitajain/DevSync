import { Module } from "@nestjs/common";
import { WorkspacesModule } from "../workspaces/workspaces.module";
import { AttachmentsController } from "./attachments.controller";
import { AvatarController } from "./avatar.controller";
import { FilesService } from "./files.service";

@Module({
  imports: [WorkspacesModule],
  controllers: [AttachmentsController, AvatarController],
  providers: [FilesService]
})
export class FilesModule {}
