import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SupabaseModule } from './supabase/supabase.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { PostsModule } from './posts/posts.module';
import { WhispersModule } from './whispers/whispers.module';
import { MessagesModule } from './messages/messages.module';
import { CommunitiesModule } from './communities/communities.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    SupabaseModule,
    AuthModule,
    UsersModule,
    PostsModule,
    WhispersModule,
    MessagesModule,
    CommunitiesModule,
  ],
})
export class AppModule {}
