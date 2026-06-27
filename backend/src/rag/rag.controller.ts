import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import type { Response } from 'express';
import { randomUUID } from 'crypto';
import { FileInterceptor } from '@nestjs/platform-express';
import { RagService } from './rag.service';
import { FiltersService } from './filters.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../auth/roles.enum';
import { CurrentUser } from '../auth/current-user.decorator';
import type { JwtPayload } from '../auth/jwt-auth.guard';

interface ChatBody {
  question: string;
  sessionId: string;
  documentId?: string;
}

// All RAG routes require authentication; admin-only routes add @Roles(Admin).
@Controller('rag')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RagController {
  constructor(
    private readonly ragService: RagService,
    private readonly filtersService: FiltersService,
  ) {}

  //upload doc 
  @Post('upload')
  @Roles(Role.Admin)
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body('documentName') documentName: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const documentId = randomUUID();
    const name = documentName?.trim() || file.originalname;
    return this.ragService.ingestDocument(
      file.buffer,
      file.originalname,
      documentId,
      name,
      user.sub,
    );
  }

  // List all uploaded documents (any authenticated user).
  @Get('documents')
  async listDocuments() {
    return this.ragService.listDocuments();
  }

  // Delete a document and all of its chunks (admin only).
  @Delete('documents/:documentId')
  @Roles(Role.Admin)
  async deleteDocumentById(@Param('documentId') documentId: string) {
    return this.ragService.deleteDocumentById(documentId);
  }

  // Legacy: delete chunks by their source filename (admin only).
  @Delete('document/:source')
  @Roles(Role.Admin)
  async deleteDocument(@Param('source') source: string) {
    return this.ragService.deleteDocument(source);
  }

  @Post('chat')
  async chat(@Body() body: ChatBody) {
    return this.ragService.chat(
      body.question,
      body.sessionId,
      this.filtersService,
      body.documentId,
    );
  }

  // Streaming variant: tokens are pushed to the client as Gemini generates them.
  @Post('chat/stream')
  async chatStream(@Body() body: ChatBody, @Res() res: Response) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    await this.ragService.chatStream(
      body.question,
      body.sessionId,
      this.filtersService,
      res,
      body.documentId,
    );
  }

  @Delete('session/:id')
  async clearSession(@Param('id') id: string) {
    return this.ragService.clearSession(id);
  }
}
