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
   * Pre-check registration availability for email & username
   */
  async checkRegistrationAvailability(email: string, username: string) {
    const { data, error } = await this.supabase.admin.rpc('check_registration_availability', {
      p_email: email,
      p_username: username,
    });

    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    if (!data?.available) {
      if (data?.field === 'email') {
        throw new ConflictException(data.message || 'This email address is already registered or permanently reserved.');
      }
      throw new ConflictException(data.message || `Username @${username} is unavailable.`);
    }

    return { available: true };
  }

  /**
   * Called right after Supabase Auth sign-up to create the user's profile row.
   * Supabase Auth handles password hashing and email verification;
   * this creates the public profile in our profiles table.
   */
  async completeProfile(dto: CompleteProfileDto) {
    const { userId, username, displayName, email, acceptedTerms, acceptedTermsAt } = dto;
    const normUsername = username.trim().toLowerCase();

    // Check registration availability server-side
    if (email) {
      await this.checkRegistrationAvailability(email, normUsername);
    } else {
      // Check username availability
      const { data: existing } = await this.supabase.admin
        .from('profiles')
        .select('id')
        .ilike('username', normUsername)
        .maybeSingle();

      if (existing) {
        throw new ConflictException(`Username @${normUsername} is already taken`);
      }
    }

    // Create the profile using the SQL function (handles email registry, username history, privacy_settings)
    const { data, error } = await this.supabase.admin.rpc('create_profile', {
      p_user_id: userId,
      p_username: normUsername,
      p_display_name: displayName,
      p_accepted_terms: acceptedTerms ?? true,
      p_accepted_terms_at: acceptedTermsAt ?? new Date().toISOString(),
      p_email: email ? email.trim().toLowerCase() : null,
    });

    if (error) {
      if (error.code === '23505' || error.message?.includes('already taken') || error.message?.includes('already registered')) {
        throw new ConflictException(error.message);
      }
      throw new InternalServerErrorException(error.message || 'Failed to create profile');
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
