import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export type SessionDocument = HydratedDocument<Session>;

@Schema({ timestamps: true })
export class Session {
  @Prop({ required: true, unique: true })
  sessionId: string;

  @Prop({
    type: [
      {
        role: { type: String, enum: ['user', 'assistant'], required: true },
        content: { type: String, required: true },
        timestamp: { type: Date, required: true },
      },
    ],
    default: [],
  })
  messages: Message[];
}

export const SessionSchema = SchemaFactory.createForClass(Session);
