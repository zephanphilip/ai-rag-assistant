import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type DocumentStatus = 'processing' | 'ready' | 'error';

// Named DocumentEntity to avoid clashing with the global `Document` type.
export type DocumentEntityDocument = HydratedDocument<DocumentEntity>;

@Schema({ timestamps: true, collection: 'documents' })
export class DocumentEntity {
  @Prop({ required: true, unique: true })
  documentId: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  filename: string;

  @Prop({ default: 0 })
  chunkCount: number;

  @Prop({
    type: String,
    enum: ['processing', 'ready', 'error'],
    default: 'processing',
  })
  status: DocumentStatus;

  // The id of the user who uploaded the document.
  @Prop()
  uploadedBy?: string;

  @Prop()
  uploadedAt?: Date;

  // Populated when status is 'error'.
  @Prop()
  error?: string;
}

export const DocumentSchema = SchemaFactory.createForClass(DocumentEntity);
