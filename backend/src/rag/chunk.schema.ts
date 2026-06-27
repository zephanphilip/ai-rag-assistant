import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ChunkDocument = HydratedDocument<Chunk>;

@Schema({ timestamps: true })
export class Chunk {
  @Prop({ required: true })
  text: string;

  @Prop({ required: true })
  source: string;

  // Links every chunk to a specific uploaded document.
  @Prop({ required: true })
  documentId: string;

  @Prop({ required: true })
  documentName: string;

  @Prop({ required: true })
  chunkIndex: number;

  @Prop({ type: [Number], required: true })
  embedding: number[];

  // The handbook section this chunk belongs to (for retrieval context).
  @Prop()
  sectionTitle?: string;

  @Prop()
  wordCount?: number;
}

export const ChunkSchema = SchemaFactory.createForClass(Chunk);
