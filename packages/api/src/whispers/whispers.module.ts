import { Module } from '@nestjs/common';
import { WhispersController } from './whispers.controller';
import { WhispersService } from './whispers.service';

@Module({
  controllers: [WhispersController],
  providers: [WhispersService],
  exports: [WhispersService],
})
export class WhispersModule {}
