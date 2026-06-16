import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  MaxFileSizeValidator,
  Param,
  ParseFilePipe,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser, CurrentUserPayload } from "../common/decorators/current-user.decorator";
import { WorkspaceAccessService } from "../workspaces/workspace-access.service";
import { FilesService } from "./files.service";
import { AllowedMimeValidator } from "./mime.validator";
import { ATTACHMENT_MIME_PATTERN, MAX_ATTACHMENT_BYTES } from "./files.constants";

@UseGuards(JwtAuthGuard)
@Controller()
export class AttachmentsController {
  constructor(
    private readonly filesService: FilesService,
    private readonly workspaceAccess: WorkspaceAccessService
  ) {}

  @Post("tasks/:taskId/attachments")
  @UseInterceptors(FileInterceptor("file"))
  async upload(
    @Param("taskId") taskId: string,
    @CurrentUser() user: CurrentUserPayload,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: MAX_ATTACHMENT_BYTES }),
          new AllowedMimeValidator({ pattern: ATTACHMENT_MIME_PATTERN })
        ]
      })
    )
    file: Express.Multer.File
  ) {
    const { membership, task } = await this.workspaceAccess.requireTask(user.sub, taskId);
    this.workspaceAccess.assertCanWrite(membership);
    return this.filesService.addAttachment(task, user.sub, file);
  }

  @Get("tasks/:taskId/attachments")
  async list(@Param("taskId") taskId: string, @CurrentUser() user: CurrentUserPayload) {
    await this.workspaceAccess.requireTask(user.sub, taskId);
    return this.filesService.listAttachments(taskId);
  }

  @HttpCode(HttpStatus.OK)
  @Delete("attachments/:attachmentId")
  async remove(
    @Param("attachmentId") attachmentId: string,
    @CurrentUser() user: CurrentUserPayload
  ) {
    const { membership, attachment } = await this.workspaceAccess.requireAttachment(
      user.sub,
      attachmentId
    );
    this.workspaceAccess.assertCanWrite(membership);
    return this.filesService.deleteAttachment(attachment, membership.workspaceId, user.sub);
  }
}
