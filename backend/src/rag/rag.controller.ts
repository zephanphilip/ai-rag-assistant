import {
  Body,
  Controller,
  Delete,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { RagService } from './rag.service';
import { FiltersService } from './filters.service';

interface ChatBody {
  question: string;
  sessionId: string;
}

@Controller('rag')
export class RagController {
  constructor(
    private readonly ragService: RagService,
    private readonly filtersService: FiltersService,
  ) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async upload(@UploadedFile() file: Express.Multer.File) {
    return this.ragService.ingestDocument(file.buffer, file.originalname);
  }

  @Post('chat')
  async chat(@Body() body: ChatBody) {
    return this.ragService.chat(
      body.question,
      body.sessionId,
      this.filtersService,
    );
  }

  @Delete('session/:id')
  async clearSession(@Param('id') id: string) {
    return this.ragService.clearSession(id);
  }
}
