import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { Role } from './roles.enum';

export type UserDocument = HydratedDocument<User>;

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  // bcrypt hash. `select: false` keeps it out of query results by default.
  @Prop({ required: true, select: false })
  password: string;

  @Prop({
    type: String,
    enum: Object.values(Role),
    default: Role.Employee,
    required: true,
  })
  role: Role;
}

export const UserSchema = SchemaFactory.createForClass(User);
