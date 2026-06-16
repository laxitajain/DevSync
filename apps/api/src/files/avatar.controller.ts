import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  MaxFileSizeValidator,
  ParseFilePipe,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser, CurrentUserPayload } from "../common/decorators/current-user.decorator";
import { FilesService } from "./files.service";
import { AllowedMimeValidator } from "./mime.validator";
import { AVATAR_MIME_PATTERN, MAX_AVATAR_BYTES } from "./files.constants";

@UseGuards(JwtAuthGuard)
@Controller("users/me/avatar")
export class AvatarController {
  constructor(private readonly filesService: FilesService) {}

  @Get()
  get(@CurrentUser() user: CurrentUserPayload) {
    return this.filesService.getAvatarUrl(user.sub);
  }

  @HttpCode(HttpStatus.OK)
  @Post()
  @UseInterceptors(FileInterceptor("file"))
  upload(
    @CurrentUser() user: CurrentUserPayload,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: MAX_AVATAR_BYTES }),
          new AllowedMimeValidator({ pattern: AVATAR_MIME_PATTERN })
        ]
      })
    )
    file: Express.Multer.File
  ) {
    return this.filesService.setAvatar(user.sub, file);
  }
}
