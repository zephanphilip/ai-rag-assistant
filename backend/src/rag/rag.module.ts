import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MulterModule } from '@nestjs/platform-express';
import { Chunk, ChunkSchema } from './chunk.schema';
import { Session, SessionSchema } from './session.schema';
import { RagController } from './rag.controller';
import { RagService } from './rag.service';
import { FiltersService } from './filters.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Chunk.name, schema: ChunkSchema },
      { name: Session.name, schema: SessionSchema },
    ]),
    MulterModule.register(),
  ],
  controllers: [RagController],
  providers: [RagService, FiltersService],
  exports: [RagService, FiltersService],
})
export class RagModule {}
