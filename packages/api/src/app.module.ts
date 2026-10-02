import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SupabaseModule } from './supabase/supabase.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { PostsModule } from './posts/posts.module';
import { WhispersModule } from './whispers/whispers.module';
import { MessagesModule } from './messages/messages.module';
import { CommunitiesModule } from './communities/communities.module';
import { StoriesModule } from './stories/stories.module';
import { ExploreModule } from './explore/explore.module';
import { AdminModule } from './admin/admin.module';
import { NotificationsModule } from './notifications/notifications.module';

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
    StoriesModule,
    ExploreModule,
    AdminModule,
    NotificationsModule,
  ],
})
export class AppModule {}
