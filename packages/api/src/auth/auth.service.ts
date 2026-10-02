import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CompleteProfileDto } from './dto/complete-profile.dto';

@Injectable()
export class AuthService {
  constructor(private supabase: SupabaseService) {}

  /**
   * Called right after Supabase Auth sign-up to create the user's profile row.
   * Supabase Auth handles password hashing and email verification;
   * this creates the public profile in our profiles table.
   */
  async completeProfile(dto: CompleteProfileDto) {
    const { userId, username, displayName } = dto;

    // Check username availability (case-insensitive)
    const { data: existing } = await this.supabase.admin
      .from('profiles')
      .select('id')
      .ilike('username', username)
      .maybeSingle();

    if (existing) {
      throw new ConflictException(`Username @${username} is already taken`);
    }

    // Create the profile using the SQL function (handles privacy_settings trigger too)
    const { data, error } = await this.supabase.admin.rpc('create_profile', {
      p_user_id: userId,
      p_username: username,
      p_display_name: displayName,
    });

    if (error) {
      if (error.code === '23505') {
        throw new ConflictException(`Username @${username} is already taken`);
      }
      throw new InternalServerErrorException('Failed to create profile');
    }

    if (!data) {
      throw new InternalServerErrorException('Profile creation returned no data');
    }

    return {
      id: data.id,
      username: data.username,
      displayName: data.display_name,
      avatarUrl: data.avatar_url,
      isPrivate: data.is_private,
      createdAt: data.created_at,
    };
  }
}
