import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ChunkDocument = HydratedDocument<Chunk>;

@Schema({ timestamps: true })
export class Chunk {
  @Prop({ required: true })
  text: string;

  @Prop({ required: true })
  source: string;

  @Prop({ required: true })
  chunkIndex: number;

  @Prop({ type: [Number], required: true })
  embedding: number[];
}

export const ChunkSchema = SchemaFactory.createForClass(Chunk);
